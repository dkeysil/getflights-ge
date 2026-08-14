import { availabilityPolicy, flightPolicy } from './policies.js';
import { CITIES, routeKey } from './availability.js';
import { handleAlertsRequest } from './alerts-handlers.js';
import {
  canonicalDataLocale,
  defaultPreloadPassengers,
  filterAvailabilityWithFlightBundle,
  flightBundleKey,
  isFlightBundleEntryStale,
  readFlightBundle,
  readFlightBundleEntry,
  withFlightEntryStatus,
} from './flight-bundle-cache.js';

const jsonHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};
const knownCityIds = new Set(CITIES.map((city) => city.id));
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const dayMs = 24 * 60 * 60 * 1000;
const flightSearchPastGraceDays = 7;
const flightSearchFutureDays = 370;

export async function handleRequest(request, env, options = {}) {
  const url = new URL(request.url);
  const now = options.now ?? (() => new Date());

  try {
    if (url.pathname === '/api/availability' && request.method === 'GET') {
      const cached = await readFreshCache(env, 'availability:snapshot', availabilityPolicy, now);
      if (cached) {
        return json(await applyKnownTicketAvailability(env, cached));
      }

      return json(
        await applyKnownTicketAvailability(
          env,
          await getAvailabilityCoordinator(env).getAvailability({ force: false }),
        ),
      );
    }

    if (url.pathname === '/api/availability/refresh' && request.method === 'POST') {
      return json(
        await applyKnownTicketAvailability(
          env,
          await getAvailabilityCoordinator(env).getAvailability({ force: true }),
        ),
      );
    }

    if (url.pathname === '/api/flights' && request.method === 'GET') {
      const input = parseFlightSearchParams(url.searchParams, now);
      if (!input) {
        return json({ error: 'Missing required flight search parameters.' }, 400);
      }

      const cached = await readFlightBundleEntry({ kv: env.VS_CACHE_KV, input });
      if (cached) {
        const stale = isFlightBundleEntryStale(cached, now().getTime(), flightPolicy.ttlMs);
        if (!stale) {
          return json(withFlightEntryStatus(cached, { cacheStatus: 'hit', stale: false }));
        }

        if (!(await isKnownAvailableFlightSearch(env, input))) {
          return json({ error: 'Unknown route or date.' }, 400);
        }

        scheduleBackgroundRefresh(
          getFlightCoordinator(env, input).getFlights(input, {
            force: false,
            cookieHeader: '',
          }),
          options,
          url.pathname,
        );
        return json(withFlightEntryStatus(cached, { cacheStatus: 'stale', stale: true }));
      }

      if (!(await isKnownAvailableFlightSearch(env, input))) {
        return json({ error: 'Unknown route or date.' }, 400);
      }

      return json(
        await getFlightCoordinator(env, input).getFlights(input, {
          force: false,
          cookieHeader: '',
        }),
      );
    }

    if (url.pathname === '/api/flights/refresh' && request.method === 'POST') {
      const input = await readFlightSearchInput(request, url.searchParams, now);
      if (!input) {
        return json({ error: 'Missing required flight search parameters.' }, 400);
      }

      if (!(await isKnownAvailableFlightSearch(env, input))) {
        return json({ error: 'Unknown route or date.' }, 400);
      }

      return json(
        await getFlightCoordinator(env, input).getFlights(input, {
          force: true,
          cookieHeader: '',
        }),
      );
    }

    if (url.pathname.startsWith('/api/alerts/')) {
      return handleAlertsRequest(request, env, {
        now,
        getAvailabilitySnapshot: () => getAvailabilityCoordinator(env).getAvailability({ force: false }),
      });
    }

    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'cache_worker_request_failed',
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return json({ error: 'Cache worker request failed.' }, 502);
  }
}

function scheduleBackgroundRefresh(promise, options, path) {
  const guarded = promise.catch((error) => {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'cache_worker_background_refresh_failed',
        path,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  });

  if (options.executionCtx?.waitUntil) {
    options.executionCtx.waitUntil(guarded);
    return;
  }

  void guarded;
}

function getAvailabilityCoordinator(env) {
  return env.VS_CACHE_COORDINATOR.getByName('availability:snapshot');
}

function getFlightCoordinator(env, input) {
  return env.VS_CACHE_COORDINATOR.getByName(flightBundleKey(input));
}

async function applyKnownTicketAvailability(env, snapshot) {
  const bundle = await readFlightBundle(
    env.VS_CACHE_KV,
    flightBundleKey({
      tripType: 'one-way',
      officialLocale: canonicalDataLocale,
      passengers: defaultPreloadPassengers,
    }),
  );

  return filterAvailabilityWithFlightBundle(snapshot, bundle);
}

async function isKnownAvailableFlightSearch(env, input) {
  const snapshot = await getAvailabilitySnapshotForValidation(env);
  const availability = snapshot?.availability;
  if (!availability || typeof availability !== 'object') return false;

  const dates = availability[routeKey(input.fromId, input.toId)];
  if (!dates || !Array.isArray(dates.outbound) || !dates.outbound.includes(input.outboundDate)) {
    return false;
  }

  if (input.returnDate && (!Array.isArray(dates.returns) || !dates.returns.includes(input.returnDate))) {
    return false;
  }

  return true;
}

async function getAvailabilitySnapshotForValidation(env) {
  if (!env.VS_CACHE_COORDINATOR?.getByName) return null;
  return getAvailabilityCoordinator(env).getAvailability({ force: false });
}

async function readFlightSearchInput(request, searchParams, now) {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return normalizeFlightSearchInput(await request.json().catch(() => null), now);
  }

  return parseFlightSearchParams(searchParams, now);
}

function parseFlightSearchParams(params, now) {
  return normalizeFlightSearchInput({
    tripType: params.get('tripType'),
    fromId: params.get('fromId'),
    toId: params.get('toId'),
    outboundDate: params.get('outboundDate'),
    returnDate: params.get('returnDate') || undefined,
    officialLocale: canonicalDataLocale,
    passengers: {
      adult: params.get('adult'),
      child: params.get('child'),
      infant: params.get('infant'),
    },
  }, now);
}

function normalizeFlightSearchInput(value, now = () => new Date()) {
  if (!value || typeof value !== 'object') return null;

  const tripType = value.tripType === 'round-trip' ? 'round-trip' : value.tripType === 'one-way' ? 'one-way' : null;
  const officialLocale = canonicalDataLocale;
  const passengers = value.passengers && typeof value.passengers === 'object' ? value.passengers : {};
  const adult = toPassengerCount(passengers.adult, { min: 1, max: 4, defaultValue: 1 });
  const child = toPassengerCount(passengers.child, { min: 0, max: 3, defaultValue: 0 });
  const infant = toPassengerCount(passengers.infant, { min: 0, max: 3, defaultValue: 0 });
  const currentDate = now();
  const fromId = normalizeCityId(value.fromId);
  const toId = normalizeCityId(value.toId);
  const outboundDate = normalizeFlightDate(value.outboundDate, currentDate);
  const returnDate = value.returnDate ? normalizeFlightDate(value.returnDate, currentDate) : undefined;

  if (!tripType || !fromId || !toId || fromId === toId || !outboundDate) return null;
  if (value.returnDate && !returnDate) return null;
  if (adult === null || child === null || infant === null) return null;

  return {
    tripType,
    fromId,
    toId,
    outboundDate,
    returnDate,
    officialLocale,
    passengers: { adult, child, infant },
  };
}

function normalizeCityId(value) {
  const id = String(value ?? '').trim();
  return knownCityIds.has(id) ? id : null;
}

function normalizeFlightDate(value, currentDate) {
  const date = String(value ?? '').trim();
  const dateMs = parseIsoDateToUtcMs(date);
  if (dateMs === null) return null;

  const currentDayMs = startOfUtcDay(currentDate);
  const earliestMs = currentDayMs - flightSearchPastGraceDays * dayMs;
  const latestMs = currentDayMs + flightSearchFutureDays * dayMs;
  return dateMs >= earliestMs && dateMs <= latestMs ? date : null;
}

function parseIsoDateToUtcMs(value) {
  if (!isoDatePattern.test(value)) return null;

  const [year, month, day] = value.split('-').map(Number);
  const dateMs = Date.UTC(year, month - 1, day);
  const date = new Date(dateMs);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return dateMs;
}

function startOfUtcDay(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function toPassengerCount(value, { min, max, defaultValue }) {
  if (value === null || value === undefined || value === '') return defaultValue;
  const count = Number(value);
  return Number.isInteger(count) && count >= min && count <= max ? count : null;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders,
  });
}

async function readFreshCache(env, cacheKey, policy, now) {
  if (!env.VS_CACHE_KV?.get) return null;

  const value = await env.VS_CACHE_KV.get(cacheKey);
  if (!value) return null;

  try {
    const payload = JSON.parse(value);
    const loadedAt = Date.parse(payload.loadedAt);
    if (!Number.isFinite(loadedAt) || now().getTime() - loadedAt > policy.ttlMs) {
      return null;
    }

    return {
      ...payload,
      cacheStatus: 'hit',
      stale: false,
    };
  } catch {
    return null;
  }
}

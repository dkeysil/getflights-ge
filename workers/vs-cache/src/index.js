import { DurableObject } from 'cloudflare:workers';
import { buildAvailabilitySnapshot } from './availability.js';
import { createBackendSession, fetchBackendJson } from './backend-fetch.js';
import { coordinateCacheRefresh } from './cache-coordinator.js';
import {
  canonicalDataLocale,
  coordinateFlightBundleEntryRefresh,
  defaultPreloadConcurrency,
  defaultPreloadPassengers,
  flightBundleEntryKey,
  flightBundleKey,
  mergeFlightBundleEntries,
  parsePreloadLocales,
  preloadFlightBundleEntries,
  selectScheduledPreloadLocale,
} from './flight-bundle-cache.js';
import { fetchFlightSearch } from './flight-search.js';
import { handleRequest } from './handlers.js';
import { evaluateTicketAlerts } from './alerts-scheduler.js';
import { availabilityPolicy, flightPolicy } from './policies.js';

export class RefreshCoordinator extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.inFlightByKey = new Map();
    this.bundleWriteQueue = Promise.resolve();
  }

  async getAvailability(options = {}) {
    return this.runWithInFlight('availability:snapshot', () =>
      coordinateCacheRefresh({
        cacheKey: 'availability:snapshot',
        policy: availabilityPolicy,
        force: Boolean(options.force),
        kv: this.env.VS_CACHE_KV,
        storage: this.ctx.storage,
        loadFresh: () =>
          buildAvailabilitySnapshot({
            fetchJson: (path) => fetchBackendJson(path),
          }),
      }),
    );
  }

  async getFlights(input, options = {}) {
    return this.runWithInFlight(`flight:${flightBundleEntryKey(input)}`, () =>
      coordinateFlightBundleEntryRefresh({
        input,
        kv: this.env.VS_CACHE_KV,
        storage: this.ctx.storage,
        policy: flightPolicy,
        force: Boolean(options.force),
        bypassFreshCache: Boolean(options.cookieHeader),
        loadFresh: () => {
          const session = createBackendSession(options.cookieHeader);
          return fetchFlightSearch({
            input,
            fetchText: (path, init) => session.fetchText(path, init),
          });
        },
        mergeEntries: (bundleKey, entries) => this.mergeFlightBundleEntries(bundleKey, entries),
      }),
    );
  }

  async preloadFlights(snapshot, options = {}) {
    const profile = options.profile ?? {
      tripType: 'one-way',
      officialLocale: canonicalDataLocale,
      passengers: defaultPreloadPassengers,
    };

    return this.runWithInFlight(`preload:${flightBundleKey(profile)}`, () =>
      preloadFlightBundleEntries({
        kv: this.env.VS_CACHE_KV,
        snapshot,
        profile,
        policy: flightPolicy,
        concurrency: options.concurrency ?? defaultPreloadConcurrency,
        loadFresh: (input) => {
          const session = createBackendSession();
          return fetchFlightSearch({
            input,
            fetchText: (path, init) => session.fetchText(path, init),
          });
        },
        mergeEntries: (bundleKey, entries) => this.mergeFlightBundleEntries(bundleKey, entries),
      }),
    );
  }

  async mergeFlightBundleEntries(bundleKey, entries) {
    const previousWrite = this.bundleWriteQueue.catch(() => {});
    const nextWrite = previousWrite.then(() =>
      mergeFlightBundleEntries({
        kv: this.env.VS_CACHE_KV,
        bundleKey,
        entries,
        policy: flightPolicy,
      }),
    );

    this.bundleWriteQueue = nextWrite.catch(() => {});
    return nextWrite;
  }

  runWithInFlight(key, factory) {
    const existing = this.inFlightByKey.get(key);
    if (existing) return existing;

    const promise = factory().finally(() => {
      this.inFlightByKey.delete(key);
    });
    this.inFlightByKey.set(key, promise);
    return promise;
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, { executionCtx: ctx });
  },

  async scheduled(controller, env) {
    const coordinator = env.VS_CACHE_COORDINATOR.getByName('availability:snapshot');
    const snapshot = await coordinator.getAvailability({ force: false });
    const locales = parsePreloadLocales(env.PRELOAD_OFFICIAL_LOCALES);
    const scheduledDate = new Date(controller.scheduledTime ?? Date.now());
    const officialLocale = selectScheduledPreloadLocale(locales, scheduledDate);
    if (!officialLocale) return;

    const profile = {
      tripType: 'one-way',
      officialLocale,
      passengers: defaultPreloadPassengers,
    };
    const preloadCoordinator = env.VS_CACHE_COORDINATOR.getByName(flightBundleKey(profile));
    const result = await preloadCoordinator.preloadFlights(snapshot, {
      profile,
      concurrency: parsePositiveInteger(env.PRELOAD_CONCURRENCY) ?? defaultPreloadConcurrency,
    });

    console.log(
      JSON.stringify({
        level: 'info',
        message: 'flight_bundle_preload_finished',
        ...result,
      }),
    );

    try {
      await evaluateTicketAlerts({
        env,
        snapshot,
        now: () => scheduledDate,
        appOrigin: env.PUBLIC_APP_ORIGIN || 'https://getflights.ge',
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'scheduled_alert_evaluation_failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  },
};

function parsePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

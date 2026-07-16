const bundleSchemaVersion = 1;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const defaultPreloadPassengers = { adult: 1, child: 0, infant: 0 };
export const defaultPreloadConcurrency = 4;
export const canonicalDataLocale = 'en';
export const defaultPreloadLocales = [canonicalDataLocale];

export function flightBundleKey(input) {
  const passengers = input.passengers ?? defaultPreloadPassengers;
  return [
    'flight-bundle',
    input.tripType,
    input.officialLocale ?? 'en',
    passengers.adult,
    passengers.child,
    passengers.infant,
  ].join(':');
}

export function flightBundleEntryKey(input) {
  return [input.fromId, input.toId, input.outboundDate, input.returnDate ?? ''].join(':');
}

export async function readFreshFlightBundleEntry({ kv, input, policy, now = () => new Date() }) {
  const entry = await readFlightBundleEntry({ kv, input });
  if (!entry) return null;

  const currentMs = now().getTime();
  if (isFlightBundleEntryStale(entry, currentMs, policy.ttlMs)) {
    return null;
  }

  return withFlightEntryStatus(entry, { cacheStatus: 'hit', stale: false });
}

export async function readFlightBundleEntry({ kv, input }) {
  const bundle = await readFlightBundle(kv, flightBundleKey(input));
  return bundle.entries[flightBundleEntryKey(input)] ?? null;
}

export function filterAvailabilityWithFlightBundle(snapshot, bundle) {
  if (!snapshot?.availability || !bundle?.entries) return snapshot;

  const availability = Object.fromEntries(
    Object.entries(snapshot.availability).map(([routeKey, dates]) => [
      routeKey,
      {
        ...dates,
        outbound: dates.outbound.filter((date) => {
          const entry = bundle.entries[`${routeKey}:${date}:`];
          return !entry || hasSelectableFlight(entry.html);
        }),
      },
    ]),
  );

  return {
    ...snapshot,
    availability,
  };
}

export async function mergeFlightBundleEntries({
  kv,
  bundleKey,
  entries,
  policy,
  now = () => new Date(),
}) {
  const current = await readFlightBundle(kv, bundleKey);
  const next = {
    schemaVersion: bundleSchemaVersion,
    loadedAt: now().toISOString(),
    entries: { ...current.entries },
  };

  for (const [entryKey, entry] of Object.entries(entries)) {
    const existing = next.entries[entryKey];
    if (!existing || compareLoadedAt(entry.loadedAt, existing.loadedAt) >= 0) {
      next.entries[entryKey] = toFlightBundleEntry(entry);
    }
  }

  await kv.put(bundleKey, JSON.stringify(next), { expirationTtl: policy.staleExpirationTtl });
  return next;
}

export async function coordinateFlightBundleEntryRefresh({
  input,
  kv,
  storage,
  policy,
  force = false,
  bypassFreshCache = false,
  now = () => new Date(),
  loadFresh,
  mergeEntries,
}) {
  const bundleKey = flightBundleKey(input);
  const entryKey = flightBundleEntryKey(input);
  const currentTime = now();
  const currentMs = currentTime.getTime();
  const cached = await readFlightBundleEntry({ kv, input });

  if (!force && !bypassFreshCache && cached && !isFlightBundleEntryStale(cached, currentMs, policy.ttlMs)) {
    return withFlightEntryStatus(cached, { cacheStatus: 'hit', stale: false });
  }

  const nextManualRefreshKey = `nextManualRefreshAt:${entryKey}`;
  const nextManualRefreshAt = await storage?.get?.(nextManualRefreshKey);
  if (force && cached && nextManualRefreshAt && Date.parse(nextManualRefreshAt) > currentMs) {
    return withFlightEntryStatus(cached, {
      cacheStatus: 'cooldown',
      stale: isFlightBundleEntryStale(cached, currentMs, policy.ttlMs),
      refreshAllowedAt: nextManualRefreshAt,
    });
  }

  const lockKey = `lockExpiresAt:${entryKey}`;
  const lockExpiresAt = await storage?.get?.(lockKey);
  if (cached && lockExpiresAt && Date.parse(lockExpiresAt) > currentMs) {
    return withFlightEntryStatus(cached, {
      cacheStatus: 'refreshing',
      stale: isFlightBundleEntryStale(cached, currentMs, policy.ttlMs),
    });
  }

  await storage?.put?.(lockKey, new Date(currentMs + policy.lockMs).toISOString());

  try {
    const fresh = toFlightBundleEntry(await loadFresh());
    await mergeEntries(bundleKey, { [entryKey]: fresh });

    if (force) {
      await storage?.put?.(
        nextManualRefreshKey,
        new Date(currentMs + policy.manualCooldownMs).toISOString(),
      );
    }

    return withFlightEntryStatus(fresh, { cacheStatus: 'refreshed', stale: false });
  } catch (error) {
    if (cached) {
      return withFlightEntryStatus(cached, { cacheStatus: 'stale', stale: true });
    }
    throw error;
  } finally {
    await storage?.delete?.(lockKey);
  }
}

export async function preloadFlightBundleEntries({
  kv,
  snapshot,
  profile,
  policy,
  concurrency = defaultPreloadConcurrency,
  now = () => new Date(),
  loadFresh,
  mergeEntries,
}) {
  const bundleKey = flightBundleKey(profile);
  const inputs = buildPreloadFlightInputs(snapshot, profile);
  const bundle = await readFlightBundle(kv, bundleKey);
  const candidates = flightBundleEntriesNeedingRefresh({ bundle, inputs, policy, now });
  const refreshedEntries = {};
  let failed = 0;
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, candidates.length || 1));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < candidates.length) {
        const input = candidates[cursor];
        cursor += 1;

        try {
          refreshedEntries[flightBundleEntryKey(input)] = toFlightBundleEntry(await loadFresh(input));
        } catch {
          failed += 1;
        }
      }
    }),
  );

  const refreshed = Object.keys(refreshedEntries).length;
  if (refreshed > 0) {
    await mergeEntries(bundleKey, refreshedEntries);
  }

  return {
    bundleKey,
    total: inputs.length,
    skippedFresh: inputs.length - candidates.length,
    refreshed,
    failed,
    loadedAt: now().toISOString(),
  };
}

export function toFlightBundleEntry(payload) {
  return {
    resultUrl: payload.resultUrl,
    html: payload.html,
    loadedAt: payload.loadedAt,
  };
}

export function withFlightEntryStatus(entry, metadata) {
  return {
    resultUrl: entry.resultUrl,
    html: entry.html,
    loadedAt: entry.loadedAt,
    ...metadata,
  };
}

export function hasSelectableFlight(html = '') {
  return /<input\b[^>]*type\s*=\s*(?:"checkbox"|'checkbox'|checkbox)/i.test(html);
}

export function isFlightBundleEntryStale(entry, currentMs, ttlMs) {
  const loadedMs = Date.parse(entry.loadedAt);
  return !Number.isFinite(loadedMs) || currentMs - loadedMs > ttlMs;
}

export function buildPreloadFlightInputs(snapshot, profile) {
  return Object.entries(snapshot?.availability ?? {})
    .flatMap(([routeKey, availability]) => {
      const [fromId, toId] = routeKey.split(':');
      if (!fromId || !toId) return [];

      return [...new Set(availability?.outbound ?? [])]
        .filter((date) => isoDatePattern.test(date))
        .sort()
        .map((outboundDate) => ({
          tripType: profile.tripType,
          fromId,
          toId,
          outboundDate,
          officialLocale: profile.officialLocale,
          passengers: { ...profile.passengers },
        }));
    })
    .sort((left, right) =>
      `${left.fromId}:${left.toId}:${left.outboundDate}`.localeCompare(
        `${right.fromId}:${right.toId}:${right.outboundDate}`,
      ),
    );
}

export function parsePreloadLocales(value) {
  const locales = String(value ?? '')
    .split(',')
    .map((locale) => locale.trim())
    .filter((locale) => locale === 'ru' || locale === 'en');

  return locales.length > 0 ? [...new Set(locales)] : defaultPreloadLocales;
}

export function selectScheduledPreloadLocale(locales, scheduledDate) {
  if (!locales.length) return null;
  const slot = Math.floor(scheduledDate.getUTCMinutes() / 10);
  return locales[slot % locales.length];
}

export function flightBundleEntriesNeedingRefresh({ bundle, inputs, policy, now = () => new Date() }) {
  const currentMs = now().getTime();
  return inputs.filter((input) => {
    const entry = bundle.entries[flightBundleEntryKey(input)];
    return !entry || isFlightBundleEntryStale(entry, currentMs, policy.ttlMs);
  });
}

export async function readFlightBundle(kv, bundleKey) {
  if (!kv?.get) return emptyFlightBundle();

  const value = await kv.get(bundleKey);
  if (!value) return emptyFlightBundle();

  try {
    const parsed = JSON.parse(value);
    if (parsed?.schemaVersion !== bundleSchemaVersion || !parsed.entries || typeof parsed.entries !== 'object') {
      return emptyFlightBundle();
    }

    return {
      schemaVersion: bundleSchemaVersion,
      loadedAt: typeof parsed.loadedAt === 'string' ? parsed.loadedAt : null,
      entries: parsed.entries,
    };
  } catch {
    return emptyFlightBundle();
  }
}

function emptyFlightBundle() {
  return {
    schemaVersion: bundleSchemaVersion,
    loadedAt: null,
    entries: {},
  };
}

function compareLoadedAt(left, right) {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (!Number.isFinite(leftMs) && !Number.isFinite(rightMs)) return 0;
  if (!Number.isFinite(leftMs)) return -1;
  if (!Number.isFinite(rightMs)) return 1;
  return leftMs - rightMs;
}

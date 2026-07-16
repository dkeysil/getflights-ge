const lockKey = 'lockExpiresAt';
const manualRefreshKey = 'nextManualRefreshAt';

export async function coordinateCacheRefresh({
  cacheKey,
  kv,
  storage,
  policy,
  force,
  bypassFreshCache = false,
  now = () => new Date(),
  loadFresh,
}) {
  const currentTime = now();
  const currentMs = currentTime.getTime();
  const cached = await readCachedPayload(kv, cacheKey);

  if (!force && !bypassFreshCache && cached && !isStale(cached, currentMs, policy.ttlMs)) {
    return withStatus(cached, { cacheStatus: 'hit', stale: false });
  }

  const nextManualRefreshAt = await storage.get(manualRefreshKey);
  if (force && cached && nextManualRefreshAt && Date.parse(nextManualRefreshAt) > currentMs) {
    return withStatus(cached, {
      cacheStatus: 'cooldown',
      stale: isStale(cached, currentMs, policy.ttlMs),
      refreshAllowedAt: nextManualRefreshAt,
    });
  }

  const lockExpiresAt = await storage.get(lockKey);
  if (cached && lockExpiresAt && Date.parse(lockExpiresAt) > currentMs) {
    return withStatus(cached, {
      cacheStatus: 'refreshing',
      stale: isStale(cached, currentMs, policy.ttlMs),
    });
  }

  await storage.put(lockKey, new Date(currentMs + policy.lockMs).toISOString());

  try {
    const fresh = await loadFresh();
    await kv.put(cacheKey, JSON.stringify(fresh), { expirationTtl: policy.staleExpirationTtl });

    if (force) {
      await storage.put(
        manualRefreshKey,
        new Date(currentMs + policy.manualCooldownMs).toISOString(),
      );
    }

    return withStatus(fresh, { cacheStatus: 'refreshed', stale: false });
  } catch (error) {
    if (cached) {
      return withStatus(cached, { cacheStatus: 'stale', stale: true });
    }
    throw error;
  } finally {
    await storage.delete(lockKey);
  }
}

async function readCachedPayload(kv, cacheKey) {
  const value = await kv.get(cacheKey);
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function withStatus(payload, metadata) {
  return {
    ...payload,
    ...metadata,
  };
}

function isStale(payload, currentMs, ttlMs) {
  const loadedMs = Date.parse(payload.loadedAt);
  return !Number.isFinite(loadedMs) || currentMs - loadedMs > ttlMs;
}

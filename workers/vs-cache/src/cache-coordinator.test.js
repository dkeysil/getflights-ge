import { describe, expect, it, vi } from 'vitest';
import { coordinateCacheRefresh } from './cache-coordinator.js';

function createKv(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key) => values.get(key) ?? null),
    put: vi.fn(async (key, value) => {
      values.set(key, value);
    }),
    values,
  };
}

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key) => values.get(key)),
    put: vi.fn(async (key, value) => {
      values.set(key, value);
    }),
    delete: vi.fn(async (key) => {
      values.delete(key);
    }),
    values,
  };
}

const policy = {
  ttlMs: 10 * 60 * 1000,
  manualCooldownMs: 60 * 1000,
  lockMs: 2 * 60 * 1000,
  staleExpirationTtl: 24 * 60 * 60,
};

describe('cache refresh coordination', () => {
  it('returns a fresh cached payload without calling the upstream loader', async () => {
    const kv = createKv({
      availability: JSON.stringify({ loadedAt: '2026-07-01T10:00:00.000Z', routeCatalog: [] }),
    });
    const loadFresh = vi.fn();

    const result = await coordinateCacheRefresh({
      cacheKey: 'availability',
      kv,
      storage: createStorage(),
      policy,
      force: false,
      now: () => new Date('2026-07-01T10:05:00.000Z'),
      loadFresh,
    });

    expect(result).toEqual({
      loadedAt: '2026-07-01T10:00:00.000Z',
      routeCatalog: [],
      cacheStatus: 'hit',
      stale: false,
    });
    expect(loadFresh).not.toHaveBeenCalled();
  });

  it('enforces manual refresh cooldowns while still returning cached data', async () => {
    const kv = createKv({
      availability: JSON.stringify({ loadedAt: '2026-07-01T10:00:00.000Z', routeCatalog: [] }),
    });
    const loadFresh = vi.fn();

    const result = await coordinateCacheRefresh({
      cacheKey: 'availability',
      kv,
      storage: createStorage({
        nextManualRefreshAt: '2026-07-01T10:02:00.000Z',
      }),
      policy,
      force: true,
      now: () => new Date('2026-07-01T10:01:00.000Z'),
      loadFresh,
    });

    expect(result).toMatchObject({
      loadedAt: '2026-07-01T10:00:00.000Z',
      cacheStatus: 'cooldown',
      stale: false,
      refreshAllowedAt: '2026-07-01T10:02:00.000Z',
    });
    expect(loadFresh).not.toHaveBeenCalled();
  });

  it('refreshes stale data and writes the fresh payload to KV', async () => {
    const kv = createKv({
      availability: JSON.stringify({ loadedAt: '2026-07-01T09:00:00.000Z', routeCatalog: [] }),
    });
    const storage = createStorage();
    const loadFresh = vi.fn(async () => ({
      loadedAt: '2026-07-01T10:15:00.000Z',
      routeCatalog: [{ from: { id: '7' }, destinations: [] }],
    }));

    const result = await coordinateCacheRefresh({
      cacheKey: 'availability',
      kv,
      storage,
      policy,
      force: true,
      now: () => new Date('2026-07-01T10:15:00.000Z'),
      loadFresh,
    });

    expect(result).toMatchObject({
      loadedAt: '2026-07-01T10:15:00.000Z',
      cacheStatus: 'refreshed',
      stale: false,
    });
    expect(JSON.parse(kv.values.get('availability'))).toMatchObject({
      loadedAt: '2026-07-01T10:15:00.000Z',
    });
    expect(storage.values.get('nextManualRefreshAt')).toBe('2026-07-01T10:16:00.000Z');
  });

  it('can bypass a fresh cache hit when caller context should repair the cache', async () => {
    const kv = createKv({
      availability: JSON.stringify({ loadedAt: '2026-07-01T10:00:00.000Z', routeCatalog: [] }),
    });
    const loadFresh = vi.fn(async () => ({
      loadedAt: '2026-07-01T10:01:00.000Z',
      routeCatalog: [{ from: { id: '7' }, destinations: [] }],
    }));

    const result = await coordinateCacheRefresh({
      cacheKey: 'availability',
      kv,
      storage: createStorage(),
      policy,
      force: false,
      bypassFreshCache: true,
      now: () => new Date('2026-07-01T10:01:00.000Z'),
      loadFresh,
    });

    expect(result).toMatchObject({
      loadedAt: '2026-07-01T10:01:00.000Z',
      cacheStatus: 'refreshed',
      stale: false,
    });
    expect(loadFresh).toHaveBeenCalledTimes(1);
  });

  it('falls back to stale cached data when the upstream refresh fails', async () => {
    const kv = createKv({
      availability: JSON.stringify({ loadedAt: '2026-07-01T09:00:00.000Z', routeCatalog: [] }),
    });

    const result = await coordinateCacheRefresh({
      cacheKey: 'availability',
      kv,
      storage: createStorage(),
      policy,
      force: false,
      now: () => new Date('2026-07-01T10:15:00.000Z'),
      loadFresh: async () => {
        throw new Error('upstream timeout');
      },
    });

    expect(result).toEqual({
      loadedAt: '2026-07-01T09:00:00.000Z',
      routeCatalog: [],
      cacheStatus: 'stale',
      stale: true,
    });
  });
});

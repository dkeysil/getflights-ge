import { describe, expect, it, vi } from 'vitest';
import { handleRequest } from './handlers.js';

function defaultAvailabilityResult() {
  return {
    loadedAt: '2026-07-01T10:00:00.000Z',
    availability: {
      '4:7': {
        outbound: ['2026-06-30'],
        returns: [],
      },
      '7:4': {
        outbound: ['2026-07-02', '2026-07-12'],
        returns: ['2026-07-03'],
      },
    },
  };
}

function createEnv(result, options = {}) {
  const availabilityResult =
    options.availabilityResult ?? (result?.availability ? result : defaultAvailabilityResult());
  const flightResult = options.flightResult ?? result;
  const coordinator = {
    getAvailability: vi.fn(async (options) => ({ ...availabilityResult, options })),
    getFlights: vi.fn(async (input, options) => ({ ...flightResult, input, options })),
  };
  const getByName = vi.fn(() => coordinator);

  return {
    env: {
      VS_CACHE_COORDINATOR: { getByName },
    },
    coordinator,
    getByName,
  };
}

describe('cache worker request handler', () => {
  it('serves fresh availability snapshots directly from KV without touching the coordinator', async () => {
    const { env, coordinator, getByName } = createEnv({});
    env.VS_CACHE_KV = {
      get: vi.fn(async () =>
        JSON.stringify({
          loadedAt: '2026-07-01T10:00:00.000Z',
          routeCatalog: [],
        }),
      ),
    };

    const response = await handleRequest(new Request('https://cache.example/api/availability'), env, {
      now: () => new Date('2026-07-01T10:05:00.000Z'),
    });

    await expect(response.json()).resolves.toEqual({
      loadedAt: '2026-07-01T10:00:00.000Z',
      routeCatalog: [],
      cacheStatus: 'hit',
      stale: false,
    });
    expect(getByName).not.toHaveBeenCalled();
    expect(coordinator.getAvailability).not.toHaveBeenCalled();
  });

  it('filters known no-ticket dates out of availability using the canonical flight bundle', async () => {
    const { env, coordinator, getByName } = createEnv({});
    env.VS_CACHE_KV = {
      get: vi.fn(async (key) => {
        if (key === 'availability:snapshot') {
          return JSON.stringify({
            loadedAt: '2026-07-01T10:00:00.000Z',
            availability: {
              '7:4': {
                outbound: ['2026-07-02', '2026-07-03', '2026-07-04'],
                returns: [],
              },
            },
            routeCatalog: [],
          });
        }

        if (key === 'flight-bundle:one-way:en:1:0:0') {
          return JSON.stringify({
            schemaVersion: 1,
            loadedAt: '2026-07-01T10:00:00.000Z',
            entries: {
              '7:4:2026-07-02:': {
                resultUrl: '/en/tickets',
                html: '<form><input type="checkbox" /></form>',
                loadedAt: '2026-07-01T10:00:00.000Z',
              },
              '7:4:2026-07-03:': {
                resultUrl: '/en/tickets',
                html: '<h3>There are no available tickets. Please choose different dates.</h3>',
                loadedAt: '2026-07-01T10:00:00.000Z',
              },
            },
          });
        }

        return null;
      }),
    };

    const response = await handleRequest(new Request('https://cache.example/api/availability?officialLocale=ru'), env, {
      now: () => new Date('2026-07-01T10:05:00.000Z'),
    });

    await expect(response.json()).resolves.toMatchObject({
      availability: {
        '7:4': {
          outbound: ['2026-07-02', '2026-07-04'],
        },
      },
      cacheStatus: 'hit',
      stale: false,
    });
    expect(env.VS_CACHE_KV.get).toHaveBeenCalledWith('availability:snapshot');
    expect(env.VS_CACHE_KV.get).toHaveBeenCalledWith('flight-bundle:one-way:en:1:0:0');
    expect(getByName).not.toHaveBeenCalled();
    expect(coordinator.getAvailability).not.toHaveBeenCalled();
  });

  it('serves cached availability snapshots through the availability coordinator', async () => {
    const { env, coordinator, getByName } = createEnv(
      {},
      { availabilityResult: { loadedAt: '2026-07-01T10:00:00.000Z' } },
    );

    const response = await handleRequest(new Request('https://cache.example/api/availability'), env);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      loadedAt: '2026-07-01T10:00:00.000Z',
      options: { force: false },
    });
    expect(getByName).toHaveBeenCalledWith('availability:snapshot');
    expect(coordinator.getAvailability).toHaveBeenCalledWith({ force: false });
  });

  it('forces availability refreshes for the manual refresh endpoint', async () => {
    const { env, coordinator } = createEnv({ cacheStatus: 'refreshed' });

    await handleRequest(new Request('https://cache.example/api/availability/refresh', { method: 'POST' }), env);

    expect(coordinator.getAvailability).toHaveBeenCalledWith({ force: true });
  });

  it('serves selected-day flight searches through a per-search coordinator', async () => {
    const { env, coordinator, getByName } = createEnv({ resultUrl: '/ru/tickets', html: '<form></form>' });

    const response = await handleRequest(
      new Request(
        'https://cache.example/api/flights?tripType=one-way&fromId=4&toId=7&outboundDate=2026-06-30&officialLocale=ru&adult=1&child=0&infant=0',
      ),
      env,
      { now: () => new Date('2026-07-01T12:00:00.000Z') },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resultUrl: '/ru/tickets',
      html: '<form></form>',
      input: {
        tripType: 'one-way',
        fromId: '4',
        toId: '7',
        outboundDate: '2026-06-30',
        officialLocale: 'en',
        passengers: { adult: 1, child: 0, infant: 0 },
      },
      options: { force: false },
    });
    expect(getByName).toHaveBeenCalledWith('flight-bundle:one-way:en:1:0:0');
    expect(coordinator.getFlights).toHaveBeenCalledTimes(1);
  });

  it('serves fresh selected-day flight searches directly from the bundled KV value', async () => {
    const { env, coordinator, getByName } = createEnv({});
    env.VS_CACHE_KV = {
      get: vi.fn(async (key) => {
        expect(key).toBe('flight-bundle:one-way:en:1:0:0');
        return JSON.stringify({
          schemaVersion: 1,
          loadedAt: '2026-07-01T10:00:00.000Z',
          entries: {
            '7:4:2026-07-02:': {
              resultUrl: '/ru/tickets',
              html: '<form id="form-select-flight"></form>',
              loadedAt: '2026-07-01T10:00:00.000Z',
            },
          },
        });
      }),
    };

    const response = await handleRequest(
      new Request(
        'https://cache.example/api/flights?tripType=one-way&fromId=7&toId=4&outboundDate=2026-07-02&officialLocale=ru&adult=1&child=0&infant=0',
      ),
      env,
      { now: () => new Date('2026-07-01T10:10:00.000Z') },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      resultUrl: '/ru/tickets',
      html: '<form id="form-select-flight"></form>',
      loadedAt: '2026-07-01T10:00:00.000Z',
      cacheStatus: 'hit',
      stale: false,
    });
    expect(getByName).not.toHaveBeenCalled();
    expect(coordinator.getFlights).not.toHaveBeenCalled();
  });

  it('serves fresh selected-day flight searches from the bundle even when the browser sends cookies', async () => {
    const { env, coordinator, getByName } = createEnv({});
    env.VS_CACHE_KV = {
      get: vi.fn(async () =>
        JSON.stringify({
          schemaVersion: 1,
          loadedAt: '2026-07-01T10:00:00.000Z',
          entries: {
            '7:4:2026-07-02:': {
              resultUrl: '/ru/tickets',
              html: '<form id="form-select-flight"></form>',
              loadedAt: '2026-07-01T10:00:00.000Z',
            },
          },
        }),
      ),
    };

    const response = await handleRequest(
      new Request(
        'https://cache.example/api/flights?tripType=one-way&fromId=7&toId=4&outboundDate=2026-07-02&officialLocale=ru&adult=1&child=0&infant=0',
        { headers: { Cookie: 'SSESSabc=caller-value' } },
      ),
      env,
      { now: () => new Date('2026-07-01T10:01:00.000Z') },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resultUrl: '/ru/tickets',
      html: '<form id="form-select-flight"></form>',
      cacheStatus: 'hit',
      stale: false,
    });
    expect(env.VS_CACHE_KV.get).toHaveBeenCalledWith('flight-bundle:one-way:en:1:0:0');
    expect(getByName).not.toHaveBeenCalled();
    expect(coordinator.getFlights).not.toHaveBeenCalled();
  });

  it('returns a stale selected-day flight search immediately and refreshes it in the background', async () => {
    const { env, coordinator, getByName } = createEnv({});
    const refreshPromise = new Promise(() => {});
    coordinator.getFlights.mockReturnValue(refreshPromise);
    const waitUntil = vi.fn();
    env.VS_CACHE_KV = {
      get: vi.fn(async () =>
        JSON.stringify({
          schemaVersion: 1,
          loadedAt: '2026-07-01T09:00:00.000Z',
          entries: {
            '7:4:2026-07-12:': {
              resultUrl: '/en/tickets',
              html: '<form id="form-select-flight"><input type="checkbox" /></form>',
              loadedAt: '2026-07-01T09:00:00.000Z',
            },
          },
        }),
      ),
    };

    const response = await Promise.race([
      handleRequest(
        new Request(
          'https://cache.example/api/flights?tripType=one-way&fromId=7&toId=4&outboundDate=2026-07-12&adult=1&child=0&infant=0',
        ),
        env,
        {
          now: () => new Date('2026-07-01T10:00:00.000Z'),
          executionCtx: { waitUntil },
        },
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('request waited for refresh')), 50)),
    ]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      resultUrl: '/en/tickets',
      html: '<form id="form-select-flight"><input type="checkbox" /></form>',
      loadedAt: '2026-07-01T09:00:00.000Z',
      cacheStatus: 'stale',
      stale: true,
    });
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(getByName).toHaveBeenCalledWith('flight-bundle:one-way:en:1:0:0');
    expect(coordinator.getFlights).toHaveBeenCalledWith(
      {
        tripType: 'one-way',
        fromId: '7',
        toId: '4',
        outboundDate: '2026-07-12',
        returnDate: undefined,
        officialLocale: 'en',
        passengers: { adult: 1, child: 0, infant: 0 },
      },
      { force: false, cookieHeader: '' },
    );
  });

  it('rejects unknown city IDs before touching the flight coordinator', async () => {
    const { env, coordinator, getByName } = createEnv({});

    const response = await handleRequest(
      new Request(
        'https://cache.example/api/flights?tripType=one-way&fromId=NOT_A_CITY&toId=4&outboundDate=2026-07-02&adult=1&child=0&infant=0',
      ),
      env,
      { now: () => new Date('2026-07-01T10:00:00.000Z') },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing required flight search parameters.',
    });
    expect(getByName).not.toHaveBeenCalled();
    expect(coordinator.getFlights).not.toHaveBeenCalled();
  });

  it('rejects malformed flight dates before touching the flight coordinator', async () => {
    const { env, coordinator, getByName } = createEnv({});

    const response = await handleRequest(
      new Request(
        'https://cache.example/api/flights?tripType=one-way&fromId=7&toId=4&outboundDate=not-a-date&adult=1&child=0&infant=0',
      ),
      env,
      { now: () => new Date('2026-07-01T10:00:00.000Z') },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing required flight search parameters.',
    });
    expect(getByName).not.toHaveBeenCalled();
    expect(coordinator.getFlights).not.toHaveBeenCalled();
  });

  it('rejects unavailable route dates before refreshing a flight entry', async () => {
    const { env, coordinator } = createEnv({
      availability: {
        '7:4': {
          outbound: ['2026-07-02'],
          returns: ['2026-07-03'],
        },
      },
      loadedAt: '2026-07-01T10:00:00.000Z',
    });

    const response = await handleRequest(
      new Request(
        'https://cache.example/api/flights?tripType=round-trip&fromId=7&toId=4&outboundDate=2026-07-02&returnDate=2026-08-01&adult=1&child=0&infant=0',
      ),
      env,
      { now: () => new Date('2026-07-01T10:00:00.000Z') },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Unknown route or date.',
    });
    expect(coordinator.getAvailability).toHaveBeenCalledWith({ force: false });
    expect(coordinator.getFlights).not.toHaveBeenCalled();
  });

  it('fails closed when availability validation has no route data', async () => {
    const { env, coordinator } = createEnv(
      { resultUrl: '/en/tickets', html: '<form></form>' },
      { availabilityResult: { loadedAt: '2026-07-01T10:00:00.000Z' } },
    );

    const response = await handleRequest(
      new Request(
        'https://cache.example/api/flights?tripType=one-way&fromId=7&toId=4&outboundDate=2026-07-02&adult=1&child=0&infant=0',
      ),
      env,
      { now: () => new Date('2026-07-01T10:00:00.000Z') },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Unknown route or date.',
    });
    expect(coordinator.getAvailability).toHaveBeenCalledWith({ force: false });
    expect(coordinator.getFlights).not.toHaveBeenCalled();
  });

  it('rejects incomplete selected-day flight searches', async () => {
    const { env } = createEnv({});

    const response = await handleRequest(new Request('https://cache.example/api/flights?fromId=4'), env);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing required flight search parameters.',
    });
  });
});

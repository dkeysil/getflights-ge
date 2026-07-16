import { describe, expect, it, vi } from 'vitest';
import {
  buildPreloadFlightInputs,
  coordinateFlightBundleEntryRefresh,
  filterAvailabilityWithFlightBundle,
  flightBundleEntryKey,
  flightBundleKey,
  mergeFlightBundleEntries,
  preloadFlightBundleEntries,
  readFreshFlightBundleEntry,
  selectScheduledPreloadLocale,
} from './flight-bundle-cache.js';

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

const defaultInput = {
  tripType: 'one-way',
  fromId: '7',
  toId: '4',
  outboundDate: '2026-07-02',
  officialLocale: 'ru',
  passengers: { adult: 1, child: 0, infant: 0 },
};

const policy = {
  ttlMs: 30 * 60 * 1000,
  manualCooldownMs: 60 * 1000,
  lockMs: 2 * 60 * 1000,
  staleExpirationTtl: 12 * 60 * 60,
};

describe('flight bundle cache helpers', () => {
  it('groups selected-day flights into one bundle per search profile', () => {
    expect(flightBundleKey(defaultInput)).toBe('flight-bundle:one-way:ru:1:0:0');
    expect(flightBundleEntryKey(defaultInput)).toBe('7:4:2026-07-02:');
  });

  it('returns a fresh selected-day entry from the bundled KV value', async () => {
    const kv = createKv({
      'flight-bundle:one-way:ru:1:0:0': JSON.stringify({
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
    });

    await expect(
      readFreshFlightBundleEntry({
        kv,
        input: defaultInput,
        policy,
        now: () => new Date('2026-07-01T10:20:00.000Z'),
      }),
    ).resolves.toEqual({
      resultUrl: '/ru/tickets',
      html: '<form id="form-select-flight"></form>',
      loadedAt: '2026-07-01T10:00:00.000Z',
      cacheStatus: 'hit',
      stale: false,
    });
  });

  it('merges refreshed entries into the bundle with one KV write and preserves newer entries', async () => {
    const kv = createKv({
      'flight-bundle:one-way:ru:1:0:0': JSON.stringify({
        schemaVersion: 1,
        loadedAt: '2026-07-01T10:00:00.000Z',
        entries: {
          '7:4:2026-07-02:': {
            resultUrl: '/ru/tickets',
            html: '<form>newer manual refresh</form>',
            loadedAt: '2026-07-01T10:05:00.000Z',
          },
          '7:4:2026-07-03:': {
            resultUrl: '/ru/tickets',
            html: '<form>existing</form>',
            loadedAt: '2026-07-01T10:00:00.000Z',
          },
        },
      }),
    });

    await mergeFlightBundleEntries({
      kv,
      bundleKey: 'flight-bundle:one-way:ru:1:0:0',
      entries: {
        '7:4:2026-07-02:': {
          resultUrl: '/ru/tickets',
          html: '<form>older preload</form>',
          loadedAt: '2026-07-01T10:04:00.000Z',
        },
        '7:4:2026-07-04:': {
          resultUrl: '/ru/tickets',
          html: '<form>fresh preload</form>',
          loadedAt: '2026-07-01T10:04:00.000Z',
        },
      },
      policy,
      now: () => new Date('2026-07-01T10:06:00.000Z'),
    });

    expect(kv.put).toHaveBeenCalledTimes(1);
    const bundle = JSON.parse(kv.values.get('flight-bundle:one-way:ru:1:0:0'));
    expect(bundle.loadedAt).toBe('2026-07-01T10:06:00.000Z');
    expect(bundle.entries['7:4:2026-07-02:'].html).toBe('<form>newer manual refresh</form>');
    expect(bundle.entries['7:4:2026-07-03:'].html).toBe('<form>existing</form>');
    expect(bundle.entries['7:4:2026-07-04:'].html).toBe('<form>fresh preload</form>');
  });

  it('refreshes one selected-date entry by mutating the profile bundle', async () => {
    const kv = createKv({
      'flight-bundle:one-way:ru:1:0:0': JSON.stringify({
        schemaVersion: 1,
        loadedAt: '2026-07-01T10:00:00.000Z',
        entries: {
          '7:4:2026-07-03:': {
            resultUrl: '/ru/tickets',
            html: '<form>other date</form>',
            loadedAt: '2026-07-01T10:00:00.000Z',
          },
        },
      }),
    });
    const mergeEntries = vi.fn(async () => {});

    const result = await coordinateFlightBundleEntryRefresh({
      input: defaultInput,
      kv,
      storage: createStorage(),
      policy,
      force: false,
      now: () => new Date('2026-07-01T10:30:00.000Z'),
      loadFresh: vi.fn(async () => ({
        resultUrl: '/ru/tickets',
        html: '<form>fresh selected day</form>',
        loadedAt: '2026-07-01T10:30:00.000Z',
      })),
      mergeEntries,
    });

    expect(result).toEqual({
      resultUrl: '/ru/tickets',
      html: '<form>fresh selected day</form>',
      loadedAt: '2026-07-01T10:30:00.000Z',
      cacheStatus: 'refreshed',
      stale: false,
    });
    expect(mergeEntries).toHaveBeenCalledWith('flight-bundle:one-way:ru:1:0:0', {
      '7:4:2026-07-02:': {
        resultUrl: '/ru/tickets',
        html: '<form>fresh selected day</form>',
        loadedAt: '2026-07-01T10:30:00.000Z',
      },
    });
  });

  it('preloads missing and stale dates, then writes the bundle once', async () => {
    const kv = createKv({
      'flight-bundle:one-way:ru:1:0:0': JSON.stringify({
        schemaVersion: 1,
        loadedAt: '2026-07-01T10:00:00.000Z',
        entries: {
          '7:4:2026-07-02:': {
            resultUrl: '/ru/tickets',
            html: '<form>fresh enough</form>',
            loadedAt: '2026-07-01T10:20:00.000Z',
          },
          '7:4:2026-07-03:': {
            resultUrl: '/ru/tickets',
            html: '<form>stale</form>',
            loadedAt: '2026-07-01T09:00:00.000Z',
          },
        },
      }),
    });
    const loadFresh = vi.fn(async (input) => ({
      resultUrl: '/ru/tickets',
      html: `<form>${input.outboundDate}</form>`,
      loadedAt: '2026-07-01T10:31:00.000Z',
    }));
    const mergeEntries = vi.fn(async () => {});

    const result = await preloadFlightBundleEntries({
      kv,
      snapshot: {
        availability: {
          '7:4': { outbound: ['2026-07-02', '2026-07-03', '2026-07-04'], returns: [] },
        },
      },
      profile: {
        tripType: 'one-way',
        officialLocale: 'ru',
        passengers: { adult: 1, child: 0, infant: 0 },
      },
      policy,
      concurrency: 2,
      now: () => new Date('2026-07-01T10:31:00.000Z'),
      loadFresh,
      mergeEntries,
    });

    expect(result).toMatchObject({
      total: 3,
      skippedFresh: 1,
      refreshed: 2,
      failed: 0,
      bundleKey: 'flight-bundle:one-way:ru:1:0:0',
    });
    expect(loadFresh).toHaveBeenCalledTimes(2);
    expect(loadFresh.mock.calls.map(([input]) => input.outboundDate)).toEqual(['2026-07-03', '2026-07-04']);
    expect(mergeEntries).toHaveBeenCalledTimes(1);
    expect(mergeEntries).toHaveBeenCalledWith('flight-bundle:one-way:ru:1:0:0', {
      '7:4:2026-07-03:': {
        resultUrl: '/ru/tickets',
        html: '<form>2026-07-03</form>',
        loadedAt: '2026-07-01T10:31:00.000Z',
      },
      '7:4:2026-07-04:': {
        resultUrl: '/ru/tickets',
        html: '<form>2026-07-04</form>',
        loadedAt: '2026-07-01T10:31:00.000Z',
      },
    });
  });

  it('builds one-way preload inputs from outbound availability dates', () => {
    expect(
      buildPreloadFlightInputs(
        {
          availability: {
            '7:4': { outbound: ['2026-07-02', '2026-07-03'], returns: ['2026-07-04'] },
            '6:7': { outbound: ['2026-07-05'], returns: [] },
          },
        },
        {
          tripType: 'one-way',
          officialLocale: 'ru',
          passengers: { adult: 1, child: 0, infant: 0 },
        },
      ),
    ).toEqual([
      {
        tripType: 'one-way',
        fromId: '6',
        toId: '7',
        outboundDate: '2026-07-05',
        officialLocale: 'ru',
        passengers: { adult: 1, child: 0, infant: 0 },
      },
      {
        tripType: 'one-way',
        fromId: '7',
        toId: '4',
        outboundDate: '2026-07-02',
        officialLocale: 'ru',
        passengers: { adult: 1, child: 0, infant: 0 },
      },
      {
        tripType: 'one-way',
        fromId: '7',
        toId: '4',
        outboundDate: '2026-07-03',
        officialLocale: 'ru',
        passengers: { adult: 1, child: 0, infant: 0 },
      },
    ]);
  });

  it('removes only dates that the flight bundle proves have no selectable ticket', () => {
    const snapshot = {
      availability: {
        '7:4': {
          outbound: ['2026-07-02', '2026-07-03', '2026-07-04'],
          returns: ['2026-07-03'],
        },
      },
    };
    const bundle = {
      entries: {
        '7:4:2026-07-02:': {
          html: '<form id="form-select-flight"><input type="checkbox" name="items[departure][0][container][check]" /></form>',
          loadedAt: '2026-07-01T10:00:00.000Z',
          resultUrl: '/en/tickets',
        },
        '7:4:2026-07-03:': {
          html: '<h3>There are no available tickets. Please choose different dates.</h3>',
          loadedAt: '2026-07-01T10:00:00.000Z',
          resultUrl: '/en/tickets',
        },
      },
    };

    expect(filterAvailabilityWithFlightBundle(snapshot, bundle)).toEqual({
      availability: {
        '7:4': {
          outbound: ['2026-07-02', '2026-07-04'],
          returns: ['2026-07-03'],
        },
      },
    });
  });

  it('alternates scheduled preload locales across ten-minute cron slots', () => {
    expect(selectScheduledPreloadLocale(['ru', 'en'], new Date('2026-07-01T14:00:00.000Z'))).toBe('ru');
    expect(selectScheduledPreloadLocale(['ru', 'en'], new Date('2026-07-01T14:10:00.000Z'))).toBe('en');
    expect(selectScheduledPreloadLocale(['ru', 'en'], new Date('2026-07-01T14:20:00.000Z'))).toBe('ru');
  });
});

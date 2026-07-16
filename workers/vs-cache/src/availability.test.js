import { describe, expect, it } from 'vitest';
import { buildAvailabilitySnapshot, routeKey } from './availability.js';

describe('availability cache loader', () => {
  it('builds one snapshot from destination and route date backend calls', async () => {
    const requests = [];
    const fetchJson = async (path) => {
      requests.push(path);
      if (path === '/custom/check-dest/1') return ['2'];
      if (path === '/custom/check-dest/2') return [];
      if (path === '/custom/check-dest/4') return [];
      if (path === '/custom/check-dest/5') return [];
      if (path === '/custom/check-dest/6') return [];
      if (path === '/custom/check-dest/7') return ['4'];
      if (path === '/custom/check-flight/1/2') return { to: ['2026-07-02'], from: ['2026-07-03'] };
      if (path === '/custom/check-flight/7/4') return {
        to: ['2026-07-04', 'invalid', '2026-07-04'],
        from: ['2026-07-05'],
      };
      throw new Error(`Unexpected path ${path}`);
    };

    const snapshot = await buildAvailabilitySnapshot({
      fetchJson,
      now: () => new Date('2026-07-01T10:00:00.000Z'),
    });

    expect(requests).toEqual([
      '/custom/check-dest/1',
      '/custom/check-dest/2',
      '/custom/check-dest/4',
      '/custom/check-dest/5',
      '/custom/check-dest/6',
      '/custom/check-dest/7',
      '/custom/check-flight/1/2',
      '/custom/check-flight/7/4',
    ]);
    expect(routeKey('7', '4')).toBe('7:4');
    expect(snapshot).toMatchObject({
      destinationMap: {
        '1': ['2'],
        '7': ['4'],
      },
      availability: {
        '1:2': { outbound: ['2026-07-02'], returns: ['2026-07-03'] },
        '7:4': { outbound: ['2026-07-04'], returns: ['2026-07-05'] },
      },
      loadedAt: '2026-07-01T10:00:00.000Z',
    });
  });
});

import { describe, expect, it } from 'vitest';
import { buildLiveScheduleHtml, resolveInjectionTarget } from './live-schedule.js';

// 2026-07-16 14:00 in Georgia (UTC+4).
const NOW = new Date('2026-07-16T10:00:00Z');

function snapshot(availability, loadedAt = '2026-07-16T08:00:00Z') {
  return { availability, loadedAt };
}

// Mirrors the hand-rolled English short-date format in live-schedule.js.
function formatShortDate(iso) {
  const [, month, day] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]} ${day}`;
}

describe('resolveInjectionTarget', () => {
  it('matches home pages for every locale', () => {
    expect(resolveInjectionTarget('/')).toEqual({ kind: 'home', locale: 'en' });
    expect(resolveInjectionTarget('/en/')).toEqual({ kind: 'home', locale: 'en' });
    expect(resolveInjectionTarget('/ru/')).toEqual({ kind: 'home', locale: 'ru' });
    expect(resolveInjectionTarget('/ua/')).toEqual({ kind: 'home', locale: 'ua' });
    expect(resolveInjectionTarget('/ka/')).toEqual({ kind: 'home', locale: 'ka' });
  });

  it('matches route and hub landing pages', () => {
    expect(resolveInjectionTarget('/en/flights/tbilisi-mestia/')).toMatchObject({
      kind: 'route',
      locale: 'en',
      page: { slug: 'flights/tbilisi-mestia' },
    });
    expect(resolveInjectionTarget('/ru/flights/vanilla-sky/')).toEqual({
      kind: 'hub',
      locale: 'ru',
      topic: 'vanilla-sky',
    });
    expect(resolveInjectionTarget('/en/flights/')).toEqual({ kind: 'hub', locale: 'en', topic: 'georgia' });
    expect(resolveInjectionTarget('/ka/flights/natakhtari-airport/')).toEqual({
      kind: 'hub',
      locale: 'ka',
      topic: 'natakhtari',
    });
  });

  it('ignores everything else', () => {
    expect(resolveInjectionTarget('/api/availability')).toBeNull();
    expect(resolveInjectionTarget('/en/blog/')).toBeNull();
    expect(resolveInjectionTarget('/en/blog/natakhtari-airport-guide/')).toBeNull();
    expect(resolveInjectionTarget('/de/')).toBeNull();
    expect(resolveInjectionTarget('/en/flights/unknown-route/')).toBeNull();
    expect(resolveInjectionTarget('/assets/index.js')).toBeNull();
    expect(resolveInjectionTarget('/vs-backend/x')).toBeNull();
  });
});

describe('buildLiveScheduleHtml route detail', () => {
  const target = resolveInjectionTarget('/en/flights/tbilisi-mestia/');

  it('lists upcoming departures with a weekday pattern and skips past dates', () => {
    const html = buildLiveScheduleHtml(
      target,
      snapshot({
        '7:6': {
          outbound: ['2026-07-10', '2026-07-17', '2026-07-20', '2026-07-24', '2026-07-27', '2026-07-31', '2026-08-03'],
          returns: [],
        },
      }),
      NOW,
    );

    expect(html).toContain('seo-live-schedule');
    expect(html).toContain('Upcoming Tbilisi → Mestia flight dates');
    expect(html).toContain('Next departures');
    // Past date filtered out.
    expect(html).not.toContain(formatShortDate('2026-07-10'));
    expect(html).toContain(formatShortDate('2026-07-17'));
    // Only Mondays and Fridays in the fixture.
    expect(html).toContain('This route currently flies on: Mon, Fri');
    // 7 future-or-today dates minus 5 shown = 1 extra beyond the limit.
    expect(html).toContain('+1 more dates');
    expect(html).toContain('updated July 16, 2026');
  });

  it('treats today in Georgia time as still bookable', () => {
    // 21:30 UTC on the 15th is already 01:30 on the 16th in Georgia.
    const html = buildLiveScheduleHtml(
      target,
      snapshot({ '7:6': { outbound: ['2026-07-15', '2026-07-16', '2026-07-20'], returns: [] } }),
      new Date('2026-07-15T21:30:00Z'),
    );

    expect(html).not.toContain(formatShortDate('2026-07-15'));
    expect(html).toContain(formatShortDate('2026-07-16'));
  });

  it('adds the year to dates outside the current year', () => {
    const html = buildLiveScheduleHtml(
      target,
      snapshot({ '7:6': { outbound: ['2027-01-05'], returns: [] } }),
      NOW,
    );

    expect(html).toContain('2027');
  });

  it('explains when no upcoming dates are bookable', () => {
    const html = buildLiveScheduleHtml(
      target,
      snapshot({ '7:6': { outbound: ['2026-07-01'], returns: [] } }),
      NOW,
    );

    expect(html).toContain('No upcoming dates are currently bookable');
  });

  it('returns null when the route is missing from the snapshot', () => {
    expect(buildLiveScheduleHtml(target, snapshot({}), NOW)).toBeNull();
    expect(buildLiveScheduleHtml(target, snapshot(undefined), NOW)).toBeNull();
    expect(buildLiveScheduleHtml(target, null, NOW)).toBeNull();
  });

  it('localizes the Russian route page', () => {
    const html = buildLiveScheduleHtml(
      resolveInjectionTarget('/ru/flights/tbilisi-mestia/'),
      snapshot({ '7:6': { outbound: ['2026-07-17', '2026-07-20', '2026-07-24'], returns: [] } }),
      NOW,
    );

    expect(html).toContain('Ближайшие даты рейсов Тбилиси — Местиа');
    expect(html).toContain('Ближайшие вылеты');
    expect(html).toContain('17 июл');
    expect(html).toContain('обновлено 16 июля 2026');
  });
});

describe('buildLiveScheduleHtml lists', () => {
  const availability = {
    '7:4': { outbound: ['2026-07-18', '2026-07-21', '2026-07-25', '2026-07-28'], returns: [] },
    '4:7': { outbound: ['2026-07-19'], returns: [] },
    '7:6': { outbound: ['2026-07-17'], returns: [] },
    '6:7': { outbound: ['2026-07-18'], returns: [] },
    '7:2': { outbound: [], returns: [] },
    '2:7': { outbound: [], returns: [] },
    '5:6': { outbound: ['2026-07-22'], returns: [] },
    '6:5': { outbound: ['2026-07-23'], returns: [] },
  };

  it('lists every route with linked anchors on the home page', () => {
    const html = buildLiveScheduleHtml(resolveInjectionTarget('/en/'), snapshot(availability), NOW);

    expect(html).toContain('Upcoming Vanilla Sky flight dates');
    expect(html).toContain('href="/en/flights/tbilisi-batumi/"');
    expect(html).toContain('href="/en/flights/kutaisi-mestia/"');
    expect(html).toContain('Tbilisi → Batumi');
    expect(html).toContain(formatShortDate('2026-07-18'));
    expect(html).toContain('+1 more dates');
    expect(html).toContain('no upcoming dates');
  });

  it('keeps only Natakhtari routes on the natakhtari hub', () => {
    const html = buildLiveScheduleHtml(
      resolveInjectionTarget('/en/flights/natakhtari-airport/'),
      snapshot(availability),
      NOW,
    );

    expect(html).toContain('href="/en/flights/tbilisi-batumi/"');
    expect(html).not.toContain('href="/en/flights/kutaisi-mestia/"');
    expect(html).not.toContain('href="/en/flights/mestia-kutaisi/"');
  });

  it('localizes the Georgian home page', () => {
    const html = buildLiveScheduleHtml(resolveInjectionTarget('/ka/'), snapshot(availability), NOW);

    expect(html).toContain('Vanilla Sky-ის უახლოესი ფრენის თარიღები');
    expect(html).toContain('href="/ka/flights/tbilisi-batumi/"');
    expect(html).toContain('თბილისი → ბათუმი');
  });

  it('returns null when no route has upcoming dates', () => {
    const empty = Object.fromEntries(
      Object.keys(availability).map((key) => [key, { outbound: [], returns: [] }]),
    );

    expect(buildLiveScheduleHtml(resolveInjectionTarget('/en/'), snapshot(empty), NOW)).toBeNull();
  });
});

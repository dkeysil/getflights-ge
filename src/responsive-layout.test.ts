// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

const availabilitySnapshot = {
  destinationMap: {
    '4': ['7'],
    '7': ['4', '6'],
    '6': ['7'],
    '5': ['7'],
  },
  routeCatalog: [
    {
      from: { id: '4', name: 'Batumi' },
      destinations: [{ id: '7', name: 'Tbilisi (Natakhtari airport)' }],
    },
    {
      from: { id: '7', name: 'Tbilisi (Natakhtari airport)' },
      destinations: [
        { id: '4', name: 'Batumi' },
        { id: '6', name: 'Ambrolauri' },
      ],
    },
    {
      from: { id: '6', name: 'Ambrolauri' },
      destinations: [{ id: '7', name: 'Tbilisi (Natakhtari airport)' }],
    },
    {
      from: { id: '5', name: 'Mestia' },
      destinations: [{ id: '7', name: 'Tbilisi (Natakhtari airport)' }],
    },
  ],
  availability: {
    '4:7': {
      outbound: [
        '2026-07-05',
        '2026-07-06',
        '2026-07-07',
        '2026-07-09',
        '2026-07-10',
        '2026-07-12',
        '2026-07-13',
        '2026-07-14',
        '2026-07-16',
        '2026-07-17',
        '2026-07-19',
        '2026-07-20',
        '2026-07-21',
        '2026-07-23',
        '2026-07-24',
        '2026-07-26',
        '2026-07-27',
        '2026-07-28',
        '2026-07-30',
        '2026-07-31',
      ],
      returns: [],
    },
    '7:4': { outbound: ['2026-07-31', '2026-08-03', '2026-08-05'], returns: [] },
    '7:6': { outbound: ['2026-07-03', '2026-07-13'], returns: [] },
    '6:7': { outbound: ['2026-07-05', '2026-07-12'], returns: [] },
    '5:7': { outbound: ['2026-07-04'], returns: [] },
  },
  loadedAt: '2026-07-03T11:00:00.000Z',
};

describe('responsive booking layout', () => {
  let browser: Browser;
  let server: ViteDevServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = await createServer({
      logLevel: 'silent',
      server: {
        host: '127.0.0.1',
        port: 0,
      },
    });
    await server.listen();
    baseUrl = server.resolvedUrls?.local[0] ?? 'http://127.0.0.1:5173/';
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  async function openHome(viewport: { width: number; height: number }, locale = 'ru'): Promise<Page> {
    const page = await browser.newPage({ viewport });
    await page.route('**/api/availability**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(availabilitySnapshot),
      }),
    );
    await page.route('**/api/flights?**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          resultUrl: '/en/flights-form',
          html: '',
          loadedAt: availabilitySnapshot.loadedAt,
        }),
      }),
    );
    await page.goto(new URL(`/${locale}/`, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.day.avail');
    return page;
  }

  it('uses the compact route picker before the desktop rail squeezes the calendar', async () => {
    const page = await openHome({ width: 1024, height: 720 });

    const metrics = await page.evaluate(() => {
      const rail = document.querySelector<HTMLElement>('.routes-rail')?.getBoundingClientRect();
      const calendar = document.querySelector<HTMLElement>('.calendar-panel')?.getBoundingClientRect();
      const toggle = document.querySelector<HTMLElement>('.rail-toggle');
      return {
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        railWidth: rail?.width ?? 0,
        calendarWidth: calendar?.width ?? 0,
        toggleDisplay: toggle ? getComputedStyle(toggle).display : 'missing',
      };
    });

    expect(metrics.scrollWidth).toBe(metrics.viewportWidth);
    expect(metrics.toggleDisplay).toBe('flex');
    expect(metrics.railWidth).toBeGreaterThan(900);
    expect(metrics.calendarWidth).toBeGreaterThan(900);

    await page.close();
  });

  it('keeps the routes rail visible and selected-day details reachable in short landscape viewports', async () => {
    const page = await openHome({ width: 1280, height: 720 });

    const metrics = await page.evaluate(() => {
      const rail = document.querySelector<HTMLElement>('.routes-rail')?.getBoundingClientRect();
      const calendar = document.querySelector<HTMLElement>('.calendar-panel')?.getBoundingClientRect();
      const detail = document.querySelector<HTMLElement>('.day-detail')?.getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        railBottom: rail?.bottom ?? 0,
        calendarBottom: calendar?.bottom ?? 0,
        detailTop: detail?.top ?? 0,
      };
    });

    expect(metrics.scrollWidth).toBe(metrics.viewportWidth);
    expect(metrics.railBottom).toBeLessThanOrEqual(metrics.viewportHeight);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const detail = await page.locator('.day-detail').evaluate((element) => ({
      top: element.getBoundingClientRect().top,
      bottom: element.getBoundingClientRect().bottom,
      scrollY: window.scrollY,
    }));
    expect(detail.scrollY).toBeGreaterThan(0);
    expect(detail.top).toBeGreaterThanOrEqual(0);
    expect(detail.bottom).toBeLessThanOrEqual(metrics.viewportHeight);

    await page.close();
  });

  it('keeps the Hike With Axe promotion as a bounded desktop card and compact mobile card', async () => {
    const styles = await (await fetch(new URL('/src/styles.css', baseUrl))).text();

    expect(styles).toMatch(/\.hike-with-axe-promotion\s*{[^}]*max-width:\s*1060px;/s);
    expect(styles).toMatch(/\.hike-with-axe-promotion\s*{[^}]*height:\s*180px;/s);
    expect(styles).toMatch(/\.hike-with-axe-promotion__image\s*{[^}]*flex-basis:\s*45%;/s);
    expect(styles).toMatch(/@media \(max-width: 620px\)\s*{[\s\S]*\.hike-with-axe-promotion\s*{[^}]*max-height:\s*245px;/s);
    expect(styles).toMatch(/@media \(max-width: 620px\)\s*{[\s\S]*\.hike-with-axe-promotion\s*{[^}]*height:\s*auto;/s);
    expect(styles).toMatch(/@media \(max-width: 620px\)\s*{[\s\S]*\.hike-with-axe-promotion__image\s*{[^}]*height:\s*96px;/s);
    expect(styles).toMatch(/@media \(max-height: 720px\) and \(min-width: 861px\)\s*{[\s\S]*\.hike-with-axe-promotion ~ \.pane \.routes-rail\s*{[^}]*max-height:\s*calc\(100vh - 520px\);[^}]*overflow-y:\s*auto;/s);
  });
});

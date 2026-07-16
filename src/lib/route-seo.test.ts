import { describe, expect, it } from 'vitest';
import {
  getRouteSeoPageByPath,
  routeSeoPages,
  routeSeoPagesForLocale,
  routeSeoPageUrl,
} from './route-seo';

describe('route SEO pages', () => {
  it('defines the first 44 localized route SEO pages', () => {
    expect(routeSeoPages).toHaveLength(44);

    expect(routeSeoPagesForLocale('en')).toHaveLength(11);
    expect(routeSeoPagesForLocale('ru')).toHaveLength(11);
    expect(routeSeoPagesForLocale('ua')).toHaveLength(11);
    expect(routeSeoPagesForLocale('ka')).toHaveLength(11);
  });

  it('maps public Tbilisi route pages to official Natakhtari route ids', () => {
    const page = getRouteSeoPageByPath('/en/flights/tbilisi-batumi/');

    expect(page).toMatchObject({
      locale: 'en',
      kind: 'route',
      slug: 'flights/tbilisi-batumi',
      route: {
        fromId: '7',
        toId: '4',
        publicFrom: 'Tbilisi',
        publicTo: 'Batumi',
        officialFrom: 'Tbilisi (Natakhtari airport)',
        officialTo: 'Batumi',
      },
    });
  });

  it('resolves localized hub pages by path', () => {
    expect(getRouteSeoPageByPath('/ru/flights/vanilla-sky/')).toMatchObject({
      locale: 'ru',
      kind: 'hub',
      slug: 'flights/vanilla-sky',
      title: expect.stringContaining('Vanilla Sky'),
      relatedLinks: expect.arrayContaining([
        expect.objectContaining({ href: '/ru/flights/tbilisi-mestia/' }),
        expect.objectContaining({ href: '/ru/blog/how-to-buy-vanilla-sky-tickets/' }),
      ]),
    });
  });

  it('targets Search Console query clusters on key English hubs', () => {
    const vanillaSkyHub = getRouteSeoPageByPath('/en/flights/vanilla-sky/');
    const natakhtariHub = getRouteSeoPageByPath('/en/flights/natakhtari-airport/');

    expect(vanillaSkyHub).toMatchObject({
      title: expect.stringContaining('Vanilla Sky tickets online'),
      h1: expect.stringContaining('Vanilla Sky tickets online'),
      intro: expect.stringContaining('vanillasky.ge'),
    });
    expect(natakhtariHub).toMatchObject({
      title: expect.stringContaining('Flights from Tbilisi'),
      h1: expect.stringContaining('Flights from Tbilisi'),
      intro: expect.stringContaining('Natakhtari airport'),
    });
  });

  it('connects route landing pages to relevant hubs, reverse routes, and guides', () => {
    const page = getRouteSeoPageByPath('/en/flights/tbilisi-mestia/');

    expect(page).toMatchObject({
      locale: 'en',
      kind: 'route',
      relatedLinks: expect.arrayContaining([
        expect.objectContaining({ href: '/en/flights/' }),
        expect.objectContaining({ href: '/en/flights/mestia-tbilisi/' }),
        expect.objectContaining({ href: '/en/blog/vanilla-sky-baggage-weather-cancellations/' }),
      ]),
    });
  });

  it('provides page copy required for useful search landing pages', () => {
    for (const page of routeSeoPages) {
      expect(routeSeoPageUrl(page)).toBe(`https://getflights.ge/${page.locale}/${page.slug}/`);
      expect(page.title.length).toBeGreaterThan(20);
      expect(page.description.length).toBeGreaterThan(70);
      expect(page.h1.length).toBeGreaterThan(20);
      expect(page.intro.length).toBeGreaterThan(80);
      expect(page.cta.length).toBeGreaterThan(10);
      expect(page.faqs.length).toBeGreaterThanOrEqual(2);
      expect(page.relatedLinks.length).toBeGreaterThanOrEqual(3);
    }
  });
});

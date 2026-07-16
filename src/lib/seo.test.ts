import { describe, expect, it } from 'vitest';
import {
  SITE_ORIGIN,
  buildSitemapXml,
  getAlternateLinks,
  getSeoLocaleMeta,
  localeUrl,
  seoLocales,
} from './seo';

describe('SEO metadata', () => {
  it('defines complete canonical metadata for each supported locale', () => {
    expect(seoLocales).toEqual(['en', 'ru', 'ua', 'ka']);

    for (const locale of seoLocales) {
      const meta = getSeoLocaleMeta(locale);

      expect(meta.path).toBe(`/${locale}/`);
      expect(meta.hrefLang).toBe(locale === 'ua' ? 'uk' : locale);
      expect(meta.htmlLang).toBe(locale === 'ua' ? 'uk' : locale);
      expect(meta.title.length).toBeGreaterThan(20);
      expect(meta.description.length).toBeGreaterThan(80);
      expect(localeUrl(locale)).toBe(`${SITE_ORIGIN}/${locale}/`);
    }

    expect(getSeoLocaleMeta('en').title).toBe(
      'Vanilla Sky tickets and flights in Georgia - GetFlights.ge',
    );
    expect(getSeoLocaleMeta('en').description).toContain('Vanilla Sky tickets');
  });

  it('returns reciprocal alternate links plus x-default for each locale', () => {
    for (const locale of seoLocales) {
      expect(getAlternateLinks(locale)).toEqual([
        { hrefLang: 'en', href: 'https://getflights.ge/en/' },
        { hrefLang: 'ru', href: 'https://getflights.ge/ru/' },
        { hrefLang: 'uk', href: 'https://getflights.ge/ua/' },
        { hrefLang: 'ka', href: 'https://getflights.ge/ka/' },
        { hrefLang: 'x-default', href: 'https://getflights.ge/' },
      ]);
    }
  });

  it('generates a multilingual sitemap with absolute canonical URLs and hreflang alternates', () => {
    const xml = buildSitemapXml();

    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');

    for (const locale of seoLocales) {
      expect(xml).toContain(`<loc>https://getflights.ge/${locale}/</loc>`);
      expect(xml).toContain(
        `<xhtml:link rel="alternate" hreflang="${locale === 'ua' ? 'uk' : locale}" href="https://getflights.ge/${locale}/" />`,
      );
    }

    expect(xml.match(/hreflang="x-default"/g)).toHaveLength(68);
  });

  it('includes route SEO pages in the sitemap with locale alternates', () => {
    const xml = buildSitemapXml();

    expect(xml).toContain('<loc>https://getflights.ge/en/flights/tbilisi-batumi/</loc>');
    expect(xml).toContain('<loc>https://getflights.ge/ru/flights/vanilla-sky/</loc>');
    expect(xml).toContain('<loc>https://getflights.ge/ua/flights/</loc>');
    expect(xml).toContain('<loc>https://getflights.ge/ka/flights/natakhtari-airport/</loc>');
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="ru" href="https://getflights.ge/ru/flights/tbilisi-batumi/" />',
    );
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="uk" href="https://getflights.ge/ua/flights/tbilisi-batumi/" />',
    );
    expect(xml.match(/<loc>https:\/\/getflights\.ge\/[a-z]{2}\/flights/g)).toHaveLength(44);
  });

  it('includes localized blog articles in the sitemap with locale alternates', () => {
    const xml = buildSitemapXml();

    expect(xml).toContain('<loc>https://getflights.ge/ru/blog/</loc>');
    expect(xml).toContain('<loc>https://getflights.ge/ru/blog/vanilla-sky-georgia-flights-guide/</loc>');
    expect(xml).toContain('<loc>https://getflights.ge/en/blog/vanilla-sky-georgia-flights-guide/</loc>');
    expect(xml).toContain('<loc>https://getflights.ge/en/blog/how-to-buy-vanilla-sky-tickets/</loc>');
    expect(xml).toContain('<loc>https://getflights.ge/ka/blog/natakhtari-airport-guide/</loc>');
    expect(xml).toContain('<loc>https://getflights.ge/ua/blog/vanilla-sky-baggage-weather-cancellations/</loc>');
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="ka" href="https://getflights.ge/ka/blog/vanilla-sky-georgia-flights-guide/" />',
    );
    expect(xml.match(/<loc>https:\/\/getflights\.ge\/[a-z]{2}\/blog\//g)).toHaveLength(20);
  });
});

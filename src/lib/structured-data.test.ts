import { describe, expect, it } from 'vitest';
import { blogSeoIndexPageForLocale, getBlogSeoPostByPath } from './blog-seo';
import { getRouteSeoPageByPath } from './route-seo';
import {
  buildBlogIndexStructuredData,
  buildBlogPostStructuredData,
  buildHomeStructuredData,
  buildRouteStructuredData,
} from './structured-data';

describe('structured data', () => {
  it('builds WebSite schema for localized home pages', () => {
    const graph = buildHomeStructuredData('en');

    expect(graph).toMatchObject({
      '@context': 'https://schema.org',
      '@graph': expect.arrayContaining([
        expect.objectContaining({
          '@type': 'WebSite',
          url: 'https://getflights.ge/',
          name: 'GetFlights.ge',
          alternateName: ['GetFlights', 'Get Flights'],
        }),
        expect.objectContaining({
          '@type': 'Organization',
          name: 'GetFlights.ge',
          logo: 'https://getflights.ge/android-chrome-512x512.png',
        }),
        expect.objectContaining({
          '@type': 'WebPage',
          primaryImageOfPage: expect.objectContaining({
            url: 'https://getflights.ge/vanilla-sky-georgia-flight-preview.png',
          }),
        }),
      ]),
    });
  });

  it('uses the valid Ukrainian language code in JSON-LD while keeping /ua/ URLs', () => {
    const graph = buildHomeStructuredData('ua');

    expect(graph['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          '@type': 'WebSite',
          url: 'https://getflights.ge/',
          inLanguage: 'uk',
        }),
        expect.objectContaining({
          '@type': 'WebPage',
          url: 'https://getflights.ge/ua/',
          inLanguage: 'uk',
        }),
      ]),
    );
  });

  it('builds FAQ and breadcrumb schema for route landing pages', () => {
    const page = getRouteSeoPageByPath('/en/flights/tbilisi-mestia/');
    expect(page).not.toBeNull();

    const graph = buildRouteStructuredData(page!);

    expect(graph['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          '@type': 'WebPage',
          url: 'https://getflights.ge/en/flights/tbilisi-mestia/',
          name: 'Buy Tbilisi to Mestia flight tickets',
        }),
        expect.objectContaining({
          '@type': 'FAQPage',
          mainEntity: expect.arrayContaining([
            expect.objectContaining({
              '@type': 'Question',
              acceptedAnswer: expect.objectContaining({ '@type': 'Answer' }),
            }),
          ]),
        }),
        expect.objectContaining({
          '@type': 'BreadcrumbList',
        }),
      ]),
    );
  });

  it('builds Article schema for blog posts', () => {
    const post = getBlogSeoPostByPath('/ru/blog/vanilla-sky-georgia-flights-guide/');
    expect(post).not.toBeNull();

    const graph = buildBlogPostStructuredData(post!);

    expect(graph['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          '@type': 'Article',
          headline: 'Vanilla Sky по Грузии: что знать перед покупкой билета',
          mainEntityOfPage: 'https://getflights.ge/ru/blog/vanilla-sky-georgia-flights-guide/',
          image: 'https://getflights.ge/vanilla-sky-georgia-flight-preview.png',
          citation: 'https://t.me/nlevshitstelegram',
          datePublished: '2026-07-01',
          dateModified: '2026-07-01',
          author: expect.objectContaining({
            '@type': 'Organization',
            name: 'GetFlights.ge',
          }),
        }),
        expect.objectContaining({
          '@type': 'BreadcrumbList',
        }),
      ]),
    );
  });

  it('builds ItemList schema for blog index pages', () => {
    const graph = buildBlogIndexStructuredData(blogSeoIndexPageForLocale('en'));

    expect(graph['@graph']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          '@type': 'CollectionPage',
          url: 'https://getflights.ge/en/blog/',
        }),
        expect.objectContaining({
          '@type': 'ItemList',
          numberOfItems: 4,
        }),
      ]),
    );
  });
});

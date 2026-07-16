import rawMetadata from './seo-metadata.json' with { type: 'json' };
import type { Locale } from './i18n';
import {
  blogSeoIndexPages,
  blogSeoIndexPageUrl,
  blogSeoIndexPageUrlForLocale,
  blogSeoPosts,
  blogSeoPostUrl,
  blogSeoPostUrlForLocale,
} from './blog-seo.ts';
import { routeSeoPages, routeSeoPageUrl, routeSeoPageUrlForLocale } from './route-seo.ts';

export type SeoLocaleMeta = {
  path: `/${Locale}/`;
  hrefLang: string;
  htmlLang: string;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
};

export type AlternateLink = {
  hrefLang: string;
  href: string;
};

type SeoMetadata = {
  siteOrigin: string;
  defaultLocale: Locale;
  xDefaultPath: '/';
  socialImage: {
    url: string;
    type: string;
    width: string;
    height: string;
    alt: string;
  };
  localeOrder: Locale[];
  locales: Record<Locale, SeoLocaleMeta>;
};

const metadata = rawMetadata as SeoMetadata;

export const SITE_ORIGIN = metadata.siteOrigin.replace(/\/$/, '');
export const DEFAULT_SEO_LOCALE = metadata.defaultLocale;
export const X_DEFAULT_URL = `${SITE_ORIGIN}${metadata.xDefaultPath}`;
export const socialImage = metadata.socialImage;
export const seoLocales = [...metadata.localeOrder];

export function getSeoLocaleMeta(locale: Locale) {
  return metadata.locales[locale];
}

export function localeUrl(locale: Locale) {
  return `${SITE_ORIGIN}${getSeoLocaleMeta(locale).path}`;
}

export function canonicalUrl(locale: Locale) {
  return localeUrl(locale);
}

export function rootCanonicalUrl() {
  return localeUrl(DEFAULT_SEO_LOCALE);
}

export function getAlternateLinks(_locale?: Locale): AlternateLink[] {
  return [
    ...seoLocales.map((locale) => ({
      hrefLang: getSeoLocaleMeta(locale).hrefLang,
      href: localeUrl(locale),
    })),
    { hrefLang: 'x-default', href: X_DEFAULT_URL },
  ];
}

export function buildSitemapXml() {
  const urls = buildSitemapEntries()
    .map((entry) => {
      const alternates = entry.alternates
        .map(
          (alternate) =>
            `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hrefLang)}" href="${escapeXml(
              alternate.href,
            )}" />`,
        )
        .join('\n');

      return [
        '  <url>',
        `    <loc>${escapeXml(entry.loc)}</loc>`,
        alternates,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    urls,
    '</urlset>',
    '',
  ].join('\n');
}

function buildSitemapEntries(): Array<{ loc: string; alternates: AlternateLink[] }> {
  return [
    ...seoLocales.map((locale) => ({
      loc: localeUrl(locale),
      alternates: getAlternateLinks(locale),
    })),
    ...routeSeoPages.map((page) => ({
      loc: routeSeoPageUrl(page),
      alternates: [
        ...seoLocales.map((locale) => ({
          hrefLang: getSeoLocaleMeta(locale).hrefLang,
          href: routeSeoPageUrlForLocale(page, locale),
        })),
        {
          hrefLang: 'x-default' as const,
          href: routeSeoPageUrlForLocale(page, DEFAULT_SEO_LOCALE),
        },
      ],
    })),
    ...blogSeoIndexPages.map((page) => ({
      loc: blogSeoIndexPageUrl(page),
      alternates: [
        ...seoLocales.map((locale) => ({
          hrefLang: getSeoLocaleMeta(locale).hrefLang,
          href: blogSeoIndexPageUrlForLocale(page, locale),
        })),
        {
          hrefLang: 'x-default' as const,
          href: blogSeoIndexPageUrlForLocale(page, DEFAULT_SEO_LOCALE),
        },
      ],
    })),
    ...blogSeoPosts.map((post) => ({
      loc: blogSeoPostUrl(post),
      alternates: [
        ...seoLocales.map((locale) => ({
          hrefLang: getSeoLocaleMeta(locale).hrefLang,
          href: blogSeoPostUrlForLocale(post, locale),
        })),
        {
          hrefLang: 'x-default' as const,
          href: blogSeoPostUrlForLocale(post, DEFAULT_SEO_LOCALE),
        },
      ],
    })),
  ];
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

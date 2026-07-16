import type { Locale } from './i18n';
import type { BlogSeoIndexPage, BlogSeoPost } from './blog-seo.ts';
import { blogSeoIndexPageUrl, blogSeoPostUrl } from './blog-seo.ts';
import type { RouteSeoPage } from './route-seo.ts';
import { routeSeoPageUrl } from './route-seo.ts';
import { getSeoLocaleMeta, localeUrl, SITE_ORIGIN, socialImage } from './seo.ts';

type JsonLdObject = Record<string, unknown>;

const SITE_NAME = 'GetFlights.ge';
const SITE_HOME_URL = `${SITE_ORIGIN}/`;
const SITE_ICON_URL = `${SITE_ORIGIN}/android-chrome-512x512.png`;
const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

export function buildHomeStructuredData(locale: Locale) {
  const url = localeUrl(locale);
  const meta = getSeoLocaleMeta(locale);

  return graph([
    organization(),
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: SITE_NAME,
      alternateName: ['GetFlights', 'Get Flights'],
      url: SITE_HOME_URL,
      inLanguage: languageCode(locale),
      publisher: { '@id': ORGANIZATION_ID },
    },
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: meta.title,
      description: meta.description,
      inLanguage: languageCode(locale),
      isPartOf: { '@id': WEBSITE_ID },
      primaryImageOfPage: primaryImage(),
      publisher: { '@id': ORGANIZATION_ID },
    },
  ]);
}

export function buildRouteStructuredData(page: RouteSeoPage) {
  const url = routeSeoPageUrl(page);

  return graph([
    organization(),
    webPage(url, page.h1, page.description, page.locale),
    breadcrumb([
      { name: homeLabel(page.locale), url: localeUrl(page.locale) },
      { name: flightsLabel(page.locale), url: `${SITE_ORIGIN}/${page.locale}/flights/` },
      { name: page.h1, url },
    ]),
    {
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: page.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    },
  ]);
}

export function buildBlogPostStructuredData(post: BlogSeoPost) {
  const url = blogSeoPostUrl(post);
  const article: JsonLdObject = {
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: post.h1,
    description: post.description,
    image: absoluteUrl(post.image.src),
    inLanguage: languageCode(post.locale),
    mainEntityOfPage: url,
    author: {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: SITE_NAME,
      url: SITE_ORIGIN,
    },
    publisher: { '@id': ORGANIZATION_ID },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
  };

  if (post.source) {
    article.citation = post.source.href;
  }

  return graph([
    organization(),
    webPage(url, post.title, post.description, post.locale),
    article,
    breadcrumb([
      { name: homeLabel(post.locale), url: localeUrl(post.locale) },
      { name: blogLabel(post.locale), url: `${SITE_ORIGIN}/${post.locale}/blog/` },
      { name: post.h1, url },
    ]),
  ]);
}

export function buildBlogIndexStructuredData(page: BlogSeoIndexPage) {
  const url = blogSeoIndexPageUrl(page);

  return graph([
    organization(),
    {
      '@type': 'CollectionPage',
      '@id': `${url}#collection`,
      url,
      name: page.title,
      description: page.description,
      inLanguage: languageCode(page.locale),
      isPartOf: { '@id': WEBSITE_ID },
      primaryImageOfPage: primaryImage(),
      publisher: { '@id': ORGANIZATION_ID },
    },
    {
      '@type': 'ItemList',
      '@id': `${url}#itemlist`,
      numberOfItems: page.posts.length,
      itemListElement: page.posts.map((post, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: post.h1,
        url: blogSeoPostUrl(post),
      })),
    },
    breadcrumb([
      { name: homeLabel(page.locale), url: localeUrl(page.locale) },
      { name: blogLabel(page.locale), url },
    ]),
  ]);
}

export function serializeStructuredData(data: JsonLdObject) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function graph(items: JsonLdObject[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': items,
  };
}

function organization() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    url: SITE_HOME_URL,
    logo: SITE_ICON_URL,
    image: socialImage.url,
  };
}

function webPage(url: string, name: string, description: string, locale: Locale) {
  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: languageCode(locale),
    isPartOf: { '@id': WEBSITE_ID },
    primaryImageOfPage: primaryImage(),
    publisher: { '@id': ORGANIZATION_ID },
  };
}

function primaryImage() {
  return {
    '@type': 'ImageObject',
    url: socialImage.url,
    width: Number(socialImage.width),
    height: Number(socialImage.height),
  };
}

function languageCode(locale: Locale) {
  return getSeoLocaleMeta(locale).htmlLang;
}

function breadcrumb(items: Array<{ name: string; url: string }>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function absoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

function homeLabel(locale: Locale) {
  if (locale === 'ru') return 'Главная';
  if (locale === 'ua') return 'Головна';
  if (locale === 'ka') return 'მთავარი';
  return 'Home';
}

function blogLabel(locale: Locale) {
  if (locale === 'ru') return 'Гиды';
  if (locale === 'ua') return 'Гайди';
  if (locale === 'ka') return 'გზამკვლევები';
  return 'Guides';
}

function flightsLabel(locale: Locale) {
  if (locale === 'ru') return 'Рейсы';
  if (locale === 'ua') return 'Рейси';
  if (locale === 'ka') return 'ფრენები';
  return 'Flights';
}

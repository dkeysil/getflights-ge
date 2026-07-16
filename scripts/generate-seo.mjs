import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentReadableFiles } from '../src/lib/agent-readable.ts';
import {
  blogSeoIndexPages,
  blogSeoIndexPageUrl,
  blogSeoIndexPageUrlForLocale,
  blogSeoPosts,
  blogSeoPostUrl,
  blogSeoPostUrlForLocale,
} from '../src/lib/blog-seo.ts';
import { routeSeoPages, routeSeoPageUrl, routeSeoPageUrlForLocale } from '../src/lib/route-seo.ts';
import {
  buildBlogIndexStructuredData,
  buildBlogPostStructuredData,
  buildHomeStructuredData,
  buildRouteStructuredData,
  serializeStructuredData,
} from '../src/lib/structured-data.ts';
import { buildRobotsTxt } from '../src/lib/robots.ts';
import { toIntlLocale } from '../src/lib/i18n.ts';
import { buildSitemapXml } from '../src/lib/seo.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const METADATA_PATH = join(ROOT, 'src/lib/seo-metadata.json');
const metadata = JSON.parse(await readFile(METADATA_PATH, 'utf8'));
const args = new Set(process.argv.slice(2));

const writePublic = args.has('--public') || args.size === 0;
const writeDist = args.has('--dist') || args.size === 0;

if (writePublic) {
  await writePublicFiles();
}

if (writeDist) {
  await writeDistFiles();
}

async function writePublicFiles() {
  const publicDir = join(ROOT, 'public');
  await mkdir(publicDir, { recursive: true });
  await writeFile(join(publicDir, 'robots.txt'), buildRobotsTxt(), 'utf8');
  await writeFile(join(publicDir, 'sitemap.xml'), buildSitemapXml(), 'utf8');
  await writeAgentReadableFiles(publicDir);
}

async function writeDistFiles() {
  const distDir = join(ROOT, 'dist');
  const indexPath = join(distDir, 'index.html');
  const template = await readFile(indexPath, 'utf8');

  await writeFile(indexPath, rewriteHtml(template, metadata.defaultLocale, { root: true }), 'utf8');
  await writeFile(join(distDir, 'robots.txt'), buildRobotsTxt(), 'utf8');
  await writeFile(join(distDir, 'sitemap.xml'), buildSitemapXml(), 'utf8');
  await writeAgentReadableFiles(distDir);

  for (const locale of metadata.localeOrder) {
    const localeDir = join(distDir, locale);
    await mkdir(localeDir, { recursive: true });
    await writeFile(join(localeDir, 'index.html'), rewriteHtml(template, locale), 'utf8');
  }

  for (const page of routeSeoPages) {
    const pageDir = join(distDir, ...page.path.split('/').filter(Boolean));
    await mkdir(pageDir, { recursive: true });
    await writeFile(join(pageDir, 'index.html'), rewriteHtml(template, page.locale, { page }), 'utf8');
  }

  for (const page of blogSeoIndexPages) {
    const pageDir = join(distDir, ...page.path.split('/').filter(Boolean));
    await mkdir(pageDir, { recursive: true });
    await writeFile(join(pageDir, 'index.html'), rewriteHtml(template, page.locale, { blogIndex: page }), 'utf8');
  }

  for (const post of blogSeoPosts) {
    const postDir = join(distDir, ...post.path.split('/').filter(Boolean));
    await mkdir(postDir, { recursive: true });
    await writeFile(join(postDir, 'index.html'), rewriteHtml(template, post.locale, { post }), 'utf8');
  }
}

async function writeAgentReadableFiles(targetDir) {
  await Promise.all(
    agentReadableFiles.map((file) =>
      writeFile(join(targetDir, file.path), file.content, 'utf8'),
    ),
  );
}

function rewriteHtml(html, locale, options = {}) {
  const localeMeta = metadata.locales[locale];
  const contentPage = options.post ?? options.blogIndex ?? options.page;
  const title = contentPage?.title ?? localeMeta.title;
  const description = contentPage?.description ?? localeMeta.description;
  const ogTitle = contentPage?.title ?? localeMeta.ogTitle;
  const ogDescription = contentPage?.description ?? localeMeta.ogDescription;
  const canonical = options.post
    ? blogSeoPostUrl(options.post)
    : options.blogIndex
    ? blogSeoIndexPageUrl(options.blogIndex)
    : options.page
    ? routeSeoPageUrl(options.page)
    : options.root
      ? localeUrl(metadata.defaultLocale)
      : localeUrl(locale);
  const pageUrl = options.post
    ? blogSeoPostUrl(options.post)
    : options.blogIndex
      ? blogSeoIndexPageUrl(options.blogIndex)
    : options.page
      ? routeSeoPageUrl(options.page)
      : options.root
        ? xDefaultUrl()
        : localeUrl(locale);
  const alternates = options.post
    ? buildBlogAlternateTags(options.post)
    : options.blogIndex
      ? buildBlogIndexAlternateTags(options.blogIndex)
    : options.page
      ? buildRouteAlternateTags(options.page)
      : buildHomeAlternateTags();
  const rootHtml = options.post
    ? renderStaticBlogContent(options.post)
    : options.blogIndex
      ? renderStaticBlogIndexContent(options.blogIndex)
    : options.page
      ? renderStaticSeoContent(options.page)
      : renderStaticHomeContent(locale);
  const structuredData = options.post
    ? buildBlogPostStructuredData(options.post)
    : options.blogIndex
      ? buildBlogIndexStructuredData(options.blogIndex)
    : options.page
      ? buildRouteStructuredData(options.page)
      : buildHomeStructuredData(locale);

  return html
    .replace(/<html lang="[^"]*">/, `<html lang="${escapeHtml(localeMeta.htmlLang)}">`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/\n\s*<link rel="alternate" hreflang="[^"]+" href="[^"]+" \/>/g, '')
    .replace(/\n\s*<script id="getflights-json-ld" type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
      `<link rel="canonical" href="${escapeHtml(canonical)}" />\n${alternates}`,
    )
    .replace(metaPattern('name', 'description'), metaTag('name', 'description', description))
    .replace(metaPattern('property', 'og:url'), metaTag('property', 'og:url', pageUrl))
    .replace(metaPattern('property', 'og:title'), metaTag('property', 'og:title', ogTitle))
    .replace(metaPattern('property', 'og:description'), metaTag('property', 'og:description', ogDescription))
    .replace(metaPattern('property', 'og:image'), metaTag('property', 'og:image', metadata.socialImage.url))
    .replace(metaPattern('property', 'og:image:type'), metaTag('property', 'og:image:type', metadata.socialImage.type))
    .replace(metaPattern('property', 'og:image:width'), metaTag('property', 'og:image:width', metadata.socialImage.width))
    .replace(metaPattern('property', 'og:image:height'), metaTag('property', 'og:image:height', metadata.socialImage.height))
    .replace(metaPattern('property', 'og:image:alt'), metaTag('property', 'og:image:alt', metadata.socialImage.alt))
    .replace(metaPattern('name', 'twitter:title'), metaTag('name', 'twitter:title', ogTitle))
    .replace(metaPattern('name', 'twitter:description'), metaTag('name', 'twitter:description', ogDescription))
    .replace(metaPattern('name', 'twitter:image'), metaTag('name', 'twitter:image', metadata.socialImage.url))
    .replace('</head>', `${renderStructuredDataScript(structuredData)}\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${rootHtml}</div>`);
}

function metaPattern(attributeName, attributeValue) {
  return new RegExp(`<meta\\s+(?=[^>]*\\b${attributeName}="${escapeRegExp(attributeValue)}")[^>]*>`, 's');
}

function metaTag(attributeName, attributeValue, content) {
  return `<meta ${attributeName}="${escapeHtml(attributeValue)}" content="${escapeHtml(content)}" />`;
}

function buildHomeAlternateTags() {
  return getAlternateLinks()
    .map((alternate) => {
      return `<link rel="alternate" hreflang="${escapeHtml(alternate.hrefLang)}" href="${escapeHtml(alternate.href)}" />`;
    })
    .join('\n');
}

function buildRouteAlternateTags(page) {
  return getRouteAlternateLinks(page)
    .map((alternate) => {
      return `<link rel="alternate" hreflang="${escapeHtml(alternate.hrefLang)}" href="${escapeHtml(alternate.href)}" />`;
    })
    .join('\n');
}

function buildBlogAlternateTags(post) {
  return getBlogAlternateLinks(post)
    .map((alternate) => {
      return `<link rel="alternate" hreflang="${escapeHtml(alternate.hrefLang)}" href="${escapeHtml(alternate.href)}" />`;
    })
    .join('\n');
}

function buildBlogIndexAlternateTags(page) {
  return getBlogIndexAlternateLinks(page)
    .map((alternate) => {
      return `<link rel="alternate" hreflang="${escapeHtml(alternate.hrefLang)}" href="${escapeHtml(alternate.href)}" />`;
    })
    .join('\n');
}

function getAlternateLinks() {
  return [
    ...metadata.localeOrder.map((locale) => ({
      hrefLang: metadata.locales[locale].hrefLang,
      href: localeUrl(locale),
    })),
    { hrefLang: 'x-default', href: xDefaultUrl() },
  ];
}

function getRouteAlternateLinks(page) {
  return [
    ...metadata.localeOrder.map((locale) => ({
      hrefLang: metadata.locales[locale].hrefLang,
      href: routeSeoPageUrlForLocale(page, locale),
    })),
    { hrefLang: 'x-default', href: routeSeoPageUrlForLocale(page, metadata.defaultLocale) },
  ];
}

function getBlogAlternateLinks(post) {
  return [
    ...metadata.localeOrder.map((locale) => ({
      hrefLang: metadata.locales[locale].hrefLang,
      href: blogSeoPostUrlForLocale(post, locale),
    })),
    { hrefLang: 'x-default', href: blogSeoPostUrlForLocale(post, metadata.defaultLocale) },
  ];
}

function getBlogIndexAlternateLinks(page) {
  return [
    ...metadata.localeOrder.map((locale) => ({
      hrefLang: metadata.locales[locale].hrefLang,
      href: blogSeoIndexPageUrlForLocale(page, locale),
    })),
    { hrefLang: 'x-default', href: blogSeoIndexPageUrlForLocale(page, metadata.defaultLocale) },
  ];
}

function renderStaticSeoContent(page) {
  const routeFacts =
    page.kind === 'route'
      ? `
        <dl class="seo-facts">
          <div><dt>Route</dt><dd>${escapeHtml(page.route.publicFrom)} → ${escapeHtml(page.route.publicTo)}</dd></div>
          <div><dt>Official booking route</dt><dd>${escapeHtml(page.route.officialFrom)} → ${escapeHtml(page.route.officialTo)}</dd></div>
        </dl>`
      : '';
  const faqs = page.faqs
    .map(
      (faq) => `
        <section class="seo-faq">
          <h2>${escapeHtml(faq.question)}</h2>
          <p>${escapeHtml(faq.answer)}</p>
        </section>`,
    )
    .join('');
  const relatedLinks = page.relatedLinks
    .map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`)
    .join('\n            ');

  return `
    <main class="seo-static">
      <h1>${escapeHtml(page.h1)}</h1>
      <p>${escapeHtml(page.intro)}</p>
      ${renderSearchImage()}
      ${routeFacts}
      <p class="seo-static-cta">${escapeHtml(page.cta)}</p>
      ${faqs}
      <nav class="seo-route-links" aria-label="${escapeHtml(relatedLinksHeading(page.locale))}">
        <h2>${escapeHtml(relatedLinksHeading(page.locale))}</h2>
        <ul>
            ${relatedLinks}
        </ul>
      </nav>
    </main>`;
}

function renderStaticBlogContent(post) {
  const sections = post.sections
    .map(
      (section) => `
        <section class="seo-faq">
          <h2>${escapeHtml(section.heading)}</h2>
          ${section.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n          ')}
        </section>`,
    )
    .join('');
  const routeLinks = post.routeLinks
    .map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`)
    .join('\n            ');
  const source = post.source
    ? `<p class="seo-source">${escapeHtml(sourcePrefix(post.locale))}: <a href="${escapeHtml(post.source.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.source.label)}</a></p>`
    : '';
  const updated = `<p class="seo-updated">${escapeHtml(updatedPrefix(post.locale))}: ${escapeHtml(formatBlogDate(post.updatedAt, post.locale))}</p>`;

  return `
    <main class="seo-static seo-static-article">
      <h1>${escapeHtml(post.h1)}</h1>
      <p>${escapeHtml(post.intro)}</p>
      ${source}
      ${updated}
      <figure class="seo-figure">
        <img src="${escapeHtml(post.image.src)}" alt="${escapeHtml(post.image.alt)}" />
        <figcaption>${escapeHtml(post.image.caption)}</figcaption>
      </figure>
      ${sections}
      <nav class="seo-route-links" aria-label="${escapeHtml(post.cta)}">
        <h2>${escapeHtml(post.cta)}</h2>
        <ul>
            ${routeLinks}
        </ul>
      </nav>
    </main>`;
}

function renderStaticBlogIndexContent(page) {
  const posts = page.posts
    .map(
      (post) => `
        <article class="seo-faq">
          <h2><a href="${escapeHtml(post.path)}">${escapeHtml(post.h1)}</a></h2>
          <p>${escapeHtml(post.description)}</p>
        </article>`,
    )
    .join('');

  return `
    <main class="seo-static seo-static-index">
      <h1>${escapeHtml(page.h1)}</h1>
      <p>${escapeHtml(page.intro)}</p>
      ${renderSearchImage()}
      ${posts}
    </main>`;
}

function renderStaticHomeContent(locale) {
  const copy = staticHomeCopyForLocale(locale);
  const links = [
    [copy.tbilisiBatumi, `/${locale}/flights/tbilisi-batumi/`],
    [copy.tbilisiMestia, `/${locale}/flights/tbilisi-mestia/`],
    [copy.tbilisiAmbrolauri, `/${locale}/flights/tbilisi-ambrolauri/`],
    [copy.kutaisiMestia, `/${locale}/flights/kutaisi-mestia/`],
    [copy.bookingGuide, `/${locale}/blog/how-to-buy-vanilla-sky-tickets/`],
    [copy.blogIndex, `/${locale}/blog/`],
  ]
    .map(([label, href]) => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`)
    .join('\n            ');

  return `
    <main class="seo-static seo-static-home">
      <h1>${escapeHtml(copy.heading)}</h1>
      <p>${escapeHtml(copy.intro)}</p>
      ${renderSearchImage()}
      <nav class="seo-route-links" aria-label="${escapeHtml(copy.heading)}">
        <ul>
            ${links}
        </ul>
      </nav>
    </main>`;
}

function renderSearchImage() {
  return `
      <figure class="seo-figure seo-search-image">
        <img src="${escapeHtml(metadata.socialImage.url)}" alt="${escapeHtml(metadata.socialImage.alt)}" width="${escapeHtml(metadata.socialImage.width)}" height="${escapeHtml(metadata.socialImage.height)}" />
      </figure>`;
}

function renderStructuredDataScript(data) {
  return `<script id="getflights-json-ld" type="application/ld+json">${serializeStructuredData(data)}</script>`;
}

function sourcePrefix(locale) {
  if (locale === 'ru') return 'Источник';
  if (locale === 'ua') return 'Джерело';
  if (locale === 'ka') return 'წყარო';
  return 'Source';
}

function updatedPrefix(locale) {
  if (locale === 'ru') return 'Обновлено';
  if (locale === 'ua') return 'Оновлено';
  if (locale === 'ka') return 'განახლდა';
  return 'Last updated';
}

function formatBlogDate(iso, locale) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(toIntlLocale(locale), { year: 'numeric', month: 'long', day: 'numeric' }).format(
    new Date(year, month - 1, day),
  );
}

function relatedLinksHeading(locale) {
  if (locale === 'ru') return 'Полезные ссылки';
  if (locale === 'ua') return 'Корисні посилання';
  if (locale === 'ka') return 'სასარგებლო ბმულები';
  return 'Helpful links';
}

function staticHomeCopyForLocale(locale) {
  return ({
    en: {
    heading: 'Popular Vanilla Sky flight searches',
    intro: 'Open GetFlights.ge and see every available Vanilla Sky flight date in Georgia instantly, without checking each route one by one. Pick a route below for details, or read the practical guides before continuing to the official Vanilla Sky booking site.',
    tbilisiBatumi: 'Tbilisi to Batumi flight tickets',
    tbilisiMestia: 'Tbilisi to Mestia flight tickets',
    tbilisiAmbrolauri: 'Tbilisi to Ambrolauri flight tickets',
    kutaisiMestia: 'Kutaisi to Mestia flight tickets',
    bookingGuide: 'Vanilla Sky booking guide',
    blogIndex: 'All Vanilla Sky ticket guides',
  },
    ru: {
    heading: 'Популярные поиски рейсов Vanilla Sky',
    intro: 'Откройте GetFlights.ge и сразу увидите все доступные даты рейсов Vanilla Sky по Грузии, без проверки каждого маршрута по отдельности. Выберите маршрут ниже или прочитайте практические гиды перед переходом к официальной покупке Vanilla Sky.',
    tbilisiBatumi: 'Авиабилеты Тбилиси - Батуми',
    tbilisiMestia: 'Авиабилеты Тбилиси - Местиа',
    tbilisiAmbrolauri: 'Авиабилеты Тбилиси - Амбролаури',
    kutaisiMestia: 'Авиабилеты Кутаиси - Местиа',
    bookingGuide: 'Гид по покупке билетов Vanilla Sky',
    blogIndex: 'Все гиды по билетам Vanilla Sky',
  },
    ua: {
    heading: 'Популярні пошуки рейсів Vanilla Sky',
    intro: 'Відкрийте GetFlights.ge і одразу побачите всі доступні дати рейсів Vanilla Sky Грузією, без перевірки кожного маршруту окремо. Оберіть маршрут нижче або прочитайте практичні гайди перед переходом до офіційної купівлі на Vanilla Sky.',
    tbilisiBatumi: 'Авіаквитки Тбілісі - Батумі',
    tbilisiMestia: 'Авіаквитки Тбілісі - Местія',
    tbilisiAmbrolauri: 'Авіаквитки Тбілісі - Амбролаурі',
    kutaisiMestia: 'Авіаквитки Кутаїсі - Местія',
    bookingGuide: 'Гайд з купівлі квитків Vanilla Sky',
    blogIndex: 'Усі гайди по квитках Vanilla Sky',
  },
    ka: {
    heading: 'Vanilla Sky-ის პოპულარული ფრენების ძიება',
    intro: 'გახსენით GetFlights.ge და მაშინვე იხილეთ Vanilla Sky-ის ყველა ხელმისაწვდომი ფრენის თარიღი საქართველოში, თითოეული მარშრუტის ცალ-ცალკე შემოწმების გარეშე. აირჩიეთ მარშრუტი ქვემოთ ან წაიკითხეთ პრაქტიკული გზამკვლევები ოფიციალურ შეძენაზე გადასვლამდე.',
    tbilisiBatumi: 'თბილისი - ბათუმი ავიაბილეთები',
    tbilisiMestia: 'თბილისი - მესტია ავიაბილეთები',
    tbilisiAmbrolauri: 'თბილისი - ამბროლაური ავიაბილეთები',
    kutaisiMestia: 'ქუთაისი - მესტია ავიაბილეთები',
    bookingGuide: 'Vanilla Sky-ის ბილეთის ყიდვის გზამკვლევი',
    blogIndex: 'ყველა Vanilla Sky-ის ბილეთის გზამკვლევი',
  },
  })[locale];
}

function localeUrl(locale) {
  return `${siteOrigin()}${metadata.locales[locale].path}`;
}

function xDefaultUrl() {
  return `${siteOrigin()}${metadata.xDefaultPath}`;
}

function siteOrigin() {
  return metadata.siteOrigin.replace(/\/$/, '');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

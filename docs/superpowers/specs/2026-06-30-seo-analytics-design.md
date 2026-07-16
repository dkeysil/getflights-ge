# Multilingual SEO and Analytics Design

## Summary

GetFlights.ge should become discoverable in Google Search for each supported language while preserving the current booking flow. The first implementation slice will keep the existing Vite and React app, add a static SEO layer for the four locale URLs, expose real crawl files, and connect measurement through Cloudflare Web Analytics plus Google Search Console.

## Current State

The app is a Vite and React single page app deployed on Cloudflare Pages at `https://getflights.ge/`. It already supports English, Russian, Ukrainian, and Georgian in the UI through `src/lib/i18n.ts`.

The current SEO blockers are:

- The canonical URL is always `https://getflights.ge/`.
- Locale selection uses `?lang=` and localStorage rather than stable indexable locale paths.
- `/robots.txt` and `/sitemap.xml` currently return the SPA HTML instead of proper crawl files.
- `/en/`, `/ru/`, `/ua/`, and `/ka/` return the app, but the served HTML has the same metadata as `/`.
- There is no `hreflang` cluster for Google to connect language variants.
- There is no analytics tag in the repository.

## Goals

- Make English, Russian, Ukrainian, and Georgian versions independently crawlable and understandable to Google.
- Keep the current app experience and booking handoff intact.
- Add a privacy-light traffic baseline using Cloudflare Web Analytics.
- Prepare Google Search Console setup so progress can be measured by indexed pages, impressions, clicks, queries, and crawl errors.
- Keep the implementation small enough to ship as one focused SEO foundation pass.

## Non-Goals

- Do not migrate the app to Next.js, Astro, or server-side rendering in this slice.
- Do not add GA4, GTM, paid analytics, session replay, or conversion pixels in this slice.
- Do not create route-specific landing pages such as Tbilisi to Batumi pages yet.
- Do not rewrite visible app copy beyond metadata and crawl-facing SEO copy.

## Architecture

The app remains a Vite SPA. Build output will be augmented with static HTML entry files for `/en/`, `/ru/`, `/ua/`, and `/ka/`. Each locale entry points to the same compiled React assets but has its own crawl-facing metadata.

A small SEO metadata module will define the supported locales, URL paths, localized titles, localized descriptions, Open Graph fields, canonical URLs, and alternate URLs. The same metadata source will be used by tests and by generation scripts so sitemap, HTML metadata, and app locale behavior stay consistent.

Static crawl files will live in `public/` so Cloudflare Pages serves them directly:

- `public/robots.txt`
- `public/sitemap.xml`, generated or updated from the locale metadata

The root URL `/` will remain available as the default entry point. It will be declared as `x-default` and can continue to load the English experience by default. The canonical indexed language URLs will be `/en/`, `/ru/`, `/ua/`, and `/ka/`.

## Locale URL Behavior

Canonical locale URLs:

- `https://getflights.ge/en/`
- `https://getflights.ge/ru/`
- `https://getflights.ge/ua/`
- `https://getflights.ge/ka/`

The existing `?lang=` behavior remains backwards-compatible. When a user changes language in the UI, the app should update the path to the matching locale URL while preserving useful existing query parameters and hash fragments. Legacy aliases still resolve as they do now, including `ua` to Ukrainian and `ge` to Georgian.

The app should initialize locale in this order:

1. Locale path prefix, when present.
2. `lang` query parameter, for old links.
3. Stored localStorage locale.
4. Browser language.
5. English.

This avoids breaking old links while giving crawlers stable locale URLs.

## Crawl Metadata

Each locale HTML entry will include:

- `<html lang="...">`
- localized `<title>`
- localized `<meta name="description">`
- self-referencing `<link rel="canonical">`
- complete reciprocal `<link rel="alternate" hreflang="...">` entries for `en`, `ru`, `ua`, `ka`, and `x-default`
- localized Open Graph title and description
- localized Twitter title and description
- existing social image metadata

The root `/` entry will be treated as the `x-default` fallback. It can canonicalize to `https://getflights.ge/en/` to consolidate English signals, while the sitemap includes `/en/`, `/ru/`, `/ua/`, and `/ka/` as canonical indexable URLs.

## Sitemap and Robots

`robots.txt` will explicitly allow crawling and point to the sitemap:

```txt
User-agent: *
Allow: /

Sitemap: https://getflights.ge/sitemap.xml
```

`sitemap.xml` will list the four canonical locale URLs. Each `<url>` entry will include reciprocal `xhtml:link` alternates for all four locale URLs plus `x-default`.

The sitemap should use absolute HTTPS URLs and include the `xmlns:xhtml` namespace. The same URL set should be used for tests so future locale additions do not silently break the sitemap.

## Analytics

Cloudflare Web Analytics will be the first traffic analytics tool. It should be enabled on the Cloudflare Pages project so Cloudflare injects the beacon on the next deployment.

The codebase should not hardcode a Cloudflare analytics token unless Pages injection is unavailable. Validation after deployment should confirm the beacon appears in rendered HTML or the network waterfall and that Cloudflare starts receiving pageview data.

Measurement expectations:

- Cloudflare Web Analytics tracks visits, pageviews, referrers, countries, paths, and Web Vitals style performance data.
- Search Console tracks Google search-specific data: indexed pages, crawl errors, queries, impressions, clicks, CTR, and average position.
- Cloudflare Web Analytics is not a replacement for Search Console because it does not expose Google query or indexing data.

## Search Console Setup

Use a Google Search Console Domain property for `getflights.ge` if DNS access is available. Verification should be done through a DNS TXT record in Cloudflare. If Domain verification is not available, use a URL-prefix property for `https://getflights.ge/`.

After verification:

- Submit `https://getflights.ge/sitemap.xml`.
- Inspect `/en/`, `/ru/`, `/ua/`, and `/ka/`.
- Request indexing only after the deployed pages return correct canonical, hreflang, and sitemap responses.
- Track the first baseline after Google has crawled the sitemap.

## Success Metrics

Initial technical success:

- `/robots.txt` returns `text/plain` crawl rules, not app HTML.
- `/sitemap.xml` returns XML with four canonical locale URLs and reciprocal alternates.
- `/en/`, `/ru/`, `/ua/`, and `/ka/` return localized metadata and self-canonicals.
- Root `/` remains usable.
- Existing app tests pass.
- Build output contains the locale HTML entry files.
- Cloudflare Web Analytics is receiving visits after deployment.
- Search Console accepts the sitemap.

SEO progress metrics:

- Indexed pages: target 4 submitted locale URLs.
- Search Console impressions: begin measuring per language and query family.
- Clicks and CTR: track by page and query once impressions appear.
- Crawl errors: target zero errors for sitemap URLs.

## Testing

Add focused tests for:

- Locale resolution from path, query, storage, and browser language.
- Locale URL generation when switching languages.
- SEO metadata completeness for all supported locales.
- Sitemap generation including `x-default`, self-references, reciprocal alternates, and absolute HTTPS URLs.

Run:

```bash
npm test
npm run build
```

After deployment, verify live responses:

```bash
curl -I https://getflights.ge/robots.txt
curl -I https://getflights.ge/sitemap.xml
curl -sS https://getflights.ge/sitemap.xml
curl -sS https://getflights.ge/en/ | head
curl -sS https://getflights.ge/ru/ | head
curl -sS https://getflights.ge/ua/ | head
curl -sS https://getflights.ge/ka/ | head
```

## Rollout

1. Implement metadata, URL helpers, sitemap generation, and tests locally.
2. Build the app and inspect `dist/`.
3. Deploy through the existing Cloudflare Pages flow.
4. Enable Cloudflare Web Analytics on the Pages project.
5. Verify live crawl files and locale HTML.
6. Verify the Cloudflare analytics beacon.
7. Set up or update Search Console and submit the sitemap.
8. Check Search Console after Google processes the sitemap.

## Risks and Mitigations

- Risk: Duplicate language pages if the root, query URLs, and locale paths all compete.
  Mitigation: Locale paths self-canonicalize, root acts as `x-default`, and query URLs are not listed in the sitemap.

- Risk: Google ignores `hreflang` due to missing reciprocal entries.
  Mitigation: Generate all alternates from one metadata source and test every locale entry.

- Risk: Cloudflare's managed `robots.txt` behavior conflicts with the custom file.
  Mitigation: Serve a real `public/robots.txt` and verify the deployed response body and content type.

- Risk: Cloudflare Web Analytics injection does not appear after deployment.
  Mitigation: Verify Pages Web Analytics settings and use a manual snippet only if Pages injection is unavailable.

- Risk: Search Console cannot be verified because DNS access is unavailable.
  Mitigation: Use URL-prefix verification if Domain verification cannot be completed.

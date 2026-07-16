# Multilingual SEO and Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add indexable multilingual SEO foundations and Cloudflare/Search Console measurement readiness for GetFlights.ge.

**Architecture:** Keep the existing Vite/React SPA. Add a JSON SEO metadata source, TypeScript helpers, a Node generation script, generated crawl files, localized build entry HTML, and path-based locale URLs. Cloudflare Web Analytics and Google Search Console setup are verified operational steps after deployment.

**Tech Stack:** Vite, React, TypeScript, Vitest, Node ESM scripts, Cloudflare Pages.

---

## File Structure

- Modify `package.json`: run SEO generation before and after Vite build.
- Create `src/lib/seo-metadata.json`: canonical source for locale SEO metadata.
- Create `src/lib/seo.ts`: typed SEO helpers and sitemap builder for tests/app code.
- Create `src/lib/seo.test.ts`: SEO metadata and sitemap tests.
- Modify `src/lib/i18n.ts`: path-first locale resolution and path-based locale URL generation.
- Modify `src/lib/i18n.test.ts`: tests for path locale resolution and URL switching.
- Modify `src/App.tsx`: pass `pathname` into locale resolution through existing helper behavior and update language switcher URLs.
- Modify `src/App.test.tsx`: assert language switching moves to locale paths.
- Create `scripts/generate-seo.mjs`: generate `public/sitemap.xml`, `public/robots.txt`, and post-build localized HTML entry files.
- Create `public/robots.txt`: committed crawl file for local/public visibility.
- Create `public/sitemap.xml`: committed generated sitemap.

Git commits are skipped in this workspace because `.git` is an empty directory and Git commands fail with `fatal: not a git repository`.

## Task 1: Locale URL Behavior

**Files:**
- Modify `src/lib/i18n.test.ts`
- Modify `src/lib/i18n.ts`
- Modify `src/App.test.tsx`
- Modify `src/App.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that expect locale path prefixes to win over query/storage/browser language, old `?lang=` links to remain supported, and language switching to produce `/ua/` style URLs instead of query-only URLs.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/lib/i18n.test.ts src/App.test.tsx`

Expected: tests fail because `resolveLocale` does not read `pathname` and `withLocaleInUrl` still writes the `lang` query parameter.

- [ ] **Step 3: Implement path-based locale helpers**

Update `resolveLocale`, `readInitialLocale`, and `withLocaleInUrl` so canonical locale URLs are `/en/`, `/ru/`, `/ua/`, and `/ka/`, while legacy query aliases continue to resolve.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/lib/i18n.test.ts src/App.test.tsx`

Expected: focused locale tests pass.

## Task 2: SEO Metadata and Sitemap

**Files:**
- Create `src/lib/seo-metadata.json`
- Create `src/lib/seo.ts`
- Create `src/lib/seo.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for locale metadata completeness and sitemap output. The tests must assert four canonical locale URLs, reciprocal `hreflang` alternates, `x-default`, and absolute HTTPS URLs.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/lib/seo.test.ts`

Expected: tests fail because `src/lib/seo.ts` does not exist yet.

- [ ] **Step 3: Implement SEO metadata and helpers**

Add the JSON metadata and TypeScript helpers to generate locale URLs, alternate links, and sitemap XML.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/lib/seo.test.ts`

Expected: SEO tests pass.

## Task 3: Static Crawl Files and Locale HTML Generation

**Files:**
- Create `scripts/generate-seo.mjs`
- Modify `package.json`
- Create/update `public/robots.txt`
- Create/update `public/sitemap.xml`

- [ ] **Step 1: Write failing generation verification**

Run: `node scripts/generate-seo.mjs --public`

Expected: command fails because the script does not exist.

- [ ] **Step 2: Implement generation script**

Create a Node ESM script that reads `src/lib/seo-metadata.json`, writes `public/robots.txt`, writes `public/sitemap.xml`, and when `--dist` is passed, rewrites `dist/index.html` metadata and creates `dist/en/index.html`, `dist/ru/index.html`, `dist/ua/index.html`, and `dist/ka/index.html`.

- [ ] **Step 3: Update build script**

Change `package.json` build to run `node scripts/generate-seo.mjs --public && tsc -b && vite build && node scripts/generate-seo.mjs --dist`.

- [ ] **Step 4: Run public generation**

Run: `node scripts/generate-seo.mjs --public`

Expected: `public/robots.txt` and `public/sitemap.xml` are written.

## Task 4: Full Verification

**Files:**
- All files touched above

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: all Vitest files pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: TypeScript build and Vite build succeed, SEO script writes locale HTML files.

- [ ] **Step 3: Inspect generated output**

Run:

```bash
find dist -maxdepth 2 -type f | sort
sed -n '1,80p' dist/sitemap.xml
sed -n '1,80p' dist/en/index.html
sed -n '1,80p' dist/ru/index.html
```

Expected: dist contains `sitemap.xml`, `robots.txt`, and locale `index.html` files with localized metadata.

## Task 5: Post-Deploy Operational Steps

**Files:**
- No code files

- [ ] **Step 1: Enable Cloudflare Web Analytics**

Enable Web Analytics for the Cloudflare Pages project in Cloudflare. Prefer Pages automatic injection. Use a manual token only if automatic injection is unavailable.

- [ ] **Step 2: Verify live crawl files after deployment**

Run:

```bash
curl -I https://getflights.ge/robots.txt
curl -I https://getflights.ge/sitemap.xml
curl -sS https://getflights.ge/sitemap.xml
curl -sS https://getflights.ge/en/ | head
curl -sS https://getflights.ge/ru/ | head
curl -sS https://getflights.ge/ua/ | head
curl -sS https://getflights.ge/ka/ | head
```

Expected: crawl files are not SPA HTML, locale pages contain localized metadata, and Cloudflare Web Analytics beacon appears after Pages injection.

- [ ] **Step 3: Configure Google Search Console**

Create or use a Domain property for `getflights.ge`, verify with Cloudflare DNS TXT, submit `https://getflights.ge/sitemap.xml`, and inspect `/en/`, `/ru/`, `/ua/`, and `/ka/`.

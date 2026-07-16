# Route SEO Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first programmatic SEO slice for transactional Georgian domestic flight searches across English, Russian, Ukrainian, and Georgian.

**Architecture:** Add a typed route SEO page catalog that defines the page universe once, extend sitemap/static HTML generation from that catalog, and make the React app recognize route-page URLs so users landing from Google see route-specific copy and the correct live route selected. Keep the existing Vite SPA and Cloudflare Pages deployment flow.

**Tech Stack:** Vite, React, TypeScript, Vitest, Node ESM generation script, Cloudflare Pages.

---

## File Structure

- Create `src/lib/route-seo.ts`: route/hub SEO page catalog, localized copy helpers, URL helpers, page lookup by path.
- Create `src/lib/route-seo.test.ts`: tests for the 44-page universe, localized URLs, page lookup, and route mapping.
- Modify `src/lib/seo.ts`: include route SEO pages in sitemap generation and alternate clusters.
- Modify `src/lib/seo.test.ts`: assert route pages are included in sitemap with reciprocal alternates.
- Modify `scripts/generate-seo.mjs`: generate static localized HTML files for route/hub SEO pages and inject crawl-visible page content into `#root`.
- Modify `src/App.tsx`: detect SEO page path, show route-specific copy, and preselect the official route for route pages.
- Modify `src/App.test.tsx`: assert route SEO URL renders route copy and selects the route from the mock backend.
- Modify `src/styles.css`: add compact route SEO content styles.
- Generated/updated: `public/sitemap.xml`, `dist/**` during build.

Git commits are skipped because this checkout has an empty `.git` directory and Git reports `fatal: not a git repository`.

## Page Universe

The first slice creates 11 canonical page slugs per language:

- `flights`
- `flights/vanilla-sky`
- `flights/natakhtari-airport`
- `flights/tbilisi-batumi`
- `flights/batumi-tbilisi`
- `flights/tbilisi-mestia`
- `flights/mestia-tbilisi`
- `flights/tbilisi-ambrolauri`
- `flights/ambrolauri-tbilisi`
- `flights/kutaisi-mestia`
- `flights/mestia-kutaisi`

Across `en`, `ru`, `ua`, and `ka`, this yields 44 pages.

## Task 1: Route SEO Data Model

**Files:**
- Create `src/lib/route-seo.test.ts`
- Create `src/lib/route-seo.ts`

- [ ] **Step 1: Write failing tests**

Create tests that import `routeSeoPages`, `routeSeoPagesForLocale`, `getRouteSeoPageByPath`, and `routeSeoPageUrl`. Assert:

- 44 total localized pages.
- 11 pages per locale.
- `/en/flights/tbilisi-batumi/` maps to official route `7 -> 4`.
- `/ru/flights/vanilla-sky/` resolves to the Russian Vanilla Sky hub.
- Each page has title, description, H1, intro, CTA, and at least two FAQ entries.

- [ ] **Step 2: Run test and verify red**

Run: `npm test -- src/lib/route-seo.test.ts`

Expected: fail because `src/lib/route-seo.ts` does not exist.

- [ ] **Step 3: Implement minimal route SEO catalog**

Create `route-seo.ts` with the 11 page definitions and localized phrase templates. Route pages must include official route IDs for the 8 live purchasable route directions:

- Tbilisi -> Batumi uses `7 -> 4`
- Batumi -> Tbilisi uses `4 -> 7`
- Tbilisi -> Mestia uses `7 -> 6`
- Mestia -> Tbilisi uses `6 -> 7`
- Tbilisi -> Ambrolauri uses `7 -> 2`
- Ambrolauri -> Tbilisi uses `2 -> 7`
- Kutaisi -> Mestia uses `5 -> 6`
- Mestia -> Kutaisi uses `6 -> 5`

- [ ] **Step 4: Run focused test and verify green**

Run: `npm test -- src/lib/route-seo.test.ts`

Expected: pass.

## Task 2: Sitemap and Static Page Generation

**Files:**
- Modify `src/lib/seo.ts`
- Modify `src/lib/seo.test.ts`
- Modify `scripts/generate-seo.mjs`

- [ ] **Step 1: Write failing sitemap tests**

Update `src/lib/seo.test.ts` to assert the sitemap includes `/en/flights/tbilisi-batumi/`, `/ru/flights/vanilla-sky/`, `/ua/flights/`, and `/ka/flights/natakhtari-airport/`, each with `x-default` and locale alternates.

- [ ] **Step 2: Run test and verify red**

Run: `npm test -- src/lib/seo.test.ts`

Expected: fail because sitemap generation only includes locale home pages.

- [ ] **Step 3: Extend sitemap helpers**

Update `seo.ts` to build sitemap entries for locale home pages plus every route SEO page.

- [ ] **Step 4: Run focused sitemap tests**

Run: `npm test -- src/lib/seo.test.ts`

Expected: pass.

- [ ] **Step 5: Extend static generator**

Update `scripts/generate-seo.mjs` to generate `dist/<locale>/<slug>/index.html` for all 44 route SEO pages. Each generated page must have localized title, description, canonical URL, page-specific hreflang alternates, Open Graph/Twitter metadata, and static route SEO content inside `#root`.

- [ ] **Step 6: Run build and inspect generated files**

Run: `npm run build`

Expected: build passes and `dist/en/flights/tbilisi-batumi/index.html` exists with route-specific metadata and content.

## Task 3: React Route Page UX

**Files:**
- Modify `src/App.test.tsx`
- Modify `src/App.tsx`
- Modify `src/styles.css`

- [ ] **Step 1: Write failing app test**

Add a test that visits `/en/flights/tbilisi-batumi/`, renders `App`, and asserts:

- The page shows an H1 containing `Buy Tbilisi to Batumi flight tickets`.
- The route rail/current route shows Tbilisi (Natakhtari airport) to Batumi.
- Language switching preserves the SEO slug, e.g. `/ru/flights/tbilisi-batumi/`.

- [ ] **Step 2: Run focused app test and verify red**

Run: `npm test -- src/App.test.tsx`

Expected: fail because App does not render route SEO page copy or preserve route page slug through language switching.

- [ ] **Step 3: Implement route-page detection and UI**

Use `getRouteSeoPageByPath(window.location.pathname)` to derive the active SEO page. Show route SEO content below the subbar. Use the page's official route IDs as the preferred route in initial state and refresh fallback.

- [ ] **Step 4: Add CSS**

Add compact unframed `.seo-panel` styles matching the app's operational UI.

- [ ] **Step 5: Run focused app test**

Run: `npm test -- src/App.test.tsx`

Expected: pass.

## Task 4: Full Verification

**Files:**
- All touched files

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: TypeScript and Vite build pass; SEO generator writes home pages, route pages, robots, and sitemap.

- [ ] **Step 3: Inspect representative generated pages**

Run:

```bash
sed -n '1,90p' dist/en/flights/tbilisi-batumi/index.html
sed -n '1,90p' dist/ru/flights/vanilla-sky/index.html
sed -n '1,120p' dist/sitemap.xml
```

Expected: generated pages contain page-specific title, canonical, hreflang, and visible static SEO content.

## Task 5: Deploy and Live Verify

**Files:**
- No additional source files.

- [ ] **Step 1: Deploy production**

Run:

```bash
npx wrangler pages deploy dist --project-name better-vanillasky --branch main --commit-message "Add route SEO pages" --commit-dirty=true
```

Expected: Cloudflare Pages creates a production deployment.

- [ ] **Step 2: Verify live route pages**

Run:

```bash
curl -sS https://getflights.ge/en/flights/tbilisi-batumi/ | rg "Buy Tbilisi to Batumi flight tickets|canonical|hreflang"
curl -sS https://getflights.ge/ru/flights/vanilla-sky/ | rg "Vanilla Sky|canonical|hreflang"
curl -sS https://getflights.ge/sitemap.xml | rg "flights/tbilisi-batumi|flights/vanilla-sky|flights/natakhtari-airport"
```

Expected: live pages and sitemap include the new SEO URLs.

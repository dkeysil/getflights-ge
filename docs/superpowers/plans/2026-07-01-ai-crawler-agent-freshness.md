# AI Crawler, Agent Accessibility, and Content Freshness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve GetFlights.ge AI search access, browser-agent task reliability, and freshness/authority signals for existing route and guide content.

**Architecture:** Keep the current Vite/React static SEO architecture. Make Cloudflare crawler policy explicit and verifiable, improve accessible names for live booking controls in `App.tsx`, and add durable published/updated metadata to blog content, rendered HTML, and JSON-LD. Treat Cloudflare settings as an operational deployment step because live `robots.txt` can be rewritten outside the repo.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, Node ESM scripts, Cloudflare Pages, Cloudflare dashboard.

---

## File Structure

- Modify `public/robots.txt`: publish the intended repo-controlled crawler policy.
- Modify `docs/seo-analytics-operations.md`: document Cloudflare managed robots settings and live verification.
- Create `scripts/check-live-robots.mjs`: fail fast when live `robots.txt` is still being prepended by Cloudflare or blocks search/citation bots.
- Modify `package.json`: add `check:live-robots`.
- Modify `src/App.tsx`: add explicit accessible names and pressed/current states to route, date, and booking controls; render visible blog update metadata.
- Modify `src/App.test.tsx`: cover route card names, calendar date names, booking button names, and visible blog freshness.
- Modify `src/lib/blog-seo.ts`: add `publishedAt` and `updatedAt` fields to every blog post.
- Modify `src/lib/blog-seo.test.ts`: enforce blog date metadata.
- Modify `src/lib/structured-data.ts`: add `datePublished`, `dateModified`, and named author metadata to Article JSON-LD.
- Modify `src/lib/structured-data.test.ts`: assert Article date and author metadata.
- Modify `scripts/generate-seo.mjs`: include visible freshness metadata in static blog HTML.
- Modify `src/styles.css`: style the blog freshness row consistently in hydrated and static HTML.

Git commits are skipped in this workspace because `git status --short` currently fails with `fatal: not a git repository`. If this plan is executed from a checkout with working Git metadata, commit after each task.

## Task 1: Repo-Controlled AI Crawler Policy and Live Verification

**Files:**
- Modify: `public/robots.txt`
- Modify: `docs/seo-analytics-operations.md`
- Create: `scripts/check-live-robots.mjs`
- Modify: `package.json`

- [ ] **Step 1: Replace `public/robots.txt` with the intended crawler policy**

Use this exact file content:

```txt
User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Googlebot
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Amazonbot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: meta-externalagent
Disallow: /

User-agent: *
Allow: /

Sitemap: https://getflights.ge/sitemap.xml
```

Rationale: allow search/citation and user-action agents, keep known training-only or broad scraping agents blocked where vendors split search from training crawlers, and keep all normal search engines allowed.

- [ ] **Step 2: Create `scripts/check-live-robots.mjs`**

Use this exact script:

```js
const robotsUrl = process.env.ROBOTS_URL ?? 'https://getflights.ge/robots.txt';

const requiredAllowedAgents = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'ClaudeBot',
  'Bingbot',
  'Googlebot',
];

const expectedBlockedAgents = [
  'GPTBot',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'Applebot-Extended',
  'meta-externalagent',
];

const response = await fetch(robotsUrl);
if (!response.ok) {
  throw new Error(`Could not fetch ${robotsUrl}: ${response.status} ${response.statusText}`);
}

const text = await response.text();
const failures = [];

if (/BEGIN Cloudflare Managed Content/i.test(text) || /BEGIN Cloudflare Managed content/i.test(text)) {
  failures.push('Cloudflare managed robots content is still prepended.');
}

for (const agent of requiredAllowedAgents) {
  if (hasRootDisallow(text, agent)) {
    failures.push(`${agent} is blocked with Disallow: /`);
  }
}

for (const agent of expectedBlockedAgents) {
  if (!hasRootDisallow(text, agent)) {
    failures.push(`${agent} is not explicitly blocked.`);
  }
}

if (!/Sitemap:\s*https:\/\/getflights\.ge\/sitemap\.xml/i.test(text)) {
  failures.push('Sitemap directive is missing.');
}

if (failures.length) {
  console.error(`Live robots policy check failed for ${robotsUrl}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Live robots policy check passed for ${robotsUrl}`);

function hasRootDisallow(source, agent) {
  const section = exactAgentSection(source, agent);
  if (!section) return false;
  return /^Disallow:\s*\/\s*$/im.test(section);
}

function exactAgentSection(source, agent) {
  const escaped = escapeRegExp(agent);
  const pattern = new RegExp(
    `(^|\\n)User-agent:\\s*${escaped}\\s*\\n([\\s\\S]*?)(?=\\nUser-agent:\\s*|$)`,
    'i',
  );
  return pattern.exec(source)?.[2] ?? '';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

- [ ] **Step 3: Add the package script**

In `package.json`, add:

```json
"check:live-robots": "node scripts/check-live-robots.mjs"
```

Keep the existing scripts unchanged.

- [ ] **Step 4: Run the live check before changing Cloudflare**

Run:

```bash
npm run check:live-robots
```

Expected before the Cloudflare setting is changed: FAIL with `Cloudflare managed robots content is still prepended` and any blocked required agents from the live managed policy.

- [ ] **Step 5: Document the Cloudflare setting**

Append this section to `docs/seo-analytics-operations.md`:

```md
## AI Crawler Robots Policy

The repo publishes a crawler policy in `public/robots.txt`, but Cloudflare can prepend managed robots rules at request time. For AI search visibility, the live `https://getflights.ge/robots.txt` must not contain `# BEGIN Cloudflare Managed Content`.

Recommended policy:
- Allow search and citation agents: `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`, `Bingbot`, `Googlebot`.
- Block broad training or scraping agents where search access has a separate bot: `GPTBot`, `CCBot`, `Bytespider`, `Amazonbot`, `Applebot-Extended`, `meta-externalagent`.
- Keep `Sitemap: https://getflights.ge/sitemap.xml`.

Cloudflare dashboard steps:
1. Open the `getflights.ge` zone.
2. Go to Security > Bots, or Security Settings and filter by Bot traffic.
3. Disable the managed setting that prepends AI bot blocks to `robots.txt`:
   - `Instruct bot traffic with robots.txt`, or
   - `Set your preference to block training in robots.txt`.
4. Keep enforced WAF blocking separate from the public `robots.txt` policy.
5. Redeploy the Pages project after the repo `robots.txt` change.
6. Run `npm run check:live-robots`.

Expected verification:
- `curl -sS https://getflights.ge/robots.txt` does not contain `BEGIN Cloudflare Managed`.
- `npm run check:live-robots` exits successfully.
```

- [ ] **Step 6: Run local generation and tests**

Run:

```bash
node scripts/generate-seo.mjs --public
npm test -- src/lib/agent-readable.test.ts src/lib/seo.test.ts
```

Expected: generation succeeds and focused tests pass.

## Task 2: Agent-Friendly Accessible Names for Interactive Booking Controls

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Add failing accessibility assertions**

Add this test to `src/App.test.tsx`:

```tsx
it('exposes route, date, and booking controls with task-specific accessible names', async () => {
  window.history.replaceState(null, '', '/en/');

  render(<App />);

  expect(
    await screen.findByRole('button', {
      name: /Select route Tbilisi \(Natakhtari airport\) to Batumi/i,
    }),
  ).toHaveAttribute('aria-pressed', 'true');

  expect(
    await screen.findByRole('button', {
      name: /Choose available date .* for Tbilisi \(Natakhtari airport\) to Batumi/i,
    }),
  ).toHaveAttribute('aria-pressed', 'true');
});
```

Add this test after extending the backend mock to return one flight:

```tsx
it('names the official booking handoff button with route and date context', async () => {
  window.history.replaceState(null, '', '/en/');

  render(<App />);

  expect(
    await screen.findByRole('button', {
      name: /Book Tbilisi \(Natakhtari airport\) to Batumi on .* with Vanilla Sky/i,
    }),
  ).toBeInTheDocument();
});
```

For the second test, change the mocked `searchFlights` result in this file from an empty `flights` array to:

```ts
searchFlights: vi.fn(async () => ({
  resultUrl: '/en/flights-form',
  flights: [
    {
      checkboxName: 'flight[0]',
      checkboxValue: '1',
      fromName: 'Tbilisi',
      toName: 'Batumi',
      dateLabel: 'Tue, Jun 30',
      time: '09:00',
      priceGel: '90 GEL',
      priceUsd: null,
    },
  ],
})),
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: the new tests fail because route card and calendar buttons do not have task-specific accessible names yet.

- [ ] **Step 3: Add accessible label helpers to `src/App.tsx`**

Add these helper functions near the bottom of `src/App.tsx`, before `formatPrice` if that function exists below the component helpers:

```tsx
function routeCardAriaLabel(route: RouteCard, locale: Locale) {
  const from = getCityName(route.from.id, locale, route.from.name);
  const to = getCityName(route.to.id, locale, route.to.name);
  const nextFlight = route.firstDate ? ` Next flight ${formatShortDate(route.firstDate, locale)}.` : '';
  return `Select route ${from} to ${to}. ${formatDateCount(route.dateCount, locale)} available dates.${nextFlight}`;
}

function dateButtonAriaLabel(
  iso: string,
  locale: Locale,
  fromCityName: string | undefined,
  toCityName: string | undefined,
  isAvailable: boolean,
) {
  const label = formatSelectedDate(iso, locale);
  const route = fromCityName && toCityName ? ` for ${fromCityName} to ${toCityName}` : '';
  return isAvailable ? `Choose available date ${label}${route}` : `Unavailable date ${label}${route}`;
}

function bookFlightAriaLabel(
  locale: Locale,
  fromCityName: string | undefined,
  toCityName: string | undefined,
  selectedDate: string | null,
) {
  const route = fromCityName && toCityName ? `${fromCityName} to ${toCityName}` : 'selected route';
  const date = selectedDate ? formatSelectedDate(selectedDate, locale) : 'selected date';
  return `Book ${route} on ${date} with Vanilla Sky`;
}
```

- [ ] **Step 4: Apply the helpers to the buttons**

In the route card button inside `routeCards.map`, add:

```tsx
aria-label={routeCardAriaLabel(route, locale)}
aria-pressed={active}
```

In the calendar day button, add:

```tsx
aria-label={dateButtonAriaLabel(day.iso, locale, fromCityName, toCityName, day.isAvailable)}
aria-pressed={selectedDate === day.iso}
aria-current={day.isToday ? 'date' : undefined}
```

In the booking button, add:

```tsx
aria-label={bookFlightAriaLabel(locale, fromCityName, toCityName, selectedDate)}
```

In the mobile route rail toggle, add:

```tsx
aria-label={`${copy.route}: ${fromCityName ?? ''} to ${toCityName ?? ''}`}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: all App tests pass and the new role-name assertions pass.

## Task 3: Blog Freshness, Article Dates, and Visible Authority Signals

**Files:**
- Modify: `src/lib/blog-seo.ts`
- Modify: `src/lib/blog-seo.test.ts`
- Modify: `src/lib/structured-data.ts`
- Modify: `src/lib/structured-data.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `scripts/generate-seo.mjs`
- Modify: `src/styles.css`

- [ ] **Step 1: Add failing blog metadata tests**

Add this test to `src/lib/blog-seo.test.ts`:

```ts
it('adds publish and update dates to every localized blog post', () => {
  for (const post of blogSeoPosts) {
    expect(post.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(post.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(post.updatedAt >= post.publishedAt).toBe(true);
  }
});
```

Add these assertions to the existing Article schema test in `src/lib/structured-data.test.ts`:

```ts
datePublished: '2026-07-01',
dateModified: '2026-07-01',
author: expect.objectContaining({
  '@type': 'Organization',
  name: 'GetFlights.ge',
}),
```

Add this assertion to the localized blog guide test in `src/App.test.tsx`:

```tsx
expect(screen.getByText(/Last updated: July 1, 2026/)).toBeInTheDocument();
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/blog-seo.test.ts src/lib/structured-data.test.ts src/App.test.tsx
```

Expected: tests fail because blog posts do not expose `publishedAt` and `updatedAt`, Article schema lacks date metadata, and the article UI does not show a last-updated line.

- [ ] **Step 3: Extend the blog post type and builder**

In `src/lib/blog-seo.ts`, update `BlogSeoPost`:

```ts
export type BlogSeoPost = {
  locale: Locale;
  slug: string;
  path: `/${Locale}/${string}/`;
  title: string;
  description: string;
  h1: string;
  intro: string;
  cta: string;
  publishedAt: string;
  updatedAt: string;
  source?: {
    label: string;
    href: string;
  };
  image: {
    src: string;
    alt: string;
    caption: string;
  };
  routeLinks: BlogSeoRouteLink[];
  sections: BlogSeoSection[];
};
```

Add constants near the slug constants:

```ts
const BLOG_PUBLISHED_AT = '2026-07-01';
const BLOG_UPDATED_AT = '2026-07-01';
```

In the `blogSeoPosts` builder object near the bottom of `src/lib/blog-seo.ts`, add:

```ts
publishedAt: BLOG_PUBLISHED_AT,
updatedAt: BLOG_UPDATED_AT,
```

immediately after `path: \`/${locale}/${slug}/`,`:

```ts
export const blogSeoPosts: BlogSeoPost[] = locales.flatMap((locale) =>
  articleSlugs.map((slug) => ({
    locale,
    slug,
    path: `/${locale}/${slug}/`,
    publishedAt: BLOG_PUBLISHED_AT,
    updatedAt: BLOG_UPDATED_AT,
    ...articleCopies[slug][locale],
    source: slug === VANILLA_SKY_GUIDE_SLUG ? sourceCopy[locale] : undefined,
    routeLinks: routeLinks(locale),
  })),
);
```

- [ ] **Step 4: Add Article schema date and author metadata**

In `src/lib/structured-data.ts`, replace the current blog Article `author` field with:

```ts
author: {
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: SITE_NAME,
  url: SITE_ORIGIN,
},
datePublished: post.publishedAt,
dateModified: post.updatedAt,
```

Keep `publisher: { '@id': ORGANIZATION_ID }`.

- [ ] **Step 5: Render visible blog freshness in React**

In `BlogSeoArticle` in `src/App.tsx`, add a localized label map:

```tsx
const updatedLabel = {
  en: 'Last updated',
  ru: 'Обновлено',
  ua: 'Оновлено',
  ka: 'განახლდა',
}[post.locale];
```

Render it after the source paragraph and before the figure:

```tsx
<p className="blog-updated">
  {updatedLabel}: {formatBlogDate(post.updatedAt, post.locale)}
</p>
```

Add this helper near the other formatting helpers:

```tsx
function formatBlogDate(iso: string, locale: Locale) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(
    new Date(year, month - 1, day),
  );
}
```

- [ ] **Step 6: Render visible blog freshness in static HTML**

In `scripts/generate-seo.mjs`, update `renderStaticBlogContent(post)` to include a freshness paragraph after the optional source paragraph:

```js
const updated = `<p class="seo-updated">${escapeHtml(updatedPrefix(post.locale))}: ${escapeHtml(formatBlogDate(post.updatedAt, post.locale))}</p>`;
```

Include `${updated}` in the rendered article header.

Add these helper functions:

```js
function updatedPrefix(locale) {
  if (locale === 'ru') return 'Обновлено';
  if (locale === 'ua') return 'Оновлено';
  if (locale === 'ka') return 'განახლდა';
  return 'Last updated';
}

function formatBlogDate(iso, locale) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(
    new Date(year, month - 1, day),
  );
}
```

- [ ] **Step 7: Add lightweight styling**

Add this to `src/styles.css` near the existing `.blog-source` styles:

```css
.blog-updated,
.seo-updated {
  color: var(--muted);
  font-size: 0.92rem;
  margin: 0.35rem 0 1rem;
}
```

- [ ] **Step 8: Run focused tests**

Run:

```bash
npm test -- src/lib/blog-seo.test.ts src/lib/structured-data.test.ts src/App.test.tsx
```

Expected: focused tests pass.

## Task 4: Full Build and Live Validation

**Files:**
- All files touched above

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: all Vitest files pass.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: TypeScript build, Vite build, public SEO generation, and dist SEO generation succeed.

- [ ] **Step 3: Inspect generated HTML**

Run:

```bash
rg -n "Last updated|datePublished|dateModified|OAI-SearchBot|ClaudeBot" dist public
sed -n '1,90p' dist/en/blog/how-to-buy-vanilla-sky-tickets/index.html
sed -n '1,80p' dist/robots.txt
```

Expected:
- Blog HTML contains visible `Last updated`.
- JSON-LD contains `datePublished` and `dateModified`.
- `dist/robots.txt` contains the intended crawler policy.

- [ ] **Step 4: Deploy and verify live crawler policy**

After deploying to Cloudflare Pages and disabling Cloudflare managed robots prepending, run:

```bash
curl -sS https://getflights.ge/robots.txt
npm run check:live-robots
```

Expected:
- Live robots output does not contain `BEGIN Cloudflare Managed`.
- `npm run check:live-robots` prints `Live robots policy check passed for https://getflights.ge/robots.txt`.

- [ ] **Step 5: Browser-check the live agent task path**

Run a Playwright smoke check against the deployed site:

```bash
node -e "import('playwright').then(async ({ chromium }) => { const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); await page.goto('https://getflights.ge/en/', { waitUntil: 'networkidle' }); const buttons = await page.getByRole('button').evaluateAll((nodes) => nodes.map((node) => ({ name: node.getAttribute('aria-label') || node.textContent?.trim() || '', pressed: node.getAttribute('aria-pressed') }))); console.log(JSON.stringify(buttons.filter((button) => /Select route|Choose available date|Book .* Vanilla Sky/.test(button.name)), null, 2)); await browser.close(); })"
```

Expected: output includes route selection and available-date controls with descriptive names. If a live fare is available for the selected route/date, output also includes a booking handoff button with route/date context.

## Self-Review

- Spec coverage: Task 1 covers selected improvement 1, Task 2 covers selected improvement 3, Task 3 covers selected improvement 5, and Task 4 covers full verification.
- Red-flag wording scan: no intentionally incomplete implementation steps remain in this plan.
- Type consistency: `BlogSeoPost.publishedAt` and `BlogSeoPost.updatedAt` are introduced before they are used by structured data, React rendering, static generation, and tests.

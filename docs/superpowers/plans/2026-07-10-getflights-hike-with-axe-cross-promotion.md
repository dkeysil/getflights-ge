# GetFlights and Hike With Axe Cross-Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch a 30-day, click-measured RU/UA GetFlights banner for Hike With Axe and publish a useful Russian Hike With Axe Vanilla Sky ticket-buying article that links back to GetFlights.

**Architecture:** GetFlights gains a self-contained promotion configuration module, a presentational banner component, and one GA4 event. Hike With Axe extends its existing article model with editorial external-resource links, renders them inside article pages, and adds one static Russian article. The sites remain independently deployable and communicate only through ordinary tagged links.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, GA4; Astro 7, TypeScript, Vitest, static Cloudflare Pages output.

## Global Constraints

- Render the GetFlights banner only for `ru` and `ua`; never render it for `en` or `ka`.
- Place the banner immediately after `.topbar` and before `.subbar`; do not show it on the early-return alert-management view.
- Use these exact messages: RU `Самые красивые пейзажи Грузии — в пешей прогулке с Топором каждые выходные.`; UA `Найкрасивіші краєвиди Грузії — у пішій прогулянці з Топором щовихідних.`.
- Use CTA labels `Смотреть походы` (RU) and `Дивитися походи` (UA).
- Use `https://hikewithaxe.ge/?utm_source=getflights&utm_medium=banner&utm_campaign=hike_with_axe_cross_promo&utm_content=<ru-or-ua>` and open it in a new tab with `rel="noopener noreferrer"`.
- Store dismissal for exactly 30 days under a new local-storage key; do not reuse `vs-about-dismissed`.
- Record only `hike_with_axe_banner_clicked` with `locale`, `placement: "header_banner"`, and `campaign: "hike_with_axe_cross_promo"`.
- Do not block navigation if `window.gtag` is unavailable or throws.
- Do not add sitewide reciprocal links. The Hike With Axe article is Russian-first at `/blog/kak-kupit-bilety-vanilla-sky/` and must accurately state that GetFlights finds availability then continues visitors to official Vanilla Sky booking.
- Keep existing unrelated Hike With Axe changes in `src/lib/structuredData.ts` and `src/lib/structuredData.test.ts` unstaged.
- This GetFlights checkout has an empty `.git` directory. Do not attempt a GetFlights commit; stage and commit only explicit Hike With Axe files in its usable repository.

---

## File Structure

### GetFlights (`/home/dkeysil/code/better-vanillasky`)

- Create: `src/lib/hikeWithAxePromotion.ts` — locale eligibility, exact copy, tagged destination generation, and 30-day dismissal helpers.
- Create: `src/lib/hikeWithAxePromotion.test.ts` — pure configuration and expiry tests.
- Create: `src/components/HikeWithAxePromotion.tsx` — accessible dismissible banner that renders the supplied promotion and invokes tracking.
- Create: `src/components/HikeWithAxePromotion.test.tsx` — banner rendering, target/rel, callback, and local-dismissal tests.
- Modify: `src/lib/analytics.ts` — typed GA4 event wrapper for the banner click.
- Modify: `src/lib/analytics.test.ts` — exact GA4 event assertion and no-tag resilience assertion.
- Modify: `src/App.tsx` — render the banner only on the existing normal-public-view branch directly after the header.
- Modify: `src/App.test.tsx` — integration assertion for locale targeting and App-level CTA tracking.
- Modify: `src/styles.css` — compact responsive styling immediately following the existing about-banner styles.

### Hike With Axe (`/home/dkeysil/code/hike-with-axe`)

- Modify: `src/data/types.ts` — optional typed article external-resource list.
- Modify: `src/pages/blog/[slug].astro` — render an article-scoped resource panel without changing global navigation/footer.
- Modify: `src/pageStructure.test.ts` — source-level regression check for article resource rendering.
- Modify: `src/data/articles.ts` — add the Russian Vanilla Sky article with three useful external GetFlights links and existing internal route associations.
- Modify: `src/data/content.test.ts` — assert the new article's slug, canonical article data, exact external URLs, and internal related routes.
- Modify: `src/lib/articleStaticPaths.test.ts` — assert the new article is emitted as `/blog/kak-kupit-bilety-vanilla-sky/`.
- Modify: `src/lib/structuredData.test.ts` — assert the new article receives the correct Article URL and Russian language metadata.

## Task 1: GetFlights Promotion Configuration and GA4 Event

**Files:**
- Create: `src/lib/hikeWithAxePromotion.ts`
- Create: `src/lib/hikeWithAxePromotion.test.ts`
- Modify: `src/lib/analytics.ts`
- Modify: `src/lib/analytics.test.ts`

**Interfaces:**
- Produces `getHikeWithAxePromotion(locale: Locale): HikeWithAxePromotion | null`.
- Produces `isHikeWithAxePromotionDismissed(value: string | null, now?: number): boolean` and `HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY`.
- Produces `trackHikeWithAxeBannerClicked({ locale }: { locale: "ru" | "ua" }): void`.
- Consumes `Locale` from `src/lib/i18n.ts` and the existing safe `trackGoogleEvent` implementation.

- [ ] **Step 1: Write the failing configuration tests**

Create `src/lib/hikeWithAxePromotion.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY,
  getHikeWithAxePromotion,
  isHikeWithAxePromotionDismissed,
} from './hikeWithAxePromotion';

describe('Hike With Axe promotion', () => {
  it('targets only Russian and Ukrainian visitors with tagged home-page links', () => {
    expect(getHikeWithAxePromotion('en')).toBeNull();
    expect(getHikeWithAxePromotion('ka')).toBeNull();
    expect(getHikeWithAxePromotion('ru')).toMatchObject({
      message: 'Самые красивые пейзажи Грузии — в пешей прогулке с Топором каждые выходные.',
      cta: 'Смотреть походы',
      href: 'https://hikewithaxe.ge/?utm_source=getflights&utm_medium=banner&utm_campaign=hike_with_axe_cross_promo&utm_content=ru',
    });
    expect(getHikeWithAxePromotion('ua')).toMatchObject({
      message: 'Найкрасивіші краєвиди Грузії — у пішій прогулянці з Топором щовихідних.',
      cta: 'Дивитися походи',
      href: 'https://hikewithaxe.ge/?utm_source=getflights&utm_medium=banner&utm_campaign=hike_with_axe_cross_promo&utm_content=ua',
    });
  });

  it('keeps dismissal isolated and expires it after exactly 30 days', () => {
    const now = Date.parse('2026-07-10T12:00:00.000Z');
    expect(HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY).not.toBe('vs-about-dismissed');
    expect(isHikeWithAxePromotionDismissed(null, now)).toBe(false);
    expect(isHikeWithAxePromotionDismissed('invalid', now)).toBe(false);
    expect(isHikeWithAxePromotionDismissed(String(now - 30 * 24 * 60 * 60 * 1000 + 1), now)).toBe(true);
    expect(isHikeWithAxePromotionDismissed(String(now - 30 * 24 * 60 * 60 * 1000), now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the configuration test and verify it fails**

Run: `rtk npm test -- src/lib/hikeWithAxePromotion.test.ts`

Expected: FAIL because `./hikeWithAxePromotion` does not exist.

- [ ] **Step 3: Implement the promotion configuration**

Create `src/lib/hikeWithAxePromotion.ts`:

```ts
import type { Locale } from './i18n';

export const HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY = 'hike-with-axe-promotion-dismissed-at';
export const HIKE_WITH_AXE_PROMOTION_DISMISSAL_MS = 30 * 24 * 60 * 60 * 1000;

type PromotionLocale = Extract<Locale, 'ru' | 'ua'>;

export type HikeWithAxePromotion = {
  message: string;
  cta: string;
  dismissLabel: string;
  newTabLabel: string;
  href: string;
  locale: PromotionLocale;
};

const promotionCopy: Record<PromotionLocale, Omit<HikeWithAxePromotion, 'href' | 'locale'>> = {
  ru: {
    message: 'Самые красивые пейзажи Грузии — в пешей прогулке с Топором каждые выходные.',
    cta: 'Смотреть походы',
    dismissLabel: 'Закрыть предложение о прогулках с Топором',
    newTabLabel: 'Откроется в новой вкладке',
  },
  ua: {
    message: 'Найкрасивіші краєвиди Грузії — у пішій прогулянці з Топором щовихідних.',
    cta: 'Дивитися походи',
    dismissLabel: 'Закрити пропозицію прогулянок з Топором',
    newTabLabel: 'Відкриється в новій вкладці',
  },
};

const isPromotionLocale = (locale: Locale): locale is PromotionLocale => locale === 'ru' || locale === 'ua';

export function getHikeWithAxePromotion(locale: Locale): HikeWithAxePromotion | null {
  if (!isPromotionLocale(locale)) return null;

  return {
    ...promotionCopy[locale],
    locale,
    href: `https://hikewithaxe.ge/?utm_source=getflights&utm_medium=banner&utm_campaign=hike_with_axe_cross_promo&utm_content=${locale}`,
  };
}

export function isHikeWithAxePromotionDismissed(value: string | null, now = Date.now()) {
  const dismissedAt = Number(value);
  return Number.isFinite(dismissedAt) && dismissedAt > 0 && now - dismissedAt < HIKE_WITH_AXE_PROMOTION_DISMISSAL_MS;
}
```

- [ ] **Step 4: Add the banner analytics API and its failing assertion**

Append this test to `src/lib/analytics.test.ts` before implementation:

```ts
it('tracks a localized Hike With Axe banner click without requiring a booking handoff', () => {
  const gtag = vi.fn();
  vi.stubGlobal('gtag', gtag);

  trackHikeWithAxeBannerClicked({ locale: 'ua' });

  expect(gtag).toHaveBeenCalledWith('event', 'hike_with_axe_banner_clicked', {
    locale: 'ua',
    placement: 'header_banner',
    campaign: 'hike_with_axe_cross_promo',
  });
});
```

Change the import to `import { trackBookingHandoffStarted, trackHikeWithAxeBannerClicked } from './analytics';`, then run:

`rtk npm test -- src/lib/analytics.test.ts`

Expected: FAIL because `trackHikeWithAxeBannerClicked` is not exported.

- [ ] **Step 5: Implement the safe GA4 wrapper and re-run focused tests**

Append to `src/lib/analytics.ts`:

```ts
export function trackHikeWithAxeBannerClicked({ locale }: { locale: Extract<Locale, 'ru' | 'ua'> }) {
  trackGoogleEvent('hike_with_axe_banner_clicked', {
    locale,
    placement: 'header_banner',
    campaign: 'hike_with_axe_cross_promo',
  });
}
```

Run: `rtk npm test -- src/lib/hikeWithAxePromotion.test.ts src/lib/analytics.test.ts`

Expected: PASS with both promotion eligibility/expiry and GA4 event assertions green.

- [ ] **Step 6: Verify the GetFlights working tree without committing**

Run: `rtk git diff --check`

Expected: this checkout reports unusable Git metadata. Record that limitation; do not try to initialize or repair Git as part of this feature.

## Task 2: GetFlights Banner Component, App Placement, and Responsive Styling

**Files:**
- Create: `src/components/HikeWithAxePromotion.tsx`
- Create: `src/components/HikeWithAxePromotion.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes `getHikeWithAxePromotion`, dismissal helpers, `Locale`, and `trackHikeWithAxeBannerClicked` from Task 1.
- Produces `<HikeWithAxePromotion locale={locale} onClick={...} />`; it renders `null` for ineligible locales or a valid 30-day dismissal.

- [ ] **Step 1: Write the failing component tests**

Create `src/components/HikeWithAxePromotion.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HikeWithAxePromotion } from './HikeWithAxePromotion';
import { HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY } from '../lib/hikeWithAxePromotion';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('HikeWithAxePromotion', () => {
  it('renders the Ukrainian banner as a safe new-tab home-page link and records its click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<HikeWithAxePromotion locale="ua" onClick={onClick} />);

    const link = screen.getByRole('link', { name: /Дивитися походи/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('href', expect.stringContaining('utm_content=ua'));

    await user.click(link);
    expect(onClick).toHaveBeenCalledWith({ locale: 'ua' });
  });

  it('does not render for English and hides independently for 30 days after dismissal', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<HikeWithAxePromotion locale="en" onClick={vi.fn()} />);
    expect(screen.queryByRole('link', { name: /поход|походи/i })).not.toBeInTheDocument();

    rerender(<HikeWithAxePromotion locale="ru" onClick={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Закрыть предложение/i }));
    expect(localStorage.getItem(HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY)).toMatch(/^\d+$/);
    expect(screen.queryByRole('link', { name: 'Смотреть походы' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the component test and verify it fails**

Run: `rtk npm test -- src/components/HikeWithAxePromotion.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the banner component**

Create `src/components/HikeWithAxePromotion.tsx`:

```tsx
import { ExternalLink, X } from 'lucide-react';
import { useState } from 'react';
import type { Locale } from '../lib/i18n';
import {
  getHikeWithAxePromotion,
  HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY,
  isHikeWithAxePromotionDismissed,
} from '../lib/hikeWithAxePromotion';

type Props = {
  locale: Locale;
  onClick: (input: { locale: 'ru' | 'ua' }) => void;
};

const readDismissal = () => {
  try {
    return isHikeWithAxePromotionDismissed(localStorage.getItem(HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY));
  } catch {
    return false;
  }
};

export function HikeWithAxePromotion({ locale, onClick }: Props) {
  const promotion = getHikeWithAxePromotion(locale);
  const [dismissed, setDismissed] = useState(readDismissal);

  if (!promotion || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(HIKE_WITH_AXE_PROMOTION_DISMISSAL_KEY, String(Date.now()));
    } catch {
      // The in-memory state still hides the banner for this rendered session.
    }
    setDismissed(true);
  };

  return (
    <aside className="hike-with-axe-promotion" aria-label={promotion.cta}>
      <p>{promotion.message}</p>
      <a href={promotion.href} target="_blank" rel="noopener noreferrer" onClick={() => onClick({ locale: promotion.locale })}>
        {promotion.cta}
        <ExternalLink aria-hidden="true" size={15} />
        <span className="sr-only">{promotion.newTabLabel}</span>
      </a>
      <button className="hike-with-axe-promotion-close" type="button" onClick={dismiss} aria-label={promotion.dismissLabel}>
        <X aria-hidden="true" size={16} />
      </button>
    </aside>
  );
}
```

- [ ] **Step 4: Integrate it only into the normal App branch**

In `src/App.tsx`, add imports:

```ts
import { HikeWithAxePromotion } from './components/HikeWithAxePromotion';
import { trackBookingHandoffStarted, trackHikeWithAxeBannerClicked } from './lib/analytics';
```

Immediately after the normal-view `</header>` (the header below the existing `showManagePage` early return) insert:

```tsx
      <HikeWithAxePromotion locale={locale} onClick={trackHikeWithAxeBannerClicked} />
```

Do not add it to the `showManagePage` return branch.

- [ ] **Step 5: Add banner styles and App integration assertions**

Insert these styles after the existing `.about-close:hover` rule in `src/styles.css`:

```css
.hike-with-axe-promotion {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 11px 52px 11px 24px;
  background: #f5eee3;
  border-bottom: 1px solid #e4cbb4;
  color: var(--ink-2);
  font-size: 14px;
  line-height: 1.4;
  text-align: center;
}

.hike-with-axe-promotion p { margin: 0; max-width: 70ch; }
.hike-with-axe-promotion a { display: inline-flex; align-items: center; gap: 5px; color: var(--sky-ink); font-weight: 800; text-underline-offset: 3px; }
.hike-with-axe-promotion-close { position: absolute; top: 50%; right: 14px; display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; transform: translateY(-50%); border: 0; border-radius: 7px; background: transparent; color: var(--muted); }
.hike-with-axe-promotion-close:hover { background: rgba(20, 32, 43, 0.08); color: var(--ink); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@media (max-width: 620px) {
  .hike-with-axe-promotion { align-items: flex-start; flex-direction: column; gap: 6px; padding: 11px 46px 11px 18px; text-align: left; }
  .hike-with-axe-promotion-close { top: 12px; transform: none; }
}
```

Add an `App.test.tsx` case that loads `/ru/`, stubs `gtag`, asserts the RU CTA exists, clicks it, and expects `gtag` to receive the exact banner event properties. In the existing English localization case, assert `queryByRole('link', { name: /поход/i })` is null.

- [ ] **Step 6: Run focused and full GetFlights verification**

Run:

```bash
rtk npm test -- src/components/HikeWithAxePromotion.test.tsx src/lib/hikeWithAxePromotion.test.ts src/lib/analytics.test.ts src/App.test.tsx
rtk npm test
rtk npm run build
```

Expected: all tests pass; build regenerates static SEO output without changing the set of locales or route pages.

## Task 3: Hike With Axe Article External-Resource Rendering

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/pages/blog/[slug].astro`
- Modify: `src/pageStructure.test.ts`

**Interfaces:**
- Produces optional `Article.externalLinks?: ArticleExternalLink[]`.
- `ArticleExternalLink` has exact `href`, Russian `label`, and Russian `description` fields.
- The existing static-path and JSON-LD code continues to consume `Article` unchanged.

- [ ] **Step 1: Write the failing renderer regression test**

Add this test to `src/pageStructure.test.ts`:

```ts
it('renders article-scoped external resources without putting partner links in global navigation', () => {
  const articlePage = source('./pages/blog/[slug].astro');
  const header = source('./components/SiteHeader.astro');
  const footer = source('./components/SiteFooter.astro');

  expect(articlePage).toContain('article.externalLinks');
  expect(articlePage).toContain('article-links');
  expect(articlePage).toContain('link.href');
  expect(header).not.toContain('getflights.ge');
  expect(footer).not.toContain('getflights.ge');
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `rtk npm --prefix /home/dkeysil/code/hike-with-axe test -- src/pageStructure.test.ts`

Expected: FAIL because the article page does not reference `externalLinks`.

- [ ] **Step 3: Add the typed resource model**

In `src/data/types.ts`, insert before `export interface Article`:

```ts
export interface ArticleExternalLink {
  href: string;
  label: LocalizedText;
  description: LocalizedText;
}
```

Add this property inside `Article`:

```ts
  externalLinks?: ArticleExternalLink[];
```

- [ ] **Step 4: Render article-scoped resources**

In `src/pages/blog/[slug].astro`, insert this after the existing `<section class="body">...</section>` and before the Telegram CTA:

```astro
      {article.externalLinks?.length ? (
        <aside class="article-links" aria-labelledby="article-links-heading">
          <h2 id="article-links-heading">Проверить билеты и маршруты</h2>
          <ul>
            {article.externalLinks.map((link) => (
              <li>
                <a href={link.href}>{link.label.ru}</a>
                <span>{link.description.ru}</span>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
```

Append the following styles inside the existing `<style>` block:

```css
.article-links { display: grid; gap: 12px; margin: 30px 0; padding: 20px; border: 1px solid var(--color-line); border-radius: var(--radius-card); background: var(--color-surface); }
.article-links h2, .article-links ul, .article-links li, .article-links span { margin: 0; }
.article-links ul { display: grid; gap: 12px; padding: 0; list-style: none; }
.article-links li { display: grid; gap: 3px; }
.article-links a { width: fit-content; color: var(--color-accent-dark); font-weight: 900; text-underline-offset: 4px; }
.article-links span { color: var(--color-muted); }
```

- [ ] **Step 5: Run the renderer regression test**

Run: `rtk npm --prefix /home/dkeysil/code/hike-with-axe test -- src/pageStructure.test.ts`

Expected: PASS, proving resources render only in article content and neither global navigation nor footer contains GetFlights.

## Task 4: Hike With Axe Vanilla Sky Article and SEO Regression Coverage

**Files:**
- Modify: `src/data/articles.ts`
- Modify: `src/data/content.test.ts`
- Modify: `src/lib/articleStaticPaths.test.ts`
- Modify: `src/lib/structuredData.test.ts`

**Interfaces:**
- Consumes the `externalLinks` type and renderer from Task 3.
- Produces the statically generated canonical page `/blog/kak-kupit-bilety-vanilla-sky/` and its standard Article JSON-LD.

- [ ] **Step 1: Write failing data, path, and schema tests**

Add to `src/data/content.test.ts`:

```ts
it('publishes a useful Russian Vanilla Sky ticket guide with editorial GetFlights resources', () => {
  const article = articles.find((candidate) => candidate.slug === 'kak-kupit-bilety-vanilla-sky');

  expect(article).toMatchObject({
    title: { ru: 'Как удобно купить билеты на внутренние рейсы Vanilla Sky в Грузии' },
    relatedRoutes: ['juta', 'truso-valley', 'abudelauri-lakes'],
  });
  expect(article?.externalLinks).toEqual([
    expect.objectContaining({ href: 'https://getflights.ge/ru/' }),
    expect.objectContaining({ href: 'https://getflights.ge/ru/flights/tbilisi-mestia/' }),
    expect.objectContaining({ href: 'https://getflights.ge/ru/flights/mestia-tbilisi/' }),
  ]);
  expect(article?.body.flatMap((section) => section.paragraphs).join(' ')).toContain('официальный сайт Vanilla Sky');
});
```

Add to `src/lib/articleStaticPaths.test.ts`:

```ts
it('includes the Vanilla Sky ticket guide in static article paths', () => {
  expect(getArticleStaticPaths()).toContainEqual(
    expect.objectContaining({ params: { slug: 'kak-kupit-bilety-vanilla-sky' } }),
  );
});
```

Add to `src/lib/structuredData.test.ts`:

```ts
it('builds canonical Russian Article schema for the Vanilla Sky ticket guide', () => {
  const article = articles.find((candidate) => candidate.slug === 'kak-kupit-bilety-vanilla-sky');
  if (!article) throw new Error('Vanilla Sky ticket guide fixture must exist.');

  expect(buildArticleJsonLd(article, siteConfig)).toMatchObject({
    '@type': 'Article',
    inLanguage: 'ru',
    mainEntityOfPage: 'https://hikewithaxe.ge/blog/kak-kupit-bilety-vanilla-sky/',
  });
});
```

- [ ] **Step 2: Run the targeted tests and verify they fail**

Run:

```bash
rtk npm --prefix /home/dkeysil/code/hike-with-axe test -- src/data/content.test.ts src/lib/articleStaticPaths.test.ts src/lib/structuredData.test.ts
```

Expected: FAIL because the `kak-kupit-bilety-vanilla-sky` article does not yet exist.

- [ ] **Step 3: Add the full article data**

Append this object to the `articles` array in `src/data/articles.ts`:

```ts
  {
    slug: 'kak-kupit-bilety-vanilla-sky',
    title: ruText('Как удобно купить билеты на внутренние рейсы Vanilla Sky в Грузии'),
    description: ruText('Когда внутренний перелет экономит дорогу по Грузии, где проверить даты Vanilla Sky и почему покупать билет нужно на официальном сайте перевозчика.'),
    publishedAt: '2026-07-10',
    updatedAt: '2026-07-10',
    tags: [ruText('Vanilla Sky'), ruText('перелеты по Грузии'), ruText('планирование поездки')],
    relatedRoutes: ['juta', 'truso-valley', 'abudelauri-lakes'],
    externalLinks: [
      {
        href: 'https://getflights.ge/ru/',
        label: ruText('Проверить доступные даты Vanilla Sky на GetFlights'),
        description: ruText('Сервис показывает дни, когда рейсы действительно есть, а для оплаты переводит на официальный сайт перевозчика.'),
      },
      {
        href: 'https://getflights.ge/ru/flights/tbilisi-mestia/',
        label: ruText('Рейс Тбилиси — Местия'),
        description: ruText('Страница с доступными датами для маршрута в Сванетию, если этот перелет подходит вашему самостоятельному маршруту.'),
      },
      {
        href: 'https://getflights.ge/ru/flights/mestia-tbilisi/',
        label: ruText('Рейс Местия — Тбилиси'),
        description: ruText('Обратный внутренний перелет для планирования возвращения из Сванетии в Тбилиси.'),
      },
    ],
    body: [
      section('Когда внутренний рейс действительно удобен', [
        'Внутренние рейсы Vanilla Sky полезны не для каждого похода из Тбилиси, но иногда они заметно сокращают дорогу по Грузии. Особенно это касается самостоятельных поездок в удаленные горные регионы, когда хочется оставить больше времени на маршрут, прогулки и отдых, а не проводить целый день в машине.',
        'Для обычной прогулки с Топором транспорт и логистика уже описаны в актуальном анонсе: группа выезжает из Тбилиси вместе. Перелет стоит рассматривать отдельно, если вы строите собственный маршрут по стране до или после похода, например добавляете Сванетию к поездке.',
        'Расписание небольших региональных авиалиний меняется, а билеты на конкретные дни могут появляться неравномерно. Поэтому лучше сначала проверить реальную доступность даты, а потом уже бронировать жилье, трансфер или строить плотный маршрут вокруг одного перелета.',
      ]),
      section('Как проверить даты и купить билет без лишней путаницы', [
        'GetFlights помогает увидеть, в какие дни Vanilla Sky действительно выполняет рейсы и какие тарифы доступны на выбранном направлении. Это удобно как ориентир: вместо того чтобы вручную перебирать даты на сайте перевозчика, можно сначала выбрать маршрут и день с доступным перелетом.',
        'Когда подходящий вариант найден, покупка и оплата происходят на официальном сайте Vanilla Sky. Это важно: GetFlights не является продавцом билетов и не заменяет перевозчика, а только делает живое расписание и переход к бронированию понятнее.',
        'Перед оплатой еще раз сверяйте дату, направление, багаж и условия возврата на странице перевозчика. На горных направлениях планы могут зависеть от погоды, а на всем маршруте по Грузии полезно оставлять запас времени, а не ставить перелет впритык к важной пересадке.',
      ]),
      section('Как сочетать перелеты и прогулки по Грузии', [
        'Если вы идете на прогулку с Топором, начните с ближайшей даты и условий конкретного анонса. Маршруты вроде Джуты, Трусо и Цветных озер Абуделаури организованы с выездом из Тбилиси, поэтому отдельный внутренний авиабилет для участия в такой группе обычно не нужен.',
        'Внутренние перелеты полезнее как часть самостоятельного продолжения путешествия: например, после городских дней в Тбилиси отправиться в другой регион и вернуться обратно без длинной дороги. Сначала проверьте дату на GetFlights, затем выбирайте жилье и наземные трансферы с запасом.',
        'Не пытайтесь превратить один красивый рейс в обещание идеального путешествия. В горах важнее реальная погода, доступная дорога и запасной план, а самая надежная последовательность проста: проверить доступность, купить на официальном сайте Vanilla Sky и подтвердить все локальные детали отдельно.',
      ]),
    ],
  },
```

- [ ] **Step 4: Run all Hike With Axe validation**

Run:

```bash
rtk npm --prefix /home/dkeysil/code/hike-with-axe test -- src/data/content.test.ts src/lib/articleStaticPaths.test.ts src/lib/structuredData.test.ts src/pageStructure.test.ts
rtk npm --prefix /home/dkeysil/code/hike-with-axe run verify
```

Expected: PASS. The production build must include `dist/blog/kak-kupit-bilety-vanilla-sky/index.html` with the canonical URL and all three GetFlights links.

- [ ] **Step 5: Commit only the intended Hike With Axe changes**

Run from `/home/dkeysil/code/hike-with-axe`:

```bash
rtk git diff --check
rtk git add src/data/types.ts src/data/articles.ts src/data/content.test.ts src/lib/articleStaticPaths.test.ts src/lib/structuredData.test.ts src/pages/blog/[slug].astro src/pageStructure.test.ts
rtk git commit -m "feat: add Vanilla Sky ticket guide"
```

Expected: the commit contains only the seven listed article/resource files; it does not stage pre-existing `src/lib/structuredData.ts` or `src/lib/structuredData.test.ts` changes.

## Task 5: Release Verification and 30-Day Measurement Setup

**Files:**
- Modify only as needed to correct verified defects from Tasks 1–4; do not expand scope.

**Interfaces:**
- Consumes the deployed RU/UA banner event and the static Hike With Axe article.
- Produces a recorded experiment start timestamp and a locale-by-locale outbound-click baseline in GetFlights GA4.

- [ ] **Step 1: Run final local release gates**

Run:

```bash
cd /home/dkeysil/code/better-vanillasky && rtk npm test && rtk npm run build
cd /home/dkeysil/code/hike-with-axe && rtk npm run verify
```

Expected: all commands exit 0. Do not deploy while either repository has a failing relevant test.

- [ ] **Step 2: Verify the GetFlights production interaction after its normal Pages deployment**

For `/ru/` and `/ua/`, confirm in a browser:

- the banner sits directly below the sticky header and above the ordinary page content;
- the exact locale copy and CTA appear;
- CTA URL contains the correct language-specific `utm_content` and opens Hike With Axe in a new tab;
- dismissal hides only this banner and persists after reload;
- a GA4 DebugView event named `hike_with_axe_banner_clicked` contains `locale`, `placement=header_banner`, and `campaign=hike_with_axe_cross_promo`.

For `/en/` and `/ka/`, confirm that no Hike With Axe banner is rendered.

- [ ] **Step 3: Verify Hike With Axe production after its normal Pages deployment**

Open `https://hikewithaxe.ge/blog/kak-kupit-bilety-vanilla-sky/` and confirm:

- page title, description, canonical, and Article JSON-LD describe the Russian ticket guide;
- the article clearly says GetFlights finds availability and official Vanilla Sky performs purchase;
- the three external links point exactly to the Russian GetFlights home, Tbilisi–Mestia, and Mestia–Tbilisi pages;
- article-scoped links render above the normal Telegram CTA; global header/footer remain unchanged.

- [ ] **Step 4: Record the experiment baseline and review date**

On release day, record UTC start time in the deployment/release note. In GetFlights GA4, create or save an exploration filtered to `event_name = hike_with_axe_banner_clicked`, with rows `locale` and values `Event count`. Review after 30 full days, comparing RU versus UA click counts before deciding to retain, rewrite, or replace the banner with destination-led promotion.

## Plan Self-Review

- Spec coverage: Tasks 1–2 implement the RU/UA banner, exact copy, tagged home-page destination, 30-day dismissal, GA4 click event, resilience, accessibility, placement, and responsive verification. Tasks 3–4 implement the useful Russian reciprocal article, canonical static route, contextual external links, internal route associations, and no-sitewide-link constraint. Task 5 covers release checks and the exact 30-day click metric.
- Placeholder scan: no unresolved markers, unspecified copy, unnamed interfaces, or generic test steps remain.
- Type consistency: the `HikeWithAxePromotion` locale remains `ru | ua` from configuration through component callback to analytics; `ArticleExternalLink` is optional so existing article and JSON-LD consumers remain valid.

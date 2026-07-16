# GetFlights Hike With Axe Banner Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Hike With Axe promotion as a content-width rounded Truso image card while preserving its existing localized tracking, link, and dismissal behavior.

**Architecture:** Keep `src/lib/hikeWithAxePromotion.ts` as the single source for eligibility, copy, destination, and dismissal. Expand only `HikeWithAxePromotion` markup and its scoped CSS; it consumes the remote public Truso image from Hike With Axe, so no new binary asset is added to GetFlights.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Vite CSS.

## Global Constraints

- Render only for `ru` and `ua`; preserve exact copy, CTA, UTM URL, safe new-tab behavior, GA4 event, 30-day dismissal key, and alert-management exclusion.
- Use `https://hikewithaxe.ge/images/routes/truso-valley/hero.webp` with an informative localized alt text.
- Desktop card: max-width `1060px`, fixed `180px` height, 16px radius, right image panel at `45%` width, no heavy shadow.
- Mobile card: 16px page gutters, maximum total card height `245px`, 96px image strip, text max three lines, CTA aligned lower right.
- Do not add or copy a raster asset into this repository.
- This checkout has unusable Git metadata; do not attempt a commit or Git repair.

---

## File Structure

- Modify: `src/components/HikeWithAxePromotion.tsx` — add semantic image panel and card-content wrappers while retaining existing click/dismiss interface.
- Modify: `src/components/HikeWithAxePromotion.test.tsx` — assert the exact external image source and localized alt text alongside current CTA/dismiss behavior.
- Modify: `src/styles.css` — replace full-width strip rules with the desktop and mobile card layout; retain the responsive route-rail rule.
- Modify: `src/responsive-layout.test.ts` — assert the card container and mobile height/image constraints from source CSS.

## Task 1: Responsive Truso Promotion Card

**Files:**
- Modify: `src/components/HikeWithAxePromotion.tsx`
- Modify: `src/components/HikeWithAxePromotion.test.tsx`
- Modify: `src/styles.css`
- Modify: `src/responsive-layout.test.ts`

**Interfaces:**
- Consumes unchanged `Props { locale: Locale; onClick: (input: { locale: 'ru' | 'ua' }) => void }`.
- Produces the same CTA, close button, and click callback as before, with a new `<img>` sourced from Hike With Axe.

- [ ] **Step 1: Write failing image and responsive-structure tests**

Append to `src/components/HikeWithAxePromotion.test.tsx`:

```tsx
it('renders the localized Truso image without changing the promotion destination', () => {
  render(<HikeWithAxePromotion locale="ru" onClick={vi.fn()} />);

  expect(screen.getByRole('img', { name: 'Долина Трусо и горы в Грузии' })).toHaveAttribute(
    'src',
    'https://hikewithaxe.ge/images/routes/truso-valley/hero.webp',
  );
  expect(screen.getByRole('link', { name: /Смотреть походы/i })).toHaveAttribute(
    'href',
    expect.stringContaining('utm_content=ru'),
  );
});
```

Append to `src/responsive-layout.test.ts`:

```ts
it('keeps the Hike With Axe promotion as a bounded desktop card and compact mobile card', () => {
  const styles = source('./styles.css');

  expect(styles).toMatch(/\.hike-with-axe-promotion\s*{[^}]*max-width:\s*1060px;/s);
  expect(styles).toMatch(/\.hike-with-axe-promotion__image\s*{[^}]*flex-basis:\s*45%;/s);
  expect(styles).toMatch(/@media \(max-width: 620px\)\s*{[\s\S]*\.hike-with-axe-promotion\s*{[^}]*max-height:\s*245px;/s);
  expect(styles).toMatch(/@media \(max-width: 620px\)\s*{[\s\S]*\.hike-with-axe-promotion__image\s*{[^}]*height:\s*96px;/s);
});
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
rtk npm test -- src/components/HikeWithAxePromotion.test.tsx src/responsive-layout.test.ts
```

Expected: FAIL because no Truso image element or card CSS selectors exist.

- [ ] **Step 3: Add the semantic image and card structure**

Replace the existing `return` block in `src/components/HikeWithAxePromotion.tsx` with:

```tsx
  return (
    <aside className="hike-with-axe-promotion" aria-label={promotion.cta}>
      <div className="hike-with-axe-promotion__content">
        <p>{promotion.message}</p>
        <a href={promotion.href} target="_blank" rel="noopener noreferrer" onClick={() => onClick({ locale: promotion.locale })}>
          {promotion.cta}
          <ExternalLink aria-hidden="true" size={15} />
          <span className="sr-only">{promotion.newTabLabel}</span>
        </a>
      </div>
      <div className="hike-with-axe-promotion__image">
        <img
          src="https://hikewithaxe.ge/images/routes/truso-valley/hero.webp"
          alt={promotion.locale === 'ru' ? 'Долина Трусо и горы в Грузии' : 'Долина Трусо та гори в Грузії'}
        />
      </div>
      <button className="hike-with-axe-promotion-close" type="button" onClick={dismiss} aria-label={promotion.dismissLabel}>
        <X aria-hidden="true" size={16} />
      </button>
    </aside>
  );
```

- [ ] **Step 4: Replace the banner CSS with the responsive card rules**

Replace the current `.hike-with-axe-promotion` through `.hike-with-axe-promotion-close:hover` rules in `src/styles.css` with:

```css
.hike-with-axe-promotion {
  position: relative;
  display: flex;
  width: min(1060px, calc(100% - 48px));
  max-width: 1060px;
  height: 180px;
  margin: 18px auto 20px;
  overflow: hidden;
  border: 1px solid #e4cbb4;
  border-radius: 16px;
  background: #f5eee3;
  color: var(--ink-2);
}

.hike-with-axe-promotion__content { display: flex; flex: 1 1 55%; flex-direction: column; align-items: flex-start; justify-content: center; gap: 16px; padding: 26px 34px; }
.hike-with-axe-promotion__content p { max-width: 38ch; margin: 0; font-size: clamp(17px, 2vw, 24px); font-weight: 700; line-height: 1.25; }
.hike-with-axe-promotion__content a { display: inline-flex; align-items: center; gap: 5px; color: var(--sky-ink); font-weight: 800; text-underline-offset: 3px; }
.hike-with-axe-promotion__image { position: relative; flex: 0 0 45%; overflow: hidden; }
.hike-with-axe-promotion__image::before { position: absolute; z-index: 1; inset: 0; background: linear-gradient(90deg, #f5eee3 0%, transparent 24%); content: ''; pointer-events: none; }
.hike-with-axe-promotion__image img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center; }
.hike-with-axe-promotion-close { position: absolute; z-index: 2; top: 12px; right: 12px; display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; border: 0; border-radius: 50%; background: rgba(255, 255, 255, 0.88); color: var(--ink-2); }
.hike-with-axe-promotion-close:hover { background: #fff; color: var(--ink); }

@media (max-width: 620px) {
  .hike-with-axe-promotion { display: grid; width: calc(100% - 32px); max-height: 245px; min-height: 0; margin: 12px auto 16px; grid-template-rows: 96px minmax(0, 1fr); }
  .hike-with-axe-promotion__image { grid-row: 1; height: 96px; flex-basis: auto; }
  .hike-with-axe-promotion__image::before { background: none; }
  .hike-with-axe-promotion__content { grid-row: 2; min-height: 0; padding: 14px 18px 16px; gap: 8px; }
  .hike-with-axe-promotion__content p { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; font-size: 16px; line-height: 1.25; }
  .hike-with-axe-promotion__content a { align-self: flex-end; }
  .hike-with-axe-promotion-close { top: 8px; right: 8px; }
}
```

At desktop heights of 720px or less, set `.hike-with-axe-promotion ~ .pane .routes-rail` to `max-height: calc(100vh - 520px)` with `overflow-y: auto`. This user-approved short-landscape behavior preserves the visible card and keeps route selection available without horizontal overflow; the calendar and selected-day panel remain reachable through normal page scrolling.

- [ ] **Step 5: Run focused tests and the full verification suite**

Run:

```bash
rtk npm test -- src/components/HikeWithAxePromotion.test.tsx src/responsive-layout.test.ts src/App.test.tsx
rtk npm test
rtk npm run build
```

Expected: focused tests and the full suite pass; production build completes successfully.

- [ ] **Step 6: Verify rendered desktop and mobile output before deployment**

Run a local Vite preview and inspect `/ru/` and `/ua/` at desktop width and 390px width. Confirm the desktop image remains on the right, the mobile image is 96px above the text, and the close/CTA controls retain their existing behavior.

## Plan Self-Review

- Spec coverage: the task covers all desktop and mobile layout rules, remote image source, accessibility, tracking preservation, and regression verification.
- Placeholder scan: no unresolved markers or unspecified values remain.
- Type consistency: `Props`, `promotion.locale`, CTA callback, and dismissal helper contracts remain unchanged.

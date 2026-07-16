# Ticket Alert Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build email alert subscriptions for Vanilla Sky route/date ranges, hidden behind a frontend-only flag until an email provider is ready.

**Architecture:** Keep alert data and alert APIs in `workers/vs-cache`, because that Worker already owns `/api/*`, availability refresh, cron, and the canonical cached flight state. Add a focused alert domain module, alert storage module, alert email module, API handlers, scheduled evaluation, and React UI gated by `VITE_ALERTS_ENABLED`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Cloudflare Workers, D1-compatible SQL binding, Worker email-provider abstraction.

---

## File Structure

- Create `workers/vs-cache/src/alerts-domain.js`: pure validation, date-range, token-hashing, matching-date, daily-send, and default-month helpers.
- Create `workers/vs-cache/src/alerts-domain.test.js`: pure behavior tests.
- Create `workers/vs-cache/src/alerts-store.js`: D1 repository for subscriptions, tokens, and alert logs.
- Create `workers/vs-cache/src/alerts-store.test.js`: repository tests using a fake D1 prepared-statement adapter.
- Create `workers/vs-cache/src/alerts-email.js`: provider abstraction for confirmation, manage-link, and alert emails.
- Create `workers/vs-cache/src/alerts-email.test.js`: email payload and provider-unavailable tests.
- Create `workers/vs-cache/src/alerts-handlers.js`: `/api/alerts/*` HTTP handlers.
- Create `workers/vs-cache/src/alerts-handlers.test.js`: API tests for subscribe, confirm, manage-link, manage-list, and unsubscribe.
- Create `workers/vs-cache/src/alerts-scheduler.js`: cron evaluation that sends daily alerts while matching dates exist.
- Create `workers/vs-cache/src/alerts-scheduler.test.js`: scheduled alert tests.
- Modify `workers/vs-cache/src/handlers.js`: route `/api/alerts/*` requests to alert handlers.
- Modify `workers/vs-cache/src/index.js`: run alert evaluation after availability/preload cron work.
- Create `workers/vs-cache/migrations/0001_alert_subscriptions.sql`: D1 schema.
- Create `src/lib/alerts.ts`: frontend alert API client and `VITE_ALERTS_ENABLED` helpers.
- Create `src/lib/alerts.test.ts`: frontend helper/client tests.
- Modify `src/lib/i18n.ts`: alert and manage-alert translations for `en`, `ru`, `ua`, `ka`.
- Modify `src/lib/backend.ts` only if shared route/range query helpers belong there after implementation; otherwise leave untouched.
- Modify `src/App.tsx`: gated alert panel, query preselection, manage page route, unsubscribe actions.
- Modify `src/App.test.tsx`: UI tests for disabled flag, subscribe flow, already-available message, and manage page.
- Modify `vite.config.test.ts`: add frontend flag helper tests if needed.
- Keep `wrangler.jsonc` and `workers/vs-cache/wrangler.jsonc` free of fake D1/email IDs. The backend must fail closed when required bindings are missing.

Because this checkout has no usable Git metadata, all commit steps are documentation-only and must be reported as skipped.

---

### Task 1: Alert Domain Helpers

**Files:**
- Create: `workers/vs-cache/src/alerts-domain.js`
- Create: `workers/vs-cache/src/alerts-domain.test.js`

- [ ] **Step 1: Write failing domain tests**

Create `workers/vs-cache/src/alerts-domain.test.js` with tests for:

```js
import { describe, expect, it } from 'vitest';
import {
  alertProductDay,
  defaultAlertRange,
  findMatchingDates,
  hashAlertToken,
  normalizeAlertSubscriptionInput,
  shouldSendDailyAlert,
} from './alerts-domain.js';

describe('alert domain helpers', () => {
  it('suggests the current month during the first week and next month afterward', () => {
    expect(defaultAlertRange(new Date('2026-07-05T12:00:00.000Z'))).toEqual({
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
    });
    expect(defaultAlertRange(new Date('2026-07-08T12:00:00.000Z'))).toEqual({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });
  });

  it('normalizes valid subscription input and rejects invalid route, dates, range, and locale', () => {
    expect(normalizeAlertSubscriptionInput({
      email: ' User@Example.COM ',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'ua',
    })).toMatchObject({
      email: 'user@example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'ua',
    });
    expect(normalizeAlertSubscriptionInput({ email: 'bad', fromId: '7', toId: '4', dateFrom: '2026-08-01', dateTo: '2026-08-31', locale: 'en' })).toBeNull();
    expect(normalizeAlertSubscriptionInput({ email: 'a@example.com', fromId: '7', toId: '7', dateFrom: '2026-08-01', dateTo: '2026-08-31', locale: 'en' })).toBeNull();
    expect(normalizeAlertSubscriptionInput({ email: 'a@example.com', fromId: '7', toId: '4', dateFrom: '2026-08-31', dateTo: '2026-08-01', locale: 'en' })).toBeNull();
    expect(normalizeAlertSubscriptionInput({ email: 'a@example.com', fromId: '7', toId: '4', dateFrom: '2026-08-01', dateTo: '2026-11-15', locale: 'en' })).toBeNull();
    expect(normalizeAlertSubscriptionInput({ email: 'a@example.com', fromId: '7', toId: '4', dateFrom: '2026-08-01', dateTo: '2026-08-31', locale: 'de' })).toBeNull();
  });

  it('finds matching dates inside the subscription range', () => {
    expect(findMatchingDates({
      availability: { '7:4': { outbound: ['2026-07-31', '2026-08-01', '2026-08-15', '2026-09-01'] } },
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    })).toEqual(['2026-08-01', '2026-08-15']);
  });

  it('uses Asia/Tbilisi as the product day and gates duplicate daily sends', () => {
    expect(alertProductDay(new Date('2026-07-01T20:30:00.000Z'))).toBe('2026-07-02');
    expect(shouldSendDailyAlert({ lastAlertSentOn: null, productDay: '2026-07-02', matchingDates: ['2026-08-01'] })).toBe(true);
    expect(shouldSendDailyAlert({ lastAlertSentOn: '2026-07-02', productDay: '2026-07-02', matchingDates: ['2026-08-01'] })).toBe(false);
    expect(shouldSendDailyAlert({ lastAlertSentOn: '2026-07-01', productDay: '2026-07-02', matchingDates: [] })).toBe(false);
  });

  it('hashes tokens without returning the raw token', async () => {
    const hash = await hashAlertToken('secret-token');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain('secret-token');
  });
});
```

- [ ] **Step 2: Verify red**

Run: `npm test -- workers/vs-cache/src/alerts-domain.test.js`

Expected: FAIL because `workers/vs-cache/src/alerts-domain.js` does not exist.

- [ ] **Step 3: Implement domain helpers**

Create `workers/vs-cache/src/alerts-domain.js` exporting the functions used by the tests. Use `crypto.subtle.digest('SHA-256', ...)` for `hashAlertToken`, `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi', ... })` for product days, known city ids `1,2,4,5,6,7`, supported locales `en,ru,ua,ka`, and max range length of 90 days inclusive.

- [ ] **Step 4: Verify green**

Run: `npm test -- workers/vs-cache/src/alerts-domain.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

Skip commit and report: Git metadata is unavailable in this checkout.

---

### Task 2: D1 Alert Store

**Files:**
- Create: `workers/vs-cache/migrations/0001_alert_subscriptions.sql`
- Create: `workers/vs-cache/src/alerts-store.js`
- Create: `workers/vs-cache/src/alerts-store.test.js`

- [ ] **Step 1: Write failing store tests**

Create tests that use a small fake D1 adapter with `prepare(sql).bind(...).first()`, `all()`, and `run()` backed by arrays. Cover:

- upserting the same `email/fromId/toId/dateFrom/dateTo` reuses one subscription id;
- confirmation token creation stores only a hash and expires;
- confirming a token marks the subscription active and consumes the token;
- manage token lookup returns subscriptions by normalized email;
- unsubscribe marks one subscription `unsubscribed`;
- recording a successful alert updates `last_alert_sent_on` and inserts a send log.

- [ ] **Step 2: Verify red**

Run: `npm test -- workers/vs-cache/src/alerts-store.test.js`

Expected: FAIL because `alerts-store.js` does not exist.

- [ ] **Step 3: Add D1 migration**

Create `workers/vs-cache/migrations/0001_alert_subscriptions.sql` with:

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  locale TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'unsubscribed')),
  confirmed_at TEXT,
  unsubscribed_at TEXT,
  last_alert_sent_on TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (email, from_id, to_id, date_from, date_to)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions (email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status);

CREATE TABLE IF NOT EXISTS subscription_tokens (
  token_hash TEXT PRIMARY KEY,
  subscription_id TEXT,
  email TEXT,
  purpose TEXT NOT NULL CHECK (purpose IN ('confirm', 'manage')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscription_tokens_subscription_id ON subscription_tokens (subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_tokens_email ON subscription_tokens (email);

CREATE TABLE IF NOT EXISTS alert_send_log (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  sent_on TEXT NOT NULL,
  matching_dates_json TEXT NOT NULL,
  provider_status TEXT NOT NULL,
  error_summary TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_send_log_subscription_day
  ON alert_send_log (subscription_id, sent_on);
```

- [ ] **Step 4: Implement store**

Create `alerts-store.js` with exported functions:

- `createAlertStore(db, options = {})`
- `assertAlertDb(db)`
- store methods `upsertSubscription(input)`, `createToken({ subscriptionId, email, purpose, tokenHash, expiresAt })`, `confirmSubscriptionByToken(tokenHash)`, `consumeManageToken(tokenHash)`, `listSubscriptionsForEmail(email)`, `unsubscribeSubscription({ id, email })`, `listActiveSubscriptions()`, `recordAlertSend({ subscriptionId, sentOn, matchingDates, providerStatus, errorSummary })`, `deleteExpiredPending(cutoffIso)`

Use D1 prepared statements only. Throw a clear `AlertStoreUnavailableError` when `db` is missing.

- [ ] **Step 5: Verify green**

Run: `npm test -- workers/vs-cache/src/alerts-store.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

Skip commit and report: Git metadata is unavailable in this checkout.

---

### Task 3: Alert Email Provider

**Files:**
- Create: `workers/vs-cache/src/alerts-email.js`
- Create: `workers/vs-cache/src/alerts-email.test.js`

- [ ] **Step 1: Write failing email tests**

Cover:

- missing provider throws `AlertEmailUnavailableError`;
- confirmation email includes confirm URL and text/html bodies;
- manage-link email includes manage URL;
- daily alert email includes route, watched range, matching dates, GetFlights URL with `from`, `to`, `dateFrom`, `dateTo`, and manage link;
- provider is called with sender `{ email: 'alerts@getflights.ge', name: 'GetFlights.ge' }` by default.

- [ ] **Step 2: Verify red**

Run: `npm test -- workers/vs-cache/src/alerts-email.test.js`

Expected: FAIL because `alerts-email.js` does not exist.

- [ ] **Step 3: Implement email module**

Create `createAlertEmailer(env, options = {})` with methods:

- `sendConfirmation({ to, locale, routeLabel, confirmUrl })`
- `sendManageLink({ to, locale, manageUrl })`
- `sendTicketAlert({ to, locale, routeLabel, dateFrom, dateTo, matchingDates, appUrl, manageUrl })`

Support providers in this order:

1. `env.EMAIL.send(payload)` if present;
2. missing provider throws `AlertEmailUnavailableError`.

Include both `text` and `html`.

- [ ] **Step 4: Verify green**

Run: `npm test -- workers/vs-cache/src/alerts-email.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

Skip commit and report: Git metadata is unavailable in this checkout.

---

### Task 4: Alert API Handlers

**Files:**
- Create: `workers/vs-cache/src/alerts-handlers.js`
- Create: `workers/vs-cache/src/alerts-handlers.test.js`
- Modify: `workers/vs-cache/src/handlers.js`

- [ ] **Step 1: Write failing API tests**

Cover:

- `POST /api/alerts/subscribe` validates input, creates/reuses subscription, sends confirmation, and returns `matchingDates`;
- subscribe returns `503` and does not write when D1 or email provider is missing;
- `GET /api/alerts/confirm?token=...` confirms and redirects to `/<locale>/?alert=confirmed`;
- `POST /api/alerts/manage-link` always returns generic success and sends a link only when the email has subscriptions;
- `GET /api/alerts/manage?token=...` returns scoped subscriptions;
- `POST /api/alerts/:id/unsubscribe` requires a valid manage token and unsubscribes only that subscription.

- [ ] **Step 2: Verify red**

Run: `npm test -- workers/vs-cache/src/alerts-handlers.test.js`

Expected: FAIL because `alerts-handlers.js` does not exist and `handlers.js` does not route alerts.

- [ ] **Step 3: Implement alert handlers**

Implement `handleAlertsRequest(request, env, options = {})` in `alerts-handlers.js`. Use `createAlertStore(env.ALERTS_DB)`, `createAlertEmailer(env)`, domain validation, and existing availability snapshot validation through `options.getAvailabilitySnapshot` or the current coordinator helper.

Use `crypto.randomUUID()` for ids and random tokens from `crypto.getRandomValues`.

- [ ] **Step 4: Wire handlers**

In `workers/vs-cache/src/handlers.js`, before the 404 branch, route `url.pathname.startsWith('/api/alerts/')` to `handleAlertsRequest(request, env, { now, getAvailabilitySnapshot: () => getAvailabilityCoordinator(env).getAvailability({ force: false }) })`.

- [ ] **Step 5: Verify green**

Run:

```bash
npm test -- workers/vs-cache/src/alerts-handlers.test.js workers/vs-cache/src/handlers.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

Skip commit and report: Git metadata is unavailable in this checkout.

---

### Task 5: Scheduled Alert Evaluation

**Files:**
- Create: `workers/vs-cache/src/alerts-scheduler.js`
- Create: `workers/vs-cache/src/alerts-scheduler.test.js`
- Modify: `workers/vs-cache/src/index.js`

- [ ] **Step 1: Write failing scheduler tests**

Cover:

- active subscription with matching dates sends an alert and records `last_alert_sent_on`;
- subscription already sent on the current `Asia/Tbilisi` day is skipped;
- subscription with no matching dates is skipped and not marked inactive;
- provider failure is logged once and does not retry in the same run;
- missing D1 or email provider logs and exits without breaking availability preload.

- [ ] **Step 2: Verify red**

Run: `npm test -- workers/vs-cache/src/alerts-scheduler.test.js`

Expected: FAIL because `alerts-scheduler.js` does not exist.

- [ ] **Step 3: Implement scheduler**

Create `evaluateTicketAlerts({ env, snapshot, now, appOrigin })`. It loads active subscriptions, computes matching dates using `findMatchingDates`, checks `shouldSendDailyAlert`, sends with `createAlertEmailer`, and records successes/failures through the store.

- [ ] **Step 4: Integrate cron**

In `workers/vs-cache/src/index.js`, after availability refresh and scheduled preload, call `evaluateTicketAlerts({ env, snapshot, now: () => scheduledDate, appOrigin: env.PUBLIC_APP_ORIGIN || 'https://getflights.ge' })`. Catch and structured-log alert failures so they do not break the existing cache refresh/preload cron.

- [ ] **Step 5: Verify green**

Run:

```bash
npm test -- workers/vs-cache/src/alerts-scheduler.test.js workers/vs-cache/src/cache-coordinator.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

Skip commit and report: Git metadata is unavailable in this checkout.

---

### Task 6: Frontend Alert API And Flag Helpers

**Files:**
- Create: `src/lib/alerts.ts`
- Create: `src/lib/alerts.test.ts`

- [ ] **Step 1: Write failing frontend helper tests**

Cover:

- `alertsEnabled({ VITE_ALERTS_ENABLED: 'true' })` is true;
- unset, empty, or other values are false;
- `defaultAlertRange(new Date('2026-07-05T12:00:00Z'))` returns July 2026;
- `defaultAlertRange(new Date('2026-07-08T12:00:00Z'))` returns August 2026;
- `buildAlertReturnUrl({ locale:'en', fromId:'7', toId:'4', dateFrom:'2026-08-01', dateTo:'2026-08-31' })` includes the route/range query params;
- `subscribeToRouteAlerts` posts to `/api/alerts/subscribe`;
- `requestManageLink` posts to `/api/alerts/manage-link`;
- `loadManagedAlerts` gets `/api/alerts/manage?token=...`;
- `unsubscribeManagedAlert` posts to `/api/alerts/:id/unsubscribe`.

- [ ] **Step 2: Verify red**

Run: `npm test -- src/lib/alerts.test.ts`

Expected: FAIL because `src/lib/alerts.ts` does not exist.

- [ ] **Step 3: Implement frontend helper/client**

Create typed helpers and fetch wrappers in `src/lib/alerts.ts`. Use `import.meta.env` only in a thin `readAlertsEnabled()` function and make pure helpers accept env/date arguments for tests.

- [ ] **Step 4: Verify green**

Run: `npm test -- src/lib/alerts.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Skip commit and report: Git metadata is unavailable in this checkout.

---

### Task 7: Frontend Alert Panel

**Files:**
- Modify: `src/lib/i18n.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Add tests that:

- with `VITE_ALERTS_ENABLED` false, no alert form or manage-alerts entry is rendered;
- with `VITE_ALERTS_ENABLED` true, selected route shows a notify panel with month/range controls and email input;
- route/range query params preselect route and date range;
- when selected range already has dates, the panel says tickets are already available and still allows subscribe;
- successful subscribe shows check-email-to-confirm state.

- [ ] **Step 2: Verify red**

Run: `npm test -- src/App.test.tsx src/lib/alerts.test.ts`

Expected: FAIL because App does not render alerts UI.

- [ ] **Step 3: Add localized copy**

Add alert strings to `messages.en`, `messages.ru`, `messages.ua`, and `messages.ka` for headings, email label, subscribe button, range labels, month shortcut, already-available state, check-email state, manage alerts, validation, and backend error copy.

- [ ] **Step 4: Implement gated alert panel**

In `App.tsx`, read the frontend flag via `readAlertsEnabled()`. If enabled, render a compact alert panel in `day-detail` using the current `fromId/toId`, mandatory `dateFrom/dateTo`, month shortcut, email input, and `subscribeToRouteAlerts`.

Use query params `from`, `to`, `dateFrom`, and `dateTo` on initial load to preselect route and range when valid.

- [ ] **Step 5: Verify green**

Run: `npm test -- src/App.test.tsx src/lib/i18n.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Skip commit and report: Git metadata is unavailable in this checkout.

---

### Task 8: Frontend Manage Alerts Page

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Write failing manage-page tests**

Add tests that:

- with frontend flag disabled, `/en/alerts/manage?token=abc` falls back to normal app without manage UI;
- with flag enabled, manage page loads subscriptions from `loadManagedAlerts`;
- clicking unsubscribe calls `unsubscribeManagedAlert` and removes or marks one item;
- manage-link request from the public entry sends email and shows generic success.

- [ ] **Step 2: Verify red**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because manage UI is not implemented.

- [ ] **Step 3: Implement manage page**

In `App.tsx`, detect localized path `/:locale/alerts/manage`. If enabled, render the manage page instead of the normal calendar workflow. Support token query param, loading/error/empty states, list subscriptions, and per-item unsubscribe.

- [ ] **Step 4: Verify green**

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

Skip commit and report: Git metadata is unavailable in this checkout.

---

### Task 9: Full Verification And Docs

**Files:**
- Modify: `docs/cache-worker.md`
- Modify: `docs/superpowers/specs/2026-07-05-ticket-alert-subscriptions-design.md` only if implementation details changed materially.

- [ ] **Step 1: Document dormant deployment**

Update `docs/cache-worker.md` with:

- alert APIs live in the cache Worker;
- D1 migration path;
- frontend flag `VITE_ALERTS_ENABLED`;
- backend fails closed if D1 or email provider is missing;
- deploy frontend with flag false until provider setup is complete.

- [ ] **Step 2: Run full tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: build succeeds and SEO generation still works.

- [ ] **Step 4: Commit**

Skip commit and report: Git metadata is unavailable in this checkout.

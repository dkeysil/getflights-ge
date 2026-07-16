# Ticket Alert Subscriptions Design

## Goal

Let users subscribe to a Vanilla Sky route and mandatory date range so they receive email when tickets appear. A subscription triggers only when the selected route has at least one available date inside the watched range. Once matching tickets exist, the user receives at most one alert per day while the tickets remain available. Alerts pause automatically when no matching dates are available and resume on later days if matching dates reappear. Users manage subscriptions through a magic-link page.

## Non-Goals

- Do not create accounts or password authentication.
- Do not deep-link alert emails directly to Vanilla Sky booking.
- Do not send alerts for unconfirmed email addresses.
- Do not support broad permanent watchers without a bounded date range.
- Do not replace the existing `/api/availability` or `/api/flights` cache behavior.

## Architecture

Subscriptions live in the existing `workers/vs-cache` Worker because it already owns `/api/*`, availability refresh, scheduled cron, and the canonical cached Vanilla Sky state. The React app remains the user-facing surface and continues to reach the Worker through the existing Pages `/api/*` service binding.

Add two bindings to the cache Worker:

- `D1` database for subscriptions, token hashes, magic-link sessions, and alert send logs.
- `EMAIL` send binding for confirmation, magic-link, and ticket-alert emails.

The feature is hidden by default behind a frontend build flag until an email provider is chosen and configured. Backend provider checks still fail closed when email is unavailable, but the product rollout flag is frontend exposure only.

The scheduled Worker flow becomes:

1. Refresh or read the current availability snapshot.
2. Apply the existing known-ticket filtering.
3. Evaluate confirmed active subscriptions.
4. Find each subscription whose route has one or more available outbound dates inside its watched range.
5. Send at most one alert per subscription per day while matching dates exist.
6. Skip sending when matching dates disappear, without changing the subscription status.

## User Flow

The user starts from the selected route in the existing flight search UI. A compact alert panel appears in the route/day detail area. It is part of the search workflow, not a separate marketing section.

The alert panel includes:

- selected route pair, derived from the current route;
- mandatory watched date range;
- month shortcut that prefills exact `dateFrom` and `dateTo`;
- manual exact date fields;
- email field;
- subscribe button;
- status copy after submit.

The default range suggestion is the next likely Vanilla Sky release month. From the 1st through 7th day of a month, suggest the current calendar month because Vanilla Sky may still be late posting that month's tickets. From the 8th day onward, suggest the next calendar month. This is only a visible suggested range. The user must confirm or adjust the range before subscribing.

If tickets are already available inside the selected range, the UI shows that state and still allows the user to subscribe for daily reminders until they unsubscribe.

After subscribing, the Worker creates or reuses a subscription and sends a confirmation email. The subscription becomes active only after the user clicks the confirmation link.

Users manage alerts with magic links. The app exposes a "Manage alerts" entry where the user enters an email address. The Worker sends a generic response and, when appropriate, emails a magic link. The magic link opens a management page listing subscriptions for that email with route, watched range, status, currently matching dates, and an unsubscribe action for each subscription.

Alert emails link back to GetFlights.ge with route and watched range preselected.

## Data Model

Use D1 tables with explicit status and send-state fields.

### `subscriptions`

- `id` text primary key
- `email` normalized lowercase email
- `from_id` route origin city id
- `to_id` route destination city id
- `date_from` ISO date
- `date_to` ISO date
- `locale` app locale at subscription time
- `status` one of `pending`, `active`, `unsubscribed`
- `confirmed_at` nullable timestamp
- `unsubscribed_at` nullable timestamp
- `last_alert_sent_on` nullable date string
- `created_at` timestamp
- `updated_at` timestamp

Use a uniqueness rule for normalized `email`, `from_id`, `to_id`, `date_from`, and `date_to`. A new request for the same tuple reuses or updates the existing subscription instead of creating duplicates. Different routes or date ranges are allowed for the same email.

### `subscription_tokens`

- `token_hash` text primary key
- `subscription_id` nullable text
- `email` nullable normalized lowercase email
- `purpose` one of `confirm`, `manage`
- `expires_at` timestamp
- `consumed_at` nullable timestamp
- `created_at` timestamp

Store hashes of tokens only. Confirmation tokens are single-use. Manage tokens authorize listing and unsubscribing subscriptions for the scoped email and expire after 24 hours.

### `alert_send_log`

- `id` text primary key
- `subscription_id` text
- `sent_on` date string
- `matching_dates_json` JSON text
- `provider_status` text
- `error_summary` nullable text
- `created_at` timestamp

This log supports diagnostics and protects against duplicate daily sends together with `subscriptions.last_alert_sent_on`.

## API Surface

All endpoints live under `/api/alerts/*` in the cache Worker.

### `POST /api/alerts/subscribe`

Accepts `{ email, fromId, toId, dateFrom, dateTo, locale }`.

Server behavior:

- normalize and validate email;
- validate city ids, route existence, ISO dates, and date range bounds;
- cap ranges to a maximum of 90 days;
- create or reuse the subscription for the same email, route, and range;
- send a confirmation email when the subscription is not already confirmed;
- return a response that includes whether matching tickets are currently available.

### `GET /api/alerts/confirm?token=...`

Confirms a pending subscription if the token is valid and unexpired. Redirects back to the site with a confirmation result query state.

### `POST /api/alerts/manage-link`

Accepts `{ email, locale }`. Always returns a generic success response so callers cannot discover whether an email has subscriptions. Sends a manage-link email if the email has manageable subscriptions.

### `GET /api/alerts/manage?token=...`

Returns manageable subscriptions for the magic-link email scope. Each item includes route ids, date range, status, currently matching dates, and last alert state.

### `POST /api/alerts/:id/unsubscribe`

Requires a valid manage token or session context. Marks one subscription as `unsubscribed`.

## Frontend Flag And Provider Readiness

Use a Vite frontend environment variable named `VITE_ALERTS_ENABLED`. The default production build value is off until the email provider is ready.

Disabled behavior:

- The React app hides the alert panel and manage-alerts entry.
- The React app does not expose the localized manage-alerts route.
- No subscribe or manage-link calls are made by the public UI.
- D1 migrations and dormant code can still deploy safely.

Enabled behavior:

- The React app renders the alert panel and manage-alerts entry.
- The React app exposes the localized manage-alerts route.
- The Worker requires a configured email provider before accepting subscriptions or sending magic links.
- Worker requests that need email fail closed if the email provider is unavailable.

The backend is still defensive even while the frontend flag is off: direct calls to subscribe or manage-link must validate inputs and must not create confirmed subscriptions unless email confirmation can be sent.

## Email Behavior

Send three email types:

- confirmation email;
- manage-alerts magic-link email;
- daily ticket alert email.

Every email includes plain text and HTML. Every alert email includes:

- route;
- watched date range;
- currently available matching dates;
- link back to GetFlights.ge with route and range preselected;
- manage-alerts link.

Daily alert rules:

- only `active` subscriptions are eligible;
- at least one current available outbound date must fall inside the watched range;
- send at most once per subscription per day, where the product day is calculated in `Asia/Tbilisi`;
- pause automatically when no matching dates are available;
- resume on later days if matching dates reappear;
- log provider result or failure;
- do not retry repeatedly in the same cron run after an email provider failure.

## Frontend Behavior

Add a compact alert panel to the selected route/day detail area. The panel follows the current locale system and must be translated for English, Russian, Ukrainian, and Georgian.

The frontend checks `VITE_ALERTS_ENABLED` at build time. If the flag is not enabled, it hides subscription and management UI entirely.

The panel supports:

- route shown from current route selection;
- mandatory date range;
- month shortcut that writes exact `dateFrom` and `dateTo`;
- manual exact date editing;
- already-available messaging when the selected range has matching dates;
- email input;
- pending-confirmation success state;
- error state for validation or backend failures.

Add route/range preselection query parameters so alert emails can return users to the same watched context:

- `from`
- `to`
- `dateFrom`
- `dateTo`

The management page is implemented inside the React app at a localized route such as `/:locale/alerts/manage`. It accepts token/query state, calls the Worker for subscriptions, renders all subscriptions for the email scope, and allows unsubscribing one subscription at a time.

## Validation And Abuse Controls

Server-side validation is authoritative:

- email format;
- known city ids;
- route exists in current route catalog;
- `dateFrom` and `dateTo` are valid ISO dates;
- `dateFrom <= dateTo`;
- range length is no more than 90 days;
- locale is one of the supported app locales.

Abuse controls:

- rate-limit subscribe and manage-link requests by IP and email;
- never reveal subscription existence from `manage-link`;
- store token hashes, not raw tokens;
- expire confirmation tokens after 7 days;
- expire unconfirmed pending subscriptions after 7 days;
- expire manage tokens after 24 hours;
- require confirmation before alert sending;
- include manage/unsubscribe access in every alert email;
- log failures without tight retry loops.

## Testing

Add focused tests for:

- frontend flag disabled behavior for alert panel and manage-route visibility;
- backend provider-unavailable behavior for email-dependent endpoints;
- range matching against route availability;
- month shortcut date-range calculation;
- route/date/email validation;
- duplicate subscription reuse;
- token hashing, expiry, and single-use confirmation;
- generic manage-link response;
- manage list authorization;
- per-subscription unsubscribe;
- scheduled alert send when matching dates exist;
- no duplicate daily send for the same subscription;
- pause behavior when matching dates disappear;
- resume behavior on a later day when matching dates reappear;
- React alert panel submit and confirmation states;
- React management page list and unsubscribe states.

Verification commands:

```bash
npm test
npm run build
```

## Rollout

Before deployment, add a D1 database and migration for the subscription tables. Build and deploy the frontend with `VITE_ALERTS_ENABLED=false` until the email provider is selected and configured. Before enabling the frontend flag, verify the provider can send from the chosen sending domain and that the Worker has the required restricted binding or secrets.

Deploy the cache Worker before deploying Pages when enabling the frontend flag so `/api/alerts/*` exists before the frontend links to it.

The expected deployment order is:

```bash
npm run build
npx wrangler deploy --config workers/vs-cache/wrangler.jsonc
npx wrangler pages deploy dist --project-name better-vanillasky --branch main --commit-dirty=true
```

Live verification should confirm:

- with `VITE_ALERTS_ENABLED=false`, the public site hides alerts and the manage-alerts entry;
- after provider setup and `VITE_ALERTS_ENABLED=true`, the public site renders the alert panel;
- `/api/alerts/subscribe` accepts a valid request and sends a confirmation email;
- confirmation activates the subscription;
- manage-link email opens the management page;
- unsubscribe removes a single subscription;
- scheduled alert logic can be exercised in a test or preview-safe path without duplicate sends.

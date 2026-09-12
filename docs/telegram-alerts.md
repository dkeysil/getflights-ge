# Telegram Availability Alerts (v1)

Telegram is the only user-facing alert channel. The email code under
`workers/vs-cache/src/alerts-*.js` and migration `0001` is an inactive
predecessor: it is left in place, but nothing in the UI reaches it.

## Flow

The primary binding is the official **Telegram Login Widget**, which is enabled
on staging only. The `/start <token>` deep link remains in the code as the
new-chat fallback described below; it is no longer the path a traveller takes.

1. The search UI collects a route and an inclusive date range. The range is
   picked as two clicks on the availability calendar, which opens up sold-out
   days while the pick is armed. The window is picked **forwards**: the first
   click fixes the start, and only strictly later days stay selectable, so a
   one-day window cannot be expressed by clicking the same day twice.
2. Once the window is complete the panel shows exactly one Telegram action, the
   sign-in widget, inside the block that shows the window. Nothing else in the
   panel links to Telegram.
3. Telegram authenticates the user in its own popup and calls back with a
   payload it signed with the bot token. Only then does the browser call
   `POST /api/alerts/telegram/link` for a one-time token — there is no `await`
   between a click and a `window.open`, so no popup grant to lose.
4. The Worker validates the route against the live availability snapshot,
   rate-limits the caller, mints a random token, stores only its SHA-256 hash
   with the route/range/locale payload and a **5-minute** expiry, and returns
   both the token and the `https://t.me/<bot>?start=<token>` fallback link.
5. The browser posts the token plus the signed payload to
   `POST /api/alerts/telegram/login`. The Worker checks the flag and the origin,
   verifies the HMAC (`secret_key = SHA256(bot_token)`, `hash =
   HMAC_SHA256(data_check_string, secret_key)`) and the `auth_date` freshness,
   and **only then** consumes the token in a single atomic
   `UPDATE ... RETURNING`. A rejected payload leaves the token unspent and
   retryable; a spent or expired token answers `410`.
6. The Worker binds the chat (a Telegram user id is that user's private chat id)
   and sends the confirmation. Once the binding is committed no send failure is
   reported as a failed subscription — the token is already spent, so a retry
   could only fail. Any failing send answers `needsStart: true` with a bare
   `https://t.me/<bot>` link, the new-chat fallback, which is also the honest
   answer for the common cause: a bot cannot message a user who has never opened
   its chat. That link replaces the sign-in action rather than adding to it.
7. `/start <token>` still works at `POST /api/telegram/webhook`: the webhook
   verifies the `X-Telegram-Bot-Api-Secret-Token` header, claims the `update_id`
   so a redelivery cannot act twice, consumes the token the same atomic way,
   binds the chat and replies in the subscriber's locale.
8. Every 10 minutes the existing cron refreshes availability and then runs
   `evaluateTelegramAlerts`. A subscription whose range has matching dates is
   sent exactly once per **Tbilisi** product day, with the matching dates and a
   link that restores the route/range search.

## Bot commands

| Command | Effect |
|---|---|
| `/start <token>` | Binds this chat to the route/range carried by the token. The new-chat fallback path; the staging widget binds without it. |
| `/start` (no token) | Help text. Never binds anything. |
| `/stop` | Unsubscribes every active subscription of this chat. |
| `/list` | Lists this chat's active subscriptions. |
| `/help` | Help text. |

Anything else — group chats, channel posts, edited messages, callback queries,
plain text — is acknowledged with 200 and ignored.

## Bindings, vars and secrets

All of these live on the cache Worker (`workers/vs-cache/wrangler.jsonc`).

| Name | Kind | Purpose |
|---|---|---|
| `ALERTS_DB` | D1 binding | Subscriptions, link tokens, send log, rate limits, processed updates |
| `TELEGRAM_BOT_TOKEN` | secret | Bot API token from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | secret | Shared value that authenticates every webhook request |
| `TELEGRAM_BOT_USERNAME` | var | Bot username used to build the `t.me` deep link |
| `PUBLIC_APP_ORIGIN` | var | Origin used in the links inside bot messages |
| `TELEGRAM_LOGIN_ENABLED` | var | **Staging only.** Exactly `"true"` exposes `/api/alerts/telegram/login`; anything else (including unset) makes it `404` |
| `TELEGRAM_LOGIN_ALLOWED_ORIGINS` | var | **Staging only.** Comma-separated origins allowed to call that endpoint. An empty or unset list denies every caller |

The frontend CTA is gated by the build flag `VITE_ALERTS_ENABLED=true`. The
sign-in widget needs `VITE_TELEGRAM_LOGIN_ENABLED=true` **and**
`VITE_TELEGRAM_BOT_USERNAME` as well; with either missing the panel renders no
Telegram action at all, so the deep link can never quietly become the primary
path. A production build sets none of these three.

### Staging-only login widget

The endpoint and the widget are gated independently, on the Worker and in the
build, and both default to off:

```bash
# Worker (staging deployment only — never on the production Worker)
npx wrangler deploy --config workers/vs-cache/wrangler.jsonc \
  --var TELEGRAM_LOGIN_ENABLED:true \
  --var TELEGRAM_LOGIN_ALLOWED_ORIGINS:https://<stage-host>

# Frontend (staging build only)
VITE_ALERTS_ENABLED=true \
VITE_TELEGRAM_LOGIN_ENABLED=true \
VITE_TELEGRAM_BOT_USERNAME=get_flights_ge_bot \
npm run build
```

**One manual step remains and cannot be done from this repo:** Telegram only
renders the widget on a domain the bot owner has registered with @BotFather
(`/setdomain` → pick the bot → the exact stage host, scheme and host only, no
path). Until that is done the widget iframe stays blank on staging, even though
the Worker side is ready. Registering the stage host does not affect the
production domain, and the existing production bot is authorized for this.

Secrets are never read in browser code and never committed. Set them with:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN --config workers/vs-cache/wrangler.jsonc
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET --config workers/vs-cache/wrangler.jsonc
```

For local Worker development put the same names in an untracked
`workers/vs-cache/.dev.vars` file (`.dev.vars*` is git-ignored).

## Production rollout

The D1 binding is already declared in `workers/vs-cache/wrangler.jsonc`. For a
fresh Telegram-only D1 database, apply **only** the Telegram schema; migration
`0001` belongs to the inactive email predecessor.

```bash
# 1. Create the database once, then place its returned id in wrangler.jsonc.
npx wrangler d1 create getflights-alerts

# 2. Apply the Telegram-only schema and set the two Worker secrets.
npx wrangler d1 execute getflights-alerts --remote \
  --file workers/vs-cache/migrations/0002_telegram_alert_subscriptions.sql
npx wrangler secret put TELEGRAM_BOT_TOKEN --config workers/vs-cache/wrangler.jsonc
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET --config workers/vs-cache/wrangler.jsonc

# 3. Deploy the Worker and production frontend. The build flag makes the CTA live.
#    Production stays feature-off until the owner signs the flow off: until then
#    this build runs without VITE_ALERTS_ENABLED, and never with the two
#    VITE_TELEGRAM_LOGIN_* flags.
npx wrangler deploy --config workers/vs-cache/wrangler.jsonc
VITE_ALERTS_ENABLED=true npm run build
npx wrangler pages deploy dist --project-name better-vanillasky --branch main

# 4. Point the bot at the public Pages webhook using the same secret value.
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://getflights.ge/api/telegram/webhook",
       "secret_token":"<TELEGRAM_WEBHOOK_SECRET>",
       "allowed_updates":["message"]}'
```

`allowed_updates: ["message"]` keeps Telegram from delivering update types the
Worker ignores anyway.

## Abuse controls

- Link creation: 10 per client IP per hour (`429` with `Retry-After`).
- Webhook updates: 20 per chat per minute; excess updates are acknowledged and
  dropped without a reply, so the bot cannot be used as an amplifier.
- Link tokens are single-use and expire after 5 minutes; only their hash is
  stored. Single use is enforced by the `UPDATE ... RETURNING` itself, so two
  concurrent claims can never both bind.
- Login payload verification happens before the token is touched: a forged,
  edited, stale or future-dated payload is rejected without consuming anything.
- The login endpoint is rate-limited to 20 attempts per client IP per hour, and
  is invisible (`404`) unless its environment flag is set.
- Every `update_id` is claimed once before it is acted on.
- There is no endpoint that lists or looks up subscriptions: a chat can only
  ever see its own, through `/list` inside Telegram.
- Bot API calls go to a hard-coded `https://api.telegram.org` constant that no
  env var or webhook payload can influence.
- The cron prunes expired link tokens every run, and rate-limit buckets and
  processed-update ids older than 7 days.

## Failure behaviour

- Missing `ALERTS_DB` or `TELEGRAM_BOT_TOKEN`: the link endpoint returns 503 and
  the scheduler logs `telegram_alert_scheduler_unavailable` and does nothing.
  Flight search is unaffected.
- The send is reserved in `telegram_alert_send_log` *before* the Bot API call, so
  a failed send is recorded as `failed` and is not retried until the next
  product day — no retry storm, no duplicate message.
- A chat that blocked the bot or no longer exists (403, or 400 "chat not found")
  retires its subscriptions instead of failing every 10 minutes forever.
- Webhook requests that pass authentication always get a 200, even when the
  reply fails, because Telegram redelivers any non-2xx. Failures are logged as
  `telegram_webhook_command_failed`.
- Bot token values are stripped from every error surfaced by the API client.

## Unsubscribing

`/stop` inside Telegram is the unsubscribe path. No web unsubscribe endpoint was
added: Telegram is already the authenticated channel for these subscriptions, so
a web path would mean minting another bearer link for something `/stop` does
without any new public surface.

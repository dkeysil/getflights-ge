# Telegram Availability Alerts (v1)

Telegram is the only user-facing alert channel. The email code under
`workers/vs-cache/src/alerts-*.js` and migration `0001` is an inactive
predecessor: it is left in place, but nothing in the UI reaches it.

## Flow

1. The search UI collects a route and an inclusive date range and calls
   `POST /api/alerts/telegram/link`.
2. The Worker validates the route against the live availability snapshot,
   rate-limits the caller, mints a random token, stores only its SHA-256 hash
   with the route/range/locale payload and a 15-minute expiry, and returns
   `https://t.me/<bot>?start=<token>`.
3. The browser opens that deep link. Telegram delivers `/start <token>` to
   `POST /api/telegram/webhook`.
4. The webhook verifies the `X-Telegram-Bot-Api-Secret-Token` header, claims the
   `update_id` so a redelivery cannot act twice, consumes the token in a single
   atomic `UPDATE ... RETURNING` (single-use), binds the chat, and replies in the
   subscriber's locale.
5. Every 10 minutes the existing cron refreshes availability and then runs
   `evaluateTelegramAlerts`. A subscription whose range has matching dates is
   sent exactly once per **Tbilisi** product day, with the matching dates and a
   link that restores the route/range search.

## Bot commands

| Command | Effect |
|---|---|
| `/start <token>` | Binds this chat to the route/range carried by the token. The only way a chat is ever bound. |
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

The frontend CTA is gated by the build flag `VITE_ALERTS_ENABLED=true`.

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
- Link tokens are single-use and expire after 15 minutes; only their hash is
  stored.
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

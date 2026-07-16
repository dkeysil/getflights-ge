# Vanilla Sky Cache Worker

The app now reads slow Vanilla Sky data through a service-bound Worker:

- Pages Function: `functions/api/[[path]].js`
- Cache Worker: `workers/vs-cache/src/index.js`
- Worker config: `workers/vs-cache/wrangler.jsonc`
- Pages binding config: `wrangler.jsonc`

The cache Worker uses the `VS_CACHE_KV` production namespace and `VS_CACHE_KV_preview` preview namespace configured in `workers/vs-cache/wrangler.jsonc`.

Availability is cached under one snapshot key. Selected-day flight HTML is cached in one bundle key per search profile. The canonical data locale is EN, so the default production bundle key looks like:

```text
flight-bundle:one-way:en:1:0:0
```

Each bundle contains route/date entries such as `7:4:2026-07-02:`. Manual refresh updates one entry by reading, mutating, and rewriting the whole bundle through the Durable Object, so concurrent writes stay serialized.

The scheduled cron runs every 10 minutes. It refreshes availability, then preloads stale or missing one-way `1 adult, 0 child, 0 infant` entries for the configured official locale. Current production config sets `PRELOAD_OFFICIAL_LOCALES=en`, so scheduled preload uses EN only. `PRELOAD_CONCURRENCY=4` caps Vanilla Sky form submissions.

If these namespaces ever need to be recreated, use:

```bash
npx wrangler kv namespace create VS_CACHE_KV
npx wrangler kv namespace create VS_CACHE_KV --preview
```

Deploy order:

```bash
npm run build
npx wrangler deploy --config workers/vs-cache/wrangler.jsonc
npx wrangler pages deploy dist --project-name better-vanillasky --branch main --commit-dirty=true
```

Local frontend development uses the deployed cache API by default:

```bash
npm run dev
```

To test local cache Worker changes, run two processes:

```bash
npm run dev:cache-worker
VITE_API_PROXY_TARGET=http://127.0.0.1:8788 npm run dev
```

The Vite dev server proxies `/api/*` to `https://getflights.ge` unless `VITE_API_PROXY_TARGET` is set.

## Dormant Ticket Alerts

Alert APIs live in the cache Worker under `/api/alerts/*`. Their D1 schema is in:

```text
workers/vs-cache/migrations/0001_alert_subscriptions.sql
```

The public React UI is gated only by the frontend build flag:

```bash
VITE_ALERTS_ENABLED=false npm run build
```

Keep that flag false for frontend deploys until the D1 database and email provider are fully configured. The backend has no separate feature flag: alert endpoints and scheduled sends fail closed when `ALERTS_DB` or the `EMAIL` provider binding is missing.

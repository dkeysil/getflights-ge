# GetFlights.ge — Vanilla Sky flight search for Georgia

**Live site: [getflights.ge](https://getflights.ge/)**

[GetFlights.ge](https://getflights.ge/) is an independent flight-search helper for [Vanilla Sky](https://ticket.vanillasky.ge/) domestic flights in Georgia. It shows live route schedules and fares for routes like Natakhtari–Mestia and Natakhtari–Ambrolauri, then hands travelers off to the official Vanilla Sky booking site for payment and ticket issuance.

GetFlights.ge does not issue tickets or take payment — it makes finding a flyable date fast, then links you to the official airline site to book.

## Features

- **Live schedules and fares** for Vanilla Sky's Georgian domestic routes, with day-by-day availability
- **Fast search** backed by an edge cache, so date availability loads instantly instead of hammering the airline's backend
- **Ticket alerts** — subscribe with your email and get notified when seats open up on a route/date (double-opt-in, token-hashed, no accounts)
- **Multilingual** — English, Georgian, Russian, and Hebrew, with localized SEO pages per route
- **Agent-readable** — [llms.txt](https://getflights.ge/llms.txt), Markdown mirrors of key pages, and structured data so AI assistants can answer flight questions accurately

## Architecture

The app runs entirely on Cloudflare:

| Piece | What it does |
|---|---|
| `src/` | React 19 + Vite single-page app (search UI, alerts management, i18n) |
| `functions/` | Cloudflare Pages Functions — API routes and a same-origin proxy to the Vanilla Sky backend |
| `workers/vs-cache/` | Standalone Worker that caches flight bundles in KV, coordinates refreshes through a Durable Object, runs cron-driven preloads every 10 minutes, and powers ticket alerts (D1 + email) |
| `scripts/` | Build-time SEO generation (route pages, sitemap, social previews) |
| `docs/` | Design specs and implementation plans |

The Pages app calls the cache worker over a [service binding](https://developers.cloudflare.com/pages/functions/bindings/#service-bindings), so search requests are served from KV-cached data and the airline backend only sees the cache-refresh traffic.

## Development

```bash
npm install
npm run dev              # frontend at :5173
npm run dev:cache-worker # cache worker at :8788
npm test                 # vitest
npm run build            # SEO generation + tsc + vite build
```

Deployment targets Cloudflare Pages (frontend + functions) and Wrangler (`workers/vs-cache`).

## Disclaimer

GetFlights.ge is not affiliated with Vanilla Sky. All bookings, payments, and ticket issuance happen on the official [Vanilla Sky website](https://ticket.vanillasky.ge/). Schedule and fare data is fetched from the public booking API and cached briefly; always confirm details on the official site before traveling.

# GetFlights.ge authentication for AI agents

Last updated: 2026-08-14
Canonical URL: https://getflights.ge/auth.md

## Summary

Most GetFlights.ge content and read-only flight-search data is public. AI agents, search crawlers, and users do not need an account to read the site, route pages, `llms.txt`, Markdown mirrors, `api-catalog.json`, or `openapi.json`.

GetFlights.ge does not sell tickets, process payments, issue refunds, or operate flights. Payment and ticket issuance happen on the official Vanilla Sky website after the user clicks the booking handoff.

## Public access

No authentication is required for:

- `GET /`
- `GET /llms.txt`
- `GET /flights.md`
- `GET /booking.md`
- `GET /api-catalog.json`
- `GET /openapi.json`
- `GET /api/availability`
- `GET /api/flights` with valid route/date/passenger query parameters
- Localized route and guide pages under `/en/`, `/ru/`, `/ua/`, and `/ka/`

Agents may crawl, index, quote, summarize, and use the public content for search, AI input, and training according to the live `robots.txt` Content-Signal policy.

## User-scoped alert management

Ticket alerts are email-based and use magic links. There is no reusable API key, OAuth token, password login, or account session for agents.

Alert endpoints may be feature-gated and can return `503` if email or database bindings are not enabled.

- `POST /api/alerts/subscribe` creates or reuses a pending double-opt-in subscription for an email address.
- `POST /api/alerts/manage-link` requests a management email. The response is intentionally generic and does not reveal whether an email has subscriptions.
- `GET /api/alerts/manage?token=...` reads subscriptions scoped to the one-time management token.
- `POST /api/alerts/{id}/unsubscribe?token=...` unsubscribes one token-scoped subscription.

Agents should not ask users for magic-link tokens unless the user is intentionally delegating alert management. Tokens must be treated as private credentials and should not be logged, indexed, or shared.

## Booking and payment boundary

GetFlights.ge only helps users discover live Vanilla Sky availability and then opens the official Vanilla Sky booking flow. Agents must not represent GetFlights.ge as the merchant of record.

For payment, ticket issuance, refunds, cancellations, baggage, airport transfer, and flight-operation questions, use official Vanilla Sky information and policies.

## Abuse and rate guidance

Prefer cached, documented resources before live API calls:

1. Read `https://getflights.ge/llms.txt`.
2. Read `https://getflights.ge/flights.md` and `https://getflights.ge/booking.md`.
3. Use `GET /api/availability` for current available dates.
4. Call `GET /api/flights` only for a user-selected route/date that appears in the availability snapshot.

Do not hammer refresh endpoints. They are intended for user-triggered refreshes, not bulk crawling.

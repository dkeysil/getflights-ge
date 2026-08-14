# SEO Analytics Operations

## Cloudflare Web Analytics

Enable Web Analytics on the Cloudflare Pages project after this build is deployed:

1. Open Cloudflare dashboard.
2. Go to Workers & Pages.
3. Select the GetFlights.ge Pages project.
4. Open Metrics.
5. Select Enable under Web Analytics.
6. Redeploy the Pages project so Cloudflare injects the analytics beacon.
7. Verify the deployed page loads Cloudflare's `/cdn-cgi/rum` or `static.cloudflareinsights.com` beacon.

Do not add a hardcoded analytics token to the repository unless Pages injection is unavailable.

## Google Search Console

Use a Domain property for `getflights.ge` if DNS access is available.

1. Add a Domain property in Google Search Console for `getflights.ge`.
2. Copy the Search Console DNS verification TXT value.
3. Add the TXT record in Cloudflare DNS for `getflights.ge`.
4. Complete verification in Search Console.
5. Submit `https://getflights.ge/sitemap.xml` in the Sitemaps report.
6. Use URL Inspection for:
   - `https://getflights.ge/en/`
   - `https://getflights.ge/ru/`
   - `https://getflights.ge/ua/`
   - `https://getflights.ge/ka/`

Track indexed pages, sitemap processing errors, impressions, clicks, CTR, and average position by page and query language.

## AI Crawler Robots Policy

GetFlights.ge intentionally uses a permissive LLM SEO policy. The site should be open to search engines, AI answer engines, citation crawlers, user-triggered fetchers, and model-training crawlers.

The repo publishes the canonical crawler policy in `public/robots.txt`. Cloudflare must not prepend managed AI crawler blocks at request time because those blocks override this site's LLM SEO policy for crawlers such as `ClaudeBot` and `GPTBot`.

Required live policy:
- Allow all crawlers with `User-agent: *` and `Allow: /`.
- Include `Content-Signal: search=yes,ai-input=yes,ai-train=yes,use=full`.
- Explicitly allow high-value search/AI agents: `OAI-SearchBot`, `ChatGPT-User`, `GPTBot`, `PerplexityBot`, `ClaudeBot`, `Claude-User`, `Googlebot`, `Google-Extended`, `Bingbot`, `CCBot`, `Bytespider`, `Amazonbot`, `Applebot`, `Applebot-Extended`, `meta-externalagent`.
- Do not include root `Disallow: /` directives.
- Keep `Sitemap: https://getflights.ge/sitemap.xml`.

Cloudflare dashboard steps:
1. Open the `getflights.ge` zone.
2. Go to Security > Bots / Bot traffic settings.
3. Disable `AI bots protection` / `Block AI Scrapers and Crawlers`.
4. Disable managed `robots.txt` injection:
   - `Instruct bot traffic with robots.txt`, or
   - `Set your preference to block training in robots.txt`.
5. Keep `Crawler protection` and `Content bots protection` disabled unless there is an active abuse incident.
6. Redeploy the Pages project after a repo `robots.txt` change.
7. Run `npm run check:live-robots`.

Expected verification:
- `curl -sS https://getflights.ge/robots.txt` does not contain `BEGIN Cloudflare Managed`.
- `curl -sS https://getflights.ge/robots.txt` contains `Content-Signal: search=yes,ai-input=yes,ai-train=yes,use=full`.
- `npm run check:live-robots` exits successfully.

## Cloudflare AI Crawl Control Level 2 diagnostics

The project exposes the Level 2 technical-groundwork artifacts Cloudflare expects AI crawlers to discover site data and APIs:

- API Catalog: `https://getflights.ge/api-catalog.json` and `https://getflights.ge/.well-known/api-catalog.json`.
- OpenAPI service description: `https://getflights.ge/openapi.json` and `https://getflights.ge/.well-known/openapi.json`.
- Auth.md: `https://getflights.ge/auth.md` and `https://getflights.ge/.well-known/auth.md`.
- Link Headers: configured in `public/_headers` for all pages plus the agent-readable files above.

Run local verification before deploying:

```bash
npm run check:agent-diagnostics
npm run build
```

After deployment, verify representative live headers and files:

```bash
curl -I https://getflights.ge/
curl -sS https://getflights.ge/api-catalog.json
curl -sS https://getflights.ge/openapi.json
curl -sS https://getflights.ge/auth.md
```

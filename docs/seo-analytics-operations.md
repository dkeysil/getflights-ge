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

The repo publishes a crawler policy in `public/robots.txt`, but Cloudflare can prepend managed robots rules at request time. For AI search visibility, the live `https://getflights.ge/robots.txt` must not contain `# BEGIN Cloudflare Managed Content`.

Recommended policy:
- Allow search and citation agents: `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`, `Bingbot`, `Googlebot`.
- Block broad training or scraping agents where search access has a separate bot: `GPTBot`, `CCBot`, `Bytespider`, `Amazonbot`, `Applebot-Extended`, `meta-externalagent`.
- Keep `Sitemap: https://getflights.ge/sitemap.xml`.

Cloudflare dashboard steps:
1. Open the `getflights.ge` zone.
2. Go to Security > Bots, or Security Settings and filter by Bot traffic.
3. Disable the managed setting that prepends AI bot blocks to `robots.txt`:
   - `Instruct bot traffic with robots.txt`, or
   - `Set your preference to block training in robots.txt`.
4. Keep enforced WAF blocking separate from the public `robots.txt` policy.
5. Redeploy the Pages project after the repo `robots.txt` change.
6. Run `npm run check:live-robots`.

Expected verification:
- `curl -sS https://getflights.ge/robots.txt` does not contain `BEGIN Cloudflare Managed`.
- `npm run check:live-robots` exits successfully.

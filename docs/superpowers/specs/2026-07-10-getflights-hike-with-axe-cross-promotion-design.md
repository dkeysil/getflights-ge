# GetFlights and Hike With Axe Cross-Promotion Design

## Goal

Run a focused 30-day cross-promotion experiment that introduces Russian- and Ukrainian-language GetFlights visitors to Hike With Axe, while adding one useful, crawlable Hike With Axe article about buying Vanilla Sky domestic-flight tickets through GetFlights.

The primary success metric is tracked outbound banner clicks from GetFlights to Hike With Axe. The experiment should be helpful to travellers, preserve GetFlights' flight-search and booking workflows, and avoid artificial sitewide reciprocal linking.

## Non-Goals

- Do not show the promotion to English or Georgian GetFlights visitors in the first experiment.
- Do not add a global partner link to either site's header or footer.
- Do not add a shared backend, account system, or cross-domain analytics implementation.
- Do not change GetFlights' availability, search, or official booking handoff.
- Do not claim that GetFlights sells tickets; it helps visitors find availability and continues to official booking.

## GetFlights Promotion Banner

Add a compact promotion strip immediately below the GetFlights header and above normal page content.

### Audience and placement

- Render only in the Russian and Ukrainian locales.
- Render on normal public GetFlights screens, including the home, route SEO, and blog pages.
- Do not render on alert-management and other utility-only screens.
- Open the destination in a new tab so an in-progress flight search remains available.
- Make the strip dismissible and store dismissal in local storage for 30 days. Its dismissal state must be separate from the existing GetFlights information banner.

### Copy

- Russian: `Самые красивые пейзажи Грузии — в пешей прогулке с Топором каждые выходные.`
- Ukrainian: `Найкрасивіші краєвиди Грузії — у пішій прогулянці з Топором щовихідних.`
- CTA: Russian `Смотреть походы`; Ukrainian `Дивитися походи`.

### Destination and attribution

The CTA points to the Hike With Axe home page, not directly to a booking form or route page. Use this exact URL shape, replacing only `ru` with `ua` for Ukrainian:

```
https://hikewithaxe.ge/?utm_source=getflights&utm_medium=banner&utm_campaign=hike_with_axe_cross_promo&utm_content=ru
```

The existing GetFlights GA4 setup records `hike_with_axe_banner_clicked` when the CTA is activated. Event properties include the current locale, `placement: "header_banner"`, and the destination/campaign value. Analytics failures must not affect normal navigation.

## Hike With Axe Article

Publish one Russian-first, indexable Hike With Axe article at `/blog/kak-kupit-bilety-vanilla-sky/`.

The article must:

- explain when domestic Vanilla Sky flights are useful for travelling around Georgia;
- explain plainly that GetFlights makes it easier to find available Vanilla Sky dates and then passes visitors to official booking;
- link editorially to `https://getflights.ge/ru/`;
- link to localized GetFlights route pages only where the text genuinely discusses their destinations;
- include an internal Hike With Axe CTA to browse routes and upcoming hikes.

The article must be useful without leaving the page. Do not pad it with repetitive link anchors or add a global reciprocal link pattern.

## Component Boundaries

### GetFlights

Create a small, independently testable promotion-banner component plus a localized content/configuration module. The component owns rendering, dismissal, and the normal link interaction. The existing analytics module owns event construction and GA4 invocation.

The app decides whether the public screen is eligible to render the component. The component does not read flight availability or alter the booking flow.

### Hike With Axe

Keep article metadata and body content in the existing article-content architecture. Existing page/layout code owns canonical metadata, Open Graph metadata, rendering, and the normal internal article listing. The cross-promotion work does not require a new shared component or API between repositories.

## Data Flow

1. A GetFlights visitor loads a public Russian or Ukrainian page.
2. If the banner has not been dismissed in the previous 30 days, GetFlights renders the localized banner below its header.
3. A CTA click records `hike_with_axe_banner_clicked` and opens the tagged Hike With Axe home-page URL in a new tab.
4. Hike With Axe receives the tagged session normally; its existing analytics can use the UTM values for later attribution work.
5. The separate Hike With Axe article gives readers a relevant route back to the Russian GetFlights experience.

## Error Handling and Accessibility

- A missing or blocked GA4 function must leave the destination link fully usable.
- The close button needs a localized accessible name and must be keyboard operable.
- The banner must retain a sensible reading order between header and main content and remain usable on narrow screens.
- External links must have clear link text; the new-tab behavior should be communicated accessibly.
- A malformed or absent local-storage value must fall back to showing the banner without breaking rendering.

## Testing and Verification

### Automated tests

GetFlights tests cover:

- RU and UA render the banner; EN and KA do not.
- localized copy, CTA, destination, and UTM parameters are exact.
- CTA event properties include the correct locale and placement.
- local dismissal is isolated from the existing information banner and expires after 30 days.
- blocked or unavailable analytics do not block navigation.

Hike With Axe tests cover:

- article metadata and canonical route are correct;
- article text includes the useful Vanilla Sky/GetFlights explanation;
- outgoing GetFlights links are localized and exact;
- article has an internal CTA to routes or upcoming hikes.

### Release checks

Before deploying either site:

1. Run `npm test` and `npm run build` in GetFlights, then `npm run verify` in Hike With Axe.
2. Render the GetFlights RU and UA pages at desktop and mobile widths; confirm placement, dismissal, and new-tab CTA behavior.
3. Confirm the GA4 banner-click event uses the expected properties.
4. Render the Hike With Axe article; confirm canonical metadata, article links, and internal CTA.
5. Inspect the live deployment after release and record the 30-day start date for the outbound-click comparison.

## Rollout Decision

Keep the experiment focused for its first 30 days. Use the outbound-click rate by locale to decide whether to keep the banner, refine its copy, or move to a future destination-led variant that connects selected GetFlights routes to specific hiking content.

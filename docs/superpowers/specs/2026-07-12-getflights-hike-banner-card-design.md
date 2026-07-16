# GetFlights Hike With Axe Banner Card Design

## Goal

Turn the existing Hike With Axe promotion strip into a calm, editorial card that shares the GetFlights main-content width, uses the Truso Valley image on the right at desktop sizes, and remains visibly compact on mobile.

## Scope

- Keep the existing RU/UA-only eligibility, message, CTA text, UTM URL, new-tab behavior, GA4 event, and 30-day dismissal unchanged.
- Replace only the banner's visual structure and CSS.
- Use the live Hike With Axe Truso image at `https://hikewithaxe.ge/images/routes/truso-valley/hero.webp`; do not generate or duplicate an image asset in this repository.

## Desktop Layout

- The banner sits below the GetFlights header and above the subbar, inside a `max-width: 1060px` content container with normal page gutters.
- The card has a 16px radius, a subtle border, and no elevated-card shadow.
- The desktop card has a fixed height of 180px so the flight calendar and selected-day detail retain their existing short-viewport layout.
- The left side contains the existing localized message and CTA.
- The right side is a cropped Truso image panel occupying 45% of card width. It has only the card's right-side rounded corners and uses a soft left-edge fade into the text surface.
- The close button sits in the card's top-right corner, over the image.
- At desktop heights of 720px or less, preserve the card and make the routes rail shorter and independently scrollable; the calendar and selected-day detail remain reachable through ordinary page scrolling.

## Mobile Layout

- The card remains inside the page gutter and has a maximum total height of 245px.
- The Truso image becomes a 96px-high panoramic strip above the text.
- The message uses a compact readable size with a three-line maximum.
- The CTA is a lightweight teal text action aligned at the lower right of the text block.
- The close button remains over the image in the top-right corner.

## Accessibility and Resilience

- The image has localized descriptive alt text and is decorative only if a screen-reader visitor already receives equivalent meaningful content; here it remains informative.
- Keep the existing screen-reader new-tab text and localized dismiss label.
- The image must not affect click tracking, dismissal, or normal navigation if it fails to load.
- The component continues to return no markup for English, Georgian, dismissed, and alert-management views.

## Verification

- Component tests assert the image source, localized alt text, safe CTA, dismiss behavior, and RU/UA-only rendering.
- App tests retain the placement and GA4 assertions.
- Responsive layout tests cover the compact desktop rail budget and mobile card structure.
- Run `rtk npm test` and `rtk npm run build`; then inspect `/ru/` and `/ua/` at desktop and mobile widths before deployment.

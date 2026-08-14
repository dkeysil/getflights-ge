import { blogSeoPostUrl, getBlogSeoPostByPath } from './blog-seo.ts';
import { routeSeoPageUrl, routeSeoPages, type RouteSeoPage } from './route-seo.ts';

export const AGENT_READABLE_LAST_UPDATED = '2026-08-14';

const SITE_ORIGIN = 'https://getflights.ge';
const ENGLISH_FLIGHTS_URL = `${SITE_ORIGIN}/en/flights/`;
const ENGLISH_BOOKING_GUIDE_PATH = '/en/blog/how-to-buy-vanilla-sky-tickets/';
const ENGLISH_BOOKING_GUIDE_URL =
  blogSeoPostUrl(getBlogSeoPostByPath(ENGLISH_BOOKING_GUIDE_PATH)!);

export const agentReadableFiles = [
  { path: 'llms.txt', content: buildLlmsTxt() },
  { path: 'flights.md', content: buildFlightsMarkdown() },
  { path: 'booking.md', content: buildBookingMarkdown() },
];

type RouteSeoRoutePage = Extract<RouteSeoPage, { kind: 'route' }>;

export function buildLlmsTxt() {
  return lines([
    '# GetFlights.ge',
    '',
    `Last updated: ${AGENT_READABLE_LAST_UPDATED}`,
    'Canonical site: https://getflights.ge/',
    '',
    'GetFlights.ge is an independent flight-search helper for Vanilla Sky domestic flights in Georgia. It shows live route days and fares, then sends travelers to the official Vanilla Sky booking site for payment and ticket issuance.',
    '',
    'Primary agent tasks:',
    '- Find whether Vanilla Sky flies a Georgian domestic route.',
    '- Compare available route landing pages before choosing a date.',
    '- Select a highlighted date in the app to fetch live fares.',
    '- Hand payment and ticket issuance to the official Vanilla Sky website.',
    '',
    'Important constraints:',
    '- GetFlights.ge does not issue tickets or take payment.',
    '- Fares and seat availability are live data, not durable facts.',
    '- Tbilisi-area Vanilla Sky routes use Natakhtari airport in the official booking flow.',
    '- Weather can affect mountain flights; users should keep backup plans for tight connections.',
    '',
    'Agent-readable files:',
    '- /flights.md - agent-readable route catalog and flight-search facts',
    '- /booking.md - booking handoff, fare, passenger, and official-site caveats',
    '- /api-catalog.json - directory of public web services and agent-readable resources',
    '- /openapi.json - OpenAPI description for same-origin availability, fare lookup, and alert endpoints',
    '- /auth.md - login, token, and permission guidance for AI agents',
    '',
    'Canonical human pages:',
    '- https://getflights.ge/en/',
    '- https://getflights.ge/en/flights/',
    '- https://getflights.ge/en/flights/vanilla-sky/',
    '- https://getflights.ge/en/flights/natakhtari-airport/',
    '- https://getflights.ge/en/flights/tbilisi-batumi/',
    `- ${ENGLISH_BOOKING_GUIDE_URL}`,
    '',
    'Localized entry points:',
    '- English: https://getflights.ge/en/',
    '- Russian: https://getflights.ge/ru/',
    '- Ukrainian: https://getflights.ge/ua/',
    '- Georgian: https://getflights.ge/ka/',
  ]);
}

export function buildFlightsMarkdown() {
  const routeRows = routeSeoPages
    .filter((page): page is RouteSeoRoutePage => page.locale === 'en' && page.kind === 'route')
    .map((page) => {
      return `| ${page.route.publicFrom} | ${page.route.publicTo} | ${page.route.officialFrom} -> ${page.route.officialTo} | ${routeSeoPageUrl(page)} |`;
    });

  return lines([
    '# GetFlights.ge flight routes',
    '',
    `Last updated: ${AGENT_READABLE_LAST_UPDATED}`,
    `Canonical human URL: ${ENGLISH_FLIGHTS_URL}`,
    '',
    'This file summarizes the stable route catalog for agents. Use the route URL above, then select a highlighted date in the app to fetch live fares.',
    '',
    '| Public from | Public to | Official booking route | Human URL |',
    '|---|---|---|---|',
    ...routeRows,
    '',
    'Route facts:',
    '- Public Tbilisi route pages map to Natakhtari airport in the official Vanilla Sky booking flow.',
    '- The app only highlights dates returned by live Vanilla Sky availability checks.',
    '- Routes remain visible even when Vanilla Sky returns no currently available dates; the app shows "No dates available" for those routes.',
    '- Payment and ticket issuance happen on the official Vanilla Sky website, not on GetFlights.ge.',
    '',
    'Related human pages:',
    '- Vanilla Sky schedule hub: https://getflights.ge/en/flights/vanilla-sky/',
    '- Natakhtari airport guide: https://getflights.ge/en/flights/natakhtari-airport/',
    `- Booking guide: ${ENGLISH_BOOKING_GUIDE_URL}`,
  ]);
}

export function buildBookingMarkdown() {
  return lines([
    '# GetFlights.ge booking handoff',
    '',
    `Last updated: ${AGENT_READABLE_LAST_UPDATED}`,
    `Canonical human URL: ${ENGLISH_BOOKING_GUIDE_URL}`,
    '',
    'GetFlights.ge helps users find live Vanilla Sky flight dates and fares. Payment and ticket issuance happen on the official Vanilla Sky website.',
    '',
    'Agent task flow:',
    '1. Open the relevant route page or the flight search page.',
    '2. Choose a route from the live route list.',
    '3. Choose a highlighted available date.',
    '4. Adjust passengers if needed.',
    '5. Read the fare returned for that date.',
    '6. Use "Book on Vanilla Sky" to continue to the official booking site.',
    '',
    'Fare and availability caveats:',
    '- Fares are intentionally not published in this markdown file because they change by route, date, passenger mix, and live Vanilla Sky availability.',
    '- The durable source for a fare is the rendered app after a route and date are selected.',
    '- If the official Vanilla Sky backend cannot be reached, the app shows an error and the agent should not invent availability.',
    '',
    'Passenger constraints:',
    '- Maximum passenger count in the GetFlights.ge search UI: 4.',
    '- At least 1 adult passenger is required.',
    '- Passenger groups exposed by the UI: adults, children, infants.',
    '',
    'Ownership and support boundaries:',
    '- GetFlights.ge does not sell tickets, process payments, issue refunds, or operate flights.',
    '- For payment, ticket, refund, cancellation, baggage, airport-transfer, and flight-operation questions, use official Vanilla Sky information.',
  ]);
}

function lines(value: string[]) {
  return `${value.join('\n')}\n`;
}

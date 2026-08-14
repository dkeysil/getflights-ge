# GetFlights.ge booking handoff

Last updated: 2026-08-14
Canonical human URL: https://getflights.ge/en/blog/how-to-buy-vanilla-sky-tickets/

GetFlights.ge helps users find live Vanilla Sky flight dates and fares. Payment and ticket issuance happen on the official Vanilla Sky website.

Agent task flow:
1. Open the relevant route page or the flight search page.
2. Choose a route from the live route list.
3. Choose a highlighted available date.
4. Adjust passengers if needed.
5. Read the fare returned for that date.
6. Use "Book on Vanilla Sky" to continue to the official booking site.

Fare and availability caveats:
- Fares are intentionally not published in this markdown file because they change by route, date, passenger mix, and live Vanilla Sky availability.
- The durable source for a fare is the rendered app after a route and date are selected.
- If the official Vanilla Sky backend cannot be reached, the app shows an error and the agent should not invent availability.

Passenger constraints:
- Maximum passenger count in the GetFlights.ge search UI: 4.
- At least 1 adult passenger is required.
- Passenger groups exposed by the UI: adults, children, infants.

Ownership and support boundaries:
- GetFlights.ge does not sell tickets, process payments, issue refunds, or operate flights.
- For payment, ticket, refund, cancellation, baggage, airport-transfer, and flight-operation questions, use official Vanilla Sky information.

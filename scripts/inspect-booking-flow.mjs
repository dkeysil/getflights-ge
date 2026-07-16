import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'https://ticket.vanillasky.ge';
const TICKETS_URL = `${BASE_URL}/en/tickets`;
const HEADLESS = process.env.HEADLESS !== 'false';
const OUT_DIR = path.join(
  process.cwd(),
  'artifacts',
  'booking-inspection',
  new Date().toISOString().replace(/[:.]/g, '-'),
);

const cityIds = new Map([
  ['1', 'Tbilisi'],
  ['2', 'Ambrolauri'],
  ['4', 'Batumi'],
  ['5', 'Kutaisi'],
  ['6', 'Mestia'],
  ['7', 'Natakhtari'],
]);

function isInterestingUrl(url) {
  return url.startsWith(BASE_URL) && !url.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?)(\?|$)/);
}

function shortValue(value) {
  if (!value) return value;
  return value.length > 600 ? `${value.slice(0, 600)}...` : value;
}

async function dumpForms(page, label) {
  const forms = await page.$$eval('form', (nodes) =>
    nodes.map((form) => ({
      id: form.id || null,
      className: form.className || null,
      method: (form.getAttribute('method') || 'get').toUpperCase(),
      action: form.action,
      fields: Array.from(form.querySelectorAll('input, select, textarea, button')).map((field) => ({
        tag: field.tagName.toLowerCase(),
        type: field.getAttribute('type'),
        id: field.id || null,
        name: field.getAttribute('name'),
        value: field.value,
        required: field.required || false,
        options:
          field.tagName.toLowerCase() === 'select'
            ? Array.from(field.options).map((option) => ({
                value: option.value,
                text: option.textContent.trim(),
                selected: option.selected,
                disabled: option.disabled,
              }))
            : undefined,
      })),
    })),
  );
  await writeFile(path.join(OUT_DIR, `${label}-forms.json`), JSON.stringify(forms, null, 2));
  return forms;
}

async function savePage(page, label) {
  await writeFile(path.join(OUT_DIR, `${label}.html`), await page.content());
  await page.screenshot({ path: path.join(OUT_DIR, `${label}.png`), fullPage: true });
}

async function getJson(page, url) {
  const response = await page.request.get(url, { timeout: 30_000 });
  const text = await response.text();
  try {
    return { status: response.status(), data: JSON.parse(text), text };
  } catch {
    return { status: response.status(), data: null, text };
  }
}

async function mapBackendAvailability(page, departureOptions) {
  const routeMap = [];

  for (const from of departureOptions) {
    const destinationUrl = `${BASE_URL}/custom/check-dest/${from.value}`;
    const destinationResponse = await getJson(page, destinationUrl);
    const destinationIds = Array.isArray(destinationResponse.data) ? destinationResponse.data.map(String) : [];

    routeMap.push({
      endpoint: destinationUrl,
      from: from.value,
      fromName: from.text,
      allowedDestinations: destinationIds.map((id) => ({
        id,
        name: cityIds.get(id) ?? id,
      })),
      status: destinationResponse.status,
    });
  }

  const datedRoutes = [];
  for (const route of routeMap) {
    for (const destination of route.allowedDestinations) {
      const flightUrl = `${BASE_URL}/custom/check-flight/${route.from}/${destination.id}`;
      const flightResponse = await getJson(page, flightUrl);
      const dates = flightResponse.data ?? {};
      datedRoutes.push({
        endpoint: flightUrl,
        from: route.from,
        fromName: route.fromName,
        to: destination.id,
        toName: destination.name,
        status: flightResponse.status,
        dates,
        outboundDateCount: Array.isArray(dates.to) ? dates.to.length : 0,
        returnDateCount: Array.isArray(dates.from) ? dates.from.length : 0,
      });
    }
  }

  await writeFile(path.join(OUT_DIR, 'backend-route-map.json'), JSON.stringify({ routeMap, datedRoutes }, null, 2));
  return { routeMap, datedRoutes };
}

async function submitFirstSearch(page, datedRoutes) {
  const route = datedRoutes.find((candidate) => candidate.outboundDateCount > 0);
  if (!route) return null;

  const date = route.dates.to[0];

  await page.evaluate(
    ({ from, to, dateValue }) => {
      const setValue = (selector, value) => {
        const node = document.querySelector(selector);
        if (!node) throw new Error(`Missing field: ${selector}`);
        node.value = value;
        node.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const arrive = document.querySelector('#fly-arrive');
      const selectedDestination = arrive?.querySelector(`option[value="${to}"]`);
      if (selectedDestination) selectedDestination.disabled = false;

      setValue('#fly-departure', from);
      setValue('#fly-arrive', to);
      document.querySelector('#edit-types-0').checked = true;
      setValue('input[name="date_picker"]', dateValue);
      setValue('input[name="person_count"]', '1');
      setValue('input[name="person_types[adult]"]', '1');
      setValue('input[name="person_types[child]"]', '0');
      setValue('input[name="person_types[infant]"]', '0');
    },
    { from: route.from, to: route.to, dateValue: date },
  );

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 45_000 }).catch(() => undefined),
    page.locator('#edit-submit').click({ timeout: 10_000 }),
  ]);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

  return route;
}

const browser = await chromium.launch({ headless: HEADLESS });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();
const network = [];

page.on('request', (request) => {
  if (!isInterestingUrl(request.url())) return;
  network.push({
    phase: 'request',
    method: request.method(),
    url: request.url(),
    postData: shortValue(request.postData()),
  });
});

page.on('response', async (response) => {
  if (!isInterestingUrl(response.url())) return;
  const entry = {
    phase: 'response',
    status: response.status(),
    url: response.url(),
    contentType: response.headers()['content-type'],
  };

  if (response.url().includes('/custom/')) {
    entry.body = shortValue(await response.text().catch(() => null));
  }

  network.push(entry);
});

await mkdir(OUT_DIR, { recursive: true });

await page.goto(TICKETS_URL, { waitUntil: 'networkidle', timeout: 45_000 });
await savePage(page, '01-ticket-search');
const initialForms = await dumpForms(page, '01-ticket-search');

const departureForm = initialForms.find((form) => form.id === 'form-select-date');
const departureOptions =
  departureForm
    ?.fields.find((field) => field.name === 'departure')
    ?.options?.filter((option) => option.value) ?? [];

const { routeMap, datedRoutes } = await mapBackendAvailability(page, departureOptions);
const submittedRoute = await submitFirstSearch(page, datedRoutes);

if (submittedRoute) {
  await savePage(page, '02-search-results');
  await dumpForms(page, '02-search-results');
}

await writeFile(path.join(OUT_DIR, 'network.json'), JSON.stringify(network, null, 2));

console.log(`Artifacts: ${OUT_DIR}`);
console.log('Destination map:');
for (const route of routeMap) {
  const destinations = route.allowedDestinations.map((item) => `${item.name}(${item.id})`).join(', ') || 'none';
  console.log(`- ${route.fromName}(${route.from}) -> ${destinations}`);
}

console.log('Routes with current outbound dates:');
for (const route of datedRoutes.filter((item) => item.outboundDateCount > 0)) {
  console.log(`- ${route.fromName}(${route.from}) -> ${route.toName}(${route.to}): ${route.outboundDateCount}`);
}

if (submittedRoute) {
  console.log(
    `Submitted search only: ${submittedRoute.fromName}(${submittedRoute.from}) -> ${submittedRoute.toName}(${submittedRoute.to}) on ${submittedRoute.dates.to[0]}`,
  );
} else {
  console.log('No route with an outbound date was found, so no search form was submitted.');
}

await browser.close();

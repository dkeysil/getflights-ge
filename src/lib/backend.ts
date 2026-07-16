import {
  type DestinationMap,
  type RouteAvailabilityMap,
  type RouteCatalogItem,
} from './availability';
import type { OfficialFormLocale } from './i18n';

const API_PREFIX = '/api';
const BACKEND_PREFIX = '/vs-backend';
const OFFICIAL_ORIGIN = 'https://ticket.vanillasky.ge';

export type CacheStatus = 'hit' | 'miss' | 'refreshed' | 'refreshing' | 'stale' | 'cooldown';

export type AvailabilitySnapshot = {
  destinationMap: DestinationMap;
  routeCatalog: RouteCatalogItem[];
  availability: RouteAvailabilityMap;
  loadedAt: string;
  cacheStatus?: CacheStatus;
  stale?: boolean;
  refreshAllowedAt?: string;
};

export type SearchForm = {
  action: string;
  formBuildId: string;
  formId: string;
};

export type FlightSearchInput = {
  tripType: 'one-way' | 'round-trip';
  fromId: string;
  toId: string;
  outboundDate: string;
  returnDate?: string;
  officialLocale?: OfficialFormLocale;
  passengers: {
    adult: number;
    child: number;
    infant: number;
  };
};

export type FlightOption = {
  checkboxName: string;
  checkboxValue: string;
  fromName: string;
  toName: string;
  dateLabel: string;
  time: string;
  priceGel: string;
  priceUsd: string | null;
};

export type FlightSearchResult = {
  resultUrl: string;
  flights: FlightOption[];
  loadedAt?: string;
  cacheStatus?: CacheStatus;
  stale?: boolean;
};

export type AvailabilityProgress = (message: string) => void;

export type OfficialPurchaseRequest = {
  action: string;
  fields: Record<string, string>;
};

export type AvailabilityRequestOptions = {
  refresh?: boolean;
};

type CachedFlightResponse = {
  resultUrl: string;
  html: string;
  loadedAt?: string;
  cacheStatus?: CacheStatus;
  stale?: boolean;
};

export async function loadAvailabilitySnapshot(
  signal?: AbortSignal,
  onProgress?: AvailabilityProgress,
  options: AvailabilityRequestOptions = {},
): Promise<AvailabilitySnapshot> {
  onProgress?.(options.refresh ? 'Refreshing cached flight dates' : 'Loading cached flight dates');
  return fetchJson<AvailabilitySnapshot>(
    buildAvailabilityApiPath(options),
    signal,
    { method: options.refresh ? 'POST' : 'GET' },
  );
}

export async function searchFlights(
  input: FlightSearchInput,
  signal?: AbortSignal,
): Promise<FlightSearchResult> {
  const response = await fetchJson<CachedFlightResponse>(`${API_PREFIX}/flights?${toFlightSearchParams(input)}`, signal);
  return {
    resultUrl: response.resultUrl,
    flights: parseFlightOptions(response.html),
    loadedAt: response.loadedAt,
    cacheStatus: response.cacheStatus,
    stale: response.stale,
  };
}

export async function getOfficialPurchaseRequest(
  input: FlightSearchInput,
  signal?: AbortSignal,
): Promise<OfficialPurchaseRequest> {
  const searchForm = await getSearchForm(signal, input.officialLocale);
  return {
    action: getOfficialPurchaseAction(searchForm.action),
    fields: buildSearchFields(input, searchForm),
  };
}

export function buildSearchFields(
  input: FlightSearchInput,
  searchForm: SearchForm,
): Record<string, string> {
  const passengerCount = input.passengers.adult + input.passengers.child + input.passengers.infant;

  return {
    types: input.tripType === 'round-trip' ? '1' : '0',
    departure: input.fromId,
    date_picker: input.outboundDate,
    arrive: input.toId,
    date_picker_arrive: input.returnDate ?? formatOfficialFallbackDate(new Date()),
    person_count: String(passengerCount),
    'person_types[adult]': String(input.passengers.adult),
    'person_types[child]': String(input.passengers.child),
    'person_types[infant]': String(input.passengers.infant),
    op: '',
    form_build_id: searchForm.formBuildId,
    form_id: searchForm.formId,
  };
}

function formatOfficialFallbackDate(date: Date) {
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function getOfficialPurchaseAction(action: string) {
  const url = new URL(action || '/en/tickets', OFFICIAL_ORIGIN);
  if (url.origin !== OFFICIAL_ORIGIN) {
    throw new Error('Unsafe Vanilla Sky form action.');
  }

  return url.toString();
}

export function parseSearchForm(html: string): SearchForm {
  const document = parseHtml(html);
  const form = document.querySelector<HTMLFormElement>('#form-select-date');
  const formBuildId = form?.querySelector<HTMLInputElement>('input[name="form_build_id"]')?.value;
  const formId = form?.querySelector<HTMLInputElement>('input[name="form_id"]')?.value;

  if (!form || !formBuildId || !formId) {
    throw new Error('Could not parse the Vanilla Sky search form.');
  }

  return {
    action: form.getAttribute('action') ?? '/en/tickets',
    formBuildId,
    formId,
  };
}

export function parseFlightOptions(html: string): FlightOption[] {
  const document = parseHtml(html);

  return Array.from(document.querySelectorAll<HTMLElement>('.flight-item')).map((item) => {
    const article = item.closest('article');
    const cityNames = Array.from(article?.querySelectorAll('.flight-city-name') ?? []).map((node) =>
      normalizeText(node.textContent),
    );
    const checkbox = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const dateNode = item.querySelector<HTMLElement>('.flight-dates');
    const dateLabel = normalizeText(dateNode?.querySelector('.flight-item-small')?.textContent);
    const time = normalizeText(
      Array.from(dateNode?.childNodes ?? [])
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join(' '),
    );
    const priceNode = item.querySelector<HTMLElement>('.gel');
    const usdNode = item.querySelector<HTMLElement>('.style-usd-price');
    const usdText = normalizeText(usdNode?.textContent).replace(/^\//, '').trim();
    const gelText = normalizeText(priceNode?.childNodes[0]?.textContent);

    return {
      checkboxName: checkbox?.name ?? '',
      checkboxValue: checkbox?.value ?? '',
      fromName: cityNames[0] ?? '',
      toName: cityNames[1] ?? '',
      dateLabel,
      time,
      priceGel: gelText,
      priceUsd: usdText || null,
    };
  });
}

async function getSearchForm(signal?: AbortSignal, officialLocale: OfficialFormLocale = 'en') {
  const html = await fetchText(`/${officialLocale}/tickets`, signal);
  return parseSearchForm(html);
}

async function fetchJson<T>(path: string, signal?: AbortSignal, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { Accept: 'application/json', ...init.headers },
    credentials: 'omit',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status} ${path}`);
  }

  return response.json() as Promise<T>;
}

function toFlightSearchParams(input: FlightSearchInput) {
  const params = new URLSearchParams({
    tripType: input.tripType,
    fromId: input.fromId,
    toId: input.toId,
    outboundDate: input.outboundDate,
    adult: String(input.passengers.adult),
    child: String(input.passengers.child),
    infant: String(input.passengers.infant),
  });

  if (input.returnDate) {
    params.set('returnDate', input.returnDate);
  }

  return params;
}

function buildAvailabilityApiPath(options: AvailabilityRequestOptions) {
  return options.refresh ? `${API_PREFIX}/availability/refresh` : `${API_PREFIX}/availability`;
}

async function fetchText(path: string, signal?: AbortSignal) {
  const response = await fetch(`${BACKEND_PREFIX}${path}`, {
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Backend page request failed: ${response.status} ${path}`);
  }

  return response.text();
}

function parseHtml(html: string) {
  return new DOMParser().parseFromString(html, 'text/html');
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

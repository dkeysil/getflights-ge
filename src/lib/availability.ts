import { toIntlLocale, type Locale } from './i18n';

export type City = {
  id: string;
  name: string;
};

export type FlightDatesResponse = {
  from?: string[];
  to?: string[];
};

export type NormalizedFlightDates = {
  outbound: string[];
  returns: string[];
};

export type DestinationMap = Record<string, string[]>;

export type RouteCatalogItem = {
  from: City;
  destinations: City[];
};

export type RouteAvailabilityMap = Record<string, NormalizedFlightDates>;

export type CalendarDay = {
  iso: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isAvailable: boolean;
  isToday: boolean;
};

export type MonthCalendar = {
  year: number;
  monthIndex: number;
  monthLabel: string;
  availableDates: string[];
  weeks: CalendarDay[][];
};

export const CITIES: City[] = [
  { id: '1', name: 'Tbilisi' },
  { id: '2', name: 'Ambrolauri' },
  { id: '4', name: 'Batumi' },
  { id: '5', name: 'Kutaisi' },
  { id: '6', name: 'Mestia' },
  { id: '7', name: 'Tbilisi (Natakhtari airport)' },
];

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function routeKey(fromId: string, toId: string) {
  return `${fromId}:${toId}`;
}

export function normalizeFlightDates(response: FlightDatesResponse): NormalizedFlightDates {
  return {
    outbound: sortedUniqueDates(response.to),
    returns: sortedUniqueDates(response.from),
  };
}

export function buildRouteCatalog(cities: City[], destinationMap: DestinationMap): RouteCatalogItem[] {
  const citiesById = new Map(cities.map((city) => [city.id, city]));

  return cities.map((from) => ({
    from,
    destinations: (destinationMap[from.id] ?? [])
      .map((id) => citiesById.get(String(id)))
      .filter((city): city is City => Boolean(city)),
  }));
}

export function buildPurchasableRouteCatalog(
  routeCatalog: RouteCatalogItem[],
  availability: RouteAvailabilityMap,
): RouteCatalogItem[] {
  return routeCatalog
    .map((route) => ({
      from: route.from,
      destinations: route.destinations.filter(
        (destination) => getRouteAvailability(route.from.id, destination.id, availability).outbound.length > 0,
      ),
    }))
    .filter((route) => route.destinations.length > 0);
}

export function getRouteAvailability(
  fromId: string,
  toId: string,
  availability: RouteAvailabilityMap,
): NormalizedFlightDates {
  return availability[routeKey(fromId, toId)] ?? { outbound: [], returns: [] };
}

export function buildMonthCalendar(
  year: number,
  monthIndex: number,
  availableDates: string[],
  locale: Locale = 'en',
): MonthCalendar {
  const monthPrefix = `${year}-${pad(monthIndex + 1)}-`;
  const availableSet = new Set(availableDates);
  const availableDatesInMonth = sortedUniqueDates(
    availableDates.filter((date) => date.startsWith(monthPrefix)),
  );
  const firstOfMonth = new Date(year, monthIndex, 1);
  const todayIso = toIsoDate(new Date());
  const cells: CalendarDay[] = [];

  // Monday-first grid: shift so Mon=0 … Sun=6 (the region uses Monday-first weeks).
  const leadingDays = (firstOfMonth.getDay() + 6) % 7;

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(year, monthIndex, 1 - leadingDays + index);
    const iso = toIsoDate(date);
    cells.push({
      iso,
      dayOfMonth: date.getDate(),
      inCurrentMonth: date.getMonth() === monthIndex,
      isAvailable: availableSet.has(iso),
      isToday: iso === todayIso,
    });
  }

  return {
    year,
    monthIndex,
    monthLabel: new Intl.DateTimeFormat(toIntlLocale(locale), { month: 'long', year: 'numeric' }).format(
      firstOfMonth,
    ),
    availableDates: availableDatesInMonth,
    weeks: chunk(cells, 7),
  };
}

export function shiftMonth(year: number, monthIndex: number, delta: number) {
  const next = new Date(year, monthIndex + delta, 1);
  return {
    year: next.getFullYear(),
    monthIndex: next.getMonth(),
  };
}

function sortedUniqueDates(values: string[] = []) {
  return [...new Set(values.filter((value) => isoDatePattern.test(value)))].sort();
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

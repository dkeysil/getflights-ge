export const CITIES = [
  { id: '1', name: 'Tbilisi' },
  { id: '2', name: 'Ambrolauri' },
  { id: '4', name: 'Batumi' },
  { id: '5', name: 'Kutaisi' },
  { id: '6', name: 'Mestia' },
  { id: '7', name: 'Tbilisi (Natakhtari airport)' },
];

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function routeKey(fromId, toId) {
  return `${fromId}:${toId}`;
}

export async function buildAvailabilitySnapshot({ fetchJson, now = () => new Date() }) {
  const destinationEntries = await Promise.all(
    CITIES.map(async (city) => {
      const destinations = await fetchJson(`/custom/check-dest/${city.id}`);
      return [city.id, destinations.map(String)];
    }),
  );
  const destinationMap = Object.fromEntries(destinationEntries);
  const routeCatalog = buildRouteCatalog(destinationMap);
  const routePairs = routeCatalog.flatMap((route) =>
    route.destinations.map((destination) => ({
      fromId: route.from.id,
      toId: destination.id,
    })),
  );
  const availabilityEntries = await Promise.all(
    routePairs.map(async ({ fromId, toId }) => {
      const dates = await fetchJson(`/custom/check-flight/${fromId}/${toId}`);
      return [routeKey(fromId, toId), normalizeFlightDates(dates)];
    }),
  );

  return {
    destinationMap,
    routeCatalog,
    availability: Object.fromEntries(availabilityEntries),
    loadedAt: now().toISOString(),
  };
}

function buildRouteCatalog(destinationMap) {
  const citiesById = new Map(CITIES.map((city) => [city.id, city]));
  return CITIES.map((from) => ({
    from,
    destinations: (destinationMap[from.id] ?? [])
      .map((id) => citiesById.get(String(id)))
      .filter(Boolean),
  }));
}

function normalizeFlightDates(response) {
  return {
    outbound: sortedUniqueDates(response?.to),
    returns: sortedUniqueDates(response?.from),
  };
}

function sortedUniqueDates(values = []) {
  return [...new Set(values.filter((value) => isoDatePattern.test(value)))].sort();
}

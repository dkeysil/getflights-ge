export type AlertsEnv = {
  VITE_ALERTS_ENABLED?: string;
};

export type AlertRange = {
  dateFrom: string;
  dateTo: string;
};

export type AlertRouteInput = AlertRange & {
  locale: string;
  fromId: string;
  toId: string;
};

export type RouteAlertSubscriptionInput = AlertRouteInput & {
  email: string;
};

export type ManageLinkRequest = {
  email: string;
  locale: string;
};

export type UnsubscribeManagedAlertRequest = {
  id: string;
  token: string;
};

export function readAlertsEnabled() {
  return alertsEnabled({ VITE_ALERTS_ENABLED: import.meta.env.VITE_ALERTS_ENABLED });
}

export function alertsEnabled(env: AlertsEnv = {}) {
  return env.VITE_ALERTS_ENABLED === 'true';
}

export function defaultAlertRange(date: Date): AlertRange {
  const year = date.getFullYear();
  const monthIndex = date.getDate() <= 7 ? date.getMonth() : date.getMonth() + 1;
  const firstOfMonth = new Date(year, monthIndex, 1);
  const lastOfMonth = new Date(year, monthIndex + 1, 0);

  return {
    dateFrom: formatIsoDate(firstOfMonth),
    dateTo: formatIsoDate(lastOfMonth),
  };
}

export function buildAlertReturnUrl(input: AlertRouteInput) {
  const params = new URLSearchParams({
    from: input.fromId,
    to: input.toId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });

  return `/${input.locale}/?${params.toString()}`;
}

export async function subscribeToRouteAlerts(input: RouteAlertSubscriptionInput) {
  return fetchJson('/api/alerts/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      fromId: input.fromId,
      toId: input.toId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      locale: input.locale,
    }),
  });
}

export async function requestManageLink(input: ManageLinkRequest) {
  return fetchJson('/api/alerts/manage-link', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      locale: input.locale,
    }),
  });
}

export async function loadManagedAlerts(token: string) {
  return fetchJson(`/api/alerts/manage?token=${encodeURIComponent(token)}`);
}

export async function unsubscribeManagedAlert(input: UnsubscribeManagedAlertRequest) {
  return fetchJson(`/api/alerts/${encodeURIComponent(input.id)}/unsubscribe?token=${encodeURIComponent(input.token)}`, {
    method: 'POST',
  });
}

async function fetchJson(path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : null),
      ...init.headers,
    },
    credentials: 'omit',
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }

  return response.json();
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

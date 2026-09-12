export type TelegramAlertLinkInput = {
  fromId: string;
  toId: string;
  dateFrom: string;
  dateTo: string;
  locale: string;
};

export type TelegramAlertLink = {
  // The one-time alert token. The login widget exchanges it for a binding; the
  // deep-link URL carries the same token for the new-chat fallback.
  token: string;
  url: string;
  expiresAt: string;
  matchingDates: string[];
};

const telegramDeepLinkHost = 't.me';

// The browser opens whatever the API hands back, so the host is verified here
// rather than trusted.
export function isTelegramDeepLink(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === telegramDeepLinkHost;
  } catch {
    return false;
  }
}

export async function createTelegramAlertLink(input: TelegramAlertLinkInput): Promise<TelegramAlertLink> {
  const response = await fetch('/api/alerts/telegram/link', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    credentials: 'omit',
    body: JSON.stringify({
      fromId: input.fromId,
      toId: input.toId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      locale: input.locale,
    }),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as Partial<TelegramAlertLink>;
  if (typeof payload?.url !== 'string' || !isTelegramDeepLink(payload.url)) {
    throw new Error('Unexpected Telegram link response.');
  }
  if (typeof payload?.token !== 'string' || !payload.token) {
    throw new Error('Unexpected Telegram link response.');
  }

  return {
    token: payload.token,
    url: payload.url,
    expiresAt: typeof payload.expiresAt === 'string' ? payload.expiresAt : '',
    matchingDates: Array.isArray(payload.matchingDates) ? payload.matchingDates : [],
  };
}

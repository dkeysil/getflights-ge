import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTelegramAlertLink, isTelegramDeepLink } from './telegram-alerts';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('isTelegramDeepLink', () => {
  it('accepts only https t.me links', () => {
    expect(isTelegramDeepLink('https://t.me/get_flights_ge_bot?start=abc')).toBe(true);
    expect(isTelegramDeepLink('http://t.me/get_flights_ge_bot?start=abc')).toBe(false);
    expect(isTelegramDeepLink('https://evil.example/t.me?start=abc')).toBe(false);
    expect(isTelegramDeepLink('https://t.me.evil.example/bot')).toBe(false);
    expect(isTelegramDeepLink('javascript:alert(1)')).toBe(false);
    expect(isTelegramDeepLink('')).toBe(false);
  });
});

describe('createTelegramAlertLink', () => {
  const input = { fromId: '7', toId: '4', dateFrom: '2026-08-01', dateTo: '2026-08-31', locale: 'en' };

  it('posts the route and range and returns the deep link', async () => {
    const fetchMock = stubFetch(
      Response.json({
        token: 'abc',
        url: 'https://t.me/get_flights_ge_bot?start=abc',
        expiresAt: '2026-08-01T10:05:00.000Z',
        matchingDates: ['2026-08-03'],
      }),
    );

    const link = await createTelegramAlertLink(input);

    expect(fetchMock).toHaveBeenCalledWith('/api/alerts/telegram/link', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual(input);
    expect(link).toEqual({
      token: 'abc',
      url: 'https://t.me/get_flights_ge_bot?start=abc',
      expiresAt: '2026-08-01T10:05:00.000Z',
      matchingDates: ['2026-08-03'],
    });
  });

  it('throws when the API fails', async () => {
    stubFetch(Response.json({ error: 'Too many alert requests.' }, { status: 429 }));

    await expect(createTelegramAlertLink(input)).rejects.toThrow();
  });

  it('refuses a response that is not a Telegram deep link', async () => {
    stubFetch(Response.json({ url: 'https://evil.example/phish', expiresAt: '2026-08-01T10:15:00.000Z' }));

    await expect(createTelegramAlertLink(input)).rejects.toThrow();
  });

  it('tolerates a missing matchingDates field', async () => {
    stubFetch(
      Response.json({ token: 'abc', url: 'https://t.me/get_flights_ge_bot?start=abc', expiresAt: '2026-08-01T10:05:00.000Z' }),
    );

    expect((await createTelegramAlertLink(input)).matchingDates).toEqual([]);
  });

  // The login binding spends the token, so a response without one is unusable
  // even though its deep link looks fine.
  it('refuses a response with no one-time token', async () => {
    stubFetch(Response.json({ url: 'https://t.me/get_flights_ge_bot?start=abc', expiresAt: '2026-08-01T10:05:00.000Z' }));

    await expect(createTelegramAlertLink(input)).rejects.toThrow();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindTelegramLogin, isTelegramBotLink, telegramLoginConfig } from './telegram-login';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('telegramLoginConfig', () => {
  it('enables the widget only when the flag and a usable bot username are both set', () => {
    expect(
      telegramLoginConfig({ VITE_TELEGRAM_LOGIN_ENABLED: 'true', VITE_TELEGRAM_BOT_USERNAME: 'get_flights_ge_bot' }),
    ).toEqual({ enabled: true, botUsername: 'get_flights_ge_bot' });
    expect(telegramLoginConfig({ VITE_TELEGRAM_LOGIN_ENABLED: 'true', VITE_TELEGRAM_BOT_USERNAME: '@bot_name' })).toEqual({
      enabled: true,
      botUsername: 'bot_name',
    });
  });

  // A production build sets neither variable, so this is the state that keeps
  // the widget off the public site.
  it('stays off for an unset, false or non-exact flag', () => {
    for (const env of [
      {},
      { VITE_TELEGRAM_BOT_USERNAME: 'get_flights_ge_bot' },
      { VITE_TELEGRAM_LOGIN_ENABLED: 'false', VITE_TELEGRAM_BOT_USERNAME: 'get_flights_ge_bot' },
      { VITE_TELEGRAM_LOGIN_ENABLED: '1', VITE_TELEGRAM_BOT_USERNAME: 'get_flights_ge_bot' },
      { VITE_TELEGRAM_LOGIN_ENABLED: 'TRUE', VITE_TELEGRAM_BOT_USERNAME: 'get_flights_ge_bot' },
    ]) {
      expect(telegramLoginConfig(env).enabled).toBe(false);
    }
  });

  it('refuses a bot username Telegram could never issue', () => {
    for (const botUsername of ['', 'abc', 'has spaces', 'has-dash', 'x'.repeat(33)]) {
      expect(telegramLoginConfig({ VITE_TELEGRAM_LOGIN_ENABLED: 'true', VITE_TELEGRAM_BOT_USERNAME: botUsername })).toEqual({
        enabled: false,
        botUsername: null,
      });
    }
  });
});

describe('isTelegramBotLink', () => {
  it('accepts only https t.me links', () => {
    expect(isTelegramBotLink('https://t.me/get_flights_ge_bot')).toBe(true);
    expect(isTelegramBotLink('http://t.me/get_flights_ge_bot')).toBe(false);
    expect(isTelegramBotLink('https://t.me.evil.example/bot')).toBe(false);
    expect(isTelegramBotLink('javascript:alert(1)')).toBe(false);
  });
});

describe('bindTelegramLogin', () => {
  const user = { id: '555', first_name: 'Nino', auth_date: '1785312000', hash: 'a'.repeat(64) };

  it('posts the token with the signed payload and reports a completed binding', async () => {
    const fetchMock = stubFetch(Response.json({ ok: true, needsStart: false }));

    await expect(bindTelegramLogin({ token: 'tok', user })).resolves.toEqual({ needsStart: false, startUrl: null });
    expect(fetchMock).toHaveBeenCalledWith('/api/alerts/telegram/login', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({ token: 'tok', user });
  });

  it('passes through the new-chat fallback link when Telegram may not message the user yet', async () => {
    stubFetch(Response.json({ ok: true, needsStart: true, startUrl: 'https://t.me/get_flights_ge_bot' }));

    await expect(bindTelegramLogin({ token: 'tok', user })).resolves.toEqual({
      needsStart: true,
      startUrl: 'https://t.me/get_flights_ge_bot',
    });
  });

  it('drops a fallback link that is not a Telegram link', async () => {
    stubFetch(Response.json({ ok: true, needsStart: true, startUrl: 'https://evil.example/phish' }));

    await expect(bindTelegramLogin({ token: 'tok', user })).resolves.toEqual({ needsStart: true, startUrl: null });
  });

  // 404 is what a production Worker answers, and 410 an expired or replayed
  // token: neither may look like a successful subscription.
  it('throws on every non-ok status, including the disabled and spent-token cases', async () => {
    for (const status of [404, 401, 403, 410, 429, 500]) {
      stubFetch(Response.json({ error: 'nope' }, { status }));
      await expect(bindTelegramLogin({ token: 'tok', user })).rejects.toThrow();
    }
  });
});

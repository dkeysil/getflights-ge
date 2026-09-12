import { describe, expect, it } from 'vitest';
import {
  buildTelegramSearchUrl,
  buildTelegramStartUrl,
  createTelegramLinkToken,
  normalizeTelegramBotUsername,
  parseTelegramCommand,
  parseTelegramUpdate,
} from './telegram-domain.js';

describe('telegram link tokens', () => {
  it('creates a token Telegram accepts as a /start payload', () => {
    const token = createTelegramLinkToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it('does not repeat tokens', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => createTelegramLinkToken()));
    expect(tokens.size).toBe(50);
  });
});

describe('normalizeTelegramBotUsername', () => {
  it('accepts a bare username and strips a leading @', () => {
    expect(normalizeTelegramBotUsername('get_flights_ge_bot')).toBe('get_flights_ge_bot');
    expect(normalizeTelegramBotUsername('@get_flights_ge_bot')).toBe('get_flights_ge_bot');
  });

  it('rejects usernames that could escape the t.me path', () => {
    expect(normalizeTelegramBotUsername('bad/../evil')).toBeNull();
    expect(normalizeTelegramBotUsername('evil.com/bot')).toBeNull();
    expect(normalizeTelegramBotUsername('')).toBeNull();
    expect(normalizeTelegramBotUsername(undefined)).toBeNull();
  });
});

describe('buildTelegramStartUrl', () => {
  it('builds the documented deep link', () => {
    expect(buildTelegramStartUrl({ botUsername: 'get_flights_ge_bot', token: 'abc123' })).toBe(
      'https://t.me/get_flights_ge_bot?start=abc123',
    );
  });

  it('returns null for an unusable username', () => {
    expect(buildTelegramStartUrl({ botUsername: 'nope!', token: 'abc123' })).toBeNull();
  });
});

describe('buildTelegramSearchUrl', () => {
  it('restores the route and range in the app', () => {
    expect(
      buildTelegramSearchUrl({
        appOrigin: 'https://getflights.ge',
        locale: 'ka',
        fromId: '7',
        toId: '4',
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
      }),
    ).toBe('https://getflights.ge/ka/?from=7&to=4&dateFrom=2026-08-01&dateTo=2026-08-31');
  });
});

describe('parseTelegramUpdate', () => {
  const baseUpdate = {
    update_id: 42,
    message: {
      chat: { id: 12345, type: 'private' },
      text: '/start abc123',
    },
  };

  it('extracts the update id, chat id and text of a private message', () => {
    expect(parseTelegramUpdate(baseUpdate)).toEqual({
      updateId: '42',
      chatId: '12345',
      text: '/start abc123',
    });
  });

  it('ignores updates without a private chat message', () => {
    expect(parseTelegramUpdate(null)).toBeNull();
    expect(parseTelegramUpdate({})).toBeNull();
    expect(parseTelegramUpdate({ update_id: 1 })).toBeNull();
    expect(parseTelegramUpdate({ update_id: 1, message: { chat: { id: 1, type: 'group' }, text: '/start' } })).toBeNull();
    expect(parseTelegramUpdate({ update_id: 1, message: { chat: { id: 1, type: 'private' } } })).toBeNull();
    expect(parseTelegramUpdate({ update_id: 1, channel_post: { chat: { id: 1, type: 'channel' }, text: '/start' } })).toBeNull();
  });

  it('ignores an oversized message text instead of storing it', () => {
    expect(
      parseTelegramUpdate({ update_id: 1, message: { chat: { id: 1, type: 'private' }, text: 'x'.repeat(5000) } }),
    ).toBeNull();
  });
});

describe('parseTelegramCommand', () => {
  it('reads a start command with its payload', () => {
    expect(parseTelegramCommand('/start abc123')).toEqual({ command: 'start', argument: 'abc123' });
  });

  it('accepts the @botname suffix Telegram adds', () => {
    expect(parseTelegramCommand('/stop@get_flights_ge_bot')).toEqual({ command: 'stop', argument: '' });
  });

  it('lowercases the command and trims spacing', () => {
    expect(parseTelegramCommand('  /STOP  ')).toEqual({ command: 'stop', argument: '' });
  });

  it('rejects a start payload with characters Telegram never sends', () => {
    expect(parseTelegramCommand('/start abc 123')).toEqual({ command: 'start', argument: '' });
    expect(parseTelegramCommand('/start <script>')).toEqual({ command: 'start', argument: '' });
  });

  it('returns null for anything that is not a command', () => {
    expect(parseTelegramCommand('hello')).toBeNull();
    expect(parseTelegramCommand('')).toBeNull();
    expect(parseTelegramCommand(undefined)).toBeNull();
  });
});

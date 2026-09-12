import { describe, expect, it, vi } from 'vitest';
import {
  createTelegramClient,
  isPermanentTelegramChatError,
  TelegramApiError,
  TelegramUnavailableError,
} from './telegram-api.js';

const botToken = '1234567890:SUPER-SECRET-BOT-TOKEN';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createTelegramClient', () => {
  it('refuses to build a client without a bot token', () => {
    expect(() => createTelegramClient({ botToken: '' })).toThrow(TelegramUnavailableError);
    expect(() => createTelegramClient({})).toThrow(TelegramUnavailableError);
  });

  it('calls only the official Bot API host', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, result: { message_id: 7 } }));
    const client = createTelegramClient({ botToken, fetchImpl });

    await client.sendMessage({ chatId: '42', text: 'hello' });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(new URL(url).origin).toBe('https://api.telegram.org');
    expect(new URL(url).pathname).toBe(`/bot${botToken}/sendMessage`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      chat_id: '42',
      text: 'hello',
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  });

  it('throws with the Telegram description on an API-level failure', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ ok: false, error_code: 400, description: 'Bad Request: chat not found' }, 400),
    );
    const client = createTelegramClient({ botToken, fetchImpl });

    const error = await client.sendMessage({ chatId: '42', text: 'hello' }).catch((caught) => caught);

    expect(error).toBeInstanceOf(TelegramApiError);
    expect(error.status).toBe(400);
    expect(error.errorCode).toBe(400);
    expect(error.message).toContain('chat not found');
  });

  it('never leaks the bot token in an error message', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error(`fetch to https://api.telegram.org/bot${botToken}/sendMessage failed`);
    });
    const client = createTelegramClient({ botToken, fetchImpl });

    const error = await client.sendMessage({ chatId: '42', text: 'hello' }).catch((caught) => caught);

    expect(error).toBeInstanceOf(TelegramApiError);
    expect(error.message).not.toContain(botToken);
    expect(error.message).not.toContain('SUPER-SECRET');
  });

  it('handles a non-JSON error body without throwing a parse error', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>502</html>', { status: 502 }));
    const client = createTelegramClient({ botToken, fetchImpl });

    const error = await client.sendMessage({ chatId: '42', text: 'hello' }).catch((caught) => caught);

    expect(error).toBeInstanceOf(TelegramApiError);
    expect(error.status).toBe(502);
  });

  it('surfaces a 429 retry-after so callers can back off instead of hammering', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 30 } }, 429),
    );
    const client = createTelegramClient({ botToken, fetchImpl });

    const error = await client.sendMessage({ chatId: '42', text: 'hello' }).catch((caught) => caught);

    expect(error.retryAfterSeconds).toBe(30);
  });
});

describe('isPermanentTelegramChatError', () => {
  it('detects chats that will never accept another message', () => {
    expect(isPermanentTelegramChatError(new TelegramApiError('blocked', { status: 403, errorCode: 403 }))).toBe(true);
    expect(
      isPermanentTelegramChatError(new TelegramApiError('Bad Request: chat not found', { status: 400, errorCode: 400 })),
    ).toBe(true);
  });

  it('treats transient failures as retryable', () => {
    expect(isPermanentTelegramChatError(new TelegramApiError('Too Many Requests', { status: 429, errorCode: 429 }))).toBe(false);
    expect(isPermanentTelegramChatError(new TelegramApiError('boom', { status: 502 }))).toBe(false);
    expect(isPermanentTelegramChatError(new Error('network'))).toBe(false);
  });
});

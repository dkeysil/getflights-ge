import { describe, expect, it } from 'vitest';
import {
  TELEGRAM_LOGIN_MAX_AGE_SECONDS,
  TelegramLoginVerificationError,
  buildTelegramLoginDataCheckString,
  normalizeTelegramLoginPayload,
  verifyTelegramLoginPayload,
} from './telegram-login.js';

const botToken = '1234567890:BOT-TOKEN';
const now = () => new Date('2026-08-01T10:00:00.000Z');
const authDate = String(Math.floor(now().getTime() / 1000));

// The test signs exactly the way Telegram does, so a change to the checked
// string shows up as a failure instead of silently accepting anything.
async function signTelegramLogin(fields, token = botToken) {
  const encoder = new TextEncoder();
  const secret = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(buildTelegramLoginDataCheckString(fields)));
  const hash = [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return { ...fields, hash };
}

const baseFields = { id: '555', first_name: 'Nino', username: 'nino', auth_date: authDate };

describe('telegram login payload verification', () => {
  it('builds the data check string from every field but hash, in key order', () => {
    expect(
      buildTelegramLoginDataCheckString({ id: '5', hash: 'deadbeef', auth_date: '9', first_name: 'A' }),
    ).toBe('auth_date=9\nfirst_name=A\nid=5');
  });

  it('accepts a payload signed with the bot token and returns the chat id', async () => {
    const payload = await signTelegramLogin(baseFields);

    await expect(verifyTelegramLoginPayload({ payload, botToken, now })).resolves.toEqual({
      userId: '555',
      username: 'nino',
      authDateSeconds: Number(authDate),
    });
  });

  it('rejects a payload whose signature was made with another bot token', async () => {
    const payload = await signTelegramLogin(baseFields, '999:OTHER-TOKEN');

    await expect(verifyTelegramLoginPayload({ payload, botToken, now })).rejects.toMatchObject({
      name: 'TelegramLoginVerificationError',
      reason: 'bad_signature',
    });
  });

  it('rejects a payload whose fields were edited after signing', async () => {
    const payload = await signTelegramLogin(baseFields);

    await expect(
      verifyTelegramLoginPayload({ payload: { ...payload, id: '556' }, botToken, now }),
    ).rejects.toMatchObject({ reason: 'bad_signature' });
  });

  it('rejects a payload that dropped a signed field', async () => {
    const payload = await signTelegramLogin(baseFields);
    const { username, ...withoutUsername } = payload;

    await expect(verifyTelegramLoginPayload({ payload: withoutUsername, botToken, now })).rejects.toMatchObject({
      reason: 'bad_signature',
    });
  });

  it('rejects a payload older than the allowed window', async () => {
    const stale = String(Math.floor(now().getTime() / 1000) - TELEGRAM_LOGIN_MAX_AGE_SECONDS - 1);
    const payload = await signTelegramLogin({ ...baseFields, auth_date: stale });

    await expect(verifyTelegramLoginPayload({ payload, botToken, now })).rejects.toMatchObject({
      reason: 'expired',
    });
  });

  it('rejects a payload dated further into the future than clock skew explains', async () => {
    const ahead = String(Math.floor(now().getTime() / 1000) + 3600);
    const payload = await signTelegramLogin({ ...baseFields, auth_date: ahead });

    await expect(verifyTelegramLoginPayload({ payload, botToken, now })).rejects.toMatchObject({
      reason: 'auth_date_in_future',
    });
  });

  it('rejects payloads that are not shaped like a widget response at all', async () => {
    for (const payload of [null, 'string', [], { id: '5', auth_date: authDate }, { hash: 'zz' }]) {
      await expect(verifyTelegramLoginPayload({ payload, botToken, now })).rejects.toBeInstanceOf(
        TelegramLoginVerificationError,
      );
    }
  });

  it('refuses to verify anything when the bot token is missing', async () => {
    const payload = await signTelegramLogin(baseFields);

    await expect(verifyTelegramLoginPayload({ payload, botToken: '', now })).rejects.toMatchObject({
      reason: 'bot_token_missing',
    });
  });

  it('normalizes numeric widget fields but refuses nested values', () => {
    expect(normalizeTelegramLoginPayload({ id: 555, auth_date: 1, hash: 'a'.repeat(64) })).toEqual({
      id: '555',
      auth_date: '1',
      hash: 'a'.repeat(64),
    });
    expect(normalizeTelegramLoginPayload({ id: 555, auth_date: 1, hash: 'a'.repeat(64), extra: { a: 1 } })).toBeNull();
  });
});

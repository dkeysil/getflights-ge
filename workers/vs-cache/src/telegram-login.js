// Verification for the official Telegram Login Widget payload.
//
// Telegram signs the widget payload with a key derived from the bot token:
//   secret_key = SHA256(bot_token)
//   hash       = HMAC_SHA256(data_check_string, secret_key)
// where data_check_string is every field except `hash`, rendered as `key=value`
// and joined with "\n" in ascending key order. Nothing here trusts a value
// before the signature over it has been checked.

const hashPattern = /^[0-9a-f]{64}$/;
// Telegram's own guidance is to reject stale payloads; five minutes matches the
// lifetime of the alert token the payload is exchanged for.
export const TELEGRAM_LOGIN_MAX_AGE_SECONDS = 5 * 60;
// A widget payload minted a few seconds "ahead" of the Worker clock is normal
// skew, not a forgery.
const clockSkewSeconds = 60;

export class TelegramLoginVerificationError extends Error {
  constructor(reason) {
    super(`Telegram login payload rejected: ${reason}`);
    this.name = 'TelegramLoginVerificationError';
    this.reason = reason;
  }
}

// The widget hands the browser a flat object of strings; anything else is not
// a Telegram payload and never reaches the signature check.
export function normalizeTelegramLoginPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const entries = [];
  for (const [key, raw] of Object.entries(value)) {
    if (raw === null || raw === undefined) continue;
    if (typeof raw !== 'string' && typeof raw !== 'number') return null;
    if (!/^[a-z_]{1,32}$/.test(key)) return null;
    entries.push([key, String(raw)]);
  }

  const payload = Object.fromEntries(entries);
  if (!hashPattern.test(payload.hash ?? '')) return null;
  if (!/^\d{1,19}$/.test(payload.id ?? '')) return null;
  if (!/^\d{1,15}$/.test(payload.auth_date ?? '')) return null;

  return payload;
}

export function buildTelegramLoginDataCheckString(payload) {
  return Object.keys(payload)
    .filter((key) => key !== 'hash')
    .sort()
    .map((key) => `${key}=${payload[key]}`)
    .join('\n');
}

// Resolves to the Telegram user id (which is also the private chat id) or
// throws TelegramLoginVerificationError. Callers must treat a throw as "do not
// consume anything".
export async function verifyTelegramLoginPayload({
  payload: rawPayload,
  botToken,
  now = () => new Date(),
  maxAgeSeconds = TELEGRAM_LOGIN_MAX_AGE_SECONDS,
}) {
  if (typeof botToken !== 'string' || !botToken) {
    throw new TelegramLoginVerificationError('bot_token_missing');
  }

  const payload = normalizeTelegramLoginPayload(rawPayload);
  if (!payload) throw new TelegramLoginVerificationError('malformed');

  const expected = await telegramLoginHash(payload, botToken);
  if (!timingSafeEqualsHex(expected, payload.hash)) {
    throw new TelegramLoginVerificationError('bad_signature');
  }

  // Freshness is checked only after the signature, so an attacker cannot use
  // the response to probe for a valid auth_date window.
  const authDateSeconds = Number(payload.auth_date);
  const nowSeconds = Math.floor(toDate(now()).getTime() / 1000);
  if (authDateSeconds - nowSeconds > clockSkewSeconds) {
    throw new TelegramLoginVerificationError('auth_date_in_future');
  }
  if (nowSeconds - authDateSeconds > maxAgeSeconds) {
    throw new TelegramLoginVerificationError('expired');
  }

  return {
    userId: payload.id,
    username: typeof payload.username === 'string' ? payload.username : null,
    authDateSeconds,
  };
}

async function telegramLoginHash(payload, botToken) {
  const encoder = new TextEncoder();
  const secret = await crypto.subtle.digest('SHA-256', encoder.encode(botToken));
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(buildTelegramLoginDataCheckString(payload)),
  );
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualsHex(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

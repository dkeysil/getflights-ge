const telegramDeepLinkOrigin = 'https://t.me';
const botUsernamePattern = /^[A-Za-z0-9_]{5,32}$/;
// Telegram only ever delivers A-Z a-z 0-9 _ - in a /start payload, max 64 chars.
const startPayloadPattern = /^[A-Za-z0-9_-]{1,64}$/;
const commandPattern = /^\/([A-Za-z0-9_]{1,32})(?:@[A-Za-z0-9_]{1,32})?(?:\s+(.*))?$/;
const maxMessageTextLength = 4096;
const linkTokenBytes = 24;

export function createTelegramLinkToken() {
  const bytes = new Uint8Array(linkTokenBytes);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function normalizeTelegramBotUsername(value) {
  if (typeof value !== 'string') return null;
  const username = value.trim().replace(/^@/, '');
  return botUsernamePattern.test(username) ? username : null;
}

export function buildTelegramStartUrl({ botUsername, token }) {
  const username = normalizeTelegramBotUsername(botUsername);
  if (!username || !startPayloadPattern.test(String(token ?? ''))) return null;
  return `${telegramDeepLinkOrigin}/${username}?start=${token}`;
}

export function buildTelegramSearchUrl({ appOrigin, locale, fromId, toId, dateFrom, dateTo }) {
  const url = new URL(`/${locale}/`, appOrigin);
  url.searchParams.set('from', fromId);
  url.searchParams.set('to', toId);
  url.searchParams.set('dateFrom', dateFrom);
  url.searchParams.set('dateTo', dateTo);
  return url.toString();
}

// Only private text messages can act on a subscription. Everything else
// (channel posts, group chatter, edits, callbacks) is ignored by design.
export function parseTelegramUpdate(update) {
  if (!update || typeof update !== 'object') return null;

  const updateId = update.update_id;
  if (!Number.isInteger(updateId)) return null;

  const message = update.message;
  if (!message || typeof message !== 'object') return null;
  if (message.chat?.type !== 'private') return null;

  const chatId = message.chat?.id;
  if (typeof chatId !== 'number' && typeof chatId !== 'string') return null;

  const text = message.text;
  if (typeof text !== 'string' || text.length > maxMessageTextLength) return null;

  return {
    updateId: String(updateId),
    chatId: String(chatId),
    text,
  };
}

export function parseTelegramCommand(text) {
  if (typeof text !== 'string') return null;

  const match = commandPattern.exec(text.trim());
  if (!match) return null;

  const argument = (match[2] ?? '').trim();
  return {
    command: match[1].toLowerCase(),
    argument: startPayloadPattern.test(argument) ? argument : '',
  };
}

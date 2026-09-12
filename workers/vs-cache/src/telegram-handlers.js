import { CITIES } from './availability.js';
import { findMatchingDates, hashAlertToken, normalizeAlertRouteInput } from './alerts-domain.js';
import { createTelegramClient } from './telegram-api.js';
import {
  buildTelegramSearchUrl,
  buildTelegramStartUrl,
  createTelegramLinkToken,
  normalizeTelegramBotUsername,
  parseTelegramCommand,
  parseTelegramUpdate,
} from './telegram-domain.js';
import {
  renderTelegramHelpMessage,
  renderTelegramInvalidTokenMessage,
  renderTelegramListMessage,
  renderTelegramStopMessage,
  renderTelegramSubscribedMessage,
} from './telegram-messages.js';
import { createTelegramAlertStore } from './telegram-store.js';

const jsonHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};
const defaultAppOrigin = 'https://getflights.ge';
const defaultBotUsername = 'get_flights_ge_bot';
const linkTokenTtlMs = 15 * 60 * 1000;
const linkRateLimit = { action: 'telegram-link', limit: 10, windowSeconds: 60 * 60 };
const webhookRateLimit = { action: 'telegram-update', limit: 20, windowSeconds: 60 };
const secretHeader = 'X-Telegram-Bot-Api-Secret-Token';

export const telegramLinkPath = '/api/alerts/telegram/link';
export const telegramWebhookPath = '/api/telegram/webhook';

export async function handleTelegramRequest(request, env, options = {}) {
  const url = new URL(request.url);
  const now = options.now ?? (() => new Date());

  try {
    if (url.pathname === telegramLinkPath && request.method === 'POST') {
      return await handleLink(request, env, options, now);
    }

    if (url.pathname === telegramWebhookPath && request.method === 'POST') {
      return await handleWebhook(request, env, options, now);
    }

    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    logError('telegram_request_failed', { path: url.pathname }, error);
    return json({ error: 'Telegram alert request failed.' }, 502);
  }
}

async function handleLink(request, env, options, now) {
  const config = readTelegramConfig(env);
  if (!env?.ALERTS_DB?.prepare || !config.botUsername || !config.botToken) {
    return json({ error: 'Telegram alerts are unavailable.' }, 503);
  }

  const input = normalizeAlertRouteInput(await readJson(request));
  if (!input) {
    return json({ error: 'Invalid alert request.' }, 400);
  }

  const store = createTelegramAlertStore(env.ALERTS_DB, { now });
  const rateLimit = await store.reserveRateLimit({ ...linkRateLimit, scope: requestIp(request) });
  if (!rateLimit.allowed) {
    return rateLimited(rateLimit.retryAfterSeconds);
  }

  const snapshot = await getAvailabilitySnapshot(env, options);
  if (!hasRoute(snapshot, input.fromId, input.toId)) {
    return json({ error: 'Unknown route.' }, 400);
  }

  const token = createTelegramLinkToken();
  const url = buildTelegramStartUrl({ botUsername: config.botUsername, token });
  if (!url) {
    return json({ error: 'Telegram alerts are unavailable.' }, 503);
  }

  const expiresAt = new Date(now().getTime() + linkTokenTtlMs).toISOString();
  await store.createLinkToken({ tokenHash: await hashAlertToken(token), ...input, expiresAt });

  return json({
    url,
    expiresAt,
    matchingDates: findMatchingDates({ availability: snapshot?.availability, ...input }),
  });
}

async function handleWebhook(request, env, options, now) {
  const config = readTelegramConfig(env);
  if (!config.webhookSecret || !timingSafeEquals(request.headers.get(secretHeader) ?? '', config.webhookSecret)) {
    // Never parse an unauthenticated body: anyone can POST to this path.
    logError('telegram_webhook_rejected', { reason: 'invalid_secret' }, new Error('Invalid webhook secret.'));
    return json({ error: 'Unauthorized.' }, 401);
  }

  if (!env?.ALERTS_DB?.prepare || !config.botToken) {
    return json({ error: 'Telegram alerts are unavailable.' }, 503);
  }

  const update = parseTelegramUpdate(await readJson(request));
  if (!update) return acknowledged();

  const store = createTelegramAlertStore(env.ALERTS_DB, { now });
  const rateLimit = await store.reserveRateLimit({ ...webhookRateLimit, scope: `chat:${update.chatId}` });
  if (!rateLimit.allowed) return acknowledged();

  const command = parseTelegramCommand(update.text);
  if (!command) return acknowledged();

  // Claim before acting: Telegram redelivers until it sees a 2xx.
  if (!(await store.claimUpdate(update.updateId))) return acknowledged();

  // Telegram retries any non-2xx, so a failed reply is logged and swallowed
  // rather than turned into a redelivery loop.
  try {
    await runCommand({ command, update, env, store, options, now, config });
  } catch (error) {
    logError('telegram_webhook_command_failed', { command: command.command }, error);
  }

  return acknowledged();
}

async function runCommand({ command, update, env, store, options, now, config }) {
  const sendMessage = options.sendMessage ?? createSender(env, config, options);
  const appOrigin = readAppOrigin(env);

  if (command.command === 'start' && command.argument) {
    const token = await store.consumeLinkToken(await hashAlertToken(command.argument));
    if (!token) {
      const locale = await chatLocale(store, update.chatId);
      await sendMessage({
        chatId: update.chatId,
        text: renderTelegramInvalidTokenMessage({ locale, siteUrl: `${appOrigin}/${locale}/` }),
      });
      return;
    }

    const subscription = {
      chatId: update.chatId,
      fromId: token.from_id,
      toId: token.to_id,
      dateFrom: token.date_from,
      dateTo: token.date_to,
      locale: token.locale,
    };
    await store.activateSubscription(subscription);
    await sendMessage({
      chatId: update.chatId,
      text: renderTelegramSubscribedMessage({
        locale: token.locale,
        routeLabel: routeLabelForIds(token.from_id, token.to_id),
        dateFrom: token.date_from,
        dateTo: token.date_to,
        searchUrl: buildTelegramSearchUrl({ appOrigin, ...subscription }),
      }),
    });
    return;
  }

  if (command.command === 'stop') {
    const locale = await chatLocale(store, update.chatId);
    const count = await store.unsubscribeChat(update.chatId);
    await sendMessage({ chatId: update.chatId, text: renderTelegramStopMessage({ locale, count }) });
    return;
  }

  if (command.command === 'list') {
    const subscriptions = await store.listActiveSubscriptionsForChat(update.chatId);
    await sendMessage({
      chatId: update.chatId,
      text: renderTelegramListMessage({
        locale: subscriptions[0]?.locale ?? 'en',
        subscriptions: subscriptions.map((subscription) => ({
          routeLabel: routeLabelForIds(subscription.from_id, subscription.to_id),
          dateFrom: subscription.date_from,
          dateTo: subscription.date_to,
        })),
      }),
    });
    return;
  }

  if (command.command === 'start' || command.command === 'help') {
    const locale = await chatLocale(store, update.chatId);
    await sendMessage({ chatId: update.chatId, text: renderTelegramHelpMessage({ locale }) });
  }

  // Any other command is ignored on purpose: the bot is not an echo service.
}

export function readTelegramConfig(env) {
  return {
    botToken: typeof env?.TELEGRAM_BOT_TOKEN === 'string' && env.TELEGRAM_BOT_TOKEN ? env.TELEGRAM_BOT_TOKEN : null,
    webhookSecret:
      typeof env?.TELEGRAM_WEBHOOK_SECRET === 'string' && env.TELEGRAM_WEBHOOK_SECRET ? env.TELEGRAM_WEBHOOK_SECRET : null,
    botUsername: normalizeTelegramBotUsername(env?.TELEGRAM_BOT_USERNAME ?? defaultBotUsername),
  };
}

export function readAppOrigin(env) {
  return env?.PUBLIC_APP_ORIGIN || defaultAppOrigin;
}

export function routeLabelForIds(fromId, toId) {
  const cities = new Map(CITIES.map((city) => [city.id, city.name]));
  return `${cities.get(fromId) ?? fromId} → ${cities.get(toId) ?? toId}`;
}

function createSender(env, config, options) {
  const client = createTelegramClient({ botToken: config.botToken, fetchImpl: options.fetchImpl });
  return ({ chatId, text }) => client.sendMessage({ chatId, text });
}

async function chatLocale(store, chatId) {
  const subscriptions = await store.listActiveSubscriptionsForChat(chatId);
  return subscriptions[0]?.locale ?? 'en';
}

async function getAvailabilitySnapshot(env, options) {
  if (options.getAvailabilitySnapshot) return options.getAvailabilitySnapshot();
  if (env?.VS_CACHE_COORDINATOR?.getByName) {
    return env.VS_CACHE_COORDINATOR.getByName('availability:snapshot').getAvailability({ force: false });
  }
  return null;
}

function hasRoute(snapshot, fromId, toId) {
  if (!snapshot || !Array.isArray(snapshot.routeCatalog)) return false;
  return snapshot.routeCatalog.some(
    (route) => route.from?.id === fromId && route.destinations?.some((destination) => destination.id === toId),
  );
}

function timingSafeEquals(left, right) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function requestIp(request) {
  const cloudflareIp = request.headers.get('CF-Connecting-IP');
  if (cloudflareIp) return cloudflareIp;
  return request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown';
}

async function readJson(request) {
  return request.json().catch(() => null);
}

function logError(message, context, error) {
  console.error(
    JSON.stringify({
      level: 'error',
      message,
      ...context,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
}

function acknowledged() {
  return json({ ok: true });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}

function rateLimited(retryAfterSeconds) {
  return new Response(JSON.stringify({ error: 'Too many alert requests.' }), {
    status: 429,
    headers: { ...jsonHeaders, 'Retry-After': String(retryAfterSeconds) },
  });
}

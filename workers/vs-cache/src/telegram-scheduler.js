import { alertProductDay, findMatchingDates, shouldSendDailyAlert } from './alerts-domain.js';
import { createTelegramClient, isPermanentTelegramChatError } from './telegram-api.js';
import { buildTelegramSearchUrl } from './telegram-domain.js';
import { renderTelegramAlertMessage } from './telegram-messages.js';
import { readAppOrigin, readTelegramConfig, routeLabelForIds } from './telegram-handlers.js';
import { createTelegramAlertStore, TelegramAlertStoreUnavailableError } from './telegram-store.js';

const retentionDays = 7;

export async function evaluateTelegramAlerts({ env, snapshot, now = () => new Date(), appOrigin, sendMessage, fetchImpl }) {
  const config = readTelegramConfig(env);
  if (!config.botToken) {
    logError('telegram_alert_scheduler_unavailable', {}, new Error('Telegram bot token is not configured.'));
    return;
  }

  let store;
  let send = sendMessage;

  try {
    store = createTelegramAlertStore(env?.ALERTS_DB, { now });
    if (!send) {
      const client = createTelegramClient({ botToken: config.botToken, fetchImpl });
      send = ({ chatId, text }) => client.sendMessage({ chatId, text });
    }
  } catch (error) {
    if (error instanceof TelegramAlertStoreUnavailableError || error.name === 'TelegramUnavailableError') {
      logError('telegram_alert_scheduler_unavailable', {}, error);
      return;
    }
    throw error;
  }

  await cleanup(store, now);

  const productDay = alertProductDay(now());
  const origin = appOrigin || readAppOrigin(env);
  const subscriptions = await store.listActiveSubscriptions();

  for (const subscription of subscriptions) {
    await deliver({ subscription, snapshot, store, send, productDay, origin });
  }
}

async function deliver({ subscription, snapshot, store, send, productDay, origin }) {
  const matchingDates = findMatchingDates({
    availability: snapshot?.availability,
    fromId: subscription.from_id,
    toId: subscription.to_id,
    dateFrom: subscription.date_from,
    dateTo: subscription.date_to,
  });

  if (!shouldSendDailyAlert({ lastAlertSentOn: subscription.last_alert_sent_on, productDay, matchingDates })) {
    return;
  }

  // Reserving first is what makes a send at-most-once per product day: a
  // failure is recorded, never retried into a storm by the next cron tick.
  let reserved;
  try {
    reserved = await store.reserveAlertSend({ subscriptionId: subscription.id, sentOn: productDay, matchingDates });
  } catch (error) {
    logError('telegram_alert_reserve_failed', { subscriptionId: subscription.id }, error);
    return;
  }
  if (!reserved) return;

  let providerStatus = 'sent';
  let errorSummary = null;

  try {
    await send({
      chatId: subscription.chat_id,
      text: renderTelegramAlertMessage({
        locale: subscription.locale,
        routeLabel: routeLabelForIds(subscription.from_id, subscription.to_id),
        dateFrom: subscription.date_from,
        dateTo: subscription.date_to,
        matchingDates,
        searchUrl: buildTelegramSearchUrl({
          appOrigin: origin,
          locale: subscription.locale,
          fromId: subscription.from_id,
          toId: subscription.to_id,
          dateFrom: subscription.date_from,
          dateTo: subscription.date_to,
        }),
      }),
    });
  } catch (error) {
    providerStatus = 'failed';
    errorSummary = error instanceof Error ? error.message : String(error);
    logError('telegram_alert_send_failed', { subscriptionId: subscription.id }, error);

    if (isPermanentTelegramChatError(error)) {
      await runQuietly('telegram_alert_retire_failed', () => store.markSubscriptionUnsubscribed(subscription.id));
    }
  }

  await runQuietly('telegram_alert_finalize_failed', () =>
    store.finalizeAlertSend({ subscriptionId: subscription.id, sentOn: productDay, providerStatus, errorSummary }),
  );
}

async function cleanup(store, now) {
  const cutoffIso = new Date(now().getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  await runQuietly('telegram_link_token_cleanup_failed', () => store.deleteExpiredLinkTokens());
  await runQuietly('telegram_rate_limit_cleanup_failed', () => store.deleteExpiredRateLimits(cutoffIso));
  await runQuietly('telegram_processed_update_cleanup_failed', () => store.deleteProcessedUpdatesBefore(cutoffIso));
}

async function runQuietly(message, task) {
  try {
    await task();
  } catch (error) {
    logError(message, {}, error);
  }
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

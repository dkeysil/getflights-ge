import { CITIES } from './availability.js';
import { alertProductDay, findMatchingDates, hashAlertToken, shouldSendDailyAlert } from './alerts-domain.js';
import { createAlertEmailer } from './alerts-email.js';
import { createAlertStore, AlertStoreUnavailableError } from './alerts-store.js';

const defaultAppOrigin = 'https://getflights.ge';

export async function evaluateTicketAlerts({ env, snapshot, now = () => new Date(), appOrigin = defaultAppOrigin }) {
  if (!hasAlertEmailProvider(env)) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'alert_scheduler_unavailable',
        error: 'Alert email provider is unavailable.',
      }),
    );
    return;
  }

  let store;
  let emailer;

  try {
    store = createAlertStore(env?.ALERTS_DB, { now });
    emailer = createAlertEmailer(env);
  } catch (error) {
    if (error instanceof AlertStoreUnavailableError) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'alert_scheduler_unavailable',
          error: error.message,
        }),
      );
      return;
    }

    throw error;
  }

  const productDay = alertProductDay(now());
  await cleanupExpiredPendingSubscriptions(store, now);

  const subscriptions = await store.listActiveSubscriptions();
  if (!subscriptions.length) return;

  for (const subscription of subscriptions) {
    const matchingDates = findMatchingDates({
      availability: snapshot?.availability,
      fromId: subscription.from_id,
      toId: subscription.to_id,
      dateFrom: subscription.date_from,
      dateTo: subscription.date_to,
    });

    if (!shouldSendDailyAlert({
      lastAlertSentOn: subscription.last_alert_sent_on,
      productDay,
      matchingDates,
    })) {
      continue;
    }

    const appUrl = buildAppUrl({
      appOrigin,
      locale: subscription.locale,
      fromId: subscription.from_id,
      toId: subscription.to_id,
      dateFrom: subscription.date_from,
      dateTo: subscription.date_to,
    });

    let reserved;
    try {
      reserved = await store.reserveAlertSend({
        subscriptionId: subscription.id,
        sentOn: productDay,
        matchingDates,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'ticket_alert_reserve_failed',
          subscriptionId: subscription.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      continue;
    }
    if (!reserved) {
      continue;
    }

    const rawManageToken = createRawToken();
    const manageTokenHash = await hashAlertToken(rawManageToken);
    const manageUrl = buildManageUrl({
      appOrigin,
      locale: subscription.locale,
      token: rawManageToken,
    });

    let providerStatus = 'sent';
    let errorSummary = null;

    try {
      await store.createToken({
        subscriptionId: null,
        email: subscription.email,
        purpose: 'manage',
        tokenHash: manageTokenHash,
        expiresAt: addHoursIso(now(), 24),
      });

      await emailer.sendTicketAlert({
        to: subscription.email,
        locale: subscription.locale,
        routeLabel: routeLabelForIds(subscription.from_id, subscription.to_id),
        dateFrom: subscription.date_from,
        dateTo: subscription.date_to,
        matchingDates,
        appUrl,
        manageUrl,
      });
    } catch (error) {
      providerStatus = 'failed';
      errorSummary = error instanceof Error ? error.message : String(error);
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'ticket_alert_send_failed',
          subscriptionId: subscription.id,
          error: errorSummary,
        }),
      );
    }

    try {
      await store.finalizeAlertSend({
        subscriptionId: subscription.id,
        sentOn: productDay,
        providerStatus,
        errorSummary,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'ticket_alert_finalize_failed',
          subscriptionId: subscription.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}

async function cleanupExpiredPendingSubscriptions(store, now) {
  const cutoffIso = addHoursIso(now(), -24 * 7);
  await runCleanup('alert_pending_cleanup_failed', () => store.deleteExpiredPending(cutoffIso));
  await runCleanup('alert_rate_limit_cleanup_failed', () => store.deleteExpiredRateLimits(cutoffIso));
}

async function runCleanup(message, cleanup) {
  try {
    await cleanup();
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        message,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

function buildAppUrl({ appOrigin, locale, fromId, toId, dateFrom, dateTo }) {
  const url = new URL(`/${locale}/`, appOrigin);
  url.searchParams.set('from', fromId);
  url.searchParams.set('to', toId);
  url.searchParams.set('dateFrom', dateFrom);
  url.searchParams.set('dateTo', dateTo);
  return url.toString();
}

function buildManageUrl({ appOrigin, locale, token }) {
  const url = new URL(`/${locale}/alerts/manage`, appOrigin);
  url.searchParams.set('token', token);
  return url.toString();
}

function routeLabelForIds(fromId, toId) {
  const cities = new Map(CITIES.map((city) => [city.id, city.name]));
  return `${cities.get(fromId) ?? fromId} -> ${cities.get(toId) ?? toId}`;
}

function createRawToken() {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function addHoursIso(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function hasAlertEmailProvider(env) {
  return typeof env?.EMAIL?.send === 'function';
}

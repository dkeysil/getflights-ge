import { CITIES } from './availability.js';
import { createAlertEmailer } from './alerts-email.js';
import { createAlertStore } from './alerts-store.js';
import { findMatchingDates, hashAlertToken, normalizeAlertSubscriptionInput } from './alerts-domain.js';

const jsonHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};
const supportedLocales = new Set(['en', 'ru', 'ua', 'ka']);
const tokenColumns = 'token_hash, subscription_id, email, purpose, expires_at, consumed_at, created_at';
const subscribeRateLimit = { action: 'subscribe', limit: 5, windowSeconds: 60 * 60 };
const manageLinkRateLimit = { action: 'manage-link', limit: 5, windowSeconds: 60 * 60 };

export async function handleAlertsRequest(request, env, options = {}) {
  const url = new URL(request.url);
  const now = options.now ?? (() => new Date());

  try {
    if (url.pathname === '/api/alerts/subscribe' && request.method === 'POST') {
      return await handleSubscribe(request, env, options, now, url);
    }

    if (url.pathname === '/api/alerts/confirm' && request.method === 'GET') {
      return await handleConfirm(request, env, options, now, url);
    }

    if (url.pathname === '/api/alerts/manage-link' && request.method === 'POST') {
      return await handleManageLink(request, env, options, now, url);
    }

    if (url.pathname === '/api/alerts/manage' && request.method === 'GET') {
      return await handleManage(request, env, options, now, url);
    }

    const unsubscribeMatch = url.pathname.match(/^\/api\/alerts\/([^/]+)\/unsubscribe$/);
    if (unsubscribeMatch && request.method === 'POST') {
      return await handleUnsubscribe(request, env, options, now, url, unsubscribeMatch[1]);
    }

    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'alerts_worker_request_failed',
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return json({ error: 'Alert worker request failed.' }, 502);
  }
}

async function handleSubscribe(request, env, options, now, url) {
  const context = createAlertContext(env, now);
  if (!context) {
    return json({ error: 'Alerts are unavailable.' }, 503);
  }

  const { store, emailer } = context;
  const input = normalizeAlertSubscriptionInput(await readJson(request));
  if (!input) {
    return json({ error: 'Invalid alert subscription.' }, 400);
  }

  const limitedResponse = await checkRateLimit(request, store, subscribeRateLimit, input.email);
  if (limitedResponse) return limitedResponse;

  const snapshot = await getAvailabilitySnapshot(env, options);
  if (!hasRoute(snapshot, input.fromId, input.toId)) {
    return json({ error: 'Unknown route.' }, 400);
  }

  const matchingDates = findMatchingDates({
    availability: snapshot?.availability,
    fromId: input.fromId,
    toId: input.toId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });

  const subscription = await store.upsertSubscription(input);
  if (subscription.status !== 'active') {
    const rawToken = createRawToken();
    const tokenHash = await hashAlertToken(rawToken);
    await store.createToken({
      subscriptionId: subscription.id,
      email: subscription.email,
      purpose: 'confirm',
      tokenHash,
      expiresAt: addDaysIso(now(), 7),
    });

    const confirmUrl = new URL(`/api/alerts/confirm`, url.origin);
    confirmUrl.searchParams.set('token', rawToken);
    await emailer.sendConfirmation({
      to: subscription.email,
      locale: subscription.locale,
      routeLabel: routeLabelForIds(subscription.from_id, subscription.to_id),
      confirmUrl: confirmUrl.toString(),
    });
  }

  return json({
    matchingDates,
    subscription: {
      id: subscription.id,
      status: subscription.status,
      locale: subscription.locale,
    },
  });
}

async function handleConfirm(request, env, options, now, url) {
  const store = createAlertStore(env.ALERTS_DB, { now });
  const token = url.searchParams.get('token');
  if (!token) {
    return json({ error: 'Missing token.' }, 400);
  }

  const confirmed = await store.confirmSubscriptionByToken(await hashAlertToken(token));
  if (!confirmed) {
    return json({ error: 'Invalid or expired token.' }, 403);
  }

  const redirectUrl = new URL(`/${confirmed.locale}/`, url.origin);
  redirectUrl.searchParams.set('alert', 'confirmed');
  return Response.redirect(redirectUrl.toString(), 302);
}

async function handleManageLink(request, env, options, now, url) {
  const context = createAlertContext(env, now);
  if (!context) {
    return json({ error: 'Alerts are unavailable.' }, 503);
  }

  const { store, emailer } = context;
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  if (!email) {
    return json({ ok: true });
  }

  const locale = normalizeLocale(body?.locale);
  const limitedResponse = await checkRateLimit(request, store, manageLinkRateLimit, email);
  if (limitedResponse) return limitedResponse;

  const subscriptions = await store.listSubscriptionsForEmail(email);
  if (!subscriptions.length) {
    return json({ ok: true });
  }

  const rawToken = createRawToken();
  const tokenHash = await hashAlertToken(rawToken);
  await store.createToken({
    subscriptionId: null,
    email,
    purpose: 'manage',
    tokenHash,
    expiresAt: addDaysIso(now(), 1),
  });

  const manageUrl = new URL(`/${locale}/alerts/manage`, url.origin);
  manageUrl.searchParams.set('token', rawToken);
  await emailer.sendManageLink({
    to: email,
    locale,
    manageUrl: manageUrl.toString(),
  });

  return json({ ok: true });
}

async function handleManage(request, env, options, now, url) {
  const token = url.searchParams.get('token');
  const scope = await readManageScope(env, token, now);
  if (!scope) {
    return json({ error: 'Invalid or expired token.' }, 403);
  }

  const store = createAlertStore(env.ALERTS_DB, { now });
  let snapshot = null;
  try {
    snapshot = await getAvailabilitySnapshot(env, options);
  } catch {
    snapshot = null;
  }
  const subscriptions = await store.listSubscriptionsForEmail(scope.email);
  return json({
    email: scope.email,
    subscriptions: subscriptions.map((subscription) => serializeManagedSubscription(subscription, snapshot)),
  });
}

async function handleUnsubscribe(request, env, options, now, url, id) {
  const token = url.searchParams.get('token');
  const scope = await readManageScope(env, token, now);
  if (!scope) {
    return json({ error: 'Invalid or expired token.' }, 403);
  }

  const store = createAlertStore(env.ALERTS_DB, { now });
  const subscription = await store.unsubscribeSubscription({ id, email: scope.email });
  if (!subscription) {
    return json({ error: 'Not found.' }, 404);
  }

  return json({ ok: true });
}

async function readManageScope(env, token, now) {
  if (!env?.ALERTS_DB?.prepare || !token) return null;

  // Manage tokens are reusable bearer links until expiry; there is no session layer here.
  const tokenHash = await hashAlertToken(token);
  const row = await env.ALERTS_DB
    .prepare(
      `SELECT ${tokenColumns}
       FROM subscription_tokens
       WHERE token_hash = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > ?
       LIMIT 1`,
    )
    .bind(tokenHash, 'manage', toIso(now()))
    .first();

  if (!row?.email) return null;
  return row;
}

function createAlertContext(env, now) {
  if (!hasAlertDependencies(env)) return null;
  return {
    store: createAlertStore(env.ALERTS_DB, { now }),
    emailer: createAlertEmailer(env),
  };
}

async function checkRateLimit(request, store, config, email) {
  const rateLimit = await store.reserveRateLimit({
    ...config,
    email,
    ip: requestIp(request),
  });

  return rateLimit.allowed ? null : rateLimited(rateLimit.retryAfterSeconds);
}

function serializeManagedSubscription(subscription, snapshot) {
  return {
    id: subscription.id,
    email: subscription.email,
    fromId: subscription.from_id,
    toId: subscription.to_id,
    dateFrom: subscription.date_from,
    dateTo: subscription.date_to,
    locale: subscription.locale,
    status: subscription.status,
    lastAlertSentOn: subscription.last_alert_sent_on,
    matchingDates: findMatchingDates({
      availability: snapshot?.availability,
      fromId: subscription.from_id,
      toId: subscription.to_id,
      dateFrom: subscription.date_from,
      dateTo: subscription.date_to,
    }),
  };
}

async function getAvailabilitySnapshot(env, options) {
  if (options.getAvailabilitySnapshot) {
    return options.getAvailabilitySnapshot();
  }

  if (env?.VS_CACHE_COORDINATOR?.getByName) {
    return env.VS_CACHE_COORDINATOR.getByName('availability:snapshot').getAvailability({ force: false });
  }

  return null;
}

function hasAlertDependencies(env) {
  return Boolean(env?.ALERTS_DB?.prepare && typeof env?.EMAIL?.send === 'function');
}

function hasRoute(snapshot, fromId, toId) {
  if (!snapshot || !Array.isArray(snapshot.routeCatalog)) return false;
  return snapshot.routeCatalog.some((route) => route.from?.id === fromId && route.destinations?.some((destination) => destination.id === toId));
}

function routeLabelForIds(fromId, toId) {
  const cities = new Map(CITIES.map((city) => [city.id, city.name]));
  return `${cities.get(fromId) ?? fromId} -> ${cities.get(toId) ?? toId}`;
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizeLocale(value) {
  const locale = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return supportedLocales.has(locale) ? locale : 'en';
}

function createRawToken() {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function addDaysIso(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function readJson(request) {
  return request.json().catch(() => null);
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders,
  });
}

function rateLimited(retryAfterSeconds) {
  return new Response(JSON.stringify({ error: 'Too many alert requests.' }), {
    status: 429,
    headers: {
      ...jsonHeaders,
      'Retry-After': String(retryAfterSeconds),
    },
  });
}

function requestIp(request) {
  const cloudflareIp = request.headers.get('CF-Connecting-IP');
  if (cloudflareIp) return cloudflareIp;
  const forwardedFor = request.headers.get('X-Forwarded-For');
  return forwardedFor?.split(',')[0]?.trim() ?? 'unknown';
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

import { describe, expect, it, vi } from 'vitest';
import { hashAlertToken } from './alerts-domain.js';
import { handleAlertsRequest } from './alerts-handlers.js';

function createFakeDb() {
  const state = {
    subscriptions: [],
    subscriptionTokens: [],
    alertRequestLimits: [],
  };

  function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : null;
  }

  function normalizeEmail(value) {
    return String(value).trim().toLowerCase();
  }

  function findSubscriptionByKey([email, fromId, toId, dateFrom, dateTo]) {
    return state.subscriptions.find(
      (row) =>
        row.email === normalizeEmail(email) &&
        row.from_id === fromId &&
        row.to_id === toId &&
        row.date_from === dateFrom &&
        row.date_to === dateTo,
    );
  }

  function upsertSubscription(params) {
    const [id, email, fromId, toId, dateFrom, dateTo, locale, status, confirmedAt, unsubscribedAt, lastAlertSentOn, createdAt, updatedAt] = params;
    const existing = findSubscriptionByKey([email, fromId, toId, dateFrom, dateTo]);
    if (existing) {
      existing.locale = locale;
      existing.status = existing.status === 'active' ? 'active' : 'pending';
      existing.confirmed_at = existing.status === 'active' ? existing.confirmed_at : null;
      existing.unsubscribed_at = existing.status === 'active' ? existing.unsubscribed_at : null;
      existing.updated_at = updatedAt;
      return clone(existing);
    }

    state.subscriptions.push({
      id,
      email: normalizeEmail(email),
      from_id: fromId,
      to_id: toId,
      date_from: dateFrom,
      date_to: dateTo,
      locale,
      status,
      confirmed_at: confirmedAt,
      unsubscribed_at: unsubscribedAt,
      last_alert_sent_on: lastAlertSentOn,
      created_at: createdAt,
      updated_at: updatedAt,
    });
    return clone(state.subscriptions[state.subscriptions.length - 1]);
  }

  function insertToken(params) {
    const [tokenHash, subscriptionId, email, purpose, expiresAt, consumedAt, createdAt] = params;
    state.subscriptionTokens.push({
      token_hash: tokenHash,
      subscription_id: subscriptionId,
      email: normalizeEmail(email),
      purpose,
      expires_at: expiresAt,
      consumed_at: consumedAt,
      created_at: createdAt,
    });
    return { changes: 1 };
  }

  function reserveRateLimit(params) {
    const [id, scope, action, bucketStart, count, updatedAt] = params;
    const existing = state.alertRequestLimits.find(
      (row) => row.scope === scope && row.action === action && row.bucket_start === bucketStart,
    );
    if (existing) {
      existing.count += 1;
      existing.updated_at = updatedAt;
      return clone({ count: existing.count });
    }

    state.alertRequestLimits.push({
      id,
      scope,
      action,
      bucket_start: bucketStart,
      count,
      updated_at: updatedAt,
    });
    return clone({ count });
  }

  function updateTokenConsumed(params) {
    const [consumedAt, tokenHash] = params;
    const row = state.subscriptionTokens.find((entry) => entry.token_hash === tokenHash);
    if (!row) return { changes: 0 };
    row.consumed_at = consumedAt;
    return { changes: 1 };
  }

  function updateSubscriptionConfirm(params) {
    const [status, confirmedAt, updatedAt, id] = params;
    const row = state.subscriptions.find((entry) => entry.id === id);
    if (!row) return { changes: 0 };
    row.status = status;
    row.confirmed_at = confirmedAt;
    row.updated_at = updatedAt;
    return { changes: 1 };
  }

  function updateSubscriptionUnsubscribe(params) {
    const [status, unsubscribedAt, updatedAt, id, email] = params;
    const row = state.subscriptions.find((entry) => entry.id === id && entry.email === normalizeEmail(email));
    if (!row) return { changes: 0 };
    row.status = status;
    row.unsubscribed_at = unsubscribedAt;
    row.updated_at = updatedAt;
    return { changes: 1 };
  }

  function selectSubscriptionsByEmail(email) {
    return state.subscriptions.filter((row) => row.email === normalizeEmail(email)).map(clone);
  }

  function selectManageToken(tokenHash, nowIso) {
    const token = state.subscriptionTokens.find(
      (row) => row.token_hash === tokenHash && row.purpose === 'manage' && row.consumed_at == null && row.expires_at > nowIso,
    );
    if (!token) return null;
    return clone(token);
  }

  function dispatch(sql, params) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalized.startsWith('select id, email, from_id, to_id, date_from, date_to, locale, status, confirmed_at, unsubscribed_at, last_alert_sent_on, created_at, updated_at from subscriptions where email = ? and from_id = ? and to_id = ? and date_from = ? and date_to = ?')) {
      return clone(findSubscriptionByKey(params));
    }

    if (normalized.startsWith('select id, email, from_id, to_id, date_from, date_to, locale, status, confirmed_at, unsubscribed_at, last_alert_sent_on, created_at, updated_at from subscriptions where id = ?')) {
      return clone(state.subscriptions.find((row) => row.id === params[0]) ?? null);
    }

    if (normalized.startsWith('select id, email, from_id, to_id, date_from, date_to, locale, status, confirmed_at, unsubscribed_at, last_alert_sent_on, created_at, updated_at from subscriptions where email = ?')) {
      return selectSubscriptionsByEmail(params[0]);
    }

    if (normalized.startsWith('select token_hash, subscription_id, email, purpose, expires_at, consumed_at, created_at from subscription_tokens where token_hash = ? and purpose = ?')) {
      return clone(
        state.subscriptionTokens.find(
          (row) => row.token_hash === params[0] && row.purpose === params[1] && row.consumed_at == null && row.expires_at > params[2],
        ) ?? null,
      );
    }

    if (normalized.startsWith('select token_hash, subscription_id, email, purpose, expires_at, consumed_at, created_at from subscription_tokens where token_hash = ?')) {
      return clone(state.subscriptionTokens.find((row) => row.token_hash === params[0]) ?? null);
    }

    if (normalized.startsWith('insert into subscriptions (id, email, from_id, to_id, date_from, date_to, locale, status, confirmed_at, unsubscribed_at, last_alert_sent_on, created_at, updated_at) values')) {
      return upsertSubscription(params);
    }

    if (normalized.startsWith('insert into subscription_tokens')) {
      return insertToken(params);
    }

    if (normalized.startsWith('insert into alert_request_limits')) {
      return reserveRateLimit(params);
    }

    if (normalized.startsWith('update subscriptions set status = ?, confirmed_at = ?, updated_at = ?')) {
      return updateSubscriptionConfirm(params);
    }

    if (normalized.startsWith('update subscriptions set status = ?, unsubscribed_at = ?, updated_at = ?')) {
      return updateSubscriptionUnsubscribe(params);
    }

    if (normalized.startsWith('update subscription_tokens set consumed_at = ? where token_hash = ?')) {
      return updateTokenConsumed(params);
    }

    throw new Error(`Unhandled SQL: ${sql}`);
  }

  return {
    state,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              return dispatch(sql, params);
            },
            async all() {
              const results = dispatch(sql, params);
              return Array.isArray(results) ? { results } : { results: results ? [results] : [] };
            },
            async run() {
              return dispatch(sql, params);
            },
          };
        },
      };
    },
  };
}

function createSnapshot(overrides = {}) {
  return {
    loadedAt: '2026-07-05T12:00:00.000Z',
    routeCatalog: [
      {
        from: { id: '7', name: 'Tbilisi (Natakhtari airport)' },
        destinations: [{ id: '4', name: 'Batumi' }],
      },
    ],
    availability: {
      '7:4': {
        outbound: ['2026-08-01', '2026-08-15', '2026-09-01'],
        returns: [],
      },
    },
    ...overrides,
  };
}

function createEnv({ db = createFakeDb(), emailSend = vi.fn(async () => {}), snapshot = createSnapshot() } = {}) {
  return {
    ALERTS_DB: db,
    EMAIL: { send: emailSend },
    db,
    emailSend,
    snapshot,
  };
}

async function readJson(response) {
  return response.json();
}

function findTokenFromSend(payload) {
  const text = payload.text ?? '';
  const match = text.match(/token=([^ \n]+)/);
  return match?.[1] ?? null;
}

describe('alert API handlers', () => {
  it('rejects malformed subscribe input before touching storage or email', async () => {
    const { db, emailSend } = createEnv();

    const response = await handleAlertsRequest(
      new Request('https://cache.example/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'not-an-email',
          fromId: '7',
          toId: '4',
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          locale: 'en',
        }),
      }),
      { ALERTS_DB: db, EMAIL: { send: emailSend } },
      { now: () => new Date('2026-07-05T12:00:00.000Z'), getAvailabilitySnapshot: () => createSnapshot() },
    );

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toMatchObject({ error: expect.any(String) });
    expect(db.state.subscriptions).toHaveLength(0);
    expect(emailSend).not.toHaveBeenCalled();
  });

  it('validates subscribe input, reuses the same subscription, sends confirmation, and returns matchingDates', async () => {
    const env = createEnv();

    const makeRequest = () =>
      new Request('https://cache.example/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: ' User@Example.com ',
          fromId: '7',
          toId: '4',
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          locale: 'ua',
        }),
      });

    const response = await handleAlertsRequest(makeRequest(), env, {
      now: () => new Date('2026-07-05T12:00:00.000Z'),
      getAvailabilitySnapshot: () => createSnapshot(),
    });

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toMatchObject({
      matchingDates: ['2026-08-01', '2026-08-15'],
    });
    expect(env.db.state.subscriptions).toHaveLength(1);
    expect(env.db.state.subscriptions[0]).toMatchObject({
      email: 'user@example.com',
      status: 'pending',
      locale: 'ua',
    });
    expect(env.emailSend).toHaveBeenCalledTimes(1);

    const token = findTokenFromSend(env.emailSend.mock.calls[0][0]);
    expect(token).toBeTruthy();
    expect(env.db.state.subscriptionTokens[0].token_hash).toBe(await hashAlertToken(token));

    const secondResponse = await handleAlertsRequest(makeRequest(), env, {
      now: () => new Date('2026-07-05T12:00:00.000Z'),
      getAvailabilitySnapshot: () => createSnapshot(),
    });

    expect(secondResponse.status).toBe(200);
    await expect(readJson(secondResponse)).resolves.toMatchObject({
      matchingDates: ['2026-08-01', '2026-08-15'],
    });
    expect(env.db.state.subscriptions).toHaveLength(1);
    expect(env.emailSend).toHaveBeenCalledTimes(2);
  });

  it('returns 503 and does not write when D1 or email provider is missing', async () => {
    const withDb = createEnv();
    const withoutDbResponse = await handleAlertsRequest(
      new Request('https://cache.example/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          fromId: '7',
          toId: '4',
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          locale: 'en',
        }),
      }),
      { EMAIL: { send: withDb.emailSend } },
      { now: () => new Date('2026-07-05T12:00:00.000Z'), getAvailabilitySnapshot: () => createSnapshot() },
    );

    expect(withoutDbResponse.status).toBe(503);
    expect(withDb.emailSend).not.toHaveBeenCalled();

    const withoutEmailDb = createEnv();
    delete withoutEmailDb.EMAIL;
    const withoutEmailResponse = await handleAlertsRequest(
      new Request('https://cache.example/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          fromId: '7',
          toId: '4',
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          locale: 'en',
        }),
      }),
      { ALERTS_DB: withoutEmailDb.db },
      { now: () => new Date('2026-07-05T12:00:00.000Z'), getAvailabilitySnapshot: () => createSnapshot() },
    );

    expect(withoutEmailResponse.status).toBe(503);
    expect(withoutEmailDb.db.state.subscriptions).toHaveLength(0);
  });

  it('rate limits subscribe requests by normalized email and request IP before creating email tokens', async () => {
    const env = createEnv();
    const makeRequest = () =>
      new Request('https://cache.example/api/alerts/subscribe', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'CF-Connecting-IP': '203.0.113.5',
        },
        body: JSON.stringify({
          email: 'User@Example.com',
          fromId: '7',
          toId: '4',
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          locale: 'en',
        }),
      });

    for (let index = 0; index < 5; index += 1) {
      const response = await handleAlertsRequest(makeRequest(), env, {
        now: () => new Date('2026-07-05T12:00:00.000Z'),
        getAvailabilitySnapshot: () => createSnapshot(),
      });
      expect(response.status).toBe(200);
    }

    const limitedResponse = await handleAlertsRequest(makeRequest(), env, {
      now: () => new Date('2026-07-05T12:00:00.000Z'),
      getAvailabilitySnapshot: () => createSnapshot(),
    });

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers.get('retry-after')).toBe('3600');
    expect(env.db.state.subscriptions).toHaveLength(1);
    expect(env.emailSend).toHaveBeenCalledTimes(5);
    expect(env.db.state.subscriptionTokens).toHaveLength(5);
    expect(env.db.state.alertRequestLimits[0]).toMatchObject({
      scope: 'user@example.com|203.0.113.5',
      action: 'subscribe',
      count: 6,
    });
  });

  it('rejects subscribe when the route does not exist in the current route catalog', async () => {
    const env = createEnv({ snapshot: createSnapshot({ routeCatalog: [], availability: {} }) });

    const response = await handleAlertsRequest(
      new Request('https://cache.example/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          fromId: '7',
          toId: '4',
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          locale: 'en',
        }),
      }),
      { ALERTS_DB: env.db, EMAIL: { send: env.emailSend } },
      { now: () => new Date('2026-07-05T12:00:00.000Z'), getAvailabilitySnapshot: () => env.snapshot },
    );

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toMatchObject({ error: expect.any(String) });
    expect(env.db.state.subscriptions).toHaveLength(0);
    expect(env.emailSend).not.toHaveBeenCalled();
  });

  it('confirms a subscription and redirects to /<locale>/?alert=confirmed', async () => {
    const env = createEnv();
    const subscribeResponse = await handleAlertsRequest(
      new Request('https://cache.example/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          fromId: '7',
          toId: '4',
          dateFrom: '2026-08-01',
          dateTo: '2026-08-31',
          locale: 'ua',
        }),
      }),
      { ALERTS_DB: env.db, EMAIL: { send: env.emailSend } },
      { now: () => new Date('2026-07-05T12:00:00.000Z'), getAvailabilitySnapshot: () => createSnapshot() },
    );

    expect(subscribeResponse.status).toBe(200);
    const token = findTokenFromSend(env.emailSend.mock.calls[0][0]);
    const confirmResponse = await handleAlertsRequest(
      new Request(`https://cache.example/api/alerts/confirm?token=${encodeURIComponent(token)}`),
      { ALERTS_DB: env.db, EMAIL: { send: env.emailSend } },
      { now: () => new Date('2026-07-05T12:00:00.000Z') },
    );

    expect(confirmResponse.status).toBe(302);
    expect(confirmResponse.headers.get('location')).toBe('https://cache.example/ua/?alert=confirmed');
    expect(env.db.state.subscriptions[0]).toMatchObject({
      status: 'active',
    });
  });

  it('returns generic success from manage-link and only sends when subscriptions exist', async () => {
    const env = createEnv();
    env.db.state.subscriptions.push({
      id: 'sub-1',
      email: 'user@example.com',
      from_id: '7',
      to_id: '4',
      date_from: '2026-08-01',
      date_to: '2026-08-31',
      locale: 'en',
      status: 'active',
      confirmed_at: '2026-07-05T12:00:00.000Z',
      unsubscribed_at: null,
      last_alert_sent_on: null,
      created_at: '2026-07-05T12:00:00.000Z',
      updated_at: '2026-07-05T12:00:00.000Z',
    });

    const hitResponse = await handleAlertsRequest(
      new Request('https://cache.example/api/alerts/manage-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'User@Example.com', locale: 'en' }),
      }),
      { ALERTS_DB: env.db, EMAIL: { send: env.emailSend } },
      { now: () => new Date('2026-07-05T12:00:00.000Z'), getAvailabilitySnapshot: () => createSnapshot() },
    );

    expect(hitResponse.status).toBe(200);
    await expect(readJson(hitResponse)).resolves.toEqual({ ok: true });
    expect(env.emailSend).toHaveBeenCalledTimes(1);
    expect(env.emailSend.mock.calls[0][0].text).toContain('/en/alerts/manage?token=');

    const missResponse = await handleAlertsRequest(
      new Request('https://cache.example/api/alerts/manage-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'missing@example.com', locale: 'en' }),
      }),
      { ALERTS_DB: env.db, EMAIL: { send: env.emailSend } },
      { now: () => new Date('2026-07-05T12:00:00.000Z'), getAvailabilitySnapshot: () => createSnapshot() },
    );

    expect(missResponse.status).toBe(200);
    await expect(readJson(missResponse)).resolves.toEqual({ ok: true });
    expect(env.emailSend).toHaveBeenCalledTimes(1);
  });

  it('returns 503 from manage-link when D1 or email provider is missing', async () => {
    const withDb = createEnv();
    const withoutDbResponse = await handleAlertsRequest(
      new Request('https://cache.example/api/alerts/manage-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', locale: 'en' }),
      }),
      { EMAIL: { send: withDb.emailSend } },
      { now: () => new Date('2026-07-05T12:00:00.000Z') },
    );

    expect(withoutDbResponse.status).toBe(503);
    expect(withDb.emailSend).not.toHaveBeenCalled();

    const withoutEmailDb = createEnv();
    const withoutEmailResponse = await handleAlertsRequest(
      new Request('https://cache.example/api/alerts/manage-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', locale: 'en' }),
      }),
      { ALERTS_DB: withoutEmailDb.db },
      { now: () => new Date('2026-07-05T12:00:00.000Z') },
    );

    expect(withoutEmailResponse.status).toBe(503);
    expect(withoutEmailDb.db.state.subscriptionTokens).toHaveLength(0);
  });

  it('rate limits manage-link requests by normalized email and request IP before sending email', async () => {
    const env = createEnv();
    env.db.state.subscriptions.push({
      id: 'sub-1',
      email: 'user@example.com',
      from_id: '7',
      to_id: '4',
      date_from: '2026-08-01',
      date_to: '2026-08-31',
      locale: 'en',
      status: 'active',
      confirmed_at: '2026-07-05T12:00:00.000Z',
      unsubscribed_at: null,
      last_alert_sent_on: null,
      created_at: '2026-07-05T12:00:00.000Z',
      updated_at: '2026-07-05T12:00:00.000Z',
    });
    const makeRequest = () =>
      new Request('https://cache.example/api/alerts/manage-link', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'CF-Connecting-IP': '203.0.113.6',
        },
        body: JSON.stringify({ email: 'USER@example.com', locale: 'en' }),
      });

    for (let index = 0; index < 5; index += 1) {
      const response = await handleAlertsRequest(makeRequest(), env, {
        now: () => new Date('2026-07-05T12:00:00.000Z'),
      });
      expect(response.status).toBe(200);
    }

    const limitedResponse = await handleAlertsRequest(makeRequest(), env, {
      now: () => new Date('2026-07-05T12:00:00.000Z'),
    });

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers.get('retry-after')).toBe('3600');
    expect(env.emailSend).toHaveBeenCalledTimes(5);
    expect(env.db.state.subscriptionTokens).toHaveLength(5);
    expect(env.db.state.alertRequestLimits[0]).toMatchObject({
      scope: 'user@example.com|203.0.113.6',
      action: 'manage-link',
      count: 6,
    });
  });

  it('returns scoped subscriptions from manage and only unsubscribes the targeted subscription with a valid token', async () => {
    const env = createEnv();
    const manageToken = 'manage-token';
    env.db.state.subscriptions.push(
      {
        id: 'sub-1',
        email: 'user@example.com',
        from_id: '7',
        to_id: '4',
        date_from: '2026-08-01',
        date_to: '2026-08-31',
        locale: 'en',
        status: 'active',
        confirmed_at: '2026-07-05T12:00:00.000Z',
        unsubscribed_at: null,
        last_alert_sent_on: '2026-07-04',
        created_at: '2026-07-05T12:00:00.000Z',
        updated_at: '2026-07-05T12:00:00.000Z',
      },
      {
        id: 'sub-2',
        email: 'user@example.com',
        from_id: '1',
        to_id: '2',
        date_from: '2026-08-01',
        date_to: '2026-08-31',
        locale: 'en',
        status: 'active',
        confirmed_at: '2026-07-05T12:00:00.000Z',
        unsubscribed_at: null,
        last_alert_sent_on: null,
        created_at: '2026-07-05T12:00:00.000Z',
        updated_at: '2026-07-05T12:00:00.000Z',
      },
      {
        id: 'sub-3',
        email: 'other@example.com',
        from_id: '7',
        to_id: '4',
        date_from: '2026-08-01',
        date_to: '2026-08-31',
        locale: 'en',
        status: 'active',
        confirmed_at: '2026-07-05T12:00:00.000Z',
        unsubscribed_at: null,
        last_alert_sent_on: null,
        created_at: '2026-07-05T12:00:00.000Z',
        updated_at: '2026-07-05T12:00:00.000Z',
      },
    );
    env.db.state.subscriptionTokens.push({
      token_hash: await hashAlertToken(manageToken),
      subscription_id: null,
      email: 'user@example.com',
      purpose: 'manage',
      expires_at: '2026-07-06T12:00:00.000Z',
      consumed_at: null,
      created_at: '2026-07-05T12:00:00.000Z',
    });

    const manageResponse = await handleAlertsRequest(
      new Request(`https://cache.example/api/alerts/manage?token=${encodeURIComponent(manageToken)}`),
      { ALERTS_DB: env.db, EMAIL: { send: env.emailSend } },
      { now: () => new Date('2026-07-05T12:00:00.000Z'), getAvailabilitySnapshot: () => createSnapshot() },
    );

    expect(manageResponse.status).toBe(200);
    await expect(readJson(manageResponse)).resolves.toMatchObject({
      email: 'user@example.com',
      subscriptions: [
        expect.objectContaining({
          id: 'sub-1',
          email: 'user@example.com',
          fromId: '7',
          toId: '4',
          lastAlertSentOn: '2026-07-04',
        }),
        expect.objectContaining({ id: 'sub-2', email: 'user@example.com' }),
      ],
    });
    expect(env.db.state.subscriptionTokens[0].consumed_at).toBeNull();

    const unsubscribeResponse = await handleAlertsRequest(
      new Request(`https://cache.example/api/alerts/sub-1/unsubscribe?token=${encodeURIComponent(manageToken)}`, {
        method: 'POST',
      }),
      { ALERTS_DB: env.db, EMAIL: { send: env.emailSend } },
      { now: () => new Date('2026-07-05T12:00:00.000Z'), getAvailabilitySnapshot: () => createSnapshot() },
    );

    expect(unsubscribeResponse.status).toBe(200);
    await expect(readJson(unsubscribeResponse)).resolves.toEqual({ ok: true });
    expect(env.db.state.subscriptions.find((row) => row.id === 'sub-1')).toMatchObject({ status: 'unsubscribed' });
    expect(env.db.state.subscriptions.find((row) => row.id === 'sub-2')).toMatchObject({ status: 'active' });
    expect(env.db.state.subscriptions.find((row) => row.id === 'sub-3')).toMatchObject({ status: 'active' });

    const secondManageResponse = await handleAlertsRequest(
      new Request(`https://cache.example/api/alerts/manage?token=${encodeURIComponent(manageToken)}`),
      { ALERTS_DB: env.db, EMAIL: { send: env.emailSend } },
      { now: () => new Date('2026-07-05T12:00:00.000Z'), getAvailabilitySnapshot: () => createSnapshot() },
    );

    expect(secondManageResponse.status).toBe(200);
    await expect(readJson(secondManageResponse)).resolves.toMatchObject({
      email: 'user@example.com',
      subscriptions: [
        expect.objectContaining({
          id: 'sub-1',
          status: 'unsubscribed',
          lastAlertSentOn: '2026-07-04',
        }),
        expect.objectContaining({
          id: 'sub-2',
          status: 'active',
        }),
      ],
    });
    expect(env.db.state.subscriptionTokens[0].consumed_at).toBeNull();
  });

  it('falls back to empty matchingDates when availability decoration fails for manage', async () => {
    const env = createEnv();
    const manageToken = 'manage-token';
    env.db.state.subscriptions.push({
      id: 'sub-1',
      email: 'user@example.com',
      from_id: '7',
      to_id: '4',
      date_from: '2026-08-01',
      date_to: '2026-08-31',
      locale: 'en',
      status: 'active',
      confirmed_at: '2026-07-05T12:00:00.000Z',
      unsubscribed_at: null,
      last_alert_sent_on: '2026-07-04',
      created_at: '2026-07-05T12:00:00.000Z',
      updated_at: '2026-07-05T12:00:00.000Z',
    });
    env.db.state.subscriptionTokens.push({
      token_hash: await hashAlertToken(manageToken),
      subscription_id: null,
      email: 'user@example.com',
      purpose: 'manage',
      expires_at: '2026-07-06T12:00:00.000Z',
      consumed_at: null,
      created_at: '2026-07-05T12:00:00.000Z',
    });

    const response = await handleAlertsRequest(
      new Request(`https://cache.example/api/alerts/manage?token=${encodeURIComponent(manageToken)}`),
      { ALERTS_DB: env.db, EMAIL: { send: env.emailSend } },
      {
        now: () => new Date('2026-07-05T12:00:00.000Z'),
        getAvailabilitySnapshot: () => {
          throw new Error('availability offline');
        },
      },
    );

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toMatchObject({
      email: 'user@example.com',
      subscriptions: [
        expect.objectContaining({
          id: 'sub-1',
          matchingDates: [],
          lastAlertSentOn: '2026-07-04',
        }),
      ],
    });
    expect(env.db.state.subscriptionTokens[0].consumed_at).toBeNull();
  });
});

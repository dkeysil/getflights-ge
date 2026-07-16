import { describe, expect, it } from 'vitest';
import { createAlertStore, AlertStoreUnavailableError } from './alerts-store.js';

function createFakeDb() {
  const state = {
    subscriptions: [],
    subscriptionTokens: [],
    alertSendLog: [],
    alertRequestLimits: [],
  };

  const counters = {
    selectSubscriptionByKey: 0,
    selectSubscriptionById: 0,
    selectSubscriptionByEmail: 0,
    selectActiveSubscriptions: 0,
    selectTokenByHash: 0,
    selectPendingTokenByHash: 0,
    insertSubscription: 0,
    updateSubscriptionUpsert: 0,
    updateSubscriptionConfirm: 0,
    updateSubscriptionUnsubscribe: 0,
    updateSubscriptionAlert: 0,
    insertToken: 0,
    updateTokenConsumed: 0,
    insertAlertSendLog: 0,
    finalizeAlertSendLog: 0,
    deleteExpiredPending: 0,
    deleteExpiredRateLimits: 0,
    reserveRateLimit: 0,
    upsertSubscriptionConflict: 0,
  };

  function normalizeEmail(email) {
    return String(email).trim().toLowerCase();
  }

  function clone(row) {
    return row ? JSON.parse(JSON.stringify(row)) : null;
  }

  function findSubscriptionByKey(params) {
    const [email, fromId, toId, dateFrom, dateTo] = params;
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
    const existing = state.subscriptions.find((row) => row.id === id);
    if (existing) {
      Object.assign(existing, {
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
        updated_at: updatedAt,
      });
      return { changes: 1 };
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
    return { changes: 1, lastInsertRowid: id };
  }

  function upsertSubscriptionConflict(params) {
    const [id, email, fromId, toId, dateFrom, dateTo, locale, status, confirmedAt, unsubscribedAt, lastAlertSentOn, createdAt, updatedAt] = params;
    const existing = findSubscriptionByKey([email, fromId, toId, dateFrom, dateTo]);
    if (existing) {
      existing.email = normalizeEmail(email);
      existing.from_id = fromId;
      existing.to_id = toId;
      existing.date_from = dateFrom;
      existing.date_to = dateTo;
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
      confirmed_at: status === 'active' ? confirmedAt : null,
      unsubscribed_at: status === 'active' ? unsubscribedAt : null,
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

  function updateTokenConsumed(params) {
    const [consumedAt, tokenHash] = params;
    const row = state.subscriptionTokens.find((entry) => entry.token_hash === tokenHash);
    if (row) {
      row.consumed_at = consumedAt;
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  function updateSubscriptionUpsert(params) {
    const [email, fromId, toId, dateFrom, dateTo, locale, status, confirmedAt, unsubscribedAt, updatedAt, id] = params;
    const row = state.subscriptions.find((entry) => entry.id === id);
    if (!row) return { changes: 0 };
    row.email = normalizeEmail(email);
    row.from_id = fromId;
    row.to_id = toId;
    row.date_from = dateFrom;
    row.date_to = dateTo;
    row.locale = locale;
    row.status = status;
    row.confirmed_at = confirmedAt;
    row.unsubscribed_at = unsubscribedAt;
    row.updated_at = updatedAt;
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

  function updateSubscriptionAlert(params) {
    const [lastAlertSentOn, updatedAt, id] = params;
    const row = state.subscriptions.find((entry) => entry.id === id);
    if (!row) return { changes: 0 };
    row.last_alert_sent_on = lastAlertSentOn;
    row.updated_at = updatedAt;
    return { changes: 1 };
  }

  function insertAlertSendLog(params) {
    const [id, subscriptionId, sentOn, matchingDatesJson, providerStatus, errorSummary, createdAt] = params;
    const existing = state.alertSendLog.find((row) => row.subscription_id === subscriptionId && row.sent_on === sentOn);
    if (existing) return { changes: 0 };
    state.alertSendLog.push({
      id,
      subscription_id: subscriptionId,
      sent_on: sentOn,
      matching_dates_json: matchingDatesJson,
      provider_status: providerStatus,
      error_summary: errorSummary,
      created_at: createdAt,
    });
    return { changes: 1 };
  }

  function finalizeAlertSendLog(params) {
    const [providerStatus, errorSummary, subscriptionId, sentOn] = params;
    const row = state.alertSendLog.find((entry) => entry.subscription_id === subscriptionId && entry.sent_on === sentOn);
    if (!row) return { changes: 0 };
    row.provider_status = providerStatus;
    row.error_summary = errorSummary ?? null;
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

  function deleteSubscriptionTokens(params) {
    const [subscriptionId] = params;
    const before = state.subscriptionTokens.length;
    state.subscriptionTokens = state.subscriptionTokens.filter((row) => row.subscription_id !== subscriptionId);
    return { changes: before - state.subscriptionTokens.length };
  }

  function deleteExpiredPending(params) {
    const [cutoffIso] = params;
    const expiredIds = state.subscriptions
      .filter((row) => row.status === 'pending' && row.created_at < cutoffIso)
      .map((row) => row.id);
    const beforeIds = new Set(expiredIds);
    state.subscriptions = state.subscriptions.filter((row) => !(row.status === 'pending' && row.created_at < cutoffIso));
    state.subscriptionTokens = state.subscriptionTokens.filter((row) => !beforeIds.has(row.subscription_id));
    return expiredIds;
  }

  function deleteExpiredRateLimits(params) {
    const [cutoffIso] = params;
    const before = state.alertRequestLimits.length;
    state.alertRequestLimits = state.alertRequestLimits.filter((row) => row.bucket_start >= cutoffIso);
    return { changes: before - state.alertRequestLimits.length };
  }

  function dispatch(sql, params, mode) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalized.startsWith('select id, email, from_id, to_id, date_from, date_to, locale, status, confirmed_at, unsubscribed_at, last_alert_sent_on, created_at, updated_at from subscriptions where email = ? and from_id = ? and to_id = ? and date_from = ? and date_to = ?')) {
      counters.selectSubscriptionByKey += 1;
      return clone(findSubscriptionByKey(params));
    }

    if (normalized.startsWith('select id, email, from_id, to_id, date_from, date_to, locale, status, confirmed_at, unsubscribed_at, last_alert_sent_on, created_at, updated_at from subscriptions where id = ?')) {
      counters.selectSubscriptionById += 1;
      return clone(state.subscriptions.find((row) => row.id === params[0]) ?? null);
    }

    if (normalized.startsWith('select id, email, from_id, to_id, date_from, date_to, locale, status, confirmed_at, unsubscribed_at, last_alert_sent_on, created_at, updated_at from subscriptions where email = ?')) {
      counters.selectSubscriptionByEmail += 1;
      return state.subscriptions.filter((row) => row.email === normalizeEmail(params[0])).map(clone);
    }

    if (normalized.startsWith('select id, email, from_id, to_id, date_from, date_to, locale, status, confirmed_at, unsubscribed_at, last_alert_sent_on, created_at, updated_at from subscriptions where status = ?')) {
      counters.selectActiveSubscriptions += 1;
      return state.subscriptions.filter((row) => row.status === params[0]).map(clone);
    }

    if (normalized.startsWith('select token_hash, subscription_id, email, purpose, expires_at, consumed_at, created_at from subscription_tokens where token_hash = ? and purpose = ?')) {
      counters.selectPendingTokenByHash += 1;
      return clone(
        state.subscriptionTokens.find(
          (row) => row.token_hash === params[0] && row.purpose === params[1] && row.consumed_at == null && row.expires_at > params[2],
        ) ?? null,
      );
    }

    if (normalized.startsWith('select token_hash, subscription_id, email, purpose, expires_at, consumed_at, created_at from subscription_tokens where token_hash = ?')) {
      counters.selectTokenByHash += 1;
      return clone(state.subscriptionTokens.find((row) => row.token_hash === params[0]) ?? null);
    }

    if (normalized.startsWith('insert into subscriptions (id, email, from_id, to_id, date_from, date_to, locale, status, confirmed_at, unsubscribed_at, last_alert_sent_on, created_at, updated_at) values')) {
      counters.upsertSubscriptionConflict += 1;
      return upsertSubscriptionConflict(params);
    }

    if (normalized.startsWith('update subscriptions set email = ?')) {
      counters.updateSubscriptionUpsert += 1;
      return updateSubscriptionUpsert(params);
    }

    if (normalized.startsWith('update subscriptions set status = ?, confirmed_at = ?, updated_at = ?')) {
      counters.updateSubscriptionConfirm += 1;
      return updateSubscriptionConfirm(params);
    }

    if (normalized.startsWith('update subscriptions set status = ?, unsubscribed_at = ?, updated_at = ?')) {
      counters.updateSubscriptionUnsubscribe += 1;
      return updateSubscriptionUnsubscribe(params);
    }

    if (normalized.startsWith('update subscriptions set last_alert_sent_on = ?, updated_at = ?')) {
      counters.updateSubscriptionAlert += 1;
      return updateSubscriptionAlert(params);
    }

    if (normalized.startsWith('insert into subscription_tokens')) {
      counters.insertToken += 1;
      return insertToken(params);
    }

    if (normalized.startsWith('update subscription_tokens set consumed_at = ? where token_hash = ?')) {
      counters.updateTokenConsumed += 1;
      return updateTokenConsumed(params);
    }

    if (normalized.startsWith('insert or ignore into alert_send_log')) {
      counters.insertAlertSendLog += 1;
      return insertAlertSendLog(params);
    }

    if (normalized.startsWith('update alert_send_log set provider_status = ?, error_summary = ? where subscription_id = ? and sent_on = ?')) {
      counters.finalizeAlertSendLog += 1;
      return finalizeAlertSendLog(params);
    }

    if (normalized.startsWith('insert into alert_request_limits')) {
      counters.reserveRateLimit += 1;
      return reserveRateLimit(params);
    }

    if (normalized.startsWith('delete from subscription_tokens where subscription_id = ?')) {
      counters.deleteExpiredPending += 1;
      return deleteSubscriptionTokens(params);
    }

    if (normalized.startsWith('delete from subscriptions where status = ? and created_at < ? returning id')) {
      counters.deleteExpiredPending += 1;
      return deleteExpiredPending(params).map((id) => ({ id }));
    }

    if (normalized.startsWith('delete from subscriptions where status = ? and created_at < ?')) {
      counters.deleteExpiredPending += 1;
      return { changes: deleteExpiredPending(params).length };
    }

    if (normalized.startsWith('delete from alert_request_limits where bucket_start < ?')) {
      counters.deleteExpiredRateLimits += 1;
      return deleteExpiredRateLimits(params);
    }

    throw new Error(`Unexpected SQL: ${sql}`);
  }

  return {
    state,
    counters,
    prepare(sql) {
      let bound = [];
      return {
        bind(...values) {
          bound = values;
          return this;
        },
        async first() {
          return dispatch(sql, bound, 'first');
        },
        async all() {
          return { results: dispatch(sql, bound, 'all') };
        },
        async run() {
          return dispatch(sql, bound, 'run');
        },
      };
    },
  };
}

describe('alert store', () => {
  it('reuses one subscription id when the same subscription is upserted twice', async () => {
    let counter = 0;
    const db = createFakeDb();
    const store = createAlertStore(db, {
      now: () => new Date('2026-07-05T12:00:00.000Z'),
      randomUUID: () => `sub-${++counter}`,
    });

    const first = await store.upsertSubscription({
      email: 'User@Example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'en',
    });
    const second = await store.upsertSubscription({
      email: 'user@example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'en',
    });

    expect(first.id).toBe(second.id);
    expect(db.state.subscriptions).toHaveLength(1);
    expect(db.state.subscriptions[0].id).toBe('sub-1');
  });

  it('reuses the existing subscription id when the insert conflicts', async () => {
    const db = createFakeDb();
    db.state.subscriptions.push({
      id: 'existing-1',
      email: 'user@example.com',
      from_id: '7',
      to_id: '4',
      date_from: '2026-08-01',
      date_to: '2026-08-31',
      locale: 'en',
      status: 'pending',
      confirmed_at: null,
      unsubscribed_at: null,
      last_alert_sent_on: null,
      created_at: '2026-07-05T11:00:00.000Z',
      updated_at: '2026-07-05T11:00:00.000Z',
    });
    const store = createAlertStore(db, {
      now: () => new Date('2026-07-05T12:00:00.000Z'),
      randomUUID: () => 'new-id',
    });

    const upserted = await store.upsertSubscription({
      email: 'USER@example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'en',
    });

    expect(upserted.id).toBe('existing-1');
    expect(db.state.subscriptions).toHaveLength(1);
    expect(db.counters.upsertSubscriptionConflict).toBe(1);
  });

  it('preserves last_alert_sent_on when reusing an existing subscription', async () => {
    const db = createFakeDb();
    db.state.subscriptions.push({
      id: 'existing-1',
      email: 'user@example.com',
      from_id: '7',
      to_id: '4',
      date_from: '2026-08-01',
      date_to: '2026-08-31',
      locale: 'en',
      status: 'active',
      confirmed_at: '2026-07-05T11:00:00.000Z',
      unsubscribed_at: null,
      last_alert_sent_on: '2026-07-05',
      created_at: '2026-07-05T11:00:00.000Z',
      updated_at: '2026-07-05T11:00:00.000Z',
    });
    const store = createAlertStore(db, {
      now: () => new Date('2026-07-05T12:00:00.000Z'),
      randomUUID: () => 'new-id',
    });

    const upserted = await store.upsertSubscription({
      email: 'USER@example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'ua',
    });

    expect(upserted).toMatchObject({
      id: 'existing-1',
      locale: 'ua',
      status: 'active',
      last_alert_sent_on: '2026-07-05',
    });
    expect(db.state.subscriptions[0].last_alert_sent_on).toBe('2026-07-05');
  });

  it('stores only the token hash and expiry when creating a confirmation token', async () => {
    const db = createFakeDb();
    const store = createAlertStore(db, {
      now: () => new Date('2026-07-05T12:00:00.000Z'),
      randomUUID: () => 'token-id-1',
    });

    await store.createToken({
      subscriptionId: 'sub-1',
      email: 'User@Example.com',
      purpose: 'confirm',
      tokenHash: 'hash-123',
      expiresAt: '2026-07-06T12:00:00.000Z',
    });

    expect(db.state.subscriptionTokens).toEqual([
      {
        token_hash: 'hash-123',
        subscription_id: 'sub-1',
        email: 'user@example.com',
        purpose: 'confirm',
        expires_at: '2026-07-06T12:00:00.000Z',
        consumed_at: null,
        created_at: '2026-07-05T12:00:00.000Z',
      },
    ]);
  });

  it('confirms a subscription token and consumes the token row', async () => {
    const db = createFakeDb();
    const store = createAlertStore(db, {
      now: () => new Date('2026-07-05T12:00:00.000Z'),
      randomUUID: () => 'sub-1',
    });

    await store.upsertSubscription({
      email: 'user@example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'en',
    });
    await store.createToken({
      subscriptionId: 'sub-1',
      email: 'user@example.com',
      purpose: 'confirm',
      tokenHash: 'confirm-hash',
      expiresAt: '2026-07-06T12:00:00.000Z',
    });

    const confirmed = await store.confirmSubscriptionByToken('confirm-hash');

    expect(confirmed).toMatchObject({
      id: 'sub-1',
      status: 'active',
      confirmed_at: '2026-07-05T12:00:00.000Z',
    });
    expect(db.state.subscriptionTokens[0].consumed_at).toBe('2026-07-05T12:00:00.000Z');
    expect(db.state.subscriptions[0].status).toBe('active');
  });

  it('returns subscriptions for a manage token by normalized email', async () => {
    const db = createFakeDb();
    const store = createAlertStore(db, {
      now: () => new Date('2026-07-05T12:00:00.000Z'),
      randomUUID: () => `sub-${db.state.subscriptions.length + 1}`,
    });

    await store.upsertSubscription({
      email: 'User@Example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'en',
    });
    await store.upsertSubscription({
      email: 'user@example.com',
      fromId: '1',
      toId: '2',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'en',
    });
    await store.createToken({
      subscriptionId: null,
      email: 'User@Example.com',
      purpose: 'manage',
      tokenHash: 'manage-hash',
      expiresAt: '2026-07-06T12:00:00.000Z',
    });

    const subscriptions = await store.consumeManageToken('manage-hash');

    expect(subscriptions).toHaveLength(2);
    expect(subscriptions.map((row) => row.email)).toEqual(['user@example.com', 'user@example.com']);
    expect(db.state.subscriptionTokens[0].consumed_at).toBe('2026-07-05T12:00:00.000Z');
  });

  it('marks one subscription unsubscribed', async () => {
    const db = createFakeDb();
    const store = createAlertStore(db, {
      now: () => new Date('2026-07-05T12:00:00.000Z'),
      randomUUID: () => 'sub-1',
    });

    await store.upsertSubscription({
      email: 'user@example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'en',
    });

    const unsubscribed = await store.unsubscribeSubscription({ id: 'sub-1', email: 'USER@example.com' });

    expect(unsubscribed).toMatchObject({
      id: 'sub-1',
      status: 'unsubscribed',
      unsubscribed_at: '2026-07-05T12:00:00.000Z',
    });
  });

  it('reactivates an unsubscribed subscription back to pending on resubscribe', async () => {
    const db = createFakeDb();
    const times = [
      new Date('2026-07-05T12:00:00.000Z'),
      new Date('2026-07-05T13:00:00.000Z'),
      new Date('2026-07-05T14:00:00.000Z'),
    ];
    const store = createAlertStore(db, {
      now: () => times.shift() ?? new Date('2026-07-05T15:00:00.000Z'),
      randomUUID: () => 'sub-1',
    });

    const first = await store.upsertSubscription({
      email: 'user@example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'en',
    });
    await store.unsubscribeSubscription({ id: first.id, email: 'user@example.com' });
    const resubscribed = await store.upsertSubscription({
      email: 'USER@example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'ua',
    });

    expect(resubscribed.id).toBe(first.id);
    expect(resubscribed.status).toBe('pending');
    expect(resubscribed.unsubscribed_at).toBeNull();
    expect(resubscribed.locale).toBe('ua');
    expect(resubscribed.updated_at).toBe('2026-07-05T14:00:00.000Z');
  });

  it('returns null when unsubscribing without matching id and email', async () => {
    const db = createFakeDb();
    const store = createAlertStore(db, {
      now: () => new Date('2026-07-05T12:00:00.000Z'),
      randomUUID: () => 'sub-1',
    });

    await store.upsertSubscription({
      email: 'user@example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'en',
    });

    await expect(store.unsubscribeSubscription({ id: 'sub-1', email: 'other@example.com' })).resolves.toBeNull();
    expect(db.state.subscriptions[0].status).toBe('pending');
  });

  it('updates last_alert_sent_on and inserts a send log for a successful alert', async () => {
    const db = createFakeDb();
    const store = createAlertStore(db, {
      now: () => new Date('2026-07-05T12:00:00.000Z'),
      randomUUID: () => 'sub-1',
    });

    await store.upsertSubscription({
      email: 'user@example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'en',
    });
    await store.recordAlertSend({
      subscriptionId: 'sub-1',
      sentOn: '2026-07-05',
      matchingDates: ['2026-08-01', '2026-08-15'],
      providerStatus: 'delivered',
      errorSummary: null,
    });

    expect(db.state.subscriptions[0].last_alert_sent_on).toBe('2026-07-05');
    expect(db.state.alertSendLog).toEqual([
      {
        id: 'sub-1',
        subscription_id: 'sub-1',
        sent_on: '2026-07-05',
        matching_dates_json: '["2026-08-01","2026-08-15"]',
        provider_status: 'delivered',
        error_summary: null,
        created_at: '2026-07-05T12:00:00.000Z',
      },
    ]);
  });

  it('reserves alert sends before delivery and finalizes them afterward', async () => {
    const db = createFakeDb();
    const store = createAlertStore(db, {
      now: () => new Date('2026-07-05T12:00:00.000Z'),
      randomUUID: () => 'sub-1',
    });

    await store.upsertSubscription({
      email: 'user@example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'en',
    });

    await expect(
      store.reserveAlertSend({
        subscriptionId: 'sub-1',
        sentOn: '2026-07-05',
        matchingDates: ['2026-08-01'],
      }),
    ).resolves.toBe(true);

    expect(db.state.subscriptions[0].last_alert_sent_on).toBe('2026-07-05');
    expect(db.state.alertSendLog).toEqual([
      {
        id: 'sub-1',
        subscription_id: 'sub-1',
        sent_on: '2026-07-05',
        matching_dates_json: '["2026-08-01"]',
        provider_status: 'reserved',
        error_summary: null,
        created_at: '2026-07-05T12:00:00.000Z',
      },
    ]);

    await store.finalizeAlertSend({
      subscriptionId: 'sub-1',
      sentOn: '2026-07-05',
      providerStatus: 'sent',
    });

    expect(db.state.alertSendLog[0]).toMatchObject({
      provider_status: 'sent',
      error_summary: null,
    });
  });

  it('treats a subscription-day reservation as idempotent', async () => {
    const db = createFakeDb();
    const store = createAlertStore(db, {
      now: () => new Date('2026-07-05T12:00:00.000Z'),
      randomUUID: () => 'sub-1',
    });

    await store.upsertSubscription({
      email: 'user@example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'en',
    });

    await expect(
      store.reserveAlertSend({
        subscriptionId: 'sub-1',
        sentOn: '2026-07-05',
        matchingDates: ['2026-08-01'],
      }),
    ).resolves.toBe(true);
    await expect(
      store.reserveAlertSend({
        subscriptionId: 'sub-1',
        sentOn: '2026-07-05',
        matchingDates: ['2026-08-01'],
      }),
    ).resolves.toBe(false);

    expect(db.state.alertSendLog).toHaveLength(1);
    expect(db.state.subscriptions[0].last_alert_sent_on).toBe('2026-07-05');
  });

  it('increments fixed-window rate limits and rejects requests above the limit', async () => {
    const db = createFakeDb();
    const store = createAlertStore(db, {
      now: () => new Date('2026-07-05T12:34:56.000Z'),
      randomUUID: () => `limit-${db.state.alertRequestLimits.length + 1}`,
    });

    await expect(
      store.reserveRateLimit({
        action: 'subscribe',
        email: 'User@Example.com',
        ip: '203.0.113.5',
        limit: 2,
        windowSeconds: 3600,
      }),
    ).resolves.toMatchObject({ allowed: true, count: 1, retryAfterSeconds: 3600 });
    await expect(
      store.reserveRateLimit({
        action: 'subscribe',
        email: 'user@example.com',
        ip: '203.0.113.5',
        limit: 2,
        windowSeconds: 3600,
      }),
    ).resolves.toMatchObject({ allowed: true, count: 2, retryAfterSeconds: 3600 });
    await expect(
      store.reserveRateLimit({
        action: 'subscribe',
        email: 'USER@example.com',
        ip: '203.0.113.5',
        limit: 2,
        windowSeconds: 3600,
      }),
    ).resolves.toMatchObject({ allowed: false, count: 3, retryAfterSeconds: 3600 });

    expect(db.state.alertRequestLimits).toEqual([
      {
        id: 'limit-1',
        scope: 'user@example.com|203.0.113.5',
        action: 'subscribe',
        bucket_start: '2026-07-05T12:00:00.000Z',
        count: 3,
        updated_at: '2026-07-05T12:34:56.000Z',
      },
    ]);
    expect(db.counters.reserveRateLimit).toBe(3);
  });

  it('deletes rate-limit buckets older than the cutoff', async () => {
    const db = createFakeDb();
    db.state.alertRequestLimits.push(
      {
        id: 'old-limit',
        scope: 'user@example.com|203.0.113.5',
        action: 'subscribe',
        bucket_start: '2026-07-01T12:00:00.000Z',
        count: 3,
        updated_at: '2026-07-01T12:34:56.000Z',
      },
      {
        id: 'fresh-limit',
        scope: 'user@example.com|203.0.113.5',
        action: 'subscribe',
        bucket_start: '2026-07-05T12:00:00.000Z',
        count: 1,
        updated_at: '2026-07-05T12:34:56.000Z',
      },
    );
    const store = createAlertStore(db, {
      now: () => new Date('2026-07-05T12:34:56.000Z'),
      randomUUID: () => 'unused',
    });

    await expect(store.deleteExpiredRateLimits('2026-07-03T00:00:00.000Z')).resolves.toBe(1);

    expect(db.state.alertRequestLimits.map((row) => row.id)).toEqual(['fresh-limit']);
    expect(db.counters.deleteExpiredRateLimits).toBe(1);
  });

  it('deletes expired pending subscriptions and their tokens', async () => {
    const db = createFakeDb();
    const store = createAlertStore(db, {
      now: () => new Date('2026-07-05T12:00:00.000Z'),
      randomUUID: () => 'sub-1',
    });

    await store.upsertSubscription({
      email: 'old@example.com',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'en',
    });
    await store.createToken({
      subscriptionId: 'sub-1',
      email: 'old@example.com',
      purpose: 'confirm',
      tokenHash: 'old-token',
      expiresAt: '2026-07-06T12:00:00.000Z',
    });

    const removed = await store.deleteExpiredPending('2026-07-05T00:00:00.000Z');

    expect(removed).toBe(1);
    expect(db.state.subscriptions).toHaveLength(0);
    expect(db.state.subscriptionTokens).toHaveLength(0);
  });

  it('throws a clear error when the db adapter is missing', () => {
    expect(() => createAlertStore()).toThrow(AlertStoreUnavailableError);
    expect(() => createAlertStore(null)).toThrow('Alert store is unavailable');
  });
});

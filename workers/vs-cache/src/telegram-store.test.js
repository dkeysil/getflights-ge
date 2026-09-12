import { describe, expect, it } from 'vitest';
import { createFakeDb } from './telegram-store.fake.js';
import { createTelegramAlertStore, TelegramAlertStoreUnavailableError } from './telegram-store.js';

const routeInput = {
  fromId: '7',
  toId: '4',
  dateFrom: '2026-08-01',
  dateTo: '2026-08-31',
  locale: 'en',
};

function createStore(db, nowIso = '2026-08-01T10:00:00.000Z') {
  let counter = 0;
  return createTelegramAlertStore(db, {
    now: () => new Date(nowIso),
    randomUUID: () => `id-${++counter}`,
  });
}

describe('createTelegramAlertStore', () => {
  it('fails closed without a D1 binding', () => {
    expect(() => createTelegramAlertStore(null)).toThrow(TelegramAlertStoreUnavailableError);
    expect(() => createTelegramAlertStore({})).toThrow(TelegramAlertStoreUnavailableError);
  });
});

describe('link tokens', () => {
  it('consumes a valid token exactly once', async () => {
    const db = createFakeDb();
    const store = createStore(db);
    await store.createLinkToken({ tokenHash: 'hash-1', ...routeInput, expiresAt: '2026-08-01T10:15:00.000Z' });

    const first = await store.consumeLinkToken('hash-1');
    const second = await store.consumeLinkToken('hash-1');

    expect(first).toMatchObject({ from_id: '7', to_id: '4', locale: 'en' });
    expect(second).toBeNull();
  });

  it('refuses an expired token', async () => {
    const db = createFakeDb();
    const store = createStore(db);
    await store.createLinkToken({ tokenHash: 'hash-1', ...routeInput, expiresAt: '2026-08-01T09:00:00.000Z' });

    expect(await store.consumeLinkToken('hash-1')).toBeNull();
  });

  it('refuses an unknown token', async () => {
    expect(await createStore(createFakeDb()).consumeLinkToken('nope')).toBeNull();
  });

  it('deletes expired tokens during cleanup', async () => {
    const db = createFakeDb();
    const store = createStore(db);
    await store.createLinkToken({ tokenHash: 'old', ...routeInput, expiresAt: '2026-08-01T09:00:00.000Z' });
    await store.createLinkToken({ tokenHash: 'new', ...routeInput, expiresAt: '2026-08-01T11:00:00.000Z' });

    expect(await store.deleteExpiredLinkTokens()).toBe(1);
    expect(db.state.linkTokens).toHaveLength(1);
  });
});

describe('subscriptions', () => {
  it('binds a subscription to a chat and reactivates it on repeat', async () => {
    const db = createFakeDb();
    const store = createStore(db);

    const created = await store.activateSubscription({ chatId: '99', ...routeInput });
    await store.unsubscribeChat('99');
    const reactivated = await store.activateSubscription({ chatId: '99', ...routeInput, locale: 'ka' });

    expect(created.chat_id).toBe('99');
    expect(created.status).toBe('active');
    expect(db.state.subscriptions).toHaveLength(1);
    expect(reactivated.status).toBe('active');
    expect(reactivated.locale).toBe('ka');
  });

  it('unsubscribes every active subscription of one chat only', async () => {
    const db = createFakeDb();
    const store = createStore(db);
    await store.activateSubscription({ chatId: '99', ...routeInput });
    await store.activateSubscription({ chatId: '99', ...routeInput, toId: '5' });
    await store.activateSubscription({ chatId: '100', ...routeInput });

    expect(await store.unsubscribeChat('99')).toBe(2);
    expect(await store.unsubscribeChat('99')).toBe(0);
    expect(await store.listActiveSubscriptionsForChat('100')).toHaveLength(1);
  });

  it('lists only active subscriptions for the scheduler', async () => {
    const db = createFakeDb();
    const store = createStore(db);
    await store.activateSubscription({ chatId: '99', ...routeInput });
    await store.activateSubscription({ chatId: '100', ...routeInput });
    await store.unsubscribeChat('100');

    const active = await store.listActiveSubscriptions();

    expect(active).toHaveLength(1);
    expect(active[0].chat_id).toBe('99');
  });

  it('retires a single subscription by id', async () => {
    const db = createFakeDb();
    const store = createStore(db);
    const subscription = await store.activateSubscription({ chatId: '99', ...routeInput });

    await store.markSubscriptionUnsubscribed(subscription.id);

    expect(await store.listActiveSubscriptions()).toHaveLength(0);
  });
});

describe('send reservations', () => {
  it('reserves a product day once per subscription', async () => {
    const db = createFakeDb();
    const store = createStore(db);
    const subscription = await store.activateSubscription({ chatId: '99', ...routeInput });

    const first = await store.reserveAlertSend({ subscriptionId: subscription.id, sentOn: '2026-08-01', matchingDates: ['2026-08-03'] });
    const second = await store.reserveAlertSend({ subscriptionId: subscription.id, sentOn: '2026-08-01', matchingDates: ['2026-08-03'] });
    const nextDay = await store.reserveAlertSend({ subscriptionId: subscription.id, sentOn: '2026-08-02', matchingDates: ['2026-08-03'] });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(nextDay).toBe(true);
    expect(db.state.subscriptions[0].last_alert_sent_on).toBe('2026-08-02');
  });

  it('records the final provider status on the reserved row', async () => {
    const db = createFakeDb();
    const store = createStore(db);
    const subscription = await store.activateSubscription({ chatId: '99', ...routeInput });
    await store.reserveAlertSend({ subscriptionId: subscription.id, sentOn: '2026-08-01', matchingDates: [] });

    await store.finalizeAlertSend({
      subscriptionId: subscription.id,
      sentOn: '2026-08-01',
      providerStatus: 'failed',
      errorSummary: 'Too Many Requests',
    });

    expect(db.state.sendLog[0]).toMatchObject({ provider_status: 'failed', error_summary: 'Too Many Requests' });
  });
});

describe('abuse controls', () => {
  it('allows a scope up to the limit and then blocks it', async () => {
    const store = createStore(createFakeDb());
    const attempt = () => store.reserveRateLimit({ action: 'link', scope: '1.2.3.4', limit: 2, windowSeconds: 3600 });

    expect(await attempt()).toMatchObject({ allowed: true, count: 1 });
    expect(await attempt()).toMatchObject({ allowed: true, count: 2 });
    expect(await attempt()).toMatchObject({ allowed: false, count: 3, retryAfterSeconds: 3600 });
  });

  it('counts scopes independently', async () => {
    const store = createStore(createFakeDb());
    await store.reserveRateLimit({ action: 'link', scope: 'a', limit: 1, windowSeconds: 60 });

    expect(await store.reserveRateLimit({ action: 'link', scope: 'b', limit: 1, windowSeconds: 60 })).toMatchObject({ allowed: true });
  });

  it('claims each Telegram update id only once', async () => {
    const store = createStore(createFakeDb());

    expect(await store.claimUpdate('500')).toBe(true);
    expect(await store.claimUpdate('500')).toBe(false);
    expect(await store.claimUpdate('501')).toBe(true);
  });

  it('prunes old rate-limit buckets and processed updates', async () => {
    const db = createFakeDb();
    const store = createStore(db);
    await store.reserveRateLimit({ action: 'link', scope: 'a', limit: 5, windowSeconds: 60 });
    await store.claimUpdate('500');

    expect(await store.deleteExpiredRateLimits('2026-09-01T00:00:00.000Z')).toBe(1);
    expect(await store.deleteProcessedUpdatesBefore('2026-09-01T00:00:00.000Z')).toBe(1);
    expect(db.state.rateLimits).toHaveLength(0);
    expect(db.state.processedUpdates).toHaveLength(0);
  });
});

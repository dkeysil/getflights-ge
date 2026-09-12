import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TelegramApiError } from './telegram-api.js';
import { evaluateTelegramAlerts } from './telegram-scheduler.js';
import { createFakeDb } from './telegram-store.fake.js';
import { createTelegramAlertStore } from './telegram-store.js';

const snapshot = {
  availability: {
    '7:4': { outbound: ['2026-08-03', '2026-08-11', '2026-09-04'], returns: [] },
    '7:5': { outbound: [], returns: [] },
  },
};

// 10:00 UTC is 14:00 in Tbilisi, so the product day is unambiguous.
const scheduledAt = new Date('2026-08-01T10:00:00.000Z');
const productDay = '2026-08-01';

function createEnv(overrides = {}) {
  return {
    ALERTS_DB: createFakeDb(),
    TELEGRAM_BOT_TOKEN: '1234567890:BOT-TOKEN',
    PUBLIC_APP_ORIGIN: 'https://getflights.ge',
    ...overrides,
  };
}

async function seedSubscription(env, overrides = {}) {
  const store = createTelegramAlertStore(env.ALERTS_DB, { now: () => scheduledAt });
  return store.activateSubscription({
    chatId: '555',
    fromId: '7',
    toId: '4',
    dateFrom: '2026-08-01',
    dateTo: '2026-08-31',
    locale: 'en',
    ...overrides,
  });
}

function run(env, options = {}) {
  return evaluateTelegramAlerts({
    env,
    snapshot,
    now: () => scheduledAt,
    appOrigin: 'https://getflights.ge',
    sendMessage: vi.fn(async () => ({ message_id: 1 })),
    ...options,
  });
}

let errorLog;

beforeEach(() => {
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorLog.mockRestore();
});

describe('evaluateTelegramAlerts', () => {
  it('sends one alert with the matching dates and a link that restores the search', async () => {
    const env = createEnv();
    await seedSubscription(env);
    const sendMessage = vi.fn(async () => ({ message_id: 1 }));

    await run(env, { sendMessage });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const [payload] = sendMessage.mock.calls[0];
    expect(payload.chatId).toBe('555');
    expect(payload.text).toContain('2026-08-03');
    expect(payload.text).toContain('2026-08-11');
    expect(payload.text).not.toContain('2026-09-04');
    expect(payload.text).toContain('https://getflights.ge/en/?from=7&amp;to=4&amp;dateFrom=2026-08-01&amp;dateTo=2026-08-31');
    expect(env.ALERTS_DB.state.sendLog).toMatchObject([{ sent_on: productDay, provider_status: 'sent' }]);
  });

  it('sends at most once per subscription per Tbilisi product day', async () => {
    const env = createEnv();
    await seedSubscription(env);
    const sendMessage = vi.fn(async () => ({ message_id: 1 }));

    await run(env, { sendMessage });
    await run(env, { sendMessage });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(env.ALERTS_DB.state.sendLog).toHaveLength(1);
  });

  it('sends again on the next product day', async () => {
    const env = createEnv();
    await seedSubscription(env);
    const sendMessage = vi.fn(async () => ({ message_id: 1 }));

    await run(env, { sendMessage });
    await run(env, { sendMessage, now: () => new Date('2026-08-02T10:00:00.000Z') });

    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('does not send when the watched range has no tickets', async () => {
    const env = createEnv();
    await seedSubscription(env, { toId: '5' });
    const sendMessage = vi.fn(async () => ({ message_id: 1 }));

    await run(env, { sendMessage });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(env.ALERTS_DB.state.sendLog).toHaveLength(0);
  });

  it('skips unsubscribed chats', async () => {
    const env = createEnv();
    await seedSubscription(env);
    await createTelegramAlertStore(env.ALERTS_DB, { now: () => scheduledAt }).unsubscribeChat('555');
    const sendMessage = vi.fn(async () => ({ message_id: 1 }));

    await run(env, { sendMessage });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('records a failed send and does not retry it in the same product day', async () => {
    const env = createEnv();
    await seedSubscription(env);
    const sendMessage = vi.fn(async () => {
      throw new TelegramApiError('Too Many Requests', { status: 429, errorCode: 429 });
    });

    await run(env, { sendMessage });
    await run(env, { sendMessage });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(env.ALERTS_DB.state.sendLog[0]).toMatchObject({ provider_status: 'failed', error_summary: 'Too Many Requests' });
    expect(env.ALERTS_DB.state.subscriptions[0].status).toBe('active');
  });

  it('retires a subscription whose chat blocked the bot', async () => {
    const env = createEnv();
    await seedSubscription(env);
    const sendMessage = vi.fn(async () => {
      throw new TelegramApiError('Forbidden: bot was blocked by the user', { status: 403, errorCode: 403 });
    });

    await run(env, { sendMessage });

    expect(env.ALERTS_DB.state.subscriptions[0].status).toBe('unsubscribed');
  });

  it('keeps going after one subscription fails', async () => {
    const env = createEnv();
    await seedSubscription(env, { chatId: '555' });
    await seedSubscription(env, { chatId: '666' });
    const sendMessage = vi.fn(async ({ chatId }) => {
      if (chatId === '555') throw new TelegramApiError('boom', { status: 500 });
      return { message_id: 1 };
    });

    await run(env, { sendMessage });

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(env.ALERTS_DB.state.sendLog).toHaveLength(2);
  });

  it('prunes expired link tokens, rate-limit buckets and processed updates', async () => {
    const env = createEnv();
    const store = createTelegramAlertStore(env.ALERTS_DB, { now: () => new Date('2026-07-01T10:00:00.000Z') });
    await store.createLinkToken({
      tokenHash: 'stale',
      fromId: '7',
      toId: '4',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      locale: 'en',
      expiresAt: '2026-07-01T10:15:00.000Z',
    });
    await store.reserveRateLimit({ action: 'telegram-link', scope: '1.2.3.4', limit: 10, windowSeconds: 3600 });
    await store.claimUpdate('1');

    await run(env);

    expect(env.ALERTS_DB.state.linkTokens).toHaveLength(0);
    expect(env.ALERTS_DB.state.rateLimits).toHaveLength(0);
    expect(env.ALERTS_DB.state.processedUpdates).toHaveLength(0);
  });

  it('fails closed and logs when the bot token is missing', async () => {
    const env = createEnv({ TELEGRAM_BOT_TOKEN: undefined });
    await seedSubscription(env);
    const sendMessage = vi.fn(async () => ({ message_id: 1 }));

    await run(env, { sendMessage });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalled();
    expect(errorLog.mock.calls[0][0]).toContain('telegram_alert_scheduler_unavailable');
  });

  it('fails closed and logs when the D1 binding is missing', async () => {
    await run(createEnv({ ALERTS_DB: undefined }));

    expect(errorLog.mock.calls[0][0]).toContain('telegram_alert_scheduler_unavailable');
  });

  it('never writes the bot token into a log line', async () => {
    const env = createEnv();
    await seedSubscription(env);
    const sendMessage = vi.fn(async () => {
      throw new TelegramApiError('boom', { status: 500 });
    });

    await run(env, { sendMessage });

    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('BOT-TOKEN');
  });
});

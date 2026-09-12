import { describe, expect, it, vi } from 'vitest';
import { hashAlertToken } from './alerts-domain.js';
import { handleTelegramRequest } from './telegram-handlers.js';
import { createFakeDb } from './telegram-store.fake.js';

const webhookSecret = 'webhook-secret-value';
const botToken = '1234567890:BOT-TOKEN';
const snapshot = {
  routeCatalog: [
    { from: { id: '7', name: 'Tbilisi (Natakhtari airport)' }, destinations: [{ id: '4', name: 'Batumi' }] },
  ],
  availability: {
    '7:4': { outbound: ['2026-08-03', '2026-08-11', '2026-09-04'], returns: [] },
  },
};

function createEnv(overrides = {}) {
  return {
    ALERTS_DB: createFakeDb(),
    TELEGRAM_BOT_TOKEN: botToken,
    TELEGRAM_WEBHOOK_SECRET: webhookSecret,
    TELEGRAM_BOT_USERNAME: 'get_flights_ge_bot',
    PUBLIC_APP_ORIGIN: 'https://getflights.ge',
    ...overrides,
  };
}

function createOptions(overrides = {}) {
  return {
    now: () => new Date('2026-08-01T10:00:00.000Z'),
    getAvailabilitySnapshot: async () => snapshot,
    sendMessage: vi.fn(async () => ({ message_id: 1 })),
    ...overrides,
  };
}

function linkRequest(body, headers = {}) {
  return new Request('https://cache.internal/api/alerts/telegram/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4', ...headers },
    body: JSON.stringify(body),
  });
}

function webhookRequest(update, headers = {}) {
  return new Request('https://cache.internal/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': webhookSecret,
      ...headers,
    },
    body: JSON.stringify(update),
  });
}

const validInput = { fromId: '7', toId: '4', dateFrom: '2026-08-01', dateTo: '2026-08-31', locale: 'en' };

function startUpdate(token, { updateId = 1, chatId = 555 } = {}) {
  return {
    update_id: updateId,
    message: { chat: { id: chatId, type: 'private' }, text: `/start ${token}` },
  };
}

async function createLink(env, options, input = validInput) {
  const response = await handleTelegramRequest(linkRequest(input), env, options);
  const body = await response.json();
  return { response, body, token: new URL(body.url).searchParams.get('start') };
}

describe('POST /api/alerts/telegram/link', () => {
  it('returns a single-use Telegram deep link for a valid route and range', async () => {
    const env = createEnv();
    const { response, body, token } = await createLink(env, createOptions());

    expect(response.status).toBe(200);
    expect(body.url.startsWith('https://t.me/get_flights_ge_bot?start=')).toBe(true);
    expect(body.expiresAt).toBe('2026-08-01T10:15:00.000Z');
    expect(body.matchingDates).toEqual(['2026-08-03', '2026-08-11']);
    expect(env.ALERTS_DB.state.linkTokens).toHaveLength(1);
    expect(env.ALERTS_DB.state.linkTokens[0].token_hash).toBe(await hashAlertToken(token));
    // The raw token is never persisted.
    expect(JSON.stringify(env.ALERTS_DB.state.linkTokens)).not.toContain(token);
  });

  it('rejects an invalid route, range or locale', async () => {
    const env = createEnv();
    const options = createOptions();

    for (const input of [
      { ...validInput, fromId: '4', toId: '4' },
      { ...validInput, dateFrom: '2026-09-01', dateTo: '2026-08-01' },
      { ...validInput, locale: 'de' },
      { ...validInput, dateFrom: 'not-a-date' },
      {},
    ]) {
      const response = await handleTelegramRequest(linkRequest(input), env, options);
      expect(response.status).toBe(400);
    }
  });

  it('rejects a route that is not in the availability snapshot', async () => {
    const response = await handleTelegramRequest(
      linkRequest({ ...validInput, fromId: '1', toId: '6' }),
      createEnv(),
      createOptions(),
    );

    expect(response.status).toBe(400);
  });

  it('rate limits link creation per client IP', async () => {
    const env = createEnv();
    const options = createOptions();

    let lastResponse;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      lastResponse = await handleTelegramRequest(linkRequest(validInput), env, options);
    }

    expect(lastResponse.status).toBe(429);
    expect(lastResponse.headers.get('Retry-After')).toBe('3600');
  });

  it('fails closed when Telegram alerts are not configured', async () => {
    const response = await handleTelegramRequest(
      linkRequest(validInput),
      createEnv({ TELEGRAM_BOT_TOKEN: undefined }),
      createOptions(),
    );

    expect(response.status).toBe(503);
  });
});

describe('POST /api/telegram/webhook', () => {
  it('rejects an update without the shared secret header', async () => {
    const env = createEnv();
    const options = createOptions();
    const { token } = await createLink(env, options);

    const missing = await handleTelegramRequest(
      new Request('https://cache.internal/api/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(startUpdate(token)),
      }),
      env,
      options,
    );
    const wrong = await handleTelegramRequest(
      webhookRequest(startUpdate(token), { 'X-Telegram-Bot-Api-Secret-Token': 'nope' }),
      env,
      options,
    );

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(options.sendMessage).not.toHaveBeenCalled();
    expect(env.ALERTS_DB.state.subscriptions).toHaveLength(0);
  });

  it('binds the chat and confirms when /start carries a valid token', async () => {
    const env = createEnv();
    const options = createOptions();
    const { token } = await createLink(env, options);

    const response = await handleTelegramRequest(webhookRequest(startUpdate(token)), env, options);

    expect(response.status).toBe(200);
    expect(env.ALERTS_DB.state.subscriptions).toMatchObject([
      { chat_id: '555', from_id: '7', to_id: '4', date_from: '2026-08-01', date_to: '2026-08-31', locale: 'en', status: 'active' },
    ]);
    const [sent] = options.sendMessage.mock.calls[0];
    expect(sent.chatId).toBe('555');
    expect(sent.text).toContain('getflights.ge/en/?from=7');
  });

  it('refuses to bind a chat when the token was already used', async () => {
    const env = createEnv();
    const options = createOptions();
    const { token } = await createLink(env, options);
    await handleTelegramRequest(webhookRequest(startUpdate(token, { updateId: 1 })), env, options);

    const replay = await handleTelegramRequest(
      webhookRequest(startUpdate(token, { updateId: 2, chatId: 666 })),
      env,
      options,
    );

    expect(replay.status).toBe(200);
    expect(env.ALERTS_DB.state.subscriptions).toHaveLength(1);
    expect(options.sendMessage.mock.calls[1][0].text).toContain('getflights.ge');
  });

  it('refuses to bind a chat when the token expired', async () => {
    const env = createEnv();
    const { token } = await createLink(env, createOptions());
    const later = createOptions({ now: () => new Date('2026-08-01T10:30:00.000Z') });

    await handleTelegramRequest(webhookRequest(startUpdate(token)), env, later);

    expect(env.ALERTS_DB.state.subscriptions).toHaveLength(0);
  });

  it('never binds a chat from a /start without a token', async () => {
    const env = createEnv();
    const options = createOptions();

    await handleTelegramRequest(
      webhookRequest({ update_id: 9, message: { chat: { id: 555, type: 'private' }, text: '/start' } }),
      env,
      options,
    );

    expect(env.ALERTS_DB.state.subscriptions).toHaveLength(0);
    expect(options.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('processes each update id only once', async () => {
    const env = createEnv();
    const options = createOptions();
    const { token } = await createLink(env, options);
    const update = startUpdate(token, { updateId: 77 });

    await handleTelegramRequest(webhookRequest(update), env, options);
    await handleTelegramRequest(webhookRequest(update), env, options);

    expect(options.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes the chat on /stop', async () => {
    const env = createEnv();
    const options = createOptions();
    const { token } = await createLink(env, options);
    await handleTelegramRequest(webhookRequest(startUpdate(token)), env, options);

    const response = await handleTelegramRequest(
      webhookRequest({ update_id: 2, message: { chat: { id: 555, type: 'private' }, text: '/stop' } }),
      env,
      options,
    );

    expect(response.status).toBe(200);
    expect(env.ALERTS_DB.state.subscriptions[0].status).toBe('unsubscribed');
    expect(options.sendMessage.mock.calls[1][0].text).toContain('1');
  });

  it('lists the active subscriptions of the requesting chat only', async () => {
    const env = createEnv();
    const options = createOptions();
    const { token } = await createLink(env, options);
    await handleTelegramRequest(webhookRequest(startUpdate(token)), env, options);

    await handleTelegramRequest(
      webhookRequest({ update_id: 3, message: { chat: { id: 999, type: 'private' }, text: '/list' } }),
      env,
      options,
    );

    const text = options.sendMessage.mock.calls[1][0].text;
    expect(text).not.toContain('2026-08-31');
  });

  it('ignores updates that are not private text commands', async () => {
    const env = createEnv();
    const options = createOptions();

    for (const update of [
      { update_id: 11, message: { chat: { id: 1, type: 'group' }, text: '/stop' } },
      { update_id: 12, channel_post: { chat: { id: 1, type: 'channel' }, text: '/stop' } },
      { update_id: 13, message: { chat: { id: 1, type: 'private' }, text: 'just chatting' } },
      { update_id: 14, edited_message: { chat: { id: 1, type: 'private' }, text: '/stop' } },
      { update_id: 15, callback_query: { data: '/stop' } },
    ]) {
      const response = await handleTelegramRequest(webhookRequest(update), env, options);
      expect(response.status).toBe(200);
    }

    expect(options.sendMessage).not.toHaveBeenCalled();
  });

  it('rate limits a chat that floods the webhook', async () => {
    const env = createEnv();
    const options = createOptions();

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await handleTelegramRequest(
        webhookRequest({ update_id: 100 + attempt, message: { chat: { id: 777, type: 'private' }, text: '/help' } }),
        env,
        options,
      );
      expect(response.status).toBe(200);
    }

    expect(options.sendMessage.mock.calls.length).toBeLessThanOrEqual(20);
  });

  it('still answers Telegram with 200 when replying fails, so it does not retry forever', async () => {
    const env = createEnv();
    const options = createOptions({
      sendMessage: vi.fn(async () => {
        throw new Error('telegram down');
      }),
    });
    const { token } = await createLink(env, options);

    const response = await handleTelegramRequest(webhookRequest(startUpdate(token)), env, options);

    expect(response.status).toBe(200);
  });

  it('ignores a malformed webhook body', async () => {
    const response = await handleTelegramRequest(
      new Request('https://cache.internal/api/telegram/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': webhookSecret },
        body: 'not json',
      }),
      createEnv(),
      createOptions(),
    );

    expect(response.status).toBe(200);
  });
});

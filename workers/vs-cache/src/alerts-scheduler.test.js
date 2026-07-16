import { describe, expect, it, vi } from 'vitest';
import { alertProductDay, hashAlertToken } from './alerts-domain.js';
import { evaluateTicketAlerts } from './alerts-scheduler.js';

function createSchedulerDb(initialSubscriptions = [], options = {}) {
  const state = {
    subscriptions: initialSubscriptions.map((subscription) => ({ ...subscription })),
    alertSendLog: [],
    subscriptionTokens: [],
    alertRequestLimits: [],
    finalizeFailedOnce: false,
  };

  function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : null;
  }

  function dispatch(sql, params) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalized.startsWith('select id, email, from_id, to_id, date_from, date_to, locale, status, confirmed_at, unsubscribed_at, last_alert_sent_on, created_at, updated_at from subscriptions where status = ?')) {
      return state.subscriptions
        .filter((row) => row.status === params[0])
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        .map(clone);
    }

    if (normalized.startsWith('insert or ignore into alert_send_log')) {
      const [id, subscriptionId, sentOn, matchingDatesJson, providerStatus, errorSummary, createdAt] = params;
      const existing = state.alertSendLog.find(
        (row) => row.subscription_id === subscriptionId && row.sent_on === sentOn,
      );
      if (existing) return { changes: 0 };
      state.alertSendLog.push({
        id,
        subscription_id: subscriptionId,
        sent_on: sentOn,
        matching_dates_json: matchingDatesJson,
        provider_status: providerStatus,
        error_summary: errorSummary ?? null,
        created_at: createdAt,
      });
      return { changes: 1 };
    }

    if (normalized.startsWith('update alert_send_log set provider_status = ?, error_summary = ? where subscription_id = ? and sent_on = ?')) {
      if (options.failFinalizeOnce && !state.finalizeFailedOnce) {
        state.finalizeFailedOnce = true;
        throw new Error('finalize failed');
      }
      const [providerStatus, errorSummary, subscriptionId, sentOn] = params;
      const row = state.alertSendLog.find(
        (entry) => entry.subscription_id === subscriptionId && entry.sent_on === sentOn,
      );
      if (!row) return { changes: 0 };
      row.provider_status = providerStatus;
      row.error_summary = errorSummary;
      return { changes: 1 };
    }

    if (normalized.startsWith('insert into subscription_tokens')) {
      const [tokenHash, subscriptionId, email, purpose, expiresAt, consumedAt, createdAt] = params;
      state.subscriptionTokens.push({
        token_hash: tokenHash,
        subscription_id: subscriptionId,
        email,
        purpose,
        expires_at: expiresAt,
        consumed_at: consumedAt,
        created_at: createdAt,
      });
      return { changes: 1 };
    }

    if (normalized.startsWith('update subscriptions set last_alert_sent_on = ?, updated_at = ?')) {
      const [lastAlertSentOn, updatedAt, id] = params;
      const row = state.subscriptions.find((entry) => entry.id === id);
      if (!row) return { changes: 0 };
      row.last_alert_sent_on = lastAlertSentOn;
      row.updated_at = updatedAt;
      return { changes: 1 };
    }

    if (normalized.startsWith('delete from subscriptions where status = ? and created_at < ? returning id')) {
      const [status, cutoffIso] = params;
      const expired = state.subscriptions
        .filter((row) => row.status === status && row.created_at < cutoffIso)
        .map((row) => ({ id: row.id }));
      const expiredIds = new Set(expired.map((row) => row.id));
      state.subscriptions = state.subscriptions.filter((row) => !expiredIds.has(row.id));
      return expired;
    }

    if (normalized.startsWith('delete from subscription_tokens where subscription_id = ?')) {
      const [subscriptionId] = params;
      const before = state.subscriptionTokens.length;
      state.subscriptionTokens = state.subscriptionTokens.filter((row) => row.subscription_id !== subscriptionId);
      return { changes: before - state.subscriptionTokens.length };
    }

    if (normalized.startsWith('delete from alert_request_limits where bucket_start < ?')) {
      const [cutoffIso] = params;
      const before = state.alertRequestLimits.length;
      state.alertRequestLimits = state.alertRequestLimits.filter((row) => row.bucket_start >= cutoffIso);
      return { changes: before - state.alertRequestLimits.length };
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
              return { results: Array.isArray(results) ? results : [] };
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

function createSnapshot() {
  return {
    availability: {
      '7:4': {
        outbound: ['2026-08-01', '2026-08-15', '2026-09-01'],
      },
    },
  };
}

function createEnv({ subscriptions, emailSend, failFinalizeOnce } = {}) {
  const db = createSchedulerDb(subscriptions, { failFinalizeOnce });
  return {
    ALERTS_DB: db,
    EMAIL: { send: emailSend ?? vi.fn(async () => {}) },
    db,
  };
}

function createActiveSubscription(overrides = {}) {
  return {
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
    ...overrides,
  };
}

describe('evaluateTicketAlerts', () => {
  it('sends a matching alert and records last_alert_sent_on for the Asia/Tbilisi product day', async () => {
    const emailSend = vi.fn(async () => {});
    const env = createEnv({
      subscriptions: [createActiveSubscription()],
      emailSend,
    });

    await evaluateTicketAlerts({
      env,
      snapshot: createSnapshot(),
      now: () => new Date('2026-07-01T20:30:00.000Z'),
      appOrigin: 'https://getflights.ge',
    });

    expect(emailSend).toHaveBeenCalledTimes(1);
    const payload = emailSend.mock.calls[0][0];
    expect(payload).toMatchObject({
      to: 'user@example.com',
      subject: 'Ticket alert for Tbilisi (Natakhtari airport) -> Batumi',
    });
    expect(payload.text).toContain(
      'https://getflights.ge/en/?from=7&to=4&dateFrom=2026-08-01&dateTo=2026-08-31',
    );
    const manageLinkMatch = payload.text.match(/Manage link: (https:\/\/[^\n]+)/);
    expect(manageLinkMatch).not.toBeNull();
    const manageUrl = new URL(manageLinkMatch[1]);
    const manageToken = manageUrl.searchParams.get('token');
    expect(manageToken).toMatch(/^[a-f0-9]{48}$/);
    expect(manageUrl.toString()).toBe(`https://getflights.ge/en/alerts/manage?token=${manageToken}`);
    expect(await hashAlertToken(manageToken)).toBe(env.db.state.subscriptionTokens[0].token_hash);
    expect(env.db.state.subscriptionTokens).toEqual([
      expect.objectContaining({
        subscription_id: null,
        email: 'user@example.com',
        purpose: 'manage',
        expires_at: '2026-07-02T20:30:00.000Z',
      }),
    ]);
    expect(env.db.state.subscriptions[0].last_alert_sent_on).toBe('2026-07-02');
    expect(env.db.state.alertSendLog).toHaveLength(1);
    expect(env.db.state.alertSendLog[0]).toMatchObject({
      subscription_id: 'sub-1',
      sent_on: '2026-07-02',
      provider_status: 'sent',
    });
  });

  it('skips a subscription already sent on the current Asia/Tbilisi day', async () => {
    const emailSend = vi.fn(async () => {});
    const currentProductDay = alertProductDay(new Date('2026-07-01T20:30:00.000Z'));
    const env = createEnv({
      subscriptions: [createActiveSubscription({ last_alert_sent_on: currentProductDay })],
      emailSend,
    });

    await evaluateTicketAlerts({
      env,
      snapshot: createSnapshot(),
      now: () => new Date('2026-07-01T20:30:00.000Z'),
      appOrigin: 'https://getflights.ge',
    });

    expect(emailSend).not.toHaveBeenCalled();
    expect(env.db.state.alertSendLog).toHaveLength(0);
    expect(env.db.state.subscriptions[0].last_alert_sent_on).toBe(currentProductDay);
  });

  it('skips subscriptions with no matching dates without deactivating them', async () => {
    const emailSend = vi.fn(async () => {});
    const env = createEnv({
      subscriptions: [
        createActiveSubscription({
          date_from: '2026-10-01',
          date_to: '2026-10-31',
        }),
      ],
      emailSend,
    });

    await evaluateTicketAlerts({
      env,
      snapshot: createSnapshot(),
      now: () => new Date('2026-07-01T20:30:00.000Z'),
      appOrigin: 'https://getflights.ge',
    });

    expect(emailSend).not.toHaveBeenCalled();
    expect(env.db.state.alertSendLog).toHaveLength(0);
    expect(env.db.state.subscriptions[0].status).toBe('active');
    expect(env.db.state.subscriptions[0].last_alert_sent_on).toBeNull();
  });

  it('deletes expired pending subscriptions before evaluating active alerts', async () => {
    const emailSend = vi.fn(async () => {});
    const env = createEnv({
      subscriptions: [
        createActiveSubscription(),
        createActiveSubscription({
          id: 'pending-old',
          email: 'old@example.com',
          status: 'pending',
          confirmed_at: null,
          created_at: '2026-06-24T12:00:00.000Z',
          updated_at: '2026-06-24T12:00:00.000Z',
        }),
        createActiveSubscription({
          id: 'pending-new',
          email: 'new@example.com',
          status: 'pending',
          confirmed_at: null,
          created_at: '2026-06-30T12:00:00.000Z',
          updated_at: '2026-06-30T12:00:00.000Z',
        }),
      ],
      emailSend,
    });
    env.db.state.subscriptionTokens.push(
      {
        token_hash: 'old-token',
        subscription_id: 'pending-old',
        email: 'old@example.com',
        purpose: 'confirm',
        expires_at: '2026-06-25T12:00:00.000Z',
        consumed_at: null,
        created_at: '2026-06-24T12:00:00.000Z',
      },
      {
        token_hash: 'new-token',
        subscription_id: 'pending-new',
        email: 'new@example.com',
        purpose: 'confirm',
        expires_at: '2026-07-07T12:00:00.000Z',
        consumed_at: null,
        created_at: '2026-06-30T12:00:00.000Z',
      },
    );

    await evaluateTicketAlerts({
      env,
      snapshot: createSnapshot(),
      now: () => new Date('2026-07-02T12:00:00.000Z'),
      appOrigin: 'https://getflights.ge',
    });

    expect(env.db.state.subscriptions.map((row) => row.id)).toEqual(['sub-1', 'pending-new']);
    expect(env.db.state.subscriptionTokens.map((row) => row.subscription_id)).toEqual(['pending-new', null]);
    expect(emailSend).toHaveBeenCalledTimes(1);
  });

  it('deletes expired rate-limit buckets before evaluating active alerts', async () => {
    const emailSend = vi.fn(async () => {});
    const env = createEnv({
      subscriptions: [createActiveSubscription()],
      emailSend,
    });
    env.db.state.alertRequestLimits.push(
      {
        id: 'old-limit',
        scope: 'user@example.com|203.0.113.5',
        action: 'subscribe',
        bucket_start: '2026-06-24T12:00:00.000Z',
        count: 3,
        updated_at: '2026-06-24T12:34:56.000Z',
      },
      {
        id: 'fresh-limit',
        scope: 'user@example.com|203.0.113.5',
        action: 'subscribe',
        bucket_start: '2026-06-30T12:00:00.000Z',
        count: 1,
        updated_at: '2026-06-30T12:34:56.000Z',
      },
    );

    await evaluateTicketAlerts({
      env,
      snapshot: createSnapshot(),
      now: () => new Date('2026-07-02T12:00:00.000Z'),
      appOrigin: 'https://getflights.ge',
    });

    expect(env.db.state.alertRequestLimits.map((row) => row.id)).toEqual(['fresh-limit']);
    expect(emailSend).toHaveBeenCalledTimes(1);
  });

  it('logs one provider failure and does not retry that subscription in the same run', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const emailSend = vi
      .fn(async () => {
        throw new Error('smtp unavailable');
      });
    const env = createEnv({
      subscriptions: [createActiveSubscription()],
      emailSend,
    });

    await evaluateTicketAlerts({
      env,
      snapshot: createSnapshot(),
      now: () => new Date('2026-07-01T20:30:00.000Z'),
      appOrigin: 'https://getflights.ge',
    });

    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(env.db.state.alertSendLog).toHaveLength(1);
    expect(env.db.state.subscriptionTokens).toHaveLength(1);
    expect(env.db.state.alertSendLog[0]).toMatchObject({
      subscription_id: 'sub-1',
      provider_status: 'failed',
      error_summary: 'smtp unavailable',
    });
    expect(env.db.state.subscriptions[0].last_alert_sent_on).toBe('2026-07-02');
    consoleError.mockRestore();
  });

  it('does not resend when finalization fails after the email is delivered', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const emailSend = vi.fn(async () => {});
    const env = createEnv({
      subscriptions: [createActiveSubscription()],
      emailSend,
      failFinalizeOnce: true,
    });

    await evaluateTicketAlerts({
      env,
      snapshot: createSnapshot(),
      now: () => new Date('2026-07-01T20:30:00.000Z'),
      appOrigin: 'https://getflights.ge',
    });
    await evaluateTicketAlerts({
      env,
      snapshot: createSnapshot(),
      now: () => new Date('2026-07-01T20:30:00.000Z'),
      appOrigin: 'https://getflights.ge',
    });

    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(env.db.state.alertSendLog).toHaveLength(1);
    expect(env.db.state.alertSendLog[0]).toMatchObject({
      subscription_id: 'sub-1',
      sent_on: '2026-07-02',
    });
    expect(env.db.state.subscriptions[0].last_alert_sent_on).toBe('2026-07-02');
    consoleError.mockRestore();
  });

  it('logs and exits when D1 is unavailable', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      evaluateTicketAlerts({
        env: { ALERTS_DB: null, EMAIL: { send: vi.fn() } },
        snapshot: createSnapshot(),
        now: () => new Date('2026-07-01T20:30:00.000Z'),
        appOrigin: 'https://getflights.ge',
      }),
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('does not reserve or create alert rows when the email provider is missing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = createSchedulerDb([createActiveSubscription()]);

    await expect(
      evaluateTicketAlerts({
        env: { ALERTS_DB: db },
        snapshot: createSnapshot(),
        now: () => new Date('2026-07-01T20:30:00.000Z'),
        appOrigin: 'https://getflights.ge',
      }),
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(db.state.subscriptionTokens).toHaveLength(0);
    expect(db.state.alertSendLog).toHaveLength(0);
    expect(db.state.subscriptions[0].last_alert_sent_on).toBeNull();
    consoleError.mockRestore();
  });
});

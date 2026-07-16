const subscriptionColumns = [
  'id',
  'email',
  'from_id',
  'to_id',
  'date_from',
  'date_to',
  'locale',
  'status',
  'confirmed_at',
  'unsubscribed_at',
  'last_alert_sent_on',
  'created_at',
  'updated_at',
].join(', ');

const tokenColumns = ['token_hash', 'subscription_id', 'email', 'purpose', 'expires_at', 'consumed_at', 'created_at'].join(', ');

export class AlertStoreUnavailableError extends Error {
  constructor(message = 'Alert store is unavailable.') {
    super(message);
    this.name = 'AlertStoreUnavailableError';
  }
}

export function assertAlertDb(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new AlertStoreUnavailableError();
  }
}

export function createAlertStore(db, options = {}) {
  assertAlertDb(db);

  const now = options.now ?? (() => new Date());
  const randomUUID = options.randomUUID ?? (() => globalThis.crypto?.randomUUID?.() ?? `alert-${Date.now()}`);

  return {
    async upsertSubscription(input) {
      const normalizedEmail = normalizeEmail(input.email);
      const nowIso = toIso(now());
      return insertReturningSubscription(db, [
        randomUUID(),
        normalizedEmail,
        input.fromId,
        input.toId,
        input.dateFrom,
        input.dateTo,
        input.locale,
        'pending',
        null,
        null,
        null,
        nowIso,
        nowIso,
      ]);
    },

    async createToken({ subscriptionId, email, purpose, tokenHash, expiresAt }) {
      const nowIso = toIso(now());
      await run(
        db,
        `INSERT INTO subscription_tokens
         (token_hash, subscription_id, email, purpose, expires_at, consumed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tokenHash, subscriptionId ?? null, normalizeEmail(email), purpose, expiresAt, null, nowIso],
      );
    },

    async confirmSubscriptionByToken(tokenHash) {
      const token = await selectOne(
        db,
        `SELECT ${tokenColumns}
         FROM subscription_tokens
         WHERE token_hash = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > ?
         LIMIT 1`,
        [tokenHash, 'confirm', toIso(now())],
      );
      if (!token || !token.subscription_id) return null;

      const nowIso = toIso(now());
      await run(db, 'UPDATE subscription_tokens SET consumed_at = ? WHERE token_hash = ?', [nowIso, tokenHash]);
      await run(
        db,
        `UPDATE subscriptions
         SET status = ?, confirmed_at = ?, updated_at = ?
         WHERE id = ?`,
        ['active', nowIso, nowIso, token.subscription_id],
      );
      return selectById(db, token.subscription_id);
    },

    async consumeManageToken(tokenHash) {
      const token = await selectOne(
        db,
        `SELECT ${tokenColumns}
         FROM subscription_tokens
         WHERE token_hash = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > ?
         LIMIT 1`,
        [tokenHash, 'manage', toIso(now())],
      );
      if (!token) return [];

      await run(db, 'UPDATE subscription_tokens SET consumed_at = ? WHERE token_hash = ?', [toIso(now()), tokenHash]);
      return listByEmail(db, token.email);
    },

    async listSubscriptionsForEmail(email) {
      return listByEmail(db, email);
    },

    async unsubscribeSubscription({ id, email }) {
      const nowIso = toIso(now());
      const result = await run(
        db,
        `UPDATE subscriptions
         SET status = ?, unsubscribed_at = ?, updated_at = ?
         WHERE id = ? AND email = ?`,
        ['unsubscribed', nowIso, nowIso, id, normalizeEmail(email)],
      );
      if (!result || result.changes === 0) return null;
      return selectById(db, id);
    },

    async listActiveSubscriptions() {
      return listByStatus(db, 'active');
    },

    async recordAlertSend({ subscriptionId, sentOn, matchingDates, providerStatus, errorSummary }) {
      await this.reserveAlertSend({ subscriptionId, sentOn, matchingDates });
      await this.finalizeAlertSend({ subscriptionId, sentOn, providerStatus, errorSummary });
    },

    async reserveAlertSend({ subscriptionId, sentOn, matchingDates }) {
      const nowIso = toIso(now());
      const insertResult = await run(
        db,
        `INSERT OR IGNORE INTO alert_send_log
         (id, subscription_id, sent_on, matching_dates_json, provider_status, error_summary, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), subscriptionId, sentOn, JSON.stringify(matchingDates), 'reserved', null, nowIso],
      );
      if (!insertResult || insertResult.changes === 0) return false;

      await run(
        db,
        `UPDATE subscriptions
         SET last_alert_sent_on = ?, updated_at = ?
         WHERE id = ?`,
        [sentOn, nowIso, subscriptionId],
      );
      return true;
    },

    async finalizeAlertSend({ subscriptionId, sentOn, providerStatus, errorSummary }) {
      await run(
        db,
        `UPDATE alert_send_log
         SET provider_status = ?, error_summary = ?
         WHERE subscription_id = ? AND sent_on = ?`,
        [providerStatus, errorSummary ?? null, subscriptionId, sentOn],
      );
    },

    async reserveRateLimit({ action, email, ip, limit, windowSeconds }) {
      const nowDate = toDate(now());
      const normalizedWindowSeconds = Math.max(1, Number(windowSeconds) || 1);
      const bucketMs = normalizedWindowSeconds * 1000;
      const bucketStartMs = Math.floor(nowDate.getTime() / bucketMs) * bucketMs;
      const bucketStart = new Date(bucketStartMs).toISOString();
      const nowIso = nowDate.toISOString();
      const scope = `${normalizeEmail(email)}|${normalizeRateLimitPart(ip)}`;
      const row = await selectOne(
        db,
        `INSERT INTO alert_request_limits
         (id, scope, action, bucket_start, count, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(scope, action, bucket_start)
         DO UPDATE SET count = count + 1, updated_at = excluded.updated_at
         RETURNING count`,
        [randomUUID(), scope, action, bucketStart, 1, nowIso],
      );
      const count = Number(row?.count ?? 0);
      return {
        allowed: count <= limit,
        count,
        retryAfterSeconds: normalizedWindowSeconds,
      };
    },

    async deleteExpiredPending(cutoffIso) {
      const expired = await selectAll(
        db,
        `DELETE FROM subscriptions
         WHERE status = ? AND created_at < ?
         RETURNING id`,
        ['pending', cutoffIso],
      );
      for (const { id } of expired) {
        await run(db, 'DELETE FROM subscription_tokens WHERE subscription_id = ?', [id]);
      }
      return expired.length;
    },

    async deleteExpiredRateLimits(cutoffIso) {
      const result = await run(db, 'DELETE FROM alert_request_limits WHERE bucket_start < ?', [cutoffIso]);
      return result?.changes ?? 0;
    },
  };
}

async function selectById(db, id) {
  return selectOne(
    db,
    `SELECT ${subscriptionColumns}
     FROM subscriptions
     WHERE id = ?
     LIMIT 1`,
    [id],
  );
}

async function listByEmail(db, email) {
  return selectAll(
    db,
    `SELECT ${subscriptionColumns}
     FROM subscriptions
     WHERE email = ?
     ORDER BY created_at ASC`,
    [normalizeEmail(email)],
  );
}

async function listByStatus(db, status) {
  return selectAll(
    db,
    `SELECT ${subscriptionColumns}
     FROM subscriptions
     WHERE status = ?
     ORDER BY created_at ASC`,
    [status],
  );
}

async function selectOne(db, sql, params) {
  return db.prepare(sql).bind(...params).first();
}

async function selectAll(db, sql, params) {
  const result = await db.prepare(sql).bind(...params).all();
  return result?.results ?? [];
}

async function run(db, sql, params) {
  return db.prepare(sql).bind(...params).run();
}

async function insertReturningSubscription(db, params) {
  return selectOne(
    db,
    `INSERT INTO subscriptions
     (id, email, from_id, to_id, date_from, date_to, locale, status, confirmed_at, unsubscribed_at, last_alert_sent_on, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(email, from_id, to_id, date_from, date_to)
     DO UPDATE SET
       locale = excluded.locale,
       status = CASE WHEN subscriptions.status = 'active' THEN 'active' ELSE 'pending' END,
       confirmed_at = CASE WHEN subscriptions.status = 'active' THEN subscriptions.confirmed_at ELSE NULL END,
       unsubscribed_at = CASE WHEN subscriptions.status = 'active' THEN subscriptions.unsubscribed_at ELSE NULL END,
       updated_at = excluded.updated_at
     RETURNING ${subscriptionColumns}`,
    params,
  );
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function normalizeRateLimitPart(value) {
  const text = String(value ?? '').trim();
  return text || 'unknown';
}

function toIso(value) {
  return toDate(value).toISOString();
}

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

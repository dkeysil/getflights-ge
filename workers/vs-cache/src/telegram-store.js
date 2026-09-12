const subscriptionColumns = [
  'id',
  'chat_id',
  'from_id',
  'to_id',
  'date_from',
  'date_to',
  'locale',
  'status',
  'last_alert_sent_on',
  'created_at',
  'updated_at',
].join(', ');

const linkTokenColumns = ['token_hash', 'from_id', 'to_id', 'date_from', 'date_to', 'locale', 'expires_at', 'consumed_at', 'created_at'].join(', ');

export class TelegramAlertStoreUnavailableError extends Error {
  constructor(message = 'Telegram alert store is unavailable.') {
    super(message);
    this.name = 'TelegramAlertStoreUnavailableError';
  }
}

export function createTelegramAlertStore(db, options = {}) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TelegramAlertStoreUnavailableError();
  }

  const now = options.now ?? (() => new Date());
  const randomUUID = options.randomUUID ?? (() => globalThis.crypto?.randomUUID?.() ?? `telegram-${Date.now()}`);
  const nowIso = () => toIso(now());

  return {
    async createLinkToken({ tokenHash, fromId, toId, dateFrom, dateTo, locale, expiresAt }) {
      await run(
        db,
        `INSERT INTO telegram_link_tokens
         (token_hash, from_id, to_id, date_from, date_to, locale, expires_at, consumed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [tokenHash, fromId, toId, dateFrom, dateTo, locale, expiresAt, nowIso()],
      );
    },

    // Single-use is enforced by the UPDATE itself, so two concurrent /start
    // deliveries can never both bind a chat with the same token.
    async consumeLinkToken(tokenHash) {
      const current = nowIso();
      return selectOne(
        db,
        `UPDATE telegram_link_tokens
         SET consumed_at = ?
         WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?
         RETURNING ${linkTokenColumns}`,
        [current, tokenHash, current],
      );
    },

    async deleteExpiredLinkTokens(cutoffIso) {
      const result = await run(db, 'DELETE FROM telegram_link_tokens WHERE expires_at < ?', [cutoffIso ?? nowIso()]);
      return result?.changes ?? 0;
    },

    async activateSubscription({ chatId, fromId, toId, dateFrom, dateTo, locale }) {
      const current = nowIso();
      return selectOne(
        db,
        `INSERT INTO telegram_subscriptions
         (id, chat_id, from_id, to_id, date_from, date_to, locale, status, last_alert_sent_on, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(chat_id, from_id, to_id, date_from, date_to)
         DO UPDATE SET
           locale = excluded.locale,
           status = 'active',
           updated_at = excluded.updated_at
         RETURNING ${subscriptionColumns}`,
        [randomUUID(), chatId, fromId, toId, dateFrom, dateTo, locale, 'active', null, current, current],
      );
    },

    async listActiveSubscriptionsForChat(chatId) {
      return selectAll(
        db,
        `SELECT ${subscriptionColumns}
         FROM telegram_subscriptions
         WHERE chat_id = ? AND status = ?
         ORDER BY created_at ASC`,
        [chatId, 'active'],
      );
    },

    async listActiveSubscriptions() {
      return selectAll(
        db,
        `SELECT ${subscriptionColumns}
         FROM telegram_subscriptions
         WHERE status = ?
         ORDER BY created_at ASC`,
        ['active'],
      );
    },

    async unsubscribeChat(chatId) {
      const result = await run(
        db,
        `UPDATE telegram_subscriptions
         SET status = ?, updated_at = ?
         WHERE chat_id = ? AND status = 'active'`,
        ['unsubscribed', nowIso(), chatId],
      );
      return result?.changes ?? 0;
    },

    async markSubscriptionUnsubscribed(id) {
      const result = await run(
        db,
        `UPDATE telegram_subscriptions
         SET status = ?, updated_at = ?
         WHERE id = ?`,
        ['unsubscribed', nowIso(), id],
      );
      return result?.changes ?? 0;
    },

    // The unique (subscription_id, sent_on) index is the real once-per-day
    // guarantee; last_alert_sent_on only makes the common case a cheap skip.
    async reserveAlertSend({ subscriptionId, sentOn, matchingDates }) {
      const current = nowIso();
      const insertResult = await run(
        db,
        `INSERT OR IGNORE INTO telegram_alert_send_log
         (id, subscription_id, sent_on, matching_dates_json, provider_status, error_summary, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), subscriptionId, sentOn, JSON.stringify(matchingDates ?? []), 'reserved', null, current],
      );
      if (!insertResult || insertResult.changes === 0) return false;

      await run(
        db,
        `UPDATE telegram_subscriptions
         SET last_alert_sent_on = ?, updated_at = ?
         WHERE id = ?`,
        [sentOn, current, subscriptionId],
      );
      return true;
    },

    async finalizeAlertSend({ subscriptionId, sentOn, providerStatus, errorSummary }) {
      await run(
        db,
        `UPDATE telegram_alert_send_log
         SET provider_status = ?, error_summary = ?
         WHERE subscription_id = ? AND sent_on = ?`,
        [providerStatus, errorSummary ?? null, subscriptionId, sentOn],
      );
    },

    async reserveRateLimit({ action, scope, limit, windowSeconds }) {
      const current = toDate(now());
      const normalizedWindowSeconds = Math.max(1, Number(windowSeconds) || 1);
      const bucketMs = normalizedWindowSeconds * 1000;
      const bucketStart = new Date(Math.floor(current.getTime() / bucketMs) * bucketMs).toISOString();
      const row = await selectOne(
        db,
        `INSERT INTO telegram_rate_limits
         (id, scope, action, bucket_start, count, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(scope, action, bucket_start)
         DO UPDATE SET count = count + 1, updated_at = excluded.updated_at
         RETURNING count`,
        [randomUUID(), normalizeScope(scope), action, bucketStart, 1, current.toISOString()],
      );
      const count = Number(row?.count ?? 0);
      return {
        allowed: count <= limit,
        count,
        retryAfterSeconds: normalizedWindowSeconds,
      };
    },

    async deleteExpiredRateLimits(cutoffIso) {
      const result = await run(db, 'DELETE FROM telegram_rate_limits WHERE bucket_start < ?', [cutoffIso]);
      return result?.changes ?? 0;
    },

    // Telegram redelivers an update until it gets a 2xx, so a claimed id is
    // never acted on twice.
    async claimUpdate(updateId) {
      const result = await run(
        db,
        'INSERT OR IGNORE INTO telegram_processed_updates (update_id, created_at) VALUES (?, ?)',
        [String(updateId), nowIso()],
      );
      return Boolean(result && result.changes > 0);
    },

    async deleteProcessedUpdatesBefore(cutoffIso) {
      const result = await run(db, 'DELETE FROM telegram_processed_updates WHERE created_at < ?', [cutoffIso]);
      return result?.changes ?? 0;
    },
  };
}

function normalizeScope(value) {
  const text = String(value ?? '').trim();
  return text || 'unknown';
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

function toIso(value) {
  return toDate(value).toISOString();
}

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

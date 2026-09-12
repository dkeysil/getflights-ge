// Minimal in-memory D1 double shared by the Telegram worker tests. It
// dispatches on the table + verb of each statement so the tests pin the
// store's SQL contract, not its exact spelling.
export function createFakeDb() {
  const state = {
    linkTokens: [],
    subscriptions: [],
    sendLog: [],
    rateLimits: [],
    processedUpdates: [],
  };

  function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : null;
  }

  function exec(sql, params) {
    const text = sql.replace(/\s+/g, ' ').trim();

    if (text.includes('INSERT INTO telegram_link_tokens')) {
      const [tokenHash, fromId, toId, dateFrom, dateTo, locale, expiresAt, createdAt] = params;
      state.linkTokens.push({
        token_hash: tokenHash,
        from_id: fromId,
        to_id: toId,
        date_from: dateFrom,
        date_to: dateTo,
        locale,
        expires_at: expiresAt,
        consumed_at: null,
        created_at: createdAt,
      });
      return { rows: [], changes: 1 };
    }

    if (text.includes('UPDATE telegram_link_tokens')) {
      const [consumedAt, tokenHash, nowIso] = params;
      const token = state.linkTokens.find(
        (row) => row.token_hash === tokenHash && row.consumed_at === null && row.expires_at > nowIso,
      );
      if (!token) return { rows: [], changes: 0 };
      token.consumed_at = consumedAt;
      return { rows: [clone(token)], changes: 1 };
    }

    if (text.includes('DELETE FROM telegram_link_tokens')) {
      const [cutoff] = params;
      const before = state.linkTokens.length;
      state.linkTokens = state.linkTokens.filter((row) => row.expires_at >= cutoff);
      return { rows: [], changes: before - state.linkTokens.length };
    }

    if (text.includes('INSERT INTO telegram_subscriptions')) {
      const [id, chatId, fromId, toId, dateFrom, dateTo, locale, status, lastAlertSentOn, createdAt, updatedAt] = params;
      const existing = state.subscriptions.find(
        (row) =>
          row.chat_id === chatId &&
          row.from_id === fromId &&
          row.to_id === toId &&
          row.date_from === dateFrom &&
          row.date_to === dateTo,
      );
      if (existing) {
        existing.locale = locale;
        existing.status = 'active';
        existing.updated_at = updatedAt;
        return { rows: [clone(existing)], changes: 1 };
      }

      const row = {
        id,
        chat_id: chatId,
        from_id: fromId,
        to_id: toId,
        date_from: dateFrom,
        date_to: dateTo,
        locale,
        status,
        last_alert_sent_on: lastAlertSentOn,
        created_at: createdAt,
        updated_at: updatedAt,
      };
      state.subscriptions.push(row);
      return { rows: [clone(row)], changes: 1 };
    }

    if (text.includes('UPDATE telegram_subscriptions SET last_alert_sent_on')) {
      const [sentOn, updatedAt, id] = params;
      const row = state.subscriptions.find((subscription) => subscription.id === id);
      if (!row) return { rows: [], changes: 0 };
      row.last_alert_sent_on = sentOn;
      row.updated_at = updatedAt;
      return { rows: [], changes: 1 };
    }

    if (text.includes('UPDATE telegram_subscriptions SET status')) {
      if (text.includes('WHERE chat_id')) {
        const [status, updatedAt, chatId] = params;
        const rows = state.subscriptions.filter((row) => row.chat_id === chatId && row.status === 'active');
        for (const row of rows) {
          row.status = status;
          row.updated_at = updatedAt;
        }
        return { rows: [], changes: rows.length };
      }

      const [status, updatedAt, id] = params;
      const row = state.subscriptions.find((subscription) => subscription.id === id);
      if (!row) return { rows: [], changes: 0 };
      row.status = status;
      row.updated_at = updatedAt;
      return { rows: [], changes: 1 };
    }

    if (text.includes('FROM telegram_subscriptions')) {
      if (text.includes('WHERE chat_id')) {
        const [chatId, status] = params;
        return { rows: state.subscriptions.filter((row) => row.chat_id === chatId && row.status === status).map(clone), changes: 0 };
      }
      const [status] = params;
      return { rows: state.subscriptions.filter((row) => row.status === status).map(clone), changes: 0 };
    }

    if (text.includes('INSERT OR IGNORE INTO telegram_alert_send_log')) {
      const [id, subscriptionId, sentOn, matchingDatesJson, providerStatus, errorSummary, createdAt] = params;
      const exists = state.sendLog.some((row) => row.subscription_id === subscriptionId && row.sent_on === sentOn);
      if (exists) return { rows: [], changes: 0 };
      state.sendLog.push({
        id,
        subscription_id: subscriptionId,
        sent_on: sentOn,
        matching_dates_json: matchingDatesJson,
        provider_status: providerStatus,
        error_summary: errorSummary,
        created_at: createdAt,
      });
      return { rows: [], changes: 1 };
    }

    if (text.includes('UPDATE telegram_alert_send_log')) {
      const [providerStatus, errorSummary, subscriptionId, sentOn] = params;
      const row = state.sendLog.find((entry) => entry.subscription_id === subscriptionId && entry.sent_on === sentOn);
      if (!row) return { rows: [], changes: 0 };
      row.provider_status = providerStatus;
      row.error_summary = errorSummary;
      return { rows: [], changes: 1 };
    }

    if (text.includes('INSERT INTO telegram_rate_limits')) {
      const [id, scope, action, bucketStart, count, updatedAt] = params;
      const existing = state.rateLimits.find(
        (row) => row.scope === scope && row.action === action && row.bucket_start === bucketStart,
      );
      if (existing) {
        existing.count += 1;
        existing.updated_at = updatedAt;
        return { rows: [{ count: existing.count }], changes: 1 };
      }
      state.rateLimits.push({ id, scope, action, bucket_start: bucketStart, count, updated_at: updatedAt });
      return { rows: [{ count }], changes: 1 };
    }

    if (text.includes('DELETE FROM telegram_rate_limits')) {
      const [cutoff] = params;
      const before = state.rateLimits.length;
      state.rateLimits = state.rateLimits.filter((row) => row.bucket_start >= cutoff);
      return { rows: [], changes: before - state.rateLimits.length };
    }

    if (text.includes('INSERT OR IGNORE INTO telegram_processed_updates')) {
      const [updateId, createdAt] = params;
      if (state.processedUpdates.some((row) => row.update_id === updateId)) return { rows: [], changes: 0 };
      state.processedUpdates.push({ update_id: updateId, created_at: createdAt });
      return { rows: [], changes: 1 };
    }

    if (text.includes('DELETE FROM telegram_processed_updates')) {
      const [cutoff] = params;
      const before = state.processedUpdates.length;
      state.processedUpdates = state.processedUpdates.filter((row) => row.created_at >= cutoff);
      return { rows: [], changes: before - state.processedUpdates.length };
    }

    throw new Error(`Unexpected SQL: ${text}`);
  }

  return {
    state,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              return exec(sql, params).rows[0] ?? null;
            },
            async all() {
              return { results: exec(sql, params).rows };
            },
            async run() {
              return { changes: exec(sql, params).changes };
            },
          };
        },
      };
    },
  };
}

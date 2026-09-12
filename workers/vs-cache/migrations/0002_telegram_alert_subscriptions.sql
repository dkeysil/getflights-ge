-- Telegram-only availability alerts (v1).
-- Migration 0001 stays untouched: the email tables are an inactive predecessor.

-- Short-lived, single-use deep-link tokens. They carry the whole subscription
-- intent so no chat-less subscription row ever exists.
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  token_hash TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  locale TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_expires_at
  ON telegram_link_tokens (expires_at);

CREATE TABLE IF NOT EXISTS telegram_subscriptions (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  locale TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'unsubscribed')),
  last_alert_sent_on TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (chat_id, from_id, to_id, date_from, date_to)
);

CREATE INDEX IF NOT EXISTS idx_telegram_subscriptions_status
  ON telegram_subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_telegram_subscriptions_chat_id
  ON telegram_subscriptions (chat_id);

-- One row per subscription per Tbilisi product day: the unique index is what
-- makes "send exactly once per day" hold even across overlapping cron runs.
CREATE TABLE IF NOT EXISTS telegram_alert_send_log (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  sent_on TEXT NOT NULL,
  matching_dates_json TEXT NOT NULL,
  provider_status TEXT NOT NULL,
  error_summary TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_alert_send_log_subscription_day
  ON telegram_alert_send_log (subscription_id, sent_on);

CREATE TABLE IF NOT EXISTS telegram_rate_limits (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  action TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  count INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (scope, action, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_telegram_rate_limits_bucket
  ON telegram_rate_limits (bucket_start);

-- Telegram redelivers updates until a 2xx lands, so every update_id is claimed
-- once before it is acted on.
CREATE TABLE IF NOT EXISTS telegram_processed_updates (
  update_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telegram_processed_updates_created_at
  ON telegram_processed_updates (created_at);

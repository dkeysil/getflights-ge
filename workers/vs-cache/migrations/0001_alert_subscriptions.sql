CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  locale TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'unsubscribed')),
  confirmed_at TEXT,
  unsubscribed_at TEXT,
  last_alert_sent_on TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (email, from_id, to_id, date_from, date_to)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions (email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status);

CREATE TABLE IF NOT EXISTS subscription_tokens (
  token_hash TEXT PRIMARY KEY,
  subscription_id TEXT,
  email TEXT,
  purpose TEXT NOT NULL CHECK (purpose IN ('confirm', 'manage')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscription_tokens_subscription_id ON subscription_tokens (subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_tokens_email ON subscription_tokens (email);

CREATE TABLE IF NOT EXISTS alert_send_log (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  sent_on TEXT NOT NULL,
  matching_dates_json TEXT NOT NULL,
  provider_status TEXT NOT NULL,
  error_summary TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_send_log_subscription_day
  ON alert_send_log (subscription_id, sent_on);

CREATE TABLE IF NOT EXISTS alert_request_limits (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  action TEXT NOT NULL,
  bucket_start TEXT NOT NULL,
  count INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (scope, action, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_alert_request_limits_bucket
  ON alert_request_limits (bucket_start);

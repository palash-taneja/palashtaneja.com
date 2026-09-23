CREATE TABLE IF NOT EXISTS signup_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS signup_limits_expiry ON signup_limits(expires_at);

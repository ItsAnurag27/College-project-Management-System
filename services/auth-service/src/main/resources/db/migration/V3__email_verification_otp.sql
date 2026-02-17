ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS email_otps (
  id UUID PRIMARY KEY,
  user_id UUID NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL,
  request_ip TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email_purpose_created ON email_otps (email, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_otps_ip_created ON email_otps (request_ip, created_at DESC);

-- IPRN SMS Panel - production schema

CREATE TABLE IF NOT EXISTS platforms (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id              BIGSERIAL PRIMARY KEY,
  platform_id     INTEGER REFERENCES platforms(id),
  platform_name   VARCHAR(100) NOT NULL,
  sender_number   VARCHAR(32),
  receiver_number VARCHAR(32) NOT NULL,
  number_value    BIGINT NOT NULL,
  country_code    VARCHAR(8),
  otp_code        VARCHAR(20),
  message_text    TEXT NOT NULL,
  payout          NUMERIC(12,4) NOT NULL DEFAULT 0,
  currency        VARCHAR(8) NOT NULL DEFAULT 'USD',
  status          VARCHAR(20) NOT NULL DEFAULT 'received',
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Provider webhook fields
  raw_payload     JSONB,
  idempotency_key VARCHAR(255),
  source_provider VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_messages_number_value ON messages (number_value);
CREATE INDEX IF NOT EXISTS idx_messages_received_at  ON messages (received_at);
CREATE INDEX IF NOT EXISTS idx_messages_payout        ON messages (payout);
CREATE INDEX IF NOT EXISTS idx_messages_platform_name ON messages (platform_name);
CREATE INDEX IF NOT EXISTS idx_messages_source_provider ON messages (source_provider);
-- Unique constraint allows multiple NULL idempotency_key rows (Postgres treats NULLs as distinct)
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_idempotency_unique
  ON messages (idempotency_key);

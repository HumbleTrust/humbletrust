-- Schema gap migration (2026-06-02)
-- Adds columns that exist in the live DB but were missing from migration files.
-- All statements use IF NOT EXISTS / IF EXISTS to be idempotent.

-- ── tokens: extra metadata & analytics columns ────────────────────────────────
ALTER TABLE tokens
  ADD COLUMN IF NOT EXISTS raydium_pool       text,
  ADD COLUMN IF NOT EXISTS description        text,
  ADD COLUMN IF NOT EXISTS website            text,
  ADD COLUMN IF NOT EXISTS twitter            text,
  ADD COLUMN IF NOT EXISTS telegram           text,
  ADD COLUMN IF NOT EXISTS verified_issuer    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_issuer_level text,
  ADD COLUMN IF NOT EXISTS volume_sol         numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trades_count       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_trade_at      timestamptz;

CREATE INDEX IF NOT EXISTS idx_tokens_creator        ON tokens(creator);
CREATE INDEX IF NOT EXISTS idx_tokens_status         ON tokens(status);
CREATE INDEX IF NOT EXISTS idx_tokens_volume_sol     ON tokens(volume_sol DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_raydium_pool   ON tokens(raydium_pool) WHERE raydium_pool IS NOT NULL;

-- ── badges: reserved_at column + extended status check ───────────────────────
ALTER TABLE badges
  ADD COLUMN IF NOT EXISTS reserved_at timestamptz;

-- Extend status check to include 'reserved' (drop old, add new)
ALTER TABLE badges DROP CONSTRAINT IF EXISTS badges_status_check;
ALTER TABLE badges
  ADD CONSTRAINT badges_status_check
  CHECK (status IN ('active', 'sold', 'cooldown', 'reserved'));

-- ── api_keys: ensure expires_at exists (used by apiKey.js) ───────────────────
ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

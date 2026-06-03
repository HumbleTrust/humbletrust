-- Token enrichment columns for market data
ALTER TABLE tokens
  ADD COLUMN IF NOT EXISTS holder_count      integer,
  ADD COLUMN IF NOT EXISTS market_cap_usd    numeric,
  ADD COLUMN IF NOT EXISTS fdv_usd           numeric,
  ADD COLUMN IF NOT EXISTS liquidity_usd     numeric,
  ADD COLUMN IF NOT EXISTS price_usd         numeric,
  ADD COLUMN IF NOT EXISTS price_change_1h   numeric,
  ADD COLUMN IF NOT EXISTS price_change_24h  numeric,
  ADD COLUMN IF NOT EXISTS volume_usd_24h    numeric,
  ADD COLUMN IF NOT EXISTS decimals          integer NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS total_supply      numeric,
  ADD COLUMN IF NOT EXISTS data_source       text,
  ADD COLUMN IF NOT EXISTS enriched_at       timestamptz;

CREATE INDEX IF NOT EXISTS idx_tokens_market_cap  ON tokens(market_cap_usd DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_tokens_price_usd   ON tokens(price_usd DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_tokens_enriched_at ON tokens(enriched_at);

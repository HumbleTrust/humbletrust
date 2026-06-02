-- Schema sync migration (2026-06-02)
-- Most columns already exist in production; this file documents what was verified.
-- Only new addition: stripe_customer_id on api_keys for reliable webhook revocation.

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS stripe_customer_id text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS api_keys_stripe_customer_id_idx
  ON api_keys (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

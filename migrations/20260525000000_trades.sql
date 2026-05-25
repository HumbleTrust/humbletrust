-- Trade history table
-- Stores every on-chain buy/sell recorded by the frontend after a successful tx.
-- price_sol = sol_reserve / token_reserve at the time of the trade.
CREATE TABLE IF NOT EXISTS public.trades (
  id            bigserial PRIMARY KEY,
  signature     text        NOT NULL UNIQUE,
  mint          text        NOT NULL,
  trader        text        NOT NULL,
  side          text        NOT NULL CHECK (side IN ('buy','sell')),
  source        text        NOT NULL DEFAULT 'curve' CHECK (source IN ('curve','raydium')),
  token_amount  numeric     NOT NULL DEFAULT 0,
  sol_amount    numeric     NOT NULL DEFAULT 0,
  price_sol     numeric     NOT NULL DEFAULT 0,
  block_time    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trades_mint_idx       ON public.trades (mint, block_time DESC);
CREATE INDEX IF NOT EXISTS trades_trader_idx     ON public.trades (trader, block_time DESC);
CREATE INDEX IF NOT EXISTS trades_block_time_idx ON public.trades (block_time DESC);

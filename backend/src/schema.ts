export const schemaSql = `
create table if not exists tokens (
  mint text primary key,
  creator text not null,
  name text,
  symbol text,
  launch_tx text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'curve',
  raydium_pool text,
  certificate_mint text,
  lock_percent integer,
  creator_percent integer,
  curve_liquidity_percent integer,
  circulation_percent integer,
  airdrop_percent integer,
  burn_option integer,
  initial_sol_lamports numeric,
  migration_threshold_lamports numeric,
  migration_reward_lamports numeric,
  launch_score integer not null default 0,
  creator_reputation integer not null default 0,
  market_health integer not null default 0,
  community_risk integer not null default 0,
  trust_score integer not null default 0,
  trust_level text not null default 'WEAK',
  volume_token numeric not null default 0,
  volume_sol numeric not null default 0,
  liquidity_sol numeric not null default 0,
  liquidity_token numeric not null default 0,
  trades_count integer not null default 0,
  complaints_count integer not null default 0,
  positive_votes integer not null default 0,
  negative_votes integer not null default 0
);

create table if not exists trades (
  id bigserial primary key,
  signature text not null,
  log_index integer not null default 0,
  mint text not null references tokens(mint) on delete cascade,
  trader text not null,
  side text not null check (side in ('buy', 'sell', 'raydium')),
  source text not null check (source in ('curve', 'raydium')),
  token_amount numeric not null default 0,
  sol_amount numeric not null default 0,
  price_sol numeric not null default 0,
  fee_lamports numeric not null default 0,
  slot bigint,
  block_time timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(signature, log_index, source)
);

create table if not exists ohlcv (
  mint text not null references tokens(mint) on delete cascade,
  timeframe text not null,
  bucket timestamptz not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume_token numeric not null default 0,
  volume_sol numeric not null default 0,
  trades_count integer not null default 0,
  primary key (mint, timeframe, bucket)
);

create table if not exists wallets (
  address text primary key,
  launches_count integer not null default 0,
  trades_count integer not null default 0,
  complaints_count integer not null default 0,
  rugs_count integer not null default 0,
  volume_sol numeric not null default 0,
  reputation_score integer not null default 50,
  updated_at timestamptz not null default now()
);

create index if not exists idx_tokens_created_at on tokens(created_at desc);
create index if not exists idx_trades_mint_time on trades(mint, block_time desc);
create index if not exists idx_ohlcv_mint_tf_bucket on ohlcv(mint, timeframe, bucket desc);
`;

-- Token TrustScore cache (avoids recomputing on every extension lookup)
create table if not exists token_score_cache (
  mint         text primary key,
  score        int  not null,
  trust_level  text not null,
  components   jsonb,
  computed_at  timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '1 hour'
);

create index if not exists token_score_cache_expires_idx on token_score_cache(expires_at);

-- TrustScore history (time series for score chart on Discover page)
create table if not exists score_history (
  id          bigserial primary key,
  mint        text not null,
  score       int  not null,
  trust_level text not null,
  recorded_at timestamptz not null default now()
);

create index if not exists score_history_mint_idx on score_history(mint, recorded_at desc);

-- Token health events (rug alerts, LP removals, suspicious activity)
create table if not exists token_health_events (
  id          bigserial primary key,
  mint        text not null,
  event_type  text not null,  -- 'lp_removed', 'whale_dump', 'dev_sell', 'suspicious_tx'
  severity    text not null,  -- 'low', 'medium', 'high', 'critical'
  details     jsonb,
  detected_at timestamptz not null default now()
);

create index if not exists token_health_events_mint_idx on token_health_events(mint, detected_at desc);
create index if not exists token_health_events_severity_idx on token_health_events(severity, detected_at desc);

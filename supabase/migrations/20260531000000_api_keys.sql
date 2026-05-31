-- API keys table for external developer access
create table if not exists api_keys (
  id            uuid primary key default gen_random_uuid(),
  key_hash      text not null unique,
  key_prefix    text not null,
  owner_email   text,
  owner_wallet  text,
  plan          text not null default 'free',
  daily_limit   int  not null default 100,
  label         text,
  revoked       boolean not null default false,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

create index if not exists api_keys_hash_idx on api_keys(key_hash) where not revoked;
create index if not exists api_keys_email_idx on api_keys(owner_email) where not revoked;

-- API usage log
create table if not exists api_usage (
  id         bigserial primary key,
  key_id     uuid references api_keys(id) on delete set null,
  ip         text,
  mint       text,
  format     text,
  cached     boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists api_usage_key_id_idx on api_usage(key_id, created_at desc);
create index if not exists api_usage_ip_idx on api_usage(ip, created_at desc);

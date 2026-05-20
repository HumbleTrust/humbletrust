alter table tokens add column if not exists tier text not null default 'standard'
  check (tier in ('standard','premium'));
create index if not exists idx_tokens_tier on tokens(tier);

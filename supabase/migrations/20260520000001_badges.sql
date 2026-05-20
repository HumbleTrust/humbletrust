create table if not exists badges (
  id               bigserial primary key,
  wallet           text not null unique,       -- one badge per wallet
  badge_mint       text unique,                -- NFT mint address on Solana
  zodiac           text not null,              -- Taurus, Leo, etc.
  element          text not null,              -- Fire, Water, Earth, Air
  aura_color       text not null,              -- hex, derived from wallet
  edition          integer not null,           -- sequential per zodiac
  minted_at        timestamptz not null default now(),
  sold_at          timestamptz,                -- set when NFT leaves wallet
  cooldown_until   timestamptz                 -- sold_at + 30 days
    generated always as (sold_at + interval '30 days') stored,
  tx_signature     text,                       -- mint transaction
  price_sol        numeric(10,4),              -- price paid in SOL
  status           text not null default 'active'
    check (status in ('active','sold','cooldown'))
);

-- counter per zodiac sign for edition numbers
create table if not exists badge_editions (
  zodiac   text primary key,
  count    integer not null default 0
);

insert into badge_editions (zodiac) values
  ('Aries'),('Taurus'),('Gemini'),('Cancer'),
  ('Leo'),('Virgo'),('Libra'),('Scorpio'),
  ('Sagittarius'),('Capricorn'),('Aquarius'),('Pisces')
on conflict do nothing;

create index if not exists idx_badges_wallet  on badges(wallet);
create index if not exists idx_badges_status  on badges(status);
create index if not exists idx_badges_zodiac  on badges(zodiac);

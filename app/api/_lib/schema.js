const { query } = require("./db");

const initSchema = () =>
  query(`
    create table if not exists tokens (
      mint text primary key,
      creator text not null,
      name text,
      symbol text,
      launch_tx text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      status text not null default 'curve',
      certificate_mint text,
      lock_percent integer,
      burn_option integer,
      launch_score integer not null default 0,
      trust_score integer not null default 0,
      trust_level text not null default 'WEAK'
    );
    create index if not exists idx_tokens_created_at on tokens(created_at desc);
  `);

module.exports = { initSchema };

import { query } from "./db.js";
import { IndexedTrade } from "./types.js";
import { computeCreatorReputation, computeMarketHealth, computeTrustScore } from "./trustScore.js";
import { upsertOhlcv } from "./ohlcv.js";

export const upsertTokenFromLaunch = async (input: {
  mint: string;
  creator: string;
  signature: string;
  createdAt: Date;
  launchScore: number;
  lockPercent?: number;
  burnOption?: number;
  initialSolLamports?: string;
}) => {
  await query(
    `
    insert into tokens (mint, creator, launch_tx, created_at, updated_at, launch_score, trust_score, trust_level, lock_percent, burn_option, initial_sol_lamports)
    values ($1,$2,$3,$4,now(),$5,$5,case when $5 >= 85 then 'ELITE' when $5 >= 70 then 'STRONG' when $5 >= 40 then 'OK' else 'WEAK' end,$6,$7,$8)
    on conflict (mint) do update set
      creator = excluded.creator,
      launch_tx = coalesce(tokens.launch_tx, excluded.launch_tx),
      updated_at = now(),
      launch_score = excluded.launch_score,
      lock_percent = coalesce(excluded.lock_percent, tokens.lock_percent),
      burn_option = coalesce(excluded.burn_option, tokens.burn_option),
      initial_sol_lamports = coalesce(excluded.initial_sol_lamports, tokens.initial_sol_lamports)
    `,
    [
      input.mint,
      input.creator,
      input.signature,
      input.createdAt,
      input.launchScore,
      input.lockPercent ?? null,
      input.burnOption ?? null,
      input.initialSolLamports ?? null,
    ]
  );
  await refreshWallet(input.creator);
  await refreshTokenScores(input.mint);
};

export const markMigrated = async (input: {
  mint: string;
  raydiumPool: string;
  signature: string;
}) => {
  await query(
    `
    update tokens
    set status = 'migrated', raydium_pool = $2, updated_at = now()
    where mint = $1
    `,
    [input.mint, input.raydiumPool]
  );
  await refreshTokenScores(input.mint);
};

export const recordTrade = async (trade: IndexedTrade) => {
  await query(
    `
    insert into trades (signature, log_index, mint, trader, side, source, token_amount, sol_amount, price_sol, fee_lamports, slot, block_time)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    on conflict (signature, log_index, source) do nothing
    `,
    [
      trade.signature,
      trade.logIndex,
      trade.mint,
      trade.trader,
      trade.side,
      trade.source,
      trade.tokenAmount,
      trade.solAmount,
      trade.priceSol,
      trade.feeLamports,
      trade.slot ?? null,
      trade.blockTime,
    ]
  );
  await upsertOhlcv(trade);
  await query(
    `
    update tokens
    set
      volume_token = volume_token + $2,
      volume_sol = volume_sol + $3,
      liquidity_sol = greatest(liquidity_sol, $4),
      trades_count = trades_count + 1,
      updated_at = now()
    where mint = $1
    `,
    [trade.mint, trade.tokenAmount, trade.solAmount, trade.solAmount]
  );
  await query(
    `
    insert into wallets (address, trades_count, volume_sol, updated_at)
    values ($1,1,$2,now())
    on conflict (address) do update set
      trades_count = wallets.trades_count + 1,
      volume_sol = wallets.volume_sol + excluded.volume_sol,
      updated_at = now()
    `,
    [trade.trader, trade.solAmount]
  );
  await refreshWallet(trade.trader);
  await refreshTokenScores(trade.mint);
};

export const refreshWallet = async (address: string) => {
  const [{ rows }, { rows: walletRows }] = await Promise.all([
    query(
      `
      select
        (select count(*) from tokens where creator = $1)::int as launches_count,
        coalesce((select sum(complaints_count) from tokens where creator = $1),0)::int as complaints_count,
        coalesce((select sum(volume_sol) from trades where trader = $1),0)::numeric as volume_sol,
        (select count(*) from trades where trader = $1)::int as trades_count
      `,
      [address]
    ),
    query<{ rugs_count: number }>(
      `select coalesce(rugs_count,0)::int as rugs_count from wallets where address = $1`,
      [address]
    ),
  ]);
  const row = rows[0];
  if (!row) return;
  const reputation = computeCreatorReputation({
    launchesCount: Number(row.launches_count),
    rugsCount: Number(walletRows[0]?.rugs_count ?? 0),
    complaintsCount: Number(row.complaints_count),
  });
  await query(
    `
    insert into wallets (address, launches_count, trades_count, complaints_count, volume_sol, reputation_score, updated_at)
    values ($1,$2,$3,$4,$5,$6,now())
    on conflict (address) do update set
      launches_count = excluded.launches_count,
      trades_count = greatest(wallets.trades_count, excluded.trades_count),
      complaints_count = excluded.complaints_count,
      volume_sol = greatest(wallets.volume_sol, excluded.volume_sol),
      reputation_score = excluded.reputation_score,
      updated_at = now()
    `,
    [
      address,
      Number(row.launches_count),
      Number(row.trades_count),
      Number(row.complaints_count),
      Number(row.volume_sol),
      reputation,
    ]
  );
};

export const refreshTokenScores = async (mint: string) => {
  const { rows } = await query(
    `
    select t.*, coalesce(w.launches_count,0) as launches_count, coalesce(w.rugs_count,0) as rugs_count
    from tokens t
    left join wallets w on w.address = t.creator
    where t.mint = $1
    `,
    [mint]
  );
  const token = rows[0];
  if (!token) return;
  const score = computeTrustScore({
    launchScore: Number(token.launch_score),
    launchesCount: Number(token.launches_count),
    rugsCount: Number(token.rugs_count),
    complaintsCount: Number(token.complaints_count),
    positiveVotes: Number(token.positive_votes),
    negativeVotes: Number(token.negative_votes),
    volumeSol: Number(token.volume_sol),
    liquiditySol: Number(token.liquidity_sol),
    tradesCount: Number(token.trades_count),
  });
  await query(
    `
    update tokens set
      creator_reputation = $2,
      market_health = $3,
      community_risk = $4,
      trust_score = $5,
      trust_level = $6,
      updated_at = now()
    where mint = $1
    `,
    [mint, score.creatorReputation, score.marketHealth, score.communityRisk, score.trustScore, score.trustLevel]
  );
};

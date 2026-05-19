import { Connection, LAMPORTS_PER_SOL, Logs, PublicKey } from "@solana/web3.js";
import { config } from "./config.js";
import { parseAnchorEvents, toBase58, toNumber } from "./anchorEvents.js";
import { markMigrated, recordTrade, upsertTokenFromLaunch } from "./repository.js";
import { broadcastMintUpdate } from "./liveHub.js";

const TOKEN_DECIMALS = 9;
const rawTokenToUi = (amount: number) => amount / 10 ** TOKEN_DECIMALS;
const lamportsToSol = (lamports: number) => lamports / LAMPORTS_PER_SOL;
const priceFromEvent = (priceLamportsPerUiToken: number) => priceLamportsPerUiToken / LAMPORTS_PER_SOL;

const blockTime = async (connection: Connection, slot?: number) => {
  if (!slot) return new Date();
  const unix = await connection.getBlockTime(slot).catch(() => null);
  return unix ? new Date(unix * 1000) : new Date();
};

export const startHumbleTrustIndexer = (connection: Connection) => {
  console.log(`Indexing HumbleTrust v2 ${config.programId.toBase58()} on ${config.network}`);
  return connection.onLogs(config.programId, async (logs: Logs, ctx) => {
    const events = parseAnchorEvents(logs.logs);
    if (events.length === 0) return;
    const time = await blockTime(connection, ctx.slot);
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index]!;
      if (event.name === "TokenCreatedV2") {
        await upsertTokenFromLaunch({
          mint: toBase58(event.data.mint),
          creator: toBase58(event.data.creator),
          signature: logs.signature,
          createdAt: time,
          launchScore: toNumber(event.data.trustScore),
          initialSolLamports: String(toNumber(event.data.initialSolLamports)),
        });
      }
      if (event.name === "CurveBuyV2") {
        const mint = toBase58(event.data.mint);
        const tokens = rawTokenToUi(toNumber(event.data.tokensOut));
        const sol = lamportsToSol(toNumber(event.data.solInLamports));
        await recordTrade({
          signature: logs.signature,
          logIndex: index,
          mint,
          trader: toBase58(event.data.buyer),
          side: "buy",
          source: "curve",
          tokenAmount: tokens,
          solAmount: sol,
          priceSol: priceFromEvent(toNumber(event.data.priceLamportsPerToken)),
          feeLamports: toNumber(event.data.platformFeeLamports) + toNumber(event.data.creatorFeeLamports),
          slot: ctx.slot,
          blockTime: time,
        });
        await broadcastMintUpdate(mint);
      }
      if (event.name === "CurveSellV2") {
        const mint = toBase58(event.data.mint);
        const tokens = rawTokenToUi(toNumber(event.data.tokensIn));
        const sol = lamportsToSol(toNumber(event.data.grossSolOutLamports));
        await recordTrade({
          signature: logs.signature,
          logIndex: index,
          mint,
          trader: toBase58(event.data.seller),
          side: "sell",
          source: "curve",
          tokenAmount: tokens,
          solAmount: sol,
          priceSol: priceFromEvent(toNumber(event.data.priceLamportsPerToken)),
          feeLamports: toNumber(event.data.platformFeeLamports) + toNumber(event.data.creatorFeeLamports),
          slot: ctx.slot,
          blockTime: time,
        });
        await broadcastMintUpdate(mint);
      }
      if (event.name === "MigratedToRaydiumV2") {
        await markMigrated({
          mint: toBase58(event.data.mint),
          raydiumPool: toBase58(event.data.raydiumPool),
          signature: logs.signature,
        });
      }
    }
  }, "confirmed");
};

export const startRaydiumIndexer = (connection: Connection) => {
  console.log(`Watching Raydium CPMM ${config.raydiumCpmmProgramId.toBase58()} for known HumbleTrust pools`);
  return connection.onLogs(config.raydiumCpmmProgramId, async (logs, ctx) => {
    const { rows } = await import("./db.js").then(({ query }) =>
      query<{ mint: string; raydium_pool: string }>(
        "select mint, raydium_pool from tokens where raydium_pool is not null"
      )
    );
    if (rows.length === 0) return;
    const poolByAddress = new Map(rows.map((row) => [row.raydium_pool, row.mint]));
    const tx = await connection.getParsedTransaction(logs.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    }).catch(() => null);
    if (!tx?.transaction.message.accountKeys) return;
    const accounts = tx.transaction.message.accountKeys.map((key) => key.pubkey.toBase58());
    const pool = accounts.find((account) => poolByAddress.has(account));
    if (!pool) return;
    const mint = poolByAddress.get(pool)!;
    const preSol = tx.meta?.preBalances?.reduce((sum, value) => sum + value, 0) ?? 0;
    const postSol = tx.meta?.postBalances?.reduce((sum, value) => sum + value, 0) ?? 0;
    const solDelta = Math.abs(postSol - preSol) / LAMPORTS_PER_SOL;
    if (solDelta <= 0) return;
    await recordTrade({
      signature: logs.signature,
      logIndex: 0,
      mint,
      trader: accounts[0] ?? PublicKey.default.toBase58(),
      side: "raydium",
      source: "raydium",
      tokenAmount: 0,
      solAmount: solDelta,
      priceSol: 0,
      feeLamports: 0,
      slot: ctx.slot,
      blockTime: new Date(),
    });
    await broadcastMintUpdate(mint);
  }, "confirmed");
};

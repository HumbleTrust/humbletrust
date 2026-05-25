/**
 * Syncs on-chain trade history for a given mint into the `trades` table.
 *
 * Strategy:
 *  1. Derive the curve treasury SOL account (curveTreasurySol PDA)
 *  2. Fetch up to `limit` recent transaction signatures for that account
 *  3. For each tx, compare pre/post SOL balances on the treasury and
 *     pre/post token balances on the pool vault to determine buy vs sell
 *     and the amounts involved
 *  4. Upsert into the trades table (idempotent via signature unique key)
 */

const { Connection, PublicKey } = require("@solana/web3.js");
const { getClient } = require("../../_lib/db");
const { isValidWallet, setCors } = require("../../_lib/validate");

const PROGRAM_ID_V2 = "FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr";
const RPC_ENDPOINT = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const LAMPORTS_PER_SOL = 1_000_000_000;

function findPda(seeds, programId) {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

function derivePdas(mint) {
  const mintPk = new PublicKey(mint);
  const programPk = new PublicKey(PROGRAM_ID_V2);
  const enc = s => Buffer.from(s);

  const curveTreasurySol = findPda([enc("curve_treasury_sol_v2"), mintPk.toBuffer()], programPk);
  const curvePoolVault   = findPda([enc("curve_pool_vault_v2"),    mintPk.toBuffer()], programPk);
  return { curveTreasurySol, curvePoolVault };
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  const { mint } = req.query;
  if (!mint || !isValidWallet(mint)) return res.status(400).json({ error: "invalid mint" });

  const limit = Math.min(Number(req.query.limit) || 100, 500);

  try {
    const conn = new Connection(RPC_ENDPOINT, "confirmed");
    const { curveTreasurySol, curvePoolVault } = derivePdas(mint);

    // Fetch recent signatures for the SOL treasury account
    const sigs = await conn.getSignaturesForAddress(curveTreasurySol, { limit });
    if (!sigs || sigs.length === 0) {
      return res.json({ synced: 0, message: "No transactions found for this mint" });
    }

    // Fetch full transactions (in batches of 10 to avoid timeout)
    const BATCH = 10;
    const rows = [];
    const treasuryStr = curveTreasurySol.toBase58();
    const vaultStr    = curvePoolVault.toBase58();

    for (let i = 0; i < sigs.length; i += BATCH) {
      const batch = sigs.slice(i, i + BATCH);
      const txs = await Promise.all(
        batch.map(s =>
          conn.getTransaction(s.signature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          }).catch(() => null)
        )
      );

      for (let j = 0; j < txs.length; j++) {
        const tx = txs[j];
        const sig = batch[j];
        if (!tx || tx.meta?.err) continue;

        const accounts = tx.transaction.message.staticAccountKeys
          ? tx.transaction.message.staticAccountKeys.map(k => k.toBase58())
          : tx.transaction.message.accountKeys?.map(k => k.toBase58()) || [];

        const treasuryIdx = accounts.indexOf(treasuryStr);
        if (treasuryIdx === -1) continue;

        const preSol  = (tx.meta.preBalances[treasuryIdx]  || 0) / LAMPORTS_PER_SOL;
        const postSol = (tx.meta.postBalances[treasuryIdx] || 0) / LAMPORTS_PER_SOL;
        const solDelta = postSol - preSol;

        if (Math.abs(solDelta) < 0.000001) continue; // dust / no change

        const side = solDelta > 0 ? "buy" : "sell";
        const solAmount = Math.abs(solDelta);

        // Find the trader — fee payer is accounts[0]
        const trader = accounts[0] || "";
        if (!trader || !isValidWallet(trader)) continue;

        // Derive price from post-balances: price = postSolReserve / postTokenReserve
        let postTokenReserve = 0;
        let tokenAmount = 0;
        const preTokenBals  = tx.meta.preTokenBalances  || [];
        const postTokenBals = tx.meta.postTokenBalances || [];

        const vaultPre  = preTokenBals.find(b  => b.mint === mint && accounts[b.accountIndex] === vaultStr);
        const vaultPost = postTokenBals.find(b => b.mint === mint && accounts[b.accountIndex] === vaultStr);

        if (vaultPost) {
          postTokenReserve = Number(vaultPost.uiTokenAmount?.uiAmountString || vaultPost.uiTokenAmount?.uiAmount || 0);
        }
        if (vaultPre && vaultPost) {
          const preAmt  = Number(vaultPre.uiTokenAmount?.uiAmountString  || vaultPre.uiTokenAmount?.uiAmount  || 0);
          const postAmt = Number(vaultPost.uiTokenAmount?.uiAmountString || vaultPost.uiTokenAmount?.uiAmount || 0);
          tokenAmount = Math.abs(postAmt - preAmt);
        }

        const priceSol = postTokenReserve > 0 ? postSol / postTokenReserve : 0;

        const blockTime = sig.blockTime
          ? new Date(sig.blockTime * 1000).toISOString()
          : new Date().toISOString();

        rows.push({
          signature:    sig.signature,
          mint,
          trader,
          side,
          source:       "curve",
          token_amount: tokenAmount,
          sol_amount:   solAmount,
          price_sol:    priceSol,
          block_time:   blockTime,
        });
      }
    }

    if (rows.length === 0) {
      return res.json({ synced: 0, message: "Transactions found but none parsed as trades" });
    }

    const { error } = await getClient()
      .from("trades")
      .upsert(rows, { onConflict: "signature", ignoreDuplicates: true });

    if (error) throw error;

    return res.json({ synced: rows.length, total_sigs: sigs.length });
  } catch (e) {
    console.error("[sync_trades]", e.message);
    return res.status(500).json({ error: e.message || "Internal server error" });
  }
};

const { getClient } = require("../../_lib/db");
const { isValidWallet, setCors } = require("../../_lib/validate");

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  const { mint } = req.query;
  if (!mint || !isValidWallet(mint)) return res.status(400).json({ error: "invalid mint" });

  const { signature, trader, side, source, token_amount, sol_amount, price_sol, block_time } = req.body || {};

  if (!signature || typeof signature !== "string" || signature.length < 10)
    return res.status(400).json({ error: "invalid signature" });
  if (!trader || !isValidWallet(trader))
    return res.status(400).json({ error: "invalid trader" });
  if (!["buy", "sell"].includes(side))
    return res.status(400).json({ error: "side must be buy or sell" });

  try {
    const { error } = await getClient()
      .from("trades")
      .upsert({
        signature,
        mint,
        trader,
        side,
        source: source || "curve",
        token_amount: Number(token_amount) || 0,
        sol_amount: Number(sol_amount) || 0,
        price_sol: Number(price_sol) || 0,
        block_time: block_time ? new Date(block_time).toISOString() : new Date().toISOString(),
      }, { onConflict: "signature", ignoreDuplicates: true });

    if (error) throw error;
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error("[record_trade]", e.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

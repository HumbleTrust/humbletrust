const { getClient } = require("../_lib/db");
const { isValidWallet, setCors } = require("../_lib/validate");

const DEVNET_RPC  = "https://api.devnet.solana.com";
const MAINNET_RPC = "https://api.mainnet-beta.solana.com";

const getTrustLevel = (s) =>
  s >= 85 ? "ELITE" : s >= 70 ? "STRONG" : s >= 40 ? "OK" : "WEAK";

// Call Solana JSON-RPC to read mint account
async function getMintInfo(mint, rpc) {
  try {
    const r = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getAccountInfo",
        params: [mint, { encoding: "jsonParsed", commitment: "confirmed" }],
      }),
      signal: AbortSignal.timeout(5000),
    });
    const d = await r.json();
    return d?.result?.value?.data?.parsed?.info || null;
  } catch {
    return null;
  }
}

// Score a token not in HumbleTrust using on-chain mint data
function scoreExternal(mintInfo) {
  if (!mintInfo) return { score: 0, components: { error: "mint_not_found" } };

  const c = {};
  let score = 0;

  // Mint authority revoked = no inflation (+30)
  if (!mintInfo.mintAuthority) { score += 30; c.mint_authority_revoked = 30; }
  else { c.mint_authority_revoked = 0; c.mint_authority_flag = "ACTIVE — creator can mint more tokens"; }

  // Freeze authority revoked = no account freeze (+20)
  if (!mintInfo.freezeAuthority) { score += 20; c.freeze_authority_revoked = 20; }
  else { c.freeze_authority_revoked = 0; c.freeze_authority_flag = "ACTIVE — creator can freeze accounts"; }

  // Supply reasonable (not 0, not quadrillions of quadrillions)
  const supply = Number(mintInfo.supply || 0);
  if (supply > 0 && supply <= 1e21) { score += 10; c.supply_reasonable = 10; }
  else { c.supply_reasonable = 0; }

  // Standard 9 decimals (+5)
  if (mintInfo.decimals === 9) { score += 5; c.standard_decimals = 5; }
  else { c.standard_decimals = 0; }

  // Initialized (+5)
  if (mintInfo.isInitialized) { score += 5; c.initialized = 5; }

  c._note = "External token — only on-chain mint data used. Launch on HumbleTrust to get a full TrustScore.";
  c._max_external = 70;

  return { score: Math.min(70, score), components: c };
}

module.exports = async (req, res) => {
  setCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("X-HumbleTrust-Version", "2.0");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: "Service unavailable" });

  const { mint } = req.query;
  if (!mint) return res.status(400).json({ error: "mint required" });
  if (!isValidWallet(mint)) return res.status(400).json({ error: "invalid mint address" });

  const db = getClient();

  try {
    // 1. Check HumbleTrust DB first
    const { data: token } = await db.from("tokens").select("*").eq("mint", mint).single();

    if (token) {
      // Full score from our registry
      const score = token.trust_score || token.launch_score || 0;

      // Optionally verify on-chain (devnet)
      const mintInfo = await getMintInfo(mint, DEVNET_RPC);
      const onchain = mintInfo ? {
        mint_authority_revoked: !mintInfo.mintAuthority,
        freeze_authority_revoked: !mintInfo.freezeAuthority,
        supply: mintInfo.supply,
        decimals: mintInfo.decimals,
      } : null;

      return res.json({
        mint,
        score,
        trust_level: getTrustLevel(score),
        source: "humbletrust",
        token: {
          name:            token.name,
          symbol:          token.symbol,
          status:          token.status,
          logo_uri:        token.logo_uri,
          creator:         token.creator,
          description:     token.description,
          website:         token.website,
          twitter:         token.twitter,
          telegram:        token.telegram,
          created_at:      token.created_at,
          raydium_pool:    token.raydium_pool,
          certificate_mint: token.certificate_mint,
          verified_issuer:  token.verified_issuer || false,
          verified_issuer_level: token.verified_issuer_level || 0,
        },
        breakdown: {
          lock_percent:   token.lock_percent,
          burn_option:    token.burn_option,
          tier:           token.tier,
          trust_level:    token.trust_level,
        },
        onchain_verification: onchain,
        computed_at: new Date().toISOString(),
      });
    }

    // 2. Not in HumbleTrust — try cache
    const { data: cached } = await db
      .from("token_score_cache")
      .select("*")
      .eq("mint", mint)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cached) {
      return res.json({
        mint,
        score: cached.score,
        trust_level: cached.trust_level,
        source: "external_cached",
        breakdown: cached.score_components,
        token: null,
        warning: "Token not in HumbleTrust registry. Score computed from on-chain mint data only.",
        computed_at: cached.computed_at,
        cache_expires: cached.expires_at,
      });
    }

    // 3. Fetch from chain (try devnet first, then mainnet)
    let mintInfo = await getMintInfo(mint, DEVNET_RPC);
    let network = "devnet";
    if (!mintInfo) {
      mintInfo = await getMintInfo(mint, MAINNET_RPC);
      network = mintInfo ? "mainnet-beta" : "unknown";
    }

    const { score, components } = scoreExternal(mintInfo);
    const trust_level = getTrustLevel(score);

    // Store in cache
    await db.from("token_score_cache").upsert({
      mint, score, trust_level, source: "external",
      score_components: { ...components, network },
      computed_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "mint" });

    return res.json({
      mint,
      score,
      trust_level,
      source: "external",
      network,
      breakdown: components,
      token: null,
      warning: "Token not in HumbleTrust registry. Score computed from on-chain mint data only. Max possible external score is 70/100.",
      cta: "Launch on HumbleTrust to get a full on-chain TrustScore with lock verification, LP policy, and Certificate NFT.",
      computed_at: new Date().toISOString(),
    });

  } catch (e) {
    console.error("[api/score]", e.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

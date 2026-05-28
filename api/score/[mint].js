const { getClient } = require("../_lib/db");
const { isValidWallet, setCors } = require("../_lib/validate");

const MAINNET_RPC = process.env.SOLANA_MAINNET_RPC || "https://api.mainnet-beta.solana.com";
const DEVNET_RPC  = process.env.SOLANA_RPC          || "https://api.devnet.solana.com";

// Known program addresses
const PUMP_FUN_PROGRAM   = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const PUMP_FUN_MIGRATION = "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg";
const TOKEN_PROGRAM      = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const BURN_ADDRESS       = "1nc1nerator11111111111111111111111111111111";
const NULL_WALLET        = "11111111111111111111111111111111";
const RAYDIUM_CPMM       = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
const RAYDIUM_AMM        = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const METAPLEX_PROGRAM   = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

const getTrustLevel = (s) =>
  s >= 85 ? "ELITE" : s >= 70 ? "STRONG" : s >= 40 ? "OK" : "WEAK";

// ─── RPC helpers ─────────────────────────────────────────────────────────────

async function rpcCall(rpc, method, params, timeout = 6000) {
  try {
    const r = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(timeout),
    });
    const d = await r.json();
    return d?.result ?? null;
  } catch {
    return null;
  }
}

async function getMintInfo(mint, rpc) {
  const result = await rpcCall(rpc, "getAccountInfo", [mint, { encoding: "jsonParsed", commitment: "confirmed" }]);
  return result?.value?.data?.parsed?.info || null;
}

async function getLargestAccounts(mint, rpc) {
  const result = await rpcCall(rpc, "getTokenLargestAccounts", [mint, { commitment: "confirmed" }]);
  return result?.value || [];
}

// Get token account owner (the wallet holding a given token account)
async function getTokenAccountOwner(tokenAccount, rpc) {
  const result = await rpcCall(rpc, "getAccountInfo", [tokenAccount, { encoding: "jsonParsed", commitment: "confirmed" }]);
  return result?.value?.data?.parsed?.info?.owner || null;
}

// Get the earliest signer from the creation transaction
async function getTokenCreator(mint, rpc) {
  try {
    // Get signatures oldest-first (paginate to last page)
    // Efficient: fetch small batches until we reach the end
    let before = undefined;
    let oldest = null;
    for (let i = 0; i < 4; i++) {
      const params = [mint, { limit: 1000, commitment: "confirmed", ...(before ? { before } : {}) }];
      const sigs = await rpcCall(rpc, "getSignaturesForAddress", params, 5000);
      if (!sigs || sigs.length === 0) break;
      oldest = sigs[sigs.length - 1];
      if (sigs.length < 1000) break; // reached the end
      before = sigs[sigs.length - 1].signature;
    }
    if (!oldest?.signature) return null;

    const tx = await rpcCall(rpc, "getTransaction", [oldest.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }], 5000);
    // The first account keys entry that is a signer and writable is the fee payer / creator
    const accounts = tx?.transaction?.message?.accountKeys || tx?.transaction?.message?.staticAccountKeys || [];
    const creator = accounts.find(a => (typeof a === "string" ? true : a.signer && a.writable));
    return typeof creator === "string" ? creator : creator?.pubkey || null;
  } catch {
    return null;
  }
}

// How many lamports/tokens does a wallet own for this mint?
async function getCreatorTokenBalance(creator, mint, rpc) {
  try {
    const result = await rpcCall(rpc, "getTokenAccountsByOwner", [
      creator,
      { mint },
      { encoding: "jsonParsed", commitment: "confirmed" },
    ], 5000);
    const accounts = result?.value || [];
    let total = 0n;
    for (const acc of accounts) {
      const amt = acc?.account?.data?.parsed?.info?.tokenAmount?.amount;
      if (amt) total += BigInt(amt);
    }
    return total;
  } catch {
    return 0n;
  }
}

// Check if token was created by pump.fun (mintAuthority is a PDA of pump.fun program)
function isPumpFunToken(mintInfo) {
  if (!mintInfo?.mintAuthority) return false;
  // pump.fun bonding curve PDAs are owned by the pump.fun program
  // We can't derive the PDA without web3.js here, but we can check:
  // - mint authority is NOT a standard base58 wallet (43+ chars, starts with uppercase)
  // - owner of mint account is the standard Token program (not Token-2022)
  // As a heuristic: mintAuthority not null and token is on mainnet
  // Better: check via the mint account's owner program
  return true; // will be refined by context
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

async function scoreExternal(mint, mintInfo, rpc, db) {
  const c   = {};
  let score = 0;
  const flags = [];

  const totalSupply = BigInt(mintInfo?.supply || 0);

  // ── 1. Mint authority (max +25) ──────────────────────────────────────────
  if (!mintInfo?.mintAuthority) {
    score += 25; c.mint_authority = { pts: 25, ok: true, label: "Revoked — no new tokens can be minted" };
  } else {
    c.mint_authority = { pts: 0, ok: false, label: `Active (${mintInfo.mintAuthority}) — creator can inflate supply` };
    flags.push({ type: "mint_authority_active", severity: "high", msg: "Mint authority not revoked — new tokens can be created at any time" });
  }

  // ── 2. Freeze authority (max +15) ────────────────────────────────────────
  if (!mintInfo?.freezeAuthority) {
    score += 15; c.freeze_authority = { pts: 15, ok: true, label: "Revoked — no accounts can be frozen" };
  } else {
    c.freeze_authority = { pts: 0, ok: false, label: `Active (${mintInfo.freezeAuthority}) — creator can freeze wallets` };
    flags.push({ type: "freeze_authority_active", severity: "medium", msg: "Freeze authority not revoked — wallets holding this token can be frozen" });
  }

  // ── 3. Supply & decimals (max +5) ────────────────────────────────────────
  const supply = Number(totalSupply);
  const decimals = mintInfo?.decimals ?? -1;
  if (decimals === 9 && supply > 0 && supply <= 1.1e18) {
    score += 5; c.supply = { pts: 5, ok: true, label: `${(supply / 1e9).toLocaleString("en-US", { maximumFractionDigits: 0 })}M tokens, 9 decimals (standard)` };
  } else {
    c.supply = { pts: 0, ok: false, label: `${supply > 0 ? supply.toExponential(2) : "0"} supply, ${decimals} decimals (non-standard)` };
    if (decimals !== 9) flags.push({ type: "non_standard_decimals", severity: "low", msg: `Non-standard decimals (${decimals})` });
  }

  // ── 4. Holder concentration + LP burn (max +25) ──────────────────────────
  const holders = await getLargestAccounts(mint, rpc);

  let lpBurned    = false;
  let topHolderPct = 0;
  let creatorAcc  = null; // the token account address in top holders

  if (holders.length > 0 && totalSupply > 0n) {
    // Check if burn address is among holders (LP tokens burned)
    // We need to resolve owner of each top account — do top 5 in parallel
    const ownerPromises = holders.slice(0, 5).map(h => getTokenAccountOwner(h.address, rpc));
    const owners = await Promise.all(ownerPromises);

    for (let i = 0; i < owners.length; i++) {
      const owner = owners[i];
      const pct   = (Number(BigInt(holders[i].amount)) / Number(totalSupply)) * 100;
      if (owner === BURN_ADDRESS || owner === NULL_WALLET) {
        lpBurned = true;
        c[`holder_${i}_burn`] = { owner, pct: pct.toFixed(1), label: "LP tokens burned" };
      }
    }

    // Top single non-burn holder %
    const nonBurn = holders.filter((_, i) => owners[i] !== BURN_ADDRESS && owners[i] !== NULL_WALLET);
    if (nonBurn.length > 0) {
      topHolderPct = (Number(BigInt(nonBurn[0].amount)) / Number(totalSupply)) * 100;
    }
  }

  if (lpBurned) {
    score += 20; c.lp_burned = { pts: 20, ok: true, label: "LP tokens burned — liquidity is permanent" };
  } else if (holders.length === 0) {
    c.lp_burned = { pts: 0, ok: null, label: "No holder data available" };
  } else {
    c.lp_burned = { pts: 0, ok: false, label: "LP tokens not burned — liquidity can be removed" };
    flags.push({ type: "lp_not_burned", severity: "high", msg: "Liquidity pool tokens are not burned — rug pull possible" });
  }

  if (topHolderPct > 0) {
    if (topHolderPct < 10) {
      score += 10; c.concentration = { pts: 10, ok: true, label: `Top holder ${topHolderPct.toFixed(1)}% — well distributed` };
    } else if (topHolderPct < 25) {
      score += 5;  c.concentration = { pts: 5, ok: true, label: `Top holder ${topHolderPct.toFixed(1)}%` };
    } else if (topHolderPct < 50) {
      score += 0;  c.concentration = { pts: 0, ok: false, label: `Top holder ${topHolderPct.toFixed(1)}% — high concentration` };
      flags.push({ type: "high_concentration", severity: "medium", msg: `Single wallet holds ${topHolderPct.toFixed(1)}% of supply` });
    } else {
      score -= 5;  c.concentration = { pts: -5, ok: false, label: `Top holder ${topHolderPct.toFixed(1)}% — extreme concentration` };
      flags.push({ type: "extreme_concentration", severity: "high", msg: `Single wallet controls ${topHolderPct.toFixed(1)}% of supply — dump risk` });
    }
  } else {
    c.concentration = { pts: 0, ok: null, label: "No holder data" };
  }

  // ── 5. Creator holdings (max +15) ────────────────────────────────────────
  // Identify creator: if mintAuthority is a known wallet (not a program PDA), use it
  // Otherwise, try to find from creation transaction
  let creator = null;
  let creatorPct = null;

  const knownPrograms = new Set([PUMP_FUN_PROGRAM, PUMP_FUN_MIGRATION, TOKEN_PROGRAM, TOKEN_2022_PROGRAM, RAYDIUM_CPMM, RAYDIUM_AMM, METAPLEX_PROGRAM, NULL_WALLET, BURN_ADDRESS]);

  if (mintInfo?.mintAuthority && !knownPrograms.has(mintInfo.mintAuthority)) {
    creator = mintInfo.mintAuthority;
  }

  if (!creator) {
    creator = await getTokenCreator(mint, rpc);
  }

  if (creator && totalSupply > 0n) {
    const creatorBalance = await getCreatorTokenBalance(creator, mint, rpc);
    creatorPct = (Number(creatorBalance) / Number(totalSupply)) * 100;

    if (creatorPct < 2) {
      score += 15; c.creator_holdings = { pts: 15, ok: true, wallet: creator, pct: creatorPct.toFixed(2), label: `Creator holds ${creatorPct.toFixed(2)}% — minimal risk` };
    } else if (creatorPct < 10) {
      score += 8;  c.creator_holdings = { pts: 8, ok: true, wallet: creator, pct: creatorPct.toFixed(2), label: `Creator holds ${creatorPct.toFixed(2)}%` };
    } else if (creatorPct < 30) {
      score += 2;  c.creator_holdings = { pts: 2, ok: false, wallet: creator, pct: creatorPct.toFixed(2), label: `Creator holds ${creatorPct.toFixed(2)}% — moderate dump risk` };
      flags.push({ type: "creator_large_holdings", severity: "medium", msg: `Creator still holds ${creatorPct.toFixed(1)}% of supply` });
    } else {
      score -= 10; c.creator_holdings = { pts: -10, ok: false, wallet: creator, pct: creatorPct.toFixed(2), label: `Creator holds ${creatorPct.toFixed(2)}% — DANGER` };
      flags.push({ type: "creator_whale", severity: "critical", msg: `Creator holds ${creatorPct.toFixed(1)}% — very high dump risk` });
    }
  } else if (creator) {
    c.creator_holdings = { pts: 0, ok: null, wallet: creator, pct: null, label: "Creator identified but balance unavailable" };
  } else {
    c.creator_holdings = { pts: 0, ok: null, wallet: null, pct: null, label: "Creator could not be identified" };
  }

  // ── 6. Creator track record in HumbleTrust DB (max +5) ───────────────────
  if (creator) {
    try {
      const { data: creatorTokens } = await db
        .from("tokens")
        .select("mint, trust_score, status, verified_issuer")
        .eq("creator", creator);

      if (creatorTokens && creatorTokens.length > 0) {
        const isVerified = creatorTokens.some(t => t.verified_issuer);
        const avgScore   = creatorTokens.reduce((s, t) => s + (t.trust_score || 0), 0) / creatorTokens.length;
        const graduated  = creatorTokens.filter(t => t.status === "migrated").length;

        if (isVerified || avgScore >= 70) {
          score += 5;
          c.creator_track_record = { pts: 5, ok: true, label: `${creatorTokens.length} token(s) on HumbleTrust, avg score ${Math.round(avgScore)}${isVerified ? " — Verified Issuer" : ""}` };
        } else if (avgScore >= 40) {
          score += 2;
          c.creator_track_record = { pts: 2, ok: true, label: `${creatorTokens.length} token(s) on HumbleTrust, avg score ${Math.round(avgScore)}` };
        } else {
          c.creator_track_record = { pts: 0, ok: false, label: `${creatorTokens.length} token(s) on HumbleTrust with low avg score ${Math.round(avgScore)}` };
          flags.push({ type: "creator_low_track_record", severity: "low", msg: `Creator's previous launches averaged ${Math.round(avgScore)}/100` });
        }
      } else {
        c.creator_track_record = { pts: 0, ok: null, label: "No HumbleTrust launch history for this creator" };
      }
    } catch {
      c.creator_track_record = { pts: 0, ok: null, label: "DB lookup skipped" };
    }
  } else {
    c.creator_track_record = { pts: 0, ok: null, label: "Creator unknown — track record unavailable" };
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, components: c, flags, creator };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  setCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("X-HumbleTrust-Version", "2.0");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: "Service unavailable" });

  const { mint, nocache } = req.query;
  if (!mint) return res.status(400).json({ error: "mint required" });
  if (!isValidWallet(mint)) return res.status(400).json({ error: "invalid mint address" });

  const db = getClient();

  try {
    // 1. Check HumbleTrust DB first
    const { data: token } = await db.from("tokens").select("*").eq("mint", mint).single();

    if (token) {
      const score = token.trust_score || token.launch_score || 0;
      const mintInfo = await getMintInfo(mint, DEVNET_RPC);
      const onchain = mintInfo ? {
        mint_authority_revoked:   !mintInfo.mintAuthority,
        freeze_authority_revoked: !mintInfo.freezeAuthority,
        supply:   mintInfo.supply,
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
          certificate_mint:     token.certificate_mint,
          verified_issuer:      token.verified_issuer || false,
          verified_issuer_level: token.verified_issuer_level || 0,
        },
        breakdown: {
          lock_percent: token.lock_percent,
          burn_option:  token.burn_option,
          tier:         token.tier,
          trust_level:  token.trust_level,
        },
        onchain_verification: onchain,
        computed_at: new Date().toISOString(),
      });
    }

    // 2. Not in HumbleTrust — check cache (skip with ?nocache=1)
    if (!nocache) {
      const { data: cached } = await db
        .from("token_score_cache")
        .select("*")
        .eq("mint", mint)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (cached) {
        return res.json({
          mint,
          score:       cached.score,
          trust_level: cached.trust_level,
          source: "external_cached",
          breakdown:   cached.score_components,
          flags:       cached.score_components?.flags || [],
          creator:     cached.score_components?.creator || null,
          token: null,
          warning: "External token — score computed from on-chain data. Not in HumbleTrust registry.",
          computed_at:   cached.computed_at,
          cache_expires: cached.expires_at,
        });
      }
    }

    // 3. Fetch from chain — try mainnet first (pump.fun, etc.), then devnet
    let mintInfo = await getMintInfo(mint, MAINNET_RPC);
    let rpc      = MAINNET_RPC;
    let network  = "mainnet-beta";

    if (!mintInfo) {
      mintInfo = await getMintInfo(mint, DEVNET_RPC);
      rpc      = DEVNET_RPC;
      network  = mintInfo ? "devnet" : "unknown";
    }

    if (!mintInfo) {
      return res.status(404).json({ error: "Mint account not found on mainnet or devnet", mint });
    }

    const { score, components, flags, creator } = await scoreExternal(mint, mintInfo, rpc, db);
    const trust_level = getTrustLevel(score);

    // Cache result for 2 hours
    await db.from("token_score_cache").upsert({
      mint, score, trust_level, source: "external",
      score_components: { ...components, flags, creator, network },
      computed_at:  new Date().toISOString(),
      expires_at:   new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "mint" }).catch(() => {});

    return res.json({
      mint,
      score,
      trust_level,
      source: "external",
      network,
      creator,
      breakdown: components,
      flags,
      token: null,
      warning: "External token — score is based on on-chain data only. Not in HumbleTrust registry.",
      cta: "Launch on HumbleTrust to get a full TrustScore with lock verification, LP policy, and Certificate NFT.",
      computed_at: new Date().toISOString(),
    });

  } catch (e) {
    console.error("[api/score]", e.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

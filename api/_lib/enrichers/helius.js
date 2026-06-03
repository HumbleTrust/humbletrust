"use strict";

/**
 * Helius DAS API enricher
 * Docs: https://docs.helius.dev/das-api
 *
 * Uses the getAsset RPC method to fetch:
 *   - Token name, symbol, decimals, supply
 *   - Logo URI (from off-chain metadata)
 *   - Creator / mint authority info
 *   - Token standard (fungible / NFT)
 *
 * Uses the /v0/token-accounts endpoint to fetch holder count.
 *
 * Env: HELIUS_API_KEY  (falls back to no-key public endpoint with lower rate limit)
 */

const BASE = "https://mainnet.helius-rpc.com";

async function _rpc(apiKey, method, params, ms = 6000) {
  const url = apiKey ? `${BASE}/?api-key=${apiKey}` : BASE;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "ht-1", method, params }),
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const json = await r.json();
    return json?.result ?? null;
  } catch {
    clearTimeout(t);
    return null;
  }
}

async function _get(url, ms = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return r.json();
  } catch {
    clearTimeout(t);
    return null;
  }
}

/**
 * Fetch token asset metadata via Helius DAS getAsset.
 * Returns normalised object or null on failure.
 */
async function fetchHeliusAsset(mint) {
  const apiKey = process.env.HELIUS_API_KEY || null;
  const result = await _rpc(apiKey, "getAsset", { id: mint });
  if (!result) return null;

  // content.metadata is the on-chain / off-chain merged object
  const meta    = result.content?.metadata ?? {};
  const files   = result.content?.files ?? [];
  const links   = result.content?.links ?? {};
  const token   = result.token_info ?? {};
  const supply  = token.supply != null ? Number(token.supply) : null;
  const decimals = token.decimals != null ? Number(token.decimals) : null;

  // Logo: prefer CDN URI from files array, fall back to links.image
  let logo_uri = null;
  for (const f of files) {
    if (f.cdn_uri) { logo_uri = f.cdn_uri; break; }
    if (f.uri)     { logo_uri = f.uri;     break; }
  }
  if (!logo_uri && links.image) logo_uri = links.image;

  // Creator = first verified creator in creators array
  const creators  = result.creators ?? [];
  const creator   = creators.find(c => c.verified) ?? creators[0] ?? null;

  // Authorities
  const authorities = result.authorities ?? [];
  const mintAuth    = authorities.find(a => a.scopes?.includes("mint"))?.address ?? null;
  const freezeAuth  = authorities.find(a => a.scopes?.includes("freeze"))?.address ?? null;

  return {
    name:         meta.name       || token.name       || null,
    symbol:       meta.symbol     || token.symbol     || null,
    decimals,
    total_supply: supply != null && decimals != null
                    ? supply / Math.pow(10, decimals)
                    : null,
    logo_uri,
    creator_address:  creator?.address  ?? null,
    creator_verified: creator?.verified ?? false,
    mint_authority:   mintAuth,
    freeze_authority: freezeAuth,
    token_standard:   result.interface ?? null,   // "FungibleToken" | "FungibleAsset" | "NonFungibleToken" …
    is_compressed:    result.compression?.compressed ?? false,
    source: "helius",
  };
}

/**
 * Fetch holder count for a token via Helius Token API.
 * Uses the /v0/token-accounts page approach — counts distinct owners.
 * Stops after 2 pages (200 holders) to stay within rate limits;
 * returns the count with a `capped` flag when truncated.
 */
async function fetchHeliusHolderCount(mint) {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return null;            // endpoint requires API key

  const PAGE_SIZE = 1000;
  let cursor = undefined;
  let total  = 0;
  let pages  = 0;
  const MAX_PAGES = 3;

  while (pages < MAX_PAGES) {
    const body = {
      jsonrpc: "2.0",
      id: "ht-holders",
      method: "getTokenAccounts",
      params: {
        mint,
        limit: PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
        options: { showZeroBalance: false },
      },
    };
    const url = `${BASE}/?api-key=${apiKey}`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    let result = null;
    try {
      const r = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      clearTimeout(t);
      if (!r.ok) break;
      const json = await r.json();
      result = json?.result;
    } catch { clearTimeout(t); break; }

    if (!result) break;

    const accounts = result.token_accounts ?? [];
    total  += accounts.length;
    pages  += 1;
    cursor  = result.cursor ?? null;

    if (!cursor || accounts.length < PAGE_SIZE) break;   // last page
  }

  return {
    holder_count: total,
    holder_count_capped: pages >= MAX_PAGES,
    source: "helius",
  };
}

module.exports = { fetchHeliusAsset, fetchHeliusHolderCount };

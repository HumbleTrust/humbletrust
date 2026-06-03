"use strict";

async function _fetch(url, ms = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    if (!r.ok) return null;
    return r.json();
  } catch { clearTimeout(t); return null; }
}

async function fetchDexScreener(mint) {
  const json = await _fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
  if (!json?.pairs?.length) return null;

  const pairs = json.pairs.filter(p => p.chainId === 'solana');
  if (!pairs.length) return null;

  pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  const best = pairs[0];

  return {
    dex:              best.dexId || null,
    pair_address:     best.pairAddress || null,
    price_usd:        best.priceUsd ? parseFloat(best.priceUsd) : null,
    price_change_5m:  best.priceChange?.m5  ?? null,
    price_change_1h:  best.priceChange?.h1  ?? null,
    price_change_6h:  best.priceChange?.h6  ?? null,
    price_change_24h: best.priceChange?.h24 ?? null,
    liquidity_usd:    best.liquidity?.usd   ?? null,
    market_cap_usd:   best.marketCap        ?? null,
    fdv_usd:          best.fdv              ?? null,
    volume_24h:       best.volume?.h24      ?? null,
    pair_created_at:  best.pairCreatedAt    ?? null,
    total_pairs:      pairs.length,
    source: 'dexscreener',
  };
}

module.exports = { fetchDexScreener };

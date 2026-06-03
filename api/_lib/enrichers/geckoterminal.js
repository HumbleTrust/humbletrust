"use strict";

// GeckoTerminal enricher — no API key needed, 30 req/min free
async function getGeckoTerminalToken(mint) {
  const url = `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timer);
    if (!r.ok) return null;
    const json = await r.json();
    const attr = json?.data?.attributes;
    if (!attr) return null;
    return {
      name: attr.name,
      symbol: attr.symbol,
      decimals: attr.decimals,
      logoUri: attr.image_url,
      priceUsd: attr.price_usd ? parseFloat(attr.price_usd) : null,
      marketCapUsd: attr.market_cap_usd ? parseFloat(attr.market_cap_usd) : null,
      fdvUsd: attr.fdv_usd ? parseFloat(attr.fdv_usd) : null,
      liquidityUsd: attr.total_reserve_in_usd ? parseFloat(attr.total_reserve_in_usd) : null,
      priceChange24h: attr.price_change_percentage?.h24 ? parseFloat(attr.price_change_percentage.h24) : null,
      volumeUsd24h: attr.volume_usd?.h24 ? parseFloat(attr.volume_usd.h24) : null,
      holderCount: attr.holders ? parseInt(attr.holders) : null,
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

module.exports = { getGeckoTerminalToken };

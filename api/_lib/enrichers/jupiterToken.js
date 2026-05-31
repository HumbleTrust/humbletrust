"use strict";

async function _fetch(url, ms = 4000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    if (!r.ok) return null;
    return r.json();
  } catch { clearTimeout(t); return null; }
}

// Jupiter verified token list (strict) — returns token if verified, null if not
async function fetchJupiterToken(mint) {
  const json = await _fetch(`https://tokens.jup.ag/token/${mint}`);
  if (!json?.address) return null;

  return {
    name:       json.name       || null,
    symbol:     json.symbol     || null,
    logo_uri:   json.logoURI    || null,
    decimals:   json.decimals   ?? null,
    tags:       Array.isArray(json.tags) ? json.tags : [],
    website:    json.extensions?.website  || null,
    twitter:    json.extensions?.twitter  || null,
    coingecko:  json.extensions?.coingeckoId || null,
    verified:   Array.isArray(json.tags) && (json.tags.includes('verified') || json.tags.includes('community')),
    strict:     Array.isArray(json.tags) && json.tags.includes('verified'),
    source: 'jupiter_token',
  };
}

module.exports = { fetchJupiterToken };

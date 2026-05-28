async function _fetch(url, ms = 4000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return r.json();
  } catch { clearTimeout(t); return null; }
}

async function fetchJupiterPrice(mint) {
  const json = await _fetch(`https://api.jup.ag/price/v2?ids=${mint}`);
  const data = json?.data?.[mint];
  if (!data) return null;
  return {
    price_usd: data.price ? parseFloat(data.price) : null,
    has_price: !!data.price,
  };
}

// Fetch extra market context: 24h price change + pool age
// Uses Birdeye free API (no key needed for basic token overview)
async function fetchMarketContext(mint) {
  try {
    const json = await _fetch(
      `https://public-api.birdeye.so/public/token_overview?address=${mint}`,
      5000
    );
    if (!json?.data) return null;
    const d = json.data;
    return {
      price_change_24h:  typeof d.priceChange24hPercent === 'number' ? d.priceChange24hPercent : null,
      liquidity_usd:     typeof d.liquidity === 'number' ? d.liquidity : null,
      volume_24h_usd:    typeof d.v24hUSD === 'number' ? d.v24hUSD : null,
      // Birdeye doesn't expose pool creation time directly
    };
  } catch { return null; }
}

module.exports = { fetchJupiterPrice, fetchMarketContext };

async function fetchJupiterPrice(mint) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${mint}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data?.[mint];
    if (!data) return null;
    return {
      price_usd: data.price ? parseFloat(data.price) : null,
      has_price: !!data.price,
    };
  } catch {
    return null;
  }
}

module.exports = { fetchJupiterPrice };

const { setCors } = require("./_lib/validate");

const PUMP_URL =
  "https://frontend-api.pump.fun/coins?offset=0&limit=48&sort=created_timestamp&order=DESC&includeNsfw=false";

const DEX_PROFILES_URL =
  "https://api.dexscreener.com/token-profiles/latest/v1";

const DEX_TOKENS_URL = (addresses) =>
  `https://api.dexscreener.com/latest/dex/tokens/${addresses}`;

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const source = req.query?.source ?? "pump";

  try {
    if (source === "pump") {
      const r = await fetch(PUMP_URL, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return res.status(502).json({ error: `pump.fun ${r.status}` });
      const coins = await r.json();
      const items = (Array.isArray(coins) ? coins : []).map((c) => ({
        address:    c.mint,
        name:       c.name,
        symbol:     c.symbol,
        image:      c.image_uri,
        price_usd:  c.usd_market_cap > 0 && c.total_supply > 0
                      ? c.usd_market_cap / c.total_supply : 0,
        market_cap: c.usd_market_cap ?? 0,
        created_at: c.created_timestamp,
        complete:   c.complete ?? false,
        source:     "pump",
      }));
      return res.json({ source: "pump", items });

    } else if (source === "dex") {
      // 1. Fetch latest token profiles
      const profR = await fetch(DEX_PROFILES_URL, {
        signal: AbortSignal.timeout(8000),
      });
      if (!profR.ok) return res.status(502).json({ error: `DexScreener profiles ${profR.status}` });
      const profiles = await profR.json();

      // 2. Filter Solana profiles (up to 20)
      const solProfiles = (Array.isArray(profiles) ? profiles : [])
        .filter((p) => p.chainId === "solana")
        .slice(0, 20);

      if (solProfiles.length === 0) return res.json({ source: "dex", items: [] });

      // 3. Fetch price data for those tokens
      const addresses = solProfiles.map((p) => p.tokenAddress).join(",");
      let priceMap = {};
      try {
        const priceR = await fetch(DEX_TOKENS_URL(addresses), {
          signal: AbortSignal.timeout(8000),
        });
        if (priceR.ok) {
          const priceData = await priceR.json();
          const pairs = priceData.pairs ?? [];
          for (const pair of pairs) {
            const addr = pair.baseToken?.address;
            if (addr && !priceMap[addr]) {
              priceMap[addr] = {
                price_usd:     parseFloat(pair.priceUsd ?? 0),
                change_24h:    pair.priceChange?.h24 ?? null,
                volume_24h:    pair.volume?.h24 ?? 0,
                liquidity_usd: pair.liquidity?.usd ?? 0,
                dex_url:       pair.url,
                dex_id:        pair.dexId,
              };
            }
          }
        }
      } catch { /* price fetch is best-effort */ }

      const items = solProfiles.map((p) => ({
        address:       p.tokenAddress,
        name:          p.description ?? p.tokenAddress.slice(0, 8) + "…",
        symbol:        "",
        image:         p.icon ?? "",
        header:        p.header ?? "",
        description:   p.description ?? "",
        links:         p.links ?? [],
        dex_url:       p.url,
        ...(priceMap[p.tokenAddress] ?? {}),
        source:        "dex",
      }));

      return res.json({ source: "dex", items });

    } else {
      return res.status(400).json({ error: "source must be pump or dex" });
    }
  } catch (e) {
    return res.status(500).json({ error: String(e.message ?? e) });
  }
};

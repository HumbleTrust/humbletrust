const { setCors } = require("./_lib/validate");

// ── source URLs ───────────────────────────────────────────────────────────────

const PUMP_URL =
  "https://frontend-api.pump.fun/coins?offset=0&limit=48&sort=created_timestamp&order=DESC&includeNsfw=false";

const PUMPSWAP_URL =
  "https://frontend-api.pump.fun/coins?offset=0&limit=48&sort=created_timestamp&order=DESC&includeNsfw=false&complete=true";

const DEX_PROFILES_URL   = "https://api.dexscreener.com/token-profiles/latest/v1";
const DEX_TOKENS_URL = (a) => `https://api.dexscreener.com/latest/dex/tokens/${a}`;

// Raydium v3 — newest pools across all pool types
const RAYDIUM_URL =
  "https://api-v3.raydium.io/pools/info/list?poolType=all&poolSortField=default&sortType=desc&pageSize=24&page=1";

// Meteora DLMM — newest pairs sorted by creation
const METEORA_URL =
  "https://dlmm-api.meteora.ag/pair/all_with_pagination?page=0&limit=24&sort_key=createdAt&order_by=desc";

// Orca Whirlpools — full list, we take first 24 (most recently created appear last; sorted by TVL by default)
const ORCA_URL =
  "https://api.mainnet.orca.so/v1/whirlpool/list";

// ── normalizers ───────────────────────────────────────────────────────────────

const norm = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// ── handler ───────────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const source = req.query?.source ?? "pump";

  try {
    /* ── PUMP.FUN ──────────────────────────────────────────────────────────── */
    if (source === "pump" || source === "pumpswap") {
      const url = source === "pumpswap" ? PUMPSWAP_URL : PUMP_URL;
      const r = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Referer": "https://pump.fun/",
          "Origin": "https://pump.fun",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return res.status(502).json({ error: `pump.fun ${r.status}` });
      const raw = await r.json();
      const coins = Array.isArray(raw) ? raw : (raw.data ?? raw.tokens ?? raw.coins ?? []);
      const items = (Array.isArray(coins) ? coins : []).map((c) => norm({
        address:    c.mint,
        name:       c.name,
        symbol:     c.symbol,
        image:      c.image_uri,
        price_usd:  c.usd_market_cap > 0 && c.total_supply > 0
                      ? c.usd_market_cap / c.total_supply : 0,
        market_cap: c.usd_market_cap ?? 0,
        created_at: c.created_timestamp,
        complete:   c.complete ?? false,
        dex_url:    `https://pump.fun/${c.mint}`,
        source,
      }));
      return res.json({ source, items });

    /* ── DEXSCREENER ───────────────────────────────────────────────────────── */
    } else if (source === "dex") {
      const profR = await fetch(DEX_PROFILES_URL, { signal: AbortSignal.timeout(8000) });
      if (!profR.ok) return res.status(502).json({ error: `DexScreener ${profR.status}` });
      const profiles = await profR.json();

      const solProfiles = (Array.isArray(profiles) ? profiles : [])
        .filter((p) => p.chainId === "solana")
        .slice(0, 20);

      if (solProfiles.length === 0) return res.json({ source: "dex", items: [] });

      const addresses = solProfiles.map((p) => p.tokenAddress).join(",");
      let priceMap = {};
      try {
        const priceR = await fetch(DEX_TOKENS_URL(addresses), { signal: AbortSignal.timeout(8000) });
        if (priceR.ok) {
          const { pairs = [] } = await priceR.json();
          for (const pair of pairs) {
            const addr = pair.baseToken?.address;
            if (addr && !priceMap[addr]) {
              priceMap[addr] = {
                price_usd:     parseFloat(pair.priceUsd ?? 0),
                change_24h:    pair.priceChange?.h24 ?? null,
                volume_24h:    pair.volume?.h24 ?? 0,
                liquidity_usd: pair.liquidity?.usd ?? 0,
                dex_url:       pair.url,
              };
            }
          }
        }
      } catch { /* best-effort */ }

      const items = solProfiles.map((p) => norm({
        address:     p.tokenAddress,
        name:        p.description ?? p.tokenAddress.slice(0, 8) + "…",
        symbol:      "",
        image:       p.icon ?? "",
        description: p.description ?? "",
        links:       p.links ?? [],
        dex_url:     p.url,
        ...(priceMap[p.tokenAddress] ?? {}),
        source:      "dex",
      }));
      return res.json({ source: "dex", items });

    /* ── RAYDIUM ───────────────────────────────────────────────────────────── */
    } else if (source === "raydium") {
      const r = await fetch(RAYDIUM_URL, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return res.status(502).json({ error: `Raydium ${r.status}` });
      const json = await r.json();
      const pools = json.data?.data ?? [];
      const items = pools.map((p) => norm({
        address:       p.id,
        token_mint:    p.mintA?.address ?? undefined,
        name:          `${p.mintA?.symbol ?? "?"} / ${p.mintB?.symbol ?? "?"}`,
        symbol:        p.mintA?.symbol ?? "",
        image:         p.mintA?.logoURI ?? "",
        price_usd:     parseFloat(p.price ?? 0),
        volume_24h:    p.day?.volume ?? 0,
        liquidity_usd: p.tvl ?? 0,
        change_24h:    p.day?.priceMin != null && p.price
                         ? ((parseFloat(p.price) / p.day.priceMin - 1) * 100) : null,
        dex_url:       `https://raydium.io/liquidity/increase/?mode=add&pool_id=${p.id}`,
        source:        "raydium",
      }));
      return res.json({ source: "raydium", items });

    /* ── METEORA ───────────────────────────────────────────────────────────── */
    } else if (source === "meteora") {
      const r = await fetch(METEORA_URL, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return res.status(502).json({ error: `Meteora ${r.status}` });
      const json = await r.json();
      const pairs = json.data ?? json.pairs ?? (Array.isArray(json) ? json : []);
      const items = pairs.slice(0, 24).map((p) => norm({
        address:       p.address,
        token_mint:    p.mint_x ?? undefined,
        name:          p.name ?? `${p.mint_x?.slice(0,4)}…/${p.mint_y?.slice(0,4)}…`,
        symbol:        "",
        image:         "",
        liquidity_usd: parseFloat(p.liquidity ?? 0),
        volume_24h:    parseFloat(p.trade_volume_24h ?? 0),
        fee_24h:       parseFloat(p.fees_24h ?? 0),
        dex_url:       `https://app.meteora.ag/dlmm/${p.address}`,
        source:        "meteora",
      }));
      return res.json({ source: "meteora", items });

    /* ── ORCA ──────────────────────────────────────────────────────────────── */
    } else if (source === "orca") {
      const r = await fetch(ORCA_URL, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return res.status(502).json({ error: `Orca ${r.status}` });
      const json = await r.json();
      const pools = (json.whirlpools ?? json.data ?? []).slice(0, 24);
      const items = pools.map((p) => norm({
        address:       p.address,
        token_mint:    p.tokenA?.mint ?? undefined,
        name:          `${p.tokenA?.symbol ?? "?"} / ${p.tokenB?.symbol ?? "?"}`,
        symbol:        p.tokenA?.symbol ?? "",
        image:         p.tokenA?.logoURI ?? "",
        price_usd:     parseFloat(p.price ?? 0),
        liquidity_usd: parseFloat(p.tvl ?? 0),
        volume_24h:    parseFloat(p.volume?.day ?? 0),
        fee_24h:       parseFloat(p.feeApr?.day ?? 0),
        dex_url:       `https://www.orca.so/liquidity/browse?tokenMint=${p.tokenA?.mint}`,
        source:        "orca",
      }));
      return res.json({ source: "orca", items });

    } else {
      return res.status(400).json({ error: "source must be: pump, pumpswap, dex, raydium, meteora, orca" });
    }

  } catch (e) {
    return res.status(500).json({ error: String(e.message ?? e) });
  }
};

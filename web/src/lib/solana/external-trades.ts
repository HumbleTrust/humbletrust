import type { ApiTrade } from "./api";

export type TokenSource = "humbletrust" | "pumpfun" | "mainnet" | "unknown";
export type TokenNetwork = "devnet" | "mainnet-beta";

export interface TokenInfo {
  mint: string;
  name: string;
  symbol: string;
  logoUri?: string;
  source: TokenSource;
  network: TokenNetwork;
  decimals: number;
  // pump.fun virtual reserves (converted: SOL and token units)
  virtualSolReserves?: number;
  virtualTokenReserves?: number;
  complete?: boolean;
  // DexScreener data
  priceUsd?: string;
  dexPairAddress?: string; // pair address for DexScreener chart embed
}

const PUMPFUN_BASE = "https://frontend-api.pump.fun";
const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex/tokens";

async function fetchJson(url: string, ms = 6000): Promise<any> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

export async function detectToken(mint: string): Promise<TokenInfo | null> {
  // Run pump.fun and DexScreener in parallel — use both results
  const [pf, ds] = await Promise.all([
    fetchJson(`${PUMPFUN_BASE}/coins/${mint}`),
    fetchJson(`${DEXSCREENER_BASE}/${mint}`),
  ]);

  const dsPair = ds?.pairs?.[0];

  // 1. pump.fun — bonding curve or graduated token
  if (pf?.mint) {
    return {
      mint,
      name: pf.name || "Unknown",
      symbol: pf.symbol || "???",
      logoUri: pf.image_uri || undefined,
      source: "pumpfun",
      network: "mainnet-beta",
      decimals: 6,
      virtualSolReserves: pf.virtual_sol_reserves ? pf.virtual_sol_reserves / 1e9 : undefined,
      virtualTokenReserves: pf.virtual_token_reserves ? pf.virtual_token_reserves / 1e6 : undefined,
      complete: !!pf.complete,
      priceUsd: dsPair?.priceUsd,
      dexPairAddress: dsPair?.pairAddress,
    };
  }

  // 2. DexScreener — Raydium, Orca, and all other Solana DEXes
  if (dsPair?.baseToken?.symbol) {
    // Prefer decimals from Jupiter token list; DexScreener doesn't expose decimals
    // so we look it up from Helius/Jupiter API, falling back to 9 for SPL tokens
    let decimals = 9;
    const jupMeta = await fetchJson(`https://tokens.jup.ag/token/${mint}`, 4000);
    if (typeof jupMeta?.decimals === "number") decimals = jupMeta.decimals;

    return {
      mint,
      name: dsPair.baseToken.name || "Unknown",
      symbol: dsPair.baseToken.symbol || "???",
      logoUri: dsPair.info?.imageUrl || jupMeta?.logoURI || undefined,
      source: "mainnet",
      network: "mainnet-beta",
      decimals,
      priceUsd: dsPair.priceUsd,
      dexPairAddress: dsPair.pairAddress,
    };
  }

  return null;
}

export async function fetchPumpFunTrades(mint: string, limit = 200): Promise<ApiTrade[]> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(
      `${PUMPFUN_BASE}/trades/${mint}?limit=${limit}&offset=0&minimumSize=0`,
      { signal: ctrl.signal, cache: "no-store" }
    );
    if (!r.ok) throw new Error(`pump.fun trades: ${r.status}`);
    const data: any[] = await r.json();
    return data
      .filter(t => t.sol_amount > 0)
      .map(t => {
        const solAmount = t.sol_amount / 1e9;
        const tokenAmount = t.token_amount / 1e6;
        return {
          signature: t.signature || t.tx || String(t.timestamp),
          trader: t.user || "",
          side: t.is_buy ? "buy" : "sell",
          source: "raydium", // stand-in for external
          token_amount: tokenAmount,
          sol_amount: solAmount,
          price_sol: tokenAmount > 0 ? solAmount / tokenAmount : 0,
          block_time: new Date((t.timestamp || 0) * 1000).toISOString(),
        } satisfies ApiTrade;
      });
  } finally {
    clearTimeout(id);
  }
}

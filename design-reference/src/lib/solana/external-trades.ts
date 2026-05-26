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
  // DexScreener price for display
  priceUsd?: string;
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
  // 1. pump.fun API — fastest and most common for Solana memecoins
  const pf = await fetchJson(`${PUMPFUN_BASE}/coins/${mint}`);
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
    };
  }

  // 2. DexScreener — covers Raydium, Orca, and most other Solana DEXes
  const ds = await fetchJson(`${DEXSCREENER_BASE}/${mint}`);
  const pair = ds?.pairs?.[0];
  if (pair?.baseToken?.symbol) {
    return {
      mint,
      name: pair.baseToken.name || "Unknown",
      symbol: pair.baseToken.symbol || "???",
      logoUri: pair.info?.imageUrl || undefined,
      source: "mainnet",
      network: "mainnet-beta",
      decimals: 9,
      priceUsd: pair.priceUsd,
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

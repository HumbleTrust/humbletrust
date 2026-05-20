import { API_BASE_URL } from "./constants";

export interface ApiToken {
  mint: string;
  creator: string;
  name?: string | null;
  symbol?: string | null;
  status: "curve" | "instant_pool" | "migrated";
  raydium_pool?: string | null;
  trust_score: number;
  launch_score: number;
  creator_reputation: number;
  market_health: number;
  community_risk: number;
  volume_sol: string | number;
  liquidity_sol: string | number;
  trades_count: number;
  created_at: string;
  lock_percent?: number | null;
  creator_percent?: number | null;
  curve_liquidity_percent?: number | null;
  circulation_percent?: number | null;
  airdrop_percent?: number | null;
  burn_option?: number | null;
  certificate_mint?: string | null;
}

export interface ApiTrade {
  signature: string;
  trader: string;
  side: "buy" | "sell" | "raydium";
  source: "curve" | "raydium";
  token_amount: string | number;
  sol_amount: string | number;
  price_sol: string | number;
  block_time: string;
}

export interface ApiCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volumeSol?: number;
}

const request = async <T>(path: string): Promise<T> => {
  if (!API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL is not configured");
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6_000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { signal: controller.signal });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<T>;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("backend request timed out");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

export const getTokens = (limit = 100) =>
  request<{ tokens: ApiToken[] }>(`/tokens?limit=${limit}`);

export const getToken = (mint: string) =>
  request<{ token: ApiToken }>(`/tokens/${mint}`);

export const getTokenTrades = (mint: string, limit = 100) =>
  request<{ trades: ApiTrade[] }>(`/tokens/${mint}/trades?limit=${limit}`);

export const getTokenOhlcv = (mint: string, timeframe: string, limit = 500) =>
  request<{ candles: ApiCandle[]; timeframe: string }>(
    `/tokens/${mint}/ohlcv?tf=${encodeURIComponent(timeframe)}&limit=${limit}`
  );

export const chartWsUrl = (mint: string, timeframe: string) => {
  if (!API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL is not configured");
  }
  const base = new URL(API_BASE_URL);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = `/chart/${mint}`;
  base.searchParams.set("tf", timeframe);
  return base.toString();
};

import { API_BASE_URL } from "./constants";

// When VITE_API_BASE_URL is not set, use relative /api path (Vercel serverless functions)
const API_BASE = API_BASE_URL || "/api";

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
  logo_uri?: string | null;
  description?: string | null;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
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
  const controller = new AbortController();
  const ms = path.includes("/ohlcv") ? 12_000 : 8_000;
  const timeout = window.setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(`${API_BASE}${path}`, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<T>;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(`Request timed out after ${ms / 1000}s — backend may be starting up`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};

const readJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  let body: any = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(text.slice(0, 180));
    }
  }
  if (!response.ok) {
    throw new Error(body?.error || `HTTP ${response.status}`);
  }
  return body as T;
};

export const registerToken = (data: {
  mint: string;
  creator: string;
  name: string;
  symbol: string;
  signature: string;
  launchScore: number;
  lockPercent: number;
  burnOption: number;
  certificateMint?: string | null;
  tier?: number;
  logoUri?: string | null;
  description?: string | null;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
}) =>
  fetch(`${API_BASE}/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => readJson<{ ok?: boolean; error?: string }>(r));

export const getTokens = (limit = 100) =>
  request<{ tokens: ApiToken[] }>(`/tokens?limit=${limit}`);

export const getToken = (mint: string) =>
  request<{ token: ApiToken }>(`/tokens/${mint}`);

export const getTokenTrades = (mint: string, limit = 100) =>
  request<{ trades: ApiTrade[] }>(`/tokens/${mint}/trades?limit=${limit}`);

export const getTokenOhlcv = (mint: string, timeframe: string, limit = 500) =>
  request<{ candles: ApiCandle[]; timeframe: string }>(
    `/tokens/${mint}/trades?format=ohlcv&tf=${encodeURIComponent(timeframe)}&limit=${limit}`
  );

export const syncTokenTrades = (mint: string, limit = 100) =>
  fetch(`${API_BASE}/tokens/${mint}/trades?action=sync&limit=${limit}`, { method: "POST" })
    .then((r) => readJson<{ synced: number; total_sigs?: number; message?: string; error?: string }>(r))
    .catch(e => ({ synced: 0, error: e.message }));

export const recordTrade = (
  mint: string,
  data: {
    signature: string;
    trader: string;
    side: "buy" | "sell";
    source?: "curve" | "raydium";
    token_amount: number;
    sol_amount: number;
    price_sol: number;
    block_time?: string;
  }
) =>
  fetch(`${API_BASE}/tokens/${mint}/trades`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
    .then((r) => readJson<{ ok?: boolean; error?: string }>(r))
    .catch((e) => ({ error: e.message }));

export const chartWsUrl = (mint: string, timeframe: string) => {
  if (API_BASE_URL) {
    const base = new URL(API_BASE_URL);
    base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    base.pathname = `/chart/${mint}`;
    base.searchParams.set("tf", timeframe);
    return base.toString();
  }
  // Vercel doesn't support WebSockets — return a URL that fails gracefully
  const proto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "localhost";
  return `${proto}//${host}/chart/${mint}?tf=${encodeURIComponent(timeframe)}`;
};

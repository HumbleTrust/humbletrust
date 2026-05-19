export type Timeframe = "1s" | "5s" | "1m" | "5m" | "1h";

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  "1s": 1,
  "5s": 5,
  "1m": 60,
  "5m": 300,
  "1h": 3600,
};

export interface Candle {
  type?: "candle";
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volumeSol?: number;
}

export interface IndexedTrade {
  signature: string;
  logIndex: number;
  mint: string;
  trader: string;
  side: "buy" | "sell" | "raydium";
  source: "curve" | "raydium";
  tokenAmount: number;
  solAmount: number;
  priceSol: number;
  feeLamports: number;
  slot?: number;
  blockTime: Date;
}

export interface TokenSummary {
  mint: string;
  creator: string;
  name?: string | null;
  symbol?: string | null;
  status: "curve" | "instant_pool" | "migrated";
  raydiumPool?: string | null;
  trustScore: number;
  launchScore: number;
  creatorReputation: number;
  marketHealth: number;
  communityRisk: number;
  volumeSol: number;
  liquiditySol: number;
  tradesCount: number;
  createdAt: string;
}

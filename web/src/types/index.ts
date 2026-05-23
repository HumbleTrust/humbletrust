export interface Project {
  id: string;
  mintAddress: string;
  name: string;
  symbol: string;
  description?: string;
  logoUrl?: string;
  creatorWallet: string;
  totalSupply: bigint | string;
  decimals: number;
  trustScore: number;
  liquidityLocked: boolean;
  lockDurationSeconds: number;
  lockUnlockAt?: string | null;
  vestingEnabled: boolean;
  creatorAllocationPct: number;
  mintRevoked: boolean;
  freezeRevoked: boolean;
  dex: string;
  status: string;
  totalInvestedSol: number;
  holderCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScoreBreakdown {
  liquidityPresent: number;
  lockDuration: number;
  mintRevoked: number;
  freezeRevoked: number;
  vestingEnabled: number;
  allocation: number;
  age: number;
}

export interface TrustScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
  label: string;
  color: string;
}

export type TrustScoreLabel =
  | "Verified"
  | "Safe"
  | "Moderate"
  | "Risky"
  | "Danger";

export type RiskFilter = "all" | "verified" | "safe" | "moderate" | "risky";

export type DashboardTab = "explore" | "launch" | "portfolio" | "analytics" | "market";

export type DexChoice = "raydium" | "orca";

export type ProjectStatus = "pending" | "live" | "locked" | "completed";

export type TrustScoreBreakdown = {
  liquidityPresent: number;
  lockDuration: number;
  mintRevoked: number;
  freezeRevoked: number;
  vestingEnabled: number;
  allocation: number;
  age: number;
};

export type TrustScoreResult = {
  score: number;
  breakdown: TrustScoreBreakdown;
};

export type ScoreBreakdownItem = {
  key: keyof TrustScoreBreakdown;
  label: string;
  points: number;
  maxPoints: number;
  description: string;
};

export type ChartPoint = {
  label: string;
  value: number;
};

export type Investment = {
  id: string;
  projectId: string;
  walletAddress: string;
  amountSol: number;
  tokenAmount: string;
  txSignature: string;
  createdAt: string;
};

export type TrustScoreHistory = {
  id: string;
  projectId: string;
  score: number;
  breakdown: TrustScoreBreakdown;
  reason: string;
  createdAt: string;
};

export type Project = {
  id: string;
  mintAddress: string;
  name: string;
  symbol: string;
  description: string;
  logoUrl?: string;
  creatorWallet: string;
  totalSupply: string;
  decimals: 6 | 9;
  trustScore: number;
  liquidityLocked: boolean;
  lockDurationSeconds: number;
  lockUnlockAt: string;
  vestingEnabled: boolean;
  creatorAllocationPct: number;
  mintRevoked: boolean;
  freezeRevoked: boolean;
  dex: DexChoice;
  vaultPda: string;
  programId: string;
  status: ProjectStatus;
  totalInvestedSol: number;
  holderCount: number;
  createdAt: string;
  updatedAt: string;
  sevenDayActivity: ChartPoint[];
  volume24h: number;
  price: number;
  change24h: number;
  goalSol: number;
  marketCap: number;
  circulatingSupply: string;
  investments: Investment[];
  scoreHistory: TrustScoreHistory[];
};

export type PlatformStats = {
  totalLockedSol: number;
  projectsLive: number;
  rugsPrevented: number;
  investorsProtected: number;
  volume24h: number;
};

export type PortfolioPosition = {
  project: Project;
  investedSol: number;
  currentValueSol: number;
  pnlPct: number;
};

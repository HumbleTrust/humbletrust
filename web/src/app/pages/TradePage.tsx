import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HexAvatar } from "../components/HexAvatar";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { withFallbackRpc } from "../../lib/solana/rpc";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  AlertTriangle,
  ArrowDown,
  Clock,
  ExternalLink,
  Lock,
  Maximize2,
  Minimize2,
  RefreshCw,
  Rocket,
  TrendingUp,
  Unlock,
  Zap,
} from "lucide-react";
import { getTokenTrades, recordTrade, syncTokenTrades, type ApiTrade } from "../../lib/solana/api";
import { detectToken, fetchPumpFunTrades, type TokenInfo } from "../../lib/solana/external-trades";
import { getJupiterQuote, executeJupiterSwap, SOL_MINT, type JupiterQuote } from "../../lib/solana/jupiter-swap";
import { LightweightTradeChart } from "../components/LightweightTradeChart";
import {
  PROGRAM_ID_V2_PK,
  buyOnCurveV2,
  claimLpFeesV2,
  fetchCreatorLockState,
  fetchLpLockState,
  fetchCurveTradeFromTransaction,
  fetchMigrationState,
  findLpLockV2Pda,
  findRaydiumCpmmPdas,
  findV2Pdas,
  getProgramV2,
  isProgramExecutable,
  lockLpTokensV2,
  migrateToRaydiumV2,
  prepareRaydiumMigrationV2,
  sellOnCurveV2,
  unlockLpTokensV2,
  unlockLockedTokensV2,
  useVestingTrancheV2,
  type CreatorLockState,
  type LpLockState,
  type MigrationState,
} from "../../lib/solana/program";
import { listTokens } from "../../lib/solana/image";
import { swapOnRaydiumCpmm, estimateCpmmSwap } from "../../lib/solana/raydium-cpmm-swap";
import { motion } from "motion/react";
import { GlassPanel } from "../components/GlassPanel";
import { cn } from "../components/ui/utils";

const PREVIEW_TOKEN_RESERVE = 350_000_000;
const PREVIEW_SOL_RESERVE = 0.5;
const CURVE_FEE_RATE = 0.01;

// Used when on-chain account exists (AlreadyMigrated error) but full decode fails
const MIGRATED_FALLBACK: import("../../lib/solana/program").MigrationState = {
  isMigrated: true, thresholdLamports: 0, currentSolLamports: 0,
  raydiumPool: "11111111111111111111111111111111", migratedAt: 0, progressPct: 100,
  isPrepared: false, migrationTokenAmount: 0, migrationWsolLamports: 0,
};

type TradeSide = "buy" | "sell";
type ChartMode = "candles" | "line" | "area";
type Timeframe = "1s" | "5s" | "1m" | "5m" | "1h";

export interface ChartIndicators {
  sma20: boolean;
  sma50: boolean;
  ema20: boolean;
  rsi: boolean;
}

interface WalletTokenOption {
  mint: string;
  balance: number;
  decimals: number;
  symbol: string;
  name: string;
  logo?: string;
}

const TIMEFRAMES: Timeframe[] = ["1s", "5s", "1m", "5m", "1h"];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parsePositive = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const formatCompact = (value: number, decimals = 2) => {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: decimals,
  }).format(value);
};

const shortAddress = (value: string) => `${value.slice(0, 4)}...${value.slice(-4)}`;

const formatTokenAmount = (value: number, decimals = 9) => {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return value
    .toLocaleString("en-US", {
      useGrouping: false,
      maximumFractionDigits: Math.min(decimals, 9),
    })
    .replace(/\.?0+$/, "") || "0";
};

const normalizeAmountInput = (value: string) => value.replace(",", ".").trim();
const isAmountInput = (value: string) => value === "" || /^\d*(\.\d*)?$/.test(value);

const friendlyError = (msg: string): string => {
  if (!msg) return "Unknown error";
  if (msg.includes("insufficient funds") || msg.includes("Insufficient funds")) return "Insufficient SOL balance for this trade";
  if (msg.includes("slippage") || msg.includes("Slippage")) return "Slippage exceeded — try increasing slippage tolerance";
  if (msg.includes("not deployed") || msg.includes("not executable")) return "Trading program is not deployed yet";
  if (msg.includes("User rejected") || msg.includes("rejected the request")) return "Transaction cancelled by user";
  if (msg.includes("blockhash") || msg.includes("BlockhashNotFound")) return "Transaction expired — please try again";
  if (msg.includes("0x1")) return "Insufficient token balance";
  if (msg.includes("AccountNotFound") || msg.includes("account not found")) return "Token account not found — make sure the mint address is correct";
  if (msg.includes("network") || msg.includes("fetch")) return "Network error — check your connection and try again";
  if (msg.includes("AlreadyMigrated") || msg.includes("6037")) return "This token has graduated to Raydium — use the Raydium swap link below to trade";
  return msg.length > 120 ? msg.slice(0, 120) + "…" : msg;
};

const formatPrice = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value < 0.000001) return value.toExponential(2);
  return value.toFixed(8);
};

const isRenderableTrade = (trade: ApiTrade) => {
  const price = Number(trade.price_sol);
  const sol = Number(trade.sol_amount);
  const tokens = Number(trade.token_amount);
  const time = new Date(trade.block_time).getTime();
  return (
    (trade.side === "buy" || trade.side === "sell") &&
    Number.isFinite(price) && price > 0 &&
    Number.isFinite(sol) && sol > 0 &&
    Number.isFinite(tokens) && tokens > 0 &&
    Number.isFinite(time)
  );
};

const estimateTokensOut = (solIn: number, solReserve: number, tokenReserve: number) => {
  if (solIn <= 0 || solReserve <= 0 || tokenReserve <= 0) return 0;
  const solAfterFee = solIn * (1 - CURVE_FEE_RATE);
  const k = solReserve * tokenReserve;
  return Math.max(0, tokenReserve - k / (solReserve + solAfterFee));
};

const estimatePriceAfter = (solIn: number, solReserve: number, tokenReserve: number) => {
  const solAfterFee = Math.max(0, solIn) * (1 - CURVE_FEE_RATE);
  const k = solReserve * tokenReserve;
  const nextSolReserve = solReserve + solAfterFee;
  return nextSolReserve / (k / nextSolReserve);
};

const estimateSolOut = (tokensIn: number, solReserve: number, tokenReserve: number) => {
  if (tokensIn <= 0 || solReserve <= 0 || tokenReserve <= 0) return 0;
  const k = solReserve * tokenReserve;
  return Math.max(0, solReserve - k / (tokenReserve + tokensIn)) * (1 - CURVE_FEE_RATE);
};

const toRawTokenAmount = (amount: string, decimals = 9) => {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return "0";
  const [whole, fraction = ""] = trimmed.split(".");
  return `${whole}${fraction.padEnd(decimals, "0").slice(0, decimals)}`.replace(/^0+(?=\d)/, "") || "0";
};

const rawTokenAmountFromUi = (amount: number, decimals = 9) =>
  toRawTokenAmount(formatTokenAmount(Math.max(0, amount), decimals), decimals);

const getConfirmedBlockTime = async (
  connection: import("@solana/web3.js").Connection,
  signature: string
): Promise<string> => {
  try {
    const tx = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (tx?.blockTime) return new Date(tx.blockTime * 1000).toISOString();
  } catch { /* fallback */ }
  return new Date().toISOString();
};

export const TradePage = ({ goDiscover, initialMint }: { goDiscover?: () => void; initialMint?: string }) => {
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const walletAddress = wallet.publicKey?.toBase58() ?? "";

  const [mintInput, setMintInput] = useState(initialMint ?? "");

  useEffect(() => {
    if (initialMint) setMintInput(initialMint);
  }, [initialMint]);
  const [side, setSide] = useState<TradeSide>("buy");
  const [solAmount, setSolAmount] = useState("0.1");
  const [tokensAmount, setTokensAmount] = useState("1000000");
  const [reserveSol, setReserveSol] = useState(String(PREVIEW_SOL_RESERVE));
  const [reserveTokens, setReserveTokens] = useState(String(PREVIEW_TOKEN_RESERVE));
  const [reserveSource, setReserveSource] = useState<"preview" | "chain">("preview");
  const [reservesBusy, setReservesBusy] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [busy, setBusy] = useState<TradeSide | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [v2Available, setV2Available] = useState<boolean | null>(null);
  const [walletTokens, setWalletTokens] = useState<WalletTokenOption[]>([]);
  const [tokenPickerOpen, setTokenPickerOpen] = useState(false);
  const [tokenPickerBusy, setTokenPickerBusy] = useState(false);
  const [tokenPickerError, setTokenPickerError] = useState<string | null>(null);
  const [slippageBps, setSlippageBps] = useState(100);
  const [walletSolBalance, setWalletSolBalance] = useState<number | null>(null);

  // chart controls
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [chartMode, setChartMode] = useState<ChartMode>("candles");
  const [showVolume, setShowVolume] = useState(true);
  const [showIndicators, setShowIndicators] = useState(false);
  const [fullChart, setFullChart] = useState(false);
  const [indicators, setIndicators] = useState<ChartIndicators>({ sma20: false, sma50: false, ema20: false, rsi: false });
  const toggleIndicator = (key: keyof ChartIndicators) =>
    setIndicators(prev => ({ ...prev, [key]: !prev[key] }));

  // chart data — built from trades only (no OHLCV endpoint required)
  const [chartTrades, setChartTrades] = useState<ApiTrade[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const chartAbortRef = useRef<AbortController | null>(null);
  const lastRaydiumSyncRef = useRef<string | null>(null);
  const chartDisplayTrades = useMemo(
    () => chartTrades.filter(isRenderableTrade),
    [chartTrades]
  );

  // External token detection (pump.fun / mainnet)
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenDetecting, setTokenDetecting] = useState(false);
  const [jupiterQuote, setJupiterQuote] = useState<JupiterQuote | null>(null);
  const [jupiterQuoting, setJupiterQuoting] = useState(false);
  const tokenInfoRef = useRef<TokenInfo | null>(null);

  // Raydium CPMM live estimate (after migration)
  const [cpmmEstimate, setCpmmEstimate] = useState<{ out: number; impact: number } | null>(null);

  // Migration state (devnet curve tokens only)
  const [migrationState, setMigrationState] = useState<MigrationState | null>(null);
  const [lpLockState, setLpLockState]       = useState<LpLockState | null>(null);
  const [migrationBusy, setMigrationBusy]   = useState(false);
  const [lpLockBusy, setLpLockBusy]         = useState(false);
  const [lpLockDays, setLpLockDays]         = useState("1");
  const [lpLockAmt, setLpLockAmt]           = useState("");
  const [migrationError, setMigrationError] = useState<string | null>(null);

  // Creator lock / vesting state
  const [creatorLockState, setCreatorLockState] = useState<CreatorLockState | null>(null);
  const [creatorLockBusy, setCreatorLockBusy]   = useState(false);
  const [creatorLockError, setCreatorLockError] = useState<string | null>(null);

  // Separate mainnet RPC connection for Jupiter swaps
  const mainnetConnection = useMemo(
    () => new Connection("https://api.mainnet-beta.solana.com", "confirmed"),
    []
  );

  // Declare validMint early so it can be used in useEffect deps below
  const validMint = useMemo(() => {
    const s = mintInput.trim();
    if (s.length < 32 || s.length > 44) return false;
    try { new PublicKey(s); return true; } catch { return false; }
  }, [mintInput]);

  const selectedMint = mintInput.trim();
  const canUseCurve = v2Available === true;
  const isMainnet = tokenInfo?.network === "mainnet-beta";

  useEffect(() => {
    let mounted = true;
    isProgramExecutable(connection, PROGRAM_ID_V2_PK)
      .then((available) => { if (mounted) setV2Available(available); })
      .catch(() => { if (mounted) setV2Available(false); });
    return () => { mounted = false; };
  }, [connection]);

  useEffect(() => {
    if (!wallet.publicKey) { setWalletSolBalance(null); return; }
    let mounted = true;
    connection.getBalance(wallet.publicKey)
      .then(l => { if (mounted) setWalletSolBalance(l / LAMPORTS_PER_SOL); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [wallet.publicKey, connection, txSig]);

  // Auto-load migration state when mint changes (devnet curve only)
  useEffect(() => {
    if (!validMint || !canUseCurve) { setMigrationState(null); setLpLockState(null); return; }
    void refreshMigrationState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validMint, mintInput, canUseCurve]);

  // Auto-load creator lock/vesting state when mint changes
  useEffect(() => {
    if (!validMint || !canUseCurve) { setCreatorLockState(null); return; }
    void refreshCreatorLockState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validMint, mintInput, canUseCurve]);


  // Keep ref in sync for use inside fetchChartTrades closure
  useEffect(() => { tokenInfoRef.current = tokenInfo; }, [tokenInfo]);

  // Auto-detect token source when a valid mint is entered
  useEffect(() => {
    if (!validMint) { setTokenInfo(null); setJupiterQuote(null); return; }
    const mint = mintInput.trim();
    let cancelled = false;
    setTokenDetecting(true);
    detectToken(mint)
      .then(info => { if (!cancelled) { setTokenInfo(info); setTokenDetecting(false); } })
      .catch(() => { if (!cancelled) { setTokenInfo(null); setTokenDetecting(false); } });
    return () => { cancelled = true; };
  }, [validMint, mintInput]);

  // Fetch Jupiter quote for mainnet tokens (debounced 700ms)
  useEffect(() => {
    if (tokenInfo?.network !== "mainnet-beta" || !validMint) {
      setJupiterQuote(null);
      return;
    }
    setJupiterQuote(null);
    const timer = setTimeout(async () => {
      setJupiterQuoting(true);
      try {
        if (side === "buy") {
          const lamports = Math.floor(parsePositive(solAmount, 0) * LAMPORTS_PER_SOL);
          if (lamports > 0) setJupiterQuote(await getJupiterQuote(SOL_MINT, mintInput.trim(), lamports, slippageBps));
        } else {
          const dec = tokenInfo.decimals;
          const units = Math.floor(parsePositive(tokensAmount, 0) * Math.pow(10, dec));
          if (units > 0) setJupiterQuote(await getJupiterQuote(mintInput.trim(), SOL_MINT, units, slippageBps));
        }
      } catch { setJupiterQuote(null); }
      setJupiterQuoting(false);
    }, 700);
    return () => clearTimeout(timer);
  }, [tokenInfo, side, solAmount, tokensAmount, mintInput, slippageBps, validMint]);

  // Live Raydium CPMM estimate (debounced 500ms) — only after migration
  useEffect(() => {
    const isMigrated = !!(migrationState?.isMigrated) && tokenInfo?.network !== "mainnet-beta";
    if (!isMigrated || !validMint) { setCpmmEstimate(null); return; }
    const timer = setTimeout(async () => {
      try {
        const mint = new PublicKey(mintInput.trim());
        const isBuy = side === "buy";
        const amt   = isBuy ? parsePositive(solAmount, 0) : parsePositive(tokensAmount, 0);
        if (amt <= 0) { setCpmmEstimate(null); return; }
        const { estimatedOut, priceImpactPct } = await estimateCpmmSwap(connection, mint, amt, isBuy);
        setCpmmEstimate({ out: estimatedOut, impact: priceImpactPct });
      } catch { setCpmmEstimate(null); }
    }, 500);
    return () => clearTimeout(timer);
  }, [migrationState?.isMigrated, tokenInfo?.network, validMint, side, solAmount, tokensAmount, mintInput, connection]);

  const solIn = useMemo(() => parsePositive(solAmount, 0), [solAmount]);
  const tokensIn = useMemo(() => parsePositive(tokensAmount, 0), [tokensAmount]);
  const previewSolReserve = useMemo(() => parsePositive(reserveSol, PREVIEW_SOL_RESERVE), [reserveSol]);
  const previewTokenReserve = useMemo(() => parsePositive(reserveTokens, PREVIEW_TOKEN_RESERVE), [reserveTokens]);
  const estimatedTokens = useMemo(() => estimateTokensOut(solIn, previewSolReserve, previewTokenReserve), [solIn, previewSolReserve, previewTokenReserve]);
  const estimatedSol = useMemo(() => estimateSolOut(tokensIn, previewSolReserve, previewTokenReserve), [tokensIn, previewSolReserve, previewTokenReserve]);
  const currentPrice = useMemo(() => previewSolReserve / previewTokenReserve, [previewSolReserve, previewTokenReserve]);
  const nextPrice = useMemo(() => estimatePriceAfter(solIn, previewSolReserve, previewTokenReserve), [solIn, previewSolReserve, previewTokenReserve]);
  const priceImpact = useMemo(() => currentPrice > 0 ? ((nextPrice - currentPrice) / currentPrice) * 100 : 0, [currentPrice, nextPrice]);
  const priceAfterSell = useMemo(() => {
    if (tokensIn <= 0 || previewSolReserve <= 0 || previewTokenReserve <= 0) return currentPrice;
    const k = previewSolReserve * previewTokenReserve;
    const nextToken = previewTokenReserve + tokensIn;
    return (k / nextToken) / nextToken;
  }, [tokensIn, previewSolReserve, previewTokenReserve, currentPrice]);
  const sellPriceImpact = useMemo(() =>
    currentPrice > 0 ? Math.abs((priceAfterSell - currentPrice) / currentPrice) * 100 : 0,
    [currentPrice, priceAfterSell]
  );

  // Show DexScreener embed for mainnet DEX tokens and graduated pump.fun tokens
  const showDexChart = !!(tokenInfo?.dexPairAddress && (tokenInfo.source === "mainnet" || tokenInfo.complete === true));
  const raydiumTradingActive = !isMainnet && !!migrationState?.isMigrated;
  const migrationPreparedOnly = !isMainnet && !!migrationState?.isPrepared && !migrationState?.isMigrated;
  const canTrade = wallet.connected && busy === null && validMint && (
    isMainnet ||
    raydiumTradingActive ||
    (canUseCurve && !migrationPreparedOnly)
  );
  const solscanUrl = validMint
    ? isMainnet
      ? `https://solscan.io/token/${selectedMint}`
      : `https://solscan.io/token/${selectedMint}?cluster=devnet`
    : null;
  const pumpFunUrl = tokenInfo?.source === "pumpfun" ? `https://pump.fun/coin/${selectedMint}` : null;
  const raydiumSwapUrl = validMint
    ? side === "buy"
      ? `https://raydium.io/swap/?inputMint=sol&outputMint=${selectedMint}`
      : `https://raydium.io/swap/?inputMint=${selectedMint}&outputMint=sol`
    : null;

  const savedTokenMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof listTokens>[number]>();
    listTokens().forEach((token) => map.set(token.mint, token));
    return map;
  }, [walletTokens]);

  const selectedWalletToken = walletTokens.find((t) => t.mint === selectedMint);
  const selectedDecimals = isMainnet ? (tokenInfo?.decimals ?? 6) : (selectedWalletToken?.decimals ?? 9);
  const selectedSymbol = tokenInfo?.symbol || selectedWalletToken?.symbol || savedTokenMap.get(selectedMint)?.symbol || "TOKEN";
  const sellBalanceExceeded = side === "sell" && !!selectedWalletToken && tokensIn > selectedWalletToken.balance;
  const sellBalanceMissing = !raydiumTradingActive && side === "sell" && wallet.connected && validMint && !tokenPickerBusy && !selectedWalletToken;
  const canSubmitTrade = raydiumTradingActive
    ? validMint && busy === null && (side === "buy" ? solIn > 0 : tokensIn > 0)
    : canTrade && (side === "buy"
      ? solIn > 0
      : isMainnet
        ? parsePositive(tokensAmount, 0) > 0
        : tokensIn > 0 && !!selectedWalletToken && !sellBalanceExceeded);

  const openRaydiumSwap = useCallback(() => {
    if (!raydiumSwapUrl) return;
    window.open(raydiumSwapUrl, "_blank", "noopener,noreferrer");
  }, [raydiumSwapUrl]);

  const loadWalletTokens = useCallback(async () => {
    if (!wallet.publicKey) { setWalletTokens([]); return; }
    setTokenPickerBusy(true);
    setTokenPickerError(null);
    try {
      const pk = wallet.publicKey;
      const parsed = await withFallbackRpc((conn) =>
        conn.getParsedTokenAccountsByOwner(pk, { programId: TOKEN_PROGRAM_ID }),
      );
      const byMint = new Map<string, WalletTokenOption>();
      parsed.value.forEach(({ account }) => {
        const info = (account.data as any).parsed?.info;
        const amountInfo = info?.tokenAmount;
        const mint = info?.mint as string | undefined;
        if (!mint || !amountInfo) return;
        const balance = Number(amountInfo.uiAmountString ?? amountInfo.uiAmount ?? 0);
        if (!Number.isFinite(balance) || balance <= 0) return;
        const saved = savedTokenMap.get(mint);
        const existing = byMint.get(mint);
        if (existing) { existing.balance += balance; }
        else { byMint.set(mint, { mint, balance, decimals: amountInfo.decimals ?? 9, symbol: saved?.symbol || shortAddress(mint), name: saved?.name || "Wallet token", logo: saved?.logo }); }
      });
      setWalletTokens([...byMint.values()].sort((a, b) => b.balance - a.balance));
    } catch (e: any) {
      setTokenPickerError(e.message || String(e));
    } finally {
      setTokenPickerBusy(false);
    }
  }, [wallet.publicKey, connection, savedTokenMap]);

  useEffect(() => {
    if (!wallet.connected || !wallet.publicKey) { setWalletTokens([]); return; }
    void loadWalletTokens();
  }, [walletAddress, wallet.connected, loadWalletTokens]);

  const fetchChartTrades = useCallback((mint: string, silent = false) => {
    if (!silent) { setChartLoading(true); setChartError(null); }
    const source = tokenInfoRef.current?.source;
    const fetcher: Promise<ApiTrade[]> = source === "pumpfun"
      ? fetchPumpFunTrades(mint)
      : getTokenTrades(mint, 500).then(r => r.trades ?? []);
    fetcher
      .then(trades => { setChartTrades(trades); setChartLoading(false); })
      .catch((err: Error) => { if (!silent) setChartError(err.message); setChartLoading(false); });
  }, []);

  const runSyncTrades = useCallback(async (mint: string) => {
    setSyncing(true);
    setSyncMsg(null);
    const result = await syncTokenTrades(mint, 100);
    setSyncing(false);
    if (result.error) {
      setSyncMsg(`Sync error: ${result.error}`);
    } else if (!result.synced) {
      setSyncMsg(result.message || "No new trades found on-chain");
    } else {
      setSyncMsg(`Synced ${result.synced} trade${result.synced !== 1 ? "s" : ""} from chain`);
      fetchChartTrades(mint);
    }
    setTimeout(() => setSyncMsg(null), 5000);
  }, [fetchChartTrades]);

  useEffect(() => {
    if (!validMint) { setChartTrades([]); setChartError(null); return; }
    const mint = mintInput.trim();
    fetchChartTrades(mint);
    const interval = setInterval(() => fetchChartTrades(mint, true), 30_000);
    return () => clearInterval(interval);
  }, [validMint, mintInput, fetchChartTrades]);

  useEffect(() => {
    if (!validMint || !migrationState?.isMigrated) return;
    const mint = mintInput.trim();
    if (lastRaydiumSyncRef.current === mint) return;
    lastRaydiumSyncRef.current = mint;
    void runSyncTrades(mint);
  }, [validMint, mintInput, migrationState?.isMigrated, runSyncTrades]);

  const refreshReserves = async (mintOverride?: string) => {
    const mintValue = (mintOverride ?? mintInput).trim();
    try { new PublicKey(mintValue); } catch { return; }
    if (!canUseCurve) { setReserveError("V2 curve program is not deployed on devnet yet."); return; }
    setReservesBusy(true);
    setReserveError(null);
    try {
      const mint = new PublicKey(mintValue);
      const pdas = findV2Pdas(mint);
      const [solLamports, tokenBalance] = await Promise.all([
        connection.getBalance(pdas.curveTreasurySol),
        connection.getTokenAccountBalance(pdas.curvePoolVault),
      ]);
      const solReserveLive = solLamports / LAMPORTS_PER_SOL;
      const tokenReserveLive = Number(tokenBalance.value.uiAmountString ?? tokenBalance.value.uiAmount ?? 0);
      if (!Number.isFinite(tokenReserveLive) || tokenReserveLive <= 0) {
        throw new Error("Curve token vault has no readable balance yet");
      }
      setReserveSol(solReserveLive.toFixed(6));
      setReserveTokens(tokenReserveLive.toFixed(6).replace(/\.?0+$/, ""));
      setReserveSource("chain");
    } catch (e: any) {
      setReserveError(e.message || String(e));
      setReserveSource("preview");
    } finally {
      setReservesBusy(false);
    }
  };

  const refreshMigrationState = useCallback(async (mintOverride?: string) => {
    const mintValue = (mintOverride ?? mintInput).trim();
    if (!canUseCurve || mintValue.length < 32) return;
    try {
      const mint = new PublicKey(mintValue);
      const [ms, ls] = await Promise.all([
        fetchMigrationState(connection, mint),
        fetchLpLockState(connection, mint),
      ]);
      setMigrationState(ms);
      setLpLockState(ls);
    } catch { /* silent */ }
  }, [mintInput, canUseCurve, connection]);

  const refreshCreatorLockState = useCallback(async (mintOverride?: string) => {
    const mintValue = (mintOverride ?? mintInput).trim();
    if (!canUseCurve || mintValue.length < 32) return;
    try {
      const cls = await fetchCreatorLockState(connection, new PublicKey(mintValue));
      setCreatorLockState(cls);
    } catch { /* silent */ }
  }, [mintInput, canUseCurve, connection]);

  const selectWalletToken = (token: WalletTokenOption) => {
    setMintInput(token.mint);
    setTokenPickerOpen(false);
    void refreshReserves(token.mint);
    void refreshMigrationState(token.mint);
  };

  const setMaxSellAmount = () => {
    if (!selectedWalletToken) return;
    setTokensAmount(formatTokenAmount(selectedWalletToken.balance, selectedDecimals));
  };

  const setFractionSol = (frac: number) => {
    const available = Math.max(0, (walletSolBalance ?? 0) - 0.005);
    setSolAmount(String(+(available * frac).toFixed(6)));
  };

  const runMainnetBuy = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setBusy("buy"); setTradeError(null); setTxSig(null);
    try {
      const lamports = Math.floor(parsePositive(solAmount, 0) * LAMPORTS_PER_SOL);
      if (lamports <= 0) throw new Error("Enter a valid SOL amount");
      const quote = jupiterQuote ?? await getJupiterQuote(SOL_MINT, selectedMint, lamports, slippageBps);
      const sig = await executeJupiterSwap(wallet, mainnetConnection, quote);
      setTxSig(sig);
      setTimeout(() => fetchChartTrades(selectedMint, true), 3000);
    } catch (e: any) {
      setTradeError(friendlyError(e.message || String(e)));
    } finally {
      setBusy(null);
    }
  };

  const runMainnetSell = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setBusy("sell"); setTradeError(null); setTxSig(null);
    try {
      const dec = tokenInfo?.decimals ?? 6;
      const units = Math.floor(parsePositive(tokensAmount, 0) * Math.pow(10, dec));
      if (units <= 0) throw new Error("Enter a valid token amount");
      const quote = jupiterQuote ?? await getJupiterQuote(selectedMint, SOL_MINT, units, slippageBps);
      const sig = await executeJupiterSwap(wallet, mainnetConnection, quote);
      setTxSig(sig);
      setTimeout(() => fetchChartTrades(selectedMint, true), 3000);
    } catch (e: any) {
      setTradeError(friendlyError(e.message || String(e)));
    } finally {
      setBusy(null);
    }
  };

  const runBuy = async () => {
    if (raydiumTradingActive) {
      // Direct Raydium CPMM swap — no redirect
      if (!wallet.publicKey || !wallet.signTransaction) return;
      setBusy("buy"); setTradeError(null); setTxSig(null);
      try {
        const mint = new PublicKey(mintInput.trim());
        const solAmt = parsePositive(solAmount, 0);
        if (solAmt <= 0) throw new Error("Enter a valid SOL amount");
        const result = await swapOnRaydiumCpmm(
          wallet, connection, mint, true, solAmt, slippageBps, selectedDecimals,
        );
        setTxSig(result.signature);
        await Promise.all([refreshReserves(), loadWalletTokens()]);
        setTimeout(() => fetchChartTrades(mintInput.trim(), true), 3000);
      } catch (e: any) {
        setTradeError(friendlyError(e.message || String(e)));
      } finally {
        setBusy(null);
      }
      return;
    }
    if (!anchorWallet || !wallet.connected) return;
    if (isMainnet) { return runMainnetBuy(); }
    setBusy("buy"); setTradeError(null); setTxSig(null);
    try {
      const deployed = await isProgramExecutable(connection, PROGRAM_ID_V2_PK);
      setV2Available(deployed);
      if (!deployed) throw new Error("V2 curve program is not deployed on devnet yet.");
      const mint = new PublicKey(mintInput.trim());
      const ata = getAssociatedTokenAddressSync(mint, anchorWallet.publicKey);
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program = getProgramV2(provider);
      const minTokensOut = rawTokenAmountFromUi(estimatedTokens * (1 - slippageBps / 10_000), selectedDecimals);
      const { signature } = await buyOnCurveV2(program, anchorWallet.publicKey, mint, ata, Number(solAmount), minTokensOut);
      setTxSig(signature);
      const blockTime = await getConfirmedBlockTime(connection, signature);
      const chainTrade = await fetchCurveTradeFromTransaction(connection, signature, mint, "buy");
      const indexedTrade = await recordTrade(mintInput.trim(), {
        signature,
        trader: chainTrade?.trader ?? anchorWallet.publicKey.toBase58(),
        side: chainTrade?.side ?? "buy",
        source: chainTrade?.source ?? "curve",
        token_amount: chainTrade?.token_amount ?? estimatedTokens,
        sol_amount: chainTrade?.sol_amount ?? solIn,
        price_sol: chainTrade?.price_sol ?? nextPrice,
        block_time: chainTrade?.block_time ?? blockTime,
      });
      if (indexedTrade?.error) {
        console.error("[recordTrade:buy]", indexedTrade.error);
        setChartError(`Trade saved on-chain, but chart history did not index: ${indexedTrade.error}`);
      } else {
        setChartError(null);
      }
      await Promise.all([
        refreshReserves(),
        loadWalletTokens(),
      ]);
      fetchChartTrades(mintInput.trim(), true);
    } catch (e: any) {
      const errMsg = e.message || String(e);
      if (errMsg.includes("AlreadyMigrated") || errMsg.includes("6037")) {
        setV2Available(true);
        try {
          const mint = new PublicKey(mintInput.trim());
          const [ms, ls] = await Promise.all([fetchMigrationState(connection, mint), fetchLpLockState(connection, mint)]);
          setMigrationState(ms ?? MIGRATED_FALLBACK);
          setLpLockState(ls);
        } catch {
          setMigrationState(MIGRATED_FALLBACK);
        }
      }
      setTradeError(friendlyError(errMsg));
    } finally {
      setBusy(null);
    }
  };

  const runSell = async () => {
    if (raydiumTradingActive) {
      // Direct Raydium CPMM swap — no redirect
      if (!wallet.publicKey || !wallet.signTransaction) return;
      setBusy("sell"); setTradeError(null); setTxSig(null);
      try {
        const mint = new PublicKey(mintInput.trim());
        const tokAmt = parsePositive(tokensAmount, 0);
        if (tokAmt <= 0) throw new Error("Enter a valid token amount");
        const result = await swapOnRaydiumCpmm(
          wallet, connection, mint, false, tokAmt, slippageBps, selectedDecimals,
        );
        setTxSig(result.signature);
        await Promise.all([refreshReserves(), loadWalletTokens()]);
        setTimeout(() => fetchChartTrades(mintInput.trim(), true), 3000);
      } catch (e: any) {
        setTradeError(friendlyError(e.message || String(e)));
      } finally {
        setBusy(null);
      }
      return;
    }
    if (!anchorWallet || !wallet.connected) return;
    if (isMainnet) { return runMainnetSell(); }
    setBusy("sell"); setTradeError(null); setTxSig(null);
    try {
      const deployed = await isProgramExecutable(connection, PROGRAM_ID_V2_PK);
      setV2Available(deployed);
      if (!deployed) throw new Error("V2 curve program is not deployed on devnet yet.");
      const mint = new PublicKey(mintInput.trim());
      const ata = getAssociatedTokenAddressSync(mint, anchorWallet.publicKey);
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program = getProgramV2(provider);
      const minSolOutLamports = Math.floor(estimatedSol * LAMPORTS_PER_SOL * (1 - slippageBps / 10_000)).toString();
      const { signature } = await sellOnCurveV2(
        program, anchorWallet.publicKey, mint, ata,
        toRawTokenAmount(tokensAmount, selectedDecimals), minSolOutLamports
      );
      setTxSig(signature);
      const blockTime = await getConfirmedBlockTime(connection, signature);
      const chainTrade = await fetchCurveTradeFromTransaction(connection, signature, mint, "sell");
      const indexedTrade = await recordTrade(mintInput.trim(), {
        signature,
        trader: chainTrade?.trader ?? anchorWallet.publicKey.toBase58(),
        side: chainTrade?.side ?? "sell",
        source: chainTrade?.source ?? "curve",
        token_amount: chainTrade?.token_amount ?? tokensIn,
        sol_amount: chainTrade?.sol_amount ?? estimatedSol,
        price_sol: chainTrade?.price_sol ?? priceAfterSell,
        block_time: chainTrade?.block_time ?? blockTime,
      });
      if (indexedTrade?.error) {
        console.error("[recordTrade:sell]", indexedTrade.error);
        setChartError(`Trade saved on-chain, but chart history did not index: ${indexedTrade.error}`);
      } else {
        setChartError(null);
      }
      await Promise.all([
        refreshReserves(),
        loadWalletTokens(),
      ]);
      fetchChartTrades(mintInput.trim(), true);
    } catch (e: any) {
      const errMsg = e.message || String(e);
      if (errMsg.includes("AlreadyMigrated") || errMsg.includes("6037")) {
        setV2Available(true);
        try {
          const mint = new PublicKey(mintInput.trim());
          const [ms, ls] = await Promise.all([fetchMigrationState(connection, mint), fetchLpLockState(connection, mint)]);
          setMigrationState(ms ?? MIGRATED_FALLBACK);
          setLpLockState(ls);
        } catch {
          setMigrationState(MIGRATED_FALLBACK);
        }
      }
      setTradeError(friendlyError(errMsg));
    } finally {
      setBusy(null);
    }
  };

  const runMigrate = async () => {
    if (!anchorWallet || !wallet.connected || !validMint) return;
    setMigrationBusy(true); setMigrationError(null);
    try {
      const mint = new PublicKey(mintInput.trim());
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program = getProgramV2(provider);
      if (!migrationState?.isPrepared) {
        const prepared = await prepareRaydiumMigrationV2(program, anchorWallet.publicKey, mint);
        setTxSig(prepared.signature);
      }
      const migrated = await migrateToRaydiumV2(program, anchorWallet.publicKey, mint);
      setTxSig(migrated.signature);
      await refreshMigrationState();
    } catch (e: any) {
      setMigrationError(friendlyError(e.message || String(e)));
    } finally {
      setMigrationBusy(false);
    }
  };

  const runLockLp = async () => {
    if (!anchorWallet || !wallet.connected || !validMint || !migrationState?.isMigrated) return;
    const lpMintStr = lpLockState?.lpMint ?? findRaydiumCpmmPdas(new PublicKey(mintInput.trim())).lpMint.toBase58();
    setLpLockBusy(true); setMigrationError(null);
    try {
      const mint  = new PublicKey(mintInput.trim());
      const lpMint = new PublicKey(lpMintStr);
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program  = getProgramV2(provider);
      const lpAmtRaw = Math.floor(Number(lpLockAmt) * 1e9);
      if (lpAmtRaw <= 0) throw new Error("Enter LP amount to lock");
      const days = Math.max(1, Math.floor(Number(lpLockDays)));
      const { signature } = await lockLpTokensV2(program, anchorWallet.publicKey, mint, lpMint, lpAmtRaw, days);
      setTxSig(signature);
      await refreshMigrationState();
    } catch (e: any) {
      setMigrationError(friendlyError(e.message || String(e)));
    } finally {
      setLpLockBusy(false);
    }
  };

  const runClaimLpFees = async () => {
    if (!anchorWallet || !wallet.connected || !validMint) return;
    setLpLockBusy(true); setMigrationError(null);
    try {
      const mint = new PublicKey(mintInput.trim());
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program  = getProgramV2(provider);
      const { signature } = await claimLpFeesV2(program, anchorWallet.publicKey, mint);
      setTxSig(signature);
      await refreshMigrationState();
    } catch (e: any) {
      setMigrationError(friendlyError(e.message || String(e)));
    } finally {
      setLpLockBusy(false);
    }
  };

  const runUnlockLp = async () => {
    if (!anchorWallet || !wallet.connected || !validMint || !lpLockState) return;
    setLpLockBusy(true); setMigrationError(null);
    try {
      const mint   = new PublicKey(mintInput.trim());
      const lpMint = new PublicKey(lpLockState.lpMint);
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program  = getProgramV2(provider);
      const { signature } = await unlockLpTokensV2(program, anchorWallet.publicKey, mint, lpMint);
      setTxSig(signature);
      await refreshMigrationState();
    } catch (e: any) {
      setMigrationError(friendlyError(e.message || String(e)));
    } finally {
      setLpLockBusy(false);
    }
  };

  const runUnlockTokens = async () => {
    if (!anchorWallet || !wallet.connected || !validMint) return;
    setCreatorLockBusy(true); setCreatorLockError(null);
    try {
      const mint = new PublicKey(mintInput.trim());
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program  = getProgramV2(provider);
      const { signature } = await unlockLockedTokensV2(program, anchorWallet.publicKey, mint);
      setTxSig(signature);
      await refreshCreatorLockState();
    } catch (e: any) {
      setCreatorLockError(friendlyError(e.message || String(e)));
    } finally {
      setCreatorLockBusy(false);
    }
  };

  const runVestingTranche = async (tranche: number) => {
    if (!anchorWallet || !wallet.connected || !validMint) return;
    setCreatorLockBusy(true); setCreatorLockError(null);
    try {
      const mint = new PublicKey(mintInput.trim());
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program  = getProgramV2(provider);
      const { signature } = await useVestingTrancheV2(program, anchorWallet.publicKey, mint, tranche, 1, connection);
      setTxSig(signature);
      await refreshCreatorLockState();
    } catch (e: any) {
      setCreatorLockError(friendlyError(e.message || String(e)));
    } finally {
      setCreatorLockBusy(false);
    }
  };

  const activeImpact = raydiumTradingActive ? 0 : side === "buy" ? priceImpact : sellPriceImpact;
  const impactColor =
    activeImpact > 5 ? "text-red-400" :
    activeImpact > 2 ? "text-yellow-400" :
    "text-white";

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <GlassPanel className="p-6" glow="green">
          <div className="text-xs font-mono tracking-widest text-[#00FF41] uppercase mb-1">Trade</div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Trade <span className="text-[#00FF41]">protected</span> tokens
          </h2>
          <p className="text-white/50 text-sm">
            {canUseCurve
              ? "V2 devnet tokens trade on the HumbleTrust bonding curve, then continue on Raydium after migration."
              : "V2 curve trading is waiting for the devnet program deploy."}
          </p>
        </GlassPanel>
      </motion.div>

      {/* ── V2 unavailable alert ── */}
      {v2Available === false && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <GlassPanel className="p-4 border-orange-500/30 bg-orange-500/5">
            <div className="flex gap-3">
              <AlertTriangle size={18} className="text-orange-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-orange-400 text-sm mb-0.5">V2 curve deploy pending</div>
                <div className="text-white/60 text-xs leading-relaxed">
                  The configured v2 program ID is not executable on devnet yet — curve buy/sell is disabled.
                </div>
              </div>
            </div>
          </GlassPanel>
        </motion.div>
      )}

      {/* ── Anti-bot alert ── */}
      <GlassPanel className="p-4 border-orange-500/20 bg-orange-500/5">
        <div className="flex gap-3">
          <AlertTriangle size={18} className="text-orange-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-orange-400 text-sm mb-0.5">Anti-bot delay active on new tokens</div>
            <div className="text-white/60 text-xs leading-relaxed">
              Each token has a 0–600 second trading delay after launch. If a tx fails immediately after launch, wait for the delay to expire.
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* ── Main trade grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">

        {/* ── Swap panel ── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassPanel className="p-5 space-y-4" glow="green">
            {/* Panel head */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Zap size={15} className="text-[#00FF41]" />
                Swap
              </div>
              <span className={cn(
                "text-[10px] font-mono px-2 py-0.5 rounded-full border",
                isMainnet
                  ? "border-orange-500/40 text-orange-400 bg-orange-500/10"
                  : canUseCurve
                    ? "border-[#00FF41]/30 text-[#00FF41] bg-[#00FF41]/10"
                    : "border-yellow-500/30 text-yellow-400 bg-yellow-500/10"
              )}>
                {isMainnet ? "MAINNET" : canUseCurve ? "DEVNET" : "V2 PENDING"}
              </span>
            </div>

            {/* Token mint input */}
            <div className="relative">
              <label className="text-xs text-white/50 mb-1.5 block">Token mint</label>
              <input
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:border-[#00FF41]/50 focus:outline-none"
                placeholder={wallet.connected ? "Click to pick wallet token or paste mint" : "Connect wallet or paste mint"}
                value={mintInput}
                onChange={(e) => setMintInput(e.target.value)}
                onFocus={() => { setTokenPickerOpen(true); void loadWalletTokens(); }}
                onClick={() => { setTokenPickerOpen(true); void loadWalletTokens(); }}
                onBlur={() => window.setTimeout(() => setTokenPickerOpen(false), 180)}
              />
              {tokenPickerOpen && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg bg-[rgba(10,10,20,0.98)] border border-white/15 shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                    <span className="text-xs text-white/50">Wallet tokens</span>
                    <button
                      type="button"
                      className="text-xs text-[#00FF41] hover:text-[#00FF41]/80"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={loadWalletTokens}
                    >
                      {tokenPickerBusy ? "Loading..." : "Refresh"}
                    </button>
                  </div>
                  <div className="max-h-44 md:max-h-56 overflow-y-auto">
                    {!wallet.connected && (
                      <div className="px-3 py-3 text-xs text-white/40">Connect wallet to list token balances.</div>
                    )}
                    {wallet.connected && tokenPickerBusy && (
                      <div className="px-3 py-3 text-xs text-white/40">Scanning wallet...</div>
                    )}
                    {wallet.connected && !tokenPickerBusy && walletTokens.length === 0 && (
                      <div className="px-3 py-3 text-xs text-white/40">No SPL tokens found in this wallet on devnet.</div>
                    )}
                    {tokenPickerError && (
                      <div className="px-3 py-2 text-xs text-red-400">{tokenPickerError}</div>
                    )}
                    {walletTokens.map((token) => (
                      <button
                        type="button"
                        key={token.mint}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 text-left"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectWalletToken(token)}
                      >
                        <HexAvatar src={token.logo} label={token.symbol} size={28} />
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-xs font-semibold">{token.symbol}</div>
                          <div className="text-white/40 text-[10px] truncate">{token.name} · {shortAddress(token.mint)}</div>
                        </div>
                        <div className="text-white/60 text-xs font-mono">{formatCompact(token.balance, 4)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Detected token info card (Jupiter-style) */}
            {tokenDetecting && validMint && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10">
                <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
                  <div className="h-2 w-32 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
            )}
            {!tokenDetecting && tokenInfo && (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/10">
                <HexAvatar src={tokenInfo.logoUri} label={tokenInfo.symbol} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white text-sm font-semibold truncate">{tokenInfo.name}</span>
                    <span className="text-white/40 text-xs">{tokenInfo.symbol}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {tokenInfo.source === "pumpfun" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20">pump.fun</span>
                    )}
                    {tokenInfo.source === "mainnet" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-400/20">DEX</span>
                    )}
                    <span className="text-white/25 text-[10px] font-mono">{tokenInfo.mint.slice(0, 6)}...{tokenInfo.mint.slice(-4)}</span>
                  </div>
                </div>
                {tokenInfo.priceUsd && (
                  <div className="text-white/60 text-xs font-mono shrink-0">${tokenInfo.priceUsd}</div>
                )}
              </div>
            )}
            {!tokenDetecting && validMint && !tokenInfo && !isMainnet && (
              <div className="text-[10px] text-white/30 px-1">HumbleTrust token (devnet)</div>
            )}

            {/* Buy / Sell tabs */}
            <div className="flex gap-1 p-1 rounded-lg bg-white/5">
              <button
                type="button"
                onClick={() => setSide("buy")}
                className={cn(
                  "flex-1 py-2 rounded-md text-sm font-medium transition-all",
                  side === "buy"
                    ? "bg-[#00FF41]/20 text-[#00FF41] border border-[#00FF41]/40"
                    : "text-white/50 hover:text-white/70"
                )}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setSide("sell")}
                className={cn(
                  "flex-1 py-2 rounded-md text-sm font-medium transition-all",
                  side === "sell"
                    ? "bg-red-500/20 text-red-400 border border-red-500/40"
                    : "text-white/50 hover:text-white/70"
                )}
              >
                Sell
              </button>
            </div>

            {/* From box */}
            <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-2">
              <div className="flex justify-between text-xs text-white/50">
                <span>From</span>
                <span>{side === "buy" ? "SOL" : selectedSymbol}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 bg-transparent text-white text-xl font-mono focus:outline-none"
                  type="text"
                  inputMode="decimal"
                  value={side === "buy" ? solAmount : tokensAmount}
                  onChange={(e) => {
                    const next = normalizeAmountInput(e.target.value);
                    if (!isAmountInput(next)) return;
                    if (side === "buy") setSolAmount(next);
                    else setTokensAmount(next);
                  }}
                />
                {side === "sell" && (
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20 disabled:opacity-40"
                    disabled={!selectedWalletToken}
                    onClick={setMaxSellAmount}
                  >
                    MAX
                  </button>
                )}
              </div>
              {side === "buy" && (
                <div className="grid grid-cols-4 gap-1">
                  {([0.25, 0.5, 0.75, 1] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      className="py-1.5 text-[11px] rounded bg-white/5 text-white/50 hover:bg-white/10 disabled:opacity-40"
                      disabled={!walletSolBalance}
                      onClick={() => setFractionSol(f)}
                    >
                      {f === 1 ? "MAX" : `${f * 100}%`}
                    </button>
                  ))}
                </div>
              )}
              {side === "buy" && walletSolBalance != null && (
                <div className="flex justify-between text-xs text-white/40">
                  <span>Wallet balance</span>
                  <strong className="text-white/70">{formatCompact(walletSolBalance, 4)} SOL</strong>
                </div>
              )}
              {side === "sell" && (
                <div className="flex justify-between text-xs text-white/40">
                  <span>Wallet balance</span>
                  <strong className="text-white/70">
                    {selectedWalletToken
                      ? `${formatTokenAmount(selectedWalletToken.balance, selectedDecimals)} ${selectedSymbol}`
                      : wallet.connected && validMint ? "0 TOKEN" : "Select token"}
                  </strong>
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                <ArrowDown size={14} />
              </div>
            </div>

            {/* To box */}
            <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-1">
              <div className="flex justify-between text-xs text-white/50">
                <span>To est.</span>
                <span>{side === "buy" ? selectedSymbol : "SOL"}</span>
              </div>
              <div className="text-white text-xl font-mono flex items-center gap-2">
                {isMainnet ? (
                  jupiterQuoting
                    ? <span className="text-white/30 text-sm">Fetching quote…</span>
                    : jupiterQuote
                      ? side === "buy"
                        ? formatCompact(Number(jupiterQuote.outAmount) / Math.pow(10, tokenInfo?.decimals ?? 6), 4)
                        : formatCompact(Number(jupiterQuote.outAmount) / LAMPORTS_PER_SOL, 6)
                      : <span className="text-white/30 text-sm">Enter amount</span>
                ) : raydiumTradingActive ? (
                  cpmmEstimate
                    ? (side === "buy"
                        ? formatCompact(cpmmEstimate.out, 4)
                        : formatCompact(cpmmEstimate.out, 6))
                    : <span className="text-white/30 text-sm">Enter amount</span>
                ) : (
                  side === "buy" ? formatCompact(estimatedTokens, 4) : formatCompact(estimatedSol, 6)
                )}
              </div>
              {isMainnet && jupiterQuote && (
                <div className="text-white/30 text-[10px]">
                  impact {Number(jupiterQuote.priceImpactPct).toFixed(2)}% · via Jupiter
                </div>
              )}
              {raydiumTradingActive && cpmmEstimate && (
                <div className="text-white/30 text-[10px]">
                  impact {cpmmEstimate.impact.toFixed(2)}% · via Raydium CPMM
                </div>
              )}
            </div>

            {/* Meta rows */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Fee</span>
                <strong className="text-white/70">{raydiumTradingActive ? "Raydium" : `${(CURVE_FEE_RATE * 100).toFixed(0)}%`}</strong>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">{raydiumTradingActive ? "Routing" : "Slippage guard"}</span>
                <strong className="text-white/70">
                  {raydiumTradingActive ? "Raydium pool" : `${(slippageBps / 100).toFixed(slippageBps % 100 === 0 ? 0 : 1)}%`}
                </strong>
              </div>
            </div>

            {/* Slippage selector */}
            {!raydiumTradingActive && <div className="flex gap-1.5 items-center">
              {[50, 100, 300].map((bps) => (
                <button
                  key={bps}
                  type="button"
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    slippageBps === bps
                      ? "bg-[#B026FF]/20 text-[#B026FF] border border-[#B026FF]/40"
                      : "bg-white/5 text-white/50 hover:bg-white/10"
                  )}
                  onClick={() => setSlippageBps(bps)}
                >
                  {(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%
                </button>
              ))}
              <input
                aria-label="Custom slippage percent"
                className="w-16 px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs text-white text-center focus:border-[#B026FF]/50 focus:outline-none"
                value={(slippageBps / 100).toString()}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value) && value >= 0 && value <= 25) setSlippageBps(Math.round(value * 100));
                }}
              />
            </div>}

            {!raydiumTradingActive && slippageBps === 0 && (
              <div className="text-red-400 text-xs">0% slippage will fail on any price movement. Use only for exact tests.</div>
            )}

            {/* Price impact & min received */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Price impact</span>
                <strong className={impactColor}>
                  {raydiumTradingActive ? "Live quote" : `${formatCompact(Math.abs(activeImpact), 2)}%`}
                </strong>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Min. received</span>
                <strong className="text-white/70">
                  {raydiumTradingActive
                    ? "Quoted on Raydium"
                    : side === "buy"
                    ? `${formatCompact(estimatedTokens * (1 - slippageBps / 10_000), 4)} ${selectedSymbol}`
                    : `${formatCompact(estimatedSol * (1 - slippageBps / 10_000), 6)} SOL`}
                </strong>
              </div>
            </div>

            {/* Inline warnings */}
            {!isMainnet && !raydiumTradingActive && activeImpact > 5 && (
              <div className="text-red-400 text-xs">
                High price impact ({formatCompact(Math.abs(activeImpact), 1)}%). Consider reducing your trade size.
              </div>
            )}
            {!isMainnet && sellBalanceExceeded && (
              <div className="text-red-400 text-xs">Sell amount exceeds wallet balance. Use MAX or lower the amount.</div>
            )}
            {!isMainnet && sellBalanceMissing && (
              <div className="text-red-400 text-xs">This mint is not in your connected wallet.</div>
            )}
            {raydiumTradingActive && (
              <div className="text-[#00FF41]/80 text-xs leading-relaxed">
                Bonding curve is closed. Buys and sells continue through the active Raydium pool.
              </div>
            )}
            {migrationPreparedOnly && (
              <div className="text-yellow-300 text-xs leading-relaxed">
                Curve trading is paused. Migration liquidity is prepared; continue the Raydium migration below.
              </div>
            )}

            {/* Mainnet warning */}
            {isMainnet && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-300 text-[11px] leading-relaxed">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>
                  <strong>Mainnet trade</strong> — real SOL from your mainnet wallet will be used.
                  Routed via Jupiter. Make sure your wallet has mainnet SOL.
                </span>
              </div>
            )}

            {/* Action button */}
            <button
              onClick={side === "buy" ? runBuy : runSell}
              disabled={!canSubmitTrade}
              className={cn(
                "w-full py-3.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                side === "buy"
                  ? "bg-gradient-to-r from-[#00FF41] to-[#00FF41]/80 text-black hover:shadow-[0_0_24px_rgba(0,255,65,0.4)]"
                  : "bg-gradient-to-r from-red-500 to-red-500/80 text-white hover:shadow-[0_0_24px_rgba(239,68,68,0.4)]"
              )}
            >
              {busy === "buy" ? "Buying…" : busy === "sell" ? "Selling…"
                : isMainnet
                  ? side === "buy" ? `Buy ${selectedSymbol} via Jupiter` : `Sell ${selectedSymbol} via Jupiter`
                  : raydiumTradingActive
                    ? side === "buy" ? `Buy ${selectedSymbol}` : `Sell ${selectedSymbol}`
                  : migrationPreparedOnly
                    ? "Migration prepared"
                  : side === "buy" ? "Buy on Curve" : "Sell on Curve"}
            </button>


            {/* Links */}
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {pumpFunUrl && (
                <a href={pumpFunUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-[#00FF41]/70 hover:text-[#00FF41]">
                  pump.fun <ExternalLink size={10} />
                </a>
              )}
              {solscanUrl && (
                <a href={solscanUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
                  Solscan <ExternalLink size={10} />
                </a>
              )}
              {raydiumTradingActive && raydiumSwapUrl && (
                <a href={raydiumSwapUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-[#00FF41]/70 hover:text-[#00FF41]">
                  Raydium swap <ExternalLink size={10} />
                </a>
              )}
            </div>
            {txSig && (
              <a
                href={isMainnet ? `https://solscan.io/tx/${txSig}` : `https://solscan.io/tx/${txSig}?cluster=devnet`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-[#00FF41] font-mono bg-[#00FF41]/10 border border-[#00FF41]/20 rounded-lg px-3 py-2"
              >
                Tx: {txSig.slice(0, 12)}… <ExternalLink size={10} />
              </a>
            )}
            {tradeError && <div className="text-red-400 text-xs">{tradeError}</div>}
          </GlassPanel>
        </motion.div>

        {/* ── Chart panel ── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-4"
        >
          <GlassPanel className={cn("overflow-hidden", fullChart && "fixed inset-1 md:inset-4 z-50")}>
            {/* Chart topbar */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10 bg-white/[0.02] flex-wrap">
              {!showDexChart && TIMEFRAMES.map((tf) => (
                <button
                  type="button"
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-mono transition-all",
                    timeframe === tf
                      ? "bg-[#00FF41]/15 text-[#00FF41]"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  {tf}
                </button>
              ))}
              {!showDexChart && <span className="w-px h-4 bg-white/10 mx-1" />}
              {!showDexChart && (["candles", "line", "area"] as ChartMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={cn(
                    "px-2.5 py-1 rounded text-xs capitalize transition-all",
                    chartMode === m
                      ? "bg-[#00FF41]/15 text-[#00FF41]"
                      : "text-white/40 hover:text-white/70"
                  )}
                  onClick={() => setChartMode(m)}
                >
                  {m}
                </button>
              ))}
              {!showDexChart && <span className="w-px h-4 bg-white/10 mx-1" />}
              {!showDexChart && (
                <button
                  type="button"
                  className={cn(
                    "px-2.5 py-1 rounded text-xs transition-all",
                    showIndicators
                      ? "bg-[#B026FF]/15 text-[#B026FF]"
                      : "text-white/40 hover:text-white/70"
                  )}
                  onClick={() => setShowIndicators((v) => !v)}
                >
                  fx Indicators
                </button>
              )}
              {showDexChart && (
                <span className="text-xs text-white/30 font-mono">DexScreener · live chart</span>
              )}
              <span className="w-px h-4 bg-white/10 mx-1 ml-auto" />
              <button
                type="button"
                className="p-1.5 rounded text-white/40 hover:text-white/70 transition-all"
                title={fullChart ? "Exit full" : "Expand"}
                onClick={() => setFullChart((v) => !v)}
              >
                {fullChart ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              </button>
            </div>

            {/* Indicator options */}
            {showIndicators && !showDexChart && (
              <div className="flex items-center gap-4 px-3 py-2 border-b border-white/10 bg-white/[0.02] flex-wrap">
                <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer">
                  <input type="checkbox" className="accent-[#00FF41]" checked={showVolume} onChange={(e) => setShowVolume(e.target.checked)} />
                  Volume
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" className="accent-yellow-400" checked={indicators.sma20} onChange={() => toggleIndicator("sma20")} />
                  <span className="text-yellow-400">SMA 20</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" className="accent-purple-400" checked={indicators.sma50} onChange={() => toggleIndicator("sma50")} />
                  <span className="text-purple-400">SMA 50</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" className="accent-cyan-400" checked={indicators.ema20} onChange={() => toggleIndicator("ema20")} />
                  <span className="text-cyan-400">EMA 20</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" className="accent-yellow-400" checked={indicators.rsi} onChange={() => toggleIndicator("rsi")} />
                  <span className="text-yellow-400">RSI (14)</span>
                </label>
              </div>
            )}

            {/* Chart stage — built from live trades (no OHLCV endpoint needed) */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <span className="w-2 h-2 rounded-full bg-[#00FF41] inline-block animate-pulse" />
                  {selectedSymbol} / SOL · {isMainnet ? (tokenInfo?.source === "pumpfun" ? "pump.fun" : "mainnet") : "devnet"}
                </div>
                <div className="flex items-center gap-2">
                  {chartLoading && (
                    <span className="text-xs text-white/30 flex items-center gap-1">
                      <RefreshCw size={10} className="animate-spin" /> Loading
                    </span>
                  )}
                  {validMint && !chartLoading && (
                    <button
                      type="button"
                      onClick={() => fetchChartTrades(mintInput.trim())}
                      className="text-white/30 hover:text-white/60"
                      title="Refresh"
                    >
                      <RefreshCw size={11} />
                    </button>
                  )}
                  {validMint && !isMainnet && (
                    <button
                      type="button"
                      disabled={syncing}
                      onClick={() => runSyncTrades(mintInput.trim())}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border border-[#00FF41]/20 text-[#00FF41]/60 hover:text-[#00FF41] hover:border-[#00FF41]/50 transition-all disabled:opacity-40"
                      title="Sync historical trades from blockchain"
                    >
                      {syncing
                        ? <><RefreshCw size={9} className="animate-spin" /> Syncing…</>
                        : <><RefreshCw size={9} /> Sync chain</>
                      }
                    </button>
                  )}
                </div>
              </div>

              {/* Chart — DexScreener embed for mainnet/graduated, custom for devnet/bonding curve */}
              {(() => {
                if (!validMint) return (
                  <div className="h-52 flex items-center justify-center rounded-lg bg-white/[0.02] border border-white/5">
                    <p className="text-white/30 text-sm">Select a token to view chart</p>
                  </div>
                );

                // Mainnet DEX tokens and graduated pump.fun → DexScreener live chart
                if (showDexChart) return (
                  <iframe
                    key={tokenInfo!.dexPairAddress}
                    src={`https://dexscreener.com/solana/${tokenInfo!.dexPairAddress}?embed=1&theme=dark&info=0&trades=0`}
                    className="w-full rounded-lg border border-white/10"
                    style={{ height: 340 }}
                    title={`${selectedSymbol}/SOL`}
                    allow="clipboard-write"
                  />
                );

                if (chartLoading) return (
                  <div className="h-52 flex items-center justify-center rounded-lg bg-white/[0.02] border border-white/5">
                    <RefreshCw size={18} className="animate-spin text-white/20" />
                  </div>
                );

                if (chartError) return (
                  <div className="h-52 flex items-center justify-center rounded-lg bg-red-500/[0.04] border border-red-500/15">
                    <div className="text-center max-w-md px-4">
                      <p className="text-red-300 text-sm mb-1">Chart history unavailable</p>
                      <p className="text-red-300/60 text-xs break-words">{chartError}</p>
                    </div>
                  </div>
                );

                const hasData = chartDisplayTrades.length > 0;
                if (!hasData) return (
                  <div className="h-52 flex items-center justify-center rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="text-center">
                      <p className="text-white/30 text-sm mb-1">No trades yet</p>
                      <p className="text-white/20 text-xs">Be the first to trade this token</p>
                    </div>
                  </div>
                );

                const periodSec =
                  timeframe === "1s" ? 1 : timeframe === "5s" ? 5 :
                  timeframe === "5m" ? 300 : timeframe === "1h" ? 3600 : 60;

                return (
                  <LightweightTradeChart
                    trades={chartDisplayTrades}
                    periodSec={periodSec}
                    height={fullChart ? 520 : 320}
                    showVolume={showVolume}
                    showSma20={indicators.sma20}
                    showSma50={indicators.sma50}
                    showEma20={indicators.ema20}
                    showRsi={indicators.rsi}
                    mode={chartMode}
                  />
                );
              })()}

              {/* Sync feedback */}
              {syncMsg && (
                <div className={cn(
                  "text-[10px] font-mono px-2 py-1 rounded",
                  syncMsg.includes("error") || syncMsg.includes("Error")
                    ? "text-red-400 bg-red-500/10"
                    : "text-[#00FF41] bg-[#00FF41]/10"
                )}>
                  {syncMsg}
                </div>
              )}

              {/* Stats bar */}
              {chartDisplayTrades.length > 0 && (() => {
                const buys = chartDisplayTrades.filter(t => t.side === "buy").length;
                const sells = chartDisplayTrades.filter(t => t.side === "sell").length;
                const totalSol = chartDisplayTrades.reduce((s, t) => s + Number(t.sol_amount), 0);
                return (
                  <div className="flex items-center gap-4 text-xs border-t border-white/5 pt-2">
                    <span className="text-[#00FF41]">▲ {buys} buys</span>
                    <span className="text-[#FF3C6B]">▼ {sells} sells</span>
                    <span className="text-white/40">{totalSol.toFixed(3)} SOL vol</span>
                    <span className="text-white/25 ml-auto">{chartDisplayTrades.length} trades · auto 30s</span>
                  </div>
                );
              })()}

              {/* Trade history table */}
              {chartDisplayTrades.length > 0 && (
                <div className="border-t border-white/10 pt-3">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-2">Trade history</p>
                  {/* Header */}
                  <div className="grid grid-cols-[52px_1fr_90px_90px_70px_24px] gap-1 px-1 pb-1 text-[10px] font-mono text-white/25 uppercase border-b border-white/5">
                    <span>Side</span>
                    <span>Price (SOL)</span>
                    <span className="text-right">SOL</span>
                    <span className="text-right">Tokens</span>
                    <span className="text-right">Time</span>
                    <span />
                  </div>
                  <div className="space-y-0 max-h-52 overflow-y-auto pr-1 mt-1">
                    {[...chartDisplayTrades]
                      .sort((a, b) => new Date(b.block_time).getTime() - new Date(a.block_time).getTime())
                      .map((trade, i) => {
                        const isBuy = trade.side === "buy";
                        const sol = Number(trade.sol_amount);
                        const tokens = Number(trade.token_amount);
                        const price = Number(trade.price_sol);
                        const timeStr = new Date(trade.block_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                        return (
                          <div
                            key={trade.signature + i}
                            className="grid grid-cols-[52px_1fr_90px_90px_70px_24px] gap-1 px-1 py-1 text-[11px] font-mono rounded hover:bg-white/[0.03] items-center"
                            style={{ borderLeft: `2px solid ${isBuy ? "rgba(0,255,65,0.4)" : "rgba(255,60,107,0.4)"}` }}
                          >
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded text-center"
                              style={{
                                color: isBuy ? "#00FF41" : "#FF3C6B",
                                background: isBuy ? "rgba(0,255,65,0.1)" : "rgba(255,60,107,0.1)"
                              }}
                            >
                              {isBuy ? "BUY" : "SELL"}
                            </span>
                            <span className="text-white/60 truncate">
                              {price < 0.000001 ? price.toExponential(3) : price.toFixed(9)}
                            </span>
                            <span className={cn("text-right", isBuy ? "text-[#00FF41]/80" : "text-[#FF3C6B]/80")}>
                              {sol < 0.001 ? sol.toFixed(6) : sol.toFixed(4)}
                            </span>
                            <span className="text-white/40 text-right">
                              {tokens > 0 ? (tokens >= 1_000_000 ? `${(tokens / 1_000_000).toFixed(2)}M` : tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}K` : tokens.toFixed(2)) : "—"}
                            </span>
                            <span className="text-white/25 text-right text-[10px]">{timeStr}</span>
                            <a
                              href={isMainnet
                                ? `https://solscan.io/tx/${trade.signature}`
                                : `https://solscan.io/tx/${trade.signature}?cluster=devnet`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-white/20 hover:text-[#00FF41] flex justify-center"
                            >
                              <ExternalLink size={9} />
                            </a>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </GlassPanel>

          {/* ── Live reserves (devnet curve only) ── */}
          {!isMainnet && !raydiumTradingActive && <GlassPanel className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              {[
                { label: "Curve price", value: formatPrice(currentPrice) },
                {
                  label: side === "buy" ? "After buy" : "Sell est.",
                  value: side === "buy" ? formatPrice(nextPrice) : `${formatCompact(estimatedSol, 6)} SOL`
                },
                {
                  label: `SOL reserve ${reserveSource === "chain" ? "🟢" : "⚪"}`,
                  value: formatCompact(previewSolReserve, 2)
                },
                { label: "Token reserve", value: formatCompact(previewTokenReserve, 2) },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-0.5">
                  <div className="text-white/40 text-xs">{label}</div>
                  <div className="text-white font-mono text-sm font-semibold">{value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">
                  SOL reserve {reserveSource === "chain" ? "(live)" : "(estimate)"}
                </label>
                <input
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-[#00FF41]/50 focus:outline-none"
                  type="number" min={0.01} step={0.1}
                  value={reserveSol}
                  onChange={(e) => { setReserveSource("preview"); setReserveSol(e.target.value); }}
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">
                  Token reserve {reserveSource === "chain" ? "(live)" : "(estimate)"}
                </label>
                <input
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-[#00FF41]/50 focus:outline-none"
                  type="number" min={1} step={1000000}
                  value={reserveTokens}
                  onChange={(e) => { setReserveSource("preview"); setReserveTokens(e.target.value); }}
                />
              </div>
            </div>
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => refreshReserves()}
              disabled={!validMint || reservesBusy || !canUseCurve}
            >
              <RefreshCw size={12} className={reservesBusy ? "animate-spin" : undefined} />
              {reserveSource === "chain" ? "Live devnet" : "Fetch live"}
            </button>
            {reserveError && <div className="text-red-400 text-xs mt-2">{reserveError}</div>}
          </GlassPanel>}

          {/* ── Migration progress (devnet curve only) ── */}
          {!isMainnet && canUseCurve && validMint && migrationState && (
            <GlassPanel className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <Rocket size={14} className={migrationState.isMigrated ? "text-[#00FF41]" : "text-yellow-400"} />
                  {migrationState.isMigrated ? "Migrated to Raydium" : "Raydium Migration"}
                </div>
                {!migrationState.isMigrated && (
                  <span className="text-white/40 text-xs font-mono">
                    {(migrationState.currentSolLamports / LAMPORTS_PER_SOL).toFixed(3)} / {(migrationState.thresholdLamports / LAMPORTS_PER_SOL).toFixed(1)} SOL
                  </span>
                )}
              </div>

              {!migrationState.isMigrated ? (
                <>
                  {/* Progress bar */}
                  <div className="w-full h-2 bg-white/10 rounded-full mb-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${migrationState.progressPct.toFixed(1)}%`,
                        background: migrationState.progressPct >= 100
                          ? "linear-gradient(90deg, #00FF41, #00cc33)"
                          : "linear-gradient(90deg, #facc15, #f59e0b)",
                      }}
                    />
                  </div>
                  <div className="text-white/40 text-xs mb-3">
                    {migrationState.isPrepared
                      ? `Prepared — ${(migrationState.migrationWsolLamports / LAMPORTS_PER_SOL).toFixed(3)} SOL ready for Raydium`
                      : `${migrationState.progressPct.toFixed(1)}% — reach 100% to open Raydium CPMM pool`}
                  </div>
                  <button
                    onClick={runMigrate}
                    disabled={(!migrationState.isPrepared && migrationState.progressPct < 100) || migrationBusy || !wallet.connected}
                    className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: migrationState.isPrepared || migrationState.progressPct >= 100
                        ? "linear-gradient(135deg, #00FF41, #00cc33)"
                        : "rgba(255,255,255,0.05)",
                      color: migrationState.isPrepared || migrationState.progressPct >= 100 ? "#000" : "rgba(255,255,255,0.4)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    {migrationBusy
                      ? "Migrating…"
                      : migrationState.isPrepared
                        ? "🚀 Continue Raydium Migration"
                        : migrationState.progressPct >= 100
                        ? "🚀 Trigger Migration · Earn 0.1 SOL"
                        : `Needs ${((migrationState.thresholdLamports - migrationState.currentSolLamports) / LAMPORTS_PER_SOL).toFixed(2)} more SOL`}
                  </button>
                </>
              ) : (
                <>
                  {/* Migrated state */}
                  <div className="text-xs font-mono text-white/50 mb-3 break-all">
                    Pool: {migrationState.raydiumPool.slice(0, 8)}…{migrationState.raydiumPool.slice(-6)}
                  </div>
                  <a
                    href={`https://raydium.io/liquidity/increase/?mode=add&pool_id=${migrationState.raydiumPool}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 mb-4"
                  >
                    View pool on Raydium <ExternalLink size={10} />
                  </a>

                  {/* LP Lock section */}
                  {lpLockState ? (
                    <div className="bg-white/5 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                        <Lock size={11} className="text-yellow-400" />
                        LP Locked
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-white/40">Amount</span><br /><span className="font-mono">{(lpLockState.lpAmount / 1e9).toFixed(4)}</span></div>
                        <div><span className="text-white/40">Lock days</span><br /><span className="font-mono">{lpLockState.lockDays}</span></div>
                        <div><span className="text-white/40">Unlocks</span><br /><span className="font-mono">{new Date(lpLockState.unlockTime * 1000).toLocaleDateString()}</span></div>
                        <div><span className="text-white/40">Fees claimed</span><br /><span className="font-mono">{(lpLockState.totalFeesClaimed / LAMPORTS_PER_SOL).toFixed(4)} SOL</span></div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={runClaimLpFees}
                          disabled={lpLockBusy || !wallet.connected}
                          className="flex-1 py-2 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-xs font-semibold hover:bg-yellow-500/25 disabled:opacity-40 transition-all"
                        >
                          {lpLockBusy ? "…" : "Claim Fees"}
                        </button>
                        {Date.now() / 1000 >= lpLockState.unlockTime && (
                          <button
                            onClick={runUnlockLp}
                            disabled={lpLockBusy || !wallet.connected}
                            className="flex-1 py-2 rounded-lg bg-[#00FF41]/15 border border-[#00FF41]/30 text-[#00FF41] text-xs font-semibold hover:bg-[#00FF41]/25 disabled:opacity-40 transition-all"
                          >
                            <Unlock size={10} className="inline mr-1" />Unlock LP
                          </button>
                        )}
                      </div>
                    </div>
                  ) : wallet.connected && (
                    <div className="space-y-2">
                      <div className="text-xs text-white/40 font-semibold">Lock your LP tokens</div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number" placeholder="LP amount" min={0.001} step={0.001}
                          value={lpLockAmt}
                          onChange={e => setLpLockAmt(e.target.value)}
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:border-[#00FF41]/50 focus:outline-none"
                        />
                        <input
                          type="number" placeholder="Days (min 1)" min={1} max={360}
                          value={lpLockDays}
                          onChange={e => setLpLockDays(e.target.value)}
                          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:border-[#00FF41]/50 focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={runLockLp}
                        disabled={lpLockBusy || !lpLockAmt}
                        className="w-full py-2 rounded-lg bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] text-xs font-semibold hover:bg-[#00FF41]/20 disabled:opacity-40 transition-all"
                      >
                        <Lock size={10} className="inline mr-1" />{lpLockBusy ? "Locking…" : "Lock LP Tokens"}
                      </button>
                    </div>
                  )}
                </>
              )}

              {migrationError && <div className="text-red-400 text-xs mt-2">{migrationError}</div>}
            </GlassPanel>
          )}

          {!isMainnet && canUseCurve && validMint && !migrationState && (
            <GlassPanel className="p-4 border-yellow-500/20 bg-yellow-500/5">
              <div className="flex gap-3">
                <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-yellow-400 text-sm mb-1">No v2 launch data for this mint</div>
                  <div className="text-white/50 text-xs leading-relaxed">
                    Launch or select a HumbleTrust v2 devnet token to show migration progress, Raydium actions, and LP controls.
                  </div>
                </div>
              </div>
            </GlassPanel>
          )}

          {/* ── Creator Controls ── */}
          {!isMainnet && canUseCurve && validMint && creatorLockState &&
           wallet.publicKey?.toBase58() === creatorLockState.creator && (() => {
            const now = Math.floor(Date.now() / 1000);
            const SECS_PER_DAY = 60; // devnet: 1 day = 60s
            const elapsed      = now - creatorLockState.createdAt;
            const elapsedDays  = Math.floor(elapsed / SECS_PER_DAY);
            const canUnlock    = creatorLockState.isLocked && now >= creatorLockState.unlockTime;
            const secsLeft     = Math.max(0, creatorLockState.unlockTime - now);
            const totalVesting = creatorLockState.creatorAllocationAmount / 1e9;
            const lockedAmt    = creatorLockState.lockedAmountAfterBurn / 1e9;
            const burnedAmt    = creatorLockState.plannedBurnAmount / 1e9;

            const vestingStatus = (done: boolean, day: number) => {
              if (done) return { label: "Claimed ✓", color: "text-[#00FF41]", ready: false };
              if (elapsedDays >= day) return { label: "Ready to claim", color: "text-green-400", ready: true };
              const s = Math.max(0, day * SECS_PER_DAY - elapsed);
              const m = Math.floor(s / 60), sec = s % 60;
              return { label: `in ${m}m ${sec}s`, color: "text-white/35", ready: false };
            };
            const t1 = vestingStatus(creatorLockState.vestingT1Done, 30);
            const t2 = vestingStatus(creatorLockState.vestingT2Done, 60);
            const t3 = vestingStatus(creatorLockState.vestingT3Done, 90);

            return (
              <GlassPanel className="p-4 border-purple-500/20 bg-purple-500/5">

                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                  <Lock size={14} className="text-purple-400" />
                  <span className="text-sm font-semibold text-purple-300">Creator Panel</span>
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">only you see this</span>
                  <button onClick={() => refreshCreatorLockState()} className="ml-auto text-white/30 hover:text-white/60 transition-colors" title="Refresh">
                    <RefreshCw size={12} />
                  </button>
                </div>

                {/* ── Guide ── */}
                <div className="mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-2.5">
                  <p className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">How it works</p>
                  <div className="flex gap-2 items-start">
                    <span className="text-base leading-none mt-0.5">🔒</span>
                    <div>
                      <p className="text-xs text-white/80 font-medium">Locked Vault ({creatorLockState.lockPercent || "?"}% · {creatorLockState.lockDays || "?"} days)</p>
                      <p className="text-[11px] text-white/40 leading-relaxed">
                        {burnedAmt > 0 ? `${burnedAmt.toLocaleString()} tokens burned at launch. ` : ""}
                        After lock expires — {lockedAmt.toLocaleString()} tokens released to <span className="text-white/60">market circulation</span>, not to your wallet.
                        This protects buyers: supply unlocks gradually into the market.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="text-base leading-none mt-0.5">💰</span>
                    <div>
                      <p className="text-xs text-white/80 font-medium">Creator Vesting (your allocation)</p>
                      <p className="text-[11px] text-white/40 leading-relaxed">
                        {totalVesting > 0 ? `${totalVesting.toLocaleString()} tokens total. ` : "No creator allocation set. "}
                        Claimed in 3 tranches (T1/T2/T3) — goes <span className="text-white/60">directly to your wallet</span>.
                        Each tranche = ~33% of your creator allocation.
                      </p>
                    </div>
                  </div>
                  {creatorLockState.isMigrated && (
                    <div className="flex gap-2 items-start">
                      <span className="text-base leading-none mt-0.5">🌊</span>
                      <div>
                        <p className="text-xs text-white/80 font-medium">Raydium LP (after migration)</p>
                        <p className="text-[11px] text-white/40 leading-relaxed">
                          Your token is live on Raydium. If LP is locked — claim trading fees anytime.
                          LP unlock becomes available after the lock period expires.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Section 1: Locked Vault ── */}
                <div className="mb-3 rounded-xl border border-white/[0.08] overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-white/[0.04]">
                    <span className="text-xs font-semibold text-white/70">
                      🔒 Locked Vault — {creatorLockState.lockPercent || "?"}% · {creatorLockState.lockDays || "?"} days
                    </span>
                    <span className={cn("text-[11px] font-mono px-2 py-0.5 rounded-full",
                      creatorLockState.isLocked
                        ? "bg-yellow-500/15 text-yellow-400"
                        : "bg-[#00FF41]/15 text-[#00FF41]"
                    )}>
                      {creatorLockState.isLocked ? "Locked" : "Released"}
                    </span>
                  </div>
                  <div className="px-3 py-2.5 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Available after unlock</span>
                      <span className="font-mono text-white/70">{lockedAmt.toLocaleString()} tokens → market</span>
                    </div>
                    {burnedAmt > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-white/40">Burned at launch</span>
                        <span className="font-mono text-red-400/70">{burnedAmt.toLocaleString()} tokens</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Status</span>
                      <span className="font-mono text-white/60">
                        {creatorLockState.isLocked
                          ? canUnlock ? "✅ Ready to unlock" : `⏳ ${Math.floor(secsLeft / 60)}m ${secsLeft % 60}s remaining`
                          : "✅ Already released to market"}
                      </span>
                    </div>
                    {creatorLockState.isLocked && (
                      <>
                        <div className="mt-2 p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/15 text-[11px] text-yellow-300/60">
                          ℹ️ Clicking unlock releases tokens to <strong>market circulation</strong> — not your wallet. This is by design to protect buyers.
                        </div>
                        <button
                          onClick={runUnlockTokens}
                          disabled={!canUnlock || creatorLockBusy}
                          className={cn(
                            "w-full mt-2 py-2 rounded-lg text-xs font-semibold transition-all",
                            canUnlock && !creatorLockBusy
                              ? "bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30"
                              : "bg-white/5 text-white/20 cursor-not-allowed border border-white/5"
                          )}
                        >
                          {creatorLockBusy ? "Processing…" : canUnlock ? "🔓 Release to Market" : "Not ready yet"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* ── Section 2: Creator Vesting ── */}
                {totalVesting > 0 && (
                  <div className="mb-3 rounded-xl border border-white/[0.08] overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-white/[0.04]">
                      <span className="text-xs font-semibold text-white/70">💰 Creator Vesting — goes to your wallet</span>
                      <span className="text-[11px] font-mono text-white/40">{totalVesting.toLocaleString()} total</span>
                    </div>
                    <div className="px-3 py-2.5">
                      <div className="mb-2 p-2 rounded-lg bg-[#00FF41]/5 border border-[#00FF41]/10 text-[11px] text-[#00FF41]/60">
                        ✅ These tokens go <strong>directly to your wallet</strong> when you claim each tranche.
                      </div>
                      <div className="space-y-2">
                        {([
                          { n: 1 as const, label: "Tranche 1 · Day 30 · 33%", status: t1 },
                          { n: 2 as const, label: "Tranche 2 · Day 60 · 33%", status: t2 },
                          { n: 3 as const, label: "Tranche 3 · Day 90 · 34%", status: t3 },
                        ]).map(({ n, label, status }) => (
                          <div key={n} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] text-white/60">{label}</div>
                              <div className={cn("text-[11px] font-mono", status.color)}>{status.label}</div>
                            </div>
                            {status.ready ? (
                              <button
                                onClick={() => runVestingTranche(n)}
                                disabled={creatorLockBusy}
                                className="px-3 py-1 rounded-lg text-xs font-bold bg-[#00FF41]/20 hover:bg-[#00FF41]/30 text-[#00FF41] border border-[#00FF41]/30 transition-all disabled:opacity-40 shrink-0"
                              >
                                {creatorLockBusy ? "…" : "Claim →"}
                              </button>
                            ) : status.color === "text-[#00FF41]" ? (
                              <span className="text-[11px] text-[#00FF41] shrink-0">Claimed ✓</span>
                            ) : (
                              <span className="text-[11px] text-white/20 shrink-0">Locked</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {creatorLockError && (
                  <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    {creatorLockError}
                  </div>
                )}
              </GlassPanel>
            );
          })()}
        </motion.div>
      </div>

      {/* ── TrustScore reference ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <GlassPanel className="p-5">
          <div className="flex items-center gap-2 font-bold text-white mb-4">
            <TrendingUp size={15} className="text-blue-400" />
            Check TrustScore before buying
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {[
              { score: "85–100", label: "ELITE", color: "text-[#00FF41]", border: "border-[#00FF41]/20", rec: "Strong lock, low creator allocation, high liquidity, burn active." },
              { score: "70–84", label: "STRONG", color: "text-blue-400", border: "border-blue-400/20", rec: "Good fundamentals. Check vesting status, curve reserves, and votes." },
              { score: "40–69", label: "OK", color: "text-yellow-400", border: "border-yellow-400/20", rec: "Meets minimum rules. Research creator history before buying." },
              { score: "0–39", label: "WEAK", color: "text-orange-400", border: "border-orange-400/20", rec: "High risk. Weak distribution, low burn/liquidity, or complaints detected." },
            ].map((t) => (
              <div key={t.label} className={cn("rounded-lg p-3.5 bg-white/[0.03] border", t.border)}>
                <div className={cn("font-mono font-bold text-sm mb-0.5", t.color)}>{t.score}</div>
                <div className="font-bold text-xs text-white mb-1">{t.label}</div>
                <div className="text-xs text-white/50 leading-relaxed">{t.rec}</div>
              </div>
            ))}
          </div>
          {goDiscover && (
            <button
              onClick={goDiscover}
              className="text-xs text-blue-400 border border-blue-400/20 bg-blue-400/5 hover:bg-blue-400/10 px-3 py-2 rounded-lg transition-all"
            >
              Browse all tokens in Discover →
            </button>
          )}
        </GlassPanel>
      </motion.div>

      {/* ── Pre-trade checklist ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <GlassPanel className="p-5">
          <div className="flex items-center gap-2 font-bold text-white mb-4">
            <Clock size={15} className="text-white/40" />
            Pre-trade checklist
          </div>
          <ul className="space-y-2">
            {[
              ["TrustScore", "Aim for 66+ before buying — check Discover"],
              ["Lock status", "Confirm is_locked = true and unlock_time is in the future"],
              ["Anti-bot", "Verify trading_unlock_time has passed"],
              ["Votes", "Check positive_votes vs negative_votes ratio"],
              ["Liquidity", "Verify curve treasury and pool vault before swapping"],
              ["Creator", "Check creator reputation PDA for launch history"],
            ].map(([key, val]) => (
              <li key={key} className="flex gap-3 text-xs p-2.5 rounded-lg bg-white/[0.03]">
                <span className="text-[#00FF41] font-mono min-w-[100px] shrink-0">{key}</span>
                <span className="text-white/50">{val}</span>
              </li>
            ))}
          </ul>
        </GlassPanel>
      </motion.div>
    </div>
  );
};

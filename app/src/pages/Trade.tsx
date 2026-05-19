import { useEffect, useMemo, useState } from "react";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  AlertTriangle,
  ArrowDown,
  BarChart3,
  Clock,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  PROGRAM_ID_V2_PK,
  buyOnCurveV2,
  findV2Pdas,
  getProgramV2,
  isProgramExecutable,
  sellOnCurveV2,
} from "../lib/program";
import { listTokens } from "../lib/image";
import { LiveMarketChart } from "../components/LiveMarketChart";

const PREVIEW_TOKEN_RESERVE = 350_000_000;
const PREVIEW_SOL_RESERVE = 0.5;
const CURVE_FEE_RATE = 0.01;
const SOL_USD_PREVIEW = 92.31;
const TOTAL_SUPPLY_UI = 1_000_000_000;
const CHART_W = 920;
const CHART_H = 430;
const CHART_LEFT = 48;
const CHART_RIGHT = 78;
const CHART_TOP = 46;
const CHART_BOTTOM = 34;
const VOLUME_H = 76;

type TradeSide = "buy" | "sell";
type ChartMode = "candles" | "line" | "area";
type MetricMode = "price" | "mcap";
type QuoteMode = "SOL" | "USD";
type Timeframe = "1s" | "5s" | "1m" | "5m" | "1h";

interface WalletTokenOption {
  mint: string;
  balance: number;
  decimals: number;
  symbol: string;
  name: string;
  logo?: string;
}

const TIMEFRAMES: Timeframe[] = ["1s", "5s", "1m", "5m", "1h"];
const CANDLE_COUNT: Record<Timeframe, number> = {
  "1s": 76,
  "5s": 72,
  "1m": 68,
  "5m": 60,
  "1h": 48,
};

const DRAWING_TOOLS = [
  { id: "cross", label: "Crosshair", mark: "+" },
  { id: "trend", label: "Trend line", mark: "/" },
  { id: "levels", label: "Levels", mark: "=" },
  { id: "fib", label: "Fib", mark: "F" },
  { id: "brush", label: "Brush", mark: "~" },
  { id: "text", label: "Text", mark: "T" },
  { id: "ruler", label: "Ruler", mark: "R" },
  { id: "zoom", label: "Zoom", mark: "Z" },
  { id: "magnet", label: "Magnet", mark: "M" },
  { id: "lock", label: "Lock", mark: "L" },
  { id: "eye", label: "Visibility", mark: "E" },
  { id: "trash", label: "Clear drawings", mark: "X" },
];

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

const formatPrice = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value < 0.000001) return value.toExponential(2);
  return value.toFixed(8);
};

const estimateTokensOut = (solIn: number, solReserve: number, tokenReserve: number) => {
  if (solIn <= 0 || solReserve <= 0 || tokenReserve <= 0) return 0;
  const solAfterFee = solIn * (1 - CURVE_FEE_RATE);
  const k = solReserve * tokenReserve;
  const nextTokenReserve = k / (solReserve + solAfterFee);
  return Math.max(0, tokenReserve - nextTokenReserve);
};

const estimatePriceAfter = (solIn: number, solReserve: number, tokenReserve: number) => {
  const solAfterFee = Math.max(0, solIn) * (1 - CURVE_FEE_RATE);
  const k = solReserve * tokenReserve;
  const nextSolReserve = solReserve + solAfterFee;
  const nextTokenReserve = k / nextSolReserve;
  return nextSolReserve / nextTokenReserve;
};

const estimateSolOut = (tokensIn: number, solReserve: number, tokenReserve: number) => {
  if (tokensIn <= 0 || solReserve <= 0 || tokenReserve <= 0) return 0;
  const k = solReserve * tokenReserve;
  const nextSolReserve = k / (tokenReserve + tokensIn);
  const grossSolOut = Math.max(0, solReserve - nextSolReserve);
  return grossSolOut * (1 - CURVE_FEE_RATE);
};

const toRawTokenAmount = (amount: string, decimals = 9) => {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return "0";
  const [whole, fraction = ""] = trimmed.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return `${whole}${paddedFraction}`.replace(/^0+(?=\d)/, "") || "0";
};

const rawTokenAmountFromUi = (amount: number, decimals = 9) =>
  toRawTokenAmount(formatTokenAmount(Math.max(0, amount), decimals), decimals);

const displayChartValue = (priceSol: number, metric: MetricMode, quote: QuoteMode) => {
  const metricValue = metric === "mcap" ? priceSol * TOTAL_SUPPLY_UI : priceSol;
  return quote === "USD" ? metricValue * SOL_USD_PREVIEW : metricValue;
};

const formatChartValue = (value: number, metric: MetricMode, quote: QuoteMode) => {
  const suffix = quote === "USD" ? "$" : "SOL";
  if (metric === "mcap") return `${formatCompact(value, value >= 100 ? 1 : 3)} ${suffix}`;
  if (quote === "USD") return value < 0.0001 ? `$${value.toExponential(2)}` : `$${value.toFixed(6)}`;
  return value < 0.000001 ? `${value.toExponential(2)} SOL` : `${value.toFixed(8)} SOL`;
};

const buildTerminalChart = ({
  solIn,
  solReserve,
  tokenReserve,
  timeframe,
  metric,
  quote,
  chartMode,
  showVolume,
  showMa,
  logScale,
  autoScale,
}: {
  solIn: number;
  solReserve: number;
  tokenReserve: number;
  timeframe: Timeframe;
  metric: MetricMode;
  quote: QuoteMode;
  chartMode: ChartMode;
  showVolume: boolean;
  showMa: boolean;
  logScale: boolean;
  autoScale: boolean;
}) => {
  const count = CANDLE_COUNT[timeframe];
  const maxSol = Math.max(2, solReserve * 2.5, solIn * 4);
  const plotBottom = CHART_H - CHART_BOTTOM - (showVolume ? VOLUME_H : 0);
  const volumeBase = CHART_H - CHART_BOTTOM;
  const plotW = CHART_W - CHART_LEFT - CHART_RIGHT;
  const slot = plotW / count;
  const candleWidth = clamp(slot * 0.58, 4, 10);

  let previous = displayChartValue(estimatePriceAfter(0, solReserve, tokenReserve), metric, quote);
  const candles = Array.from({ length: count }, (_, index) => {
    const spend = (maxSol * index) / Math.max(1, count - 1);
    const base = displayChartValue(estimatePriceAfter(spend, solReserve, tokenReserve), metric, quote);
    const wave = Math.sin(index * 0.61) * 0.028 + Math.cos(index * 0.23) * 0.017;
    const close = Math.max(Number.EPSILON, base * (1 + wave));
    const open = previous;
    const spread = Math.max(Math.abs(close - open), close * (0.012 + ((index % 5) * 0.003)));
    const high = Math.max(open, close) + spread * (0.55 + (index % 3) * 0.12);
    const low = Math.max(Number.EPSILON, Math.min(open, close) - spread * (0.45 + (index % 4) * 0.08));
    const volume = Math.max(1, Math.abs(close - open) * 10_000 + (index % 11) * 8 + (index % 7) * 13);
    previous = close;
    return { open, close, high, low, volume };
  });

  const rawMin = Math.min(...candles.map((c) => c.low));
  const rawMax = Math.max(...candles.map((c) => c.high));
  const pad = Math.max((rawMax - rawMin) * 0.08, rawMax * 0.015);
  const min = autoScale ? Math.max(Number.EPSILON, rawMin - pad) : Math.max(Number.EPSILON, rawMin * 0.85);
  const max = autoScale ? rawMax + pad : rawMax * 1.15;
  const scaleIn = (value: number) => logScale ? Math.log10(Math.max(Number.EPSILON, value)) : value;
  const scaledMin = scaleIn(min);
  const scaledMax = scaleIn(max);
  const yScale = (value: number) =>
    plotBottom - ((scaleIn(value) - scaledMin) / Math.max(Number.EPSILON, scaledMax - scaledMin)) * (plotBottom - CHART_TOP);
  const maxVolume = Math.max(...candles.map((c) => c.volume));
  const activeIndex = clamp(Math.floor((clamp(solIn, 0, maxSol) / maxSol) * count), 0, count - 1);

  const mapped = candles.map((candle, index) => {
    const x = CHART_LEFT + index * slot + slot / 2;
    const bodyY = yScale(Math.max(candle.open, candle.close));
    const bodyBottom = yScale(Math.min(candle.open, candle.close));
    return {
      ...candle,
      x,
      yOpen: yScale(candle.open),
      yClose: yScale(candle.close),
      yHigh: yScale(candle.high),
      yLow: yScale(candle.low),
      bodyY,
      bodyHeight: Math.max(3, bodyBottom - bodyY),
      candleWidth,
      up: candle.close >= candle.open,
      active: index === activeIndex,
      volumeY: volumeBase - (candle.volume / maxVolume) * (VOLUME_H - 12),
      volumeHeight: Math.max(2, (candle.volume / maxVolume) * (VOLUME_H - 12)),
    };
  });

  const linePath = mapped
    .map((candle, index) => `${index === 0 ? "M" : "L"} ${candle.x.toFixed(2)} ${candle.yClose.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L ${mapped[mapped.length - 1].x.toFixed(2)} ${plotBottom} L ${mapped[0].x.toFixed(2)} ${plotBottom} Z`;
  const maPath = mapped
    .map((_, index) => {
      const start = Math.max(0, index - 5);
      const slice = mapped.slice(start, index + 1);
      const avg = slice.reduce((sum, candle) => sum + candle.close, 0) / slice.length;
      return `${index === 0 ? "M" : "L"} ${mapped[index].x.toFixed(2)} ${yScale(avg).toFixed(2)}`;
    })
    .join(" ");
  const priceLabels = Array.from({ length: 7 }, (_, index) => {
    const value = min + ((max - min) * (6 - index)) / 6;
    return {
      value,
      y: CHART_TOP + ((plotBottom - CHART_TOP) * index) / 6,
      label: formatChartValue(value, metric, quote),
    };
  });
  const timeLabels = ["00:21", "00:21:16", "19 May '26", "00:22", "00:22:32", "00:23", "00:24", "00:24:33"].map((label, index, all) => ({
    label,
    x: CHART_LEFT + (plotW * index) / (all.length - 1),
  }));
  const active = mapped[activeIndex];
  return {
    candles: mapped,
    linePath,
    areaPath,
    maPath,
    priceLabels,
    timeLabels,
    plotBottom,
    volumeBase,
    active,
    maxSol,
    min,
    max,
    chartMode,
    showMa,
    showVolume,
  };
};

export const Trade = ({ goDiscover }: { goDiscover: () => void }) => {
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const walletAddress = wallet.publicKey?.toBase58() ?? "";
  const [mintInput, setMintInput] = useState("");
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
  const [timeframe, setTimeframe] = useState<Timeframe>("1s");
  const [chartMode, setChartMode] = useState<ChartMode>("candles");
  const [metricMode, setMetricMode] = useState<MetricMode>("mcap");
  const [quoteMode, setQuoteMode] = useState<QuoteMode>("SOL");
  const [showIndicators, setShowIndicators] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showMa, setShowMa] = useState(true);
  const [showCrosshair, setShowCrosshair] = useState(true);
  const [logScale, setLogScale] = useState(false);
  const [autoScale, setAutoScale] = useState(true);
  const [fullChart, setFullChart] = useState(false);
  const [activeTool, setActiveTool] = useState("cross");
  const [toolHistory, setToolHistory] = useState(["cross"]);
  const [toolHistoryIndex, setToolHistoryIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    isProgramExecutable(connection, PROGRAM_ID_V2_PK)
      .then((available) => {
        if (mounted) setV2Available(available);
      })
      .catch((err) => {
        console.warn("Unable to check v2 curve program on devnet", err);
        if (mounted) setV2Available(false);
      });
    return () => { mounted = false; };
  }, [connection]);

  const solIn = parsePositive(solAmount, 0);
  const previewSolReserve = parsePositive(reserveSol, PREVIEW_SOL_RESERVE);
  const previewTokenReserve = parsePositive(reserveTokens, PREVIEW_TOKEN_RESERVE);
  const estimatedTokens = estimateTokensOut(solIn, previewSolReserve, previewTokenReserve);
  const tokensIn = parsePositive(tokensAmount, 0);
  const estimatedSol = estimateSolOut(tokensIn, previewSolReserve, previewTokenReserve);
  const currentPrice = previewSolReserve / previewTokenReserve;
  const nextPrice = estimatePriceAfter(solIn, previewSolReserve, previewTokenReserve);
  const priceImpact = currentPrice > 0 ? ((nextPrice - currentPrice) / currentPrice) * 100 : 0;
  const chart = useMemo(
    () => buildTerminalChart({
      solIn,
      solReserve: previewSolReserve,
      tokenReserve: previewTokenReserve,
      timeframe,
      metric: metricMode,
      quote: quoteMode,
      chartMode,
      showVolume,
      showMa,
      logScale,
      autoScale,
    }),
    [solIn, previewSolReserve, previewTokenReserve, timeframe, metricMode, quoteMode, chartMode, showVolume, showMa, logScale, autoScale]
  );

  const validMint = mintInput.trim().length > 30;
  const selectedMint = mintInput.trim();
  const canUseCurve = v2Available === true;
  const canTrade = canUseCurve && wallet.connected && busy === null && validMint;
  const solscanUrl = validMint
    ? `https://solscan.io/token/${selectedMint}?cluster=devnet`
    : null;
  const savedTokenMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof listTokens>[number]>();
    listTokens().forEach((token) => map.set(token.mint, token));
    return map;
  }, [walletTokens.length, tokenPickerOpen]);
  const selectedWalletToken = walletTokens.find((token) => token.mint === selectedMint);
  const selectedDecimals = selectedWalletToken?.decimals ?? 9;
  const selectedSymbol = selectedWalletToken?.symbol || savedTokenMap.get(selectedMint)?.symbol || "TOKEN";
  const sellBalanceExceeded = side === "sell" && !!selectedWalletToken && tokensIn > selectedWalletToken.balance + 10 ** -selectedDecimals;
  const sellBalanceMissing = side === "sell" && wallet.connected && validMint && !tokenPickerBusy && !selectedWalletToken;
  const canSubmitTrade = canTrade && (side === "buy"
    ? solIn > 0
    : tokensIn > 0 && !!selectedWalletToken && !sellBalanceExceeded);

  const loadWalletTokens = async () => {
    if (!wallet.publicKey) {
      setWalletTokens([]);
      return;
    }
    setTokenPickerBusy(true);
    setTokenPickerError(null);
    try {
      const parsed = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });
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
        if (existing) {
          existing.balance += balance;
        } else {
          byMint.set(mint, {
            mint,
            balance,
            decimals: amountInfo.decimals ?? 9,
            symbol: saved?.symbol || shortAddress(mint),
            name: saved?.name || "Wallet token",
            logo: saved?.logo,
          });
        }
      });
      setWalletTokens([...byMint.values()].sort((a, b) => b.balance - a.balance));
    } catch (e: any) {
      setTokenPickerError(e.message || String(e));
    } finally {
      setTokenPickerBusy(false);
    }
  };

  useEffect(() => {
    if (!wallet.connected || !wallet.publicKey) {
      setWalletTokens([]);
      return;
    }
    void loadWalletTokens();
  }, [walletAddress, wallet.connected, connection]);

  const refreshReserves = async (mintOverride?: string) => {
    const mintValue = (mintOverride ?? mintInput).trim();
    if (mintValue.length <= 30) return;
    if (!canUseCurve) {
      setReserveError("V2 curve program is not deployed on devnet yet.");
      return;
    }
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

  const selectWalletToken = (token: WalletTokenOption) => {
    setMintInput(token.mint);
    setTokenPickerOpen(false);
    void refreshReserves(token.mint);
  };

  const setMaxSellAmount = () => {
    if (!selectedWalletToken) return;
    setTokensAmount(formatTokenAmount(selectedWalletToken.balance, selectedDecimals));
  };

  const selectTool = (toolId: string) => {
    setActiveTool(toolId);
    setToolHistory((history) => {
      const next = [...history.slice(0, toolHistoryIndex + 1), toolId];
      setToolHistoryIndex(next.length - 1);
      return next;
    });
  };

  const undoTool = () => {
    setToolHistoryIndex((index) => {
      const nextIndex = Math.max(0, index - 1);
      setActiveTool(toolHistory[nextIndex] ?? "cross");
      return nextIndex;
    });
  };

  const redoTool = () => {
    setToolHistoryIndex((index) => {
      const nextIndex = Math.min(toolHistory.length - 1, index + 1);
      setActiveTool(toolHistory[nextIndex] ?? "cross");
      return nextIndex;
    });
  };

  const exportChartImage = () => {
    const canvas = document.querySelector<HTMLCanvasElement>(".live-chart-host canvas");
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `humbletrust-${selectedSymbol.toLowerCase()}-${timeframe}-chart.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const resetChart = () => {
    setTimeframe("1s");
    setChartMode("candles");
    setMetricMode("mcap");
    setQuoteMode("SOL");
    setShowVolume(true);
    setShowMa(true);
    setShowCrosshair(true);
    setLogScale(false);
    setAutoScale(true);
    setActiveTool("cross");
    setToolHistory(["cross"]);
    setToolHistoryIndex(0);
  };

  const runBuy = async () => {
    if (!anchorWallet || !wallet.connected) return;
    setBusy("buy"); setTradeError(null); setTxSig(null);
    try {
      const deployed = await isProgramExecutable(connection, PROGRAM_ID_V2_PK);
      setV2Available(deployed);
      if (!deployed) throw new Error("V2 curve program is not deployed on devnet yet.");
      const mint = new PublicKey(mintInput.trim());
      const ata = getAssociatedTokenAddressSync(mint, anchorWallet.publicKey);
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program = getProgramV2(provider);
      const minTokensOut = rawTokenAmountFromUi(
        estimatedTokens * (1 - slippageBps / 10_000),
        selectedDecimals
      );
      const { signature } = await buyOnCurveV2(program, anchorWallet.publicKey, mint, ata, Number(solAmount), minTokensOut);
      setTxSig(signature);
      await refreshReserves();
    } catch (e: any) {
      setTradeError(e.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const runSell = async () => {
    if (!anchorWallet || !wallet.connected) return;
    setBusy("sell"); setTradeError(null); setTxSig(null);
    try {
      const deployed = await isProgramExecutable(connection, PROGRAM_ID_V2_PK);
      setV2Available(deployed);
      if (!deployed) throw new Error("V2 curve program is not deployed on devnet yet.");
      const mint = new PublicKey(mintInput.trim());
      const ata = getAssociatedTokenAddressSync(mint, anchorWallet.publicKey);
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program = getProgramV2(provider);
      const minSolOutLamports = Math.floor(
        estimatedSol * LAMPORTS_PER_SOL * (1 - slippageBps / 10_000)
      ).toString();
      const { signature } = await sellOnCurveV2(
        program,
        anchorWallet.publicKey,
        mint,
        ata,
        toRawTokenAmount(tokensAmount, selectedDecimals),
        minSolOutLamports
      );
      setTxSig(signature);
      await refreshReserves();
    } catch (e: any) {
      setTradeError(e.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <div className="sec-eyebrow">Trade</div>
      <h2 className="sec-h2">Trade <span className="hl-green">protected</span> tokens</h2>
      <p className="sec-sub">
        {canUseCurve
          ? "V2 devnet tokens trade instantly through the HumbleTrust bonding curve. Raydium CPMM migration is the active devnet integration milestone after the SOL threshold."
          : "V2 curve trading is waiting for the devnet program deploy. Launch currently uses the live v1 token-lock flow."}
      </p>

      {v2Available === false && (
        <div className="trade-alert">
          <AlertTriangle size={18} color="var(--orange)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="trade-alert-title">V2 curve deploy pending</div>
            <div className="trade-alert-text">
              The configured v2 program id is not executable on devnet yet, so curve buy/sell actions are disabled.
            </div>
          </div>
        </div>
      )}

      <div className="trade-alert">
        <AlertTriangle size={18} color="var(--orange)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div className="trade-alert-title">Anti-bot delay active on new tokens</div>
          <div className="trade-alert-text">
            Each token has a 0-600 second trading delay after launch. If a transaction fails immediately after launch,
            wait for the delay to expire and retry on devnet.
          </div>
        </div>
      </div>

      <div className="trade-alert trade-alert-blue">
        <TrendingUp size={18} color="var(--solana-blue)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div className="trade-alert-title blue">Raydium CPMM migration status</div>
          <div className="trade-alert-text">
            HumbleTrust targets real Raydium CPMM CPI migration from PDA reserves. The current public trade flow stays on devnet curve until CPI pool creation, LP custody, and leftover burn are verified.
          </div>
        </div>
      </div>

      <div className={fullChart ? "trade-grid chart-expanded-grid" : "trade-grid"}>
        <div className="swap-panel">
          <div className="panel-head">
            <div className="panel-title">
              <Zap size={16} color="var(--green-neon)" /> Mini Swap
            </div>
            <span className="network-pill">{canUseCurve ? "DEVNET" : "V2 PENDING"}</span>
          </div>

          <label className="form-label">Token mint</label>
          <div className="token-picker">
            <input
              className="form-input"
              placeholder={wallet.connected ? "Click to pick wallet token or paste mint" : "Connect wallet or paste mint"}
              value={mintInput}
              onChange={(e) => setMintInput(e.target.value)}
              onFocus={() => {
                setTokenPickerOpen(true);
                void loadWalletTokens();
              }}
              onClick={() => {
                setTokenPickerOpen(true);
                void loadWalletTokens();
              }}
              onBlur={() => window.setTimeout(() => setTokenPickerOpen(false), 180)}
            />
            {tokenPickerOpen && (
              <div className="token-picker-menu">
                <div className="token-picker-head">
                  <span>Wallet tokens</span>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={loadWalletTokens}>
                    {tokenPickerBusy ? "Loading" : "Refresh"}
                  </button>
                </div>
                {!wallet.connected && <div className="token-picker-empty">Connect wallet to list token balances.</div>}
                {wallet.connected && tokenPickerBusy && <div className="token-picker-empty">Scanning wallet token accounts...</div>}
                {wallet.connected && !tokenPickerBusy && walletTokens.length === 0 && (
                  <div className="token-picker-empty">No SPL tokens found in this wallet on devnet.</div>
                )}
                {tokenPickerError && <div className="token-picker-error">{tokenPickerError}</div>}
                {walletTokens.map((token) => (
                  <button
                    type="button"
                    key={token.mint}
                    className="token-picker-row"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectWalletToken(token)}
                  >
                    <div className="token-picker-logo">
                      {token.logo ? <img src={token.logo} alt="" /> : token.symbol.slice(0, 2)}
                    </div>
                    <div className="token-picker-main">
                      <strong>{token.symbol}</strong>
                      <span>{token.name} · {shortAddress(token.mint)}</span>
                    </div>
                    <div className="token-picker-balance">{formatCompact(token.balance, 4)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="trade-tabs">
            <button className={side === "buy" ? "active" : ""} onClick={() => setSide("buy")} type="button">Buy</button>
            <button className={side === "sell" ? "active" : ""} onClick={() => setSide("sell")} type="button">Sell</button>
          </div>

          <div className="swap-box">
            <div className="swap-box-head">
              <span>From</span>
              <span>{side === "buy" ? "SOL" : selectedSymbol}</span>
            </div>
            <div className="swap-input-row">
              <input
                className="swap-amount-input"
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
                  className="swap-max-btn"
                  disabled={!selectedWalletToken}
                  onClick={setMaxSellAmount}
                >
                  MAX
                </button>
              )}
            </div>
            {side === "sell" && (
              <div className="swap-balance-line">
                <span>Wallet balance</span>
                <strong>
                  {selectedWalletToken
                    ? `${formatTokenAmount(selectedWalletToken.balance, selectedDecimals)} ${selectedSymbol}`
                    : wallet.connected && validMint
                      ? "0 TOKEN"
                      : "Select token"}
                </strong>
              </div>
            )}
          </div>

          <div className="swap-arrow">
            <ArrowDown size={16} />
          </div>

          <div className="swap-box">
            <div className="swap-box-head">
              <span>To est.</span>
              <span>{side === "buy" ? selectedSymbol : "SOL"}</span>
            </div>
            <div className="swap-output">
              {side === "buy" ? formatCompact(estimatedTokens, 4) : formatCompact(estimatedSol, 6)}
            </div>
          </div>

          <div className="swap-meta-row">
            <span>Fee</span>
            <strong>{(CURVE_FEE_RATE * 100).toFixed(0)}%</strong>
          </div>
          <div className="swap-meta-row">
            <span>Slippage guard</span>
            <strong>{(slippageBps / 100).toFixed(slippageBps % 100 === 0 ? 0 : 1)}%</strong>
          </div>
          <div className="slippage-control">
            {[50, 100, 300].map((bps) => (
              <button
                key={bps}
                type="button"
                className={slippageBps === bps ? "active" : ""}
                onClick={() => setSlippageBps(bps)}
              >
                {(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%
              </button>
            ))}
            <input
              aria-label="Custom slippage percent"
              value={(slippageBps / 100).toString()}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isFinite(value) && value >= 0 && value <= 25) {
                  setSlippageBps(Math.round(value * 100));
                }
              }}
            />
          </div>
          {slippageBps === 0 && (
            <div className="trade-error">0% slippage can fail on any price movement. Use only for exact tests.</div>
          )}
          <div className="swap-meta-row">
            <span>{side === "buy" ? "Price impact" : "Sell amount"}</span>
            <strong>{side === "buy" ? `${formatCompact(priceImpact, 2)}%` : `${formatTokenAmount(tokensIn, selectedDecimals)} ${selectedSymbol}`}</strong>
          </div>
          {sellBalanceExceeded && (
            <div className="trade-error">Sell amount is higher than wallet balance. Use MAX or lower the amount.</div>
          )}
          {sellBalanceMissing && (
            <div className="trade-error">This mint is not found in the connected wallet token balances.</div>
          )}

          <button
            onClick={side === "buy" ? runBuy : runSell}
            disabled={!canSubmitTrade}
            className={side === "buy" ? "swap-action" : "swap-action sell-mode"}
          >
            {busy === "buy" ? "Buying..." : busy === "sell" ? "Selling..." : side === "buy" ? "Buy on Curve" : "Sell on Curve"}
          </button>

          {solscanUrl && (
            <a href={solscanUrl} target="_blank" rel="noreferrer" className="trade-link">
              View token on Solscan devnet <ExternalLink size={11} />
            </a>
          )}
          {txSig && <div className="trade-success">Curve tx: {txSig}</div>}
          {tradeError && <div className="trade-error">{tradeError}</div>}
        </div>

        <div className={fullChart ? "curve-panel terminal-full" : "curve-panel"}>
          <div className="chart-terminal">
            <div className="chart-topbar">
              <button className="chart-round" type="button">+</button>
              <span className="chart-divider" />
              {TIMEFRAMES.map((tf) => (
                <button
                  type="button"
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={timeframe === tf ? "chart-menu-btn active" : "chart-menu-btn"}
                >
                  {tf}
                </button>
              ))}
              <span className="chart-divider" />
              <button type="button" className={chartMode === "line" ? "chart-menu-btn active" : "chart-menu-btn"} onClick={() => setChartMode("line")}>Line</button>
              <button type="button" className={chartMode === "candles" ? "chart-menu-btn active" : "chart-menu-btn"} onClick={() => setChartMode("candles")}>Candles</button>
              <button type="button" className={chartMode === "area" ? "chart-menu-btn active" : "chart-menu-btn"} onClick={() => setChartMode("area")}>Area</button>
              <span className="chart-divider" />
              <button type="button" className="chart-menu-btn" onClick={() => setShowIndicators((v) => !v)}>fx Indicators</button>
              <span className="chart-divider" />
              <button type="button" className="chart-menu-btn active" onClick={() => setMetricMode((v) => v === "price" ? "mcap" : "price")}>
                {metricMode === "price" ? "Price" : "Price / MCap"}
              </button>
              <button type="button" className="chart-menu-btn active" onClick={() => setQuoteMode((v) => v === "SOL" ? "USD" : "SOL")}>
                {quoteMode === "SOL" ? "USD / SOL" : "USD / SOL"}
              </button>
              <button type="button" className="chart-menu-btn" onClick={() => setFullChart((v) => !v)}>
                {fullChart ? "Exit Full" : "Full"}
              </button>
              <button type="button" className="chart-icon-btn" title="Undo" onClick={undoTool}>↶</button>
              <button type="button" className="chart-icon-btn" title="Redo" onClick={redoTool}>↷</button>
              <button type="button" className="chart-icon-btn" title="Reset chart" onClick={resetChart}>⟲</button>
              <button type="button" className="chart-icon-btn" title="Export chart PNG" onClick={exportChartImage}>▣</button>
            </div>

            {showIndicators && (
              <div className="indicator-menu">
                <label><input type="checkbox" checked={showVolume} onChange={(e) => setShowVolume(e.target.checked)} /> Volume</label>
                <label><input type="checkbox" checked={showMa} onChange={(e) => setShowMa(e.target.checked)} /> Moving average</label>
                <label><input type="checkbox" checked={showCrosshair} onChange={(e) => setShowCrosshair(e.target.checked)} /> Crosshair</label>
                <label><input type="checkbox" checked={logScale} onChange={(e) => setLogScale(e.target.checked)} /> Log</label>
                <label><input type="checkbox" checked={autoScale} onChange={(e) => setAutoScale(e.target.checked)} /> Auto scale</label>
              </div>
            )}

            <div className="chart-body">
              <div className="chart-left-tools">
                {DRAWING_TOOLS.map((tool) => (
                  <button
                    type="button"
                    key={tool.id}
                    title={tool.label}
                    className={activeTool === tool.id ? "tool-btn active" : "tool-btn"}
                    onClick={() => tool.id === "trash" ? resetChart() : selectTool(tool.id)}
                  >
                    {tool.mark}
                  </button>
                ))}
              </div>

              <div className="chart-stage">
                <div className="chart-title">
                  <span className="pair-dot" />
                  {selectedSymbol} / SOL <strong>({metricMode === "mcap" ? "Market Cap" : "Price"})</strong> on HumbleCurve · {timeframe} · devnet
                </div>
                <div className="chart-ohlc">
                  Live OHLCV from HumbleTrust indexer
                </div>
                <div className="chart-volume-label">Volume <span>{showVolume ? "live" : "off"}</span></div>
                <LiveMarketChart
                  mint={selectedMint}
                  timeframe={timeframe}
                  mode={chartMode}
                  showVolume={showVolume}
                />
              </div>
            </div>

            <div className="chart-bottom-tabs">
              <button type="button" className="active">Transactions</button>
              <button type="button">Top Traders</button>
              <button type="button">KOLs</button>
              <button type="button">Holders</button>
              <button type="button">Bubblemaps</button>
              <div className="chart-status">
                00:24:48 (UTC+1) <button type="button" onClick={() => setLogScale((v) => !v)} className={logScale ? "active" : ""}>log</button>
                <button type="button" onClick={() => setAutoScale((v) => !v)} className={autoScale ? "active" : ""}>auto</button>
              </div>
            </div>
          </div>

          <div className="curve-stat-grid">
            <div>
              <span>Now</span>
              <strong>{formatPrice(currentPrice)}</strong>
            </div>
            <div>
              <span>{side === "buy" ? "After buy" : "Sell est."}</span>
              <strong>{side === "buy" ? formatPrice(nextPrice) : `${formatCompact(estimatedSol, 6)} SOL`}</strong>
            </div>
            <div>
              <span>SOL reserve</span>
              <strong>{formatCompact(previewSolReserve, 2)}</strong>
            </div>
            <div>
              <span>Token reserve</span>
              <strong>{formatCompact(previewTokenReserve, 2)}</strong>
            </div>
          </div>

          <div className="curve-reserve-row">
            <div>
              <label className="form-label">Preview SOL reserve</label>
              <input
                className="form-input compact-input"
                type="number"
                min={0.01}
                step={0.1}
                value={reserveSol}
                onChange={(e) => {
                  setReserveSource("preview");
                  setReserveSol(e.target.value);
                }}
              />
            </div>
            <div>
              <label className="form-label">Preview token reserve</label>
              <input
                className="form-input compact-input"
                type="number"
                min={1}
                step={1000000}
                value={reserveTokens}
                onChange={(e) => {
                  setReserveSource("preview");
                  setReserveTokens(e.target.value);
                }}
              />
            </div>
            <button className="reserve-refresh reserve-refresh-wide" onClick={() => refreshReserves()} disabled={!validMint || reservesBusy || !canUseCurve}>
              <RefreshCw size={13} className={reservesBusy ? "spin" : undefined} /> {reserveSource === "chain" ? "Live devnet" : "Refresh"}
            </button>
          </div>
          {reserveError && <div className="trade-error">{reserveError}</div>}
        </div>
      </div>

      <div style={{ background: "var(--bg3)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1rem", marginBottom: ".75rem", display: "flex", alignItems: "center", gap: 8 }}>
          <TrendingUp size={16} color="var(--solana-blue)" /> Check TrustScore before buying
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          {[
            { score: "85-100", label: "ELITE", color: "var(--green-neon)", rec: "Highest launch quality: strong lock, low creator allocation, high liquidity, burn active." },
            { score: "70-84", label: "STRONG", color: "var(--solana-blue)", rec: "Good fundamentals. Check vesting status, curve reserves, and vote count." },
            { score: "40-69", label: "OK", color: "var(--yellow)", rec: "Meets minimum rules. Research creator history before buying." },
            { score: "0-39", label: "WEAK", color: "var(--orange)", rec: "High risk. Weak distribution, low burn/liquidity, or complaints detected." },
          ].map((t) => (
            <div key={t.label} style={{ background: "var(--bg4)", borderRadius: 8, padding: ".85rem", border: `1px solid ${t.color}22` }}>
              <div style={{ color: t.color, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: ".9rem" }}>{t.score}</div>
              <div style={{ fontWeight: 700, fontSize: ".82rem", marginBottom: ".3rem" }}>{t.label}</div>
              <div style={{ fontSize: ".75rem", color: "var(--muted2)", lineHeight: 1.5 }}>{t.rec}</div>
            </div>
          ))}
        </div>
        <button
          onClick={goDiscover}
          style={{ marginTop: "1rem", background: "rgba(20,102,255,.1)", border: "1px solid rgba(20,102,255,.25)", color: "var(--solana-blue)", borderRadius: 8, padding: ".5rem 1rem", fontSize: ".8rem", cursor: "pointer" }}
        >
          Browse all tokens in Discover
        </button>
      </div>

      <div style={{ background: "var(--bg3)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "1.5rem" }}>
        <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1rem", marginBottom: ".75rem", display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={16} color="var(--muted)" /> Pre-trade checklist
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: ".6rem" }}>
          {[
            ["TrustScore", "Check score in Discover - aim for 66+ before buying"],
            ["Lock status", "Confirm is_locked = true and unlock_time is in the future"],
            ["Anti-bot", "Verify trading_unlock_time has passed"],
            ["Votes", "Check positive_votes vs negative_votes ratio"],
            ["Liquidity", "Verify curve treasury and pool vault before swapping"],
            ["Creator", "Check creator reputation PDA for launch history"],
          ].map(([key, val]) => (
            <li key={key} style={{ display: "flex", gap: ".75rem", fontSize: ".8rem", padding: ".5rem .75rem", background: "var(--bg4)", borderRadius: 6 }}>
              <span style={{ color: "var(--green-neon)", fontFamily: "var(--font-mono)", minWidth: 100, flexShrink: 0 }}>{key}</span>
              <span style={{ color: "var(--muted2)" }}>{val}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

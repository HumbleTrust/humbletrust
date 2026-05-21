import { useEffect, useMemo, useState } from "react";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  AlertTriangle,
  ArrowDown,
  Clock,
  ExternalLink,
  Maximize2,
  Minimize2,
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
import { LiveMarketChart, ChartIndicators } from "../components/LiveMarketChart";

const PREVIEW_TOKEN_RESERVE = 350_000_000;
const PREVIEW_SOL_RESERVE = 0.5;
const CURVE_FEE_RATE = 0.01;

type TradeSide = "buy" | "sell";
type ChartMode = "candles" | "line" | "area";
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
  return msg.length > 120 ? msg.slice(0, 120) + "…" : msg;
};

const formatPrice = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value < 0.000001) return value.toExponential(2);
  return value.toFixed(8);
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

  // chart controls
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [chartMode, setChartMode] = useState<ChartMode>("candles");
  const [showVolume, setShowVolume] = useState(true);
  const [showIndicators, setShowIndicators] = useState(false);
  const [fullChart, setFullChart] = useState(false);
  const [indicators, setIndicators] = useState<ChartIndicators>({ sma20: false, sma50: false, ema20: false, rsi: false });
  const toggleIndicator = (key: keyof ChartIndicators) =>
    setIndicators(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    let mounted = true;
    isProgramExecutable(connection, PROGRAM_ID_V2_PK)
      .then((available) => { if (mounted) setV2Available(available); })
      .catch(() => { if (mounted) setV2Available(false); });
    return () => { mounted = false; };
  }, [connection]);

  const solIn = useMemo(() => parsePositive(solAmount, 0), [solAmount]);
  const tokensIn = useMemo(() => parsePositive(tokensAmount, 0), [tokensAmount]);
  const previewSolReserve = useMemo(() => parsePositive(reserveSol, PREVIEW_SOL_RESERVE), [reserveSol]);
  const previewTokenReserve = useMemo(() => parsePositive(reserveTokens, PREVIEW_TOKEN_RESERVE), [reserveTokens]);
  const estimatedTokens = useMemo(() => estimateTokensOut(solIn, previewSolReserve, previewTokenReserve), [solIn, previewSolReserve, previewTokenReserve]);
  const estimatedSol = useMemo(() => estimateSolOut(tokensIn, previewSolReserve, previewTokenReserve), [tokensIn, previewSolReserve, previewTokenReserve]);
  const currentPrice = useMemo(() => previewSolReserve / previewTokenReserve, [previewSolReserve, previewTokenReserve]);
  const nextPrice = useMemo(() => estimatePriceAfter(solIn, previewSolReserve, previewTokenReserve), [solIn, previewSolReserve, previewTokenReserve]);
  const priceImpact = useMemo(() => currentPrice > 0 ? ((nextPrice - currentPrice) / currentPrice) * 100 : 0, [currentPrice, nextPrice]);

  const validMint = mintInput.trim().length > 30;
  const selectedMint = mintInput.trim();
  const canUseCurve = v2Available === true;
  const canTrade = canUseCurve && wallet.connected && busy === null && validMint;
  const solscanUrl = validMint ? `https://solscan.io/token/${selectedMint}?cluster=devnet` : null;

  const savedTokenMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof listTokens>[number]>();
    listTokens().forEach((token) => map.set(token.mint, token));
    return map;
  }, [walletTokens]);

  const selectedWalletToken = walletTokens.find((t) => t.mint === selectedMint);
  const selectedDecimals = selectedWalletToken?.decimals ?? 9;
  const selectedSymbol = selectedWalletToken?.symbol || savedTokenMap.get(selectedMint)?.symbol || "TOKEN";
  const sellBalanceExceeded = side === "sell" && !!selectedWalletToken && tokensIn > selectedWalletToken.balance + 10 ** -selectedDecimals;
  const sellBalanceMissing = side === "sell" && wallet.connected && validMint && !tokenPickerBusy && !selectedWalletToken;
  const canSubmitTrade = canTrade && (side === "buy"
    ? solIn > 0
    : tokensIn > 0 && !!selectedWalletToken && !sellBalanceExceeded);

  const loadWalletTokens = async () => {
    if (!wallet.publicKey) { setWalletTokens([]); return; }
    setTokenPickerBusy(true);
    setTokenPickerError(null);
    try {
      const parsed = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, { programId: TOKEN_PROGRAM_ID });
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
            mint, balance, decimals: amountInfo.decimals ?? 9,
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
    if (!wallet.connected || !wallet.publicKey) { setWalletTokens([]); return; }
    void loadWalletTokens();
  }, [walletAddress, wallet.connected, connection]);

  const refreshReserves = async (mintOverride?: string) => {
    const mintValue = (mintOverride ?? mintInput).trim();
    if (mintValue.length <= 30) return;
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

  const selectWalletToken = (token: WalletTokenOption) => {
    setMintInput(token.mint);
    setTokenPickerOpen(false);
    void refreshReserves(token.mint);
  };

  const setMaxSellAmount = () => {
    if (!selectedWalletToken) return;
    setTokensAmount(formatTokenAmount(selectedWalletToken.balance, selectedDecimals));
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
      const minTokensOut = rawTokenAmountFromUi(estimatedTokens * (1 - slippageBps / 10_000), selectedDecimals);
      const { signature } = await buyOnCurveV2(program, anchorWallet.publicKey, mint, ata, Number(solAmount), minTokensOut);
      setTxSig(signature);
      await Promise.all([refreshReserves(), loadWalletTokens()]);
    } catch (e: any) {
      setTradeError(friendlyError(e.message || String(e)));
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
      const minSolOutLamports = Math.floor(estimatedSol * LAMPORTS_PER_SOL * (1 - slippageBps / 10_000)).toString();
      const { signature } = await sellOnCurveV2(
        program, anchorWallet.publicKey, mint, ata,
        toRawTokenAmount(tokensAmount, selectedDecimals), minSolOutLamports
      );
      setTxSig(signature);
      await Promise.all([refreshReserves(), loadWalletTokens()]);
    } catch (e: any) {
      setTradeError(friendlyError(e.message || String(e)));
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
          ? "V2 devnet tokens trade through the HumbleTrust bonding curve. Chart updates live from the indexer."
          : "V2 curve trading is waiting for the devnet program deploy."}
      </p>

      {v2Available === false && (
        <div className="trade-alert">
          <AlertTriangle size={18} color="var(--orange)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="trade-alert-title">V2 curve deploy pending</div>
            <div className="trade-alert-text">
              The configured v2 program ID is not executable on devnet yet — curve buy/sell is disabled.
            </div>
          </div>
        </div>
      )}

      <div className="trade-alert">
        <AlertTriangle size={18} color="var(--orange)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div className="trade-alert-title">Anti-bot delay active on new tokens</div>
          <div className="trade-alert-text">
            Each token has a 0–600 second trading delay after launch. If a tx fails immediately after launch, wait for the delay to expire.
          </div>
        </div>
      </div>

      <div className="trade-grid">
        {/* ── Swap panel ── */}
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
              onFocus={() => { setTokenPickerOpen(true); void loadWalletTokens(); }}
              onClick={() => { setTokenPickerOpen(true); void loadWalletTokens(); }}
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
                {wallet.connected && tokenPickerBusy && <div className="token-picker-empty">Scanning wallet...</div>}
                {wallet.connected && !tokenPickerBusy && walletTokens.length === 0 && (
                  <div className="token-picker-empty">No SPL tokens found in this wallet on devnet.</div>
                )}
                {tokenPickerError && <div className="token-picker-error">{tokenPickerError}</div>}
                {walletTokens.map((token) => (
                  <button
                    type="button" key={token.mint}
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
                type="text" inputMode="decimal"
                value={side === "buy" ? solAmount : tokensAmount}
                onChange={(e) => {
                  const next = normalizeAmountInput(e.target.value);
                  if (!isAmountInput(next)) return;
                  if (side === "buy") setSolAmount(next);
                  else setTokensAmount(next);
                }}
              />
              {side === "sell" && (
                <button type="button" className="swap-max-btn" disabled={!selectedWalletToken} onClick={setMaxSellAmount}>
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
                    : wallet.connected && validMint ? "0 TOKEN" : "Select token"}
                </strong>
              </div>
            )}
          </div>

          <div className="swap-arrow"><ArrowDown size={16} /></div>

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
              <button key={bps} type="button" className={slippageBps === bps ? "active" : ""} onClick={() => setSlippageBps(bps)}>
                {(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%
              </button>
            ))}
            <input
              aria-label="Custom slippage percent"
              value={(slippageBps / 100).toString()}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isFinite(value) && value >= 0 && value <= 25) setSlippageBps(Math.round(value * 100));
              }}
            />
          </div>

          {slippageBps === 0 && (
            <div className="trade-error">0% slippage will fail on any price movement. Use only for exact tests.</div>
          )}

          <div className="swap-meta-row">
            <span>{side === "buy" ? "Price impact" : "Sell amount"}</span>
            <strong>
              {side === "buy"
                ? `${formatCompact(priceImpact, 2)}%`
                : `${formatTokenAmount(tokensIn, selectedDecimals)} ${selectedSymbol}`}
            </strong>
          </div>

          {sellBalanceExceeded && (
            <div className="trade-error">Sell amount exceeds wallet balance. Use MAX or lower the amount.</div>
          )}
          {sellBalanceMissing && (
            <div className="trade-error">This mint is not in your connected wallet.</div>
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
              View on Solscan devnet <ExternalLink size={11} />
            </a>
          )}
          {txSig && (
            <a
              href={`https://solscan.io/tx/${txSig}?cluster=devnet`}
              target="_blank" rel="noreferrer"
              className="trade-success"
            >
              Tx: {txSig.slice(0, 12)}... <ExternalLink size={10} />
            </a>
          )}
          {tradeError && <div className="trade-error">{tradeError}</div>}
        </div>

        {/* ── Chart panel ── */}
        <div className={fullChart ? "curve-panel terminal-full" : "curve-panel"}>
          <div className="chart-terminal">
            <div className="chart-topbar">
              {/* Timeframes */}
              {TIMEFRAMES.map((tf) => (
                <button
                  type="button" key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={timeframe === tf ? "chart-menu-btn active" : "chart-menu-btn"}
                >
                  {tf}
                </button>
              ))}
              <span className="chart-divider" />

              {/* Chart type */}
              <button type="button" className={chartMode === "candles" ? "chart-menu-btn active" : "chart-menu-btn"} onClick={() => setChartMode("candles")}>Candles</button>
              <button type="button" className={chartMode === "line" ? "chart-menu-btn active" : "chart-menu-btn"} onClick={() => setChartMode("line")}>Line</button>
              <button type="button" className={chartMode === "area" ? "chart-menu-btn active" : "chart-menu-btn"} onClick={() => setChartMode("area")}>Area</button>
              <span className="chart-divider" />

              {/* Indicators toggle */}
              <button type="button" className={showIndicators ? "chart-menu-btn active" : "chart-menu-btn"} onClick={() => setShowIndicators((v) => !v)}>
                fx Indicators
              </button>
              <span className="chart-divider" />

              {/* Full screen */}
              <button type="button" className="chart-icon-btn" title={fullChart ? "Exit full" : "Expand"} onClick={() => setFullChart((v) => !v)}>
                {fullChart ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            </div>

            {showIndicators && (
              <div className="indicator-menu">
                <label><input type="checkbox" checked={showVolume} onChange={(e) => setShowVolume(e.target.checked)} /> Volume</label>
                <label><input type="checkbox" checked={indicators.sma20} onChange={() => toggleIndicator("sma20")} /><span style={{ color: "#f7ca4d" }}>SMA 20</span></label>
                <label><input type="checkbox" checked={indicators.sma50} onChange={() => toggleIndicator("sma50")} /><span style={{ color: "#b98cff" }}>SMA 50</span></label>
                <label><input type="checkbox" checked={indicators.ema20} onChange={() => toggleIndicator("ema20")} /><span style={{ color: "#00D4FF" }}>EMA 20</span></label>
                <label><input type="checkbox" checked={indicators.rsi} onChange={() => toggleIndicator("rsi")} /><span style={{ color: "#f7ca4d" }}>RSI (14)</span></label>
              </div>
            )}

            <div className="chart-stage">
              <div className="chart-title">
                <span className="pair-dot" />
                {selectedSymbol} / SOL · {timeframe} · devnet
              </div>
              <LiveMarketChart
                mint={selectedMint}
                timeframe={timeframe}
                mode={chartMode}
                showVolume={showVolume}
                indicators={indicators}
              />
            </div>
          </div>

          {/* Live reserves */}
          <div className="curve-stat-grid">
            <div>
              <span>Curve price</span>
              <strong>{formatPrice(currentPrice)}</strong>
            </div>
            <div>
              <span>{side === "buy" ? "After buy" : "Sell est."}</span>
              <strong>{side === "buy" ? formatPrice(nextPrice) : `${formatCompact(estimatedSol, 6)} SOL`}</strong>
            </div>
            <div>
              <span>SOL reserve {reserveSource === "chain" ? "🟢" : "⚪"}</span>
              <strong>{formatCompact(previewSolReserve, 2)}</strong>
            </div>
            <div>
              <span>Token reserve</span>
              <strong>{formatCompact(previewTokenReserve, 2)}</strong>
            </div>
          </div>

          <div className="curve-reserve-row">
            <div>
              <label className="form-label">SOL reserve {reserveSource === "chain" ? "(live)" : "(estimate)"}</label>
              <input
                className="form-input compact-input"
                type="number" min={0.01} step={0.1}
                value={reserveSol}
                onChange={(e) => { setReserveSource("preview"); setReserveSol(e.target.value); }}
              />
            </div>
            <div>
              <label className="form-label">Token reserve {reserveSource === "chain" ? "(live)" : "(estimate)"}</label>
              <input
                className="form-input compact-input"
                type="number" min={1} step={1000000}
                value={reserveTokens}
                onChange={(e) => { setReserveSource("preview"); setReserveTokens(e.target.value); }}
              />
            </div>
            <button
              className="reserve-refresh reserve-refresh-wide"
              onClick={() => refreshReserves()}
              disabled={!validMint || reservesBusy || !canUseCurve}
            >
              <RefreshCw size={13} className={reservesBusy ? "spin" : undefined} />
              {reserveSource === "chain" ? "Live devnet" : "Fetch live"}
            </button>
          </div>
          {reserveError && <div className="trade-error">{reserveError}</div>}
        </div>
      </div>

      {/* TrustScore reference */}
      <div style={{ background: "var(--bg3)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1rem", marginBottom: ".75rem", display: "flex", alignItems: "center", gap: 8 }}>
          <TrendingUp size={16} color="var(--solana-blue)" /> Check TrustScore before buying
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          {[
            { score: "85–100", label: "ELITE", color: "var(--green-neon)", rec: "Strong lock, low creator allocation, high liquidity, burn active." },
            { score: "70–84", label: "STRONG", color: "var(--solana-blue)", rec: "Good fundamentals. Check vesting status, curve reserves, and votes." },
            { score: "40–69", label: "OK", color: "var(--yellow)", rec: "Meets minimum rules. Research creator history before buying." },
            { score: "0–39", label: "WEAK", color: "var(--orange)", rec: "High risk. Weak distribution, low burn/liquidity, or complaints detected." },
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
          Browse all tokens in Discover →
        </button>
      </div>

      {/* Pre-trade checklist */}
      <div style={{ background: "var(--bg3)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "1.5rem" }}>
        <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1rem", marginBottom: ".75rem", display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={16} color="var(--muted)" /> Pre-trade checklist
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: ".6rem" }}>
          {[
            ["TrustScore", "Aim for 66+ before buying — check Discover"],
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

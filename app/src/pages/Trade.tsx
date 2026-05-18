import { useEffect, useMemo, useState } from "react";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
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

const PREVIEW_TOKEN_RESERVE = 350_000_000;
const PREVIEW_SOL_RESERVE = 0.5;
const CURVE_FEE_RATE = 0.01;
const CHART_WIDTH = 560;
const CHART_HEIGHT = 230;
const CHART_PAD = 24;

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

const buildCandles = (solIn: number, solReserve: number, tokenReserve: number) => {
  const maxSol = Math.max(2, solReserve * 2.5, solIn * 4);
  const candleCount = 30;
  const candles = Array.from({ length: candleCount }, (_, index) => {
    const openSpend = (maxSol * index) / candleCount;
    const closeSpend = (maxSol * (index + 1)) / candleCount;
    const open = estimatePriceAfter(openSpend, solReserve, tokenReserve);
    const close = estimatePriceAfter(closeSpend, solReserve, tokenReserve);
    const spread = Math.max(Math.abs(close - open), close * 0.018);
    return {
      open,
      close,
      high: Math.max(open, close) + spread * 0.45,
      low: Math.max(0, Math.min(open, close) - spread * 0.35),
    };
  });
  const prices = candles.flatMap((candle) => [candle.high, candle.low]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = Math.max(maxPrice - minPrice, Number.EPSILON);
  const yScale = (price: number) =>
    CHART_HEIGHT - CHART_PAD - ((price - minPrice) / range) * (CHART_HEIGHT - CHART_PAD * 2);
  const slot = (CHART_WIDTH - CHART_PAD * 2) / candleCount;
  const candleWidth = Math.max(6, slot * 0.58);
  const currentIndex = clamp(Math.floor((clamp(solIn, 0, maxSol) / maxSol) * candleCount), 0, candleCount - 1);

  return {
    candles: candles.map((candle, index) => {
      const x = CHART_PAD + slot * index + slot / 2;
      const bodyTop = yScale(Math.max(candle.open, candle.close));
      const bodyBottom = yScale(Math.min(candle.open, candle.close));
      return {
        ...candle,
        x,
        yOpen: yScale(candle.open),
        yClose: yScale(candle.close),
        yHigh: yScale(candle.high),
        yLow: yScale(candle.low),
        bodyY: bodyTop,
        bodyHeight: Math.max(3, bodyBottom - bodyTop),
        candleWidth,
        up: candle.close >= candle.open,
        active: index === currentIndex,
      };
    }),
    maxSol,
    minPrice,
    maxPrice,
  };
};

export const Trade = ({ goDiscover }: { goDiscover: () => void }) => {
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const [mintInput, setMintInput] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [solAmount, setSolAmount] = useState("0.1");
  const [tokensAmount, setTokensAmount] = useState("1000000");
  const [reserveSol, setReserveSol] = useState(String(PREVIEW_SOL_RESERVE));
  const [reserveTokens, setReserveTokens] = useState(String(PREVIEW_TOKEN_RESERVE));
  const [reserveSource, setReserveSource] = useState<"preview" | "chain">("preview");
  const [reservesBusy, setReservesBusy] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"buy" | "sell" | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [v2Available, setV2Available] = useState<boolean | null>(null);

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
    () => buildCandles(solIn, previewSolReserve, previewTokenReserve),
    [solIn, previewSolReserve, previewTokenReserve]
  );

  const validMint = mintInput.trim().length > 30;
  const canUseCurve = v2Available === true;
  const canTrade = canUseCurve && wallet.connected && busy === null && validMint;
  const solscanUrl = validMint
    ? `https://solscan.io/token/${mintInput.trim()}?cluster=devnet`
    : null;

  const refreshReserves = async () => {
    if (!validMint) return;
    if (!canUseCurve) {
      setReserveError("V2 curve program is not deployed on devnet yet.");
      return;
    }
    setReservesBusy(true);
    setReserveError(null);
    try {
      const mint = new PublicKey(mintInput.trim());
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
      const { signature } = await buyOnCurveV2(program, anchorWallet.publicKey, mint, ata, Number(solAmount), 0);
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
      const { signature } = await sellOnCurveV2(program, anchorWallet.publicKey, mint, ata, toRawTokenAmount(tokensAmount), 0);
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
          ? "V2 devnet tokens trade instantly through the HumbleTrust bonding curve, then migrate to Raydium after the SOL threshold is reached."
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

      <div className="trade-grid">
        <div className="swap-panel">
          <div className="panel-head">
            <div className="panel-title">
              <Zap size={16} color="var(--green-neon)" /> Mini Swap
            </div>
            <span className="network-pill">{canUseCurve ? "DEVNET" : "V2 PENDING"}</span>
          </div>

          <label className="form-label">Token mint</label>
          <input
            className="form-input"
            placeholder="Mint public key"
            value={mintInput}
            onChange={(e) => setMintInput(e.target.value)}
            onBlur={refreshReserves}
          />

          <div className="trade-tabs">
            <button className={side === "buy" ? "active" : ""} onClick={() => setSide("buy")} type="button">Buy</button>
            <button className={side === "sell" ? "active" : ""} onClick={() => setSide("sell")} type="button">Sell</button>
          </div>

          <div className="swap-box">
            <div className="swap-box-head">
              <span>From</span>
              <span>{side === "buy" ? "SOL" : "Token"}</span>
            </div>
            <input
              className="swap-amount-input"
              type="number"
              min={side === "buy" ? 0.01 : 1}
              step={side === "buy" ? 0.01 : 1000}
              value={side === "buy" ? solAmount : tokensAmount}
              onChange={(e) => side === "buy" ? setSolAmount(e.target.value) : setTokensAmount(e.target.value)}
            />
          </div>

          <div className="swap-arrow">
            <ArrowDown size={16} />
          </div>

          <div className="swap-box">
            <div className="swap-box-head">
              <span>To est.</span>
              <span>{side === "buy" ? "Token" : "SOL"}</span>
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
            <span>{side === "buy" ? "Price impact" : "Raw sell amount"}</span>
            <strong>{side === "buy" ? `${formatCompact(priceImpact, 2)}%` : toRawTokenAmount(tokensAmount)}</strong>
          </div>

          <button
            onClick={side === "buy" ? runBuy : runSell}
            disabled={!canTrade || (side === "buy" ? solIn <= 0 : tokensIn <= 0)}
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

        <div className="curve-panel">
          <div className="panel-head">
            <div className="panel-title">
              <BarChart3 size={16} color="var(--solana-blue)" /> Curve Chart
            </div>
            <div className="panel-actions">
              <span className="network-pill blue">{reserveSource === "chain" ? "LIVE DEVNET" : "PREVIEW"}</span>
              <button className="reserve-refresh" onClick={refreshReserves} disabled={!validMint || reservesBusy || !canUseCurve}>
                <RefreshCw size={13} className={reservesBusy ? "spin" : undefined} /> Refresh
              </button>
            </div>
          </div>

          <div className="curve-chart-wrap">
            <svg className="curve-chart" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="Bonding curve candle preview">
              {[0, 1, 2, 3].map((line) => {
                const y = CHART_PAD + ((CHART_HEIGHT - CHART_PAD * 2) * line) / 3;
                return <line key={`h-${line}`} x1={CHART_PAD} y1={y} x2={CHART_WIDTH - CHART_PAD} y2={y} className="candle-grid" />;
              })}
              {[0, 1, 2, 3, 4].map((line) => {
                const x = CHART_PAD + ((CHART_WIDTH - CHART_PAD * 2) * line) / 4;
                return <line key={`v-${line}`} x1={x} y1={CHART_PAD} x2={x} y2={CHART_HEIGHT - CHART_PAD} className="candle-grid" />;
              })}
              <path
                d={`M ${CHART_PAD} ${CHART_HEIGHT - CHART_PAD} H ${CHART_WIDTH - CHART_PAD} M ${CHART_PAD} ${CHART_PAD} V ${CHART_HEIGHT - CHART_PAD}`}
                className="curve-axis"
              />
              {chart.candles.map((candle, index) => (
                <g key={index} className={candle.active ? "candle active" : "candle"}>
                  <line
                    x1={candle.x}
                    y1={candle.yHigh}
                    x2={candle.x}
                    y2={candle.yLow}
                    className={candle.up ? "candle-wick up" : "candle-wick down"}
                  />
                  <rect
                    x={candle.x - candle.candleWidth / 2}
                    y={candle.bodyY}
                    width={candle.candleWidth}
                    height={candle.bodyHeight}
                    rx="1.5"
                    className={candle.up ? "candle-body up" : "candle-body down"}
                  />
                </g>
              ))}
            </svg>
            <div className="curve-axis-label top">{formatPrice(chart.maxPrice)} SOL/token</div>
            <div className="curve-axis-label bottom">{formatPrice(chart.minPrice)} SOL/token</div>
            <div className="curve-axis-label right">+{formatCompact(chart.maxSol, 2)} SOL</div>
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

import { useMemo, useState } from "react";
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
import { buyOnCurveV2, findV2Pdas, getProgramV2, sellOnCurveV2 } from "../lib/program";

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

const buildChart = (solIn: number, solReserve: number, tokenReserve: number) => {
  const maxSol = Math.max(2, solReserve * 2.5, solIn * 4);
  const samples = Array.from({ length: 48 }, (_, index) => {
    const spend = (maxSol * index) / 47;
    return {
      spend,
      price: estimatePriceAfter(spend, solReserve, tokenReserve),
    };
  });
  const prices = samples.map((sample) => sample.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = Math.max(maxPrice - minPrice, Number.EPSILON);
  const xScale = (spend: number) => CHART_PAD + (spend / maxSol) * (CHART_WIDTH - CHART_PAD * 2);
  const yScale = (price: number) =>
    CHART_HEIGHT - CHART_PAD - ((price - minPrice) / range) * (CHART_HEIGHT - CHART_PAD * 2);
  const path = samples
    .map((sample, index) => `${index === 0 ? "M" : "L"} ${xScale(sample.spend).toFixed(2)} ${yScale(sample.price).toFixed(2)}`)
    .join(" ");
  const currentSpend = clamp(solIn, 0, maxSol);
  const currentPrice = estimatePriceAfter(currentSpend, solReserve, tokenReserve);

  return {
    path,
    maxSol,
    currentX: xScale(currentSpend),
    currentY: yScale(currentPrice),
    minPrice,
    maxPrice,
  };
};

export const Trade = ({ goDiscover }: { goDiscover: () => void }) => {
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const [mintInput, setMintInput] = useState("");
  const [creatorInput, setCreatorInput] = useState("");
  const [solAmount, setSolAmount] = useState("0.1");
  const [tokensAmount, setTokensAmount] = useState("1000000000");
  const [reserveSol, setReserveSol] = useState(String(PREVIEW_SOL_RESERVE));
  const [reserveTokens, setReserveTokens] = useState(String(PREVIEW_TOKEN_RESERVE));
  const [reserveSource, setReserveSource] = useState<"preview" | "chain">("preview");
  const [reservesBusy, setReservesBusy] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"buy" | "sell" | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const solIn = parsePositive(solAmount, 0);
  const previewSolReserve = parsePositive(reserveSol, PREVIEW_SOL_RESERVE);
  const previewTokenReserve = parsePositive(reserveTokens, PREVIEW_TOKEN_RESERVE);
  const estimatedTokens = estimateTokensOut(solIn, previewSolReserve, previewTokenReserve);
  const currentPrice = previewSolReserve / previewTokenReserve;
  const nextPrice = estimatePriceAfter(solIn, previewSolReserve, previewTokenReserve);
  const priceImpact = currentPrice > 0 ? ((nextPrice - currentPrice) / currentPrice) * 100 : 0;
  const chart = useMemo(
    () => buildChart(solIn, previewSolReserve, previewTokenReserve),
    [solIn, previewSolReserve, previewTokenReserve]
  );

  const validMint = mintInput.trim().length > 30;
  const validCreator = creatorInput.trim().length > 30;
  const canTrade = wallet.connected && busy === null && validMint && validCreator;
  const solscanUrl = validMint
    ? `https://solscan.io/token/${mintInput.trim()}?cluster=devnet`
    : null;

  const refreshReserves = async () => {
    if (!validMint) return;
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
      const mint = new PublicKey(mintInput.trim());
      const creator = new PublicKey(creatorInput.trim());
      const ata = getAssociatedTokenAddressSync(mint, anchorWallet.publicKey);
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program = getProgramV2(provider);
      const { signature } = await buyOnCurveV2(program, anchorWallet.publicKey, mint, ata, creator, Number(solAmount), 0);
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
      const mint = new PublicKey(mintInput.trim());
      const creator = new PublicKey(creatorInput.trim());
      const ata = getAssociatedTokenAddressSync(mint, anchorWallet.publicKey);
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program = getProgramV2(provider);
      const { signature } = await sellOnCurveV2(program, anchorWallet.publicKey, mint, ata, creator, tokensAmount, 0);
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
        V2 devnet tokens trade instantly through the HumbleTrust bonding curve, then migrate to Raydium after the SOL threshold is reached.
      </p>

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
            <span className="network-pill">DEVNET</span>
          </div>

          <label className="form-label">Token mint</label>
          <input
            className="form-input"
            placeholder="Mint public key"
            value={mintInput}
            onChange={(e) => setMintInput(e.target.value)}
          />

          <label className="form-label">Creator wallet</label>
          <input
            className="form-input"
            placeholder="Creator public key"
            value={creatorInput}
            onChange={(e) => setCreatorInput(e.target.value)}
          />

          <div className="swap-box">
            <div className="swap-box-head">
              <span>From</span>
              <span>SOL</span>
            </div>
            <input
              className="swap-amount-input"
              type="number"
              min={0.01}
              step={0.01}
              value={solAmount}
              onChange={(e) => setSolAmount(e.target.value)}
            />
          </div>

          <div className="swap-arrow">
            <ArrowDown size={16} />
          </div>

          <div className="swap-box">
            <div className="swap-box-head">
              <span>To est.</span>
              <span>Token</span>
            </div>
            <div className="swap-output">{formatCompact(estimatedTokens, 4)}</div>
          </div>

          <div className="swap-meta-row">
            <span>Fee</span>
            <strong>{(CURVE_FEE_RATE * 100).toFixed(0)}%</strong>
          </div>
          <div className="swap-meta-row">
            <span>Price impact</span>
            <strong>{formatCompact(priceImpact, 2)}%</strong>
          </div>

          <button onClick={runBuy} disabled={!canTrade || solIn <= 0} className="swap-action">
            {busy === "buy" ? "Buying..." : "Buy on Curve"}
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
              <button className="reserve-refresh" onClick={refreshReserves} disabled={!validMint || reservesBusy}>
                <RefreshCw size={13} className={reservesBusy ? "spin" : undefined} /> Refresh
              </button>
            </div>
          </div>

          <div className="curve-chart-wrap">
            <svg className="curve-chart" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="Bonding curve price preview">
              <defs>
                <linearGradient id="curveLineGradient" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="var(--green-neon)" />
                  <stop offset="100%" stopColor="var(--solana-blue)" />
                </linearGradient>
              </defs>
              <path
                d={`M ${CHART_PAD} ${CHART_HEIGHT - CHART_PAD} H ${CHART_WIDTH - CHART_PAD} M ${CHART_PAD} ${CHART_PAD} V ${CHART_HEIGHT - CHART_PAD}`}
                className="curve-axis"
              />
              <path d={chart.path} className="curve-line" />
              <line x1={chart.currentX} y1={CHART_PAD} x2={chart.currentX} y2={CHART_HEIGHT - CHART_PAD} className="curve-marker-line" />
              <circle cx={chart.currentX} cy={chart.currentY} r="5" className="curve-marker-dot" />
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
              <span>After buy</span>
              <strong>{formatPrice(nextPrice)}</strong>
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

      <div className="sell-panel">
        <div>
          <div className="panel-title">
            <TrendingUp size={16} color="var(--solana-blue)" /> Sell on Curve
          </div>
          <p className="sell-copy">Raw token amount goes back to the devnet curve pool; SOL comes from the treasury PDA.</p>
        </div>
        <div className="sell-controls">
          <input className="form-input compact-input" value={tokensAmount} onChange={(e) => setTokensAmount(e.target.value)} />
          <button onClick={runSell} disabled={!canTrade} className="sell-action">
            {busy === "sell" ? "Selling..." : "Sell"}
          </button>
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

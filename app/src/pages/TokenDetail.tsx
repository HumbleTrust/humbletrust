import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { LiveMarketChart } from "../components/LiveMarketChart";
import { ApiToken, ApiTrade, getToken, getTokenTrades } from "../lib/api";

const scoreColor = (score: number) =>
  score >= 85 ? "var(--green-neon)" : score >= 70 ? "var(--solana-blue)" : score >= 40 ? "var(--yellow)" : "var(--orange)";

export const TokenDetail = ({ mint, back }: { mint: string; back: () => void }) => {
  const [token, setToken] = useState<ApiToken | null>(null);
  const [trades, setTrades] = useState<ApiTrade[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setError(null);
    Promise.all([getToken(mint), getTokenTrades(mint, 80)])
      .then(([tokenResult, tradeResult]) => {
        if (!mounted) return;
        setToken(tokenResult.token);
        setTrades(tradeResult.trades);
      })
      .catch((e) => mounted && setError(e.message || String(e)));
    return () => { mounted = false; };
  }, [mint]);

  return (
    <section>
      <button className="back-button" onClick={back} type="button"><ArrowLeft size={16} /> Discover</button>
      <div className="sec-eyebrow">Token Detail</div>
      <h2 className="sec-h2">{token?.name || "Indexed token"} <span className="hl-green">${token?.symbol || mint.slice(0, 4)}</span></h2>
      <p className="sec-sub">Mint {mint}</p>
      {error && <div className="trade-error">{error}</div>}

      <div className="token-detail-grid">
        <div className="chart-terminal detail-chart">
          <div className="chart-topbar">
            <span className="chart-menu-btn active">1m</span>
            <span className="chart-divider" />
            <span className="chart-menu-btn active">Real OHLCV</span>
          </div>
          <LiveMarketChart mint={mint} timeframe="1m" mode="candles" showVolume
            indicators={{ sma20: false, sma50: false, ema20: false, rsi: false }}
          />
        </div>

        <div className="score-detail-card">
          <div className="score-big" style={{ color: scoreColor(Number(token?.trust_score || 0)) }}>
            {token?.trust_score ?? "--"}
          </div>
          <div className="score-label">TrustScore 2.0</div>
          {[
            ["LaunchScore", token?.launch_score],
            ["CreatorReputation", token?.creator_reputation],
            ["MarketHealth", token?.market_health],
            ["CommunityRisk", token?.community_risk],
          ].map(([label, value]) => (
            <div className="score-break-row" key={label}>
              <span>{label}</span>
              <strong>{value ?? "--"}</strong>
            </div>
          ))}
          <a href={`https://solscan.io/token/${mint}?cluster=devnet`} target="_blank" rel="noreferrer" className="trade-link">
            Solscan devnet <ExternalLink size={11} />
          </a>
          {token?.certificate_mint && (
            <a href={`https://solscan.io/token/${token.certificate_mint}?cluster=devnet`} target="_blank" rel="noreferrer" className="trade-link">
              Launch certificate <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>

      <div className="trades-table">
        <div className="table-head">Recent trades</div>
        {trades.length === 0 && <div className="token-picker-empty">No indexed trades yet.</div>}
        {trades.map((trade) => (
          <div className="trade-row" key={`${trade.signature}-${trade.block_time}`}>
            <span className={trade.side === "sell" ? "sell" : "buy"}>{trade.side}</span>
            <span>{Number(trade.sol_amount).toFixed(5)} SOL</span>
            <span>{Number(trade.token_amount).toLocaleString("en-US", { maximumFractionDigits: 2 })} token</span>
            <a href={`https://solscan.io/tx/${trade.signature}?cluster=devnet`} target="_blank" rel="noreferrer">
              {trade.signature.slice(0, 8)}...
            </a>
          </div>
        ))}
      </div>
    </section>
  );
};

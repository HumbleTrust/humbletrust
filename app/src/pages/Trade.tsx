import { useState } from "react";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { ExternalLink, AlertTriangle, TrendingUp, Zap, Clock } from "lucide-react";
import { buyOnCurveV2, getProgramV2, sellOnCurveV2 } from "../lib/program";

export const Trade = ({ goDiscover }: { goDiscover: () => void }) => {
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const [mintInput, setMintInput] = useState("");
  const [creatorInput, setCreatorInput] = useState("");
  const [solAmount, setSolAmount] = useState("0.1");
  const [tokensAmount, setTokensAmount] = useState("1000000000");
  const [busy, setBusy] = useState<"buy" | "sell" | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const solscanUrl = mintInput.trim().length > 30
    ? `https://solscan.io/token/${mintInput.trim()}?cluster=devnet`
    : null;

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
        V2 tokens trade instantly through the HumbleTrust bonding curve, then migrate to Raydium after the SOL threshold is reached.
      </p>

      {/* Anti-bot notice */}
      <div style={{ background: "rgba(255,122,47,.07)", border: "1px solid rgba(255,122,47,.2)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "2rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <AlertTriangle size={18} color="var(--orange)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, color: "var(--orange)", fontSize: ".85rem", marginBottom: ".3rem" }}>Anti-bot delay active on new tokens</div>
          <div style={{ fontSize: ".78rem", color: "var(--muted2)", lineHeight: 1.6 }}>
            Each token has a 0–600 second trading delay after launch to block sniper bots.
            If a transaction fails immediately after launch, wait for the delay to expire.
            You can check <code>trading_unlock_time</code> in the token metadata on-chain.
          </div>
        </div>
      </div>

      {/* Bonding curve swap */}
      <div style={{ background: "var(--bg3)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1rem", marginBottom: ".5rem", display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={16} color="var(--green-neon)" /> Trade on HumbleTrust Curve
        </div>
        <p style={{ fontSize: ".82rem", color: "var(--muted2)", marginBottom: "1rem", lineHeight: 1.6 }}>
          Enter the token mint and creator wallet. Buys spend SOL from your wallet into the curve treasury PDA; sells return SOL from that PDA.
        </p>

        <label style={{ fontSize: ".8rem", color: "var(--muted)", display: "block", marginBottom: ".4rem" }}>
          Token Mint Address
        </label>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
          <input
            className="form-input"
            style={{ flex: 1, minWidth: 260 }}
            placeholder="e.g. Gcz7NMtCqKdv..."
            value={mintInput}
            onChange={(e) => setMintInput(e.target.value)}
          />
        </div>

        <label style={{ fontSize: ".8rem", color: "var(--muted)", display: "block", margin: ".9rem 0 .4rem" }}>
          Creator Wallet
        </label>
        <input
          className="form-input"
          placeholder="Creator public key for fee routing"
          value={creatorInput}
          onChange={(e) => setCreatorInput(e.target.value)}
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
          <div>
            <label style={{ fontSize: ".8rem", color: "var(--muted)", display: "block", marginBottom: ".4rem" }}>Buy SOL</label>
            <input className="form-input" type="number" min={0.01} step={0.01} value={solAmount} onChange={(e) => setSolAmount(e.target.value)} />
            <button onClick={runBuy} disabled={!wallet.connected || busy !== null || mintInput.trim().length < 30 || creatorInput.trim().length < 30} style={{ marginTop: ".65rem", width: "100%", background: "var(--green-neon)", color: "#05070F", border: 0, borderRadius: 8, padding: ".65rem 1rem", fontWeight: 800, cursor: "pointer" }}>
              {busy === "buy" ? "Buying..." : "Buy on Curve"}
            </button>
          </div>
          <div>
            <label style={{ fontSize: ".8rem", color: "var(--muted)", display: "block", marginBottom: ".4rem" }}>Sell raw token amount</label>
            <input className="form-input" value={tokensAmount} onChange={(e) => setTokensAmount(e.target.value)} />
            <button onClick={runSell} disabled={!wallet.connected || busy !== null || mintInput.trim().length < 30 || creatorInput.trim().length < 30} style={{ marginTop: ".65rem", width: "100%", background: "rgba(20,102,255,.15)", color: "var(--solana-blue)", border: "1px solid rgba(20,102,255,.3)", borderRadius: 8, padding: ".65rem 1rem", fontWeight: 800, cursor: "pointer" }}>
              {busy === "sell" ? "Selling..." : "Sell on Curve"}
            </button>
          </div>
        </div>

        {solscanUrl && (
          <a href={solscanUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: ".75rem", fontSize: ".75rem", color: "var(--solana-blue)", textDecoration: "none" }}>
            View token on Solscan (devnet) <ExternalLink size={11} />
          </a>
        )}
        {txSig && (
          <div style={{ marginTop: ".75rem", fontSize: ".78rem", color: "var(--green-neon)", wordBreak: "break-all" }}>
            Curve tx: {txSig}
          </div>
        )}
        {tradeError && (
          <div style={{ marginTop: ".75rem", fontSize: ".78rem", color: "var(--red)", wordBreak: "break-word" }}>
            {tradeError}
          </div>
        )}
      </div>

      {/* How to check TrustScore before trading */}
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
          Browse all tokens in Discover →
        </button>
      </div>

      {/* Trading checklist */}
      <div style={{ background: "var(--bg3)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "1.5rem" }}>
        <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1rem", marginBottom: ".75rem", display: "flex", alignItems: "center", gap: 8 }}>
          <Clock size={16} color="var(--muted)" /> Pre-trade checklist
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: ".6rem" }}>
          {[
            ["TrustScore", "Check score in Discover — aim for 66+ before buying"],
            ["Lock status", "Confirm is_locked = true and unlock_time is in the future"],
            ["Anti-bot", "Verify trading_unlock_time has passed (no-tx immediately post-launch)"],
            ["Votes", "Check positive_votes vs negative_votes ratio — avoid tokens with complaints"],
            ["Liquidity", "Verify LP lock exists via lp_lock PDA before swapping on Raydium"],
            ["Creator", "Check creator_reputation PDA for launch history (Phase 4.5)"],
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

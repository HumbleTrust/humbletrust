import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { BorshAccountsCoder, Idl } from "@coral-xyz/anchor";
import { ArrowLeft, Copy, Check, ExternalLink, Award, Shield, Zap, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GlassPanel } from "../components/GlassPanel";
import { HexAvatar } from "../components/HexAvatar";
import { cn } from "../components/ui/utils";
import { findCreatorReputationV2Pda } from "../../lib/solana/program";
import { withFallbackRpc } from "../../lib/solana/rpc";
import idlV2Json from "../../lib/solana/idl_v2.json";

interface CreatorToken {
  mint: string;
  name: string | null;
  symbol: string | null;
  logo_uri: string | null;
  trust_score: number | null;
  trust_level: string | null;
  status: string | null;
  tier: string | null;
  lock_percent: number | null;
  created_at: string;
  raydium_pool: string | null;
  volume_sol: number | null;
  trades_count: number | null;
}

interface ReputationStats {
  total_launches: number;
  trust_score_sum: number;
  successful_unlocks: number;
  complaints_total: number;
  score_bonus: number;
}

interface BadgeData {
  zodiac: string;
  element: string;
  aura_color: string;
  edition: number;
  minted_at: string;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function TrustBar({ score }: { score: number }) {
  const color = score >= 70 ? "#00FF41" : score >= 40 ? "#F7B731" : "#FF4444";
  return (
    <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

function StatusDot({ status }: { status: string | null }) {
  if (status === "migrated") return <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] inline-block" title="Migrated to Raydium" />;
  return <span className="w-1.5 h-1.5 rounded-full bg-[#F7B731] inline-block" title="Bonding curve" />;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-1">
      <div className="text-white/40 text-xs uppercase tracking-wider">{label}</div>
      <div className="text-white text-2xl font-bold font-mono">{value}</div>
      {sub && <div className="text-white/30 text-xs">{sub}</div>}
    </div>
  );
}

// ── CreatorPage ────────────────────────────────────────────────────────────────

export function CreatorPage({ wallet, onBack }: { wallet: string; onBack: () => void }) {
  const [tokens, setTokens]     = useState<CreatorToken[]>([]);
  const [rep, setRep]           = useState<ReputationStats | null>(null);
  const [badge, setBadge]       = useState<BadgeData | null>(null);
  const [loadingTok, setLoadingTok] = useState(true);
  const [loadingRep, setLoadingRep] = useState(true);
  const [copied, setCopied]     = useState(false);

  const copyWallet = useCallback(() => {
    navigator.clipboard.writeText(wallet).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [wallet]);

  // Fetch tokens from DB
  useEffect(() => {
    if (!wallet) return;
    setLoadingTok(true);
    fetch(`/api/tokens?creator=${wallet}&limit=50`)
      .then(r => r.ok ? r.json() : { tokens: [] })
      .then(d => setTokens(d.tokens || []))
      .catch(() => {})
      .finally(() => setLoadingTok(false));
  }, [wallet]);

  // Fetch on-chain reputation + badge in parallel
  useEffect(() => {
    if (!wallet) return;
    setLoadingRep(true);

    const fetchRep = async () => {
      try {
        const pk = new PublicKey(wallet);
        const [repPda] = findCreatorReputationV2Pda(pk);
        const coder = new BorshAccountsCoder(idlV2Json as Idl);
        const info = await withFallbackRpc(c => c.getAccountInfo(repPda));
        if (info) {
          const data = coder.decode("CreatorReputationV2", info.data) as any;
          setRep({
            total_launches:    Number(data.total_launches ?? 0),
            trust_score_sum:   Number(data.trust_score_sum ?? 0),
            successful_unlocks: Number(data.successful_unlocks ?? 0),
            complaints_total:  Number(data.complaints_total ?? 0),
            score_bonus:       Number(data.score_bonus ?? 0),
          });
        }
      } catch { /* no reputation PDA yet */ }
    };

    const fetchBadge = async () => {
      try {
        const r = await fetch(`/api/badges/eligibility?wallet=${wallet}`);
        if (!r.ok) return;
        const d = await r.json();
        if (d.badge) setBadge(d.badge);
      } catch { /* no badge */ }
    };

    Promise.all([fetchRep(), fetchBadge()]).finally(() => setLoadingRep(false));
  }, [wallet]);

  const avgScore = rep && rep.total_launches > 0
    ? Math.round(rep.trust_score_sum / rep.total_launches)
    : null;

  const migratedCount  = tokens.filter(t => t.status === "migrated").length;
  const premiumCount   = tokens.filter(t => t.tier === "premium").length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-white font-bold text-xl">Creator Profile</h1>
      </div>

      {/* ── Identity ── */}
      <GlassPanel className="p-5" glow="green">
        <div className="flex items-center gap-4">
          <HexAvatar address={wallet} size={56} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-mono text-sm">{shortAddr(wallet)}</span>
              <button
                type="button"
                onClick={copyWallet}
                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                aria-label="Copy wallet address"
              >
                {copied ? <Check size={13} className="text-[#00FF41]" /> : <Copy size={13} />}
              </button>
              <a
                href={`https://explorer.solana.com/address/${wallet}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                aria-label="Open in Solana Explorer"
              >
                <ExternalLink size={13} />
              </a>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {badge && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold border"
                  style={{ color: badge.aura_color, borderColor: badge.aura_color + "66", background: badge.aura_color + "18" }}
                >
                  {badge.zodiac} {badge.element}
                </span>
              )}
              {premiumCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold border border-[#B026FF]/40 bg-[#B026FF]/10 text-[#B026FF]">
                  Premium Creator
                </span>
              )}
              {rep && rep.score_bonus > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold border border-[#F7B731]/40 bg-[#F7B731]/10 text-[#F7B731]">
                  +{rep.score_bonus} Bonus
                </span>
              )}
            </div>
          </div>
          {avgScore !== null && (
            <div className="text-center shrink-0">
              <div
                className="text-3xl font-black font-mono"
                style={{ color: avgScore >= 70 ? "#00FF41" : avgScore >= 40 ? "#F7B731" : "#FF4444" }}
              >
                {avgScore}
              </div>
              <div className="text-white/30 text-[10px] uppercase tracking-wider">Avg Score</div>
            </div>
          )}
        </div>
      </GlassPanel>

      {/* ── Reputation stats ── */}
      {loadingRep ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Launches" value={rep?.total_launches ?? tokens.length} />
          <StatCard label="Unlocked" value={rep?.successful_unlocks ?? 0} sub="successful unlocks" />
          <StatCard label="Migrated" value={migratedCount} sub="to Raydium" />
          <StatCard label="Complaints" value={rep?.complaints_total ?? 0} sub={rep?.complaints_total === 0 ? "clean record" : undefined} />
        </div>
      )}

      {/* ── Zodiac Badge ── */}
      <AnimatePresence>
        {badge && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <GlassPanel className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <Award size={16} style={{ color: badge.aura_color }} />
                <h2 className="text-white font-semibold text-sm">Zodiac Badge NFT</h2>
              </div>
              <div className="flex items-center gap-4">
                <img
                  src={`/api/badges/image?zodiac=${badge.zodiac}&element=${badge.element}&aura=${encodeURIComponent(badge.aura_color)}&edition=${badge.edition}`}
                  alt={`${badge.zodiac} Badge`}
                  className="w-16 h-16 rounded-xl object-cover border border-white/10"
                  loading="lazy"
                />
                <div>
                  <div className="text-white font-bold">{badge.zodiac}</div>
                  <div className="text-white/50 text-sm">{badge.element} · Edition #{badge.edition}</div>
                  <div className="text-white/30 text-xs mt-1">
                    Minted {new Date(badge.minted_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Token launches ── */}
      <GlassPanel className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <Zap size={16} className="text-[#00FF41]" />
          <h2 className="text-white font-semibold text-sm">
            Launched Tokens
            {tokens.length > 0 && (
              <span className="ml-2 text-white/30 font-normal">{tokens.length}</span>
            )}
          </h2>
        </div>

        {loadingTok ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : tokens.length === 0 ? (
          <div className="py-10 text-center text-white/30 text-sm">No tokens launched yet</div>
        ) : (
          <div className="space-y-2">
            {tokens.map(tok => (
              <TokenRow key={tok.mint} token={tok} />
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}

// ── TokenRow ──────────────────────────────────────────────────────────────────

function TokenRow({ token }: { token: CreatorToken }) {
  const score = token.trust_score ?? 0;
  const scoreColor = score >= 70 ? "#00FF41" : score >= 40 ? "#F7B731" : "#FF4444";

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-colors group">
      {/* Logo */}
      <div className="w-9 h-9 rounded-full overflow-hidden bg-white/10 shrink-0 border border-white/10">
        {token.logo_uri ? (
          <img src={token.logo_uri} alt={token.symbol ?? ""} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30 text-xs font-bold">
            {(token.symbol ?? "?")[0]}
          </div>
        )}
      </div>

      {/* Name + symbol */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-semibold truncate">{token.name ?? token.symbol ?? "Unknown"}</span>
          <StatusDot status={token.status} />
          {token.tier === "premium" && (
            <span className="text-[10px] text-[#B026FF] bg-[#B026FF]/10 border border-[#B026FF]/20 rounded px-1">PRO</span>
          )}
        </div>
        <div className="text-white/30 text-xs font-mono">{shortAddr(token.mint)}</div>
        {score > 0 && (
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 max-w-[80px]">
              <TrustBar score={score} />
            </div>
            <span className="text-[10px] font-mono" style={{ color: scoreColor }}>TS {score}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="text-right shrink-0 hidden sm:block">
        {token.trades_count != null && token.trades_count > 0 && (
          <div className="text-white/50 text-xs">{token.trades_count} trades</div>
        )}
        <div className="text-white/25 text-xs">{new Date(token.created_at).toLocaleDateString()}</div>
      </div>

      {/* Link */}
      <a
        href={`https://explorer.solana.com/address/${token.mint}?cluster=devnet`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1.5 rounded-lg text-white/20 hover:text-white/60 transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Open in explorer"
        onClick={e => e.stopPropagation()}
      >
        <ExternalLink size={12} />
      </a>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { ArrowUpRight, TrendingUp, Wallet, Activity, Clock, ExternalLink, RefreshCw, Rocket, ArrowLeftRight, Compass, Award, DollarSign } from "lucide-react";
import { GlassPanel } from "../GlassPanel";
import { motion } from "motion/react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { listTokens } from "../../../lib/solana/image";

interface DashboardProps {
  onTabChange: (tab: string) => void;
}

interface SplToken {
  mint: string;
  balance: number;
  symbol: string;
  trustScore?: number;
}

interface RecentTx {
  signature: string;
  blockTime: number | null;
  err: boolean;
}

export function Dashboard({ onTabChange }: DashboardProps) {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [splTokens, setSplTokens] = useState<SplToken[]>([]);
  const [recentTxs, setRecentTxs] = useState<RecentTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [earnings, setEarnings] = useState<{ mint: string; symbol: string; solEarned: number; tradeCount: number }[]>([]);

  const savedTokens = listTokens();

  const loadWalletData = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const [balanceLamports, parsedTokenAccounts, signatures] = await Promise.all([
        connection.getBalance(publicKey),
        connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID }),
        connection.getSignaturesForAddress(publicKey, { limit: 8 }),
      ]);

      setSolBalance(balanceLamports / LAMPORTS_PER_SOL);

      const tokens: SplToken[] = [];
      const seen = new Set<string>();
      for (const { account } of parsedTokenAccounts.value) {
        const info = (account.data as any).parsed?.info;
        const amountInfo = info?.tokenAmount;
        const mint = info?.mint as string | undefined;
        if (!mint || !amountInfo || seen.has(mint)) continue;
        const balance = Number(amountInfo.uiAmountString ?? amountInfo.uiAmount ?? 0);
        if (balance <= 0) continue;
        seen.add(mint);
        const saved = savedTokens.find(t => t.mint === mint);
        tokens.push({ mint, balance, symbol: saved?.symbol || mint.slice(0, 4).toUpperCase(), trustScore: saved?.trustScore });
      }
      setSplTokens(tokens.sort((a, b) => b.balance - a.balance));

      setRecentTxs(signatures.map(s => ({
        signature: s.signature,
        blockTime: s.blockTime ?? null,
        err: !!s.err,
      })));
    } catch (e) {
      console.error("Failed to load wallet data", e);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    if (connected && publicKey) {
      void loadWalletData();
    } else {
      setSolBalance(null);
      setSplTokens([]);
      setRecentTxs([]);
    }
  }, [connected, publicKey?.toBase58(), loadWalletData]);

  useEffect(() => {
    if (!connected || savedTokens.length === 0) { setEarnings([]); return; }
    Promise.all(
      savedTokens.slice(0, 5).map(async t => {
        try {
          const res = await fetch(`/api/tokens/${t.mint}/trades?limit=500`);
          const data = await res.json();
          const trades: any[] = data.trades || [];
          const solEarned = trades.reduce((s, r) => s + (Number(r.sol_amount) || 0) * 0.005, 0);
          return { mint: t.mint, symbol: t.symbol || "?", solEarned, tradeCount: trades.length };
        } catch {
          return { mint: t.mint, symbol: t.symbol || "?", solEarned: 0, tradeCount: 0 };
        }
      })
    ).then(setEarnings);
  }, [connected, savedTokens.length]);

  const quickActions = [
    { label: "Trade", tab: "trade", icon: ArrowLeftRight, desc: "Buy & sell on curve", color: "#00FF41" },
    { label: "Launch", tab: "launch", icon: Rocket, desc: "Create protected token", color: "#B026FF" },
    { label: "Discover", tab: "discover", icon: Compass, desc: "Browse tokens", color: "#00D4FF" },
    { label: "NFT Badge", tab: "nft", icon: Award, desc: "Mint certificate NFT", color: "#FFD700" },
  ];

  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <GlassPanel className="p-6" hover glow="green">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-white/50 mb-1">SOL Balance</p>
                {connected ? (
                  <>
                    <h2 className="text-3xl font-bold text-white mb-2 font-mono">
                      {solBalance !== null ? `◎ ${solBalance.toFixed(4)}` : "..."}
                    </h2>
                    <p className="text-xs text-white/40 font-mono">
                      {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-3xl font-bold text-white/30 mb-2">—</h2>
                    <p className="text-xs text-white/40">Connect wallet to view</p>
                  </>
                )}
              </div>
              <div className="w-12 h-12 rounded-lg bg-neon-green/20 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-neon-green" />
              </div>
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <GlassPanel className="p-6" hover glow="purple">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-white/50 mb-1">SPL Tokens</p>
                <h2 className="text-3xl font-bold text-white mb-2">
                  {connected ? splTokens.length : "—"}
                </h2>
                <p className="text-xs text-white/40">
                  {connected
                    ? `${savedTokens.length} HumbleTrust launch${savedTokens.length !== 1 ? "es" : ""}`
                    : "Connect wallet"}
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-neon-purple/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-neon-purple" />
              </div>
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <GlassPanel className="p-6" hover>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-white/50 mb-1">Network</p>
                <h2 className="text-xl font-bold text-white mb-2">Solana Devnet</h2>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                  <span className="text-xs text-white/50">HumbleTrust · V2 Active</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white/70" />
              </div>
            </div>
          </GlassPanel>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassPanel className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map(({ label, tab, icon: Icon, desc, color }) => (
              <motion.button
                key={tab}
                onClick={() => onTabChange(tab)}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="flex flex-col items-start gap-3 p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300 group text-left"
                style={{ "--hover-color": color } as React.CSSProperties}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm group-hover:text-white transition-colors">{label}</p>
                  <p className="text-xs text-white/40 mt-0.5">{desc}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Not connected prompt */}
      {!connected && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <GlassPanel className="p-8 text-center" glow="green">
            <Wallet className="w-12 h-12 text-neon-green/40 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Connect your wallet</h3>
            <p className="text-white/50 text-sm">See your SOL balance, SPL tokens, and HumbleTrust launches</p>
          </GlassPanel>
        </motion.div>
      )}

      {/* SPL Token Holdings */}
      {connected && splTokens.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <GlassPanel className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Token Holdings</h3>
              <button
                onClick={loadWalletData}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 disabled:opacity-40"
              >
                <RefreshCw size={11} className={loading ? "animate-spin" : undefined} />
                Refresh
              </button>
            </div>
            <div className="space-y-3">
              {splTokens.slice(0, 6).map((token) => (
                <div
                  key={token.mint}
                  className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                >
                  <div>
                    <p className="font-medium text-white">${token.symbol}</p>
                    <p className="text-sm text-white/40 font-mono">{token.mint.slice(0, 6)}...{token.mint.slice(-4)}</p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="font-medium text-white font-mono">
                        {token.balance.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                      </p>
                      {token.trustScore !== undefined && (
                        <p className="text-xs text-neon-green text-right">Trust {token.trustScore}</p>
                      )}
                    </div>
                    <a
                      href={`https://solscan.io/token/${token.mint}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-neon-green/50 hover:text-neon-green"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>
      )}

      {/* HumbleTrust launches */}
      {savedTokens.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <GlassPanel className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Your Launches</h3>
              <button
                onClick={() => onTabChange("discover")}
                className="text-xs text-neon-green/70 hover:text-neon-green transition-colors"
              >
                View all →
              </button>
            </div>
            <div className="space-y-3">
              {savedTokens.slice(0, 3).map((token) => (
                <div
                  key={token.mint}
                  onClick={() => onTabChange("discover")}
                  className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:border-neon-green/30 transition-all cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-white">
                      {token.name || "Token"}{" "}
                      <span className="text-neon-green/70">${token.symbol}</span>
                    </p>
                    <p className="text-xs text-white/40 font-mono">
                      {token.mint.slice(0, 8)}...{token.mint.slice(-6)}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="text-sm font-bold text-neon-green">Trust {token.trustScore ?? 0}</p>
                      <p className="text-xs text-white/40">{token.launchMode === "v2" ? "V2 Curve" : "V1"}</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-white/30" />
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>
      )}

      {/* Creator Earnings */}
      {connected && earnings.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <GlassPanel className="p-6" glow="green">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-neon-green/20 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-neon-green" />
                </div>
                <h3 className="text-lg font-bold text-white">Creator Earnings</h3>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/40">Total earned (0.5% fee)</p>
                <p className="text-lg font-bold text-neon-green font-mono">
                  ◎ {earnings.reduce((s, e) => s + e.solEarned, 0).toFixed(4)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {earnings.map(e => (
                <div key={e.mint} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                  <div>
                    <p className="font-medium text-white text-sm">${e.symbol}</p>
                    <p className="text-xs text-white/40">{e.tradeCount} trades</p>
                  </div>
                  <p className="font-mono font-bold text-neon-green">◎ {e.solEarned.toFixed(4)}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-white/30 mt-3">Fees auto-sent to creator wallet on each trade · based on last 500 trades</p>
          </GlassPanel>
        </motion.div>
      )}

      {/* Recent Transactions */}
      {recentTxs.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <GlassPanel className="p-6">
            <h3 className="text-lg font-bold text-white mb-4">Recent Transactions</h3>
            <div className="space-y-2">
              {recentTxs.map((tx) => (
                <div
                  key={tx.signature}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tx.err ? "bg-bearish" : "bg-neon-green"}`} />
                    <p className="text-sm font-mono text-white/60">
                      {tx.signature.slice(0, 12)}...{tx.signature.slice(-6)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tx.blockTime && (
                      <div className="flex items-center gap-1 text-white/40">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">{new Date(tx.blockTime * 1000).toLocaleTimeString()}</span>
                      </div>
                    )}
                    <a
                      href={`https://solscan.io/tx/${tx.signature}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-neon-green/50 hover:text-neon-green"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>
      )}
    </div>
  );
}

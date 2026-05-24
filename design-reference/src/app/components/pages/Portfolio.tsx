import { GlassPanel } from "../GlassPanel";
import { motion } from "motion/react";
import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp, ExternalLink, Wallet, RefreshCw } from "lucide-react";
import { listTokens } from "../../../lib/solana/image";

interface SplToken {
  mint: string;
  balance: number;
  symbol: string;
  name: string;
  trustScore?: number;
}

const COLORS = ["#00FF41", "#B026FF", "#00D4FF", "#FFD700", "#FF7A2F", "#FF3C6B"];

export function Portfolio() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [splTokens, setSplTokens] = useState<SplToken[]>([]);
  const [loading, setLoading] = useState(false);

  const savedTokens = listTokens();

  const loadPortfolio = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const [balanceLamports, parsedTokenAccounts] = await Promise.all([
        connection.getBalance(publicKey),
        connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID }),
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
        tokens.push({
          mint, balance,
          symbol: saved?.symbol || mint.slice(0, 4).toUpperCase(),
          name: saved?.name || "Unknown Token",
          trustScore: saved?.trustScore,
        });
      }
      setSplTokens(tokens.sort((a, b) => b.balance - a.balance));
    } catch (e) {
      console.error("Portfolio load error", e);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    if (connected && publicKey) {
      void loadPortfolio();
    } else {
      setSolBalance(null);
      setSplTokens([]);
    }
  }, [connected, publicKey?.toBase58()]);

  const pieItems = [
    ...(solBalance !== null && solBalance > 0 ? [{ name: "SOL", value: solBalance }] : []),
    ...splTokens.slice(0, 5).map((t, i) => ({ name: t.symbol, value: Math.max(0.001, t.balance) })),
  ];

  if (!connected) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <GlassPanel className="p-12 text-center" glow="green">
            <Wallet className="w-12 h-12 text-neon-green/40 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Connect your wallet</h2>
            <p className="text-white/50 text-sm">Connect your Solana wallet to view your portfolio.</p>
          </GlassPanel>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <GlassPanel className="p-6" glow="green">
          <p className="text-sm text-white/50 mb-1">SOL Balance</p>
          <h2 className="text-3xl font-bold text-white mb-2 font-mono">
            {solBalance !== null ? `◎ ${solBalance.toFixed(4)}` : "Loading..."}
          </h2>
          <p className="text-xs text-white/40 font-mono">
            {publicKey?.toBase58().slice(0, 6)}...{publicKey?.toBase58().slice(-6)}
          </p>
        </GlassPanel>

        <GlassPanel className="p-6">
          <p className="text-sm text-white/50 mb-1">SPL Tokens</p>
          <h2 className="text-3xl font-bold text-white mb-2">{splTokens.length}</h2>
          <div className="flex items-center gap-1 text-white/50">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">{savedTokens.length} via HumbleTrust</span>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <p className="text-sm text-white/50 mb-1">Launches</p>
          <h2 className="text-3xl font-bold text-white mb-2">{savedTokens.length}</h2>
          <p className="text-xs text-white/40">Tokens created on devnet</p>
        </GlassPanel>
      </motion.div>

      {/* Holdings + Pie chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <GlassPanel className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">Token Holdings</h3>
              <button
                onClick={loadPortfolio}
                disabled={loading}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-white/50 hover:text-white disabled:opacity-40"
              >
                <RefreshCw size={11} className={loading ? "animate-spin" : undefined} />
              </button>
            </div>

            {splTokens.length === 0 && !loading && (
              <p className="text-white/40 text-sm">No SPL tokens with non-zero balance on devnet.</p>
            )}

            <div className="space-y-3">
              {solBalance !== null && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neon-green/20 border border-neon-green/30 flex items-center justify-center text-sm font-bold text-neon-green">◎</div>
                    <div>
                      <p className="font-medium text-white">SOL</p>
                      <p className="text-xs text-white/40">Native · Devnet</p>
                    </div>
                  </div>
                  <p className="font-mono font-bold text-white">{solBalance.toFixed(4)}</p>
                </div>
              )}
              {splTokens.map((t, i) => (
                <div
                  key={t.mint}
                  className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: COLORS[i % COLORS.length] + "20",
                        border: `1px solid ${COLORS[i % COLORS.length]}40`,
                        color: COLORS[i % COLORS.length],
                      }}
                    >
                      {t.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        ${t.symbol}
                        {t.trustScore !== undefined && (
                          <span className="text-xs text-neon-green ml-2">Trust {t.trustScore}</span>
                        )}
                      </p>
                      <p className="text-xs text-white/40 font-mono">{t.mint.slice(0, 6)}...{t.mint.slice(-4)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-white">{t.balance.toLocaleString("en-US", { maximumFractionDigits: 4 })}</p>
                    <a
                      href={`https://solscan.io/token/${t.mint}?cluster=devnet`}
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <GlassPanel className="p-6">
            <h3 className="font-bold text-white mb-4">Allocation</h3>
            {pieItems.length > 0 ? (
              <>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieItems}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieItems.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(10,10,15,0.95)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-3">
                  {pieItems.map((item, i) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-white">{item.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-white/30 text-sm text-center py-8">No holdings to display</p>
            )}
          </GlassPanel>
        </motion.div>
      </div>

      {/* HumbleTrust Launches */}
      {savedTokens.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <GlassPanel className="p-6">
            <h3 className="font-bold text-white mb-4">Your HumbleTrust Launches</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Token</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-white/50">Mint</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-white/50">Trust</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-white/50">Mode</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-white/50">Date</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {savedTokens.map((token) => (
                    <tr key={token.mint} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-white">{token.name || "Token"}</p>
                          <p className="text-xs text-neon-green/70">${token.symbol}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-mono text-xs text-white/40">{token.mint.slice(0, 8)}...{token.mint.slice(-6)}</p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-neon-green">{token.trustScore ?? 0}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                          token.launchMode === "v2"
                            ? "bg-neon-green/20 text-neon-green"
                            : "bg-white/10 text-white/50"
                        }`}>
                          {token.launchMode === "v2" ? "V2" : "V1"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-white/40">
                        {new Date(token.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <a
                          href={`https://solscan.io/token/${token.mint}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-neon-green/50 hover:text-neon-green"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassPanel>
        </motion.div>
      )}
    </div>
  );
}

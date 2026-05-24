import { ArrowUpRight, ArrowDownRight, TrendingUp, Wallet, Activity, Clock } from "lucide-react";
import { GlassPanel } from "../GlassPanel";
import { motion } from "motion/react";

export function Dashboard() {
  const mockPositions = [
    { pair: "ETH/USDT", amount: "2.45 ETH", value: "$4,850.00", pnl: 12.5, pnlAmount: "$542.00" },
    { pair: "BTC/USDT", amount: "0.15 BTC", value: "$6,300.00", pnl: 8.3, pnlAmount: "$485.00" },
    { pair: "SOL/USDT", amount: "45.2 SOL", value: "$1,810.00", pnl: -3.2, pnlAmount: "-$58.00" },
  ];

  const mockTransactions = [
    { type: "Swap", pair: "ETH → USDT", amount: "0.5 ETH", time: "2 min ago", status: "success" },
    { type: "Trade", pair: "BTC/USDT", amount: "$2,500", time: "15 min ago", status: "success" },
    { type: "Stake", pair: "SOL", amount: "10 SOL", time: "1 hour ago", status: "success" },
    { type: "Swap", pair: "USDT → ETH", amount: "$1,000", time: "3 hours ago", status: "success" },
  ];

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassPanel className="p-6" hover glow="green">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-white/50 mb-1">Total Balance</p>
                <h2 className="text-3xl font-bold text-white mb-2">$12,960.00</h2>
                <div className="flex items-center gap-1 text-neon-green">
                  <ArrowUpRight className="w-4 h-4" />
                  <span className="text-sm font-medium">+18.5%</span>
                  <span className="text-xs text-white/50">24h</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-neon-green/20 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-neon-green" />
              </div>
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <GlassPanel className="p-6" hover glow="purple">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-white/50 mb-1">24h PnL</p>
                <h2 className="text-3xl font-bold text-neon-green mb-2">+$969.00</h2>
                <div className="flex items-center gap-1 text-neon-green">
                  <ArrowUpRight className="w-4 h-4" />
                  <span className="text-sm font-medium">+7.48%</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-neon-purple/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-neon-purple" />
              </div>
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <GlassPanel className="p-6" hover>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-white/50 mb-1">Active Trades</p>
                <h2 className="text-3xl font-bold text-white mb-2">8</h2>
                <div className="flex items-center gap-1 text-white/50">
                  <Activity className="w-4 h-4" />
                  <span className="text-sm">3 positions open</span>
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <GlassPanel className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {["Swap", "Trade", "Charts", "Staking"].map((action, i) => (
              <button
                key={action}
                className="px-6 py-4 rounded-lg bg-white/5 border border-white/10 hover:border-neon-green/50 hover:bg-neon-green/5 transition-all duration-300 group"
              >
                <span className="text-white/70 group-hover:text-neon-green transition-colors font-medium">
                  {action}
                </span>
              </button>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Active Positions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <GlassPanel className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">Active Positions</h3>
          <div className="space-y-3">
            {mockPositions.map((position, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              >
                <div>
                  <p className="font-medium text-white">{position.pair}</p>
                  <p className="text-sm text-white/50">{position.amount}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-white">{position.value}</p>
                  <div className={`flex items-center gap-1 justify-end ${position.pnl >= 0 ? "text-neon-green" : "text-bearish"}`}>
                    {position.pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    <span className="text-sm font-medium">{position.pnl >= 0 ? "+" : ""}{position.pnl}%</span>
                    <span className="text-sm">({position.pnlAmount})</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <GlassPanel className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            {mockTransactions.map((tx, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-neon-green/10 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-neon-green" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{tx.type}</p>
                    <p className="text-sm text-white/50">{tx.pair}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-white">{tx.amount}</p>
                  <div className="flex items-center gap-1 text-white/50 justify-end">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">{tx.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  );
}

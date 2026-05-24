import { GlassPanel } from "../GlassPanel";
import { motion } from "motion/react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, ExternalLink } from "lucide-react";

export function Portfolio() {
  const holdings = [
    { token: "ETH", icon: "⟠", amount: "2.45", value: "$4,850.00", allocation: 37.4, change24h: 3.45, pnl: "$542.00" },
    { token: "BTC", icon: "₿", amount: "0.15", value: "$6,300.00", allocation: 48.6, change24h: 2.18, pnl: "$485.00" },
    { token: "SOL", icon: "◎", amount: "45.2", value: "$1,810.00", allocation: 14.0, change24h: -1.24, pnl: "-$58.00" },
  ];

  const pieData = holdings.map(h => ({ name: h.token, value: h.allocation }));
  const COLORS = ["#00FF41", "#B026FF", "#00D4FF"];

  const performanceData = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    value: 10000 + Math.random() * 3000,
  }));

  const transactions = [
    { type: "Buy", token: "ETH", amount: "0.5 ETH", value: "$990.00", date: "2024-05-20", hash: "0x1a2b...3c4d" },
    { type: "Sell", token: "BTC", amount: "0.02 BTC", value: "$840.00", date: "2024-05-19", hash: "0x5e6f...7g8h" },
    { type: "Swap", token: "SOL → ETH", amount: "10 SOL", value: "$401.20", date: "2024-05-18", hash: "0x9i0j...1k2l" },
    { type: "Stake", token: "SOL", amount: "20 SOL", value: "$804.00", date: "2024-05-17", hash: "0x3m4n...5o6p" },
  ];

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <GlassPanel className="p-6" glow="green">
          <p className="text-sm text-white/50 mb-1">Total Value</p>
          <h2 className="text-3xl font-bold text-white mb-2">$12,960.00</h2>
          <div className="flex items-center gap-1 text-neon-green">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">+18.5% All Time</span>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <p className="text-sm text-white/50 mb-1">24h PnL</p>
          <h2 className="text-3xl font-bold text-neon-green mb-2">+$969.00</h2>
          <div className="flex items-center gap-1 text-neon-green">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">+7.48%</span>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <p className="text-sm text-white/50 mb-1">7d PnL</p>
          <h2 className="text-3xl font-bold text-neon-green mb-2">+$1,245.00</h2>
          <div className="flex items-center gap-1 text-neon-green">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">+10.6%</span>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <p className="text-sm text-white/50 mb-1">30d PnL</p>
          <h2 className="text-3xl font-bold text-white/70 mb-2">+$2,105.00</h2>
          <div className="flex items-center gap-1 text-white/50">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">+19.4%</span>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <GlassPanel className="p-6">
            <h3 className="font-bold text-white mb-4">Portfolio Performance</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" />
                  <YAxis stroke="rgba(255,255,255,0.3)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(10, 10, 15, 0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#00FF41" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassPanel>
        </motion.div>

        {/* Asset Allocation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <GlassPanel className="p-6">
            <h3 className="font-bold text-white mb-4">Asset Allocation</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {holdings.map((h, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[i] }}
                    />
                    <span className="text-sm text-white">{h.token}</span>
                  </div>
                  <span className="text-sm text-white/70">{h.allocation}%</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>
      </div>

      {/* Holdings Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <GlassPanel className="p-6">
          <h3 className="font-bold text-white mb-4">Token Holdings</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/70">Asset</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-white/70">Amount</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-white/70">Value</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-white/70">Allocation</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-white/70">24h Change</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-white/70">PnL</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{holding.icon}</span>
                        <span className="font-medium text-white">{holding.token}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-white">{holding.amount}</td>
                    <td className="py-3 px-4 text-right font-medium text-white">{holding.value}</td>
                    <td className="py-3 px-4 text-right text-white/70">{holding.allocation}%</td>
                    <td className={`py-3 px-4 text-right ${holding.change24h >= 0 ? "text-neon-green" : "text-bearish"}`}>
                      <div className="flex items-center justify-end gap-1">
                        {holding.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {holding.change24h >= 0 ? "+" : ""}{holding.change24h}%
                      </div>
                    </td>
                    <td className={`py-3 px-4 text-right font-medium ${holding.pnl.startsWith("-") ? "text-bearish" : "text-neon-green"}`}>
                      {holding.pnl}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Transaction History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <GlassPanel className="p-6">
          <h3 className="font-bold text-white mb-4">Transaction History</h3>
          <div className="space-y-2">
            {transactions.map((tx, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className={`px-3 py-1 rounded text-sm ${
                    tx.type === "Buy" ? "bg-neon-green/20 text-neon-green" :
                    tx.type === "Sell" ? "bg-bearish/20 text-bearish" :
                    "bg-neon-purple/20 text-neon-purple"
                  }`}>
                    {tx.type}
                  </div>
                  <div>
                    <p className="font-medium text-white">{tx.token}</p>
                    <p className="text-sm text-white/50">{tx.amount}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-white">{tx.value}</p>
                  <div className="flex items-center gap-1 text-xs text-white/50">
                    <span>{tx.date}</span>
                    <button className="hover:text-neon-green transition-colors">
                      <ExternalLink className="w-3 h-3" />
                    </button>
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

import { GlassPanel } from "../GlassPanel";
import { motion } from "motion/react";
import { ChevronRight, Wallet, Globe, DollarSign, Bell, Shield, Zap } from "lucide-react";
import { useState } from "react";

export function Settings() {
  const [slippage, setSlippage] = useState("0.5");
  const [deadline, setDeadline] = useState("20");
  const [network, setNetwork] = useState("ethereum");
  const [currency, setCurrency] = useState("USD");
  const [language, setLanguage] = useState("English");

  const networks = [
    { id: "ethereum", name: "Ethereum", icon: "⟠" },
    { id: "bsc", name: "Binance Smart Chain", icon: "🟡" },
    { id: "polygon", name: "Polygon", icon: "🟣" },
    { id: "solana", name: "Solana", icon: "◎" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-white/50">Manage your preferences and configurations</p>
      </motion.div>

      {/* Wallet Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <GlassPanel className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-neon-green/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-neon-green" />
            </div>
            <h2 className="text-xl font-bold text-white">Wallet</h2>
          </div>

          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:border-neon-green/50 transition-all">
              <div>
                <p className="font-medium text-white">Connected Wallet</p>
                <p className="text-sm text-white/50">0x742d...5a3c</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30" />
            </button>

            <button className="w-full flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:border-bearish/50 transition-all">
              <div>
                <p className="font-medium text-white">Disconnect Wallet</p>
                <p className="text-sm text-white/50">Sign out from current wallet</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30" />
            </button>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Trading Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <GlassPanel className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-neon-purple/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-neon-purple" />
            </div>
            <h2 className="text-xl font-bold text-white">Trading</h2>
          </div>

          <div className="space-y-4">
            {/* Slippage Tolerance */}
            <div>
              <label className="text-sm font-medium text-white mb-2 block">
                Slippage Tolerance
              </label>
              <div className="flex gap-2">
                {["0.1", "0.5", "1.0"].map((value) => (
                  <button
                    key={value}
                    onClick={() => setSlippage(value)}
                    className={`px-4 py-2 rounded-lg transition-all ${
                      slippage === value
                        ? "bg-neon-green/20 text-neon-green border border-neon-green/50"
                        : "bg-white/5 text-white/50 border border-white/10"
                    }`}
                  >
                    {value}%
                  </button>
                ))}
                <input
                  type="text"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-center focus:border-neon-green/50 focus:outline-none"
                  placeholder="Custom"
                />
              </div>
              <p className="text-xs text-white/50 mt-2">
                Your transaction will revert if the price changes unfavorably by more than this percentage
              </p>
            </div>

            {/* Transaction Deadline */}
            <div>
              <label className="text-sm font-medium text-white mb-2 block">
                Transaction Deadline (minutes)
              </label>
              <input
                type="text"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-neon-green/50 focus:outline-none"
                placeholder="20"
              />
              <p className="text-xs text-white/50 mt-2">
                Your transaction will revert if pending for longer than this time
              </p>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Network Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <GlassPanel className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-white/70" />
            </div>
            <h2 className="text-xl font-bold text-white">Network</h2>
          </div>

          <div className="space-y-2">
            {networks.map((net) => (
              <button
                key={net.id}
                onClick={() => setNetwork(net.id)}
                className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all ${
                  network === net.id
                    ? "bg-neon-green/10 border-neon-green/30"
                    : "bg-white/5 border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{net.icon}</span>
                  <span className={`font-medium ${network === net.id ? "text-neon-green" : "text-white"}`}>
                    {net.name}
                  </span>
                </div>
                {network === net.id && (
                  <div className="w-2 h-2 rounded-full bg-neon-green" />
                )}
              </button>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <GlassPanel className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-white/70" />
            </div>
            <h2 className="text-xl font-bold text-white">Preferences</h2>
          </div>

          <div className="space-y-4">
            {/* Language */}
            <div>
              <label className="text-sm font-medium text-white mb-2 block">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-neon-green/50 focus:outline-none"
              >
                <option value="English">English</option>
                <option value="Spanish">Español</option>
                <option value="Chinese">中文</option>
                <option value="Japanese">日本語</option>
              </select>
            </div>

            {/* Currency */}
            <div>
              <label className="text-sm font-medium text-white mb-2 block">
                Display Currency
              </label>
              <div className="flex gap-2">
                {["USD", "EUR", "GBP", "JPY"].map((curr) => (
                  <button
                    key={curr}
                    onClick={() => setCurrency(curr)}
                    className={`flex-1 px-4 py-2 rounded-lg transition-all ${
                      currency === curr
                        ? "bg-neon-green/20 text-neon-green border border-neon-green/50"
                        : "bg-white/5 text-white/50 border border-white/10"
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <GlassPanel className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-white/70" />
            </div>
            <h2 className="text-xl font-bold text-white">Notifications</h2>
          </div>

          <div className="space-y-3">
            {[
              { label: "Price Alerts", desc: "Get notified when prices change" },
              { label: "Transaction Updates", desc: "Updates on your transactions" },
              { label: "Staking Rewards", desc: "Notifications about earned rewards" },
              { label: "New Features", desc: "Updates about new platform features" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10"
              >
                <div>
                  <p className="font-medium text-white">{item.label}</p>
                  <p className="text-sm text-white/50">{item.desc}</p>
                </div>
                <button className="w-12 h-6 rounded-full bg-neon-green/20 border border-neon-green/50 relative">
                  <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-neon-green" />
                </button>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Security */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <GlassPanel className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white/70" />
            </div>
            <h2 className="text-xl font-bold text-white">Security</h2>
          </div>

          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all">
              <div>
                <p className="font-medium text-white">Clear Transaction History</p>
                <p className="text-sm text-white/50">Remove all transaction records</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30" />
            </button>

            <button className="w-full flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all">
              <div>
                <p className="font-medium text-white">Export Private Data</p>
                <p className="text-sm text-white/50">Download your data</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/30" />
            </button>
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  );
}

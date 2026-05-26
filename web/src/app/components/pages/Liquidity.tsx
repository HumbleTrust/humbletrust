import { GlassPanel } from "../GlassPanel";
import { motion } from "motion/react";
import { Plus, Minus, Droplet, TrendingUp } from "lucide-react";
import { useState } from "react";

export function Liquidity() {
  const [selectedPool, setSelectedPool] = useState<number | null>(null);

  const pools = [
    {
      name: "ETH/USDT",
      icons: ["⟠", "₮"],
      tvl: "$125.5M",
      volume24h: "$45.2M",
      apy: "18.5%",
      fee: "0.30%",
      myLiquidity: "$4,850.00",
      myShare: "0.038%",
    },
    {
      name: "BTC/ETH",
      icons: ["₿", "⟠"],
      tvl: "$98.3M",
      volume24h: "$32.1M",
      apy: "12.3%",
      fee: "0.30%",
      myLiquidity: "$0.00",
      myShare: "0%",
    },
    {
      name: "SOL/USDC",
      icons: ["◎", "💵"],
      tvl: "$42.7M",
      volume24h: "$18.5M",
      apy: "24.7%",
      fee: "0.25%",
      myLiquidity: "$1,200.00",
      myShare: "0.028%",
    },
    {
      name: "AVAX/USDT",
      icons: ["🔺", "₮"],
      tvl: "$28.4M",
      volume24h: "$9.8M",
      apy: "16.2%",
      fee: "0.30%",
      myLiquidity: "$0.00",
      myShare: "0%",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Liquidity Pools</h1>
            <p className="text-white/50">Provide liquidity and earn trading fees</p>
          </div>
          <button className="px-6 py-3 rounded-lg bg-gradient-to-r from-neon-green to-neon-purple text-black font-medium hover:shadow-[0_0_20px_rgba(0,255,65,0.4)] transition-all">
            Create New Pool
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <GlassPanel className="p-6" glow="green">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-neon-green/20 flex items-center justify-center">
                <Droplet className="w-6 h-6 text-neon-green" />
              </div>
              <div>
                <p className="text-sm text-white/50">My Liquidity</p>
                <p className="text-2xl font-bold text-white">$6,050.00</p>
              </div>
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <GlassPanel className="p-6" glow="purple">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-neon-purple/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-neon-purple" />
              </div>
              <div>
                <p className="text-sm text-white/50">Fees Earned (24h)</p>
                <p className="text-2xl font-bold text-neon-green">+$42.50</p>
              </div>
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <GlassPanel className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-2xl">💧</span>
              </div>
              <div>
                <p className="text-sm text-white/50">Active Positions</p>
                <p className="text-2xl font-bold text-white">2</p>
              </div>
            </div>
          </GlassPanel>
        </motion.div>
      </div>

      {/* Pools Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <GlassPanel className="p-6">
          <h3 className="font-bold text-white mb-4">Available Pools</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pools.map((pool, i) => (
              <div
                key={i}
                className="p-5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
                onClick={() => setSelectedPool(i)}
              >
                {/* Pool Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {pool.icons.map((icon, idx) => (
                        <div key={idx} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl border-2 border-[rgba(10,10,15,0.9)]">
                          {icon}
                        </div>
                      ))}
                    </div>
                    <span className="font-bold text-white text-lg">{pool.name}</span>
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-neon-green/20 text-neon-green text-sm font-medium">
                    {pool.apy} APY
                  </div>
                </div>

                {/* Pool Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-white/50 mb-1">TVL</p>
                    <p className="font-medium text-white">{pool.tvl}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 mb-1">24h Volume</p>
                    <p className="font-medium text-white">{pool.volume24h}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 mb-1">Trading Fee</p>
                    <p className="font-medium text-white">{pool.fee}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50 mb-1">My Share</p>
                    <p className="font-medium text-white">{pool.myShare}</p>
                  </div>
                </div>

                {/* My Liquidity */}
                {parseFloat(pool.myLiquidity.replace(/[$,]/g, "")) > 0 && (
                  <div className="p-3 rounded-lg bg-neon-green/10 border border-neon-green/30 mb-3">
                    <p className="text-xs text-neon-green mb-1">My Liquidity</p>
                    <p className="font-bold text-white">{pool.myLiquidity}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button className="flex-1 px-4 py-2 rounded-lg bg-neon-green/20 border border-neon-green/30 text-neon-green hover:bg-neon-green/30 transition-all flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                  {parseFloat(pool.myLiquidity.replace(/[$,]/g, "")) > 0 && (
                    <button className="flex-1 px-4 py-2 rounded-lg bg-bearish/20 border border-bearish/30 text-bearish hover:bg-bearish/30 transition-all flex items-center justify-center gap-2">
                      <Minus className="w-4 h-4" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* My Positions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <GlassPanel className="p-6">
          <h3 className="font-bold text-white mb-4">My Positions</h3>
          <div className="space-y-3">
            {pools.filter(p => parseFloat(p.myLiquidity.replace(/[$,]/g, "")) > 0).map((pool, i) => (
              <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {pool.icons.map((icon, idx) => (
                        <div key={idx} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-lg border-2 border-[rgba(10,10,15,0.9)]">
                          {icon}
                        </div>
                      ))}
                    </div>
                    <span className="font-medium text-white">{pool.name}</span>
                  </div>
                  <span className="px-2 py-1 rounded bg-neon-green/20 text-neon-green text-xs">
                    Active
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-white/50 mb-1">My Liquidity</p>
                    <p className="font-medium text-white">{pool.myLiquidity}</p>
                  </div>
                  <div>
                    <p className="text-white/50 mb-1">Share of Pool</p>
                    <p className="font-medium text-white">{pool.myShare}</p>
                  </div>
                  <div>
                    <p className="text-white/50 mb-1">Fees Earned</p>
                    <p className="font-medium text-neon-green">+$18.50</p>
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

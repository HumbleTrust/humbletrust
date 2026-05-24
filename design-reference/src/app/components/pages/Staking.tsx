import { GlassPanel } from "../GlassPanel";
import { motion } from "motion/react";
import { Coins, Clock, TrendingUp, Lock } from "lucide-react";

export function Staking() {
  const stakingPools = [
    {
      token: "ETH",
      icon: "⟠",
      apr: "5.2%",
      tvl: "$2.4B",
      staked: "2.45 ETH",
      value: "$4,850.00",
      rewards: "0.0245 ETH",
      rewardsValue: "$48.50",
      lockPeriod: "Flexible",
      status: "Active",
    },
    {
      token: "SOL",
      icon: "◎",
      apr: "7.8%",
      tvl: "$580M",
      staked: "0 SOL",
      value: "$0.00",
      rewards: "0 SOL",
      rewardsValue: "$0.00",
      lockPeriod: "30 days",
      status: "Available",
    },
    {
      token: "BTC",
      icon: "₿",
      apr: "3.5%",
      tvl: "$1.8B",
      staked: "0 BTC",
      value: "$0.00",
      rewards: "0 BTC",
      rewardsValue: "$0.00",
      lockPeriod: "90 days",
      status: "Available",
    },
    {
      token: "AVAX",
      icon: "🔺",
      apr: "12.4%",
      tvl: "$125M",
      staked: "0 AVAX",
      value: "$0.00",
      rewards: "0 AVAX",
      rewardsValue: "$0.00",
      lockPeriod: "60 days",
      status: "Available",
    },
  ];

  const activeStakes = stakingPools.filter(p => parseFloat(p.value.replace(/[$,]/g, "")) > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Staking & Earn</h1>
          <p className="text-white/50">Stake your tokens and earn rewards</p>
        </div>
      </motion.div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <GlassPanel className="p-6" glow="green">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-neon-green/20 flex items-center justify-center">
                <Coins className="w-6 h-6 text-neon-green" />
              </div>
              <div>
                <p className="text-sm text-white/50">Total Staked</p>
                <p className="text-2xl font-bold text-white">$4,850.00</p>
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
                <p className="text-sm text-white/50">Total Rewards</p>
                <p className="text-2xl font-bold text-neon-green">$48.50</p>
              </div>
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <GlassPanel className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <p className="text-sm text-white/50">Avg APR</p>
                <p className="text-2xl font-bold text-white">5.2%</p>
              </div>
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <GlassPanel className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-white/70" />
              </div>
              <div>
                <p className="text-sm text-white/50">Active Stakes</p>
                <p className="text-2xl font-bold text-white">{activeStakes.length}</p>
              </div>
            </div>
          </GlassPanel>
        </motion.div>
      </div>

      {/* Staking Pools */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <GlassPanel className="p-6">
          <h3 className="font-bold text-white mb-4">Staking Pools</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stakingPools.map((pool, i) => {
              const isActive = pool.status === "Active";

              return (
                <div
                  key={i}
                  className={`p-5 rounded-lg border transition-all ${
                    isActive
                      ? "bg-neon-green/5 border-neon-green/30"
                      : "bg-white/5 border-white/10 hover:border-white/20"
                  }`}
                >
                  {/* Pool Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-2xl">
                        {pool.icon}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">{pool.token} Staking</h4>
                        <p className="text-sm text-white/50">{pool.lockPeriod}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="px-3 py-1 rounded-lg bg-neon-green/20 text-neon-green font-bold">
                        {pool.apr}
                      </div>
                      <p className="text-xs text-white/50 mt-1">APR</p>
                    </div>
                  </div>

                  {/* Pool Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-lg bg-white/5">
                      <p className="text-xs text-white/50 mb-1">TVL</p>
                      <p className="font-medium text-white">{pool.tvl}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <p className="text-xs text-white/50 mb-1">Lock Period</p>
                      <div className="flex items-center gap-1">
                        {pool.lockPeriod === "Flexible" ? (
                          <span className="font-medium text-neon-green">{pool.lockPeriod}</span>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-white/50" />
                            <span className="font-medium text-white">{pool.lockPeriod}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Active Stake Info */}
                  {isActive && (
                    <div className="p-3 rounded-lg bg-neon-green/10 border border-neon-green/30 mb-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-white/50 mb-1">Staked</p>
                          <p className="font-medium text-white">{pool.staked}</p>
                          <p className="text-xs text-white/50">{pool.value}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/50 mb-1">Rewards</p>
                          <p className="font-medium text-neon-green">{pool.rewards}</p>
                          <p className="text-xs text-white/50">{pool.rewardsValue}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {isActive ? (
                      <>
                        <button className="flex-1 px-4 py-2 rounded-lg bg-neon-green/20 border border-neon-green/30 text-neon-green hover:bg-neon-green/30 transition-all font-medium">
                          Claim Rewards
                        </button>
                        <button className="flex-1 px-4 py-2 rounded-lg bg-bearish/20 border border-bearish/30 text-bearish hover:bg-bearish/30 transition-all font-medium">
                          Unstake
                        </button>
                      </>
                    ) : (
                      <button className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-neon-green/20 to-neon-purple/20 border border-neon-green/30 text-neon-green hover:shadow-[0_0_20px_rgba(0,255,65,0.3)] transition-all font-medium">
                        Stake {pool.token}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      </motion.div>

      {/* My Active Stakes */}
      {activeStakes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <GlassPanel className="p-6">
            <h3 className="font-bold text-white mb-4">My Active Stakes</h3>
            <div className="space-y-3">
              {activeStakes.map((stake, i) => (
                <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-xl">
                        {stake.icon}
                      </div>
                      <div>
                        <p className="font-medium text-white">{stake.token} Staking</p>
                        <p className="text-sm text-white/50">{stake.lockPeriod}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-neon-green font-medium">{stake.apr} APR</p>
                      <p className="text-xs text-white/50">Active</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-white/50 mb-1">Staked Amount</p>
                      <p className="font-medium text-white">{stake.staked}</p>
                      <p className="text-xs text-white/50">{stake.value}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/50 mb-1">Earned Rewards</p>
                      <p className="font-medium text-neon-green">{stake.rewards}</p>
                      <p className="text-xs text-white/50">{stake.rewardsValue}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/50 mb-1">Time Staked</p>
                      <p className="font-medium text-white">45 days</p>
                      <p className="text-xs text-white/50">Ongoing</p>
                    </div>
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

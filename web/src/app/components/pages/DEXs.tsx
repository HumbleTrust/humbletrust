import { Search, SlidersHorizontal, TrendingUp, Droplet } from "lucide-react";
import { GlassPanel } from "../GlassPanel";
import { motion } from "motion/react";
import { useState } from "react";

export function DEXs() {
  const [selectedChain, setSelectedChain] = useState("all");

  const dexs = [
    {
      name: "Uniswap V3",
      logo: "🦄",
      chain: "Ethereum",
      liquidity: "$4.2B",
      volume24h: "$1.8B",
      fee: "0.30%",
      popular: true,
      bestPrice: true,
    },
    {
      name: "PancakeSwap",
      logo: "🥞",
      chain: "BSC",
      liquidity: "$2.8B",
      volume24h: "$856M",
      fee: "0.25%",
      popular: true,
      bestPrice: false,
    },
    {
      name: "Curve Finance",
      logo: "🌊",
      chain: "Ethereum",
      liquidity: "$3.5B",
      volume24h: "$420M",
      fee: "0.04%",
      popular: true,
      bestPrice: false,
    },
    {
      name: "SushiSwap",
      logo: "🍣",
      chain: "Multi-chain",
      liquidity: "$850M",
      volume24h: "$285M",
      fee: "0.30%",
      popular: false,
      bestPrice: false,
    },
    {
      name: "Balancer",
      logo: "⚖️",
      chain: "Ethereum",
      liquidity: "$1.2B",
      volume24h: "$156M",
      fee: "Variable",
      popular: false,
      bestPrice: false,
    },
    {
      name: "Raydium",
      logo: "☀️",
      chain: "Solana",
      liquidity: "$680M",
      volume24h: "$542M",
      fee: "0.25%",
      popular: true,
      bestPrice: false,
    },
  ];

  const chains = ["all", "Ethereum", "BSC", "Solana", "Multi-chain"];

  const filteredDexs = selectedChain === "all"
    ? dexs
    : dexs.filter(dex => dex.chain === selectedChain);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">DEX Aggregator</h1>
            <p className="text-white/50">Find the best rates across decentralized exchanges</p>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-neon-green/50 transition-all flex items-center gap-2 text-white/70 hover:text-white">
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>
      </motion.div>

      {/* Search and Chain Filter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <GlassPanel className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <input
                type="text"
                placeholder="Search DEXs..."
                className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-neon-green/50 focus:outline-none transition-all"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {chains.map((chain) => (
                <button
                  key={chain}
                  onClick={() => setSelectedChain(chain)}
                  className={`px-4 py-2 rounded-lg border transition-all whitespace-nowrap ${
                    selectedChain === chain
                      ? "bg-neon-green/10 border-neon-green/50 text-neon-green"
                      : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                  }`}
                >
                  {chain === "all" ? "All Chains" : chain}
                </button>
              ))}
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* DEX Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDexs.map((dex, i) => (
          <motion.div
            key={dex.name}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.05 }}
          >
            <GlassPanel className="p-6 relative overflow-hidden" hover glow={dex.bestPrice ? "green" : "none"}>
              {/* Badges */}
              <div className="absolute top-3 right-3 flex flex-col gap-2">
                {dex.popular && (
                  <span className="px-2 py-1 text-xs rounded bg-neon-purple/20 text-neon-purple border border-neon-purple/30">
                    Popular
                  </span>
                )}
                {dex.bestPrice && (
                  <span className="px-2 py-1 text-xs rounded bg-neon-green/20 text-neon-green border border-neon-green/30">
                    Best Price
                  </span>
                )}
              </div>

              {/* DEX Info */}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-2xl">
                  {dex.logo}
                </div>
                <div>
                  <h3 className="font-bold text-white">{dex.name}</h3>
                  <p className="text-sm text-white/50">{dex.chain}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/50">
                    <Droplet className="w-4 h-4" />
                    <span className="text-sm">Liquidity</span>
                  </div>
                  <span className="font-medium text-white">{dex.liquidity}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/50">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm">24h Volume</span>
                  </div>
                  <span className="font-medium text-white">{dex.volume24h}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">Trading Fee</span>
                  <span className="font-medium text-white">{dex.fee}</span>
                </div>
              </div>

              {/* Trade Button */}
              <button className="w-full mt-4 px-4 py-2 rounded-lg bg-gradient-to-r from-neon-green/20 to-neon-purple/20 border border-neon-green/30 text-neon-green hover:shadow-[0_0_20px_rgba(0,255,65,0.3)] transition-all duration-300 font-medium">
                Trade on {dex.name}
              </button>
            </GlassPanel>
          </motion.div>
        ))}
      </div>

      {/* Comparison Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <GlassPanel className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">Detailed Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/70">DEX</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/70">Chain</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-white/70">Liquidity</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-white/70">24h Volume</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-white/70">Fee</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-white/70">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDexs.map((dex, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{dex.logo}</span>
                        <span className="font-medium text-white">{dex.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-white/70">{dex.chain}</td>
                    <td className="py-3 px-4 text-right font-medium text-white">{dex.liquidity}</td>
                    <td className="py-3 px-4 text-right font-medium text-white">{dex.volume24h}</td>
                    <td className="py-3 px-4 text-right text-white/70">{dex.fee}</td>
                    <td className="py-3 px-4 text-center">
                      {dex.bestPrice && (
                        <span className="inline-block px-2 py-1 text-xs rounded bg-neon-green/20 text-neon-green">
                          Best
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  );
}

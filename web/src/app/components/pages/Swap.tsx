import { ArrowDownUp, Settings, Info, ChevronDown } from "lucide-react";
import { GlassPanel } from "../GlassPanel";
import { motion } from "motion/react";
import { useState } from "react";

interface Token {
  symbol: string;
  name: string;
  icon: string;
  balance: string;
}

const tokens: Token[] = [
  { symbol: "ETH", name: "Ethereum", icon: "⟠", balance: "2.45" },
  { symbol: "USDT", name: "Tether USD", icon: "₮", balance: "5,420.00" },
  { symbol: "BTC", name: "Bitcoin", icon: "₿", balance: "0.15" },
  { symbol: "SOL", name: "Solana", icon: "◎", balance: "45.2" },
  { symbol: "AVAX", name: "Avalanche", icon: "🔺", balance: "120.5" },
];

export function Swap() {
  const [fromToken, setFromToken] = useState(tokens[0]);
  const [toToken, setToToken] = useState(tokens[1]);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [showSettings, setShowSettings] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  const handleReverse = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleMaxClick = () => {
    setFromAmount(fromToken.balance);
    setToAmount((parseFloat(fromToken.balance) * 1980.45).toFixed(2));
  };

  const handleSwap = () => {
    setIsSwapping(true);
    setTimeout(() => {
      setIsSwapping(false);
      setFromAmount("");
      setToAmount("");
    }, 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-3xl font-bold text-white mb-2">Token Swap</h1>
        <p className="text-white/50">Trade tokens instantly at the best rates</p>
      </motion.div>

      {/* Main Swap Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <GlassPanel className="p-6" glow="green">
          {/* Settings Button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
            >
              <Settings className="w-5 h-5 text-white/70" />
            </button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-4 p-4 rounded-lg bg-white/5 border border-white/10"
            >
              <h3 className="font-medium text-white mb-3">Slippage Tolerance</h3>
              <div className="flex gap-2">
                {["0.1", "0.5", "1.0"].map((value) => (
                  <button
                    key={value}
                    onClick={() => setSlippage(value)}
                    className={`px-4 py-2 rounded-lg transition-all ${
                      slippage === value
                        ? "bg-neon-green/20 text-neon-green border border-neon-green/50"
                        : "bg-white/5 text-white/50"
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
            </motion.div>
          )}

          {/* From Token */}
          <div className="space-y-2 mb-2">
            <div className="flex justify-between text-sm text-white/50">
              <span>From</span>
              <span>Balance: {fromToken.balance}</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10">
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-all">
                <span className="text-2xl">{fromToken.icon}</span>
                <span className="font-medium text-white">{fromToken.symbol}</span>
                <ChevronDown className="w-4 h-4 text-white/50" />
              </button>
              <input
                type="text"
                value={fromAmount}
                onChange={(e) => {
                  setFromAmount(e.target.value);
                  if (e.target.value) {
                    setToAmount((parseFloat(e.target.value) * 1980.45).toFixed(2));
                  }
                }}
                placeholder="0.0"
                className="flex-1 bg-transparent text-2xl text-white font-medium focus:outline-none"
              />
              <button
                onClick={handleMaxClick}
                className="px-3 py-1 rounded bg-neon-purple/20 text-neon-purple text-sm font-medium hover:bg-neon-purple/30 transition-all"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Reverse Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={handleReverse}
              className="p-3 rounded-lg bg-[rgba(10,10,15,0.9)] border border-white/10 hover:border-neon-green/50 transition-all hover:rotate-180 duration-300"
            >
              <ArrowDownUp className="w-5 h-5 text-white/70" />
            </button>
          </div>

          {/* To Token */}
          <div className="space-y-2 mt-2">
            <div className="flex justify-between text-sm text-white/50">
              <span>To</span>
              <span>Balance: {toToken.balance}</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10">
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-all">
                <span className="text-2xl">{toToken.icon}</span>
                <span className="font-medium text-white">{toToken.symbol}</span>
                <ChevronDown className="w-4 h-4 text-white/50" />
              </button>
              <input
                type="text"
                value={toAmount}
                readOnly
                placeholder="0.0"
                className="flex-1 bg-transparent text-2xl text-white font-medium focus:outline-none"
              />
            </div>
          </div>

          {/* Swap Details */}
          {fromAmount && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 space-y-2"
            >
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Rate</span>
                <span className="text-white">1 {fromToken.symbol} = 1,980.45 {toToken.symbol}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Price Impact</span>
                <span className="text-neon-green">{"<"}0.01%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Slippage Tolerance</span>
                <span className="text-white">{slippage}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Gas Fee (estimated)</span>
                <span className="text-white">$2.45</span>
              </div>
            </motion.div>
          )}

          {/* Route */}
          {fromAmount && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10"
            >
              <div className="flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-neon-green" />
                <span className="text-white/50">Route:</span>
                <span className="text-white">{fromToken.symbol}</span>
                <span className="text-white/30">→</span>
                <span className="text-neon-green">Uniswap V3</span>
                <span className="text-white/30">→</span>
                <span className="text-white">{toToken.symbol}</span>
              </div>
            </motion.div>
          )}

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            disabled={!fromAmount || isSwapping}
            className={`w-full mt-6 px-6 py-4 rounded-lg font-medium text-lg transition-all duration-300 ${
              !fromAmount
                ? "bg-white/10 text-white/30 cursor-not-allowed"
                : isSwapping
                ? "bg-neon-purple/40 text-white cursor-wait"
                : "bg-gradient-to-r from-neon-green to-neon-purple text-black hover:shadow-[0_0_30px_rgba(0,255,65,0.5)]"
            }`}
          >
            {isSwapping ? "Swapping..." : !fromAmount ? "Enter Amount" : "Swap"}
          </button>
        </GlassPanel>
      </motion.div>

      {/* Recent Swaps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <GlassPanel className="p-6">
          <h3 className="font-bold text-white mb-4">Recent Swaps</h3>
          <div className="space-y-3">
            {[
              { from: "0.5 ETH", to: "990.22 USDT", time: "2 min ago" },
              { from: "1,000 USDT", to: "0.505 ETH", time: "15 min ago" },
              { from: "2.5 ETH", to: "4,950.12 USDT", time: "1 hour ago" },
            ].map((swap, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="text-white">{swap.from}</span>
                  <span className="text-white/30">→</span>
                  <span className="text-neon-green">{swap.to}</span>
                </div>
                <span className="text-xs text-white/50">{swap.time}</span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  );
}

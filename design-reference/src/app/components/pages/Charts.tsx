import { GlassPanel } from "../GlassPanel";
import { motion } from "motion/react";
import { useState } from "react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

export function Charts() {
  const [timeframe, setTimeframe] = useState("1D");
  const [chartType, setChartType] = useState<"candlestick" | "line" | "area">("area");
  const [selectedPair, setSelectedPair] = useState("ETH/USDT");

  const timeframes = ["1m", "5m", "15m", "1h", "4h", "1D", "1W"];

  const pairs = [
    { name: "ETH/USDT", price: "$1,980.45", change: 3.45, volume: "$1.2B" },
    { name: "BTC/USDT", price: "$42,150.00", change: 2.18, volume: "$2.8B" },
    { name: "SOL/USDT", price: "$40.12", change: -1.24, volume: "$580M" },
    { name: "AVAX/USDT", price: "$15.87", change: 5.67, volume: "$245M" },
  ];

  // Mock chart data
  const priceData = Array.from({ length: 30 }, (_, i) => ({
    time: `${i}h`,
    price: 1950 + Math.random() * 100,
    volume: Math.random() * 100000000,
  }));

  const indicators = ["RSI", "MACD", "EMA", "Volume"];
  const [activeIndicators, setActiveIndicators] = useState<string[]>(["Volume"]);

  const toggleIndicator = (indicator: string) => {
    setActiveIndicators(prev =>
      prev.includes(indicator)
        ? prev.filter(i => i !== indicator)
        : [...prev, indicator]
    );
  };

  return (
    <div className="space-y-4">
      {/* Trading Pair Selector */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <GlassPanel className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">{selectedPair}</h2>
              <span className="text-2xl text-neon-green">$1,980.45</span>
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-neon-green/20 text-neon-green">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">+3.45%</span>
              </div>
            </div>
            <div className="flex gap-2">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                    timeframe === tf
                      ? "bg-neon-green/20 text-neon-green border border-neon-green/50"
                      : "bg-white/5 text-white/50 hover:text-white"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Trading Pairs List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1"
        >
          <GlassPanel className="p-4">
            <h3 className="font-bold text-white mb-3">Trading Pairs</h3>
            <div className="space-y-2">
              {pairs.map((pair, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedPair(pair.name)}
                  className={`w-full p-3 rounded-lg border transition-all text-left ${
                    selectedPair === pair.name
                      ? "bg-neon-green/10 border-neon-green/30"
                      : "bg-white/5 border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-white">{pair.name}</span>
                    <div className={`flex items-center gap-1 ${pair.change >= 0 ? "text-neon-green" : "text-bearish"}`}>
                      {pair.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span className="text-xs">{pair.change >= 0 ? "+" : ""}{pair.change}%</span>
                    </div>
                  </div>
                  <div className="text-sm text-white/70">{pair.price}</div>
                  <div className="text-xs text-white/50 mt-1">{pair.volume}</div>
                </button>
              ))}
            </div>
          </GlassPanel>

          {/* Stats */}
          <GlassPanel className="p-4 mt-4">
            <h3 className="font-bold text-white mb-3">Market Stats</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-white/50 mb-1">24h Volume</div>
                <div className="font-medium text-white">$1.2B</div>
              </div>
              <div>
                <div className="text-xs text-white/50 mb-1">Liquidity</div>
                <div className="font-medium text-white">$850M</div>
              </div>
              <div>
                <div className="text-xs text-white/50 mb-1">Market Cap</div>
                <div className="font-medium text-white">$238B</div>
              </div>
              <div>
                <div className="text-xs text-white/50 mb-1">24h High</div>
                <div className="font-medium text-neon-green">$2,045.87</div>
              </div>
              <div>
                <div className="text-xs text-white/50 mb-1">24h Low</div>
                <div className="font-medium text-bearish">$1,912.34</div>
              </div>
            </div>
          </GlassPanel>
        </motion.div>

        {/* Main Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-3"
        >
          <GlassPanel className="p-6">
            {/* Chart Controls */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setChartType("area")}
                className={`px-3 py-1 rounded text-sm ${chartType === "area" ? "bg-neon-green/20 text-neon-green" : "bg-white/5 text-white/50"}`}
              >
                Area
              </button>
              <button
                onClick={() => setChartType("line")}
                className={`px-3 py-1 rounded text-sm ${chartType === "line" ? "bg-neon-green/20 text-neon-green" : "bg-white/5 text-white/50"}`}
              >
                Line
              </button>
              <div className="ml-auto flex gap-2">
                {indicators.map((indicator) => (
                  <button
                    key={indicator}
                    onClick={() => toggleIndicator(indicator)}
                    className={`px-2 py-1 rounded text-xs transition-all ${
                      activeIndicators.includes(indicator)
                        ? "bg-neon-purple/20 text-neon-purple border border-neon-purple/50"
                        : "bg-white/5 text-white/50"
                    }`}
                  >
                    {indicator}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Price Chart */}
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "area" ? (
                  <AreaChart data={priceData}>
                    <defs>
                      <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00FF41" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#00FF41" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" />
                    <YAxis stroke="rgba(255,255,255,0.3)" domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(10, 10, 15, 0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#00FF41"
                      strokeWidth={2}
                      fill="url(#priceGradient)"
                    />
                  </AreaChart>
                ) : (
                  <LineChart data={priceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" />
                    <YAxis stroke="rgba(255,255,255,0.3)" domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(10, 10, 15, 0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#00FF41"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Volume Chart */}
            {activeIndicators.includes("Volume") && (
              <div className="h-[150px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" />
                    <YAxis stroke="rgba(255,255,255,0.3)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(10, 10, 15, 0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                    />
                    <Bar dataKey="volume" fill="#B026FF" opacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassPanel>
        </motion.div>
      </div>
    </div>
  );
}

import { GlassPanel } from "../GlassPanel";
import { motion } from "motion/react";
import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export function Trade() {
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [price, setPrice] = useState("1980.45");
  const [amount, setAmount] = useState("");

  const orderBook = {
    asks: Array.from({ length: 10 }, (_, i) => ({
      price: 1980 + i * 0.5,
      amount: (Math.random() * 5).toFixed(4),
      total: (Math.random() * 10000).toFixed(2),
    })),
    bids: Array.from({ length: 10 }, (_, i) => ({
      price: 1979 - i * 0.5,
      amount: (Math.random() * 5).toFixed(4),
      total: (Math.random() * 10000).toFixed(2),
    })),
  };

  const recentTrades = Array.from({ length: 15 }, (_, i) => ({
    price: (1980 + (Math.random() - 0.5) * 10).toFixed(2),
    amount: (Math.random() * 2).toFixed(4),
    time: `${Math.floor(Math.random() * 60)}s ago`,
    type: Math.random() > 0.5 ? "buy" : "sell",
  }));

  const openOrders = [
    { pair: "ETH/USDT", type: "Limit Buy", price: "$1,950.00", amount: "1.5 ETH", filled: "0%", status: "Open" },
    { pair: "BTC/USDT", type: "Limit Sell", price: "$42,500.00", amount: "0.05 BTC", filled: "30%", status: "Partial" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Order Book */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="lg:col-span-1"
      >
        <GlassPanel className="p-4 h-[calc(100vh-8rem)] flex flex-col">
          <h3 className="font-bold text-white mb-3">Order Book</h3>
          <div className="flex-1 overflow-y-auto space-y-1">
            {/* Asks (Sell Orders) */}
            <div className="space-y-0.5">
              {orderBook.asks.reverse().map((ask, i) => (
                <div key={i} className="flex justify-between text-xs relative">
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-bearish/10"
                    style={{ width: `${Math.random() * 100}%` }}
                  />
                  <span className="text-bearish z-10">{ask.price.toFixed(2)}</span>
                  <span className="text-white/50 z-10">{ask.amount}</span>
                </div>
              ))}
            </div>

            {/* Current Price */}
            <div className="py-2 text-center">
              <div className="text-xl font-bold text-neon-green">$1,980.45</div>
              <div className="text-xs text-neon-green">+3.45%</div>
            </div>

            {/* Bids (Buy Orders) */}
            <div className="space-y-0.5">
              {orderBook.bids.map((bid, i) => (
                <div key={i} className="flex justify-between text-xs relative">
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-bullish/10"
                    style={{ width: `${Math.random() * 100}%` }}
                  />
                  <span className="text-neon-green z-10">{bid.price.toFixed(2)}</span>
                  <span className="text-white/50 z-10">{bid.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Trading Panel & Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="lg:col-span-2 space-y-4"
      >
        {/* Chart Placeholder */}
        <GlassPanel className="p-6 h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white">ETH/USDT</h3>
            <div className="flex items-center gap-2">
              <span className="text-2xl text-neon-green">$1,980.45</span>
              <div className="flex items-center gap-1 text-neon-green">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">+3.45%</span>
              </div>
            </div>
          </div>
          <div className="h-full flex items-center justify-center text-white/30">
            <div className="text-center">
              <div className="text-6xl mb-2">📈</div>
              <p>Trading chart area</p>
              <p className="text-sm">Real-time price movements</p>
            </div>
          </div>
        </GlassPanel>

        {/* Trading Form */}
        <GlassPanel className="p-6">
          {/* Buy/Sell Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTradeType("buy")}
              className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                tradeType === "buy"
                  ? "bg-neon-green/20 text-neon-green border border-neon-green/50"
                  : "bg-white/5 text-white/50"
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setTradeType("sell")}
              className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                tradeType === "sell"
                  ? "bg-bearish/20 text-bearish border border-bearish/50"
                  : "bg-white/5 text-white/50"
              }`}
            >
              Sell
            </button>
          </div>

          {/* Market/Limit Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setOrderType("market")}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                orderType === "market"
                  ? "bg-neon-purple/20 text-neon-purple"
                  : "bg-white/5 text-white/50"
              }`}
            >
              Market
            </button>
            <button
              onClick={() => setOrderType("limit")}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                orderType === "limit"
                  ? "bg-neon-purple/20 text-neon-purple"
                  : "bg-white/5 text-white/50"
              }`}
            >
              Limit
            </button>
          </div>

          {/* Order Form */}
          <div className="space-y-4">
            {orderType === "limit" && (
              <div>
                <label className="text-sm text-white/50 mb-2 block">Price</label>
                <input
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-neon-green/50 focus:outline-none"
                  placeholder="0.00"
                />
              </div>
            )}

            <div>
              <label className="text-sm text-white/50 mb-2 block">Amount (ETH)</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-neon-green/50 focus:outline-none"
                placeholder="0.00"
              />
              <div className="flex gap-2 mt-2">
                {["25%", "50%", "75%", "100%"].map((percent) => (
                  <button
                    key={percent}
                    className="flex-1 py-1 text-xs rounded bg-white/5 text-white/50 hover:bg-white/10"
                  >
                    {percent}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-white/50 mb-2 block">Total (USDT)</label>
              <input
                type="text"
                readOnly
                value={amount && price ? (parseFloat(amount) * parseFloat(price)).toFixed(2) : ""}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white/50"
                placeholder="0.00"
              />
            </div>

            <button
              className={`w-full py-4 rounded-lg font-medium transition-all ${
                tradeType === "buy"
                  ? "bg-gradient-to-r from-neon-green to-neon-green/80 text-black hover:shadow-[0_0_20px_rgba(0,255,65,0.4)]"
                  : "bg-gradient-to-r from-bearish to-bearish/80 text-white hover:shadow-[0_0_20px_rgba(255,0,64,0.4)]"
              }`}
            >
              {tradeType === "buy" ? "Buy" : "Sell"} ETH
            </button>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Recent Trades & Open Orders */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="lg:col-span-1 space-y-4"
      >
        {/* Recent Trades */}
        <GlassPanel className="p-4">
          <h3 className="font-bold text-white mb-3">Recent Trades</h3>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {recentTrades.map((trade, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className={trade.type === "buy" ? "text-neon-green" : "text-bearish"}>
                  {trade.price}
                </span>
                <span className="text-white/50">{trade.amount}</span>
                <span className="text-white/30">{trade.time}</span>
              </div>
            ))}
          </div>
        </GlassPanel>

        {/* Open Orders */}
        <GlassPanel className="p-4">
          <h3 className="font-bold text-white mb-3">Open Orders</h3>
          <div className="space-y-2">
            {openOrders.map((order, i) => (
              <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-sm font-medium text-white">{order.pair}</div>
                    <div className="text-xs text-white/50">{order.type}</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-neon-green/20 text-neon-green">
                    {order.status}
                  </span>
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-white/50">Price:</span>
                    <span className="text-white">{order.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Amount:</span>
                    <span className="text-white">{order.amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Filled:</span>
                    <span className="text-white">{order.filled}</span>
                  </div>
                </div>
                <button className="w-full mt-2 py-1 text-xs rounded bg-bearish/20 text-bearish hover:bg-bearish/30">
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  );
}

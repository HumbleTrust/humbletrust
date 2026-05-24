import { GlassPanel } from "../GlassPanel";
import { motion } from "motion/react";
import { useState } from "react";
import { Wallet, Globe, Bell, Shield, Zap, ExternalLink, Copy, LogOut, Check } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export function Settings() {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [slippage, setSlippage] = useState("1");
  const [copied, setCopied] = useState(false);
  const [notifications, setNotifications] = useState({
    launches: true,
    trades: true,
    certificates: false,
  });

  const copyAddress = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey.toBase58()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const clearTokenCache = () => {
    localStorage.removeItem("humbletrust:tokens");
    window.location.reload();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-white/50">Configure your HumbleTrust preferences</p>
      </motion.div>

      {/* Wallet */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <GlassPanel className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-neon-green/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-neon-green" />
            </div>
            <h2 className="text-xl font-bold text-white">Wallet</h2>
          </div>

          {connected && publicKey ? (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs text-white/40 mb-1">Connected address</p>
                <p className="font-mono text-white text-sm break-all">{publicKey.toBase58()}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-neon-green/30 text-white/60 hover:text-white transition-all text-sm"
                >
                  {copied ? <Check className="w-4 h-4 text-neon-green" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy address"}
                </button>
                <a
                  href={`https://solscan.io/account/${publicKey.toBase58()}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-neon-green/30 text-white/60 hover:text-white transition-all text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Solscan Devnet
                </a>
                <button
                  onClick={() => void disconnect()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-bearish/10 border border-bearish/20 hover:border-bearish/50 text-bearish transition-all text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-white/50 text-sm">No wallet connected. Connect to access all HumbleTrust features.</p>
              <button
                onClick={() => setVisible(true)}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-neon-green to-[#00cc33] text-black font-bold hover:shadow-[0_0_20px_rgba(0,255,65,0.4)] transition-all"
              >
                Connect Wallet
              </button>
            </div>
          )}
        </GlassPanel>
      </motion.div>

      {/* Network */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <GlassPanel className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-white/70" />
            </div>
            <h2 className="text-xl font-bold text-white">Network</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-neon-green/10 border-neon-green/30">
              <div className="flex items-center gap-3">
                <span className="text-lg">◎</span>
                <div>
                  <p className="font-medium text-neon-green">Solana Devnet</p>
                  <p className="text-xs text-white/40">HumbleTrust is deployed here · Active network</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                <span className="text-xs font-mono text-neon-green">Active</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border bg-white/5 border-white/10 opacity-50">
              <div className="flex items-center gap-3">
                <span className="text-lg">◎</span>
                <div>
                  <p className="font-medium text-white">Solana Mainnet</p>
                  <p className="text-xs text-white/40">Coming soon — mainnet launch planned</p>
                </div>
              </div>
              <span className="text-xs font-mono text-white/30 px-2 py-0.5 rounded-full border border-white/10">Soon</span>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Trading */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <GlassPanel className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-neon-purple/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-neon-purple" />
            </div>
            <h2 className="text-xl font-bold text-white">Trading</h2>
          </div>
          <div>
            <label className="text-sm font-medium text-white mb-2 block">Default Slippage</label>
            <div className="flex gap-2 flex-wrap">
              {["0.5", "1", "2", "3"].map((value) => (
                <button
                  key={value}
                  onClick={() => setSlippage(value)}
                  className={`px-4 py-2 rounded-lg transition-all text-sm ${
                    slippage === value
                      ? "bg-neon-green/20 text-neon-green border border-neon-green/50"
                      : "bg-white/5 text-white/50 border border-white/10 hover:border-white/20"
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>
            <p className="text-xs text-white/40 mt-2">
              Default slippage for bonding curve trades. Can be overridden per transaction in the Trade page.
            </p>
          </div>
        </GlassPanel>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassPanel className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-white/70" />
            </div>
            <h2 className="text-xl font-bold text-white">Notifications</h2>
          </div>
          <div className="space-y-3">
            {[
              { key: "launches" as const, label: "New token launches", desc: "When new tokens appear in Discover" },
              { key: "trades" as const, label: "Trade confirmations", desc: "After each buy/sell on the bonding curve" },
              { key: "certificates" as const, label: "Certificate mints", desc: "When a Launch Certificate NFT is minted" },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                <div>
                  <p className="font-medium text-white">{label}</p>
                  <p className="text-sm text-white/50">{desc}</p>
                </div>
                <button
                  onClick={() => setNotifications(prev => ({ ...prev, [key]: !prev[key] }))}
                  className={`w-12 h-6 rounded-full relative transition-all ${notifications[key] ? "bg-neon-green/30 border border-neon-green/50" : "bg-white/10 border border-white/20"}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${notifications[key] ? "right-1 bg-neon-green" : "left-1 bg-white/40"}`} />
                </button>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Data & Security */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <GlassPanel className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white/70" />
            </div>
            <h2 className="text-xl font-bold text-white">Data</h2>
          </div>
          <div className="space-y-3">
            <button
              onClick={clearTokenCache}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:border-bearish/30 transition-all text-left"
            >
              <div>
                <p className="font-medium text-white">Clear local token cache</p>
                <p className="text-sm text-white/50">Remove locally cached launch data from this browser</p>
              </div>
              <span className="text-xs text-bearish/70 ml-4">Clear</span>
            </button>
          </div>
        </GlassPanel>
      </motion.div>

      {/* About */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <GlassPanel className="p-6">
          <h2 className="text-xl font-bold text-white mb-3">About HumbleTrust</h2>
          <p className="text-white/50 text-sm leading-relaxed mb-4">
            HumbleTrust is a Solana trust layer for token launches. Every rule — lock percent, burn, anti-bot delay,
            vesting schedule — is enforced on-chain by the HumbleTrust program. No team can bypass the contract.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://solscan.io/?cluster=devnet"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-neon-green/70 hover:text-neon-green border border-neon-green/20 bg-neon-green/5 px-3 py-1.5 rounded-lg transition-all"
            >
              Solscan Devnet <ExternalLink size={10} />
            </a>
          </div>
        </GlassPanel>
      </motion.div>
    </div>
  );
}

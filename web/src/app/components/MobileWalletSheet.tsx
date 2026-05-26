import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion, AnimatePresence } from "motion/react";
import { X, Wallet, Copy, CheckCheck, ExternalLink, Zap } from "lucide-react";
import { cn } from "./ui/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface DetectedWallet {
  name: string;
  icon: string;
  adapter: string; // matches wallet.name from adapter list
}

// Deep-link URL scheme for opening dApp in wallet's in-app browser
const DAPP_URL = typeof window !== "undefined" ? window.location.origin : "https://humbletrust.vercel.app";

const WALLET_DEFS = [
  {
    adapter: "Phantom",
    name: "Phantom",
    icon: "https://raw.githubusercontent.com/wallet-standard/assets/master/src/phantom.png",
    deeplink: `https://phantom.app/ul/browse/${encodeURIComponent(DAPP_URL)}?ref=${encodeURIComponent(DAPP_URL)}`,
    injected: () => !!(window as any).phantom?.solana || (!!(window as any).solana?.isPhantom),
    color: "#9945FF",
  },
  {
    adapter: "Solflare",
    name: "Solflare",
    icon: "https://raw.githubusercontent.com/solflare-wallet/solflare-snap/master/packages/site/public/logo.png",
    deeplink: `https://solflare.com/ul/v1/browse/${encodeURIComponent(DAPP_URL)}?ref=${encodeURIComponent(DAPP_URL)}`,
    injected: () => !!(window as any).solflare,
    color: "#FC7227",
  },
  {
    adapter: "Backpack",
    name: "Backpack",
    icon: "https://raw.githubusercontent.com/coral-xyz/backpack/master/packages/app-extension/src/components/common/Icon.tsx",
    deeplink: null,
    injected: () => !!(window as any).backpack?.solana,
    color: "#E33E3F",
    iconText: "BP",
  },
  {
    adapter: "OKX Wallet",
    name: "OKX Wallet",
    icon: "https://static.okx.com/cdn/assets/imgs/247/58E63FEA47A2B7D7.png",
    deeplink: `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(DAPP_URL)}`,
    injected: () => !!(window as any).okxwallet?.solana,
    color: "#000000",
    iconText: "OKX",
  },
];

function isMobileBrowser() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function MobileWalletSheet({ open, onClose }: Props) {
  const { select, connect, connected, publicKey, wallets, disconnect, connecting } = useWallet();
  const [copied, setCopied] = useState(false);
  const [injected, setInjected] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const isMobile = isMobileBrowser();

  // Detect which wallets are injected in window
  useEffect(() => {
    if (!open) return;
    const found = WALLET_DEFS.filter(w => {
      try { return w.injected(); } catch { return false; }
    }).map(w => w.adapter);
    setInjected(found);
  }, [open]);

  // Auto-close when connected
  useEffect(() => {
    if (connected && open) {
      setTimeout(onClose, 400);
    }
  }, [connected, open, onClose]);

  const handleConnect = useCallback(async (adapterName: string) => {
    setStatus(`Connecting to ${adapterName}...`);
    try {
      const found = wallets.find(w => w.adapter.name === adapterName);
      if (!found) {
        setStatus(`${adapterName} not found. Is it installed?`);
        return;
      }
      select(adapterName as any);
      await connect();
      setStatus(null);
    } catch (e: any) {
      if (e?.message?.includes("User rejected") || e?.message?.includes("rejected")) {
        setStatus("Connection cancelled.");
      } else {
        setStatus(e?.message || "Connection failed");
      }
    }
  }, [wallets, select, connect]);

  const handleDeepLink = (url: string | null, name: string) => {
    if (!url) { setStatus(`${name} deeplink not available — try installing the app.`); return; }
    window.open(url, "_blank", "noopener");
    setStatus(`Opening ${name}… if it doesn't open, install the ${name} app.`);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(DAPP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortAddr = publicKey
    ? publicKey.toBase58().slice(0, 4) + "..." + publicKey.toBase58().slice(-4)
    : null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-[rgba(10,10,18,0.98)] border-t border-white/10"
            style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.7)" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="px-5 pb-8 pt-2 space-y-5 max-h-[85vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold text-lg">
                    {connected ? "Wallet connected" : "Connect wallet"}
                  </h2>
                  {connected && shortAddr && (
                    <p className="text-[#00FF41] font-mono text-sm">{shortAddr}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Connected state */}
              {connected && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-[#00FF41]/5 border border-[#00FF41]/20 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#00FF41]/10 border border-[#00FF41]/30 flex items-center justify-center">
                      <Wallet size={18} className="text-[#00FF41]" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Connected</p>
                      <p className="text-white/50 font-mono text-xs">{publicKey?.toBase58()}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { disconnect(); onClose(); }}
                    className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium"
                  >
                    Disconnect
                  </button>
                </div>
              )}

              {/* Not connected */}
              {!connected && (
                <>
                  {/* Injected wallets (no redirect needed!) */}
                  {injected.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Zap size={12} className="text-[#00FF41]" />
                        <span className="text-xs text-[#00FF41] font-mono uppercase tracking-widest">Detected in browser</span>
                      </div>
                      <div className="space-y-2">
                        {WALLET_DEFS.filter(w => injected.includes(w.adapter)).map(w => (
                          <motion.button
                            key={w.adapter}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleConnect(w.adapter)}
                            disabled={connecting}
                            className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-[#00FF41]/30 hover:bg-[#00FF41]/5 transition-all disabled:opacity-50"
                          >
                            <WalletIcon w={w} size={36} />
                            <div className="text-left">
                              <p className="text-white font-semibold text-sm">{w.name}</p>
                              <p className="text-[#00FF41] text-xs">Ready — tap to connect</p>
                            </div>
                            <div className="ml-auto w-2 h-2 rounded-full bg-[#00FF41] animate-pulse" />
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mobile deeplink wallets */}
                  {isMobile && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs text-white/30 font-mono uppercase tracking-widest">
                          {injected.length > 0 ? "Other wallets" : "Wallet apps"}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {WALLET_DEFS.filter(w => !injected.includes(w.adapter)).map(w => (
                          <motion.button
                            key={w.adapter}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleDeepLink(w.deeplink, w.name)}
                            className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all"
                          >
                            <WalletIcon w={w} size={36} />
                            <div className="text-left">
                              <p className="text-white font-semibold text-sm">{w.name}</p>
                              <p className="text-white/30 text-xs">Open app to connect</p>
                            </div>
                            <ExternalLink size={12} className="ml-auto text-white/20" />
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Desktop wallets */}
                  {!isMobile && injected.length === 0 && (
                    <div className="space-y-2">
                      {WALLET_DEFS.map(w => (
                        <motion.button
                          key={w.adapter}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleConnect(w.adapter)}
                          disabled={connecting}
                          className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all disabled:opacity-50"
                        >
                          <WalletIcon w={w} size={36} />
                          <div className="text-left">
                            <p className="text-white font-semibold text-sm">{w.name}</p>
                            <p className="text-white/30 text-xs">Browser extension</p>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  )}

                  {/* Mobile: copy link to open in wallet browser */}
                  {isMobile && (
                    <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-3">
                      <p className="text-white/50 text-xs leading-relaxed">
                        Best experience: open this site directly inside your wallet's built-in browser — it connects instantly without any redirect.
                      </p>
                      <button
                        onClick={copyLink}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-all"
                      >
                        {copied ? <CheckCheck size={13} className="text-[#00FF41]" /> : <Copy size={13} />}
                        {copied ? "Copied!" : "Copy site link"}
                      </button>
                    </div>
                  )}

                  {status && (
                    <p className={cn(
                      "text-xs text-center py-2",
                      status.includes("fail") || status.includes("not found") || status.includes("cancel")
                        ? "text-red-400"
                        : "text-white/40"
                    )}>
                      {status}
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function WalletIcon({ w, size }: { w: typeof WALLET_DEFS[number]; size: number }) {
  const [err, setErr] = useState(false);
  return (
    <div
      className="rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
      style={{ width: size, height: size, background: w.color + "22", border: `1px solid ${w.color}44` }}
    >
      {!err && w.icon ? (
        <img
          src={w.icon}
          alt={w.name}
          className="w-full h-full object-cover"
          onError={() => setErr(true)}
        />
      ) : (
        <span className="text-xs font-bold" style={{ color: w.color }}>
          {(w as any).iconText || w.name.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

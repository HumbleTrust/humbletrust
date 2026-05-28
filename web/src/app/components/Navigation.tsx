import {
  Home, LayoutDashboard, Rocket, Compass, ArrowLeftRight,
  Wallet, BarChart2, Award, Settings, Shield, MoreHorizontal, X, Info, Code2,
} from "lucide-react";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./ui/utils";
import { MobileWalletSheet } from "./MobileWalletSheet";

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "home",       label: "Home",        icon: Home },
  { id: "dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { id: "launch",     label: "Launch",      icon: Rocket },
  { id: "discover",   label: "Discover",    icon: Compass },
  { id: "trade",      label: "Trade",       icon: ArrowLeftRight },
  { id: "portfolio",  label: "Portfolio",   icon: Wallet },
  { id: "market",     label: "Market",      icon: BarChart2 },
  { id: "nft",        label: "NFT Badges",  icon: Award },
  { id: "score",      label: "Score API",   icon: Code2 },
  { id: "about",      label: "About",       icon: Info },
  { id: "settings",   label: "Settings",    icon: Settings },
];

const primaryNavItems = [
  { id: "home",      label: "Home",      icon: Home },
  { id: "trade",     label: "Trade",     icon: ArrowLeftRight },
  { id: "launch",    label: "Launch",    icon: Rocket },
  { id: "discover",  label: "Discover",  icon: Compass },
  { id: "portfolio", label: "Portfolio", icon: Wallet },
];

const moreNavItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "market",    label: "Market",    icon: BarChart2 },
  { id: "nft",       label: "NFT Badges",icon: Award },
  { id: "score",     label: "Score API", icon: Code2 },
  { id: "about",     label: "About",     icon: Info },
  { id: "settings",  label: "Settings",  icon: Settings },
];

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const wallet = useWallet();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const walletLabel = wallet.connected && wallet.publicKey
    ? wallet.publicKey.toBase58().slice(0, 4) + "..." + wallet.publicKey.toBase58().slice(-4)
    : "Connect Wallet";

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col backdrop-blur-xl bg-[rgba(10,10,15,0.92)] border-r border-white/10 z-30"
        style={{ boxShadow: "4px 0 24px rgba(0,0,0,0.5)" }}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00FF41] to-[#B026FF] flex items-center justify-center"
              style={{ boxShadow: "0 0 16px rgba(0,255,65,0.3)" }}
            >
              <Shield className="w-6 h-6 text-black" />
            </motion.div>
            <div>
              <h1 className="font-bold text-xl text-white">HumbleTrust</h1>
              <p className="text-xs text-white/50">Trust Layer · Devnet</p>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }, idx) => {
            const isActive = activeTab === id;
            return (
              <motion.button
                key={id}
                onClick={() => onTabChange(id)}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.3 }}
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.97 }}
                className="relative w-full flex items-center gap-3 px-4 py-3 rounded-lg group"
              >
                {/* Animated active background */}
                {isActive && (
                  <motion.div
                    layoutId="nav-active-bg"
                    className="absolute inset-0 rounded-lg bg-[#00FF41]/10 border border-[#00FF41]/30"
                    style={{ boxShadow: "0 0 20px rgba(0,255,65,0.12), inset 0 0 20px rgba(0,255,65,0.05)" }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <Icon
                  className={cn(
                    "w-5 h-5 relative z-10 transition-all duration-300",
                    isActive
                      ? "text-[#00FF41]"
                      : "text-white/40 group-hover:text-white/70"
                  )}
                  style={isActive ? { filter: "drop-shadow(0 0 6px rgba(0,255,65,0.7))" } : undefined}
                />
                <span className={cn(
                  "font-medium relative z-10 transition-colors duration-300",
                  isActive ? "text-[#00FF41]" : "text-white/60 group-hover:text-white/80"
                )}>
                  {label}
                </span>
                {id === "launch" && (
                  <span className="ml-auto relative z-10 text-[10px] px-1.5 py-0.5 rounded bg-[#00FF41]/20 text-[#00FF41] font-mono">
                    NEW
                  </span>
                )}
                {/* Active dot indicator */}
                {isActive && (
                  <motion.div
                    layoutId="nav-active-dot"
                    className="absolute right-3 w-1.5 h-1.5 rounded-full bg-[#00FF41]"
                    style={{ boxShadow: "0 0 6px rgba(0,255,65,0.9)" }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Wallet Button */}
        <div className="p-4 border-t border-white/10">
          <motion.button
            onClick={() => setSheetOpen(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "w-full px-4 py-3 rounded-lg font-medium transition-all duration-300 text-sm flex items-center justify-center gap-2",
              wallet.connected
                ? "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
                : "bg-gradient-to-r from-[#00FF41] to-[#00cc33] text-black hover:shadow-[0_0_20px_rgba(0,255,65,0.4)]"
            )}
          >
            {wallet.connected && <span className="w-2 h-2 rounded-full bg-[#00FF41] inline-block shrink-0" />}
            {walletLabel}
          </motion.button>
        </div>
      </motion.div>

      <MobileWalletSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />

      {/* Mobile More Drawer */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/60 z-40"
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              key="drawer"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="md:hidden fixed bottom-[64px] left-0 right-0 z-50 backdrop-blur-xl bg-[rgba(10,10,15,0.97)] border-t border-white/10 rounded-t-2xl pb-2"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                <span className="text-xs text-white/40 font-mono uppercase tracking-widest">More</span>
                <button onClick={() => setMoreOpen(false)} className="text-white/40 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Wallet button inside drawer */}
              <button
                onClick={() => { setMoreOpen(false); setSheetOpen(true); }}
                className={cn(
                  "w-full flex items-center gap-3 px-5 py-3 transition-colors",
                  wallet.connected ? "text-[#00FF41]" : "text-white/60 hover:text-white"
                )}
              >
                <div className="relative">
                  <Wallet className="w-5 h-5" style={wallet.connected ? { filter: "drop-shadow(0 0 4px rgba(0,255,65,0.7))" } : undefined} />
                  {wallet.connected && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#00FF41] border border-black" />
                  )}
                </div>
                <span className="text-sm font-medium">{wallet.connected ? walletLabel : "Connect Wallet"}</span>
              </button>
              <div className="h-px bg-white/10 mx-5 mb-1" />
              <nav className="grid grid-cols-3 gap-1 p-3">
                {moreNavItems.map(({ id, label, icon: Icon }) => {
                  const isActive = activeTab === id;
                  return (
                    <motion.button
                      key={id}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => { onTabChange(id); setMoreOpen(false); }}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all",
                        isActive ? "bg-[#00FF41]/10 border border-[#00FF41]/20" : "bg-white/[0.03] border border-white/5 hover:bg-white/[0.06]"
                      )}
                    >
                      <Icon
                        className={cn("w-5 h-5", isActive ? "text-[#00FF41]" : "text-white/50")}
                        style={isActive ? { filter: "drop-shadow(0 0 4px rgba(0,255,65,0.7))" } : undefined}
                      />
                      <span className={cn("text-xs text-center leading-tight", isActive ? "text-[#00FF41]" : "text-white/50")}>{label}</span>
                    </motion.button>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 backdrop-blur-xl bg-[rgba(10,10,15,0.95)] border-t border-white/10 z-30">
        <nav className="flex justify-around items-center p-2">
          {primaryNavItems.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <motion.button
                key={id}
                onClick={() => onTabChange(id)}
                whileTap={{ scale: 0.92 }}
                className={cn("relative flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all", isActive && "bg-[#00FF41]/10")}
              >
                <Icon
                  className={cn("w-5 h-5", isActive ? "text-[#00FF41]" : "text-white/50")}
                  style={isActive ? { filter: "drop-shadow(0 0 4px rgba(0,255,65,0.7))" } : undefined}
                />
                <span className={cn("text-xs", isActive ? "text-[#00FF41]" : "text-white/50")}>{label}</span>
              </motion.button>
            );
          })}

          {/* More button */}
          <motion.button
            onClick={() => setMoreOpen(v => !v)}
            whileTap={{ scale: 0.92 }}
            className={cn(
              "relative flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all",
              moreNavItems.some(i => i.id === activeTab) && "bg-[#00FF41]/10"
            )}
          >
            <MoreHorizontal
              className={cn("w-5 h-5", moreNavItems.some(i => i.id === activeTab) ? "text-[#00FF41]" : "text-white/50")}
              style={moreNavItems.some(i => i.id === activeTab) ? { filter: "drop-shadow(0 0 4px rgba(0,255,65,0.7))" } : undefined}
            />
            <span className={cn("text-xs", moreNavItems.some(i => i.id === activeTab) ? "text-[#00FF41]" : "text-white/50")}>More</span>
          </motion.button>
        </nav>
      </div>
    </>
  );
}

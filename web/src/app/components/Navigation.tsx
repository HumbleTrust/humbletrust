import {
  Home, LayoutDashboard, Rocket, Compass, ArrowLeftRight,
  Wallet, BarChart2, Award, Settings, MoreHorizontal, X, Info, Code2, Zap,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./ui/utils";
import { MobileWalletSheet } from "./MobileWalletSheet";
import { useAuth } from "../../lib/useAuth";

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "home",       label: "Home",        icon: Home },
  { id: "dashboard",  label: "Dashboard",   icon: LayoutDashboard },
  { id: "launch",     label: "Launch",       icon: Rocket },
  { id: "discover",   label: "Discover",     icon: Compass },
  { id: "trade",      label: "Trade",        icon: ArrowLeftRight },
  { id: "portfolio",  label: "Portfolio",    icon: Wallet },
  { id: "market",     label: "Market",       icon: BarChart2 },
  { id: "nft",        label: "NFT Badges",   icon: Award },
  { id: "score",      label: "Score API",    icon: Code2 },
  { id: "api",        label: "API Plans",    icon: Zap },
  { id: "about",      label: "About",        icon: Info },
  { id: "settings",   label: "Settings",     icon: Settings },
];

const primaryNavItems = [
  { id: "home",      label: "Home",      icon: Home },
  { id: "trade",     label: "Trade",     icon: ArrowLeftRight },
  { id: "launch",    label: "Launch",    icon: Rocket },
  { id: "discover",  label: "Discover",  icon: Compass },
  { id: "portfolio", label: "Portfolio", icon: Wallet },
];

const moreNavItems = [
  { id: "dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { id: "market",    label: "Market",     icon: BarChart2 },
  { id: "nft",       label: "NFT Badges", icon: Award },
  { id: "score",     label: "Score API",  icon: Code2 },
  { id: "api",       label: "API Plans",  icon: Zap },
  { id: "about",     label: "About",      icon: Info },
  { id: "settings",  label: "Settings",   icon: Settings },
];

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const wallet = useWallet();
  const { user, email, avatar, name, signInWithGoogle, signOut } = useAuth();
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
              className="w-10 h-10 rounded-lg overflow-hidden shrink-0"
              style={{ boxShadow: "0 0 16px rgba(0,255,65,0.25), 0 0 32px rgba(176,38,255,0.15)" }}
            >
              <img src="/HTlogo512.png" alt="HumbleTrust" className="w-full h-full object-cover" />
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
                type="button"
                onClick={() => onTabChange(id)}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.3 }}
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.97 }}
                className="relative w-full flex items-center gap-3 px-4 py-3 rounded-lg group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF41]/50"
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

        {/* Google Auth + Wallet */}
        <div className="p-4 border-t border-white/10 space-y-2">
          {/* Google Sign In */}
          {user ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              {avatar
                ? <img src={avatar} alt="" className="w-7 h-7 rounded-full shrink-0" />
                : <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00FF41] to-[#B026FF] flex items-center justify-center text-xs font-bold text-black shrink-0">{name?.[0]?.toUpperCase() ?? "G"}</div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white/80 truncate">{name}</p>
                <p className="text-[10px] text-white/40 truncate">{email}</p>
              </div>
              <button type="button" onClick={signOut} className="text-white/30 hover:text-white/70 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded" aria-label="Sign out">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <motion.button
              onClick={signInWithGoogle}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full px-4 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </motion.button>
          )}

          {/* Wallet Button */}
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

          {/* View Profile (wallet connected) */}
          {wallet.connected && wallet.publicKey && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => window.dispatchEvent(new CustomEvent("ht:open-creator", { detail: wallet.publicKey!.toBase58() }))}
              className="w-full px-4 py-2 rounded-lg text-xs font-medium text-white/50 hover:text-[#00FF41] border border-white/10 hover:border-[#00FF41]/30 bg-white/[0.03] hover:bg-[#00FF41]/5 transition-all flex items-center justify-center gap-1.5"
            >
              <span>View Creator Profile</span>
            </motion.button>
          )}
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
                <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close menu" className="text-white/40 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Wallet button inside drawer */}
              <button
                type="button"
                onClick={() => { setMoreOpen(false); setSheetOpen(true); }}
                aria-label={wallet.connected ? "Wallet connected" : "Connect Wallet"}
                className={cn(
                  "w-full flex items-center gap-3 px-5 py-3 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00FF41]/50",
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

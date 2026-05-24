import {
  LayoutDashboard, Rocket, Compass, ArrowLeftRight, LineChart,
  Wallet, BarChart2, Award, Settings, Shield,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { cn } from "./ui/utils";

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { id: "launch",     label: "Launch",      icon: Rocket },
  { id: "discover",   label: "Discover",    icon: Compass },
  { id: "trade",      label: "Trade",       icon: ArrowLeftRight },
  { id: "charts",     label: "Charts",      icon: LineChart },
  { id: "portfolio",  label: "Portfolio",   icon: Wallet },
  { id: "market",     label: "Market",      icon: BarChart2 },
  { id: "nft",        label: "NFT Badges",  icon: Award },
  { id: "settings",   label: "Settings",    icon: Settings },
];

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();

  const walletLabel = wallet.connected && wallet.publicKey
    ? wallet.publicKey.toBase58().slice(0, 4) + "..." + wallet.publicKey.toBase58().slice(-4)
    : "Connect Wallet";

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col backdrop-blur-xl bg-[rgba(10,10,15,0.9)] border-r border-white/10 z-30">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00FF41] to-[#B026FF] flex items-center justify-center">
              <Shield className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-white">HumbleTrust</h1>
              <p className="text-xs text-white/50">Trust Layer · Devnet</p>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 hover:bg-white/5",
                  isActive && "bg-[#00FF41]/10 border border-[#00FF41]/30 shadow-[0_0_20px_rgba(0,255,65,0.15)]"
                )}
              >
                <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-[#00FF41]" : "text-white/50")} />
                <span className={cn("font-medium transition-colors", isActive ? "text-[#00FF41]" : "text-white/70")}>
                  {label}
                </span>
                {id === "launch" && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-[#00FF41]/20 text-[#00FF41] font-mono">
                    NEW
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Wallet Button */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => setVisible(true)}
            className={cn(
              "w-full px-4 py-3 rounded-lg font-medium transition-all duration-300 text-sm",
              wallet.connected
                ? "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
                : "bg-gradient-to-r from-[#00FF41] to-[#00cc33] text-black hover:shadow-[0_0_20px_rgba(0,255,65,0.4)]"
            )}
          >
            {walletLabel}
          </button>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 backdrop-blur-xl bg-[rgba(10,10,15,0.95)] border-t border-white/10 z-30">
        <nav className="flex justify-around items-center p-2">
          {navItems.slice(0, 5).map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={cn("flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all", isActive && "bg-[#00FF41]/10")}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-[#00FF41]" : "text-white/50")} />
                <span className={cn("text-xs", isActive ? "text-[#00FF41]" : "text-white/50")}>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}

import { LayoutDashboard, Repeat, LineChart, ArrowLeftRight, TrendingUp, Wallet, Droplet, Coins, Settings } from "lucide-react";
import { cn } from "./ui/utils";

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "dexs", label: "DEXs", icon: Repeat },
  { id: "charts", label: "Charts", icon: LineChart },
  { id: "swap", label: "Swap", icon: ArrowLeftRight },
  { id: "trade", label: "Trade", icon: TrendingUp },
  { id: "portfolio", label: "Portfolio", icon: Wallet },
  { id: "liquidity", label: "Liquidity", icon: Droplet },
  { id: "staking", label: "Staking", icon: Coins },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col backdrop-blur-xl bg-[rgba(10,10,15,0.9)] border-r border-white/10 z-30">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-green to-neon-purple flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-white">DeFi Terminal</h1>
              <p className="text-xs text-white/50">Premium Trading</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300",
                  "hover:bg-white/5",
                  isActive && "bg-neon-green/10 border border-neon-green/30 shadow-[0_0_20px_rgba(0,255,65,0.2)]"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-colors",
                    isActive ? "text-neon-green" : "text-white/50"
                  )}
                />
                <span
                  className={cn(
                    "font-medium transition-colors",
                    isActive ? "text-neon-green" : "text-white/70"
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Wallet Connection */}
        <div className="p-4 border-t border-white/10">
          <button className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-neon-green to-neon-purple text-black font-medium hover:shadow-[0_0_20px_rgba(0,255,65,0.4)] transition-all duration-300">
            Connect Wallet
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 backdrop-blur-xl bg-[rgba(10,10,15,0.95)] border-t border-white/10 z-30">
        <nav className="flex justify-around items-center p-2">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all",
                  isActive && "bg-neon-green/10"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5",
                    isActive ? "text-neon-green" : "text-white/50"
                  )}
                />
                <span className={cn(
                  "text-xs",
                  isActive ? "text-neon-green" : "text-white/50"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}

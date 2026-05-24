import { useState } from "react";
import { HexagonBackground } from "./components/HexagonBackground";
import { Navigation } from "./components/Navigation";
import { Dashboard } from "./components/pages/Dashboard";
import { DEXs } from "./components/pages/DEXs";
import { Charts } from "./components/pages/Charts";
import { Swap } from "./components/pages/Swap";
import { Trade } from "./components/pages/Trade";
import { Portfolio } from "./components/pages/Portfolio";
import { Liquidity } from "./components/pages/Liquidity";
import { Staking } from "./components/pages/Staking";
import { Settings } from "./components/pages/Settings";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const renderPage = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "dexs":
        return <DEXs />;
      case "charts":
        return <Charts />;
      case "swap":
        return <Swap />;
      case "trade":
        return <Trade />;
      case "portfolio":
        return <Portfolio />;
      case "liquidity":
        return <Liquidity />;
      case "staking":
        return <Staking />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated Background */}
      <HexagonBackground />

      {/* Navigation */}
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <main className="relative z-10 md:ml-64 p-6 pb-24 md:pb-6">
        <div className="max-w-[1400px] mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
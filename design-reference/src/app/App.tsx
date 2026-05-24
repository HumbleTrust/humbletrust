import { useState } from "react";
import { WalletProvider } from "../lib/WalletProvider";
import { HexagonBackground } from "./components/HexagonBackground";
import { Navigation } from "./components/Navigation";
import { Dashboard } from "./components/pages/Dashboard";
import { Charts } from "./components/pages/Charts";
import { Portfolio } from "./components/pages/Portfolio";
import { Settings } from "./components/pages/Settings";
import { LaunchPage } from "./pages/LaunchPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { TradePage } from "./pages/TradePage";
import { MarketPage } from "./pages/MarketPage";
import { NftPage } from "./pages/NftPage";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [openMint, setOpenMint] = useState<string | null>(null);

  const renderPage = () => {
    if (openMint) return <DiscoverPage initialMint={openMint} onBack={() => setOpenMint(null)} />;
    switch (activeTab) {
      case "dashboard": return <Dashboard />;
      case "launch":    return <LaunchPage />;
      case "discover":  return <DiscoverPage onOpenToken={(m) => setOpenMint(m)} />;
      case "trade":     return <TradePage />;
      case "charts":    return <Charts />;
      case "portfolio": return <Portfolio />;
      case "market":    return <MarketPage />;
      case "nft":       return <NftPage />;
      case "settings":  return <Settings />;
      default:          return <Dashboard />;
    }
  };

  return (
    <WalletProvider>
      <div className="min-h-screen bg-black text-white relative overflow-hidden">
        <HexagonBackground />
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="relative z-10 md:ml-64 p-6 pb-24 md:pb-6">
          <div className="max-w-[1400px] mx-auto">{renderPage()}</div>
        </main>
      </div>
    </WalletProvider>
  );
}
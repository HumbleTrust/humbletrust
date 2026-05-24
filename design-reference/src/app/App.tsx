import { useState, useEffect } from "react";
import { HomePage } from "./pages/HomePage";
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
  const [activeTab, setActiveTab] = useState("home");
  const [openMint, setOpenMint] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<string>).detail;
      if (tab) { setActiveTab(tab); setOpenMint(null); }
    };
    window.addEventListener("ht:navigate", handler);
    return () => window.removeEventListener("ht:navigate", handler);
  }, []);

  const renderPage = () => {
    if (openMint) return <DiscoverPage initialMint={openMint} onBack={() => setOpenMint(null)} />;
    switch (activeTab) {
      case "home":      return <HomePage onTabChange={setActiveTab} />;
      case "dashboard": return <Dashboard onTabChange={setActiveTab} />;
      case "launch":    return <LaunchPage />;
      case "discover":  return <DiscoverPage onOpenToken={(m) => setOpenMint(m)} />;
      case "trade":     return <TradePage goDiscover={() => setActiveTab("discover")} />;
      case "charts":    return <Charts />;
      case "portfolio": return <Portfolio />;
      case "market":    return <MarketPage />;
      case "nft":       return <NftPage goLaunch={() => setActiveTab("launch")} />;
      case "settings":  return <Settings />;
      default:          return <HomePage onTabChange={setActiveTab} />;
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
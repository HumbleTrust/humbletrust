import { useState, useEffect, Component, type ReactNode, type ErrorInfo } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(_: Error, info: ErrorInfo) { console.error("App crash:", info.componentStack); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 p-8">
          <div className="text-[#00FF41] text-4xl">⚠</div>
          <h2 className="text-lg font-bold">Something went wrong</h2>
          <p className="text-white/50 text-sm text-center max-w-sm">{(this.state.error as Error).message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-2 px-4 py-2 rounded bg-[#00FF41]/20 border border-[#00FF41]/40 text-[#00FF41] text-sm"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { HomePage } from "./pages/HomePage";
import { WalletProvider } from "../lib/WalletProvider";
import { HexagonBackground } from "./components/HexagonBackground";
import { Navigation } from "./components/Navigation";
import { AnnouncementBanner } from "./components/AnnouncementBanner";
import { TickerBar } from "./components/TickerBar";
import { Dashboard } from "./components/pages/Dashboard";
import { Portfolio } from "./components/pages/Portfolio";
import { Settings } from "./components/pages/Settings";
import { LaunchPage } from "./pages/LaunchPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { TradePage } from "./pages/TradePage";
import { MarketPage } from "./pages/MarketPage";
import { NftPage } from "./pages/NftPage";
import { AboutPage } from "./pages/AboutPage";
import { ScorePage } from "./pages/ScorePage";
import { ApiPage } from "./pages/ApiPage";

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [openMint, setOpenMint] = useState<string | null>(null);
  const [tradeMint, setTradeMint] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<string>).detail;
      if (tab) { setActiveTab(tab); setOpenMint(null); }
    };
    const tradeHandler = (e: Event) => {
      const mint = (e as CustomEvent<string>).detail;
      if (mint) { setTradeMint(mint); setActiveTab("trade"); setOpenMint(null); }
    };
    window.addEventListener("ht:navigate", handler);
    window.addEventListener("ht:open-trade", tradeHandler);
    return () => {
      window.removeEventListener("ht:navigate", handler);
      window.removeEventListener("ht:open-trade", tradeHandler);
    };
  }, []);

  const renderPage = () => {
    if (openMint) return <DiscoverPage initialMint={openMint} onBack={() => setOpenMint(null)} />;
    switch (activeTab) {
      case "home":      return <HomePage onTabChange={setActiveTab} />;
      case "dashboard": return <Dashboard onTabChange={setActiveTab} />;
      case "launch":    return <LaunchPage />;
      case "discover":  return <DiscoverPage onOpenToken={(m) => setOpenMint(m)} />;
      case "trade":     return <TradePage goDiscover={() => setActiveTab("discover")} initialMint={tradeMint ?? undefined} />;
      case "portfolio": return <Portfolio />;
      case "market":    return <MarketPage />;
      case "nft":       return <NftPage goLaunch={() => setActiveTab("launch")} />;
      case "about":     return <AboutPage onTabChange={setActiveTab} />;
      case "score":     return <ScorePage />;
      case "api":       return <ApiPage />;
      case "settings":  return <Settings />;
      default:          return <HomePage onTabChange={setActiveTab} />;
    }
  };

  return (
    <ErrorBoundary>
      <WalletProvider>
        <div className="min-h-screen bg-[#0a0a14] text-white relative overflow-hidden">
          {/* ── Global video background ── */}
          <div className="fixed inset-0 -z-10 pointer-events-none">
            <video
              src="/HTVid.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: "brightness(0.18) saturate(1.3)" }}
            />
            <div className="absolute inset-0" style={{
              background: "radial-gradient(ellipse at 50% 30%, rgba(10,10,20,0.3) 0%, rgba(10,10,20,0.75) 60%, #0a0a14 100%)"
            }} />
          </div>
          <HexagonBackground />
          <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="relative z-10 md:ml-64 flex flex-col min-h-screen">
            <AnnouncementBanner />
            <TickerBar />
            <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
              <ErrorBoundary>
                <div className="max-w-[1400px] mx-auto">{renderPage()}</div>
              </ErrorBoundary>
            </main>
          </div>
        </div>
      </WalletProvider>
    </ErrorBoundary>
  );
}
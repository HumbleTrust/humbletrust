import { useState, useEffect, useCallback, useRef, Component, type ReactNode, type ErrorInfo } from "react";

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
import { CreatorPage } from "./pages/CreatorPage";
import { TokenPage } from "./pages/TokenPage";

// Validate Solana base58 address (32-44 chars, base58 alphabet)
const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function parseMintFromPath(path: string): string | null {
  const m = path.match(/^\/token\/([^/?#]+)/);
  if (m && SOLANA_ADDR_RE.test(m[1])) return m[1];
  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  // If we land on /token/:mint directly, parse it from the pathname
  const initialMintFromUrl = parseMintFromPath(window.location.pathname);
  const [openMint, setOpenMint] = useState<string | null>(initialMintFromUrl);
  const [tradeMint, setTradeMint] = useState<string | null>(null);
  const [creatorWallet, setCreatorWallet] = useState<string | null>(null);
  // Track whether the current token page was opened via SPA navigation (shows back button)
  const mintViaSpa = useRef<boolean>(!initialMintFromUrl);

  // Keep URL in sync with openMint state
  useEffect(() => {
    if (openMint) {
      const target = `/token/${openMint}`;
      if (window.location.pathname !== target) {
        history.pushState({ mint: openMint }, "", target);
      }
    } else {
      if (window.location.pathname !== "/" && window.location.pathname !== "") {
        history.pushState({}, "", "/");
      }
    }
  }, [openMint]);

  const clearMint = useCallback(() => {
    mintViaSpa.current = true;
    setOpenMint(null);
  }, []);

  const openMintSpa = useCallback((mint: string) => {
    mintViaSpa.current = true;
    setOpenMint(mint);
  }, []);

  useEffect(() => {
    // Handle browser back/forward
    const popHandler = (e: PopStateEvent) => {
      const mint = parseMintFromPath(window.location.pathname);
      if (mint) {
        // Navigated forward to a token URL via browser history
        mintViaSpa.current = false;
        setOpenMint(mint);
      } else {
        setOpenMint(null);
        if (e.state?.tab) setActiveTab(e.state.tab as string);
      }
    };
    window.addEventListener("popstate", popHandler);
    return () => window.removeEventListener("popstate", popHandler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<string>).detail;
      if (tab) { setActiveTab(tab); setOpenMint(null); setCreatorWallet(null); }
    };
    const tradeHandler = (e: Event) => {
      const mint = (e as CustomEvent<string>).detail;
      if (mint) { setTradeMint(mint); setActiveTab("trade"); setOpenMint(null); setCreatorWallet(null); }
    };
    const creatorHandler = (e: Event) => {
      const wallet = (e as CustomEvent<string>).detail;
      if (wallet) { setCreatorWallet(wallet); setOpenMint(null); }
    };
    const tokenHandler = (e: Event) => {
      const mint = (e as CustomEvent<{ mint: string }>).detail?.mint;
      if (mint && SOLANA_ADDR_RE.test(mint)) { openMintSpa(mint); setCreatorWallet(null); }
    };
    window.addEventListener("ht:navigate", handler);
    window.addEventListener("ht:open-trade", tradeHandler);
    window.addEventListener("ht:open-creator", creatorHandler);
    window.addEventListener("ht:open-token", tokenHandler);
    return () => {
      window.removeEventListener("ht:navigate", handler);
      window.removeEventListener("ht:open-trade", tradeHandler);
      window.removeEventListener("ht:open-creator", creatorHandler);
      window.removeEventListener("ht:open-token", tokenHandler);
    };
  }, [openMintSpa]);

  const renderPage = () => {
    if (creatorWallet) return <CreatorPage wallet={creatorWallet} onBack={() => setCreatorWallet(null)} />;
    if (openMint) {
      return <TokenPage mint={openMint} onBack={mintViaSpa.current ? clearMint : undefined} />;
    }
    switch (activeTab) {
      case "home":      return <HomePage onTabChange={setActiveTab} />;
      case "dashboard": return <Dashboard onTabChange={setActiveTab} />;
      case "launch":    return <LaunchPage />;
      case "discover":  return <DiscoverPage onOpenToken={openMintSpa} />;
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
        <div className="min-h-screen text-white relative">
          {/* ── Global video background ── */}
          <div className="fixed inset-0 z-0 pointer-events-none">
            <video
              src="/HTVid.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: "brightness(0.35) saturate(1.4)" }}
            />
            <div className="absolute inset-0" style={{
              background: "radial-gradient(ellipse at 50% 30%, rgba(10,10,20,0.5) 0%, rgba(10,10,20,0.82) 70%, #0a0a14 100%)"
            }} />
          </div>
          <HexagonBackground />
          <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="relative z-10 md:ml-64 flex flex-col min-h-screen">
            <AnnouncementBanner />
            <TickerBar />
            <main className="flex-1 p-4 md:p-6 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-6">
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
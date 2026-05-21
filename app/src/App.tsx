import { lazy, Suspense, useEffect, useState } from "react";
import { Navbar } from "./components/Navbar";
import { Ticker } from "./components/Ticker";
import { Footer } from "./components/Footer";
import { StatusBanner } from "./components/StatusBanner";

// Lazy-loaded pages — each becomes a separate chunk (~40-80KB each)
const Landing     = lazy(() => import("./pages/Landing").then(m => ({ default: m.Landing })));
const Launch      = lazy(() => import("./pages/Launch").then(m => ({ default: m.Launch })));
const Discover    = lazy(() => import("./pages/Discover").then(m => ({ default: m.Discover })));
const Trade       = lazy(() => import("./pages/Trade").then(m => ({ default: m.Trade })));
const About       = lazy(() => import("./pages/About").then(m => ({ default: m.About })));
const Status      = lazy(() => import("./pages/Status").then(m => ({ default: m.Status })));
const TokenDetail = lazy(() => import("./pages/TokenDetail").then(m => ({ default: m.TokenDetail })));
const Market      = lazy(() => import("./pages/Market").then(m => ({ default: m.Market })));
const NFT         = lazy(() => import("./pages/NFT").then(m => ({ default: m.NFT })));

export type Page = "home" | "launch" | "discover" | "token" | "trade" | "status" | "about" | "market" | "nft";

const PageLoader = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
    <div className="badge-spinner" />
  </div>
);

export const App = () => {
  const [page, setPage] = useState<Page>("home");
  const [selectedMint, setSelectedMint] = useState("");
  const isLanding = page === "home";
  const openToken = (mint: string) => {
    setSelectedMint(mint);
    setPage("token");
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [page]);

  // Global navigation bus — lets deeply nested components navigate without prop drilling
  useEffect(() => {
    const handler = (e: Event) => {
      const p = (e as CustomEvent<Page>).detail;
      if (p) setPage(p);
    };
    window.addEventListener("ht:navigate", handler);
    return () => window.removeEventListener("ht:navigate", handler);
  }, []);

  return (
    <>
      {!isLanding && (
        <>
          <div className="orb orb1" />
          <div className="orb orb2" />
          <div className="orb orb3" />
        </>
      )}
      {!isLanding && (
        <>
          <Navbar page={page} setPage={setPage} />
          <Ticker />
          <StatusBanner />
        </>
      )}
      <Suspense fallback={<PageLoader />}>
        {isLanding && (
          <Landing
            goLaunch={() => setPage("launch")}
            goDiscover={() => setPage("discover")}
            goTrade={() => setPage("trade")}
          />
        )}
        {page === "launch"   && <Launch />}
        {page === "discover" && <Discover openToken={openToken} />}
        {page === "token"    && <TokenDetail mint={selectedMint} back={() => setPage("discover")} />}
        {page === "trade"    && <Trade goDiscover={() => setPage("discover")} />}
        {page === "market"   && <Market />}
        {page === "nft"      && <NFT goLaunch={() => setPage("launch")} />}
        {page === "status"   && <Status />}
        {page === "about"    && <About />}
      </Suspense>
      {!isLanding && <Footer setPage={setPage} />}
    </>
  );
};

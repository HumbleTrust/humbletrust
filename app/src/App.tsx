import { useEffect, useState } from "react";
import { Navbar } from "./components/Navbar";
import { Ticker } from "./components/Ticker";
import { Footer } from "./components/Footer";
import { StatusBanner } from "./components/StatusBanner";
import { Landing } from "./pages/Landing";
import { Launch } from "./pages/Launch";
import { Discover } from "./pages/Discover";
import { Trade } from "./pages/Trade";
import { About } from "./pages/About";
import { Status } from "./pages/Status";
import { TokenDetail } from "./pages/TokenDetail";
import { Market } from "./pages/Market";
import { NFT } from "./pages/NFT";

export type Page = "home" | "launch" | "discover" | "token" | "trade" | "status" | "about" | "market" | "nft";

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
      const page = (e as CustomEvent<Page>).detail;
      if (page) setPage(page);
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
      {isLanding && (
        <Landing
          goLaunch={() => setPage("launch")}
          goDiscover={() => setPage("discover")}
          goTrade={() => setPage("trade")}
        />
      )}
      {page === "launch" && <Launch />}
      {page === "discover" && <Discover openToken={openToken} />}
      {page === "token" && <TokenDetail mint={selectedMint} back={() => setPage("discover")} />}
      {page === "trade" && <Trade goDiscover={() => setPage("discover")} />}
      {page === "market" && <Market />}
      {page === "nft" && <NFT goLaunch={() => setPage("launch")} />}
      {page === "status" && <Status />}
      {page === "about" && <About />}
      {!isLanding && <Footer setPage={setPage} />}
    </>
  );
};

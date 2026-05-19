import { useState } from "react";
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

export type Page = "home" | "launch" | "discover" | "token" | "trade" | "status" | "about";

export const App = () => {
  const [page, setPage] = useState<Page>("home");
  const [selectedMint, setSelectedMint] = useState("");
  const openToken = (mint: string) => {
    setSelectedMint(mint);
    setPage("token");
  };
  return (
    <>
      <div className="orb orb1" />
      <div className="orb orb2" />
      <div className="orb orb3" />
      <Navbar page={page} setPage={setPage} />
      <Ticker />
      <StatusBanner />
      {page === "home" && <Landing goLaunch={() => setPage("launch")} goDiscover={() => setPage("discover")} />}
      {page === "launch" && <Launch />}
      {page === "discover" && <Discover openToken={openToken} />}
      {page === "token" && <TokenDetail mint={selectedMint} back={() => setPage("discover")} />}
      {page === "trade" && <Trade goDiscover={() => setPage("discover")} />}
      {page === "status" && <Status />}
      {page === "about" && <About />}
      <Footer setPage={setPage} />
    </>
  );
};

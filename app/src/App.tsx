import { useState } from "react";
import { Navbar } from "./components/Navbar";
import { Ticker } from "./components/Ticker";
import { Footer } from "./components/Footer";
import { Landing } from "./pages/Landing";
import { Launch } from "./pages/Launch";
import { Discover } from "./pages/Discover";
import { Trade } from "./pages/Trade";
import { About } from "./pages/About";

export type Page = "home" | "launch" | "discover" | "trade" | "about";

export const App = () => {
  const [page, setPage] = useState<Page>("home");
  return (
    <>
      <div className="orb orb1" />
      <div className="orb orb2" />
      <div className="orb orb3" />
      <Navbar page={page} setPage={setPage} />
      <Ticker />
      {page === "home" && <Landing goLaunch={() => setPage("launch")} goDiscover={() => setPage("discover")} />}
      {page === "launch" && <Launch />}
      {page === "discover" && <Discover />}
      {page === "trade" && <Trade goDiscover={() => setPage("discover")} />}
      {page === "about" && <About />}
      <Footer setPage={setPage} />
    </>
  );
};

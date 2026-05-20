import { useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import type { Page } from "../App";

const NAV: { label: string; page: Page }[] = [
  { label: "HOME", page: "home" },
  { label: "LAUNCH", page: "launch" },
  { label: "DISCOVER", page: "discover" },
  { label: "TRADE", page: "trade" },
  { label: "MARKET", page: "market" },
  { label: "STATUS", page: "status" },
  { label: "ABOUT", page: "about" },
];

export const Navbar = ({ page, setPage }: { page: Page; setPage: (p: Page) => void }) => {
  const [open, setOpen] = useState(false);

  const navigate = (p: Page) => {
    setPage(p);
    setOpen(false);
  };

  return (
    <>
      <nav className="topbar">
        <a href="#" className="brand" onClick={(e) => { e.preventDefault(); navigate("home"); }}>
          <span className="brand-hex" />
          <span>
            <span className="brand-humble">Humble</span>
            <span style={{ color: "var(--muted2)" }}>.</span>
            <span className="brand-trust">Trust</span>
          </span>
        </a>
        <ul className="nav-links">
          {NAV.map(({ label, page: p }) => (
            <li key={p}>
              <button className={page === p ? "active" : ""} onClick={() => navigate(p)}>{label}</button>
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            className={`hamburger${open ? " open" : ""}`}
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            <span /><span /><span />
          </button>
          <WalletMultiButton />
        </div>
      </nav>
      <div className={`mobile-nav-menu${open ? " open" : ""}`}>
        {NAV.map(({ label, page: p }) => (
          <button key={p} className={page === p ? "active" : ""} onClick={() => navigate(p)}>
            {label}
          </button>
        ))}
      </div>
    </>
  );
};

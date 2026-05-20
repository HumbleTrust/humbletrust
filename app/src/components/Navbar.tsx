import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import type { Page } from "../App";
import { BadgeModal } from "./BadgeModal";

const NAV: { label: string; page: Page }[] = [
  { label: "HOME",     page: "home"     },
  { label: "LAUNCH",   page: "launch"   },
  { label: "DISCOVER", page: "discover" },
  { label: "TRADE",    page: "trade"    },
  { label: "MARKET",   page: "market"   },
  { label: "STATUS",   page: "status"   },
  { label: "ABOUT",    page: "about"    },
];

export const Navbar = ({ page, setPage }: { page: Page; setPage: (p: Page) => void }) => {
  const { connected } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [badgeOpen, setBadgeOpen] = useState(false);

  const navigate = (p: Page) => { setPage(p); setMenuOpen(false); };

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
              <button data-page={p} className={page === p ? "active" : ""} onClick={() => navigate(p)}>
                {label}
              </button>
            </li>
          ))}
        </ul>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {/* Profile / Badge button — only when wallet connected */}
          {connected && (
            <button
              className="profile-btn"
              onClick={() => setBadgeOpen(true)}
              title="My Badge"
            >
              <svg width="18" height="18" viewBox="0 0 90 108" fill="none">
                <path d="M45,3 L85,18 L85,58 C85,80 45,105 45,105 C45,105 5,80 5,58 L5,18 Z"
                  stroke="currentColor" strokeWidth="7" fill="none"/>
                <circle cx="76" cy="12" r="10" fill="#05070F" stroke="#00FF94" strokeWidth="5"/>
                <polyline points="70,12 75,18 84,6" stroke="#00FF94" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Profile</span>
            </button>
          )}

          {/* Hamburger */}
          <button
            className={`hamburger${menuOpen ? " open" : ""}`}
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Menu"
          >
            <span /><span /><span />
          </button>

          <WalletMultiButton />
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`mobile-nav-menu${menuOpen ? " open" : ""}`}>
        {NAV.map(({ label, page: p }) => (
          <button key={p} data-page={p} className={page === p ? "active" : ""} onClick={() => navigate(p)}>
            {label}
          </button>
        ))}
        {connected && (
          <button data-page="badge" onClick={() => { setMenuOpen(false); setBadgeOpen(true); }}>
            PROFILE
          </button>
        )}
      </div>

      {/* Badge modal */}
      {badgeOpen && <BadgeModal onClose={() => setBadgeOpen(false)} />}
    </>
  );
};

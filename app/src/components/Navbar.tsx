import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import type { Page } from "../App";

export const Navbar = ({ page, setPage }: { page: Page; setPage: (p: Page) => void }) => (
  <nav className="topbar">
    <a href="#" className="brand" onClick={(e) => { e.preventDefault(); setPage("home"); }}>
      <span className="brand-hex" />
      <span>
        <span className="brand-humble">Humble</span>
        <span style={{ color: "var(--muted2)" }}>.</span>
        <span className="brand-trust">Trust</span>
      </span>
    </a>
    <ul className="nav-links">
      <li><button className={page === "home" ? "active" : ""} onClick={() => setPage("home")}>HOME</button></li>
      <li><button className={page === "launch" ? "active" : ""} onClick={() => setPage("launch")}>LAUNCH</button></li>
      <li><button className={page === "discover" ? "active" : ""} onClick={() => setPage("discover")}>DISCOVER</button></li>
      <li><button className={page === "about" ? "active" : ""} onClick={() => setPage("about")}>ABOUT</button></li>
    </ul>
    <WalletMultiButton />
  </nav>
);

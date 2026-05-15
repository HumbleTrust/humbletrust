import type { Page } from "../App";

export const Footer = ({ setPage }: { setPage: (p: Page) => void }) => (
  <footer>
    <div className="foot-grid">
      <div>
        <div className="brand" style={{ marginBottom: "1rem" }}>
          <span className="brand-hex" />
          <span>
            <span className="brand-humble">Humble</span>
            <span style={{ color: "var(--muted2)" }}>.</span>
            <span className="brand-trust">Trust</span>
          </span>
        </div>
        <p style={{ color: "var(--muted2)", fontSize: ".88rem", lineHeight: 1.65, maxWidth: 320 }}>
          Anti-rug token launchpad on Solana. Every token locked on-chain. Every creator scored for trust.
        </p>
      </div>
      <div>
        <div className="foot-h">Product</div>
        <ul className="foot-list">
          <li><a href="#" onClick={(e) => { e.preventDefault(); setPage("launch"); }}>Launch token</a></li>
          <li><a href="#" onClick={(e) => { e.preventDefault(); setPage("discover"); }}>Discover</a></li>
          <li><a href="#" onClick={(e) => { e.preventDefault(); setPage("trade"); }}>Trade</a></li>
          <li><a href="#" onClick={(e) => { e.preventDefault(); setPage("about"); }}>How it works</a></li>
        </ul>
      </div>
      <div>
        <div className="foot-h">Network</div>
        <ul className="foot-list">
          <li><a href="https://solscan.io/?cluster=devnet" target="_blank" rel="noreferrer">Solscan (devnet)</a></li>
          <li><a href="https://explorer.solana.com/?cluster=devnet" target="_blank" rel="noreferrer">Explorer</a></li>
          <li><a href="https://faucet.solana.com" target="_blank" rel="noreferrer">Devnet Faucet</a></li>
          <li><a href="https://jup.ag" target="_blank" rel="noreferrer">Jupiter Swap</a></li>
        </ul>
      </div>
      <div>
        <div className="foot-h">Resources</div>
        <ul className="foot-list">
          <li><a href="https://github.com/HumbleTrust/humbletrust" target="_blank" rel="noreferrer">GitHub</a></li>
          <li><a href={`https://solscan.io/account/Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi?cluster=devnet`} target="_blank" rel="noreferrer">Program on Solscan</a></li>
          <li><a href="#" onClick={(e) => { e.preventDefault(); setPage("about"); }}>Whitepaper</a></li>
          <li><a href="#" onClick={(e) => { e.preventDefault(); setPage("about"); }}>Roadmap</a></li>
        </ul>
      </div>
    </div>
    <div className="foot-bottom">
      <span>© 2026 Humble.Trust. All on-chain.</span>
      <span>Live on Devnet</span>
    </div>
  </footer>
);

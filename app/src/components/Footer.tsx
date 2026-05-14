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
          <li><a onClick={() => setPage("launch")}>Launch token</a></li>
          <li><a onClick={() => setPage("discover")}>Discover</a></li>
          <li><a onClick={() => setPage("about")}>How it works</a></li>
        </ul>
      </div>
      <div>
        <div className="foot-h">Network</div>
        <ul className="foot-list">
          <li><a href="https://solscan.io/?cluster=devnet" target="_blank" rel="noreferrer">Solscan</a></li>
          <li><a href="https://explorer.solana.com/?cluster=devnet" target="_blank" rel="noreferrer">Explorer</a></li>
          <li><a href="https://faucet.solana.com" target="_blank" rel="noreferrer">Faucet</a></li>
        </ul>
      </div>
      <div>
        <div className="foot-h">Resources</div>
        <ul className="foot-list">
          <li><a href="#">Docs</a></li>
          <li><a href="#">Whitepaper</a></li>
          <li><a href="#">Audit</a></li>
        </ul>
      </div>
    </div>
    <div className="foot-bottom">
      <span>© 2026 Humble.Trust. All on-chain.</span>
      <span>Live on Devnet</span>
    </div>
  </footer>
);

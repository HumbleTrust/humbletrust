import Link from "next/link";
import { Shield } from "lucide-react";

export function Footer() {
  return (
    <footer style={{
      borderTop: "1px solid var(--border-subtle)",
      background: "var(--bg-surface)",
      padding: "3rem 24px 2rem",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "2rem", marginBottom: "3rem" }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, var(--primary), var(--secondary))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Shield size={15} color="#05080F" />
              </div>
              <span style={{ fontFamily: "var(--font-geist)", fontWeight: 700, color: "var(--text-primary)" }}>HumbleTrust</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, maxWidth: 260 }}>
              Trust infrastructure for Web3. Accountability enforced by code, verified by Solana.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
              {["X", "GitHub", "Discord", "Telegram"].map((s) => (
                <div key={s} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", transition: "border-color 0.15s, color 0.15s" }}>
                  {s[0]}
                </div>
              ))}
            </div>
          </div>

          {/* Links */}
          {[
            { title: "Product", links: ["How it works", "Projects", "Launch", "TrustScore"] },
            { title: "Developers", links: ["Documentation", "GitHub", "Program ID", "IDL"] },
            { title: "Legal", links: ["Terms", "Privacy", "Audit", "Contact"] },
          ].map((col) => (
            <div key={col.title}>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "1rem" }}>
                {col.title}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {col.links.map((link) => (
                  <span key={link} style={{ fontSize: 14, color: "var(--text-secondary)", cursor: "pointer", transition: "color 0.15s" }}>
                    {link}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            © 2026 HumbleTrust. Built on Solana.
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--primary)", display: "inline-block", boxShadow: "0 0 6px var(--primary)", animation: "pulse-glow 2s ease-in-out infinite" }} />
            <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--primary)" }}>Devnet Live</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

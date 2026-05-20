import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { BadgeModal } from "../components/BadgeModal";

// ── Element path helpers (same as Landing.tsx MiniShieldBadge) ──────────────
const ELEMENT_PATHS: Record<string, string> = {
  Fire:  "M45,37 L60,64 L30,64 Z",
  Water: "M45,67 L60,40 L30,40 Z",
  Earth: "M45,37 L60,52 L45,67 L30,52 Z",
};

// ── MiniShieldBadge (inline, same logic as Landing.tsx) ─────────────────────
const MiniShieldBadge = ({
  zodiac,
  element,
  aura,
  edition,
}: {
  zodiac: string;
  element: string;
  aura: string;
  edition: number;
}) => (
  <div className="badge-mini-card">
    <svg viewBox="0 0 90 110" fill="none" className="badge-mini-svg" aria-hidden="true">
      <path
        d="M45,5 L83,19 L83,57 C83,79 45,103 45,103 C45,103 7,79 7,57 L7,19 Z"
        fill={`${aura}18`}
        stroke={aura}
        strokeWidth="2"
        style={{ filter: `drop-shadow(0 0 10px ${aura}80)` }}
      />
      <path
        d="M45,12 L76,23 L76,56 C76,74 45,95 45,95 C45,95 14,74 14,56 L14,23 Z"
        fill="rgba(5,7,15,0.65)"
        stroke={`${aura}50`}
        strokeWidth="1"
      />
      {element === "Air" ? (
        <>
          <circle cx="45" cy="52" r="13" fill="none" stroke={aura} strokeWidth="2" opacity="0.9" />
          <circle cx="45" cy="52" r="7"  fill="none" stroke={aura} strokeWidth="2" opacity="0.65" />
        </>
      ) : (
        <path
          d={ELEMENT_PATHS[element]}
          fill={`${aura}40`}
          stroke={aura}
          strokeWidth="2"
          strokeLinejoin="round"
          opacity="0.9"
        />
      )}
      <text x="45" y="83" textAnchor="middle" fill={aura} fontSize="7"
        fontFamily="monospace" letterSpacing="2" opacity="0.8">
        {zodiac.slice(0, 3).toUpperCase()}
      </text>
      <circle cx="76" cy="13" r="9" fill="#05070F" stroke="#00FF94" strokeWidth="4.5" />
      <polyline
        points="70,13 75,19 84,7"
        stroke="#00FF94"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text x="14" y="14" fill="rgba(255,255,255,0.22)" fontSize="5.5" fontFamily="monospace">
        #{String(edition).padStart(3, "0")}
      </text>
    </svg>
    <div className="badge-mini-meta">
      <strong style={{ color: aura }}>{zodiac}</strong>
      <span>{element}</span>
    </div>
  </div>
);

// ── Zodiac data ───────────────────────────────────────────────────────────────
const ZODIACS = [
  { name: "Aries",       symbol: "♈", element: "Fire",  season: "Mar 21 – Apr 19" },
  { name: "Taurus",      symbol: "♉", element: "Earth", season: "Apr 20 – May 20" },
  { name: "Gemini",      symbol: "♊", element: "Air",   season: "May 21 – Jun 20" },
  { name: "Cancer",      symbol: "♋", element: "Water", season: "Jun 21 – Jul 22" },
  { name: "Leo",         symbol: "♌", element: "Fire",  season: "Jul 23 – Aug 22" },
  { name: "Virgo",       symbol: "♍", element: "Earth", season: "Aug 23 – Sep 22" },
  { name: "Libra",       symbol: "♎", element: "Air",   season: "Sep 23 – Oct 22" },
  { name: "Scorpio",     symbol: "♏", element: "Water", season: "Oct 23 – Nov 21" },
  { name: "Sagittarius", symbol: "♐", element: "Fire",  season: "Nov 22 – Dec 21" },
  { name: "Capricorn",   symbol: "♑", element: "Earth", season: "Dec 22 – Jan 19" },
  { name: "Aquarius",    symbol: "♒", element: "Air",   season: "Jan 20 – Feb 18" },
  { name: "Pisces",      symbol: "♓", element: "Water", season: "Feb 19 – Mar 20" },
];

const ELEMENT_COLOR: Record<string, string> = {
  Fire:  "#FF3C6B",
  Water: "#00D4FF",
  Earth: "#9945FF",
  Air:   "#00FF94",
};

// ── Structure cards ───────────────────────────────────────────────────────────
const STRUCTURE_CARDS = [
  {
    label: "Shield",
    title: "Heraldic Shape",
    body: "Every badge uses a classic pointed shield form — the visual vessel that carries all on-chain attributes.",
    color: "var(--green-neon)",
  },
  {
    label: "Zodiac Sign",
    title: "From Mint Date",
    body: "The zodiac is determined by the calendar date of your Premium token launch. It cannot be changed post-mint.",
    color: "var(--solana-purple)",
  },
  {
    label: "Element",
    title: "Fire · Water · Earth · Air",
    body: "Each zodiac sign maps to one of four elements shown as a sigil in the lower shield. Elemental logic follows classical astrology.",
    color: "var(--solana-blue)",
  },
  {
    label: "Aura Color",
    title: "From Wallet Hash",
    body: "Your aura is derived deterministically by hashing your wallet public key against 32 curated colors. No two wallets share the same aura.",
    color: "#FFD600",
  },
];

// ── How it works steps ────────────────────────────────────────────────────────
const STEPS = [
  {
    num: "01",
    title: "Choose your Premium launch",
    body: "Select the Premium tier when launching a token on HumbleTrust. Only Premium creators are eligible to mint a Zodiac Badge.",
  },
  {
    num: "02",
    title: "Zodiac assigned by date",
    body: "Your zodiac sign is locked to the calendar date of your token launch. The aura color is hashed from your wallet address.",
  },
  {
    num: "03",
    title: "Unique badge minted on-chain",
    body: "A standard Metaplex NFT is created on Solana with your shield, zodiac glyph, element sigil and aura encoded as on-chain attributes.",
  },
];

// ── Price table rows ──────────────────────────────────────────────────────────
const PRICE_ROWS = [
  { label: "Standard mint",            value: "0.2 SOL",  note: "Any Premium token creator" },
  { label: "Genesis mint",             value: "0.5 SOL",  note: "First 100 mints per zodiac sign" },
  { label: "Resell cooldown",          value: "30 days",  note: "After selling, wait 30 days to re-mint" },
];

// ── FAQ items ─────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: "Can I sell my Zodiac Badge?",
    a: "Yes. The badge is a standard Metaplex NFT and can be listed on any compatible marketplace. After selling, a 30-day cooldown applies before you can mint again.",
  },
  {
    q: "Can I own more than one badge?",
    a: "No. Each wallet can hold one active Zodiac Badge at a time. Selling your badge resets eligibility after the 30-day cooldown.",
  },
  {
    q: "Is it tradeable on Magic Eden?",
    a: "Yes. Zodiac Badges follow the Metaplex NFT standard and are compatible with Magic Eden, Tensor, and other Solana NFT marketplaces.",
  },
];

// ── Mini badge preview set ────────────────────────────────────────────────────
const PREVIEW_BADGES = [
  { zodiac: "Leo",       element: "Fire",  aura: "#FF3C6B", edition: 7  },
  { zodiac: "Aquarius",  element: "Air",   aura: "#00D4FF", edition: 14 },
  { zodiac: "Taurus",    element: "Earth", aura: "#9945FF", edition: 3  },
  { zodiac: "Scorpio",   element: "Water", aura: "#39FF14", edition: 21 },
  { zodiac: "Sagittarius", element: "Fire", aura: "#FF7A2F", edition: 9 },
  { zodiac: "Pisces",    element: "Water", aura: "#00FFD1", edition: 42 },
];

// ── Main NFT page ─────────────────────────────────────────────────────────────
export const NFT = ({ goLaunch }: { goLaunch?: () => void } = {}) => {
  const { connected } = useWallet();
  const [badgeOpen, setBadgeOpen] = useState(false);

  return (
    <>
      {/* ── Hero ── */}
      <section
        style={{
          padding: "80px 6%",
          textAlign: "center",
          borderBottom: "1px solid var(--border)",
          position: "relative",
        }}
      >
        <div className="sec-eyebrow" style={{ marginBottom: "1.2rem" }}>
          Zodiac Badge NFT
        </div>
        <h1
          style={{
            fontFamily: "var(--font-head)",
            fontSize: "clamp(2rem, 5vw, 3.4rem)",
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: "1.2rem",
            color: "var(--text)",
          }}
        >
          Your on-chain identity,{" "}
          <span style={{ color: "var(--green-neon)" }}>written in the stars</span>
        </h1>
        <p
          className="sec-sub"
          style={{ maxWidth: 620, margin: "0 auto 2.2rem", fontSize: "1.05rem" }}
        >
          Zodiac Badge NFTs are unique, on-chain shields awarded exclusively to Premium token creators
          on HumbleTrust. Attributes flow from the blockchain — zodiac from launch date, aura from
          wallet address, element from the stars.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          {connected ? (
            <button className="btn-p" onClick={() => setBadgeOpen(true)}>
              Mint Your Badge
            </button>
          ) : (
            <>
              <WalletMultiButton />
              <span
                className="sec-sub"
                style={{ alignSelf: "center", fontSize: ".88rem" }}
              >
                Connect wallet to mint
              </span>
            </>
          )}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: "80px 6%", borderBottom: "1px solid var(--border)" }}>
        <div className="sec-eyebrow">How it works</div>
        <h2 className="sec-h2" style={{ marginBottom: "2.8rem" }}>
          Three steps from launch to badge
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "1.4rem",
          }}
        >
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="module-card"
              style={{ position: "relative", paddingTop: "2rem" }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "2.2rem",
                  fontWeight: 700,
                  color: "var(--green-neon)",
                  opacity: 0.18,
                  position: "absolute",
                  top: "1rem",
                  right: "1.2rem",
                  lineHeight: 1,
                }}
              >
                {step.num}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: ".72rem",
                  color: "var(--green-neon)",
                  letterSpacing: ".12em",
                  marginBottom: ".6rem",
                  textTransform: "uppercase",
                }}
              >
                Step {step.num}
              </div>
              <strong
                style={{
                  fontFamily: "var(--font-head)",
                  fontSize: "1.05rem",
                  display: "block",
                  marginBottom: ".5rem",
                  color: "var(--text)",
                }}
              >
                {step.title}
              </strong>
              <p style={{ color: "var(--muted2)", fontSize: ".9rem", lineHeight: 1.6 }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Price table ── */}
      <section
        style={{
          padding: "80px 6%",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg2)",
        }}
      >
        <div className="sec-eyebrow">Pricing</div>
        <h2 className="sec-h2" style={{ marginBottom: "2.4rem" }}>
          Transparent mint pricing
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "1.2rem",
            maxWidth: 860,
          }}
        >
          {PRICE_ROWS.map((row) => (
            <div
              key={row.label}
              className="module-card"
              style={{ textAlign: "center", padding: "2rem 1.5rem" }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "1.8rem",
                  fontWeight: 700,
                  color: "var(--green-neon)",
                  marginBottom: ".4rem",
                }}
              >
                {row.value}
              </div>
              <strong
                style={{
                  fontFamily: "var(--font-head)",
                  fontSize: "1rem",
                  display: "block",
                  marginBottom: ".4rem",
                  color: "var(--text)",
                }}
              >
                {row.label}
              </strong>
              <p style={{ color: "var(--muted2)", fontSize: ".85rem" }}>{row.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Requirements ── */}
      <section style={{ padding: "80px 6%", borderBottom: "1px solid var(--border)" }}>
        <div className="sec-eyebrow">Requirements</div>
        <h2 className="sec-h2" style={{ marginBottom: "1.2rem" }}>
          Premium creators only
        </h2>
        <p className="sec-sub" style={{ maxWidth: 640, marginBottom: "2rem" }}>
          Zodiac Badge NFTs are exclusively available to wallets that have launched a Premium token
          on HumbleTrust. This ensures the badge carries real signal — it identifies builders who
          have committed to the platform's trust and safety standards.
        </p>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.75rem",
            background: "var(--bg3)",
            border: "1px solid var(--border2)",
            borderRadius: 10,
            padding: "1rem 1.5rem",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 90 108" fill="none">
            <path
              d="M45,3 L85,18 L85,58 C85,80 45,105 45,105 C45,105 5,80 5,58 L5,18 Z"
              stroke="var(--green-neon)"
              strokeWidth="5"
              fill="none"
            />
            <circle cx="76" cy="12" r="10" fill="#05070F" stroke="#00FF94" strokeWidth="5" />
            <polyline
              points="70,12 75,18 84,6"
              stroke="#00FF94"
              strokeWidth="4.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: ".75rem",
                color: "var(--green-neon)",
                letterSpacing: ".1em",
                textTransform: "uppercase",
              }}
            >
              Eligibility requirement
            </div>
            <div style={{ color: "var(--text)", fontSize: ".95rem", fontWeight: 500 }}>
              Must have launched at least one Premium token on HumbleTrust
            </div>
          </div>
        </div>
      </section>

      {/* ── Badge structure ── */}
      <section
        style={{
          padding: "80px 6%",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg2)",
        }}
      >
        <div className="sec-eyebrow">Badge Structure</div>
        <h2 className="sec-h2" style={{ marginBottom: ".8rem" }}>
          Four layers. One unique identity.
        </h2>
        <p className="sec-sub" style={{ maxWidth: 580, marginBottom: "2.8rem" }}>
          Every badge is composed of four deterministic layers. No randomness, no external oracles —
          every attribute flows directly from on-chain data.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "1.4rem",
          }}
        >
          {STRUCTURE_CARDS.map((card) => (
            <div key={card.label} className="module-card" style={{ borderTop: `2px solid ${card.color}` }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: ".7rem",
                  color: card.color,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  marginBottom: ".6rem",
                }}
              >
                {card.label}
              </div>
              <strong
                style={{
                  fontFamily: "var(--font-head)",
                  fontSize: "1.05rem",
                  display: "block",
                  marginBottom: ".5rem",
                  color: "var(--text)",
                }}
              >
                {card.title}
              </strong>
              <p style={{ color: "var(--muted2)", fontSize: ".9rem", lineHeight: 1.6 }}>
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Zodiac sign grid ── */}
      <section style={{ padding: "80px 6%", borderBottom: "1px solid var(--border)" }}>
        <div className="sec-eyebrow">All 12 Signs</div>
        <h2 className="sec-h2" style={{ marginBottom: ".8rem" }}>
          Every zodiac, every element
        </h2>
        <p className="sec-sub" style={{ maxWidth: 540, marginBottom: "2.8rem" }}>
          Your badge zodiac is locked to the calendar date of your token launch. All 12 signs are
          available — each tied to one of four classical elements.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1px",
            background: "var(--border)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {ZODIACS.map((z) => (
            <div
              key={z.name}
              style={{
                background: "var(--bg2)",
                padding: "1.1rem 1.3rem",
                display: "flex",
                alignItems: "center",
                gap: "0.9rem",
              }}
            >
              <span
                style={{
                  fontSize: "1.5rem",
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                {z.symbol}
              </span>
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-head)",
                    fontWeight: 600,
                    fontSize: ".95rem",
                    color: "var(--text)",
                  }}
                >
                  {z.name}
                </div>
                <div style={{ display: "flex", gap: ".5rem", alignItems: "center", marginTop: ".2rem" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: ".68rem",
                      color: ELEMENT_COLOR[z.element],
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {z.element}
                  </span>
                  <span style={{ color: "var(--muted)", fontSize: ".68rem" }}>·</span>
                  <span style={{ color: "var(--muted2)", fontSize: ".72rem" }}>{z.season}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Badge previews ── */}
      <section
        style={{
          padding: "80px 6%",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg2)",
        }}
      >
        <div className="sec-eyebrow">Badge Previews</div>
        <h2 className="sec-h2" style={{ marginBottom: ".8rem" }}>
          No two badges look the same
        </h2>
        <p className="sec-sub" style={{ maxWidth: 540, marginBottom: "2.8rem" }}>
          Each wallet's aura color is unique — even two badges with the same zodiac sign will
          look completely different. Below are six example badges from real sign and element
          combinations.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "1.2rem",
          }}
        >
          {PREVIEW_BADGES.map((b) => (
            <MiniShieldBadge
              key={b.zodiac}
              zodiac={b.zodiac}
              element={b.element}
              aura={b.aura}
              edition={b.edition}
            />
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: "80px 6%", borderBottom: "1px solid var(--border)" }}>
        <div className="sec-eyebrow">FAQ</div>
        <h2 className="sec-h2" style={{ marginBottom: "2.8rem" }}>
          Common questions
        </h2>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.2rem",
            maxWidth: 740,
          }}
        >
          {FAQ.map((item) => (
            <div key={item.q} className="module-card" style={{ padding: "1.4rem 1.6rem" }}>
              <strong
                style={{
                  fontFamily: "var(--font-head)",
                  fontSize: "1rem",
                  display: "block",
                  marginBottom: ".5rem",
                  color: "var(--green-neon)",
                }}
              >
                {item.q}
              </strong>
              <p style={{ color: "var(--muted2)", fontSize: ".92rem", lineHeight: 1.65 }}>
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom mint CTA ── */}
      <section
        style={{
          padding: "80px 6%",
          textAlign: "center",
          background: "var(--bg2)",
        }}
      >
        <div className="sec-eyebrow" style={{ marginBottom: "1.2rem" }}>
          Ready to mint?
        </div>
        <h2
          style={{
            fontFamily: "var(--font-head)",
            fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
            fontWeight: 800,
            marginBottom: "1rem",
            color: "var(--text)",
          }}
        >
          Claim your Zodiac Badge
        </h2>
        <p className="sec-sub" style={{ maxWidth: 500, margin: "0 auto 2.2rem" }}>
          Premium token creators can mint their unique on-chain shield. Connect your wallet and
          launch a Premium token to unlock minting.
        </p>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          {connected ? (
            <button className="btn-p" onClick={() => setBadgeOpen(true)}>
              Mint My Zodiac Badge
            </button>
          ) : (
            <WalletMultiButton />
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "2.4rem",
            marginTop: "2.8rem",
            flexWrap: "wrap",
          }}
        >
          {[
            ["0.2 SOL", "Standard mint"],
            ["0.5 SOL", "Genesis (first 100/sign)"],
            ["30 days", "Resell cooldown"],
            ["1 per wallet", "Max ownership"],
          ].map(([val, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "1.15rem",
                  fontWeight: 700,
                  color: "var(--green-neon)",
                }}
              >
                {val}
              </div>
              <div style={{ color: "var(--muted2)", fontSize: ".8rem", marginTop: ".2rem" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Badge modal */}
      {badgeOpen && <BadgeModal onClose={() => setBadgeOpen(false)} goLaunch={goLaunch} />}
    </>
  );
};

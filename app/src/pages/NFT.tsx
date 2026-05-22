import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { BadgeModal } from "../components/BadgeModal";
import { ZodiacBadgeCard, ELEMENT_COLOR } from "../components/ZodiacBadgeCard";

// ── Data ──────────────────────────────────────────────────────────────────────
const ZODIACS = [
  { name: "Aries",       element: "Fire",  season: "21 Mar – 19 Apr" },
  { name: "Taurus",      element: "Earth", season: "20 Apr – 20 May" },
  { name: "Gemini",      element: "Air",   season: "21 May – 20 Jun" },
  { name: "Cancer",      element: "Water", season: "21 Jun – 22 Jul" },
  { name: "Leo",         element: "Fire",  season: "23 Jul – 22 Aug" },
  { name: "Virgo",       element: "Earth", season: "23 Aug – 22 Sep" },
  { name: "Libra",       element: "Air",   season: "23 Sep – 22 Oct" },
  { name: "Scorpio",     element: "Water", season: "23 Oct – 21 Nov" },
  { name: "Sagittarius", element: "Fire",  season: "22 Nov – 21 Dec" },
  { name: "Capricorn",   element: "Earth", season: "22 Dec – 19 Jan" },
  { name: "Aquarius",    element: "Air",   season: "20 Jan – 18 Feb" },
  { name: "Pisces",      element: "Water", season: "19 Feb – 20 Mar" },
];

const SAME_SIGN_ROWS = [
  { sign: "Scorpio", element: "Water", badges: [
    { aura: "#00D4FF", edition: 1  },
    { aura: "#FF3C6B", edition: 8  },
    { aura: "#39FF14", edition: 15 },
    { aura: "#FFDB2B", edition: 27 },
    { aura: "#DC1FFF", edition: 33 },
  ]},
  { sign: "Leo", element: "Fire", badges: [
    { aura: "#9945FF", edition: 2  },
    { aura: "#FF7A2F", edition: 11 },
    { aura: "#00FFD1", edition: 19 },
    { aura: "#1466FF", edition: 44 },
    { aura: "#FF4DCB", edition: 56 },
  ]},
];

const STEPS = [
  { num: "01", title: "Choose your Premium launch", body: "Select the Premium tier when launching a token on HumbleTrust. Only Premium creators are eligible to mint a Zodiac Badge." },
  { num: "02", title: "Zodiac assigned by date",    body: "Your zodiac sign is locked to the calendar date of your token launch. The aura color is hashed from your wallet address." },
  { num: "03", title: "Unique badge minted on-chain", body: "A standard Metaplex NFT is created on Solana with your shield, zodiac glyph, element sigil and aura encoded as on-chain attributes." },
];

const FAQ = [
  { q: "Can I sell my Zodiac Badge?", a: "Yes. The badge is a standard Metaplex NFT and can be listed on any compatible marketplace. After selling, a 30-day cooldown applies before you can mint again." },
  { q: "Can I own more than one badge?", a: "No. Each wallet can hold one active Zodiac Badge at a time. Selling your badge resets eligibility after the 30-day cooldown." },
  { q: "Is it tradeable on Magic Eden?", a: "Yes. Zodiac Badges follow the Metaplex NFT standard and are compatible with Magic Eden, Tensor, and other Solana NFT marketplaces." },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export const NFT = ({ goLaunch }: { goLaunch?: () => void } = {}) => {
  const { connected } = useWallet();
  const [badgeOpen, setBadgeOpen] = useState(false);

  return (
    <>
      {/* Hero */}
      <section style={{ padding: "80px 6%", textAlign: "center", borderBottom: "1px solid var(--border)" }}>
        <div className="sec-eyebrow" style={{ marginBottom: "1.2rem" }}>Zodiac Badge NFT</div>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: "clamp(2rem,5vw,3.4rem)", fontWeight: 800, lineHeight: 1.1, marginBottom: "1.2rem", color: "#9945FF", textShadow: "0 0 40px rgba(153,69,255,.45)" }}>
          Your on-chain identity,{" "}
          <span style={{ color: "var(--green-neon)", textShadow: "0 0 30px rgba(0,255,148,.4)" }}>written in the stars</span>
        </h1>
        <p className="sec-sub" style={{ maxWidth: 620, margin: "0 auto 2.2rem", fontSize: "1.05rem" }}>
          Zodiac Badge NFTs are unique, on-chain shields awarded exclusively to Premium token creators on HumbleTrust.
          Zodiac from launch date · aura from wallet address · element from the stars.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          {connected
            ? <button className="btn-p" onClick={() => setBadgeOpen(true)}>Mint Your Badge</button>
            : <><WalletMultiButton /><span className="sec-sub" style={{ alignSelf: "center", fontSize: ".88rem" }}>Connect wallet to mint</span></>}
        </div>
      </section>

      {/* All 12 signs */}
      <section style={{ padding: "80px 6%", borderBottom: "1px solid var(--border)", background: "var(--bg2)" }}>
        <div className="sec-eyebrow">All 12 Signs</div>
        <h2 className="sec-h2" style={{ marginBottom: ".8rem" }}>Every zodiac, every element</h2>
        <p className="sec-sub" style={{ maxWidth: 540, marginBottom: "2.8rem" }}>
          Your badge zodiac is locked to the calendar date of your token launch.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: "1.4rem", justifyItems: "center" }}>
          {ZODIACS.map((z, i) => (
            <ZodiacBadgeCard key={z.name} zodiac={z.name} element={z.element}
              aura={ELEMENT_COLOR[z.element]} edition={i + 1} season={z.season} />
          ))}
        </div>
      </section>

      {/* Aura uniqueness */}
      <section style={{ padding: "80px 6%", borderBottom: "1px solid var(--border)" }}>
        <div className="sec-eyebrow">Aura Uniqueness</div>
        <h2 className="sec-h2" style={{ marginBottom: ".8rem" }}>Same zodiac, different wallet — different badge</h2>
        <p className="sec-sub" style={{ maxWidth: 560, marginBottom: "2.8rem" }}>
          The aura color is derived deterministically from your wallet address. Two Scorpios, five different wallets — five completely different badges.
        </p>
        {SAME_SIGN_ROWS.map(row => (
          <div key={row.sign} style={{ marginBottom: "3.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: ".75rem", marginBottom: "1.4rem" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: ".72rem", color: ELEMENT_COLOR[row.element], letterSpacing: ".12em", textTransform: "uppercase" }}>{row.element}</span>
              <span style={{ color: "var(--muted)" }}>·</span>
              <span style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1rem" }}>{row.sign}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: ".65rem", color: "var(--muted)", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 6, padding: ".2rem .55rem" }}>
                {row.badges.length} different wallets
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: "1.4rem", justifyItems: "center" }}>
              {row.badges.map((b, i) => (
                <ZodiacBadgeCard key={i} zodiac={row.sign} element={row.element}
                  aura={b.aura} edition={b.edition} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section style={{ padding: "80px 6%", borderBottom: "1px solid var(--border)", background: "var(--bg2)" }}>
        <div className="sec-eyebrow">How it works</div>
        <h2 className="sec-h2" style={{ marginBottom: "2.8rem" }}>Three steps from launch to badge</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: "1.4rem" }}>
          {STEPS.map(s => (
            <div key={s.num} className="module-card" style={{ position: "relative", paddingTop: "2rem" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "2.2rem", fontWeight: 700, color: "var(--green-neon)", opacity: .18, position: "absolute", top: "1rem", right: "1.2rem", lineHeight: 1 }}>{s.num}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: ".72rem", color: "var(--green-neon)", letterSpacing: ".12em", marginBottom: ".6rem", textTransform: "uppercase" }}>Step {s.num}</div>
              <strong style={{ fontFamily: "var(--font-head)", fontSize: "1.05rem", display: "block", marginBottom: ".5rem" }}>{s.title}</strong>
              <p style={{ color: "var(--muted2)", fontSize: ".9rem", lineHeight: 1.6 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: "80px 6%", borderBottom: "1px solid var(--border)" }}>
        <div className="sec-eyebrow">Pricing</div>
        <h2 className="sec-h2" style={{ marginBottom: "2.4rem" }}>Transparent mint pricing</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: "1.2rem", maxWidth: 860 }}>
          {[
            { val: "0.2 SOL", label: "Standard mint",   note: "Any Premium token creator" },
            { val: "0.5 SOL", label: "Genesis mint",    note: "First 100 mints per zodiac sign" },
            { val: "30 days", label: "Resell cooldown", note: "After selling, wait 30 days to re-mint" },
          ].map(r => (
            <div key={r.label} className="module-card" style={{ textAlign: "center", padding: "2rem 1.5rem" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.8rem", fontWeight: 700, color: "var(--green-neon)", marginBottom: ".4rem" }}>{r.val}</div>
              <strong style={{ fontFamily: "var(--font-head)", fontSize: "1rem", display: "block", marginBottom: ".4rem" }}>{r.label}</strong>
              <p style={{ color: "var(--muted2)", fontSize: ".85rem" }}>{r.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "80px 6%", borderBottom: "1px solid var(--border)", background: "var(--bg2)" }}>
        <div className="sec-eyebrow">FAQ</div>
        <h2 className="sec-h2" style={{ marginBottom: "2.8rem" }}>Common questions</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", maxWidth: 740 }}>
          {FAQ.map(item => (
            <div key={item.q} className="module-card" style={{ padding: "1.4rem 1.6rem" }}>
              <strong style={{ fontFamily: "var(--font-head)", fontSize: "1rem", display: "block", marginBottom: ".5rem", color: "var(--green-neon)" }}>{item.q}</strong>
              <p style={{ color: "var(--muted2)", fontSize: ".92rem", lineHeight: 1.65 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "80px 6%", textAlign: "center" }}>
        <div className="sec-eyebrow" style={{ marginBottom: "1.2rem" }}>Ready to mint?</div>
        <h2 style={{ fontFamily: "var(--font-head)", fontSize: "clamp(1.6rem,4vw,2.6rem)", fontWeight: 800, marginBottom: "1rem", color: "#9945FF", textShadow: "0 0 40px rgba(153,69,255,.45)" }}>
          Claim your Zodiac Badge
        </h2>
        <p className="sec-sub" style={{ maxWidth: 500, margin: "0 auto 2.2rem" }}>
          Premium token creators can mint their unique on-chain shield.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          {connected ? <button className="btn-p" onClick={() => setBadgeOpen(true)}>Mint My Zodiac Badge</button> : <WalletMultiButton />}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "2.4rem", marginTop: "2.8rem", flexWrap: "wrap" }}>
          {[["0.2 SOL", "Standard"], ["0.5 SOL", "Genesis"], ["30 days", "Cooldown"], ["1 per wallet", "Max"]].map(([v, l]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.15rem", fontWeight: 700, color: "var(--green-neon)" }}>{v}</div>
              <div style={{ color: "var(--muted2)", fontSize: ".8rem", marginTop: ".2rem" }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {badgeOpen && <BadgeModal onClose={() => setBadgeOpen(false)} goLaunch={goLaunch} />}
    </>
  );
};

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { BadgeModal } from "../components/BadgeModal";

const ELEMENT_COLOR: Record<string, string> = {
  Fire:  "#FF7A2F",
  Water: "#00FF94",
  Earth: "#9945FF",
  Air:   "#00D4FF",
};

// ── Zodiac glyph — actual astrological symbol, 100×100 space ─────────────────
function ZodiacGlyph({ zodiac, color }: { zodiac: string; color: string }) {
  const p = { stroke: color, strokeWidth: "2.8", fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const dot = (cx: number, cy: number, r = 4.5) =>
    <circle cx={cx} cy={cy} r={r} fill={color} stroke="none" />;

  switch (zodiac) {
    case "Aries": return <g {...p}>
      <circle cx="50" cy="80" r="16" />
      <path d="M50,65 C42,54 30,40 33,22 C36,10 50,10 50,28" />
      <path d="M50,65 C58,54 70,40 67,22 C64,10 50,10 50,28" />
    </g>;
    case "Taurus": return <g {...p}>
      <circle cx="50" cy="66" r="25" />
      <path d="M26,53 C17,41 15,22 23,10" />
      <path d="M74,53 C83,41 85,22 77,10" />
    </g>;
    case "Gemini": return <g {...p}>
      <rect x="16" y="14" width="24" height="68" rx="12" />
      <rect x="60" y="14" width="24" height="68" rx="12" />
      {dot(50, 48, 3)}
    </g>;
    case "Cancer": return <g {...p}>
      <path d="M52,50 C60,46 70,37 65,26 C60,16 50,22 50,36 C50,50 62,58 78,51 C93,44 91,28 80,22" />
      <path d="M48,50 C40,46 30,37 35,26 C40,16 50,22 50,36 C50,50 38,58 22,51 C7,44 9,28 20,22" />
    </g>;
    case "Leo": return <g>
      <circle cx="50" cy="46" r="17" stroke={color} strokeWidth="2.8" fill="none" />
      {dot(50, 46, 5)}
      {["M50,29 L50,10","M66,46 L90,46","M34,46 L10,46",
        "M62,34 L78,18","M38,34 L22,18","M62,58 L78,74","M38,58 L22,74"
      ].map((d,i) => <path key={i} d={d} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />)}
      <path d="M50,63 C60,74 74,78 78,67 C82,56 70,46 57,57" stroke={color} strokeWidth="2.8" fill="none" strokeLinecap="round" />
    </g>;
    case "Virgo": return <g {...p}>
      <path d="M26,14 L26,78" />
      <path d="M26,28 L65,28 L65,72" />
      <path d="M65,72 C73,72 82,65 76,54 C70,43 56,49 58,62 C60,76 76,80 84,68" />
    </g>;
    case "Libra": return <g {...p}>
      <path d="M28,50 C28,30 72,30 72,50" />
      <line x1="18" y1="50" x2="82" y2="50" />
      <path d="M18,50 L18,78 L82,78 L82,50" />
    </g>;
    case "Scorpio": return <g {...p}>
      <path d="M14,58 C14,73 26,80 38,65 C50,50 50,65 62,68 C74,71 74,58 83,52" />
      <path d="M83,52 C91,47 96,55 90,67 L100,44" />
      <path d="M100,44 L90,42 M100,44 L98,55" />
    </g>;
    case "Sagittarius": return <g {...p}>
      <line x1="14" y1="86" x2="84" y2="18" />
      <path d="M84,18 L71,22 M84,18 L80,32" />
      <line x1="40" y1="62" x2="58" y2="62" />
    </g>;
    case "Capricorn": return <g {...p}>
      <path d="M16,14 L40,56" />
      <path d="M84,14 C70,14 54,18 44,32 C36,44 36,60 44,70 C52,80 68,82 76,70 C84,58 76,44 60,52 C44,60 44,78 58,86" />
    </g>;
    case "Aquarius": return <g {...p}>
      <path d="M8,42 C16,30 22,30 30,42 C38,54 44,54 52,42 C60,30 66,30 74,42 C82,54 88,54 96,42" />
      <path d="M8,62 C16,50 22,50 30,62 C38,74 44,74 52,62 C60,50 66,50 74,62 C82,74 88,74 96,62" />
      {dot(8,42,4)}{dot(96,42,4)}{dot(8,62,4)}{dot(96,62,4)}
    </g>;
    case "Pisces": return <g {...p}>
      <ellipse cx="50" cy="50" rx="28" ry="40" />
      {dot(14,50,4)}{dot(86,50,4)}
      <line x1="14" y1="50" x2="86" y2="50" />
    </g>;
    default: return null;
  }
}

// ── Element sigil — alchemical symbol, 100×80 space ───────────────────────────
function ElementSigil({ element, color }: { element: string; color: string }) {
  const dot = (cx: number, cy: number, r = 5) =>
    <circle cx={cx} cy={cy} r={r} fill={color} stroke="none" />;

  switch (element) {
    case "Fire": return <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="10,76 90,76 50,10" strokeWidth="2.5" />
      <polygon points="20,70 80,70 50,22" strokeWidth="1.8" opacity="0.7" />
      <line x1="14" y1="62" x2="86" y2="62" strokeWidth="1.8" />
      {dot(50, 44)}
    </g>;
    case "Water": return <g fill="none">
      <circle cx="50" cy="40" r="30" stroke={color} strokeWidth="2.5" />
      <circle cx="50" cy="40" r="20" stroke={color} strokeWidth="1.8" opacity="0.7" />
      <line x1="4"  y1="40" x2="14" y2="40" stroke={color} strokeWidth="2" />
      <line x1="86" y1="40" x2="96" y2="40" stroke={color} strokeWidth="2" />
      <line x1="50" y1="2"  x2="50" y2="10" stroke={color} strokeWidth="2" />
      <line x1="50" y1="70" x2="50" y2="78" stroke={color} strokeWidth="2" />
      <path d="M40,40 C40,30 60,30 60,40 C60,50 40,50 40,40 Z" stroke={color} strokeWidth="2" opacity="0.85" />
      {dot(50, 40, 4)}
    </g>;
    case "Earth": return <g fill="none" stroke={color} strokeWidth="2.5">
      <polygon points="50,4 84,60 16,60" />
      <polygon points="50,76 84,20 16,20" />
      {[[50,4],[84,60],[16,60],[50,76],[84,20],[16,20]].map(([x,y],i) =>
        <circle key={i} cx={x} cy={y} r="4.5" fill={color} stroke="none" />
      )}
      {dot(50, 40, 4)}
    </g>;
    case "Air": return <g fill="none">
      <polygon points="50,8 88,72 12,72" stroke={color} strokeWidth="2.5" />
      <circle cx="50" cy="51" r="42" stroke={color} strokeWidth="2" strokeDasharray="6,5" opacity="0.8" />
      {dot(50, 51)}
    </g>;
    default: return null;
  }
}

// ── ZodiacBadgeCard ───────────────────────────────────────────────────────────
const ZodiacBadgeCard = ({
  zodiac, element, aura, edition, season,
}: {
  zodiac: string; element: string; aura: string; edition: number; season?: string;
}) => {
  const cid = `zbc${zodiac}${edition}${aura.replace("#","")}`;
  const ec = ELEMENT_COLOR[element] ?? aura;

  return (
    <div
      style={{ width:"100%", borderRadius:14, transition:"transform .22s, box-shadow .22s" }}
      onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform="translateY(-8px)"; d.style.boxShadow=`0 20px 60px ${aura}35`; }}
      onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform=""; d.style.boxShadow=""; }}
    >
      <svg viewBox="0 0 300 420" fill="none" style={{ width:"100%", display:"block", borderRadius:14 }}>
        <defs>
          <radialGradient id={`${cid}bg`} cx="50%" cy="40%" r="58%">
            <stop offset="0%"   stopColor={aura} stopOpacity="0.12" />
            <stop offset="100%" stopColor="#05070F" stopOpacity="1" />
          </radialGradient>
          <filter id={`${cid}glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect width="300" height="420" rx="14" fill="#07090F" />
        <rect width="300" height="420" rx="14" fill={`url(#${cid}bg)`} />
        <rect width="300" height="420" rx="14" fill="none" stroke={aura} strokeWidth="1.5" strokeOpacity="0.5" />

        {/* Header label */}
        <text x="18" y="36" fill={aura} fillOpacity="0.38" fontSize="9"
          fontFamily="monospace" letterSpacing="3.5">HUMBLETRUST</text>

        {/* Shield glow halo */}
        <path d="M96,58 L204,58 L228,162 L150,274 L72,162 Z"
          stroke={aura} strokeWidth="10" strokeOpacity="0.1"
          fill="none" filter={`url(#${cid}glow)`} />

        {/* Shield outer */}
        <path d="M96,58 L204,58 L228,162 L150,274 L72,162 Z"
          stroke={aura} strokeWidth="2" fill={`${aura}0A`} />

        {/* Shield inner double border */}
        <path d="M105,68 L195,68 L218,160 L150,264 L82,160 Z"
          stroke={aura} strokeWidth="1" strokeOpacity="0.35" fill="none" />

        {/* Node dots at shield vertices */}
        {([[96,58],[204,58],[228,162],[150,274],[72,162]] as [number,number][]).map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r="5.5" fill={aura} opacity="0.9" />
        ))}

        {/* Zodiac glyph inside shield, centered at (150,165) */}
        <g transform="translate(107.5,122.5) scale(0.85)" filter={`url(#${cid}glow)`}>
          <ZodiacGlyph zodiac={zodiac} color={aura} />
        </g>

        {/* Verification badge at top-right shield node */}
        <circle cx="204" cy="58" r="14" fill="#060810" />
        <circle cx="204" cy="58" r="14" fill="none" stroke="#00FF94" strokeWidth="3.5" />
        <polyline points="196,58 202,65 214,50"
          stroke="#00FF94" strokeWidth="2.5" fill="none"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Element sigil — centered at (150,315), local space 100×80 → scale 0.62 */}
        <g transform="translate(119,283) scale(0.62)" filter={`url(#${cid}glow)`}>
          <ElementSigil element={element} color={ec} />
        </g>

        {/* Sign name */}
        <text x="150" y="362" textAnchor="middle" fill="white" fontSize="19"
          fontFamily="monospace" fontWeight="400" letterSpacing="6">
          {zodiac.toUpperCase()}
        </text>

        {/* Underline */}
        <line x1="104" y1="369" x2="196" y2="369" stroke={aura} strokeOpacity="0.4" strokeWidth="0.8" />

        {/* Element + season */}
        <text x="150" y="384" textAnchor="middle" fill={aura} fillOpacity="0.75"
          fontSize="10" fontFamily="monospace" letterSpacing="2">
          {element.toUpperCase()}{season ? ` · ${season}` : ""}
        </text>

        {/* Edition */}
        <text x="282" y="412" textAnchor="end" fill="rgba(255,255,255,0.2)"
          fontSize="9" fontFamily="monospace" letterSpacing="1">
          Edition #{String(edition).padStart(3,"0")}
        </text>
      </svg>
    </div>
  );
};

// ── Data ──────────────────────────────────────────────────────────────────────
const ZODIACS = [
  { name:"Aries",       element:"Fire",  season:"21 Mar – 19 Apr" },
  { name:"Taurus",      element:"Earth", season:"20 Apr – 20 May" },
  { name:"Gemini",      element:"Air",   season:"21 May – 20 Jun" },
  { name:"Cancer",      element:"Water", season:"21 Jun – 22 Jul" },
  { name:"Leo",         element:"Fire",  season:"23 Jul – 22 Aug" },
  { name:"Virgo",       element:"Earth", season:"23 Aug – 22 Sep" },
  { name:"Libra",       element:"Air",   season:"23 Sep – 22 Oct" },
  { name:"Scorpio",     element:"Water", season:"23 Oct – 21 Nov" },
  { name:"Sagittarius", element:"Fire",  season:"22 Nov – 21 Dec" },
  { name:"Capricorn",   element:"Earth", season:"22 Dec – 19 Jan" },
  { name:"Aquarius",    element:"Air",   season:"20 Jan – 18 Feb" },
  { name:"Pisces",      element:"Water", season:"19 Feb – 20 Mar" },
];

const SAME_SIGN_ROWS = [
  { sign:"Scorpio", element:"Water", badges:[
    { aura:"#00D4FF", edition:1  },
    { aura:"#FF3C6B", edition:8  },
    { aura:"#39FF14", edition:15 },
    { aura:"#FFDB2B", edition:27 },
    { aura:"#DC1FFF", edition:33 },
  ]},
  { sign:"Leo", element:"Fire", badges:[
    { aura:"#9945FF", edition:2  },
    { aura:"#FF7A2F", edition:11 },
    { aura:"#00FFD1", edition:19 },
    { aura:"#1466FF", edition:44 },
    { aura:"#FF4DCB", edition:56 },
  ]},
];

const STEPS = [
  { num:"01", title:"Choose your Premium launch", body:"Select the Premium tier when launching a token on HumbleTrust. Only Premium creators are eligible to mint a Zodiac Badge." },
  { num:"02", title:"Zodiac assigned by date",    body:"Your zodiac sign is locked to the calendar date of your token launch. The aura color is hashed from your wallet address." },
  { num:"03", title:"Unique badge minted on-chain", body:"A standard Metaplex NFT is created on Solana with your shield, zodiac glyph, element sigil and aura encoded as on-chain attributes." },
];

const FAQ = [
  { q:"Can I sell my Zodiac Badge?", a:"Yes. The badge is a standard Metaplex NFT and can be listed on any compatible marketplace. After selling, a 30-day cooldown applies before you can mint again." },
  { q:"Can I own more than one badge?", a:"No. Each wallet can hold one active Zodiac Badge at a time. Selling your badge resets eligibility after the 30-day cooldown." },
  { q:"Is it tradeable on Magic Eden?", a:"Yes. Zodiac Badges follow the Metaplex NFT standard and are compatible with Magic Eden, Tensor, and other Solana NFT marketplaces." },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export const NFT = ({ goLaunch }: { goLaunch?: () => void } = {}) => {
  const { connected } = useWallet();
  const [badgeOpen, setBadgeOpen] = useState(false);

  return (
    <>
      {/* Hero */}
      <section style={{ padding:"80px 6%", textAlign:"center", borderBottom:"1px solid var(--border)" }}>
        <div className="sec-eyebrow" style={{ marginBottom:"1.2rem" }}>Zodiac Badge NFT</div>
        <h1 style={{ fontFamily:"var(--font-head)", fontSize:"clamp(2rem,5vw,3.4rem)", fontWeight:800, lineHeight:1.1, marginBottom:"1.2rem", color:"#9945FF", textShadow:"0 0 40px rgba(153,69,255,.45)" }}>
          Your on-chain identity,{" "}
          <span style={{ color:"var(--green-neon)", textShadow:"0 0 30px rgba(0,255,148,.4)" }}>written in the stars</span>
        </h1>
        <p className="sec-sub" style={{ maxWidth:620, margin:"0 auto 2.2rem", fontSize:"1.05rem" }}>
          Zodiac Badge NFTs are unique, on-chain shields awarded exclusively to Premium token creators on HumbleTrust.
          Zodiac from launch date · aura from wallet address · element from the stars.
        </p>
        <div style={{ display:"flex", gap:"1rem", justifyContent:"center", flexWrap:"wrap" }}>
          {connected
            ? <button className="btn-p" onClick={() => setBadgeOpen(true)}>Mint Your Badge</button>
            : <><WalletMultiButton /><span className="sec-sub" style={{ alignSelf:"center", fontSize:".88rem" }}>Connect wallet to mint</span></>}
        </div>
      </section>

      {/* All 12 signs */}
      <section style={{ padding:"80px 6%", borderBottom:"1px solid var(--border)", background:"var(--bg2)" }}>
        <div className="sec-eyebrow">All 12 Signs</div>
        <h2 className="sec-h2" style={{ marginBottom:".8rem" }}>Every zodiac, every element</h2>
        <p className="sec-sub" style={{ maxWidth:540, marginBottom:"2.8rem" }}>
          Your badge zodiac is locked to the calendar date of your token launch.
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px,1fr))", gap:"1.4rem" }}>
          {ZODIACS.map((z,i) => (
            <ZodiacBadgeCard key={z.name} zodiac={z.name} element={z.element}
              aura={ELEMENT_COLOR[z.element]} edition={i+1} season={z.season} />
          ))}
        </div>
      </section>

      {/* Aura uniqueness */}
      <section style={{ padding:"80px 6%", borderBottom:"1px solid var(--border)" }}>
        <div className="sec-eyebrow">Aura Uniqueness</div>
        <h2 className="sec-h2" style={{ marginBottom:".8rem" }}>Same zodiac, different wallet — different badge</h2>
        <p className="sec-sub" style={{ maxWidth:560, marginBottom:"2.8rem" }}>
          The aura color is derived deterministically from your wallet address. Two Scorpios, five different wallets — five completely different badges.
        </p>
        {SAME_SIGN_ROWS.map(row => (
          <div key={row.sign} style={{ marginBottom:"3.5rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:".75rem", marginBottom:"1.4rem" }}>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:".72rem", color:ELEMENT_COLOR[row.element], letterSpacing:".12em", textTransform:"uppercase" }}>{row.element}</span>
              <span style={{ color:"var(--muted)" }}>·</span>
              <span style={{ fontFamily:"var(--font-head)", fontWeight:700, fontSize:"1rem" }}>{row.sign}</span>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:".65rem", color:"var(--muted)", background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:6, padding:".2rem .55rem" }}>
                {row.badges.length} different wallets
              </span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px,1fr))", gap:"1.4rem" }}>
              {row.badges.map((b,i) => (
                <ZodiacBadgeCard key={i} zodiac={row.sign} element={row.element}
                  aura={b.aura} edition={b.edition} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section style={{ padding:"80px 6%", borderBottom:"1px solid var(--border)", background:"var(--bg2)" }}>
        <div className="sec-eyebrow">How it works</div>
        <h2 className="sec-h2" style={{ marginBottom:"2.8rem" }}>Three steps from launch to badge</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px,1fr))", gap:"1.4rem" }}>
          {STEPS.map(s => (
            <div key={s.num} className="module-card" style={{ position:"relative", paddingTop:"2rem" }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:"2.2rem", fontWeight:700, color:"var(--green-neon)", opacity:.18, position:"absolute", top:"1rem", right:"1.2rem", lineHeight:1 }}>{s.num}</div>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:".72rem", color:"var(--green-neon)", letterSpacing:".12em", marginBottom:".6rem", textTransform:"uppercase" }}>Step {s.num}</div>
              <strong style={{ fontFamily:"var(--font-head)", fontSize:"1.05rem", display:"block", marginBottom:".5rem" }}>{s.title}</strong>
              <p style={{ color:"var(--muted2)", fontSize:".9rem", lineHeight:1.6 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding:"80px 6%", borderBottom:"1px solid var(--border)" }}>
        <div className="sec-eyebrow">Pricing</div>
        <h2 className="sec-h2" style={{ marginBottom:"2.4rem" }}>Transparent mint pricing</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px,1fr))", gap:"1.2rem", maxWidth:860 }}>
          {[
            { val:"0.2 SOL", label:"Standard mint",   note:"Any Premium token creator" },
            { val:"0.5 SOL", label:"Genesis mint",    note:"First 100 mints per zodiac sign" },
            { val:"30 days", label:"Resell cooldown", note:"After selling, wait 30 days to re-mint" },
          ].map(r => (
            <div key={r.label} className="module-card" style={{ textAlign:"center", padding:"2rem 1.5rem" }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:"1.8rem", fontWeight:700, color:"var(--green-neon)", marginBottom:".4rem" }}>{r.val}</div>
              <strong style={{ fontFamily:"var(--font-head)", fontSize:"1rem", display:"block", marginBottom:".4rem" }}>{r.label}</strong>
              <p style={{ color:"var(--muted2)", fontSize:".85rem" }}>{r.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding:"80px 6%", borderBottom:"1px solid var(--border)", background:"var(--bg2)" }}>
        <div className="sec-eyebrow">FAQ</div>
        <h2 className="sec-h2" style={{ marginBottom:"2.8rem" }}>Common questions</h2>
        <div style={{ display:"flex", flexDirection:"column", gap:"1.2rem", maxWidth:740 }}>
          {FAQ.map(item => (
            <div key={item.q} className="module-card" style={{ padding:"1.4rem 1.6rem" }}>
              <strong style={{ fontFamily:"var(--font-head)", fontSize:"1rem", display:"block", marginBottom:".5rem", color:"var(--green-neon)" }}>{item.q}</strong>
              <p style={{ color:"var(--muted2)", fontSize:".92rem", lineHeight:1.65 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding:"80px 6%", textAlign:"center" }}>
        <div className="sec-eyebrow" style={{ marginBottom:"1.2rem" }}>Ready to mint?</div>
        <h2 style={{ fontFamily:"var(--font-head)", fontSize:"clamp(1.6rem,4vw,2.6rem)", fontWeight:800, marginBottom:"1rem", color:"#9945FF", textShadow:"0 0 40px rgba(153,69,255,.45)" }}>
          Claim your Zodiac Badge
        </h2>
        <p className="sec-sub" style={{ maxWidth:500, margin:"0 auto 2.2rem" }}>
          Premium token creators can mint their unique on-chain shield.
        </p>
        <div style={{ display:"flex", gap:"1rem", justifyContent:"center", flexWrap:"wrap" }}>
          {connected ? <button className="btn-p" onClick={() => setBadgeOpen(true)}>Mint My Zodiac Badge</button> : <WalletMultiButton />}
        </div>
        <div style={{ display:"flex", justifyContent:"center", gap:"2.4rem", marginTop:"2.8rem", flexWrap:"wrap" }}>
          {[["0.2 SOL","Standard"],["0.5 SOL","Genesis"],["30 days","Cooldown"],["1 per wallet","Max"]].map(([v,l]) => (
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:"1.15rem", fontWeight:700, color:"var(--green-neon)" }}>{v}</div>
              <div style={{ color:"var(--muted2)", fontSize:".8rem", marginTop:".2rem" }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {badgeOpen && <BadgeModal onClose={() => setBadgeOpen(false)} goLaunch={goLaunch} />}
    </>
  );
};

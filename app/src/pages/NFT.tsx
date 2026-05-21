import { useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { BadgeModal } from "../components/BadgeModal";

// ── Aura helpers ──────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [153, 69, 255];
}
function darkenHex(hex: string, f = 0.55): string {
  const [r, g, b] = hexToRgb(hex);
  const h = (n: number) => Math.round(n * f).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
function getAuraVars(aura: string): React.CSSProperties {
  const [r, g, b] = hexToRgb(aura);
  const dark = darkenHex(aura);
  return {
    "--aura": `linear-gradient(135deg,${aura},${dark},${aura})`,
    "--aura-glow": `rgba(${r},${g},${b},.65)`,
    "--aura-glow2": `rgba(${r},${g},${b},.18)`,
    "--aura-inner": `rgba(${r},${g},${b},.06)`,
    "--aura-text": aura,
  } as React.CSSProperties;
}

const ELEMENT_COLOR: Record<string, string> = {
  Fire:  "#FF7A2F",
  Water: "#14F195",
  Earth: "#9945FF",
  Air:   "#00D4FF",
};

const ELEMENT_BG: Record<string, string> = {
  Fire:  "nft-bg-ember",
  Water: "nft-bg-abyss",
  Earth: "nft-bg-void",
  Air:   "nft-bg-storm",
};

// ── Shield glyph — rendered inside 90×108 viewBox ────────────────────────────
function ShieldGlyph({ zodiac, color }: { zodiac: string; color: string }) {
  const sw = {
    stroke: color, strokeWidth: "1.8", fill: "none",
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  const dot = (cx: number, cy: number, r = 2.5, op?: number) => (
    <circle cx={cx} cy={cy} r={r} fill={color} stroke="none" opacity={op} />
  );

  switch (zodiac) {
    case "Aries": return <g {...sw}>
      <circle cx="45" cy="57" r="10" />
      <path d="M37,51 C31,43 21,33 19,21 C17,13 25,11 29,17" />
      <path d="M53,51 C59,43 69,33 71,21 C73,13 65,11 61,17" />
      {dot(29, 17, 3)}{dot(61, 17, 3)}{dot(45, 47, 2, 0.5)}
      <line x1="45" y1="67" x2="45" y2="75" strokeWidth="1.5" opacity=".5" />
    </g>;

    case "Taurus": return <g {...sw}>
      <circle cx="45" cy="60" r="16" />
      <path d="M31,50 C25,41 18,28 22,18" />
      <path d="M59,50 C65,41 72,28 68,18" />
      {dot(22, 18, 2.5)}{dot(68, 18, 2.5)}{dot(45, 44, 2, 0.5)}
    </g>;

    case "Gemini": return <g {...sw}>
      <line x1="29" y1="19" x2="29" y2="71" strokeWidth="2.5" />
      <line x1="61" y1="19" x2="61" y2="71" strokeWidth="2.5" />
      <path d="M29,19 C29,11 61,11 61,19" strokeWidth="2" />
      <path d="M29,71 C29,79 61,79 61,71" strokeWidth="2" />
      <line x1="29" y1="45" x2="61" y2="45" strokeWidth="1.5" opacity=".6" />
      {dot(29, 19, 2.5)}{dot(61, 19, 2.5)}
      {dot(29, 71, 2.5)}{dot(61, 71, 2.5)}{dot(45, 45, 2, 0.6)}
    </g>;

    case "Cancer": return <g {...sw}>
      <circle cx="45" cy="45" r="30" strokeWidth="1" opacity=".2" strokeDasharray="3 4" />
      <path d="M67,41 C73,33 69,19 57,17 C45,15 37,25 41,35 C45,45 57,45 57,37 C57,31 51,29 47,33" strokeWidth="2" />
      <path d="M23,49 C17,57 21,71 33,73 C45,75 53,65 49,55 C45,45 33,45 33,53 C33,59 39,61 43,57" strokeWidth="2" />
      {dot(47, 33, 3)}{dot(43, 57, 3)}
    </g>;

    case "Leo": return <g {...sw}>
      <circle cx="45" cy="56" r="12" />
      <line x1="45" y1="44" x2="45" y2="36" strokeWidth="1.5" opacity=".8" />
      <line x1="33" y1="56" x2="25" y2="56" strokeWidth="1.5" opacity=".7" />
      <line x1="57" y1="56" x2="65" y2="56" strokeWidth="1.5" opacity=".7" />
      <line x1="37" y1="47" x2="30" y2="40" strokeWidth="1.2" opacity=".6" />
      <line x1="53" y1="47" x2="60" y2="40" strokeWidth="1.2" opacity=".6" />
      <path d="M45,68 C45,74 52,78 55,84 C57,88 53,90 50,87" strokeWidth="1.8" />
      {dot(45, 56, 2.5, 0.6)}
    </g>;

    case "Virgo": return <g {...sw}>
      <line x1="33" y1="15" x2="33" y2="73" strokeWidth="2.2" />
      <line x1="33" y1="15" x2="57" y2="15" strokeWidth="2.2" />
      <line x1="57" y1="15" x2="57" y2="49" strokeWidth="2" />
      <path d="M57,49 C57,61 45,65 41,59 C37,53 43,47 51,51" strokeWidth="2" />
      <line x1="25" y1="37" x2="41" y2="37" strokeWidth="1.5" opacity=".6" />
      {dot(33, 15, 2.5, 0.6)}{dot(57, 15, 2.5)}{dot(51, 51, 3)}{dot(33, 73, 2, 0.4)}
    </g>;

    case "Libra": return <g {...sw}>
      <path d="M21,41 C21,29 69,29 69,41" strokeWidth="2" />
      <line x1="21" y1="41" x2="69" y2="41" strokeWidth="2.5" />
      <line x1="45" y1="41" x2="45" y2="67" strokeWidth="2" />
      <line x1="27" y1="67" x2="63" y2="67" strokeWidth="2.5" />
      {dot(21, 41, 2.5, 0.7)}{dot(69, 41, 2.5, 0.7)}
      {dot(45, 31, 3)}{dot(27, 67, 2, 0.6)}{dot(63, 67, 2, 0.6)}
    </g>;

    case "Scorpio": return <g {...sw}>
      <path d="M16,38 C16,50 22,58 26,58 C30,58 32,50 37,50 C42,50 44,58 48,58 C52,58 57,52 57,46" strokeWidth="2" />
      <path d="M57,46 C60,38 66,32 66,25" strokeWidth="2" />
      <polyline points="59,25 66,25 66,33" strokeWidth="1.8" />
      {dot(16, 38, 2.5)}{dot(26, 58, 2, 0.7)}{dot(48, 58, 2, 0.7)}{dot(66, 25, 3)}
    </g>;

    case "Sagittarius": return <g {...sw}>
      <line x1="19" y1="71" x2="71" y2="19" strokeWidth="2.5" />
      <polyline points="51,19 71,19 71,39" strokeWidth="2.2" />
      <line x1="35" y1="59" x2="19" y2="59" strokeWidth="1.5" opacity=".4" />
      {dot(71, 19, 3.5)}{dot(19, 71, 2.5, 0.6)}
    </g>;

    case "Capricorn": return <g {...sw}>
      <path d="M19,21 C19,21 19,49 33,57 C39,61 45,59 45,59" strokeWidth="2.2" />
      <path d="M45,21 L45,59" strokeWidth="2.2" />
      <path d="M45,59 C49,67 59,69 63,63 C67,57 63,49 55,51" strokeWidth="2" />
      <path d="M19,33 C25,27 39,25 45,29" strokeWidth="1.5" opacity=".6" />
      {dot(19, 21, 2.5)}{dot(45, 21, 2.5)}{dot(55, 51, 3)}
    </g>;

    case "Aquarius": return <g {...sw}>
      <polyline points="18,47 27,37 36,47 45,37 54,47 63,37 72,41" strokeWidth="1.8" />
      <polyline points="18,62 27,52 36,62 45,52 54,62 63,52 72,56" strokeWidth="1.8" />
      {dot(27, 37, 2.5)}{dot(45, 37, 2.5)}{dot(63, 37, 2.5)}
      {dot(27, 52, 2, 0.7)}{dot(45, 52, 2, 0.7)}{dot(63, 52, 2, 0.7)}
      <line x1="27" y1="37" x2="27" y2="52" strokeWidth=".8" opacity=".25" />
      <line x1="45" y1="37" x2="45" y2="52" strokeWidth=".8" opacity=".25" />
      <line x1="63" y1="37" x2="63" y2="52" strokeWidth=".8" opacity=".25" />
    </g>;

    case "Pisces": return <g {...sw}>
      <path d="M19,45 C19,27 71,27 71,45" strokeWidth="2.2" />
      <path d="M19,45 C19,63 71,63 71,45" strokeWidth="2.2" />
      <line x1="19" y1="45" x2="71" y2="45" strokeWidth="1.8" opacity=".7" />
      <polyline points="11,39 19,45 11,51" strokeWidth="1.8" />
      <polyline points="79,39 71,45 79,51" strokeWidth="1.8" />
      {dot(19, 45, 2.5)}{dot(71, 45, 2.5)}{dot(45, 27, 2, 0.5)}{dot(45, 63, 2, 0.5)}
    </g>;

    default: return null;
  }
}

// ── Element sigil — exact paths from reference, 80×80 viewBox ────────────────
function ElementSigil({ element, color }: { element: string; color: string }) {
  const sw = {
    stroke: color, fill: "none",
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  const dot = (cx: number, cy: number, r = 3) => (
    <circle cx={cx} cy={cy} r={r} fill={color} stroke="none" />
  );

  switch (element) {
    case "Fire": return <g {...sw}>
      <polygon points="40,6 72,68 8,68" strokeWidth="2" opacity=".9" />
      <polygon points="40,20 62,62 18,62" strokeWidth="1.2" fill={`${color}0F`} opacity=".7" />
      {dot(40, 46, 3)}
      <line x1="26" y1="54" x2="54" y2="54" strokeWidth="1.5" opacity=".5" />
    </g>;

    case "Water": return <g {...sw}>
      <circle cx="40" cy="40" r="32" strokeWidth="1.5" opacity=".4" />
      <path d="M40,14 C26,14 16,26 16,40 C16,54 26,66 40,66" strokeWidth="2" opacity=".9" />
      <path d="M40,14 C54,14 64,26 64,40 C64,54 54,66 40,66" strokeWidth="2" opacity=".9" />
      <path d="M40,22 C32,28 28,34 28,40 C28,46 32,52 40,58 C48,52 52,46 52,40 C52,34 48,28 40,22Z"
        fill={`${color}14`} strokeWidth="1" opacity=".6" />
      {dot(40, 40, 3)}
      <line x1="40" y1="6"  x2="40" y2="10" strokeWidth="1.5" opacity=".5" />
      <line x1="40" y1="70" x2="40" y2="74" strokeWidth="1.5" opacity=".5" />
      <line x1="6"  y1="40" x2="10" y2="40" strokeWidth="1.5" opacity=".5" />
      <line x1="70" y1="40" x2="74" y2="40" strokeWidth="1.5" opacity=".5" />
    </g>;

    case "Earth": return <g {...sw}>
      <rect x="22" y="22" width="36" height="36" transform="rotate(45 40 40)" strokeWidth="2" opacity=".8" />
      <polygon points="40,62 14,18 66,18" strokeWidth="2" fill={`${color}11`} opacity=".9" />
      <line x1="22" y1="36" x2="58" y2="36" strokeWidth="1.8" opacity=".8" />
      {dot(40, 40, 3)}
    </g>;

    case "Air": return <g {...sw}>
      <circle cx="40" cy="40" r="32" strokeWidth="1.5" strokeDasharray="4 3" opacity=".5" />
      <polygon points="40,10 70,64 10,64" strokeWidth="2" fill={`${color}0D`} opacity=".9" />
      <polygon points="40,24 58,58 22,58" strokeWidth="1.2" opacity=".5" />
      <line x1="40" y1="40" x2="40" y2="10" strokeWidth="1" opacity=".22" />
      <line x1="40" y1="40" x2="70" y2="64" strokeWidth="1" opacity=".22" />
      <line x1="40" y1="40" x2="10" y2="64" strokeWidth="1" opacity=".22" />
      <circle cx="40" cy="40" r="4" strokeWidth="1.5" fill={`${color}33`} />
      {dot(40, 40, 1.5)}
    </g>;

    default: return null;
  }
}

// ── Constellation data — 220×330 card space ───────────────────────────────────
type ConstellationData = {
  stars: [number, number, number][]; // x, y, r
  lines: [number, number, number, number][]; // x1,y1,x2,y2
};

const CONSTELLATIONS: Record<string, ConstellationData> = {
  Aries: {
    stars: [[92,78,1.5],[120,60,2],[148,68,1.5],[168,52,2],[145,90,1.5]],
    lines: [[92,78,120,60],[120,60,148,68],[148,68,168,52],[148,68,145,90]],
  },
  Taurus: {
    stars: [[110,72,2],[146,58,1.5],[164,80,1.5],[83,90,1.5],[66,74,1],[134,108,1.5]],
    lines: [[110,72,146,58],[146,58,164,80],[110,72,83,90],[83,90,66,74],[110,72,134,108]],
  },
  Gemini: {
    stars: [[80,65,2],[110,58,1.5],[140,65,2],[80,100,1.5],[140,100,1.5],[110,80,1]],
    lines: [[80,65,110,58],[110,58,140,65],[80,65,80,100],[140,65,140,100],[80,100,140,100]],
  },
  Cancer: {
    stars: [[100,80,1.5],[130,72,2],[120,100,1.5],[110,55,1.5],[145,98,1]],
    lines: [[110,55,130,72],[130,72,120,100],[100,80,130,72],[130,72,145,98]],
  },
  Leo: {
    stars: [[110,70,2.5],[79,86,1.5],[73,116,1.5],[94,138,1.5],[130,116,2],[156,96,1.5]],
    lines: [[110,70,79,86],[79,86,73,116],[73,116,94,138],[94,138,130,116],[130,116,156,96],[156,96,110,70]],
  },
  Virgo: {
    stars: [[85,60,2],[115,50,2],[148,62,1.5],[168,90,1.5],[145,115,1.5],[100,95,1]],
    lines: [[85,60,115,50],[115,50,148,62],[148,62,168,90],[168,90,145,115],[115,50,100,95]],
  },
  Libra: {
    stars: [[75,80,1.5],[110,65,2],[145,80,1.5],[110,100,1.5],[75,115,1],[145,115,1]],
    lines: [[75,80,110,65],[110,65,145,80],[75,80,75,115],[145,80,145,115],[75,115,145,115]],
  },
  Scorpio: {
    stars: [[73,81,2],[104,86,1.5],[130,76,2.5],[157,86,1.5],[140,112,1.5],[120,134,1.5]],
    lines: [[73,81,104,86],[104,86,130,76],[130,76,157,86],[157,86,140,112],[140,112,120,134]],
  },
  Sagittarius: {
    stars: [[75,125,2],[105,100,2],[140,75,1.5],[158,105,1.5],[128,125,1.5]],
    lines: [[75,125,105,100],[105,100,140,75],[105,100,158,105],[158,105,128,125]],
  },
  Capricorn: {
    stars: [[72,95,1.5],[100,75,2],[132,85,1.5],[158,68,1.5],[168,95,1.5],[120,115,1]],
    lines: [[72,95,100,75],[100,75,132,85],[132,85,158,68],[158,68,168,95],[132,85,120,115]],
  },
  Aquarius: {
    stars: [[57,96,1.5],[88,81,2],[120,92,1.5],[153,76,2],[177,92,1.5]],
    lines: [[57,96,88,81],[88,81,120,92],[120,92,153,76],[153,76,177,92]],
  },
  Pisces: {
    stars: [[72,75,1.5],[100,88,2],[128,75,1.5],[158,90,1.5],[88,112,1.5],[148,110,1.5]],
    lines: [[72,75,100,88],[100,88,128,75],[128,75,158,90],[88,112,148,110]],
  },
};

// ── ZodiacBadgeCard ───────────────────────────────────────────────────────────
const ZodiacBadgeCard = ({
  zodiac, element, aura, edition, season,
}: {
  zodiac: string; element: string; aura: string; edition: number; season?: string;
}) => {
  const [stars] = useState(() =>
    Array.from({ length: 40 }, () => ({
      w: Math.random() * 1.6 + 0.3,
      h: Math.random() * 1.6 + 0.3,
      t: Math.random() * 100,
      l: Math.random() * 100,
      d: (Math.random() * 4 + 2).toFixed(1),
      delay: (Math.random() * 5).toFixed(1),
    }))
  );

  const auraVars = useMemo(() => getAuraVars(aura), [aura]);
  const bg = ELEMENT_BG[element] ?? "nft-bg-void";
  const constellation = CONSTELLATIONS[zodiac] ?? CONSTELLATIONS.Taurus;
  const starOpacities = [0.7, 0.5, 0.5, 0.4, 0.4, 0.6];

  return (
    <div className={`nft-card ${bg}`} style={auraVars}>
      <div className="nft-noise" />

      {/* Twinkling stars */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {stars.map((s, i) => (
          <div key={i} className="nft-star" style={{
            width: s.w,
            height: s.h,
            top: `${s.t}%`,
            left: `${s.l}%`,
            "--d": `${s.d}s`,
            animationDelay: `${s.delay}s`,
          } as React.CSSProperties} />
        ))}
      </div>

      {/* Constellation */}
      <svg className="nft-constellation" viewBox="0 0 220 330">
        {constellation.stars.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="white"
            opacity={starOpacities[i % starOpacities.length]} />
        ))}
        {constellation.lines.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="white" strokeWidth=".4" opacity=".2" />
        ))}
      </svg>

      <div className="nft-card-badge">HumbleTrust</div>

      {/* Shield + zodiac glyph + verification */}
      <div className="nft-shield-wrap">
        <svg width="110" height="132" viewBox="0 0 90 108" fill="none">
          {/* Outer shield — curved heraldic */}
          <path d="M45,3 L85,18 L85,58 C85,80 45,105 45,105 C45,105 5,80 5,58 L5,18 Z"
            stroke={aura} strokeWidth="2" fill={`${aura}0D`} />
          {/* Inner shield */}
          <path d="M45,13 L75,26 L75,58 C75,75 45,95 45,95 C45,95 15,75 15,58 L15,26 Z"
            stroke={aura} strokeWidth="1.2" fill="none" opacity=".55" />
          {/* Heraldic fess line */}
          <line x1="16" y1="48" x2="74" y2="48" stroke={aura} strokeWidth="1" opacity=".28" />

          {/* Zodiac glyph */}
          <ShieldGlyph zodiac={zodiac} color={aura} />

          {/* Corner nodes */}
          <circle cx="45" cy="3"   r="3"   fill={aura} />
          <circle cx="85" cy="18"  r="2.5" fill={aura} opacity=".8" />
          <circle cx="85" cy="58"  r="2"   fill={aura} opacity=".6" />
          <circle cx="45" cy="105" r="3"   fill={aura} />
          <circle cx="5"  cy="58"  r="2"   fill={aura} opacity=".6" />
          <circle cx="5"  cy="18"  r="2.5" fill={aura} opacity=".8" />

          {/* Verification badge — always green */}
          <circle cx="78" cy="12" r="11" fill="#05070F" stroke="#00FF94" strokeWidth="1.5" />
          <circle cx="78" cy="12" r="8"  stroke="#00FF94" strokeWidth=".8"
            fill="rgba(0,255,148,.08)" opacity=".5" />
          <polyline points="72,12 77,18 86,6" stroke="#00FF94" strokeWidth="2"
            fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="86" cy="6" r="1.8" fill="#00FF94" />
        </svg>
      </div>

      {/* Element sigil */}
      <div className="nft-sigil-wrap">
        <svg width="36" height="36" viewBox="0 0 80 80" fill="none">
          <ElementSigil element={element} color={aura} />
        </svg>
      </div>

      <div className="nft-card-name">{zodiac}</div>
      <div className="nft-divider" />
      <div className="nft-card-element">{element}{season ? ` · ${season}` : ""}</div>
      <div className="nft-card-edition">Edition #{String(edition).padStart(3, "0")}</div>
    </div>
  );
};

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

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { motion, AnimatePresence } from "motion/react";
import { GlassPanel } from "../components/GlassPanel";
import { cn } from "../components/ui/utils";
import { mintBadgeNft } from "../../lib/solana/mintBadgeNft";

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

// ── Element colors ────────────────────────────────────────────────────────────
export const ELEMENT_COLOR: Record<string, string> = {
  Fire:  "#FF7A2F",
  Water: "#14F195",
  Earth: "#9945FF",
  Air:   "#00D4FF",
};

// ── Shield glyph — 90×108 viewBox ────────────────────────────────────────────
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
      {dot(29,17,3)}{dot(61,17,3)}{dot(45,47,2,0.5)}
      <line x1="45" y1="67" x2="45" y2="75" strokeWidth="1.5" opacity=".5" />
    </g>;
    case "Taurus": return <g {...sw}>
      <circle cx="45" cy="60" r="16" />
      <path d="M31,50 C25,41 18,28 22,18" />
      <path d="M59,50 C65,41 72,28 68,18" />
      {dot(22,18,2.5)}{dot(68,18,2.5)}{dot(45,44,2,0.5)}
    </g>;
    case "Gemini": return <g {...sw}>
      <line x1="29" y1="19" x2="29" y2="71" strokeWidth="2.5" />
      <line x1="61" y1="19" x2="61" y2="71" strokeWidth="2.5" />
      <path d="M29,19 C29,11 61,11 61,19" strokeWidth="2" />
      <path d="M29,71 C29,79 61,79 61,71" strokeWidth="2" />
      <line x1="29" y1="45" x2="61" y2="45" strokeWidth="1.5" opacity=".6" />
      {dot(29,19,2.5)}{dot(61,19,2.5)}{dot(29,71,2.5)}{dot(61,71,2.5)}{dot(45,45,2,0.6)}
    </g>;
    case "Cancer": return <g {...sw}>
      <circle cx="45" cy="45" r="30" strokeWidth="1" opacity=".2" strokeDasharray="3 4" />
      <path d="M67,41 C73,33 69,19 57,17 C45,15 37,25 41,35 C45,45 57,45 57,37 C57,31 51,29 47,33" strokeWidth="2" />
      <path d="M23,49 C17,57 21,71 33,73 C45,75 53,65 49,55 C45,45 33,45 33,53 C33,59 39,61 43,57" strokeWidth="2" />
      {dot(47,33,3)}{dot(43,57,3)}
    </g>;
    case "Leo": return <g {...sw}>
      <circle cx="45" cy="56" r="12" />
      <line x1="45" y1="44" x2="45" y2="36" strokeWidth="1.5" opacity=".8" />
      <line x1="33" y1="56" x2="25" y2="56" strokeWidth="1.5" opacity=".7" />
      <line x1="57" y1="56" x2="65" y2="56" strokeWidth="1.5" opacity=".7" />
      <line x1="37" y1="47" x2="30" y2="40" strokeWidth="1.2" opacity=".6" />
      <line x1="53" y1="47" x2="60" y2="40" strokeWidth="1.2" opacity=".6" />
      <path d="M45,68 C45,74 52,78 55,84 C57,88 53,90 50,87" strokeWidth="1.8" />
      {dot(45,56,2.5,0.6)}
    </g>;
    case "Virgo": return <g {...sw}>
      <line x1="33" y1="15" x2="33" y2="73" strokeWidth="2.2" />
      <line x1="33" y1="15" x2="57" y2="15" strokeWidth="2.2" />
      <line x1="57" y1="15" x2="57" y2="49" strokeWidth="2" />
      <path d="M57,49 C57,61 45,65 41,59 C37,53 43,47 51,51" strokeWidth="2" />
      <line x1="25" y1="37" x2="41" y2="37" strokeWidth="1.5" opacity=".6" />
      {dot(33,15,2.5,0.6)}{dot(57,15,2.5)}{dot(51,51,3)}{dot(33,73,2,0.4)}
    </g>;
    case "Libra": return <g {...sw}>
      <path d="M21,41 C21,29 69,29 69,41" strokeWidth="2" />
      <line x1="21" y1="41" x2="69" y2="41" strokeWidth="2.5" />
      <line x1="45" y1="41" x2="45" y2="67" strokeWidth="2" />
      <line x1="27" y1="67" x2="63" y2="67" strokeWidth="2.5" />
      {dot(21,41,2.5,0.7)}{dot(69,41,2.5,0.7)}{dot(45,31,3)}{dot(27,67,2,0.6)}{dot(63,67,2,0.6)}
    </g>;
    case "Scorpio": return <g {...sw}>
      <path d="M16,38 C16,50 22,58 26,58 C30,58 32,50 37,50 C42,50 44,58 48,58 C52,58 57,52 57,46" strokeWidth="2" />
      <path d="M57,46 C60,38 66,32 66,25" strokeWidth="2" />
      <polyline points="59,25 66,25 66,33" strokeWidth="1.8" />
      {dot(16,38,2.5)}{dot(26,58,2,0.7)}{dot(48,58,2,0.7)}{dot(66,25,3)}
    </g>;
    case "Sagittarius": return <g {...sw}>
      <line x1="19" y1="71" x2="71" y2="19" strokeWidth="2.5" />
      <polyline points="51,19 71,19 71,39" strokeWidth="2.2" />
      <line x1="35" y1="59" x2="19" y2="59" strokeWidth="1.5" opacity=".4" />
      {dot(71,19,3.5)}{dot(19,71,2.5,0.6)}
    </g>;
    case "Capricorn": return <g {...sw}>
      <path d="M19,21 C19,21 19,49 33,57 C39,61 45,59 45,59" strokeWidth="2.2" />
      <path d="M45,21 L45,59" strokeWidth="2.2" />
      <path d="M45,59 C49,67 59,69 63,63 C67,57 63,49 55,51" strokeWidth="2" />
      <path d="M19,33 C25,27 39,25 45,29" strokeWidth="1.5" opacity=".6" />
      {dot(19,21,2.5)}{dot(45,21,2.5)}{dot(55,51,3)}
    </g>;
    case "Aquarius": return <g {...sw}>
      <polyline points="18,47 27,37 36,47 45,37 54,47 63,37 72,41" strokeWidth="1.8" />
      <polyline points="18,62 27,52 36,62 45,52 54,62 63,52 72,56" strokeWidth="1.8" />
      {dot(27,37,2.5)}{dot(45,37,2.5)}{dot(63,37,2.5)}
      {dot(27,52,2,0.7)}{dot(45,52,2,0.7)}{dot(63,52,2,0.7)}
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
      {dot(19,45,2.5)}{dot(71,45,2.5)}{dot(45,27,2,0.5)}{dot(45,63,2,0.5)}
    </g>;
    default: return null;
  }
}

// ── Element sigil — 80×80 viewBox ─────────────────────────────────────────────
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
      {dot(40,46,3)}
      <line x1="26" y1="54" x2="54" y2="54" strokeWidth="1.5" opacity=".5" />
    </g>;
    case "Water": return <g {...sw}>
      <circle cx="40" cy="40" r="32" strokeWidth="1.5" opacity=".4" />
      <path d="M40,14 C26,14 16,26 16,40 C16,54 26,66 40,66" strokeWidth="2" opacity=".9" />
      <path d="M40,14 C54,14 64,26 64,40 C64,54 54,66 40,66" strokeWidth="2" opacity=".9" />
      <path d="M40,22 C32,28 28,34 28,40 C28,46 32,52 40,58 C48,52 52,46 52,40 C52,34 48,28 40,22Z"
        fill={`${color}14`} strokeWidth="1" opacity=".6" />
      {dot(40,40,3)}
      <line x1="40" y1="6"  x2="40" y2="10" strokeWidth="1.5" opacity=".5" />
      <line x1="40" y1="70" x2="40" y2="74" strokeWidth="1.5" opacity=".5" />
      <line x1="6"  y1="40" x2="10" y2="40" strokeWidth="1.5" opacity=".5" />
      <line x1="70" y1="40" x2="74" y2="40" strokeWidth="1.5" opacity=".5" />
    </g>;
    case "Earth": return <g {...sw}>
      <rect x="22" y="22" width="36" height="36" transform="rotate(45 40 40)" strokeWidth="2" opacity=".8" />
      <polygon points="40,62 14,18 66,18" strokeWidth="2" fill={`${color}11`} opacity=".9" />
      <line x1="22" y1="36" x2="58" y2="36" strokeWidth="1.8" opacity=".8" />
      {dot(40,40,3)}
    </g>;
    case "Air": return <g {...sw}>
      <circle cx="40" cy="40" r="32" strokeWidth="1.5" strokeDasharray="4 3" opacity=".5" />
      <polygon points="40,10 70,64 10,64" strokeWidth="2" fill={`${color}0D`} opacity=".9" />
      <polygon points="40,24 58,58 22,58" strokeWidth="1.2" opacity=".5" />
      <line x1="40" y1="40" x2="40" y2="10" strokeWidth="1" opacity=".22" />
      <line x1="40" y1="40" x2="70" y2="64" strokeWidth="1" opacity=".22" />
      <line x1="40" y1="40" x2="10" y2="64" strokeWidth="1" opacity=".22" />
      <circle cx="40" cy="40" r="4" strokeWidth="1.5" fill={`${color}33`} />
      {dot(40,40,1.5)}
    </g>;
    default: return null;
  }
}

// ── Constellation data ────────────────────────────────────────────────────────
type ConstellationData = {
  stars: [number, number, number][];
  lines: [number, number, number, number][];
};

const CONSTELLATIONS: Record<string, ConstellationData> = {
  Aries:       { stars: [[92,78,1.5],[120,60,2],[148,68,1.5],[168,52,2],[145,90,1.5]], lines: [[92,78,120,60],[120,60,148,68],[148,68,168,52],[148,68,145,90]] },
  Taurus:      { stars: [[110,72,2],[146,58,1.5],[164,80,1.5],[83,90,1.5],[66,74,1],[134,108,1.5]], lines: [[110,72,146,58],[146,58,164,80],[110,72,83,90],[83,90,66,74],[110,72,134,108]] },
  Gemini:      { stars: [[80,65,2],[110,58,1.5],[140,65,2],[80,100,1.5],[140,100,1.5],[110,80,1]], lines: [[80,65,110,58],[110,58,140,65],[80,65,80,100],[140,65,140,100],[80,100,140,100]] },
  Cancer:      { stars: [[100,80,1.5],[130,72,2],[120,100,1.5],[110,55,1.5],[145,98,1]], lines: [[110,55,130,72],[130,72,120,100],[100,80,130,72],[130,72,145,98]] },
  Leo:         { stars: [[110,70,2.5],[79,86,1.5],[73,116,1.5],[94,138,1.5],[130,116,2],[156,96,1.5]], lines: [[110,70,79,86],[79,86,73,116],[73,116,94,138],[94,138,130,116],[130,116,156,96],[156,96,110,70]] },
  Virgo:       { stars: [[85,60,2],[115,50,2],[148,62,1.5],[168,90,1.5],[145,115,1.5],[100,95,1]], lines: [[85,60,115,50],[115,50,148,62],[148,62,168,90],[168,90,145,115],[115,50,100,95]] },
  Libra:       { stars: [[75,80,1.5],[110,65,2],[145,80,1.5],[110,100,1.5],[75,115,1],[145,115,1]], lines: [[75,80,110,65],[110,65,145,80],[75,80,75,115],[145,80,145,115],[75,115,145,115]] },
  Scorpio:     { stars: [[73,81,2],[104,86,1.5],[130,76,2.5],[157,86,1.5],[140,112,1.5],[120,134,1.5]], lines: [[73,81,104,86],[104,86,130,76],[130,76,157,86],[157,86,140,112],[140,112,120,134]] },
  Sagittarius: { stars: [[75,125,2],[105,100,2],[140,75,1.5],[158,105,1.5],[128,125,1.5]], lines: [[75,125,105,100],[105,100,140,75],[105,100,158,105],[158,105,128,125]] },
  Capricorn:   { stars: [[72,95,1.5],[100,75,2],[132,85,1.5],[158,68,1.5],[168,95,1.5],[120,115,1]], lines: [[72,95,100,75],[100,75,132,85],[132,85,158,68],[158,68,168,95],[132,85,120,115]] },
  Aquarius:    { stars: [[57,96,1.5],[88,81,2],[120,92,1.5],[153,76,2],[177,92,1.5]], lines: [[57,96,88,81],[88,81,120,92],[120,92,153,76],[153,76,177,92]] },
  Pisces:      { stars: [[72,75,1.5],[100,88,2],[128,75,1.5],[158,90,1.5],[88,112,1.5],[148,110,1.5]], lines: [[72,75,100,88],[100,88,128,75],[128,75,158,90],[88,112,148,110]] },
};

// ── ZodiacBadgeCard ───────────────────────────────────────────────────────────
function ZodiacBadgeCard({
  zodiac, element, aura, edition, season, active = false,
}: {
  zodiac: string; element: string; aura: string; edition: number; season?: string; active?: boolean;
}) {
  const [twinkling] = useState(() =>
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
  const constellation = CONSTELLATIONS[zodiac] ?? CONSTELLATIONS.Taurus;
  const starOpacities = [0.7, 0.5, 0.5, 0.4, 0.4, 0.6];
  const elementBg: Record<string, string> = {
    Fire: "bg-gradient-to-b from-[#1a0808] to-[#0d0505]",
    Water: "bg-gradient-to-b from-[#081a12] to-[#050d0a]",
    Earth: "bg-gradient-to-b from-[#120a1a] to-[#09050d]",
    Air: "bg-gradient-to-b from-[#08111a] to-[#050a0d]",
  };
  const bgClass = elementBg[element] ?? "bg-gradient-to-b from-[#0d0818] to-[#060410]";

  return (
    <div
      style={{
        ...auraVars,
        width: 220,
        height: 330,
        borderRadius: 16,
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${active ? aura : "rgba(255,255,255,0.08)"}`,
        boxShadow: active
          ? `0 0 24px rgba(${hexToRgb(aura).join(",")},0.5), 0 0 8px rgba(${hexToRgb(aura).join(",")},0.2)`
          : "0 4px 24px rgba(0,0,0,0.5)",
        transition: "box-shadow 0.3s, border-color 0.3s",
        flexShrink: 0,
      }}
      className={bgClass}
    >
      {/* Twinkling stars */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {twinkling.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: s.w,
              height: s.h,
              top: `${s.t}%`,
              left: `${s.l}%`,
              borderRadius: "50%",
              background: "white",
              opacity: 0.6,
              animation: `pulse ${s.d}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Constellation */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.35 }}
        viewBox="0 0 220 330"
      >
        {constellation.stars.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="white"
            opacity={starOpacities[i % starOpacities.length]} />
        ))}
        {constellation.lines.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="white" strokeWidth=".4" opacity=".2" />
        ))}
      </svg>

      {/* Badge label */}
      <div style={{
        position: "absolute", top: 14, left: 14,
        fontFamily: "monospace", fontSize: 9,
        letterSpacing: "0.14em", textTransform: "uppercase",
        color: aura, opacity: 0.7,
      }}>
        HumbleTrust
      </div>

      {/* Shield + glyph */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -75%)" }}>
        <svg width="110" height="132" viewBox="0 0 90 108" fill="none">
          <path d="M45,3 L85,18 L85,58 C85,80 45,105 45,105 C45,105 5,80 5,58 L5,18 Z"
            stroke={aura} strokeWidth="2" fill={`${aura}0D`} />
          <path d="M45,13 L75,26 L75,58 C75,75 45,95 45,95 C45,95 15,75 15,58 L15,26 Z"
            stroke={aura} strokeWidth="1.2" fill="none" opacity=".55" />
          <line x1="16" y1="48" x2="74" y2="48" stroke={aura} strokeWidth="1" opacity=".28" />
          {/* HT seal — кропнутый RGBA лого за знаком гороскопа */}
          <image href="/HT_NFT_seal_cropped.png" x="16" y="20" width="58" height="72" opacity="0.6" preserveAspectRatio="xMidYMid meet" />
          {/* Знак гороскопа поверх — оба видны */}
          <g opacity="0.55">
            <ShieldGlyph zodiac={zodiac} color={aura} />
          </g>
          <circle cx="45" cy="3"   r="3"   fill={aura} />
          <circle cx="85" cy="18"  r="2.5" fill={aura} opacity=".8" />
          <circle cx="85" cy="58"  r="2"   fill={aura} opacity=".6" />
          <circle cx="45" cy="105" r="3"   fill={aura} />
          <circle cx="5"  cy="58"  r="2"   fill={aura} opacity=".6" />
          <circle cx="5"  cy="18"  r="2.5" fill={aura} opacity=".8" />
          <circle cx="78" cy="12" r="11" fill="#05070F" stroke="#00FF94" strokeWidth="1.5" />
          <circle cx="78" cy="12" r="8"  stroke="#00FF94" strokeWidth=".8"
            fill="rgba(0,255,148,.08)" opacity=".5" />
          <polyline points="72,12 77,18 86,6" stroke="#00FF94" strokeWidth="2"
            fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="86" cy="6" r="1.8" fill="#00FF94" />
        </svg>
      </div>

      {/* Element sigil */}
      <div style={{ position: "absolute", top: 14, right: 14 }}>
        <svg width="36" height="36" viewBox="0 0 80 80" fill="none">
          <ElementSigil element={element} color={aura} />
        </svg>
      </div>

      {/* Footer info */}
      <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: aura, letterSpacing: "0.05em" }}>
          {zodiac}
        </div>
        <div style={{ width: "60%", margin: "6px auto", height: 1, background: `${aura}44` }} />
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 3 }}>
          {element}{season ? ` · ${season}` : ""}
        </div>
        <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(255,255,255,0.3)" }}>
          Edition #{String(edition).padStart(3, "0")}
        </div>
      </div>
    </div>
  );
}

// ── Badge Modal ───────────────────────────────────────────────────────────────
const AURA_PALETTE = [
  "#9945FF","#FF3C6B","#00D4FF","#FFDB2B","#39FF14","#DC1FFF",
  "#FF7A2F","#14F195","#1466FF","#FF4DCB","#00FFD1","#FFB800",
  "#FF2D55","#5E5CE6","#30D158","#FF6B35","#BF5AF2","#32D74B",
  "#0A84FF","#FF453A","#AC8E68","#636366","#48CAE4","#F72585",
  "#7209B7","#3A0CA3","#4361EE","#4CC9F0","#06D6A0","#EF233C",
  "#8338EC","#FB5607",
];

function getAuraColor(wallet: string) {
  let hash = 0;
  for (let i = 0; i < wallet.length; i++) {
    hash = ((hash << 5) - hash) + wallet.charCodeAt(i);
    hash |= 0;
  }
  return AURA_PALETTE[Math.abs(hash) % AURA_PALETTE.length];
}

const ZODIAC_DATES = [
  { name: "Capricorn",   element: "Earth", start: [12,22], end: [1,19]  },
  { name: "Aquarius",    element: "Air",   start: [1,20],  end: [2,18]  },
  { name: "Pisces",      element: "Water", start: [2,19],  end: [3,20]  },
  { name: "Aries",       element: "Fire",  start: [3,21],  end: [4,19]  },
  { name: "Taurus",      element: "Earth", start: [4,20],  end: [5,20]  },
  { name: "Gemini",      element: "Air",   start: [5,21],  end: [6,20]  },
  { name: "Cancer",      element: "Water", start: [6,21],  end: [7,22]  },
  { name: "Leo",         element: "Fire",  start: [7,23],  end: [8,22]  },
  { name: "Virgo",       element: "Earth", start: [8,23],  end: [9,22]  },
  { name: "Libra",       element: "Air",   start: [9,23],  end: [10,22] },
  { name: "Scorpio",     element: "Water", start: [10,23], end: [11,21] },
  { name: "Sagittarius", element: "Fire",  start: [11,22], end: [12,21] },
];

function getZodiacToday() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  for (const z of ZODIAC_DATES) {
    const [sm, sd] = z.start as [number, number];
    const [em, ed] = z.end as [number, number];
    if (sm > em) {
      if ((m === sm && d >= sd) || (m === em && d <= ed)) return z;
    } else {
      if ((m === sm && d >= sd) || (m > sm && m < em) || (m === em && d <= ed)) return z;
    }
  }
  return ZODIAC_DATES[0];
}

type BadgeData = {
  wallet: string; zodiac: string; element: string;
  aura_color: string; edition: number; status: string;
  minted_at: string; cooldown_until?: string; badge_mint?: string;
};
type Eligibility =
  | { can_mint: true; reason: null | "cooldown_expired"; badge: BadgeData | null }
  | { can_mint: false; reason: "already_owns"; badge: BadgeData }
  | { can_mint: false; reason: "cooldown"; days_left: number; cooldown_until: string; badge: BadgeData }
  | { can_mint: false; reason: "not_premium_creator"; badge: BadgeData | null };

function BadgeModal({ onClose, goLaunch }: { onClose: () => void; goLaunch?: () => void }) {
  const walletAdapter = useWallet();
  const { publicKey } = walletAdapter;
  const walletStr = publicKey?.toBase58() ?? "";

  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [minting, setMinting] = useState(false);
  const [mintResult, setMintResult] = useState<{ badge_mint: string; zodiac: string } | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const preview = getZodiacToday();
  const previewColor = walletStr ? getAuraColor(walletStr) : "#9945FF";

  const fetchEligibility = useCallback(async () => {
    if (!walletStr) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await fetch(`/api/badges/eligibility?wallet=${walletStr}`, { signal: ctrl.signal });
      const data = await res.json();
      setEligibility(data);
    } catch (e: any) {
      if (e.name !== "AbortError") setError("Failed to load badge data");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [walletStr]);

  useEffect(() => {
    void fetchEligibility();
    return () => { abortRef.current?.abort(); };
  }, [fetchEligibility]);

  const handleMint = async () => {
    setMinting(true);
    setError("");
    try {
      const result = await mintBadgeNft(walletAdapter);
      setMintResult({ badge_mint: result.badge_mint, zodiac: result.zodiac });
      await fetchEligibility();
    } catch (e: any) {
      setError(e.message ?? "Mint failed");
    } finally {
      setMinting(false);
      setConfirming(false);
    }
  };

  const badge = eligibility && "badge" in eligibility ? eligibility.badge : null;
  const badgeColor = badge?.aura_color ?? previewColor;
  const badgeZodiac = badge?.zodiac ?? preview.name;
  const badgeElement = badge?.element ?? preview.element;
  const mintDone = mintResult !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md"
      >
        <GlassPanel className="p-6" glow="purple">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <span className="font-bold text-white text-lg">HumbleTrust Badge</span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all"
            >
              ✕
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-[#B026FF]/30 border-t-[#B026FF] animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-6">
                <ZodiacBadgeCard
                  zodiac={badgeZodiac}
                  element={badgeElement}
                  aura={badgeColor}
                  edition={badge?.edition ?? 0}
                  active
                />
              </div>

              {mintDone && (
                <div className="p-4 rounded-lg bg-[#00FF41]/10 border border-[#00FF41]/30 mb-4">
                  <p className="text-[#00FF41] text-sm font-medium mb-2">
                    Badge minted on-chain! Welcome, {mintResult.zodiac}.
                  </p>
                  <a
                    href={`https://explorer.solana.com/address/${mintResult.badge_mint}?cluster=devnet`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[#00FF41] text-xs underline"
                  >
                    View on Solana Explorer →
                  </a>
                </div>
              )}

              {!mintDone && eligibility?.reason === "already_owns" && (
                <div className="p-4 rounded-lg bg-[#00FF41]/10 border border-[#00FF41]/30 mb-4">
                  <p className="text-[#00FF41] text-sm font-medium">
                    ✓ You own this badge
                  </p>
                  <p className="text-white/40 text-xs mt-1">
                    Since {new Date(badge!.minted_at).toLocaleDateString()}
                  </p>
                  {badge?.badge_mint && (
                    <a
                      href={`https://explorer.solana.com/address/${badge.badge_mint}?cluster=devnet`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[#00FF41] text-xs underline block mt-2"
                    >
                      View on Solana Explorer →
                    </a>
                  )}
                </div>
              )}

              {!mintDone && eligibility?.reason === "cooldown" && (
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 mb-4">
                  <p className="text-yellow-400 text-sm font-bold mb-1">Cooldown active</p>
                  <p className="text-white/60 text-sm">
                    {(eligibility as any).days_left} days until you can mint again
                  </p>
                  <p className="text-white/40 text-xs mt-1">
                    Available {new Date((eligibility as any).cooldown_until).toLocaleDateString()}
                  </p>
                </div>
              )}

              {!mintDone && eligibility?.reason === "not_premium_creator" && (
                <div className="p-4 rounded-lg bg-[#B026FF]/10 border border-[#B026FF]/30 mb-4">
                  <p className="text-[#B026FF] text-sm font-bold mb-1">Premium Required</p>
                  <p className="text-white/50 text-sm mb-3">
                    Zodiac Badge NFTs are exclusively available to Premium token launchers. Launch a Premium token first to unlock your badge.
                  </p>
                  <button
                    onClick={() => { onClose(); goLaunch?.(); }}
                    className="px-4 py-2 rounded-lg border text-sm font-medium transition-all"
                    style={{ borderColor: badgeColor, color: badgeColor }}
                  >
                    Launch Premium Token
                  </button>
                </div>
              )}

              {!mintDone && eligibility?.can_mint && !confirming && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <span className="text-white/50 text-sm">Mint price</span>
                    <span className="text-[#00FF41] font-bold font-mono">0.2 SOL</span>
                  </div>
                  {eligibility.reason === "cooldown_expired" && (
                    <p className="text-white/40 text-xs">Cooldown expired — you can mint again</p>
                  )}
                  {!eligibility.badge && (
                    <p className="text-white/40 text-xs">
                      Your badge: <b className="text-white">{preview.name}</b> · {preview.element} (today's date)
                    </p>
                  )}
                  <button
                    onClick={() => setConfirming(true)}
                    className="w-full py-3 rounded-lg border font-bold transition-all hover:opacity-90"
                    style={{ borderColor: badgeColor, color: badgeColor, background: `${badgeColor}14` }}
                  >
                    Mint Badge · 0.2 SOL
                  </button>
                </div>
              )}

              {!mintDone && eligibility?.can_mint && confirming && (
                <div className="space-y-3">
                  <p className="text-white font-semibold text-center mb-2">Confirm mint</p>
                  <div className="p-4 rounded-lg bg-white/5 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/50">Zodiac</span>
                      <span className="font-bold" style={{ color: badgeColor }}>{preview.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Element</span>
                      <span className="text-white">{preview.element}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Price</span>
                      <span className="text-[#00FF41] font-bold">0.2 SOL</span>
                    </div>
                    <p className="text-white/30 text-xs pt-2">
                      A Metaplex NFT will be minted on Solana devnet and visible in Phantom.
                      This action is irreversible. A 30-day cooldown applies if you sell the badge.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleMint}
                      disabled={minting}
                      className="flex-1 py-3 rounded-lg border font-bold transition-all disabled:opacity-50"
                      style={{ borderColor: badgeColor, color: badgeColor, background: `${badgeColor}14` }}
                    >
                      {minting ? "Minting… (sign in Phantom)" : "Confirm & Mint"}
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      disabled={minting}
                      className="px-4 py-3 rounded-lg border border-white/20 text-white/50 hover:border-white/40 transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
            </>
          )}
        </GlassPanel>
      </motion.div>
    </div>
  );
}

// ── Page data ─────────────────────────────────────────────────────────────────
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

// ── NftPage ───────────────────────────────────────────────────────────────────
export function NftPage({ goLaunch }: { goLaunch?: () => void } = {}) {
  const { connected } = useWallet();
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const todayZodiac = useMemo(() => getZodiacToday(), []);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <GlassPanel className="px-5 py-12 md:py-20 md:px-8 text-center" glow="purple">
          <div className="text-xs font-mono tracking-widest uppercase text-[#B026FF]/70 mb-3">
            Zodiac Badge NFT
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
            <span className="text-[#B026FF]" style={{ textShadow: "0 0 40px rgba(176,38,255,0.45)" }}>
              Your on-chain identity,{" "}
            </span>
            <span className="text-[#00FF41]" style={{ textShadow: "0 0 30px rgba(0,255,65,0.4)" }}>
              written in the stars
            </span>
          </h1>
          <p className="text-white/50 max-w-xl mx-auto mb-6 leading-relaxed">
            Zodiac Badge NFTs are unique, on-chain shields awarded exclusively to Premium token creators on HumbleTrust.
            Zodiac from launch date · aura from wallet address · element from the stars.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {connected ? (
              <button
                onClick={() => setBadgeOpen(true)}
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-[#B026FF] to-[#8a1ecc] text-white font-bold hover:shadow-[0_0_30px_rgba(176,38,255,0.4)] transition-all"
              >
                Mint Your Badge
              </button>
            ) : (
              <>
                <WalletMultiButton />
                <span className="text-white/40 text-sm">Connect wallet to mint</span>
              </>
            )}
          </div>
        </GlassPanel>
      </motion.div>

      {/* All 12 signs grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="mb-5">
          <div className="text-xs font-mono tracking-widest uppercase text-[#00FF41]/60 mb-1">All 12 Signs</div>
          <h2 className="text-2xl font-bold text-white mb-1">Every zodiac, every element</h2>
          <p className="text-white/40 text-sm">Your badge zodiac is locked to the calendar date of your token launch.</p>
        </div>
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 justify-items-center overflow-hidden">
          {ZODIACS.map((z, i) => {
            const isActive = z.name === todayZodiac.name;
            return (
              <motion.div
                key={z.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.04 }}
                className="w-full flex justify-center min-w-0"
              >
                <GlassPanel
                  className="p-2 w-full max-w-[220px]"
                  hover
                  glow={isActive ? "green" : "purple"}
                >
                  <div className="flex justify-center min-w-0 overflow-hidden">
                  <ZodiacBadgeCard
                    zodiac={z.name}
                    element={z.element}
                    aura={ELEMENT_COLOR[z.element]}
                    edition={i + 1}
                    season={z.season}
                    active={isActive}
                  />
                  </div>
                  {isActive && (
                    <div className="text-center mt-2">
                      <span className="text-[11px] font-mono uppercase tracking-widest text-[#00FF41]">
                        Today's sign
                      </span>
                    </div>
                  )}
                </GlassPanel>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Aura uniqueness */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="mb-5">
          <div className="text-xs font-mono tracking-widest uppercase text-[#B026FF]/60 mb-1">Aura Uniqueness</div>
          <h2 className="text-2xl font-bold text-white mb-1">Same zodiac, different wallet — different badge</h2>
          <p className="text-white/40 text-sm max-w-lg">
            The aura color is derived deterministically from your wallet address. Two Scorpios, five different wallets — five completely different badges.
          </p>
        </div>

        {SAME_SIGN_ROWS.map((row, rowIdx) => (
          <motion.div
            key={row.sign}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + rowIdx * 0.1 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <span
                className="text-xs font-mono uppercase tracking-widest"
                style={{ color: ELEMENT_COLOR[row.element] }}
              >
                {row.element}
              </span>
              <span className="text-white/30">·</span>
              <span className="font-bold text-white">{row.sign}</span>
              <GlassPanel className="px-2 py-0.5">
                <span className="text-xs font-mono text-white/40">
                  {row.badges.length} different wallets
                </span>
              </GlassPanel>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory">
              {row.badges.map((b, i) => (
                <div key={i} className="flex-shrink-0 snap-center">
                  <GlassPanel className="p-2" hover glow="purple">
                    <ZodiacBadgeCard
                      zodiac={row.sign}
                      element={row.element}
                      aura={b.aura}
                      edition={b.edition}
                    />
                  </GlassPanel>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="mb-5">
          <div className="text-xs font-mono tracking-widest uppercase text-[#00FF41]/60 mb-1">How it works</div>
          <h2 className="text-2xl font-bold text-white">Three steps from launch to badge</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.08 }}
            >
              <GlassPanel className="p-6 relative overflow-hidden" hover glow="green">
                <div className="absolute top-4 right-5 text-4xl font-bold font-mono text-[#00FF41]/10 select-none">
                  {s.num}
                </div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#00FF41] mb-2">
                  Step {s.num}
                </div>
                <h3 className="font-bold text-white text-base mb-2">{s.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{s.body}</p>
              </GlassPanel>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Pricing */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="mb-5">
          <div className="text-xs font-mono tracking-widest uppercase text-[#B026FF]/60 mb-1">Pricing</div>
          <h2 className="text-2xl font-bold text-white">Transparent mint pricing</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { val: "0.2 SOL",  label: "Standard mint",   note: "Any Premium token creator" },
            { val: "0.5 SOL",  label: "Genesis mint",    note: "First 100 mints per zodiac sign" },
            { val: "30 days",  label: "Resell cooldown", note: "After selling, wait 30 days to re-mint" },
          ].map((r, i) => (
            <motion.div
              key={r.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + i * 0.08 }}
            >
              <GlassPanel className="p-6 text-center" hover glow={i === 0 ? "green" : "purple"}>
                <div className="text-3xl font-bold font-mono text-[#00FF41] mb-2">{r.val}</div>
                <div className="font-bold text-white mb-1">{r.label}</div>
                <p className="text-white/40 text-sm">{r.note}</p>
              </GlassPanel>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* FAQ accordion */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="mb-5">
          <div className="text-xs font-mono tracking-widest uppercase text-[#00FF41]/60 mb-1">FAQ</div>
          <h2 className="text-2xl font-bold text-white">Common questions</h2>
        </div>
        <div className="space-y-3 max-w-2xl">
          {FAQ.map((item, i) => (
            <GlassPanel
              key={item.q}
              className={cn("overflow-hidden transition-all", openFaq === i && "border-[#00FF41]/30")}
              hover
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 md:p-5 text-left"
              >
                <span className={cn("font-semibold text-sm", openFaq === i ? "text-[#00FF41]" : "text-white")}>
                  {item.q}
                </span>
                <span
                  className={cn(
                    "text-white/40 transition-transform duration-300 text-lg",
                    openFaq === i && "rotate-45"
                  )}
                >
                  +
                </span>
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-4 pb-4 md:px-5 md:pb-5 text-white/50 text-sm leading-relaxed">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassPanel>
          ))}
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
      >
        <GlassPanel className="p-8 text-center" glow="purple">
          <div className="text-xs font-mono tracking-widest uppercase text-[#B026FF]/70 mb-3">
            Ready to mint?
          </div>
          <h2 className="text-3xl font-bold text-[#B026FF] mb-3" style={{ textShadow: "0 0 40px rgba(176,38,255,0.45)" }}>
            Claim your Zodiac Badge
          </h2>
          <p className="text-white/50 max-w-md mx-auto mb-6">
            Premium token creators can mint their unique on-chain shield.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap mb-8">
            {connected ? (
              <button
                onClick={() => setBadgeOpen(true)}
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-[#B026FF] to-[#8a1ecc] text-white font-bold hover:shadow-[0_0_30px_rgba(176,38,255,0.4)] transition-all"
              >
                Mint My Zodiac Badge
              </button>
            ) : (
              <WalletMultiButton />
            )}
          </div>
          <div className="flex justify-center gap-8 flex-wrap">
            {[
              ["0.2 SOL", "Standard"],
              ["0.5 SOL", "Genesis"],
              ["30 days", "Cooldown"],
              ["1 per wallet", "Max"],
            ].map(([v, l]) => (
              <div key={l} className="text-center">
                <div className="font-bold font-mono text-[#00FF41] text-lg">{v}</div>
                <div className="text-white/40 text-xs mt-0.5">{l}</div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </motion.div>

      {/* Badge modal */}
      <AnimatePresence>
        {badgeOpen && (
          <BadgeModal onClose={() => setBadgeOpen(false)} goLaunch={goLaunch} />
        )}
      </AnimatePresence>
    </div>
  );
}

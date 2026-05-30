import { useState, useEffect } from "react";

// HumbleTrust brand hexagon shape — pointy-top, matches LaunchPage token display
const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

// ── HexAvatar ─────────────────────────────────────────────────────────────────
// Token icon in a hexagon. Drop-in replacement for rounded-full token circles.

interface HexAvatarProps {
  src?: string | null;
  label: string;         // token symbol / name initial
  size?: number;         // px, default 40
  color?: string;        // border accent, default #00FF41
  gradient?: boolean;    // use purple→green gradient border (for launched tokens)
}

export function HexAvatar({ src, label, size = 40, color = "#00FF41", gradient = false }: HexAvatarProps) {
  const [imgOk, setImgOk] = useState(true);
  const initials = label?.slice(0, 2).toUpperCase() || "?";
  const fontSize  = Math.round(size * 0.28);

  const borderStyle = gradient
    ? { background: "linear-gradient(135deg, #B026FF, #00FF41, #B026FF)" }
    : { background: `linear-gradient(135deg, ${color}80, ${color}20)` };

  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      {/* border layer */}
      <div style={{ clipPath: HEX_CLIP, position: "absolute", inset: 0, padding: 1.5, ...borderStyle }}>
        {/* inner fill */}
        <div
          style={{ clipPath: HEX_CLIP, width: "100%", height: "100%", overflow: "hidden" }}
          className="bg-[#0d0d18] flex items-center justify-center"
        >
          {src && imgOk ? (
            <img
              src={src}
              alt={label}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={() => setImgOk(false)}
            />
          ) : (
            <span style={{ fontSize, color, fontWeight: 700, fontFamily: "monospace", lineHeight: 1 }}>
              {initials}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── HexScore ──────────────────────────────────────────────────────────────────
// Score display ring, hexagon-shaped. Drop-in replacement for ScoreRing.
// Same animated count-up + stroke-dasharray fill animation.

interface HexScoreProps {
  score: number;
  color: string;
  size?: number; // px, default 144 (w-36)
}

// Hexagon path in a 100x100 viewbox matching HEX_CLIP proportions
// Perimeter ≈ 4 * 52.8 + 2 * 46 = 303
const HEX_PATH = "M 50,3 L 97,27 L 97,73 L 50,97 L 3,73 L 3,27 Z";
const HEX_PERIM = 303;

export function HexScore({ score, color, size = 144 }: HexScoreProps) {
  const [mounted, setMounted]     = useState(false);
  const [displayed, setDisplayed] = useState(0);

  const targetDash = Math.max(0, Math.min(1, score / 100)) * HEX_PERIM;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let start: number | null = null;
    const duration = 900;
    const tick = (now: number) => {
      if (start === null) start = now;
      const pct   = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - pct, 3);
      setDisplayed(Math.round(eased * score));
      if (pct < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [mounted, score]);

  const glowFilter = `drop-shadow(0 0 8px ${color}60)`;
  const innerPath  = "M 50,9 L 91,31 L 91,69 L 50,91 L 9,69 L 9,31 Z";

  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
      {/* background track */}
      <path d={HEX_PATH} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4"
        strokeLinejoin="round" />
      {/* inner glow fill */}
      <path d={innerPath} fill={`${color}0a`} />
      {/* animated progress stroke */}
      <path d={HEX_PATH} fill="none" stroke={color} strokeWidth="4"
        strokeLinejoin="round" strokeLinecap="round"
        strokeDasharray={HEX_PERIM}
        strokeDashoffset={mounted ? HEX_PERIM - targetDash : HEX_PERIM}
        style={{
          transition: mounted ? "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" : "none",
          filter: glowFilter,
        }}
      />
      {/* score number */}
      <text x="50" y="47" textAnchor="middle" dominantBaseline="middle"
        fill={color} fontFamily="monospace, Consolas, 'Courier New'"
        fontSize="26" fontWeight="800">
        {displayed}
      </text>
      <text x="50" y="63" textAnchor="middle" dominantBaseline="middle"
        fill="rgba(255,255,255,0.25)" fontFamily="monospace"
        fontSize="9">
        /100
      </text>
    </svg>
  );
}

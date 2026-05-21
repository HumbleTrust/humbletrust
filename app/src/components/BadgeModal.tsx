import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

// ── Palette & zodiac (mirrors backend _zodiac.js) ──────────────────────────
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

const ZODIACS = [
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
  for (const z of ZODIACS) {
    const [sm, sd] = z.start as [number,number];
    const [em, ed] = z.end as [number,number];
    if (sm > em) {
      if ((m === sm && d >= sd) || (m === em && d <= ed)) return z;
    } else {
      if ((m === sm && d >= sd) || (m > sm && m < em) || (m === em && d <= ed)) return z;
    }
  }
  return ZODIACS[0];
}

// ── Badge SVG ──────────────────────────────────────────────────────────────
function BadgeSVG({ color, zodiac, element, size = 200 }: {
  color: string; zodiac: string; element: string; size?: number;
}) {
  const r = `rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)}`;

  const zodiacPath: Record<string,JSX.Element> = {
    Taurus: (
      <>
        <circle cx="45" cy="65" r="16" stroke={color} strokeWidth="1.8" fill="none"/>
        <path d="M31,55 C25,46 18,33 22,23" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <path d="M59,55 C65,46 72,33 68,23" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <circle cx="22" cy="23" r="2.5" fill={color}/>
        <circle cx="68" cy="23" r="2.5" fill={color}/>
        <circle cx="45" cy="49" r="2" fill={color} opacity=".5"/>
      </>
    ),
    Aries: (
      <>
        <circle cx="45" cy="68" r="11" stroke={color} strokeWidth="1.8" fill="none"/>
        <path d="M36,61 C30,52 22,40 25,29" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <path d="M54,61 C60,52 68,40 65,29" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <circle cx="25" cy="29" r="2.5" fill={color}/>
        <circle cx="65" cy="29" r="2.5" fill={color}/>
      </>
    ),
    Gemini: (
      <>
        <line x1="28" y1="28" x2="28" y2="80" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
        <line x1="62" y1="28" x2="62" y2="80" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M28,28 C28,20 62,20 62,28" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M28,80 C28,88 62,88 62,80" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"/>
        <line x1="28" y1="54" x2="62" y2="54" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity=".6"/>
        <circle cx="28" cy="28" r="2.5" fill={color}/><circle cx="62" cy="28" r="2.5" fill={color}/>
        <circle cx="28" cy="80" r="2.5" fill={color}/><circle cx="62" cy="80" r="2.5" fill={color}/>
      </>
    ),
    Cancer: (
      <>
        <circle cx="45" cy="54" r="30" stroke={color} strokeWidth="1" fill="none" opacity=".2" strokeDasharray="3 4"/>
        <path d="M66,50 C72,42 68,28 56,26 C44,24 36,34 40,44 C44,54 56,54 56,46 C56,40 50,38 46,42" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M24,58 C18,66 22,80 34,82 C46,84 54,74 50,64 C46,54 34,54 34,62 C34,68 40,70 44,66" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"/>
        <circle cx="46" cy="42" r="3" fill={color}/><circle cx="44" cy="66" r="3" fill={color}/>
      </>
    ),
    Leo: (
      <>
        <circle cx="45" cy="40" r="14" stroke={color} strokeWidth="1.8" fill="none"/>
        <line x1="45" y1="26" x2="45" y2="18" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity=".8"/>
        <line x1="31" y1="40" x2="22" y2="40" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity=".7"/>
        <line x1="59" y1="40" x2="68" y2="40" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity=".7"/>
        <line x1="35" y1="30" x2="28" y2="23" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity=".6"/>
        <line x1="55" y1="30" x2="62" y2="23" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity=".6"/>
        <path d="M45,54 C45,62 53,66 56,74 C59,80 54,82 51,78" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"/>
        <circle cx="45" cy="40" r="3" fill={color} opacity=".6"/>
        <circle cx="45" cy="18" r="2.5" fill={color}/>
      </>
    ),
    Virgo: (
      <>
        <line x1="28" y1="20" x2="28" y2="80" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
        <line x1="28" y1="20" x2="54" y2="20" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
        <line x1="54" y1="20" x2="54" y2="54" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <path d="M54,54 C54,66 42,70 38,64 C34,58 40,52 48,56" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"/>
        <line x1="20" y1="42" x2="36" y2="42" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity=".6"/>
        <circle cx="54" cy="20" r="2.5" fill={color}/>
        <circle cx="48" cy="56" r="3" fill={color}/>
      </>
    ),
    Libra: (
      <>
        <path d="M18,50 C18,38 72,38 72,50" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"/>
        <line x1="18" y1="50" x2="72" y2="50" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="45" y1="50" x2="45" y2="72" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <line x1="24" y1="72" x2="66" y2="72" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="45" cy="38" r="3" fill={color}/>
        <circle cx="18" cy="50" r="2.5" fill={color} opacity=".7"/>
        <circle cx="72" cy="50" r="2.5" fill={color} opacity=".7"/>
      </>
    ),
    Scorpio: (
      <>
        <path d="M12,34 C12,50 20,60 24,60 C28,60 30,50 36,50 C42,50 44,60 48,60 C52,60 58,52 58,46" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <path d="M58,46 C62,36 70,30 70,22" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <polyline points="61,22 70,22 70,31" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="34" r="3" fill={color}/>
        <circle cx="70" cy="22" r="3.5" fill={color}/>
      </>
    ),
    Sagittarius: (
      <>
        <line x1="16" y1="74" x2="68" y2="22" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
        <polyline points="48,22 68,22 68,42" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="32" y1="62" x2="16" y2="62" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity=".4"/>
        <circle cx="68" cy="22" r="3.5" fill={color}/>
        <circle cx="16" cy="74" r="2.5" fill={color} opacity=".6"/>
      </>
    ),
    Capricorn: (
      <>
        <path d="M16,24 C16,24 16,52 30,60 C36,64 42,62 42,62" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <path d="M42,24 L42,62" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M42,62 C46,70 56,72 60,66 C64,60 60,52 52,54" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M16,36 C22,30 36,28 42,32" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity=".6"/>
        <circle cx="16" cy="24" r="2.5" fill={color}/><circle cx="42" cy="24" r="2.5" fill={color}/>
        <circle cx="52" cy="54" r="3" fill={color}/>
      </>
    ),
    Aquarius: (
      <>
        <polyline points="10,40 22,26 34,40 46,26 58,40 70,26 74,30" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="10,62 22,48 34,62 46,48 58,62 70,48 74,52" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="22" cy="26" r="3" fill={color}/><circle cx="46" cy="26" r="3" fill={color}/><circle cx="70" cy="26" r="3" fill={color}/>
        <circle cx="22" cy="48" r="2.5" fill={color} opacity=".7"/><circle cx="46" cy="48" r="2.5" fill={color} opacity=".7"/><circle cx="70" cy="48" r="2.5" fill={color} opacity=".7"/>
      </>
    ),
    Pisces: (
      <>
        <path d="M16,54 C16,36 74,36 74,54" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <path d="M16,54 C16,72 74,72 74,54" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <line x1="16" y1="54" x2="74" y2="54" stroke={color} strokeWidth="1.8" strokeLinecap="round" opacity=".7"/>
        <polyline points="8,48 16,54 8,60" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="82,48 74,54 82,60" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="16" cy="54" r="2.5" fill={color}/><circle cx="74" cy="54" r="2.5" fill={color}/>
      </>
    ),
  };

  const elementSigil: Record<string,JSX.Element> = {
    Fire: (
      <>
        <polygon points="40,6 72,68 8,68" stroke={color} strokeWidth="2" fill="none" opacity=".9"/>
        <polygon points="40,20 62,62 18,62" stroke={color} strokeWidth="1.2" fill="none" opacity=".7"/>
        <circle cx="40" cy="46" r="3" fill={color}/>
        <line x1="26" y1="54" x2="54" y2="54" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
      </>
    ),
    Water: (
      <>
        <circle cx="40" cy="40" r="32" stroke={color} strokeWidth="1.5" fill="none" opacity=".4"/>
        <path d="M40,14 C26,14 16,26 16,40 C16,54 26,66 40,66" stroke={color} strokeWidth="2" fill="none" opacity=".9"/>
        <path d="M40,14 C54,14 64,26 64,40 C64,54 54,66 40,66" stroke={color} strokeWidth="2" fill="none" opacity=".9"/>
        <path d="M40,22 C32,28 28,34 28,40 C28,46 32,52 40,58 C48,52 52,46 52,40 C52,34 48,28 40,22Z" fill="none" stroke={color} strokeWidth="1" opacity=".6"/>
        <circle cx="40" cy="40" r="3" fill={color}/>
      </>
    ),
    Earth: (
      <>
        <rect x="22" y="22" width="36" height="36" transform="rotate(45 40 40)" stroke={color} strokeWidth="2" fill="none" opacity=".8"/>
        <polygon points="40,62 14,18 66,18" stroke={color} strokeWidth="2" fill="none" opacity=".85"/>
        <line x1="22" y1="36" x2="58" y2="36" stroke={color} strokeWidth="1.8" strokeLinecap="round" opacity=".8"/>
        <circle cx="40" cy="40" r="3" fill={color}/>
      </>
    ),
    Air: (
      <>
        <circle cx="40" cy="40" r="32" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" fill="none" opacity=".5"/>
        <polygon points="40,10 70,64 10,64" stroke={color} strokeWidth="2" fill="none" opacity=".9"/>
        <polygon points="40,24 58,58 22,58" stroke={color} strokeWidth="1.2" fill="none" opacity=".5"/>
        <circle cx="40" cy="40" r="4" stroke={color} strokeWidth="1.5" fill="none"/>
        <circle cx="40" cy="40" r="1.5" fill={color}/>
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size * 1.22}
      viewBox="0 0 90 110"
      fill="none"
      style={{ filter: `drop-shadow(0 0 14px ${r},.55)) drop-shadow(0 0 30px ${r},.25))` }}
    >
      {/* shield outer */}
      <path d="M45,3 L85,18 L85,60 C85,82 45,107 45,107 C45,107 5,82 5,60 L5,18 Z"
        stroke={color} strokeWidth="2" fill={`${r},.05)`}/>
      {/* shield inner */}
      <path d="M45,13 L75,27 L75,60 C75,77 45,97 45,97 C45,97 15,77 15,60 L15,27 Z"
        stroke={color} strokeWidth="1" fill="none" opacity=".45"/>
      {/* fess line */}
      <line x1="16" y1="50" x2="74" y2="50" stroke={color} strokeWidth=".8" opacity=".22"/>

      {/* zodiac glyph scaled to fit upper shield */}
      <g transform="scale(0.78) translate(12, 8)">
        {zodiacPath[zodiac] ?? zodiacPath["Taurus"]}
      </g>

      {/* element sigil — lower shield */}
      <g transform="scale(0.32) translate(97, 218)">
        {elementSigil[element] ?? elementSigil["Earth"]}
      </g>

      {/* shield corner nodes */}
      <circle cx="45" cy="3"   r="3"   fill={color}/>
      <circle cx="85" cy="18"  r="2.5" fill={color} opacity=".8"/>
      <circle cx="85" cy="60"  r="2"   fill={color} opacity=".55"/>
      <circle cx="45" cy="107" r="3"   fill={color}/>
      <circle cx="5"  cy="60"  r="2"   fill={color} opacity=".55"/>
      <circle cx="5"  cy="18"  r="2.5" fill={color} opacity=".8"/>

      {/* verification badge */}
      <circle cx="78" cy="13" r="11" fill="#05070F" stroke="#00FF94" strokeWidth="1.5"/>
      <circle cx="78" cy="13" r="8"  stroke="#00FF94" strokeWidth=".8" fill="rgba(0,255,148,.08)" opacity=".5"/>
      <polyline points="72,13 77,19 86,7" stroke="#00FF94" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="86" cy="7" r="1.8" fill="#00FF94"/>
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────
type BadgeData = {
  wallet: string; zodiac: string; element: string;
  aura_color: string; edition: number; status: string;
  minted_at: string; cooldown_until?: string;
};
type Eligibility =
  | { can_mint: true; reason: null | "cooldown_expired"; badge: BadgeData | null }
  | { can_mint: false; reason: "already_owns"; badge: BadgeData }
  | { can_mint: false; reason: "cooldown"; days_left: number; cooldown_until: string; badge: BadgeData }
  | { can_mint: false; reason: "not_premium_creator"; badge: BadgeData | null };

// ── Main modal ─────────────────────────────────────────────────────────────
export function BadgeModal({ onClose, goLaunch }: { onClose: () => void; goLaunch?: () => void }) {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? "";

  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [minting, setMinting] = useState(false);
  const [mintDone, setMintDone] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const preview = getZodiacToday();
  const previewColor = wallet ? getAuraColor(wallet) : "#9945FF";

  const fetchEligibility = useCallback(async () => {
    if (!wallet) return;
    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await fetch(`/api/badges/eligibility?wallet=${wallet}`, { signal: ctrl.signal });
      const data = await res.json();
      setEligibility(data);
    } catch (e: any) {
      if (e.name !== "AbortError") setError("Failed to load badge data");
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    void fetchEligibility();
    return () => { abortRef.current?.abort(); };
  }, [fetchEligibility]);

  const handleMint = async () => {
    setMinting(true);
    setError("");
    try {
      const res = await fetch("/api/badges/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mint failed");
      setMintDone(true);
      await fetchEligibility();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMinting(false);
    }
  };

  // close on backdrop click
  const onBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const badge = eligibility && "badge" in eligibility ? eligibility.badge : null;
  const badgeColor = badge?.aura_color ?? previewColor;
  const badgeZodiac = badge?.zodiac ?? preview.name;
  const badgeElement = badge?.element ?? preview.element;

  return (
    <div className="badge-modal-backdrop" onClick={onBackdrop}>
      <div className="badge-modal">
        {/* header */}
        <div className="badge-modal-header">
          <span className="badge-modal-title">HumbleTrust Badge</span>
          <button className="badge-modal-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="badge-modal-loading">
            <div className="badge-spinner" />
          </div>
        ) : (
          <>
            {/* badge preview */}
            <div className="badge-modal-card" style={{ "--aura": badgeColor } as any}>
              <BadgeSVG color={badgeColor} zodiac={badgeZodiac} element={badgeElement} size={160} />
              <div className="badge-modal-info">
                <div className="badge-modal-name">{badgeZodiac}</div>
                <div className="badge-modal-element" style={{ color: badgeColor }}>
                  {badgeElement}
                </div>
                {badge && (
                  <div className="badge-modal-edition">
                    Edition #{String(badge.edition).padStart(3, "0")}
                  </div>
                )}
              </div>
            </div>

            {/* status / action */}
            <div className="badge-modal-action">
              {mintDone && (
                <div className="badge-modal-success">
                  Badge minted! Welcome, {badgeZodiac}.
                </div>
              )}

              {!mintDone && eligibility?.reason === "already_owns" && (
                <div className="badge-modal-owned">
                  <span style={{ color: "#00FF94" }}>✓</span> You own this badge
                  <div className="badge-modal-since">
                    Since {new Date(badge!.minted_at).toLocaleDateString()}
                  </div>
                </div>
              )}

              {!mintDone && eligibility?.reason === "cooldown" && (
                <div className="badge-modal-cooldown">
                  <div className="badge-modal-cooldown-title">Cooldown active</div>
                  <div className="badge-modal-cooldown-days">
                    {(eligibility as any).days_left} days until you can mint again
                  </div>
                  <div className="badge-modal-cooldown-date">
                    Available {new Date((eligibility as any).cooldown_until).toLocaleDateString()}
                  </div>
                </div>
              )}

              {!mintDone && eligibility?.reason === "not_premium_creator" && (
                <div className="badge-modal-cooldown">
                  <div className="badge-modal-cooldown-title">Premium Required</div>
                  <div className="badge-modal-cooldown-days">
                    Zodiac Badge NFTs are exclusively available to Premium token launchers. Launch a Premium token first to unlock your badge.
                  </div>
                  <button
                    className="badge-modal-mint-btn"
                    onClick={() => { onClose(); goLaunch?.(); }}
                    style={{ borderColor: badgeColor, color: badgeColor }}
                  >
                    Launch Premium Token
                  </button>
                </div>
              )}

              {!mintDone && eligibility?.can_mint && !confirming && (
                <>
                  <div className="badge-modal-price-row">
                    <span className="badge-modal-price-label">Mint price</span>
                    <span className="badge-modal-price-value">0.2 SOL</span>
                  </div>
                  {eligibility.reason === "cooldown_expired" && (
                    <div className="badge-modal-hint">Cooldown expired — you can mint again</div>
                  )}
                  {!eligibility.badge && (
                    <div className="badge-modal-hint">
                      Your badge: <b>{preview.name}</b> · {preview.element} (today's date)
                    </div>
                  )}
                  <button
                    className="badge-modal-mint-btn"
                    onClick={() => setConfirming(true)}
                    style={{ borderColor: badgeColor, color: badgeColor }}
                  >
                    Mint Badge · 0.2 SOL
                  </button>
                </>
              )}

              {!mintDone && eligibility?.can_mint && confirming && (
                <div className="badge-modal-confirm">
                  <div className="badge-modal-confirm-title">Confirm mint</div>
                  <div className="badge-modal-confirm-body">
                    <div>Zodiac: <b style={{ color: badgeColor }}>{preview.name}</b></div>
                    <div>Element: <b>{preview.element}</b></div>
                    <div>Price: <b style={{ color: "var(--green-neon)" }}>0.2 SOL</b></div>
                    <div style={{ fontSize: ".8rem", color: "var(--muted)", marginTop: ".4rem" }}>
                      This action is irreversible. A 30-day cooldown applies if you sell the badge.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: ".6rem", marginTop: ".8rem" }}>
                    <button
                      className="badge-modal-mint-btn"
                      onClick={handleMint}
                      disabled={minting}
                      style={{ borderColor: badgeColor, color: badgeColor, flex: 1 }}
                    >
                      {minting ? "Minting…" : "Confirm & Mint"}
                    </button>
                    <button
                      className="badge-modal-mint-btn"
                      onClick={() => setConfirming(false)}
                      disabled={minting}
                      style={{ borderColor: "var(--muted)", color: "var(--muted)", flex: "0 0 auto" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {error && <div className="badge-modal-error">{error}</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

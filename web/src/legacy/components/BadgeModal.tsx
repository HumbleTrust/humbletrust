import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ZodiacBadgeCard } from "./ZodiacBadgeCard";

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
            <div style={{ display: "flex", justifyContent: "center", padding: "1rem 0 .5rem" }}>
              <ZodiacBadgeCard
                zodiac={badgeZodiac}
                element={badgeElement}
                aura={badgeColor}
                edition={badge?.edition ?? 0}
              />
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

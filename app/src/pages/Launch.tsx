import { useState, useMemo, useRef } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Rocket, ExternalLink, Loader, Upload, X } from "lucide-react";
import { getProgram, launchToken } from "../lib/program";
import { fileToHexLogo, MAX_LOGO_BYTES, saveToken } from "../lib/image";
import { HexLogo } from "../components/HexLogo";

interface LaunchResult { signature: string; mint: string; }

export const Launch = () => {
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const fileInput = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoErr, setLogoErr] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("1000000000");
  const [lockPercent, setLockPercent] = useState(50);
  const [lockDays, setLockDays] = useState(90);
  const [burn, setBurn] = useState<25 | 50>(50);
  const [creatorAlloc, setCreatorAlloc] = useState(5);
  const [airdrop, setAirdrop] = useState<0 | 2 | 5 | 8>(5);
  const [tier, setTier] = useState<0 | 1>(0);
  const [antiBot, setAntiBot] = useState(60);

  const supplyNum = useMemo(() => {
    const n = Math.floor(parseFloat(supply));
    return isFinite(n) && n > 0 ? n : 0;
  }, [supply]);
  const validSupply = supplyNum >= 1 && supplyNum <= 1_000_000_000_000;

  const trustScore = useMemo(() => {
    let s = 0;
    s += lockDays >= 360 ? 25 : lockDays >= 270 ? 20 : lockDays >= 180 ? 16 : lockDays >= 90 ? 12 : lockDays >= 60 ? 8 : 4;
    s += lockPercent >= 60 ? 18 : lockPercent >= 50 ? 15 : lockPercent >= 40 ? 11 : 6;
    s += burn === 50 ? 12 : 6;
    s += airdrop === 8 ? 10 : airdrop === 5 ? 6 : airdrop === 2 ? 3 : 0;
    return Math.min(100, s);
  }, [lockDays, lockPercent, burn, airdrop]);

  const circulation = useMemo(() => 100 - lockPercent - creatorAlloc, [lockPercent, creatorAlloc]);
  const validCirc = circulation >= 55;

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoErr(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToHexLogo(file, 256);
      setLogoDataUrl(dataUrl);
    } catch (err: any) {
      setLogoErr(err.message);
      setLogoDataUrl(null);
    }
  };

  const clearLogo = () => { setLogoDataUrl(null); if (fileInput.current) fileInput.current.value = ""; };

  const handleLaunch = async () => {
    if (!anchorWallet || !wallet.connected) { alert("Connect wallet first"); return; }
    setBusy(true); setError(null); setResult(null);
    try {
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program = getProgram(provider);
      const { signature, mint } = await launchToken(program, anchorWallet.publicKey, {
        name, symbol, totalSupply: supply,
        lockPercent, lockDays, burnOption: burn,
        creatorAllocation: creatorAlloc, airdropPercent: airdrop,
        tier, antiBotSeconds: antiBot,
      });
      const mintStr = mint.toString();
      saveToken({
        mint: mintStr, name, symbol,
        logo: logoDataUrl || undefined,
        createdAt: Date.now(),
        trustScore, tier, signature,
      });
      setResult({ signature, mint: mintStr });
    } catch (e: any) {
      console.error(e);
      setError(e.message || String(e));
    } finally { setBusy(false); }
  };

  const scoreColor = trustScore >= 81 ? "var(--green-neon)" : trustScore >= 66 ? "var(--solana-blue)" : trustScore >= 51 ? "var(--yellow)" : "var(--orange)";
  const scoreLabel = trustScore >= 81 ? "PROTECTED" : trustScore >= 66 ? "TRUSTED" : trustScore >= 51 ? "BASIC" : "WEAK";
  const circumference = 2 * Math.PI * 56;
  const offset = circumference - (trustScore / 100) * circumference;

  return (
    <section className="launch-bg">
      <div className="sec-eyebrow">Launch · Anchor Program · Devnet</div>
      <h2 className="sec-h2">Create your <span className="hl-green">protected</span> token</h2>
      <p className="sec-sub">All rules enforced on-chain. Trust Score updates in real time.</p>

      <div className="create-layout">
        <div className="create-form">
          <div className="form-row">
            <div>
              <label className="form-label">Name (max 16)</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} placeholder="My Token" />
            </div>
            <div>
              <label className="form-label">Symbol (max 5)</label>
              <input className="form-input" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 5))} placeholder="MTK" />
            </div>
          </div>

          <label className="form-label">Logo (hex shape, max {MAX_LOGO_BYTES / 1000} KB)</label>
          <div className="logo-upload-row">
            <HexLogo src={logoDataUrl || undefined} label={symbol || "TKN"} size={56} variant="gradient" />
            <div className="logo-upload-info">
              {logoDataUrl ? "Logo ready — auto-cropped to hex" : "PNG/JPG/SVG · auto-cropped to square · max 100 KB"}
              {logoErr && <div className="logo-upload-err">{logoErr}</div>}
            </div>
            <input ref={fileInput} type="file" accept="image/*" onChange={handleLogoSelect} />
            {logoDataUrl ? (
              <button className="logo-upload-btn" onClick={clearLogo} type="button"><X size={14} /></button>
            ) : (
              <button className="logo-upload-btn" onClick={() => fileInput.current?.click()} type="button">
                <Upload size={14} style={{ display: "inline", marginRight: 6 }} /> Upload
              </button>
            )}
          </div>

          <label className="form-label">Total Supply</label>
          <input
            className="form-input"
            type="number"
            min={1}
            max={1_000_000_000_000}
            step={1}
            value={supply}
            onChange={(e) => setSupply(e.target.value)}
            style={!validSupply ? { borderColor: "var(--red)" } : undefined}
          />
          {!validSupply && (
            <div style={{ color: "var(--red)", fontSize: ".75rem", marginTop: ".25rem" }}>
              Supply must be a whole number between 1 and 1,000,000,000,000.
            </div>
          )}

          <div className="slider-group">
            <div className="slider-header"><label className="form-label" style={{ margin: 0 }}>Lock % (30–80)</label><span className="slider-val">{lockPercent}%</span></div>
            <input type="range" min={30} max={80} value={lockPercent} onChange={(e) => setLockPercent(+e.target.value)} />
            <div className="slider-ticks"><span>30%</span><span>50%</span><span>80%</span></div>
          </div>

          <div className="slider-group">
            <div className="slider-header"><label className="form-label" style={{ margin: 0 }}>Lock days (30–360)</label><span className="slider-val">{lockDays}d</span></div>
            <input type="range" min={30} max={360} value={lockDays} onChange={(e) => setLockDays(+e.target.value)} />
            <div className="slider-ticks"><span>30</span><span>180</span><span>360</span></div>
          </div>

          <label className="form-label">Burn on unlock</label>
          <div className="burn-row">
            <div className={"opt-btn " + (burn === 25 ? "sel" : "")} onClick={() => setBurn(25)}><div className="opt-n">25%</div><div className="opt-s">Conservative</div></div>
            <div className={"opt-btn " + (burn === 50 ? "sel" : "")} onClick={() => setBurn(50)}><div className="opt-n">50%</div><div className="opt-s">Aggressive (+score)</div></div>
          </div>

          <div className="slider-group">
            <div className="slider-header"><label className="form-label" style={{ margin: 0 }}>Creator allocation (0–10%)</label><span className="slider-val">{creatorAlloc}%</span></div>
            <input type="range" min={0} max={10} value={creatorAlloc} onChange={(e) => setCreatorAlloc(+e.target.value)} />
          </div>

          <label className="form-label">Airdrop config</label>
          <div className="air-row">
            {[0, 2, 5, 8].map((a) => (
              <div key={a} className={"air-btn " + (airdrop === a ? "sel" : "")} onClick={() => setAirdrop(a as 0|2|5|8)}>{a === 0 ? "Disabled" : a + "%"}</div>
            ))}
          </div>

          <label className="form-label">Tier</label>
          <div className="tier-row">
            <div className={"opt-btn " + (tier === 0 ? "sel" : "")} onClick={() => setTier(0)}><div className="opt-n">$5</div><div className="opt-s">Standard</div></div>
            <div className={"opt-btn " + (tier === 1 ? "sel" : "")} onClick={() => setTier(1)}><div className="opt-n">$25</div><div className="opt-s">Premium · Featured</div></div>
          </div>

          <div className="slider-group">
            <div className="slider-header"><label className="form-label" style={{ margin: 0 }}>Anti-bot delay (0–600s)</label><span className="slider-val">{antiBot}s</span></div>
            <input type="range" min={0} max={600} step={10} value={antiBot} onChange={(e) => setAntiBot(+e.target.value)} />
            <div className="slider-ticks"><span>0</span><span>300</span><span>600</span></div>
          </div>

          <div style={{ background: "rgba(20,102,255,.07)", border: "1px solid rgba(20,102,255,.2)", color: "var(--solana-blue)", padding: ".7rem", borderRadius: 8, fontSize: ".78rem", marginBottom: "1rem", lineHeight: 1.6 }}>
            <strong>Devnet launch.</strong> You will be set as your own metrics oracle. To protect TrustScore integrity on mainnet, assign a separate oracle wallet via <code>set_metrics_authority</code> before going live.
          </div>

          {!validCirc && (
            <div style={{ background: "rgba(255,59,59,.08)", border: "1px solid rgba(255,59,59,.2)", color: "var(--red)", padding: ".7rem", borderRadius: 8, fontSize: ".82rem", marginBottom: "1rem" }}>
              Circulation = {circulation}% (must be ≥ 55%). Reduce lock % or creator allocation.
            </div>
          )}

          {error && (
            <div style={{ background: "rgba(255,59,59,.08)", border: "1px solid rgba(255,59,59,.2)", color: "var(--red)", padding: ".7rem", borderRadius: 8, fontSize: ".82rem", marginBottom: "1rem", wordBreak: "break-word" }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{ background: "rgba(0,255,148,.08)", border: "1px solid rgba(0,255,148,.2)", padding: "1rem", borderRadius: 8, fontSize: ".82rem", marginBottom: "1rem", lineHeight: 1.7 }}>
              <div style={{ color: "var(--green-neon)", fontWeight: 700, marginBottom: ".5rem" }}>✅ Token created on devnet</div>
              <div style={{ color: "var(--muted2)", fontSize: ".75rem", wordBreak: "break-all" }}>Mint: {result.mint}</div>
              <div style={{ color: "var(--muted2)", fontSize: ".75rem", wordBreak: "break-all" }}>Tx: {result.signature}</div>
              <a href={"https://solscan.io/token/" + result.mint + "?cluster=devnet"} target="_blank" rel="noreferrer" style={{ color: "var(--green-neon)", display: "inline-flex", alignItems: "center", gap: 4, marginTop: ".5rem", textDecoration: "none" }}>View on Solscan <ExternalLink size={12} /></a>
            </div>
          )}

          <button className="form-sub" onClick={handleLaunch} disabled={busy || !wallet.connected || !validCirc || !validSupply || !name || !symbol}>
            {busy ? <><Loader size={16} className="spin" style={{ display: "inline", marginRight: 8 }} />Launching...</> : <><Rocket size={16} style={{ display: "inline", marginRight: 8 }} />{wallet.connected ? "Launch token" : "Connect wallet to launch"}</>}
          </button>
        </div>

        <div className="preview-pane">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1.5rem" }}>
            <HexLogo src={logoDataUrl || undefined} label={symbol || "TKN"} size={88} variant={tier === 1 ? "gradient" : "green"} />
            <div style={{ marginTop: ".75rem", fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1.05rem" }}>{name || "Token Preview"}</div>
            <div style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: ".75rem" }}>${symbol || "TKN"}</div>
          </div>

          <div className="preview-label">Live Trust Score</div>
          <div className="score-ring-wrap">
            <svg width="130" height="130">
              <circle className="ring-track" cx="65" cy="65" r="56" />
              <circle className="ring-prog" cx="65" cy="65" r="56" style={{ stroke: scoreColor, strokeDasharray: circumference, strokeDashoffset: offset }} />
            </svg>
            <div className="score-center">
              <div className="score-big" style={{ color: scoreColor }}>{trustScore}</div>
              <div className="score-lbl">/ 100</div>
              <div className="score-status" style={{ color: scoreColor }}>{scoreLabel}</div>
            </div>
          </div>

          <div className="preview-label">Distribution</div>
          <div className="dist-section">
            <div className="dist-row">
              <div className="dist-hd"><span className="dist-key">Locked</span><span className="dist-pct" style={{ color: "var(--green-neon)" }}>{lockPercent}%</span></div>
              <div className="dist-bar"><div className="dist-fill" style={{ width: lockPercent + "%", background: "var(--green-neon)" }} /></div>
            </div>
            <div className="dist-row">
              <div className="dist-hd"><span className="dist-key">Creator (vested)</span><span className="dist-pct" style={{ color: "var(--solana-purple)" }}>{creatorAlloc}%</span></div>
              <div className="dist-bar"><div className="dist-fill" style={{ width: creatorAlloc + "%", background: "var(--solana-purple)" }} /></div>
            </div>
            <div className="dist-row">
              <div className="dist-hd"><span className="dist-key">Circulation</span><span className="dist-pct" style={{ color: validCirc ? "var(--solana-blue)" : "var(--red)" }}>{circulation}%</span></div>
              <div className="dist-bar"><div className="dist-fill" style={{ width: circulation + "%", background: validCirc ? "var(--solana-blue)" : "var(--red)" }} /></div>
            </div>
          </div>

          <div className="preview-label" style={{ marginTop: "1.5rem" }}>Vesting schedule</div>
          <div style={{ fontSize: ".82rem", color: "var(--muted2)", lineHeight: 1.8 }}>
            Day 30 → 2% of your allocation ({creatorAlloc > 0 ? (0.02 * creatorAlloc).toFixed(2) : "0"}% of supply)<br />
            Day 60 → 3% of your allocation ({creatorAlloc > 0 ? (0.03 * creatorAlloc).toFixed(2) : "0"}% of supply)<br />
            Day 90 → 5% of your allocation ({creatorAlloc > 0 ? (0.05 * creatorAlloc).toFixed(2) : "0"}% of supply)<br />
            Remaining allocation released via Add-to-Circulation.<br />
            Total creator: <span style={{ color: "var(--text)" }}>{creatorAlloc}%</span> of supply
          </div>
        </div>
      </div>
    </section>
  );
};

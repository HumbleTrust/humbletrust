import { useState, useMemo, useRef } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Rocket, ExternalLink, Loader, Upload, X, Award, Lock, UserCheck } from "lucide-react";
import { getProgramV2, launchTokenV2, initCreatorReputationV2 } from "../lib/program";
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
  const [repBusy, setRepBusy] = useState(false);
  const [repDone, setRepDone] = useState(false);
  const [repError, setRepError] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [lockPercent, setLockPercent] = useState(40);
  const [lockDays, setLockDays] = useState(90);
  const [burn, setBurn] = useState<25 | 50>(50);
  const [creatorAlloc, setCreatorAlloc] = useState(3);
  const [curveLiquidity, setCurveLiquidity] = useState(35);
  const [airdrop, setAirdrop] = useState(2);
  const [initialSol, setInitialSol] = useState("0.5");
  const [tier, setTier] = useState<0 | 1>(0);
  const [antiBot, setAntiBot] = useState(60);

  const circulation = useMemo(
    () => 100 - lockPercent - creatorAlloc - curveLiquidity - airdrop,
    [lockPercent, creatorAlloc, curveLiquidity, airdrop]
  );
  const initialSolNum = useMemo(() => Number(initialSol), [initialSol]);
  const validInitialSol = Number.isFinite(initialSolNum) && initialSolNum >= 0.5;

  const trustBreakdown = useMemo(() => {
    const lock = lockPercent < 30 ? 0 : lockPercent <= 39 ? 10 : lockPercent <= 60 ? 20 : 15;
    const creator = Math.max(0, 20 - 4 * creatorAlloc);
    const curve = Math.max(0, Math.min(25, 1.5 * (curveLiquidity - 20)));
    const circ = Math.max(0, Math.min(20, 1.2 * (circulation - 10)));
    const air = Math.max(0, 15 - 3 * airdrop);
    const burnScore = burn === 50 ? 10 : 5;
    const raw = lock + creator + curve + circ + air + burnScore;
    return {
      lock, creator, curve, circ, air, burn: burnScore, raw,
      score: Math.min(100, Math.round((raw / 110) * 100)),
    };
  }, [lockPercent, creatorAlloc, curveLiquidity, circulation, airdrop, burn]);

  const trustScore = trustBreakdown.score;
  const validDistribution = circulation >= 15 && circulation <= 40;
  const validCombinedLiquidity = curveLiquidity + circulation >= 50;

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
      const program = getProgramV2(provider);
      const { signature, mint } = await launchTokenV2(program, anchorWallet.publicKey, {
        name, symbol,
        lockPercent, lockDays, burnOption: burn,
        creatorAllocation: creatorAlloc,
        curveLiquidityPercent: curveLiquidity,
        circulationPercent: circulation,
        airdropPercent: airdrop,
        initialSol: initialSolNum,
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

  const handleInitReputation = async () => {
    if (!anchorWallet || !wallet.connected) return;
    setRepBusy(true); setRepError(null);
    try {
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program = getProgramV2(provider);
      await initCreatorReputationV2(program, anchorWallet.publicKey);
      setRepDone(true);
    } catch (e: any) {
      setRepError(e.message || String(e));
    } finally { setRepBusy(false); }
  };

  const scoreColor = trustScore >= 85 ? "var(--green-neon)" : trustScore >= 70 ? "var(--solana-blue)" : trustScore >= 40 ? "var(--yellow)" : "var(--orange)";
  const scoreLabel = trustScore >= 85 ? "ELITE" : trustScore >= 70 ? "STRONG" : trustScore >= 40 ? "OK" : "WEAK";
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
          <input className="form-input" value="1,000,000,000 fixed" readOnly />

          <label className="form-label">Initial Liquidity (SOL)</label>
          <input
            className="form-input"
            type="number"
            min={0.5}
            step={0.1}
            value={initialSol}
            onChange={(e) => setInitialSol(e.target.value)}
            style={!validInitialSol ? { borderColor: "var(--red)" } : undefined}
            title="Used for bonding curve liquidity. Not sent to creator. Not used for Raydium."
          />
          {!validInitialSol && (
            <div style={{ color: "var(--red)", fontSize: ".75rem", marginTop: ".25rem" }}>
              Initial liquidity must be at least 0.5 SOL.
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
            <div className="slider-header"><label className="form-label" style={{ margin: 0 }}>Creator allocation (0-5%)</label><span className="slider-val">{creatorAlloc}%</span></div>
            <input type="range" min={0} max={5} value={creatorAlloc} onChange={(e) => setCreatorAlloc(+e.target.value)} />
          </div>

          <div className="slider-group">
            <div className="slider-header"><label className="form-label" style={{ margin: 0 }}>Curve Liquidity % (25-50)</label><span className="slider-val">{curveLiquidity}%</span></div>
            <input type="range" min={25} max={50} value={curveLiquidity} onChange={(e) => setCurveLiquidity(+e.target.value)} title="Percentage of supply allocated to bonding curve liquidity." />
            <div className="slider-ticks"><span>25%</span><span>35%</span><span>50%</span></div>
          </div>

          <div className="slider-group">
            <div className="slider-header"><label className="form-label" style={{ margin: 0 }}>Airdrop allocation (0-5%)</label><span className="slider-val">{airdrop}%</span></div>
            <input type="range" min={0} max={5} value={airdrop} onChange={(e) => setAirdrop(+e.target.value)} />
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
            <strong>V2 devnet launch.</strong> Initial SOL funds the bonding curve treasury PDA. Creator never receives LP, and migration locks LP in a PDA.
          </div>

          {!validDistribution && (
            <div style={{ background: "rgba(255,59,59,.08)", border: "1px solid rgba(255,59,59,.2)", color: "var(--red)", padding: ".7rem", borderRadius: 8, fontSize: ".82rem", marginBottom: "1rem" }}>
              Circulation = {circulation}% (must be between 15% and 40%). Adjust lock, creator, curve, or airdrop.
            </div>
          )}

          {validDistribution && !validCombinedLiquidity && (
            <div style={{ background: "rgba(255,59,59,.08)", border: "1px solid rgba(255,59,59,.2)", color: "var(--red)", padding: ".7rem", borderRadius: 8, fontSize: ".82rem", marginBottom: "1rem" }}>
              Curve Liquidity % + Circulation % must be at least 50%.
            </div>
          )}

          {validDistribution && validCombinedLiquidity && curveLiquidity + circulation < 55 && (
            <div style={{ background: "rgba(255,205,64,.08)", border: "1px solid rgba(255,205,64,.2)", color: "var(--yellow)", padding: ".7rem", borderRadius: 8, fontSize: ".82rem", marginBottom: "1rem" }}>
              For higher TrustScore, recommended liquidity is at least 55%.
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

          {result && (
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: ".9rem", color: "var(--text)", marginBottom: ".75rem", borderTop: "1px solid rgba(255,255,255,.07)", paddingTop: "1rem" }}>
                Next steps
              </div>

              {/* Phase 4.5 — Init Reputation */}
              <div style={{ background: "rgba(0,255,148,.05)", border: "1px solid rgba(0,255,148,.15)", borderRadius: 8, padding: ".75rem", marginBottom: ".6rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: ".35rem" }}>
                  <UserCheck size={14} color="var(--green-neon)" />
                  <span style={{ fontSize: ".82rem", fontWeight: 600 }}>Phase 4.5 — Initialize Creator Reputation</span>
                </div>
                <div style={{ fontSize: ".75rem", color: "var(--muted2)", marginBottom: ".5rem" }}>
                  One-time setup. Tracks your launches, unlocks, and complaints. Clean record earns +5 on your next token's initial TrustScore.
                </div>
                {repDone ? (
                  <div style={{ fontSize: ".75rem", color: "var(--green-neon)" }}>✅ Reputation account initialized</div>
                ) : (
                  <>
                    <button
                      onClick={handleInitReputation}
                      disabled={repBusy}
                      style={{ background: "rgba(0,255,148,.1)", border: "1px solid rgba(0,255,148,.3)", color: "var(--green-neon)", borderRadius: 6, padding: ".35rem .75rem", fontSize: ".78rem", cursor: "pointer" }}
                    >
                      {repBusy ? <><Loader size={12} className="spin" style={{ display: "inline", marginRight: 4 }} />Initializing...</> : "Init Reputation Account"}
                    </button>
                    {repError && <div style={{ fontSize: ".72rem", color: "var(--red)", marginTop: ".3rem" }}>{repError}</div>}
                  </>
                )}
              </div>

              {/* Phase 4.6 — Launch Certificate */}
              <div style={{ background: "rgba(20,102,255,.05)", border: "1px solid rgba(20,102,255,.15)", borderRadius: 8, padding: ".75rem", marginBottom: ".6rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: ".35rem" }}>
                  <Award size={14} color="var(--solana-blue)" />
                  <span style={{ fontSize: ".82rem", fontWeight: 600 }}>Phase 4.6 — Mint Launch Certificate (Soulbound)</span>
                </div>
                <div style={{ fontSize: ".75rem", color: "var(--muted2)", marginBottom: ".5rem" }}>
                  Creates an on-chain record of your launch parameters (lock%, days, score, timestamp). Token-2022 NonTransferable NFT — shows in Phantom as "Humble.Trust Launch Certificate".
                </div>
                <div style={{ fontSize: ".72rem", color: "var(--muted)", fontStyle: "italic" }}>
                  Available after <code>init_global_state</code> is called by deployer on devnet.
                </div>
              </div>

              {/* Phase 4 — LP Lock */}
              <div style={{ background: "rgba(153,69,255,.05)", border: "1px solid rgba(153,69,255,.15)", borderRadius: 8, padding: ".75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: ".35rem" }}>
                  <Lock size={14} color="var(--solana-purple)" />
                  <span style={{ fontSize: ".82rem", fontWeight: 600 }}>Phase 4 — Lock LP Tokens</span>
                </div>
                <div style={{ fontSize: ".75rem", color: "var(--muted2)", marginBottom: ".5rem" }}>
                  After adding liquidity on Raydium/Orca, lock your LP tokens here. The protocol enforces the lock and distributes fees: {tier === 1 ? "60%" : "50%"} creator / 30% treasury / 20% rewards.
                </div>
                <div style={{ fontSize: ".72rem", color: "var(--muted)", fontStyle: "italic" }}>
                  Add your LP token mint address and amount after creating a Raydium pool.
                </div>
              </div>
            </div>
          )}

          <button className="form-sub" onClick={handleLaunch} disabled={busy || !wallet.connected || !validDistribution || !validCombinedLiquidity || !validInitialSol || !name || !symbol}>
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
              <div className="dist-hd"><span className="dist-key">Curve Liquidity</span><span className="dist-pct" style={{ color: "var(--yellow)" }}>{curveLiquidity}%</span></div>
              <div className="dist-bar"><div className="dist-fill" style={{ width: curveLiquidity + "%", background: "var(--yellow)" }} /></div>
            </div>
            <div className="dist-row">
              <div className="dist-hd"><span className="dist-key">Circulation</span><span className="dist-pct" style={{ color: validDistribution ? "var(--solana-blue)" : "var(--red)" }}>{circulation}%</span></div>
              <div className="dist-bar"><div className="dist-fill" style={{ width: Math.max(0, circulation) + "%", background: validDistribution ? "var(--solana-blue)" : "var(--red)" }} /></div>
            </div>
            <div className="dist-row">
              <div className="dist-hd"><span className="dist-key">Airdrop</span><span className="dist-pct" style={{ color: "var(--muted2)" }}>{airdrop}%</span></div>
              <div className="dist-bar"><div className="dist-fill" style={{ width: airdrop + "%", background: "var(--muted2)" }} /></div>
            </div>
          </div>

          <div className="preview-label" style={{ marginTop: "1.5rem" }}>TrustScore Breakdown</div>
          <div style={{ fontSize: ".82rem", color: "var(--muted2)", lineHeight: 1.8, marginBottom: "1.25rem" }}>
            Lock: +{trustBreakdown.lock.toFixed(0)}<br />
            Creator: +{trustBreakdown.creator.toFixed(0)}<br />
            Curve Liquidity: +{trustBreakdown.curve.toFixed(1)}<br />
            Circulation: +{trustBreakdown.circ.toFixed(1)}<br />
            Airdrop: +{trustBreakdown.air.toFixed(0)}<br />
            Burn: +{trustBreakdown.burn.toFixed(0)}
          </div>

          <div className="preview-label" style={{ marginTop: "1.5rem" }}>Vesting schedule</div>
          <div style={{ fontSize: ".82rem", color: "var(--muted2)", lineHeight: 1.8 }}>
            Day 30: 33% of creator vault ({(creatorAlloc * 0.33).toFixed(2)}% of supply)<br />
            Day 60: 33% of creator vault ({(creatorAlloc * 0.33).toFixed(2)}% of supply)<br />
            Day 90: 34% of creator vault ({(creatorAlloc * 0.34).toFixed(2)}% of supply)<br />
            Total creator: <span style={{ color: "var(--text)" }}>{creatorAlloc}%</span> of supply
          </div>
        </div>
      </div>
    </section>
  );
};

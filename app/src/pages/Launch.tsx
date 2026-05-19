import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Rocket, ExternalLink, Loader, Upload, X, Award, Lock, UserCheck } from "lucide-react";
import {
  PROGRAM_ID_V2_PK,
  getProgram,
  getProgramV2,
  initCreatorReputation,
  initCreatorReputationV2,
  isProgramExecutable,
  launchToken,
  launchTokenV2,
  mintLaunchCertificateV2,
} from "../lib/program";
import { fileToHexLogo, MAX_LOGO_BYTES, saveToken } from "../lib/image";
import { HexLogo } from "../components/HexLogo";

interface LaunchResult { signature: string; mint: string; certificateSignature?: string; certificateMint?: string; }
type LaunchMode = "checking" | "v1" | "v2";

const V1_SUPPLY = "1000000000";
const V1_AIRDROPS = [0, 2, 5, 8] as const;

const toV1Airdrop = (value: number): 0 | 2 | 5 | 8 =>
  V1_AIRDROPS.reduce((best, candidate) =>
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best
  );

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
  const [certBusy, setCertBusy] = useState(false);
  const [certDone, setCertDone] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const [certMint, setCertMint] = useState<string | null>(null);
  const [certSignature, setCertSignature] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [launchMode, setLaunchMode] = useState<LaunchMode>("checking");
  const [programStatusError, setProgramStatusError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [lockPercent, setLockPercent] = useState(40);
  const [lockDays, setLockDays] = useState(90);
  const [burn, setBurn] = useState<25 | 50>(50);
  const [creatorAlloc, setCreatorAlloc] = useState(3);
  const [curveLiquidity, setCurveLiquidity] = useState(35);
  const [airdrop, setAirdrop] = useState<number>(2);
  const [initialSol, setInitialSol] = useState("0.5");
  const [tier, setTier] = useState<0 | 1>(0);
  const [antiBot, setAntiBot] = useState(60);

  useEffect(() => {
    let mounted = true;
    setLaunchMode("checking");
    setProgramStatusError(null);

    isProgramExecutable(connection, PROGRAM_ID_V2_PK)
      .then((available) => {
        if (mounted) setLaunchMode(available ? "v2" : "v1");
      })
      .catch((err) => {
        console.warn("Unable to check v2 program on devnet", err);
        if (mounted) {
          setLaunchMode("v1");
          setProgramStatusError("Could not verify v2 deploy on devnet; using live v1 program.");
        }
      });

    return () => { mounted = false; };
  }, [connection]);

  useEffect(() => {
    if (launchMode === "v1") setAirdrop((value) => toV1Airdrop(value));
    if (launchMode === "v2") {
      setAirdrop((value) => Math.min(value, 5));
      setCreatorAlloc((value) => Math.min(value, 5));
    }
  }, [launchMode]);

  const isCheckingProgram = launchMode === "checking";
  const isV2Launch = launchMode === "v2";
  const v1Airdrop = useMemo(() => toV1Airdrop(airdrop), [airdrop]);

  const v2Circulation = useMemo(
    () => 100 - lockPercent - creatorAlloc - curveLiquidity - airdrop,
    [lockPercent, creatorAlloc, curveLiquidity, airdrop]
  );
  const v1Circulation = useMemo(
    () => 100 - lockPercent - creatorAlloc,
    [lockPercent, creatorAlloc]
  );
  const circulation = isV2Launch ? v2Circulation : v1Circulation;
  const initialSolNum = useMemo(() => Number(initialSol), [initialSol]);
  const validInitialSol = !isV2Launch || (Number.isFinite(initialSolNum) && initialSolNum >= 0.5);

  const trustBreakdown = useMemo(() => {
    if (!isV2Launch) {
      const days = lockDays >= 360 ? 25 : lockDays >= 270 ? 20 : lockDays >= 180 ? 16 : lockDays >= 90 ? 12 : lockDays >= 60 ? 8 : 4;
      const lock = lockPercent >= 60 ? 18 : lockPercent >= 50 ? 15 : lockPercent >= 40 ? 11 : 6;
      const burnScore = burn === 50 ? 12 : 6;
      const air = v1Airdrop === 8 ? 10 : v1Airdrop === 5 ? 6 : v1Airdrop === 2 ? 3 : 0;
      const raw = days + lock + burnScore + air;
      return {
        mode: "v1" as const,
        days,
        lock,
        creator: 0,
        curve: 0,
        circ: 0,
        air,
        burn: burnScore,
        raw,
        score: Math.min(100, raw),
      };
    }

    const lock = lockPercent < 30 ? 0 : lockPercent <= 39 ? 10 : lockPercent <= 60 ? 20 : 15;
    const creator = Math.max(0, 20 - 4 * creatorAlloc);
    const curve = Math.max(0, Math.min(25, 1.5 * (curveLiquidity - 20)));
    const circ = Math.max(0, Math.min(20, 1.2 * (v2Circulation - 10)));
    const air = Math.max(0, 15 - 3 * airdrop);
    const burnScore = burn === 50 ? 10 : 5;
    const raw = lock + creator + curve + circ + air + burnScore;
    return {
      mode: "v2" as const,
      days: 0,
      lock, creator, curve, circ, air, burn: burnScore, raw,
      score: Math.min(100, Math.round((raw / 110) * 100)),
    };
  }, [isV2Launch, lockDays, lockPercent, creatorAlloc, curveLiquidity, v2Circulation, airdrop, v1Airdrop, burn]);

  const trustScore = trustBreakdown.score;
  const validDistribution = isV2Launch ? v2Circulation >= 15 && v2Circulation <= 40 : v1Circulation >= 55;
  const validCombinedLiquidity = !isV2Launch || curveLiquidity + v2Circulation >= 50;

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

  const mintCertificateForMint = async (mintStr: string, tokenLabel: string) => {
    if (!anchorWallet || !wallet.connected) return null;
    setCertBusy(true);
    setCertError(null);
    try {
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const cert = await mintLaunchCertificateV2(
        getProgramV2(provider),
        anchorWallet.publicKey,
        new PublicKey(mintStr),
        tokenLabel || "HumbleTrust Token"
      );

      if (cert.alreadyMinted) {
        setCertDone(true);
        setCertMint(null);
        setCertSignature(null);
        return cert;
      }

      const certificateMint = cert.certificateMint.toString();
      setCertDone(true);
      setCertMint(certificateMint);
      setCertSignature(cert.signature);
      return cert;
    } catch (e: any) {
      const message = e.message || String(e);
      if (/already in use|already initialized/i.test(message)) {
        setCertDone(true);
      } else {
        setCertError(message);
      }
      return null;
    } finally {
      setCertBusy(false);
    }
  };

  const handleLaunch = async () => {
    if (!anchorWallet || !wallet.connected) { alert("Connect wallet first"); return; }
    setBusy(true); setError(null); setResult(null);
    setCertDone(false); setCertError(null); setCertMint(null); setCertSignature(null);
    try {
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const v2Available = await isProgramExecutable(connection, PROGRAM_ID_V2_PK).catch(() => false);
      const useV2 = isV2Launch && v2Available;
      setLaunchMode(v2Available ? "v2" : "v1");
      const { signature, mint } = useV2
        ? await launchTokenV2(getProgramV2(provider), anchorWallet.publicKey, {
            name, symbol,
            lockPercent, lockDays, burnOption: burn,
            creatorAllocation: creatorAlloc,
            curveLiquidityPercent: curveLiquidity,
            circulationPercent: v2Circulation,
            airdropPercent: airdrop,
            initialSol: initialSolNum,
            tier, antiBotSeconds: antiBot,
          })
        : await launchToken(getProgram(provider), anchorWallet.publicKey, {
            name, symbol, totalSupply: V1_SUPPLY,
            lockPercent, lockDays, burnOption: burn,
            creatorAllocation: creatorAlloc, airdropPercent: v1Airdrop,
            tier, antiBotSeconds: antiBot,
          });
      const mintStr = mint.toString();
      const savedToken = {
        mint: mintStr, name, symbol,
        logo: logoDataUrl || undefined,
        createdAt: Date.now(),
        trustScore, tier, signature,
        launchMode: useV2 ? "v2" : "v1",
      } as const;
      saveToken(savedToken);
      setResult({ signature, mint: mintStr });

      if (useV2) {
        const cert = await mintCertificateForMint(mintStr, name);
        if (cert && !cert.alreadyMinted) {
          const certificateMint = cert.certificateMint.toString();
          const certificateSignature = cert.signature;
          saveToken({
            ...savedToken,
            hasCertificate: true,
            certificateMint,
            certificateSignature,
          });
          setResult({ signature, mint: mintStr, certificateMint, certificateSignature });
        }
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || String(e));
    } finally { setBusy(false); }
  };

  const handleMintCertificate = async () => {
    if (!result) return;
    const cert = await mintCertificateForMint(result.mint, name);
    if (cert && !cert.alreadyMinted) {
      const certificateMint = cert.certificateMint.toString();
      const certificateSignature = cert.signature;
      setResult((prev) => prev ? { ...prev, certificateMint, certificateSignature } : prev);
      saveToken({
        mint: result.mint,
        name,
        symbol,
        logo: logoDataUrl || undefined,
        createdAt: Date.now(),
        trustScore,
        tier,
        signature: result.signature,
        launchMode: "v2",
        hasCertificate: true,
        certificateMint,
        certificateSignature,
      });
    }
  };

  const handleInitReputation = async () => {
    if (!anchorWallet || !wallet.connected) return;
    setRepBusy(true); setRepError(null);
    try {
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const v2Available = await isProgramExecutable(connection, PROGRAM_ID_V2_PK).catch(() => false);
      const useV2 = isV2Launch && v2Available;
      setLaunchMode(v2Available ? "v2" : "v1");
      if (useV2) {
        await initCreatorReputationV2(getProgramV2(provider), anchorWallet.publicKey);
      } else {
        await initCreatorReputation(getProgram(provider), anchorWallet.publicKey);
      }
      setRepDone(true);
    } catch (e: any) {
      const message = e.message || String(e);
      if (/already in use|already initialized/i.test(message)) {
        setRepDone(true);
      } else {
        setRepError(message);
      }
    } finally { setRepBusy(false); }
  };

  const scoreColor = isV2Launch
    ? trustScore >= 85 ? "var(--green-neon)" : trustScore >= 70 ? "var(--solana-blue)" : trustScore >= 40 ? "var(--yellow)" : "var(--orange)"
    : trustScore >= 81 ? "var(--green-neon)" : trustScore >= 66 ? "var(--solana-blue)" : trustScore >= 51 ? "var(--yellow)" : "var(--orange)";
  const scoreLabel = isV2Launch
    ? trustScore >= 85 ? "ELITE" : trustScore >= 70 ? "STRONG" : trustScore >= 40 ? "OK" : "WEAK"
    : trustScore >= 81 ? "PROTECTED" : trustScore >= 66 ? "TRUSTED" : trustScore >= 51 ? "BASIC" : "WEAK";
  const circumference = 2 * Math.PI * 56;
  const offset = circumference - (trustScore / 100) * circumference;

  return (
    <section className="launch-bg">
      <div className="sec-eyebrow">Launch · {isV2Launch ? "V2 Curve" : "V1 Live"} · Devnet</div>
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

          {isV2Launch && (
            <>
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
            </>
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
            <div className="slider-header"><label className="form-label" style={{ margin: 0 }}>Creator allocation (0-{isV2Launch ? 5 : 10}%)</label><span className="slider-val">{creatorAlloc}%</span></div>
            <input type="range" min={0} max={isV2Launch ? 5 : 10} value={creatorAlloc} onChange={(e) => setCreatorAlloc(+e.target.value)} />
          </div>

          {isV2Launch && (
            <div className="slider-group">
              <div className="slider-header"><label className="form-label" style={{ margin: 0 }}>Curve Liquidity % (25-50)</label><span className="slider-val">{curveLiquidity}%</span></div>
              <input type="range" min={25} max={50} value={curveLiquidity} onChange={(e) => setCurveLiquidity(+e.target.value)} title="Percentage of supply allocated to bonding curve liquidity." />
              <div className="slider-ticks"><span>25%</span><span>35%</span><span>50%</span></div>
            </div>
          )}

          {isV2Launch ? (
            <div className="slider-group">
              <div className="slider-header"><label className="form-label" style={{ margin: 0 }}>Airdrop allocation (0-5%)</label><span className="slider-val">{airdrop}%</span></div>
              <input type="range" min={0} max={5} value={airdrop} onChange={(e) => setAirdrop(+e.target.value)} />
            </div>
          ) : (
            <>
              <label className="form-label">Airdrop config</label>
              <div className="air-row">
                {V1_AIRDROPS.map((value) => (
                  <div key={value} className={"air-btn " + (v1Airdrop === value ? "sel" : "")} onClick={() => setAirdrop(value)}>
                    {value === 0 ? "Disabled" : value + "%"}
                  </div>
                ))}
              </div>
            </>
          )}

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
            {isCheckingProgram ? (
              <><strong>Checking devnet program.</strong> Verifying the live launch contract before sending.</>
            ) : isV2Launch ? (
              <><strong>V2 devnet launch.</strong> Initial SOL funds the bonding curve treasury PDA. Creator never receives LP, and migration locks LP in a PDA.</>
            ) : (
              <><strong>Devnet launch.</strong> V1 program is live; v2 curve deploy is pending, so Launch uses the deployed token-lock program.</>
            )}
            {programStatusError && <div style={{ marginTop: ".35rem", color: "var(--muted2)" }}>{programStatusError}</div>}
          </div>

          {!isV2Launch && !validDistribution && (
            <div style={{ background: "rgba(255,59,59,.08)", border: "1px solid rgba(255,59,59,.2)", color: "var(--red)", padding: ".7rem", borderRadius: 8, fontSize: ".82rem", marginBottom: "1rem" }}>
              Circulation = {circulation}% (must be at least 55%). Reduce lock % or creator allocation.
            </div>
          )}

          {isV2Launch && !validDistribution && (
            <div style={{ background: "rgba(255,59,59,.08)", border: "1px solid rgba(255,59,59,.2)", color: "var(--red)", padding: ".7rem", borderRadius: 8, fontSize: ".82rem", marginBottom: "1rem" }}>
              Circulation = {circulation}% (must be between 15% and 40%). Adjust lock, creator, curve, or airdrop.
            </div>
          )}

          {isV2Launch && validDistribution && !validCombinedLiquidity && (
            <div style={{ background: "rgba(255,59,59,.08)", border: "1px solid rgba(255,59,59,.2)", color: "var(--red)", padding: ".7rem", borderRadius: 8, fontSize: ".82rem", marginBottom: "1rem" }}>
              Curve Liquidity % + Circulation % must be at least 50%.
            </div>
          )}

          {isV2Launch && validDistribution && validCombinedLiquidity && curveLiquidity + circulation < 55 && (
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
              {certBusy && (
                <div style={{ color: "var(--solana-blue)", fontSize: ".75rem", marginTop: ".55rem", display: "flex", alignItems: "center", gap: 6 }}>
                  <Loader size={12} className="spin" /> Minting Launch Certificate NFT...
                </div>
              )}
              {certDone && (
                <div style={{ color: "var(--green-neon)", fontSize: ".75rem", marginTop: ".55rem" }}>
                  ✅ Launch Certificate NFT {certMint ? "minted" : "already exists"}
                  {certMint && (
                    <>
                      <div style={{ color: "var(--muted2)", wordBreak: "break-all" }}>Certificate mint: {certMint}</div>
                      <a href={"https://solscan.io/token/" + certMint + "?cluster=devnet"} target="_blank" rel="noreferrer" style={{ color: "var(--green-neon)", display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>View certificate <ExternalLink size={12} /></a>
                    </>
                  )}
                </div>
              )}
              {certError && <div style={{ color: "var(--red)", fontSize: ".75rem", marginTop: ".55rem" }}>Certificate NFT: {certError}</div>}
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
                  Creates a Token-2022 NonTransferable devnet NFT and links it to an on-chain certificate PDA with lock%, days, score, and timestamp.
                </div>
                {certDone ? (
                  <div style={{ fontSize: ".75rem", color: "var(--green-neon)" }}>✅ Certificate NFT minted</div>
                ) : (
                  <>
                    <button
                      onClick={handleMintCertificate}
                      disabled={certBusy || !isV2Launch}
                      style={{ background: "rgba(20,102,255,.12)", border: "1px solid rgba(20,102,255,.35)", color: "var(--solana-blue)", borderRadius: 6, padding: ".35rem .75rem", fontSize: ".78rem", cursor: certBusy || !isV2Launch ? "not-allowed" : "pointer" }}
                    >
                      {certBusy ? <><Loader size={12} className="spin" style={{ display: "inline", marginRight: 4 }} />Minting...</> : "Mint Certificate NFT"}
                    </button>
                    {certError && <div style={{ fontSize: ".72rem", color: "var(--red)", marginTop: ".3rem" }}>{certError}</div>}
                  </>
                )}
              </div>

              {/* Phase 4 — Raydium CPMM Migration */}
              <div style={{ background: "rgba(153,69,255,.05)", border: "1px solid rgba(153,69,255,.15)", borderRadius: 8, padding: ".75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: ".35rem" }}>
                  <Lock size={14} color="var(--solana-purple)" />
                  <span style={{ fontSize: ".82rem", fontWeight: 600 }}>Phase 4 — Raydium CPMM Migration</span>
                </div>
                <div style={{ fontSize: ".75rem", color: "var(--muted2)", marginBottom: ".5rem" }}>
                  Target flow: when the curve reaches 50 SOL, v2 migrates PDA reserves into a Raydium CPMM pool and locks LP custody in a PDA. This is still a devnet integration milestone, not a completed mainnet feature.
                </div>
                <div style={{ fontSize: ".72rem", color: "var(--muted)", fontStyle: "italic" }}>
                  Manual LP input is not enough for the final anti-rug model; the next contract step is real Raydium CPMM CPI.
                </div>
              </div>
            </div>
          )}

          <button className="form-sub" onClick={handleLaunch} disabled={busy || isCheckingProgram || !wallet.connected || !validDistribution || !validCombinedLiquidity || !validInitialSol || !name || !symbol}>
            {busy ? <><Loader size={16} className="spin" style={{ display: "inline", marginRight: 8 }} />Launching...</> : isCheckingProgram ? <><Loader size={16} className="spin" style={{ display: "inline", marginRight: 8 }} />Checking devnet...</> : <><Rocket size={16} style={{ display: "inline", marginRight: 8 }} />{wallet.connected ? "Launch token" : "Connect wallet to launch"}</>}
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
            {isV2Launch && (
              <div className="dist-row">
                <div className="dist-hd"><span className="dist-key">Curve Liquidity</span><span className="dist-pct" style={{ color: "var(--yellow)" }}>{curveLiquidity}%</span></div>
                <div className="dist-bar"><div className="dist-fill" style={{ width: curveLiquidity + "%", background: "var(--yellow)" }} /></div>
              </div>
            )}
            <div className="dist-row">
              <div className="dist-hd"><span className="dist-key">Circulation</span><span className="dist-pct" style={{ color: validDistribution ? "var(--solana-blue)" : "var(--red)" }}>{circulation}%</span></div>
              <div className="dist-bar"><div className="dist-fill" style={{ width: Math.max(0, circulation) + "%", background: validDistribution ? "var(--solana-blue)" : "var(--red)" }} /></div>
            </div>
            {isV2Launch && (
              <div className="dist-row">
                <div className="dist-hd"><span className="dist-key">Airdrop</span><span className="dist-pct" style={{ color: "var(--muted2)" }}>{airdrop}%</span></div>
                <div className="dist-bar"><div className="dist-fill" style={{ width: airdrop + "%", background: "var(--muted2)" }} /></div>
              </div>
            )}
          </div>

          <div className="preview-label" style={{ marginTop: "1.5rem" }}>TrustScore Breakdown</div>
          <div style={{ fontSize: ".82rem", color: "var(--muted2)", lineHeight: 1.8, marginBottom: "1.25rem" }}>
            {isV2Launch ? (
              <>
                Lock: +{trustBreakdown.lock.toFixed(0)}<br />
                Creator: +{trustBreakdown.creator.toFixed(0)}<br />
                Curve Liquidity: +{trustBreakdown.curve.toFixed(1)}<br />
                Circulation: +{trustBreakdown.circ.toFixed(1)}<br />
                Airdrop: +{trustBreakdown.air.toFixed(0)}<br />
                Burn: +{trustBreakdown.burn.toFixed(0)}<br />
                <span style={{ color: "var(--text)" }}>Raw: {trustBreakdown.raw.toFixed(1)} / 110</span><br />
                <span style={{ color: scoreColor }}>TrustScore: {trustScore} / 100</span>
              </>
            ) : (
              <>
                Lock days: +{trustBreakdown.days.toFixed(0)}<br />
                Lock: +{trustBreakdown.lock.toFixed(0)}<br />
                Airdrop: +{trustBreakdown.air.toFixed(0)}<br />
                Burn: +{trustBreakdown.burn.toFixed(0)}
              </>
            )}
          </div>

          <div className="preview-label" style={{ marginTop: "1.5rem" }}>Vesting schedule</div>
          <div style={{ fontSize: ".82rem", color: "var(--muted2)", lineHeight: 1.8 }}>
            {isV2Launch ? (
              <>
                Day 30: 33% of creator vault ({(creatorAlloc * 0.33).toFixed(2)}% of supply)<br />
                Day 60: 33% of creator vault ({(creatorAlloc * 0.33).toFixed(2)}% of supply)<br />
                Day 90: 34% of creator vault ({(creatorAlloc * 0.34).toFixed(2)}% of supply)<br />
              </>
            ) : (
              <>
                Day 30: 2% of creator allocation ({creatorAlloc > 0 ? (0.02 * creatorAlloc).toFixed(2) : "0"}% of supply)<br />
                Day 60: 3% of creator allocation ({creatorAlloc > 0 ? (0.03 * creatorAlloc).toFixed(2) : "0"}% of supply)<br />
                Day 90: 5% of creator allocation ({creatorAlloc > 0 ? (0.05 * creatorAlloc).toFixed(2) : "0"}% of supply)<br />
                Remaining allocation released via Add-to-Circulation.<br />
              </>
            )}
            Total creator: <span style={{ color: "var(--text)" }}>{creatorAlloc}%</span> of supply
          </div>
        </div>
      </div>
    </section>
  );
};

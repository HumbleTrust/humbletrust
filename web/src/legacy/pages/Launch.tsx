import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Award, ExternalLink, Loader, Lock, Rocket, Upload, UserCheck, X } from "lucide-react";
import {
  getProgram,
  initCreatorReputation,
  launchToken,
  mintLaunchCertificate,
  PublicKey,
} from "../lib/program";
import { registerToken } from "../lib/api";
import { fileToHexLogo, MAX_LOGO_BYTES, saveToken } from "../lib/image";
import { HexLogo } from "../components/HexLogo";

const LAMPORTS_PER_SOL = 1_000_000_000;

interface LaunchResult {
  signature: string;
  mint: string;
}

interface CertificateResult {
  signature: string;
  certificateMint: string;
  creatorNftAccount: string;
}

const formatSolscanTx = (signature: string) =>
  `https://solscan.io/tx/${signature}?cluster=devnet`;

const formatSolscanToken = (mint: string) =>
  `https://solscan.io/token/${mint}?cluster=devnet`;

const scoreColorFor = (score: number) =>
  score >= 85 ? "var(--green-neon)" :
  score >= 70 ? "var(--solana-blue)" :
  score >= 40 ? "var(--yellow)" :
  "var(--orange)";

const scoreLabelFor = (score: number) =>
  score >= 85 ? "ELITE" :
  score >= 70 ? "STRONG" :
  score >= 40 ? "OK" :
  "WEAK";

const calculateTrustScoreV2 = (
  lockPercent: number,
  lockDays: number,
  creatorPercent: number,
  curveLiquidityPercent: number,
  circulationPercent: number,
  airdropPercent: number,
  burnOption: number
) => {
  const lockDaysTenths =
    lockDays < 30 ? 0 :
    lockDays < 60 ? 40 :
    lockDays < 90 ? 80 :
    lockDays < 180 ? 120 :
    lockDays < 270 ? 180 :
    lockDays < 360 ? 220 :
    250;

  const lockPctTenths =
    lockPercent < 30 ? 0 :
    lockPercent < 40 ? 60 :
    lockPercent < 50 ? 100 :
    lockPercent < 60 ? 140 :
    lockPercent < 70 ? 170 :
    200;

  const creatorTenths =
    creatorPercent === 0 ? 150 :
    creatorPercent <= 3 ? 120 :
    creatorPercent <= 5 ? 90 :
    creatorPercent <= 8 ? 60 :
    creatorPercent <= 10 ? 30 :
    0;

  const curveTenths =
    curveLiquidityPercent < 20 ? 0 :
    curveLiquidityPercent < 30 ? 30 :
    curveLiquidityPercent < 40 ? 60 :
    curveLiquidityPercent < 50 ? 80 :
    100;

  const circulationTenths =
    circulationPercent < 10 ? 0 :
    circulationPercent < 15 ? 40 :
    circulationPercent <= 40 ? 80 :
    circulationPercent <= 60 ? 40 :
    20;

  const airdropTenths =
    airdropPercent === 0 ? 0 :
    airdropPercent <= 4 ? 50 :
    airdropPercent <= 9 ? 80 :
    100;

  const burnTenths = burnOption === 50 ? 120 : burnOption === 25 ? 60 : 0;
  const rawTenths =
    lockDaysTenths +
    lockPctTenths +
    creatorTenths +
    curveTenths +
    circulationTenths +
    airdropTenths +
    burnTenths;

  return Math.min(100, Math.floor(rawTenths / 10));
};

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
  const [certResult, setCertResult] = useState<CertificateResult | null>(null);
  const [certError, setCertError] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [initialLiquiditySol, setInitialLiquiditySol] = useState("0.5");
  const [lockPercent, setLockPercent] = useState(40);
  const [lockDays, setLockDays] = useState(90);
  const [burn, setBurn] = useState<0 | 25 | 50>(50);
  const [creatorAlloc, setCreatorAlloc] = useState(5);
  const [curveLiquidity, setCurveLiquidity] = useState(35);
  const [airdrop, setAirdrop] = useState<0 | 2 | 5>(5);
  const [tier, setTier] = useState<0 | 1>(0);
  const [antiBot, setAntiBot] = useState(60);

  const initialSol = Number(initialLiquiditySol);
  const initialSolLamports = useMemo(() => {
    return Number.isFinite(initialSol) && initialSol > 0
      ? Math.round(initialSol * LAMPORTS_PER_SOL)
      : 0;
  }, [initialSol]);

  const circulation = useMemo(
    () => 100 - lockPercent - creatorAlloc - curveLiquidity - airdrop,
    [lockPercent, creatorAlloc, curveLiquidity, airdrop]
  );
  const validCirc = circulation >= 15 && circulation <= 40;
  const validInitialSol = initialSolLamports >= 500_000_000;
  const validDistribution =
    validCirc && curveLiquidity + circulation >= 50 && validInitialSol;

  const trustScore = useMemo(
    () =>
      calculateTrustScoreV2(
        lockPercent,
        lockDays,
        creatorAlloc,
        curveLiquidity,
        circulation,
        airdrop,
        burn
      ),
    [lockPercent, lockDays, creatorAlloc, curveLiquidity, circulation, airdrop, burn]
  );

  const scoreColor = scoreColorFor(trustScore);
  const scoreLabel = scoreLabelFor(trustScore);
  const circumference = 2 * Math.PI * 56;
  const offset = circumference - (trustScore / 100) * circumference;

  const handleLogoSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    setLogoErr(null);
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToHexLogo(file, 256);
      setLogoDataUrl(dataUrl);
    } catch (err) {
      setLogoErr(err instanceof Error ? err.message : String(err));
      setLogoDataUrl(null);
    }
  };

  const clearLogo = () => {
    setLogoDataUrl(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleLaunch = async () => {
    if (!anchorWallet || !wallet.connected) {
      setError("Connect wallet first.");
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);
    setRepDone(false);
    setRepError(null);
    setCertResult(null);
    setCertError(null);

    try {
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program = getProgram(provider);
      const { signature, mint } = await launchToken(program, connection, anchorWallet.publicKey, {
        name,
        symbol,
        lockDays,
        burnOption: burn,
        lockPercent,
        creatorPercent: creatorAlloc,
        curveLiquidityPercent: curveLiquidity,
        circulationPercent: circulation,
        airdropPercent: airdrop,
        initialSolLamports,
        tier,
        antiBotSeconds: antiBot,
      });

      const mintStr = mint.toString();
      saveToken({
        mint: mintStr,
        name,
        symbol,
        logo: logoDataUrl || undefined,
        createdAt: Date.now(),
        trustScore,
        tier,
        signature,
        launchMode: "v2",
      });
      void registerToken({
        mint: mintStr,
        creator: anchorWallet.publicKey.toString(),
        name,
        symbol,
        signature,
        launchScore: trustScore,
        lockPercent,
        burnOption: burn,
        logoUrl: logoDataUrl || null,
        tier,
      }).catch((err) => console.warn("[launch] backend token sync failed", err));
      setResult({ signature, mint: mintStr });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleInitReputation = async () => {
    if (!anchorWallet || !wallet.connected) return;

    setRepBusy(true);
    setRepError(null);

    try {
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program = getProgram(provider);
      await initCreatorReputation(program, connection, anchorWallet.publicKey);
      setRepDone(true);
    } catch (err) {
      setRepError(err instanceof Error ? err.message : String(err));
    } finally {
      setRepBusy(false);
    }
  };

  const handleMintCertificate = async () => {
    if (!anchorWallet || !wallet.connected || !result) return;

    setCertBusy(true);
    setCertError(null);

    try {
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const program = getProgram(provider);
      const cert = await mintLaunchCertificate(
        program,
        connection,
        anchorWallet.publicKey,
        new PublicKey(result.mint)
      );
      const nextCert = {
        signature: cert.signature,
        certificateMint: cert.certificateMint.toString(),
        creatorNftAccount: cert.creatorNftAccount.toString(),
      };

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
        certificateMint: nextCert.certificateMint,
        certificateSignature: nextCert.signature,
      });
      void registerToken({
        mint: result.mint,
        creator: anchorWallet.publicKey.toString(),
        name,
        symbol,
        signature: result.signature,
        launchScore: trustScore,
        lockPercent,
        burnOption: burn,
        certificateMint: nextCert.certificateMint,
        logoUrl: logoDataUrl || null,
        tier,
      }).catch((err) => console.warn("[launch] backend certificate sync failed", err));
      setCertResult(nextCert);
    } catch (err) {
      setCertError(err instanceof Error ? err.message : String(err));
    } finally {
      setCertBusy(false);
    }
  };

  const distributionRows = [
    { label: "Locked", value: lockPercent, color: "var(--green-neon)" },
    { label: "Creator", value: creatorAlloc, color: "var(--solana-purple)" },
    { label: "Curve Liquidity Q", value: curveLiquidity, color: "var(--blue)" },
    {
      label: "Circulation R",
      value: circulation,
      color: validCirc ? "var(--solana-blue)" : "var(--red)",
    },
    { label: "Airdrop A", value: airdrop, color: "var(--yellow)" },
  ];

  return (
    <section className="launch-bg">
      <div className="sec-eyebrow">Launch v2 - Anchor Program - Devnet</div>
      <h2 className="sec-h2">Create your protected v2 token</h2>
      <p className="sec-sub">
        Fixed 1B supply, v2 PDA vaults, Raydium-ready curve treasury, Metaplex metadata,
        creator reputation, and launch certificates.
      </p>

      <div className="create-layout">
        <div className="create-form">
          <div className="form-row">
            <div>
              <label className="form-label">Name (max 16)</label>
              <input
                className="form-input"
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 16))}
                placeholder="My Token"
              />
            </div>
            <div>
              <label className="form-label">Symbol (max 5)</label>
              <input
                className="form-input"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toUpperCase().slice(0, 5))}
                placeholder="MTK"
              />
            </div>
          </div>

          <label className="form-label">Logo (hex shape, max {MAX_LOGO_BYTES / 1000} KB)</label>
          <div className="logo-upload-row">
            <HexLogo src={logoDataUrl || undefined} label={symbol || "TKN"} size={56} />
            <div className="logo-upload-info">
              {logoDataUrl ? "Logo ready, auto-cropped to hex." : "PNG/JPG/SVG, auto-cropped to square."}
              {logoErr && <div className="logo-upload-err">{logoErr}</div>}
            </div>
            <input ref={fileInput} type="file" accept="image/*" onChange={handleLogoSelect} />
            {logoDataUrl ? (
              <button className="logo-upload-btn" onClick={clearLogo} type="button">
                <X size={14} />
              </button>
            ) : (
              <button className="logo-upload-btn" onClick={() => fileInput.current?.click()} type="button">
                <Upload size={14} style={{ display: "inline", marginRight: 6 }} />
                Upload
              </button>
            )}
          </div>

          <label className="form-label">Total supply</label>
          <input className="form-input" value="1,000,000,000 fixed by v2" disabled />

          <label className="form-label">Initial SOL for curve treasury (min 0.5)</label>
          <input
            className="form-input"
            type="number"
            min={0.5}
            step={0.1}
            value={initialLiquiditySol}
            onChange={(event) => setInitialLiquiditySol(event.target.value)}
            style={!validInitialSol ? { borderColor: "var(--red)" } : undefined}
          />

          <div className="slider-group">
            <div className="slider-header">
              <label className="form-label" style={{ margin: 0 }}>Lock percent L (30-80)</label>
              <span className="slider-val">{lockPercent}%</span>
            </div>
            <input
              type="range"
              min={30}
              max={80}
              value={lockPercent}
              onChange={(event) => setLockPercent(Number(event.target.value))}
            />
            <div className="slider-ticks"><span>30%</span><span>55%</span><span>80%</span></div>
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <label className="form-label" style={{ margin: 0 }}>Lock days (30-360)</label>
              <span className="slider-val">{lockDays}d</span>
            </div>
            <input
              type="range"
              min={30}
              max={360}
              value={lockDays}
              onChange={(event) => setLockDays(Number(event.target.value))}
            />
            <div className="slider-ticks"><span>30</span><span>180</span><span>360</span></div>
          </div>

          <label className="form-label">Burn on unlock</label>
          <div className="burn-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {[0, 25, 50].map((value) => (
              <button
                key={value}
                className={"opt-btn " + (burn === value ? "sel" : "")}
                onClick={() => setBurn(value as 0 | 25 | 50)}
                type="button"
              >
                <div className="opt-n">{value}%</div>
                <div className="opt-s">{value === 0 ? "None" : value === 25 ? "Balanced" : "Max score"}</div>
              </button>
            ))}
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <label className="form-label" style={{ margin: 0 }}>Creator allocation C (0-5)</label>
              <span className="slider-val">{creatorAlloc}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              value={creatorAlloc}
              onChange={(event) => setCreatorAlloc(Number(event.target.value))}
            />
            <div className="slider-ticks"><span>0%</span><span>3%</span><span>5%</span></div>
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <label className="form-label" style={{ margin: 0 }}>Curve liquidity Q (25-50)</label>
              <span className="slider-val">{curveLiquidity}%</span>
            </div>
            <input
              type="range"
              min={25}
              max={50}
              value={curveLiquidity}
              onChange={(event) => setCurveLiquidity(Number(event.target.value))}
            />
            <div className="slider-ticks"><span>25%</span><span>38%</span><span>50%</span></div>
          </div>

          <label className="form-label">Airdrop allocation A</label>
          <div className="air-row">
            {[0, 2, 5].map((value) => (
              <button
                key={value}
                className={"air-btn " + (airdrop === value ? "sel" : "")}
                onClick={() => setAirdrop(value as 0 | 2 | 5)}
                type="button"
              >
                {value === 0 ? "Disabled" : `${value}%`}
              </button>
            ))}
          </div>

          <label className="form-label">Tier</label>
          <div className="tier-row">
            <button
              className={"opt-btn " + (tier === 0 ? "sel" : "")}
              onClick={() => setTier(0)}
              type="button"
            >
              <div className="opt-n">$5</div>
              <div className="opt-s">Standard</div>
            </button>
            <button
              className={"opt-btn " + (tier === 1 ? "sel" : "")}
              onClick={() => setTier(1)}
              type="button"
            >
              <div className="opt-n">$25</div>
              <div className="opt-s">Premium</div>
            </button>
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <label className="form-label" style={{ margin: 0 }}>Anti-bot delay (0-600s)</label>
              <span className="slider-val">{antiBot}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={600}
              step={10}
              value={antiBot}
              onChange={(event) => setAntiBot(Number(event.target.value))}
            />
            <div className="slider-ticks"><span>0</span><span>300</span><span>600</span></div>
          </div>

          {!validDistribution && (
            <div
              style={{
                background: "rgba(255,59,59,.08)",
                border: "1px solid rgba(255,59,59,.2)",
                color: "var(--red)",
                padding: ".7rem",
                borderRadius: 8,
                fontSize: ".82rem",
                marginBottom: "1rem",
              }}
            >
              v2 distribution invalid. R must be 15-40, Q+R &gt;= 50, initial SOL &gt;= 0.5.
              Current R = {circulation}% and Q+R = {curveLiquidity + circulation}%.
            </div>
          )}

          {error && (
            <div
              style={{
                background: "rgba(255,59,59,.08)",
                border: "1px solid rgba(255,59,59,.2)",
                color: "var(--red)",
                padding: ".7rem",
                borderRadius: 8,
                fontSize: ".82rem",
                marginBottom: "1rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {error}
            </div>
          )}

          {result && (
            <div
              style={{
                background: "rgba(0,255,148,.08)",
                border: "1px solid rgba(0,255,148,.2)",
                padding: "1rem",
                borderRadius: 8,
                fontSize: ".82rem",
                marginBottom: "1rem",
                lineHeight: 1.7,
              }}
            >
              <div style={{ color: "var(--green-neon)", fontWeight: 700, marginBottom: ".5rem" }}>
                Token created on devnet
              </div>
              <div style={{ color: "var(--muted2)", fontSize: ".75rem", wordBreak: "break-all" }}>
                Mint: {result.mint}
              </div>
              <div style={{ color: "var(--muted2)", fontSize: ".75rem", wordBreak: "break-all" }}>
                Tx: {result.signature}
              </div>
              <a
                href={formatSolscanToken(result.mint)}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--green-neon)", display: "inline-flex", alignItems: "center", gap: 4, marginTop: ".5rem", textDecoration: "none" }}
              >
                View token on Solscan <ExternalLink size={12} />
              </a>
            </div>
          )}

          {result && (
            <div style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  fontFamily: "var(--font-head)",
                  fontWeight: 700,
                  fontSize: ".9rem",
                  color: "var(--text)",
                  marginBottom: ".75rem",
                  borderTop: "1px solid rgba(255,255,255,.07)",
                  paddingTop: "1rem",
                }}
              >
                Next steps
              </div>

              <div style={{ background: "rgba(0,255,148,.05)", border: "1px solid rgba(0,255,148,.15)", borderRadius: 8, padding: ".75rem", marginBottom: ".6rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: ".35rem" }}>
                  <UserCheck size={14} color="var(--green-neon)" />
                  <span style={{ fontSize: ".82rem", fontWeight: 600 }}>Phase 4.5 - Initialize Creator Reputation</span>
                </div>
                <div style={{ fontSize: ".75rem", color: "var(--muted2)", marginBottom: ".5rem" }}>
                  One-time setup. Tracks launches, unlocks, and complaints for the v2 creator record.
                </div>
                {repDone ? (
                  <div style={{ fontSize: ".75rem", color: "var(--green-neon)" }}>Reputation account initialized</div>
                ) : (
                  <>
                    <button
                      onClick={handleInitReputation}
                      disabled={repBusy}
                      style={{ background: "rgba(0,255,148,.1)", border: "1px solid rgba(0,255,148,.3)", color: "var(--green-neon)", borderRadius: 6, padding: ".35rem .75rem", fontSize: ".78rem", cursor: "pointer" }}
                      type="button"
                    >
                      {repBusy ? (
                        <>
                          <Loader size={12} className="spin" style={{ display: "inline", marginRight: 4 }} />
                          Initializing...
                        </>
                      ) : "Init Reputation Account"}
                    </button>
                    {repError && <div style={{ fontSize: ".72rem", color: "var(--red)", marginTop: ".3rem", whiteSpace: "pre-wrap" }}>{repError}</div>}
                  </>
                )}
              </div>

              <div style={{ background: "rgba(20,102,255,.05)", border: "1px solid rgba(20,102,255,.15)", borderRadius: 8, padding: ".75rem", marginBottom: ".6rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: ".35rem" }}>
                  <Award size={14} color="var(--solana-blue)" />
                  <span style={{ fontSize: ".82rem", fontWeight: 600 }}>Phase 4.6 - Mint Launch Certificate</span>
                </div>
                <div style={{ fontSize: ".75rem", color: "var(--muted2)", marginBottom: ".5rem" }}>
                  Creates a Token-2022 NonTransferable certificate mint and links it to the v2 launch PDA.
                </div>
                {certResult ? (
                  <div style={{ fontSize: ".75rem", color: "var(--solana-blue)", lineHeight: 1.7 }}>
                    Certificate minted
                    <div style={{ color: "var(--muted2)", wordBreak: "break-all" }}>Mint: {certResult.certificateMint}</div>
                    <a
                      href={formatSolscanTx(certResult.signature)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--solana-blue)", display: "inline-flex", alignItems: "center", gap: 4, marginTop: ".25rem", textDecoration: "none" }}
                    >
                      View tx <ExternalLink size={12} />
                    </a>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleMintCertificate}
                      disabled={certBusy}
                      style={{ background: "rgba(20,102,255,.1)", border: "1px solid rgba(20,102,255,.3)", color: "var(--solana-blue)", borderRadius: 6, padding: ".35rem .75rem", fontSize: ".78rem", cursor: "pointer" }}
                      type="button"
                    >
                      {certBusy ? (
                        <>
                          <Loader size={12} className="spin" style={{ display: "inline", marginRight: 4 }} />
                          Minting...
                        </>
                      ) : "Mint Certificate NFT"}
                    </button>
                    {certError && <div style={{ fontSize: ".72rem", color: "var(--red)", marginTop: ".3rem", whiteSpace: "pre-wrap" }}>{certError}</div>}
                  </>
                )}
              </div>

              <div style={{ background: "rgba(153,69,255,.05)", border: "1px solid rgba(153,69,255,.15)", borderRadius: 8, padding: ".75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: ".35rem" }}>
                  <Lock size={14} color="var(--solana-purple)" />
                  <span style={{ fontSize: ".82rem", fontWeight: 600 }}>Phase 4 - Lock LP Tokens</span>
                </div>
                <div style={{ fontSize: ".75rem", color: "var(--muted2)" }}>
                  After the Raydium pool is created, the v2 LP lock flow will store LP custody and fee split records.
                </div>
              </div>
            </div>
          )}

          <button
            className="form-sub"
            onClick={handleLaunch}
            disabled={busy || !wallet.connected || !validDistribution || !name || !symbol}
            type="button"
          >
            {busy ? (
              <>
                <Loader size={16} className="spin" style={{ display: "inline", marginRight: 8 }} />
                Launching...
              </>
            ) : (
              <>
                <Rocket size={16} style={{ display: "inline", marginRight: 8 }} />
                {wallet.connected ? "Launch v2 token" : "Connect wallet to launch"}
              </>
            )}
          </button>
        </div>

        <div className="preview-pane">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1.5rem" }}>
            <HexLogo src={logoDataUrl || undefined} label={symbol || "TKN"} size={88} variant={tier === 1 ? "gradient" : "green"} />
            <div style={{ marginTop: ".75rem", fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1.05rem" }}>
              {name || "Token Preview"}
            </div>
            <div style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: ".75rem" }}>
              ${symbol || "TKN"}
            </div>
          </div>

          <div className="preview-label">Expected LaunchScore v2</div>
          <div className="score-ring-wrap">
            <svg width="130" height="130">
              <circle className="ring-track" cx="65" cy="65" r="56" />
              <circle
                className="ring-prog"
                cx="65"
                cy="65"
                r="56"
                style={{ stroke: scoreColor, strokeDasharray: circumference, strokeDashoffset: offset }}
              />
            </svg>
            <div className="score-center">
              <div className="score-big" style={{ color: scoreColor }}>{trustScore}</div>
              <div className="score-lbl">/ 100</div>
              <div className="score-status" style={{ color: scoreColor }}>{scoreLabel}</div>
            </div>
          </div>

          <div className="preview-label">v2 distribution</div>
          <div className="dist-section">
            {distributionRows.map((row) => (
              <div className="dist-row" key={row.label}>
                <div className="dist-hd">
                  <span className="dist-key">{row.label}</span>
                  <span className="dist-pct" style={{ color: row.color }}>{row.value}%</span>
                </div>
                <div className="dist-bar">
                  <div
                    className="dist-fill"
                    style={{ width: `${Math.max(0, row.value)}%`, background: row.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="preview-label" style={{ marginTop: "1.5rem" }}>Creator vesting</div>
          <div style={{ fontSize: ".82rem", color: "var(--muted2)", lineHeight: 1.8 }}>
            Day 30: 33% of creator allocation ({((creatorAlloc * 33) / 100).toFixed(2)}% supply)<br />
            Day 60: 33% of creator allocation ({((creatorAlloc * 33) / 100).toFixed(2)}% supply)<br />
            Day 90: 34% of creator allocation ({((creatorAlloc * 34) / 100).toFixed(2)}% supply)<br />
            Total creator allocation: <span style={{ color: "var(--text)" }}>{creatorAlloc}%</span>
          </div>

          <div className="preview-label" style={{ marginTop: "1.5rem" }}>Curve treasury</div>
          <div style={{ fontSize: ".82rem", color: "var(--muted2)", lineHeight: 1.8 }}>
            Initial SOL: <span style={{ color: "var(--text)" }}>{initialLiquiditySol || "0"} SOL</span><br />
            Q + R liquidity: <span style={{ color: curveLiquidity + circulation >= 50 ? "var(--green-neon)" : "var(--red)" }}>{curveLiquidity + circulation}%</span><br />
            Launch tier: <span style={{ color: "var(--text)" }}>{tier === 1 ? "Premium" : "Standard"}</span>
          </div>
        </div>
      </div>
    </section>
  );
};

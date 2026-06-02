import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Rocket, ExternalLink, Loader, Upload, X, Award, Lock, Unlock, UserCheck, Globe, Twitter, Send } from "lucide-react";
import { motion } from "motion/react";
import { GlassPanel } from "../components/GlassPanel";
import { cn } from "../components/ui/utils";
import {
  PROGRAM_ID_V2_PK,
  getProgram,
  getProgramV2,
  findCreatorReputationV2Pda,
  initCreatorReputation,
  initCreatorReputationV2,
  isProgramExecutable,
  launchToken,
  launchTokenV2,
  mintLaunchCertificateV2,
} from "../../lib/solana/program";
import { fileToHexLogo, MAX_LOGO_BYTES, saveToken } from "../../lib/solana/image";
import { registerToken } from "../../lib/solana/api";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LaunchResult {
  signature: string;
  mint: string;
  certificateSignature?: string;
  certificateMint?: string;
}
type LaunchMode = "checking" | "v1" | "v2";

// ── Constants ─────────────────────────────────────────────────────────────────
const V1_SUPPLY = "1000000000";
const V1_AIRDROPS = [0, 2, 5, 8] as const;

const toV1Airdrop = (value: number): 0 | 2 | 5 | 8 =>
  V1_AIRDROPS.reduce((best, candidate) =>
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best
  );

// ── Inline HexLogo (Tailwind version) ────────────────────────────────────────
function HexLogo({
  src,
  label,
  size = 56,
  variant = "gradient",
}: {
  src?: string;
  label: string;
  size?: number;
  variant?: "gradient" | "green";
}) {
  const borderColor =
    variant === "gradient"
      ? "from-[#B026FF] via-[#00FF41] to-[#B026FF]"
      : "from-[#00FF41] to-[#00cc33]";
  const clip = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      {/* border layer */}
      <div
        style={{ clipPath: clip, width: "100%", height: "100%", padding: 2, position: "absolute", inset: 0 }}
        className={cn("bg-gradient-to-br", borderColor)}
      >
        <div
          style={{ clipPath: clip, width: "100%", height: "100%" }}
          className="bg-[#0a0a12] flex items-center justify-center overflow-hidden"
        >
          {src ? (
            <img src={src} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span
              className="text-white font-bold tracking-wide"
              style={{ fontSize: size * 0.22 }}
            >
              {label.slice(0, 3).toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Input shared style ────────────────────────────────────────────────────────
const inputCls =
  "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00FF41]/50";

const V2_MIN_LOCK_UNITS = 30;
const v2LockUnit = "d";
const v2LockLabel = "Lock days (30–360)";
const v2LockTicks = ["30", "180", "360"];
const v2ScheduleUnit = "Day";

// ── Score color helpers ───────────────────────────────────────────────────────
function getScoreColor(score: number, isV2: boolean) {
  if (isV2) {
    if (score >= 85) return "#00FF41";
    if (score >= 70) return "#14F195";
    if (score >= 40) return "#FFDB2B";
    return "#FF7A2F";
  }
  if (score >= 81) return "#00FF41";
  if (score >= 66) return "#14F195";
  if (score >= 51) return "#FFDB2B";
  return "#FF7A2F";
}

function getScoreLabel(score: number, isV2: boolean) {
  if (isV2) {
    if (score >= 85) return "ELITE";
    if (score >= 70) return "STRONG";
    if (score >= 40) return "OK";
    return "WEAK";
  }
  if (score >= 81) return "PROTECTED";
  if (score >= 66) return "TRUSTED";
  if (score >= 51) return "BASIC";
  return "WEAK";
}

// ── Slider component helper ─────────────────────────────────────────────────
function SliderGroup({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  ticks,
  unit = "",
  title,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  ticks?: string[];
  unit?: string;
  title?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const trackStyle = {
    background: `linear-gradient(to right, #00FF41 ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
  };

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-white/70">{label}</label>
        <span className="text-sm font-bold text-[#00FF41] font-mono px-2 py-0.5 rounded bg-[#00FF41]/10 border border-[#00FF41]/20">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        title={title}
        onChange={(e) => onChange(+e.target.value)}
        className="ht-slider w-full cursor-pointer"
        style={trackStyle}
      />
      {ticks && (
        <div className="flex justify-between mt-1.5">
          {ticks.map((t) => (
            <span key={t} className="text-xs text-white/30">{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function LaunchPage() {
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const fileInput = useRef<HTMLInputElement>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
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
  const [dbSaved, setDbSaved] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [launchMode, setLaunchMode] = useState<LaunchMode>("checking");
  const [programStatusError, setProgramStatusError] = useState<string | null>(null);
  const [walletSolBalance, setWalletSolBalance] = useState<number | null>(null);

  // ── Form state ────────────────────────────────────────────────────────────
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
  const [curveType, setCurveType] = useState<0 | 1>(0);
  const [lpPolicy, setLpPolicy] = useState<0 | 1>(0);
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");

  // ── Program version detection ─────────────────────────────────────────────
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

  // Check on-chain if reputation PDA already exists for this wallet
  useEffect(() => {
    if (!wallet.publicKey) { setRepDone(false); return; }
    let mounted = true;
    const [repPda] = findCreatorReputationV2Pda(wallet.publicKey);
    connection.getAccountInfo(repPda)
      .then(info => { if (mounted) setRepDone(!!info); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [wallet.publicKey, connection]);

  useEffect(() => {
    if (!wallet.publicKey) { setWalletSolBalance(null); return; }
    let mounted = true;
    connection.getBalance(wallet.publicKey).then(l => {
      if (mounted) setWalletSolBalance(l / 1_000_000_000);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [wallet.publicKey, connection]);

  useEffect(() => {
    if (launchMode === "v1") setAirdrop((value) => toV1Airdrop(value));
    if (launchMode === "v2") {
      setAirdrop((value) => Math.min(value, 5));
      setCreatorAlloc((value) => Math.min(value, 5));
      setLockDays((value) => Math.max(V2_MIN_LOCK_UNITS, value));
    }
  }, [launchMode]);

  const isCheckingProgram = launchMode === "checking";
  const isV2Launch = launchMode === "v2";
  const v1Airdrop = useMemo(() => toV1Airdrop(airdrop), [airdrop]);

  // ── Distribution math ─────────────────────────────────────────────────────
  const v2Circulation = useMemo(
    () => Math.max(0, 100 - lockPercent - creatorAlloc - curveLiquidity - airdrop),
    [lockPercent, creatorAlloc, curveLiquidity, airdrop]
  );
  const v1Circulation = useMemo(
    () => 100 - lockPercent - creatorAlloc,
    [lockPercent, creatorAlloc]
  );
  const circulation = isV2Launch ? v2Circulation : v1Circulation;
  const initialSolNum = useMemo(() => Number(initialSol), [initialSol]);
  const maxAffordableSol = walletSolBalance !== null ? Math.max(0, walletSolBalance - 0.01) : null;
  const validInitialSol = !isV2Launch || (Number.isFinite(initialSolNum) && initialSolNum >= 0.5);
  const insufficientSol = isV2Launch && walletSolBalance !== null && initialSolNum > walletSolBalance - 0.01;

  // ── TrustScore (mirrors contract calculate_trust_score_v2) ────────────────
  const trustBreakdown = useMemo(() => {
    const daysScore =
      lockDays >= 360 ? 25 : lockDays >= 270 ? 22 : lockDays >= 180 ? 18 :
      lockDays >= 90  ? 12 : lockDays >= 60  ? 8  : lockDays >= 30 ? 4 : 0;

    const lockPctScore =
      lockPercent >= 70 ? 20 : lockPercent >= 60 ? 17 : lockPercent >= 50 ? 14 :
      lockPercent >= 40 ? 10 : lockPercent >= 30 ? 6  : 0;

    if (!isV2Launch) {
      const burnScore = burn === 50 ? 12 : 6;
      const air = v1Airdrop === 8 ? 10 : v1Airdrop === 5 ? 6 : v1Airdrop === 2 ? 3 : 0;
      const raw = daysScore + lockPctScore + burnScore + air;
      return {
        mode: "v1" as const,
        days: daysScore, lock: lockPctScore,
        creator: 0, curve: 0, circ: 0,
        air, burn: burnScore, raw,
        score: Math.min(100, raw),
      };
    }

    const creator =
      creatorAlloc === 0 ? 15 : creatorAlloc <= 3 ? 12 : creatorAlloc <= 5 ? 9 :
      creatorAlloc <= 8 ? 6 : creatorAlloc <= 10 ? 3 : 0;

    const curve =
      curveLiquidity >= 50 ? 10 : curveLiquidity >= 40 ? 8 : curveLiquidity >= 30 ? 6 :
      curveLiquidity >= 20 ? 3 : 0;

    const circ =
      v2Circulation >= 15 && v2Circulation <= 40 ? 8 :
      (v2Circulation >= 10 && v2Circulation < 15) || (v2Circulation > 40 && v2Circulation <= 60) ? 4 :
      v2Circulation > 60 ? 2 : 0;

    const air =
      airdrop >= 10 ? 10 : airdrop >= 5 ? 8 : airdrop >= 1 ? 5 : 0;

    const burnScore = burn === 50 ? 12 : burn === 25 ? 6 : 0;

    const raw = daysScore + lockPctScore + creator + curve + circ + air + burnScore;
    return {
      mode: "v2" as const,
      days: daysScore, lock: lockPctScore,
      creator, curve, circ, air, burn: burnScore, raw,
      score: Math.min(100, raw),
    };
  }, [isV2Launch, lockDays, lockPercent, creatorAlloc, curveLiquidity, v2Circulation, airdrop, v1Airdrop, burn]);

  // ── Launch preview prices (mirrors on-chain math) ─────────────────────────
  const launchPreview = useMemo(() => {
    if (!isV2Launch) return null;
    const TOTAL_SUPPLY = 1_000_000_000_000_000_000; // 1B with 9 decimals
    const S_init = initialSolNum * 1e9; // lamports
    const T_init = TOTAL_SUPPLY * (curveLiquidity / 100);
    const S_grad = 50 * 1e9; // 50 SOL mainnet graduation target
    if (T_init <= 0 || S_init <= 0) return null;
    const initialPrice = curveType === 1
      ? (2 * S_init * 1e9) / T_init   // quadratic spot price × 1e9
      : (S_init * 1e9) / T_init;       // cpmm spot price × 1e9
    const gradPrice = curveType === 1
      ? (() => {
          const sqrtRatio = Math.sqrt(S_init / S_grad);
          const T_grad = T_init * sqrtRatio;
          return (2 * S_grad * 1e9) / T_grad;
        })()
      : (S_grad * S_grad * 1e9) / (T_init * S_init);
    // Convert to human-readable SOL per million tokens
    const perMillion = (p: number) => (p / 1e9) * 1e6; // SOL per 1M tokens
    return {
      initialPriceSolPerMillion: perMillion(initialPrice).toFixed(6),
      gradPriceSolPerMillion: perMillion(gradPrice).toFixed(4),
      expectedRaiseSol: S_grad / 1e9,
    };
  }, [isV2Launch, initialSolNum, curveLiquidity, curveType]);

  const trustScore = trustBreakdown.score;
  const validDistribution = isV2Launch
    ? v2Circulation >= 15 && v2Circulation <= 40
    : v1Circulation >= 55;
  const validCombinedLiquidity = !isV2Launch || curveLiquidity + v2Circulation >= 50;

  const scoreColor = getScoreColor(trustScore, isV2Launch);
  const scoreLabel = getScoreLabel(trustScore, isV2Launch);
  const circumference = 2 * Math.PI * 56;
  const offset = circumference - (trustScore / 100) * circumference;

  // ── Logo handlers ─────────────────────────────────────────────────────────
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

  const clearLogo = () => {
    setLogoDataUrl(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  // ── Certificate mint ──────────────────────────────────────────────────────
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

  // ── Launch handler ────────────────────────────────────────────────────────
  const handleLaunch = async (testLockDays?: number) => {
    if (!anchorWallet || !wallet.connected) { alert("Connect wallet first"); return; }
    setBusy(true); setError(null); setResult(null);
    setDbSaved(false); setDbError(null);
    setCertDone(false); setCertError(null); setCertMint(null); setCertSignature(null);
    try {
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const v2Available = await isProgramExecutable(connection, PROGRAM_ID_V2_PK).catch(() => false);
      const useV2 = isV2Launch && v2Available;
      setLaunchMode(v2Available ? "v2" : "v1");
      const { signature, mint } = useV2
        ? await launchTokenV2(getProgramV2(provider), anchorWallet.publicKey, {
            name, symbol,
            lockPercent, lockDays: testLockDays ?? lockDays, burnOption: burn,
            creatorAllocation: creatorAlloc,
            curveLiquidityPercent: curveLiquidity,
            circulationPercent: v2Circulation,
            airdropPercent: airdrop,
            initialSol: initialSolNum,
            tier, antiBotSeconds: antiBot,
            curveType, lpPolicy,
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

      const registerInNetwork = async (certificateMint?: string | null) => {
        try {
          const response = await registerToken({
            mint: mintStr,
            creator: anchorWallet.publicKey.toBase58(),
            name, symbol, signature,
            launchScore: trustScore,
            lockPercent,
            burnOption: burn,
            tier,
            certificateMint,
            logoUri: logoDataUrl || null,
            description: description || null,
            website: website || null,
            twitter: twitter || null,
            telegram: telegram || null,
          });
          if (response?.error) throw new Error(response.error);
          setDbSaved(true);
          setDbError(null);
          return true;
        } catch (e: any) {
          const message = e?.message || String(e);
          console.error("[registerToken]", message);
          setDbSaved(false);
          setDbError(message);
          return false;
        }
      };

      await registerInNetwork();

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
          await registerInNetwork(certificateMint);
        }
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || String(e));
    } finally { setBusy(false); }
  };

  // ── Mint certificate (post-launch standalone) ─────────────────────────────
  const handleMintCertificate = async () => {
    if (!result) return;
    const cert = await mintCertificateForMint(result.mint, name);
    if (cert && !cert.alreadyMinted) {
      const certificateMint = cert.certificateMint.toString();
      const certificateSignature = cert.signature;
      setResult((prev) => prev ? { ...prev, certificateMint, certificateSignature } : prev);
      saveToken({
        mint: result.mint,
        name, symbol,
        logo: logoDataUrl || undefined,
        createdAt: Date.now(),
        trustScore, tier,
        signature: result.signature,
        launchMode: "v2",
        hasCertificate: true,
        certificateMint,
        certificateSignature,
      });
    }
  };

  // ── Init reputation handler ───────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-xs font-mono tracking-widest uppercase text-[#00FF41]/70 mb-1">
          Launch · {isV2Launch ? "V2 Curve" : "V1 Live"} · Devnet
        </div>
        <h1 className="text-3xl font-bold text-white">
          Create your{" "}
          <span className="text-[#00FF41]" style={{ textShadow: "0 0 20px rgba(0,255,65,0.4)" }}>
            protected
          </span>{" "}
          token
        </h1>
        <p className="text-white/50 mt-1">All rules enforced on-chain. Trust Score updates in real time.</p>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        {/* ── Left: form ── */}
        <div className="space-y-4">
          {/* Token basics */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <GlassPanel className="p-6" glow="green">
              <h3 className="text-sm font-mono uppercase tracking-widest text-[#00FF41]/70 mb-4">Token Identity</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Name (max 16)</label>
                  <input
                    className={inputCls}
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 16))}
                    placeholder="My Token"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Symbol (max 5)</label>
                  <input
                    className={inputCls}
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 5))}
                    placeholder="MTK"
                  />
                </div>
              </div>

              {/* Logo upload */}
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Logo (hex shape, max {MAX_LOGO_BYTES / 1000} KB)
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                <HexLogo src={logoDataUrl || undefined} label={symbol || "TKN"} size={48} variant="gradient" />
                <div className="flex-1 text-sm text-white/50">
                  {logoDataUrl ? "Logo ready — auto-cropped to hex" : "PNG/JPG/SVG · auto-cropped to square · max 100 KB"}
                  {logoErr && <div className="mt-1 text-red-400 text-xs">{logoErr}</div>}
                </div>
                <input ref={fileInput} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
                {logoDataUrl ? (
                  <button
                    onClick={clearLogo}
                    type="button"
                    className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-red-400/50 text-white/50 hover:text-red-400 transition-all"
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <button
                    onClick={() => fileInput.current?.click()}
                    type="button"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] text-sm hover:bg-[#00FF41]/20 transition-all"
                  >
                    <Upload size={13} />
                    Upload
                  </button>
                )}
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-white/70 mb-1.5">Total Supply</label>
                <input className={inputCls} value="1,000,000,000 fixed" readOnly />
              </div>

              {/* Description */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Description <span className="text-white/30 font-normal">(optional · max 200 chars)</span>
                </label>
                <textarea
                  className={cn(inputCls, "resize-none h-20 py-2.5")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                  placeholder="Short description visible on the token page…"
                />
                <p className="text-white/25 text-xs mt-0.5 text-right">{description.length}/200</p>
              </div>

              {/* Social links */}
              <div className="mt-3">
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Social Links <span className="text-white/30 font-normal">(optional)</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative">
                    <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                    <input
                      className={cn(inputCls, "pl-9 text-sm")}
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="Website URL"
                    />
                  </div>
                  <div className="relative">
                    <Twitter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                    <input
                      className={cn(inputCls, "pl-9 text-sm")}
                      value={twitter}
                      onChange={(e) => setTwitter(e.target.value)}
                      placeholder="Twitter / X"
                    />
                  </div>
                  <div className="relative">
                    <Send size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                    <input
                      className={cn(inputCls, "pl-9 text-sm")}
                      value={telegram}
                      onChange={(e) => setTelegram(e.target.value)}
                      placeholder="Telegram"
                    />
                  </div>
                </div>
              </div>
            </GlassPanel>
          </motion.div>

          {/* Lock & distribution */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <GlassPanel className="p-6">
              <h3 className="text-sm font-mono uppercase tracking-widest text-[#00FF41]/70 mb-4">Lock & Distribution</h3>

              {isV2Launch && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-white/70">Initial Liquidity (SOL)</label>
                    {walletSolBalance !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/40">
                          Wallet: <span className={cn("font-mono font-semibold", insufficientSol ? "text-red-400" : "text-white/70")}>◎ {walletSolBalance.toFixed(4)}</span>
                        </span>
                        {maxAffordableSol !== null && (
                          <button
                            type="button"
                            onClick={() => setInitialSol(Math.max(0.5, maxAffordableSol).toFixed(2))}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-[#00FF41]/10 border border-[#00FF41]/20 text-[#00FF41] hover:bg-[#00FF41]/20 transition-all"
                          >
                            MAX
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    className={cn(inputCls, (!validInitialSol || insufficientSol) && "border-red-500/60 focus:border-red-500/60")}
                    type="number"
                    min={0.5}
                    step={0.1}
                    value={initialSol}
                    onChange={(e) => setInitialSol(e.target.value)}
                    title="Used for bonding curve liquidity. Not sent to creator. Not used for Raydium."
                  />
                  {!validInitialSol && (
                    <p className="text-red-400 text-xs mt-1">Initial liquidity must be at least 0.5 SOL.</p>
                  )}
                  {validInitialSol && insufficientSol && (
                    <p className="text-red-400 text-xs mt-1">
                      Insufficient balance — you have ◎ {walletSolBalance!.toFixed(4)} SOL.
                      Max you can use: <button type="button" className="underline" onClick={() => setInitialSol(Math.max(0.5, maxAffordableSol!).toFixed(2))}>◎ {maxAffordableSol!.toFixed(2)} SOL</button>
                    </p>
                  )}
                  <p className="text-white/30 text-xs mt-1">Funds the bonding curve treasury — not sent to creator.</p>
                </div>
              )}

              <SliderGroup
                label="Lock % (30–80)"
                min={30} max={80}
                value={lockPercent}
                onChange={setLockPercent}
                ticks={["30%", "50%", "80%"]}
                unit="%"
              />
              <SliderGroup
                label={isV2Launch ? v2LockLabel : "Lock days (30–360)"}
                min={isV2Launch ? V2_MIN_LOCK_UNITS : 30} max={360}
                value={lockDays}
                onChange={setLockDays}
                ticks={isV2Launch ? v2LockTicks : ["30", "180", "360"]}
                unit={isV2Launch ? v2LockUnit : "d"}
              />

              {/* Burn option */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-white/70 mb-2">Burn on unlock</label>
                <div className="grid grid-cols-2 gap-3">
                  {([25, 50] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setBurn(v)}
                      className={cn(
                        "p-3 rounded-lg border text-left transition-all",
                        burn === v
                          ? "border-[#00FF41]/60 bg-[#00FF41]/10"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      )}
                    >
                      <div className={cn("font-bold text-lg", burn === v ? "text-[#00FF41]" : "text-white")}>
                        {v}%
                      </div>
                      <div className="text-xs text-white/50">
                        {v === 25 ? "Conservative" : "Aggressive (+score)"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <SliderGroup
                label={`Creator allocation (0–${isV2Launch ? 5 : 10}%)`}
                min={0} max={isV2Launch ? 5 : 10}
                value={creatorAlloc}
                onChange={setCreatorAlloc}
                unit="%"
              />

              {isV2Launch && (
                <SliderGroup
                  label="Curve Liquidity % (25–50)"
                  min={25} max={50}
                  value={curveLiquidity}
                  onChange={setCurveLiquidity}
                  ticks={["25%", "35%", "50%"]}
                  unit="%"
                  title="Percentage of supply allocated to bonding curve liquidity."
                />
              )}

              {/* Airdrop */}
              {isV2Launch ? (
                <SliderGroup
                  label="Airdrop allocation (0–5%)"
                  min={0} max={5}
                  value={airdrop}
                  onChange={setAirdrop}
                  unit="%"
                />
              ) : (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-white/70 mb-2">Airdrop config</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {V1_AIRDROPS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAirdrop(value)}
                        className={cn(
                          "p-2 rounded-lg border text-sm font-medium transition-all",
                          v1Airdrop === value
                            ? "border-[#00FF41]/60 bg-[#00FF41]/10 text-[#00FF41]"
                            : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
                        )}
                      >
                        {value === 0 ? "Off" : `${value}%`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tier */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-white/70 mb-2">Tier</label>
                <div className="grid grid-cols-2 gap-3">
                  {([0, 1] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTier(v)}
                      className={cn(
                        "p-3 rounded-lg border text-left transition-all",
                        tier === v
                          ? "border-[#B026FF]/60 bg-[#B026FF]/10"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      )}
                    >
                      <div className={cn("font-bold text-lg", tier === v ? "text-[#B026FF]" : "text-white")}>
                        {v === 0 ? "$5" : "$25"}
                      </div>
                      <div className="text-xs text-white/50">
                        {v === 0 ? "Standard" : "Premium · Featured"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <SliderGroup
                label="Anti-bot delay (0–600s)"
                min={0} max={600} step={10}
                value={antiBot}
                onChange={setAntiBot}
                ticks={["0", "300", "600"]}
                unit="s"
              />

              {isV2Launch && (
                <>
                  {/* Curve type selector */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-white/70 mb-1">Curve Type</label>
                    <p className="text-xs text-white/40 mb-2">Determines how token price responds to each buy and sell.</p>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        {
                          v: 0 as const,
                          label: "Protected CPMM",
                          badge: "Recommended",
                          desc: "Constant-product (x·y=k) — the same formula powering Raydium and Uniswap. Smooth, predictable price impact. Best for most launches.",
                        },
                        {
                          v: 1 as const,
                          label: "Quadratic (Advanced)",
                          badge: null,
                          desc: "Price accelerates as supply dwindles (T²·S=k). Strong scarcity dynamics — higher upside for early buyers, higher volatility risk.",
                        },
                      ]).map(({ v, label, badge, desc }) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setCurveType(v)}
                          className={cn(
                            "p-3 rounded-lg border text-left transition-all",
                            curveType === v
                              ? "border-[#00FF41]/60 bg-[#00FF41]/10"
                              : "border-white/10 bg-white/5 hover:border-white/20"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn("font-bold text-sm", curveType === v ? "text-[#00FF41]" : "text-white")}>{label}</span>
                            {badge && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00FF41]/20 text-[#00FF41] font-mono">{badge}</span>
                            )}
                          </div>
                          <div className="text-white/40 text-xs leading-snug">{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* LP policy selector */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-white/70 mb-1">LP Policy (after graduation)</label>
                    <p className="text-xs text-white/40 mb-2">What happens to Raydium LP tokens when your token graduates to the CPMM pool.</p>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        {
                          v: 0 as const,
                          label: "Lock (Recommended)",
                          desc: "LP tokens locked in a PDA vault on-chain. Liquidity is permanently secured — no one can remove it, ever.",
                        },
                        {
                          v: 1 as const,
                          label: "Burn",
                          desc: "LP tokens burned on graduation. Permanently removes any possibility of liquidity withdrawal.",
                        },
                      ]).map(({ v, label, desc }) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setLpPolicy(v)}
                          className={cn(
                            "p-3 rounded-lg border text-left transition-all",
                            lpPolicy === v
                              ? "border-[#B026FF]/60 bg-[#B026FF]/10"
                              : "border-white/10 bg-white/5 hover:border-white/20"
                          )}
                        >
                          <div className={cn("font-bold text-xs mb-1", lpPolicy === v ? "text-[#B026FF]" : "text-white")}>{label}</div>
                          <div className="text-white/40 text-[10px] leading-snug">{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </GlassPanel>
          </motion.div>

          {/* Status & validation messages */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <GlassPanel className="p-4">
              <div className="text-sm text-blue-300/80 leading-relaxed">
                {isCheckingProgram ? (
                  <><strong className="text-blue-300">Checking devnet program.</strong> Verifying the live launch contract before sending.</>
                ) : isV2Launch ? (
                  <><strong className="text-blue-300">V2 devnet launch.</strong> Initial SOL funds the bonding curve treasury PDA. Creator never receives LP, and migration locks LP in a PDA.</>
                ) : (
                  <><strong className="text-blue-300">Devnet launch.</strong> V1 program is live; v2 curve deploy is pending, so Launch uses the deployed token-lock program.</>
                )}
                {programStatusError && (
                  <div className="mt-2 text-white/40 text-xs">{programStatusError}</div>
                )}
              </div>
            </GlassPanel>
          </motion.div>

          {/* Validation errors */}
          {!isV2Launch && !validDistribution && (
            <GlassPanel className="p-4 border-red-500/30 bg-red-500/5">
              <p className="text-red-400 text-sm">
                Circulation = {circulation}% (must be at least 55%). Reduce lock % or creator allocation.
              </p>
            </GlassPanel>
          )}

          {isV2Launch && !validDistribution && (
            <GlassPanel className="p-4 border-red-500/30 bg-red-500/5">
              <p className="text-red-400 text-sm">
                Circulation = {circulation}% (must be between 15% and 40%). Adjust lock, creator, curve, or airdrop.
              </p>
            </GlassPanel>
          )}

          {isV2Launch && validDistribution && !validCombinedLiquidity && (
            <GlassPanel className="p-4 border-red-500/30 bg-red-500/5">
              <p className="text-red-400 text-sm">
                Curve Liquidity % + Circulation % must be at least 50%.
              </p>
            </GlassPanel>
          )}

          {isV2Launch && validDistribution && validCombinedLiquidity && curveLiquidity + circulation < 55 && (
            <GlassPanel className="p-4 border-yellow-500/30 bg-yellow-500/5">
              <p className="text-yellow-400 text-sm">
                For higher TrustScore, recommended liquidity is at least 55%.
              </p>
            </GlassPanel>
          )}

          {error && (
            <GlassPanel className="p-4 border-red-500/30 bg-red-500/5">
              <p className="text-red-400 text-sm break-words">{error}</p>
            </GlassPanel>
          )}

          {/* Launch result */}
          {result && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <GlassPanel className="p-5" glow="green">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[#00FF41] text-lg">✓</span>
                  <span className="text-[#00FF41] font-bold">Token created on devnet</span>
                </div>
                <div className="space-y-1 mb-3">
                  <p className="text-white/40 text-xs font-mono break-all">Mint: {result.mint}</p>
                  <p className="text-white/40 text-xs font-mono break-all">Tx: {result.signature}</p>
                </div>
                <a
                  href={`https://solscan.io/token/${result.mint}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#00FF41] text-sm hover:underline"
                >
                  View on Solscan <ExternalLink size={12} />
                </a>
                {dbSaved && (
                  <p className="text-[#00FF41] text-xs mt-3">✓ Indexed in the network database</p>
                )}
                {dbError && (
                  <p className="text-yellow-400 text-xs mt-3 break-words">
                    Network database index failed: {dbError}
                  </p>
                )}
                {certBusy && (
                  <div className="flex items-center gap-2 mt-3 text-blue-300 text-xs">
                    <Loader size={12} className="animate-spin" /> Minting Launch Certificate NFT...
                  </div>
                )}
                {certDone && (
                  <div className="mt-3 text-xs">
                    <p className="text-[#00FF41]">
                      ✓ Launch Certificate NFT {certMint ? "minted" : "already exists"}
                    </p>
                    {certMint && (
                      <>
                        <p className="text-white/40 font-mono break-all mt-1">Certificate mint: {certMint}</p>
                        <a
                          href={`https://solscan.io/token/${certMint}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[#00FF41] hover:underline mt-1"
                        >
                          View certificate <ExternalLink size={11} />
                        </a>
                      </>
                    )}
                  </div>
                )}
                {certError && (
                  <p className="text-red-400 text-xs mt-2">Certificate NFT: {certError}</p>
                )}
              </GlassPanel>
            </motion.div>
          )}

          {/* Next steps panel */}
          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <GlassPanel className="p-6">
                <h3 className="text-sm font-bold text-white mb-4 border-b border-white/10 pb-3">Next steps</h3>

                {/* Phase 4.5 — Init Reputation */}
                <div className="mb-3 p-4 rounded-lg bg-[#00FF41]/5 border border-[#00FF41]/15">
                  <div className="flex items-center gap-2 mb-2">
                    <UserCheck size={14} className="text-[#00FF41]" />
                    <span className="text-sm font-semibold text-white">Phase 4.5 — Creator Reputation</span>
                  </div>
                  <p className="text-xs text-white/40 mb-1 leading-relaxed">
                    One-time on-chain setup. Creates your creator profile PDA that tracks launches, unlocks, and complaints.
                  </p>
                  <ul className="text-xs text-white/30 mb-3 space-y-0.5 pl-2">
                    <li>• Each token launch is recorded on your profile</li>
                    <li>• Successful unlocks build your track record</li>
                    <li>• Clean history improves your trust standing</li>
                    <li>• Visible to buyers in TrustScore signals</li>
                  </ul>
                  {repDone ? (
                    <div className="flex items-center gap-2 text-xs text-[#00FF41]">
                      <UserCheck size={12} />
                      Reputation account active — your launches are being tracked
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={handleInitReputation}
                        disabled={repBusy || !wallet.connected}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] text-xs hover:bg-[#00FF41]/20 disabled:opacity-50 transition-all"
                      >
                        {repBusy ? (
                          <><Loader size={11} className="animate-spin" />Initializing...</>
                        ) : <><UserCheck size={11} />Init Reputation Account</>}
                      </button>
                      {repError && <p className="text-red-400 text-xs mt-2">{repError}</p>}
                    </>
                  )}
                </div>

                {/* Phase 4.6 — Launch Certificate */}
                <div className="mb-3 p-4 rounded-lg bg-blue-500/5 border border-blue-500/15">
                  <div className="flex items-center gap-2 mb-2">
                    <Award size={14} className="text-blue-400" />
                    <span className="text-sm font-semibold text-white">Phase 4.6 — Mint Launch Certificate (Soulbound)</span>
                  </div>
                  <p className="text-xs text-white/40 mb-3 leading-relaxed">
                    Creates a Token-2022 NonTransferable devnet NFT and links it to an on-chain certificate PDA with lock%, days, score, and timestamp.
                  </p>
                  {certDone ? (
                    <p className="text-xs text-[#00FF41]">✓ Certificate NFT minted</p>
                  ) : (
                    <>
                      <button
                        onClick={handleMintCertificate}
                        disabled={certBusy || !isV2Launch}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {certBusy ? (
                          <><Loader size={11} className="animate-spin" />Minting...</>
                        ) : "Mint Certificate NFT"}
                      </button>
                      {certError && <p className="text-red-400 text-xs mt-2">{certError}</p>}
                    </>
                  )}
                </div>

                {/* Phase 5 — Vault Unlock */}
                <div className="mb-3 p-4 rounded-lg bg-purple-500/5 border border-purple-500/15">
                  <div className="flex items-center gap-2 mb-2">
                    <Unlock size={14} className="text-purple-400" />
                    <span className="text-sm font-semibold text-white">Phase 5 — Unlock Vault (after lock expires)</span>
                  </div>
                  <p className="text-xs text-white/40 mb-1 leading-relaxed">
                    After your lock period expires, go to the <strong className="text-white/60">Trade page</strong> to release the locked tokens to market circulation.
                    The <strong className="text-white/60">Creator Panel</strong> will appear automatically for your wallet.
                  </p>
                  <ul className="text-xs text-white/30 mb-3 space-y-0.5 pl-2">
                    <li>• Tokens release to <strong className="text-white/50">market circulation</strong> — not to your wallet</li>
                    <li>• Creator vesting (your wallet allocation) is claimed separately via T1/T2/T3 buttons</li>
                    <li>• In test mode: 1 lock day = 60 seconds</li>
                  </ul>
                  {result && (
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent("ht:open-trade", { detail: result.mint }))}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs hover:bg-purple-500/20 transition-all"
                    >
                      <Unlock size={11} />
                      Open Trade Page → Creator Panel
                    </button>
                  )}
                </div>

                {/* Phase 4 — Raydium CPMM Migration */}
                <div className="p-4 rounded-lg bg-[#B026FF]/5 border border-[#B026FF]/15">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock size={14} className="text-[#B026FF]" />
                    <span className="text-sm font-semibold text-white">Phase 4 — Raydium CPMM Migration</span>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed mb-2">
                    Target flow: when the curve reaches 50 SOL, v2 migrates PDA reserves into a Raydium CPMM pool and locks LP custody in a PDA. On devnet, graduation triggers at 5 SOL for testing purposes.
                  </p>
                  <p className="text-xs text-white/25 italic">
                    Manual LP input is not enough for the final anti-rug model; the next contract step is real Raydium CPMM CPI.
                  </p>
                </div>
              </GlassPanel>
            </motion.div>
          )}

          {/* Launch button */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <button
              onClick={() => handleLaunch()}
              disabled={
                busy || isCheckingProgram || !wallet.connected ||
                !validDistribution || !validCombinedLiquidity ||
                !validInitialSol || insufficientSol || !name || !symbol
              }
              className="w-full py-4 rounded-lg bg-gradient-to-r from-[#00FF41] to-[#00cc33] text-black font-bold text-lg hover:shadow-[0_0_30px_rgba(0,255,65,0.4)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {busy ? (
                <><Loader size={18} className="animate-spin" />Launching...</>
              ) : isCheckingProgram ? (
                <><Loader size={18} className="animate-spin" />Checking devnet...</>
              ) : (
                <><Rocket size={18} />{wallet.connected ? "Launch token" : "Connect wallet to launch"}</>
              )}
            </button>

            {/* Devnet test shortcut — uses 1-minute lock for quick testing */}
            {isV2Launch && (
              <div className="mt-2 flex justify-center">
                <button
                  onClick={() => handleLaunch(1)}
                  disabled={
                    busy || isCheckingProgram || !wallet.connected ||
                    !validDistribution || !validCombinedLiquidity ||
                    !validInitialSol || insufficientSol || !name || !symbol
                  }
                  className="text-xs px-4 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/35 hover:border-white/20 hover:text-white/55 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  ⚡ Test launch · 1-min lock (devnet only)
                </button>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Right: preview pane ── */}
        <div className="space-y-4 hidden xl:block">
          {/* Token preview card */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <GlassPanel className="p-6" glow="purple">
              <div className="flex flex-col items-center mb-6">
                <HexLogo
                  src={logoDataUrl || undefined}
                  label={symbol || "TKN"}
                  size={80}
                  variant={tier === 1 ? "gradient" : "green"}
                />
                <p className="mt-3 font-bold text-lg text-white">{name || "Token Preview"}</p>
                <p className="text-white/40 font-mono text-sm">${symbol || "TKN"}</p>
              </div>

              {/* Trust Score — neon progress bar */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono uppercase tracking-widest text-white/40">Live Trust Score</span>
                  <span className="font-bold text-lg" style={{ color: scoreColor }}>{trustScore} / 100</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: scoreColor, boxShadow: `0 0 8px ${scoreColor}` }}
                    animate={{ width: `${trustScore}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-white/30">0</span>
                  <span className="text-xs font-semibold" style={{ color: scoreColor }}>{scoreLabel}</span>
                  <span className="text-xs text-white/30">100</span>
                </div>
              </div>

              {/* SVG ring — secondary visual */}
              <div className="flex justify-center mb-5">
                <svg width="110" height="110" className="-rotate-90">
                  <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                  <circle
                    cx="55" cy="55" r="46"
                    fill="none"
                    stroke={scoreColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{ filter: `drop-shadow(0 0 4px ${scoreColor})`, transition: "stroke-dashoffset 0.6s ease" }}
                  />
                </svg>
              </div>
            </GlassPanel>
          </motion.div>

          {/* Launch preview prices */}
          {launchPreview && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.23 }}>
              <GlassPanel className="p-5">
                <h4 className="text-xs font-mono uppercase tracking-widest text-white/40 mb-4">Launch Preview</h4>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Initial price</span>
                    <span className="font-mono text-xs text-[#00FF41]">◎ {launchPreview.initialPriceSolPerMillion} / 1M</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Graduation price</span>
                    <span className="font-mono text-xs text-[#B026FF]">◎ {launchPreview.gradPriceSolPerMillion} / 1M</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Expected raise</span>
                    <span className="font-mono text-xs text-white/70">◎ {launchPreview.expectedRaiseSol} SOL</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-white/10">
                    <span className="text-xs text-white/50">Curve</span>
                    <span className="font-mono text-xs text-white/70">{curveType === 1 ? "Quadratic" : "CPMM"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">LP policy</span>
                    <span className="font-mono text-xs text-white/70">{lpPolicy === 0 ? "Lock" : "Burn"}</span>
                  </div>
                </div>
                <p className="text-white/20 text-[10px] mt-3 leading-relaxed">
                  Prices shown in SOL per 1M tokens. Graduation at ◎50 SOL raised → Raydium CPMM migration.
                </p>
              </GlassPanel>
            </motion.div>
          )}

          {/* Distribution */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
            <GlassPanel className="p-5">
              <h4 className="text-xs font-mono uppercase tracking-widest text-white/40 mb-4">Distribution</h4>
              <div className="space-y-3">
                {[
                  { key: "Locked", pct: lockPercent, color: "#00FF41" },
                  { key: "Creator (vested)", pct: creatorAlloc, color: "#B026FF" },
                  ...(isV2Launch ? [{ key: "Curve Liquidity", pct: curveLiquidity, color: "#FFDB2B" }] : []),
                  {
                    key: "Circulation",
                    pct: Math.max(0, circulation),
                    color: validDistribution ? "#14F195" : "#FF4444",
                  },
                  ...(isV2Launch ? [{ key: "Airdrop", pct: airdrop, color: "rgba(255,255,255,0.3)" }] : []),
                ].map(({ key, pct, color }) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/50">{key}</span>
                      <span className="text-xs font-mono font-bold" style={{ color }}>{pct}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </motion.div>

          {/* TrustScore breakdown */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <GlassPanel className="p-5">
              <h4 className="text-xs font-mono uppercase tracking-widest text-white/40 mb-4">TrustScore Breakdown</h4>
              <div className="space-y-1.5 text-sm">
                {isV2Launch ? (
                  <>
                    <ScoreRow label={`Lock duration (${lockDays}${v2LockUnit})`} val={trustBreakdown.days} max={25} />
                    <ScoreRow label={`Lock percent (${lockPercent}%)`} val={trustBreakdown.lock} max={20} />
                    <ScoreRow label={`Creator % (${creatorAlloc}%)`} val={trustBreakdown.creator} max={15} />
                    <ScoreRow label={`Curve liquidity (${curveLiquidity}%)`} val={trustBreakdown.curve} max={10} />
                    <ScoreRow label={`Airdrop (${airdrop}%)`} val={trustBreakdown.air} max={10} />
                    <ScoreRow label={`Burn (${burn}%)`} val={trustBreakdown.burn} max={12} />
                    <ScoreRow label={`Circulation (${v2Circulation}%)`} val={trustBreakdown.circ} max={8} />
                  </>
                ) : (
                  <>
                    <ScoreRow label={`Lock duration (${lockDays}d)`} val={trustBreakdown.days} max={25} />
                    <ScoreRow label={`Lock percent (${lockPercent}%)`} val={trustBreakdown.lock} max={20} />
                    <ScoreRow label="Airdrop" val={trustBreakdown.air} max={10} />
                    <ScoreRow label="Burn" val={trustBreakdown.burn} max={12} />
                  </>
                )}
                <div className="pt-2 border-t border-white/10 flex justify-between">
                  <span className="text-white/60 text-xs">Raw: {trustBreakdown.raw} / 100</span>
                  <span className="font-bold text-xs" style={{ color: scoreColor }}>
                    LaunchScore: {trustScore} / 100
                  </span>
                </div>
              </div>
            </GlassPanel>
          </motion.div>

          {/* Vesting schedule */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
            <GlassPanel className="p-5">
              <h4 className="text-xs font-mono uppercase tracking-widest text-white/40 mb-3">Vesting Schedule</h4>
              <div className="text-xs text-white/50 leading-loose">
                {isV2Launch ? (
                  <>
                    <p>{v2ScheduleUnit} 30: 33% of creator vault ({(creatorAlloc * 0.33).toFixed(2)}% of supply)</p>
                    <p>{v2ScheduleUnit} 60: 33% of creator vault ({(creatorAlloc * 0.33).toFixed(2)}% of supply)</p>
                    <p>{v2ScheduleUnit} 90: 34% of creator vault ({(creatorAlloc * 0.34).toFixed(2)}% of supply)</p>
                  </>
                ) : (
                  <>
                    <p>Day 30: 2% of creator alloc ({creatorAlloc > 0 ? (0.02 * creatorAlloc).toFixed(2) : "0"}% of supply)</p>
                    <p>Day 60: 3% of creator alloc ({creatorAlloc > 0 ? (0.03 * creatorAlloc).toFixed(2) : "0"}% of supply)</p>
                    <p>Day 90: 5% of creator alloc ({creatorAlloc > 0 ? (0.05 * creatorAlloc).toFixed(2) : "0"}% of supply)</p>
                    <p>Remaining via Add-to-Circulation.</p>
                  </>
                )}
                <p className="mt-1 text-white/70">
                  Total creator: <span className="font-bold text-white">{creatorAlloc}%</span> of supply
                </p>
              </div>
            </GlassPanel>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ── Score row sub-component ───────────────────────────────────────────────────
function ScoreRow({ label, val, max }: { label: string; val: number; max: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/50 text-xs">{label}</span>
      <span className="font-mono text-xs">
        <span className="text-[#00FF41] font-bold">+{val}</span>
        <span className="text-white/30"> / {max}</span>
      </span>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  Rocket, ExternalLink, Loader, Upload, X, Award, Lock, Unlock,
  UserCheck, Globe, Twitter, Send, Check, Copy, ChevronLeft,
  ChevronRight, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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
import { registerToken, recordReputationEvent, uploadLogo } from "../../lib/solana/api";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LaunchResult {
  signature: string;
  mint: string;
  certificateSignature?: string;
  certificateMint?: string;
}
type LaunchMode = "checking" | "v1" | "v2";
type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

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
  "w-full bg-white/5 border border-[#1A2332] rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#00FF41]/50";

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

// ── Step indicator ────────────────────────────────────────────────────────────
const STEP_LABELS: Record<WizardStep, string> = {
  1: "Basics",
  2: "Identity",
  3: "Social",
  4: "Security",
  5: "Review",
  6: "Launch",
};

function StepIndicator({ step, completedSteps }: { step: WizardStep; completedSteps: Set<number> }) {
  const steps: WizardStep[] = [1, 2, 3, 4, 5, 6];
  return (
    <div className="flex items-center justify-center gap-0 mb-8 select-none">
      {steps.map((s, i) => {
        const isActive = s === step;
        const isDone = completedSteps.has(s) && s !== step;
        const isFuture = s > step && !completedSteps.has(s);
        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono border-2 transition-all duration-300",
                  isActive && "border-[#00FF41] bg-[#00FF41]/20 text-[#00FF41] shadow-[0_0_12px_rgba(0,255,65,0.4)]",
                  isDone && "border-[#00FF41]/60 bg-[#00FF41]/10 text-[#00FF41]",
                  isFuture && "border-white/15 bg-white/5 text-white/30",
                )}
              >
                {isDone ? <Check size={13} /> : s}
              </div>
              <span
                className={cn(
                  "text-[9px] font-mono uppercase tracking-widest hidden sm:block transition-colors duration-300",
                  isActive && "text-[#00FF41]",
                  isDone && "text-[#00FF41]/60",
                  isFuture && "text-white/25",
                )}
              >
                {STEP_LABELS[s]}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "w-8 sm:w-12 h-px mx-1 sm:mx-2 transition-colors duration-300",
                  (isDone || (s < step)) ? "bg-[#00FF41]/40" : "bg-white/10",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Wizard Nav ────────────────────────────────────────────────────────────────
function WizardNav({
  step,
  onBack,
  onNext,
  onLaunch,
  onTestLaunch,
  nextDisabled,
  launchDisabled,
  busy,
  isCheckingProgram,
  isV2Launch,
  walletConnected,
}: {
  step: WizardStep;
  onBack: () => void;
  onNext: () => void;
  onLaunch: () => void;
  onTestLaunch: () => void;
  nextDisabled: boolean;
  launchDisabled: boolean;
  busy: boolean;
  isCheckingProgram: boolean;
  isV2Launch: boolean;
  walletConnected: boolean;
}) {
  const isLastStep = step === 6;
  const isReview = step === 5;

  return (
    <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-[#1A2332]">
      <button
        type="button"
        onClick={onBack}
        disabled={step === 1}
        className={cn(
          "flex items-center gap-2 px-5 py-2.5 rounded-lg border text-sm font-medium transition-all",
          step === 1
            ? "border-white/10 text-white/20 cursor-not-allowed"
            : "border-white/20 text-white/60 hover:border-white/40 hover:text-white",
        )}
      >
        <ChevronLeft size={15} /> Back
      </button>

      <div className="flex items-center gap-2">
        {isLastStep ? (
          <>
            <button
              type="button"
              onClick={onLaunch}
              disabled={launchDisabled}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#00FF41] to-[#00cc33] text-black font-bold text-sm hover:shadow-[0_0_24px_rgba(0,255,65,0.4)] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? (
                <><Loader size={15} className="animate-spin" />Launching...</>
              ) : isCheckingProgram ? (
                <><Loader size={15} className="animate-spin" />Checking...</>
              ) : (
                <><Rocket size={15} />{walletConnected ? "Launch Token" : "Connect Wallet"}</>
              )}
            </button>
            {isV2Launch && (
              <button
                type="button"
                onClick={onTestLaunch}
                disabled={launchDisabled}
                className="text-xs px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 text-white/35 hover:border-white/20 hover:text-white/55 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                ⚡ Test
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={isReview ? onLaunch : onNext}
            disabled={isReview ? launchDisabled : nextDisabled}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all active:scale-[0.98]",
              isReview
                ? "bg-gradient-to-r from-[#00FF41] to-[#00cc33] text-black hover:shadow-[0_0_24px_rgba(0,255,65,0.4)] disabled:opacity-40 disabled:cursor-not-allowed"
                : "bg-[#00FF41]/15 border border-[#00FF41]/40 text-[#00FF41] hover:bg-[#00FF41]/25 disabled:opacity-30 disabled:cursor-not-allowed",
            )}
          >
            {isReview ? (
              <><Rocket size={15} />{walletConnected ? "Launch Token" : "Connect Wallet"}</>
            ) : (
              <>Next <ChevronRight size={15} /></>
            )}
          </button>
        )}
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

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="p-1.5 rounded bg-white/5 border border-white/10 hover:border-[#00FF41]/40 text-white/40 hover:text-[#00FF41] transition-all"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
}

// ── Review row ────────────────────────────────────────────────────────────────
function ReviewRow({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/40 shrink-0 w-28">{label}</span>
      <span className={cn("text-xs font-mono text-right break-all", dim ? "text-white/30" : "text-white/80")}>
        {value}
      </span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function LaunchPage() {
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const fileInput = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // ── Wizard step state ─────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1); // 1=forward, -1=back

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
  const [isDragging, setIsDragging] = useState(false);
  const [launchPhase, setLaunchPhase] = useState<
    "idle" | "launching" | "signing" | "confirming" | "minting-cert" | "success"
  >("idle");

  // ── Form state ────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [lockPercent, setLockPercent] = useState(40);
  const [lockDays, setLockDays] = useState(90);
  const [burn, setBurn] = useState<0 | 25 | 50 | 75 | 100>(50);
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
  const [testMode, setTestMode] = useState(false);

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
      const burnScore = burn === 50 ? 12 : burn === 25 ? 6 : 0;
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
    const TOTAL_SUPPLY = 1_000_000_000_000_000_000;
    const S_init = initialSolNum * 1e9;
    const T_init = TOTAL_SUPPLY * (curveLiquidity / 100);
    const S_grad = 50 * 1e9;
    if (T_init <= 0 || S_init <= 0) return null;
    const initialPrice = curveType === 1
      ? (2 * S_init * 1e9) / T_init
      : (S_init * 1e9) / T_init;
    const gradPrice = curveType === 1
      ? (() => {
          const sqrtRatio = Math.sqrt(S_init / S_grad);
          const T_grad = T_init * sqrtRatio;
          return (2 * S_grad * 1e9) / T_grad;
        })()
      : (S_grad * S_grad * 1e9) / (T_init * S_init);
    if (!Number.isFinite(gradPrice) || !Number.isFinite(initialPrice)) return null;
    const perMillion = (p: number) => (p / 1e9) * 1e6;
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

  // ── Step validation ───────────────────────────────────────────────────────
  const step1Valid = name.trim().length > 0 && symbol.trim().length > 0;
  const step4Valid = validDistribution && validCombinedLiquidity && validInitialSol && !insufficientSol;
  const canLaunch =
    step1Valid && step4Valid &&
    !busy && !isCheckingProgram && wallet.connected &&
    name.trim().length > 0 && symbol.trim().length > 0;

  // ── Logo handlers ─────────────────────────────────────────────────────────
  const processLogoFile = async (file: File) => {
    setLogoErr(null);
    try {
      const dataUrl = await fileToHexLogo(file, 256);
      setLogoDataUrl(dataUrl);
    } catch (err: any) {
      setLogoErr(err.message);
      setLogoDataUrl(null);
    }
  };

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processLogoFile(file);
  };

  const clearLogo = () => {
    setLogoDataUrl(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoErr("Please drop an image file.");
      return;
    }
    await processLogoFile(file);
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
    if (!anchorWallet || !wallet.connected) { setError("Connect wallet first"); return; }
    setBusy(true); setError(null); setResult(null);
    setDbSaved(false); setDbError(null);
    setCertDone(false); setCertError(null); setCertMint(null); setCertSignature(null);
    setLaunchPhase("launching");
    // Navigate to step 6 immediately so user sees progress
    if (step !== 6) {
      setSlideDirection(1);
      setStep(6);
    }
    try {
      setLaunchPhase("signing");
      const provider = new AnchorProvider(connection, anchorWallet, AnchorProvider.defaultOptions());
      const v2Available = await isProgramExecutable(connection, PROGRAM_ID_V2_PK).catch(() => false);
      const useV2 = isV2Launch && v2Available;
      setLaunchMode(v2Available ? "v2" : "v1");
      const isTestLaunch = testLockDays !== undefined || testMode;
      const effectiveLockDays = testLockDays ?? (testMode ? 1 : lockDays);

      setLaunchPhase("confirming");
      const { signature, mint } = useV2
        ? await launchTokenV2(getProgramV2(provider), anchorWallet.publicKey, {
            name, symbol,
            lockPercent, lockDays: effectiveLockDays, burnOption: burn as 25 | 50,
            creatorAllocation: creatorAlloc,
            curveLiquidityPercent: curveLiquidity,
            circulationPercent: v2Circulation,
            airdropPercent: airdrop,
            initialSol: initialSolNum,
            tier, antiBotSeconds: antiBot,
            curveType, lpPolicy,
            isTest: isTestLaunch,
          })
        : await launchToken(getProgram(provider), anchorWallet.publicKey, {
            name, symbol, totalSupply: V1_SUPPLY,
            lockPercent, lockDays: effectiveLockDays, burnOption: burn as 25 | 50,
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
          let resolvedLogoUri: string | null = null;
          if (logoDataUrl) {
            try {
              resolvedLogoUri = await uploadLogo(logoDataUrl);
            } catch {
              resolvedLogoUri = logoDataUrl;
            }
          }
          const response = await registerToken({
            mint: mintStr,
            creator: anchorWallet.publicKey.toBase58(),
            name, symbol, signature,
            launchScore: trustScore,
            lockPercent,
            burnOption: burn as 25 | 50,
            tier,
            certificateMint,
            logoUri: resolvedLogoUri,
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
        try {
          const [repPda] = findCreatorReputationV2Pda(anchorWallet.publicKey);
          const existing = await connection.getAccountInfo(repPda);
          if (!existing) {
            await initCreatorReputationV2(getProgramV2(provider), anchorWallet.publicKey);
            setRepDone(true);
          }
        } catch { /* non-critical */ }

        void recordReputationEvent(mintStr, anchorWallet.publicKey.toBase58(), 1).catch(() => {});

        setLaunchPhase("minting-cert");
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

      setLaunchPhase("success");
    } catch (e: any) {
      console.error(e);
      setError(e.message || String(e));
      setLaunchPhase("idle");
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

  // ── Step navigation ───────────────────────────────────────────────────────
  const goNext = () => {
    setCompletedSteps(prev => new Set([...prev, step]));
    setSlideDirection(1);
    setStep((s) => Math.min(6, s + 1) as WizardStep);
  };

  const goBack = () => {
    setSlideDirection(-1);
    setStep((s) => Math.max(1, s - 1) as WizardStep);
  };

  // ── Step content variants for animation ──────────────────────────────────
  const stepVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
  };

  // ── Preview panel (right side) ────────────────────────────────────────────
  const PreviewPanel = () => (
    <div className="space-y-4">
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

        <div className="flex justify-center mb-2">
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

      {launchPreview && (
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
        </GlassPanel>
      )}

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
              <p>Day 30: 2% of creator alloc</p>
              <p>Day 60: 3% of creator alloc</p>
              <p>Day 90: 5% of creator alloc</p>
              <p>Remaining via Add-to-Circulation.</p>
            </>
          )}
          <p className="mt-1 text-white/70">
            Total creator: <span className="font-bold text-white">{creatorAlloc}%</span> of supply
          </p>
        </div>
      </GlassPanel>
    </div>
  );

  // ── Step render functions ─────────────────────────────────────────────────

  // Step 1: BASICS
  const renderStep1 = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-mono uppercase tracking-widest text-[#00FF41]/70 mb-4">Token Basics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Token Name <span className="text-red-400">*</span>
              <span className="text-white/30 font-normal ml-1">(max 32)</span>
            </label>
            <input
              className={cn(inputCls, !name && "border-white/20")}
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 32))}
              placeholder="My Token"
              autoFocus
            />
            <p className="text-white/25 text-xs mt-0.5 text-right">{name.length}/32</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Symbol <span className="text-red-400">*</span>
              <span className="text-white/30 font-normal ml-1">(max 10)</span>
            </label>
            <input
              className={cn(inputCls, !symbol && "border-white/20")}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 10))}
              placeholder="MTK"
            />
            <p className="text-white/25 text-xs mt-0.5 text-right">{symbol.length}/10</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">
            Description <span className="text-white/30 font-normal">(optional · max 200 chars)</span>
          </label>
          <textarea
            className={cn(inputCls, "resize-none h-24 py-2.5")}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 200))}
            placeholder="Short description visible on the token page…"
          />
          <p className="text-white/25 text-xs mt-0.5 text-right">{description.length}/200</p>
        </div>

        <div className="mt-3 p-3 rounded-lg bg-white/3 border border-white/8">
          <p className="text-xs text-white/30">
            <span className="text-white/50 font-medium">Total Supply:</span> 1,000,000,000 tokens (fixed) · 9 decimals
          </p>
        </div>
      </div>

      {!step1Valid && (name || symbol) && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
          <AlertTriangle size={13} className="text-red-400 shrink-0" />
          <p className="text-red-400 text-xs">Token name and symbol are required to continue.</p>
        </div>
      )}
    </div>
  );

  // Step 2: IDENTITY (Logo)
  const renderStep2 = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-mono uppercase tracking-widest text-[#00FF41]/70 mb-1">Token Identity</h3>
        <p className="text-xs text-white/40 mb-4">Upload a logo to make your token recognizable. This is optional but recommended.</p>
      </div>

      {/* Drag-drop area */}
      <div
        ref={dropZoneRef}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !logoDataUrl && fileInput.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center gap-4 p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer",
          isDragging
            ? "border-[#00FF41]/60 bg-[#00FF41]/5"
            : logoDataUrl
            ? "border-[#00FF41]/30 bg-[#00FF41]/5 cursor-default"
            : "border-white/15 bg-white/3 hover:border-white/25 hover:bg-white/5",
        )}
      >
        {logoDataUrl ? (
          <div className="flex flex-col items-center gap-3">
            <HexLogo src={logoDataUrl} label={symbol || "TKN"} size={96} variant="gradient" />
            <p className="text-[#00FF41] text-sm font-medium">Logo ready — auto-cropped to hex</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearLogo(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs hover:bg-red-500/20 transition-all"
            >
              <X size={11} /> Remove logo
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/15 flex items-center justify-center">
              <Upload size={24} className="text-white/30" />
            </div>
            <div>
              <p className="text-white/60 text-sm font-medium">Drop image here or click to browse</p>
              <p className="text-white/30 text-xs mt-1">PNG · JPG · SVG · max {MAX_LOGO_BYTES / 1000} KB</p>
            </div>
          </div>
        )}

        {isDragging && (
          <div className="absolute inset-0 rounded-xl bg-[#00FF41]/10 flex items-center justify-center pointer-events-none">
            <p className="text-[#00FF41] font-bold">Drop to upload</p>
          </div>
        )}
      </div>

      <input ref={fileInput} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />

      {logoErr && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
          <AlertTriangle size={13} className="text-red-400 shrink-0" />
          <p className="text-red-400 text-xs">{logoErr}</p>
        </div>
      )}

      {/* Preview row */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-white/3 border border-white/8">
        <HexLogo src={logoDataUrl || undefined} label={symbol || "TKN"} size={48} variant="gradient" />
        <div>
          <p className="text-white text-sm font-medium">{name || "Token Preview"}</p>
          <p className="text-white/40 font-mono text-xs">${symbol || "TKN"}</p>
        </div>
      </div>
    </div>
  );

  // Step 3: SOCIAL
  const renderStep3 = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-mono uppercase tracking-widest text-[#00FF41]/70 mb-1">Social Links</h3>
        <p className="text-xs text-white/40 mb-4">All fields are optional. These appear on your token's page.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5 flex items-center gap-2">
            <Globe size={13} className="text-white/40" /> Website URL
          </label>
          <input
            className={inputCls}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://mytoken.xyz"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5 flex items-center gap-2">
            <Twitter size={13} className="text-white/40" /> Twitter / X
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none">@</span>
            <input
              className={cn(inputCls, "pl-8")}
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              placeholder="mytoken"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5 flex items-center gap-2">
            <Send size={13} className="text-white/40" /> Telegram
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none">t.me/</span>
            <input
              className={cn(inputCls, "pl-14")}
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="mytoken_chat"
            />
          </div>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-white/3 border border-white/8">
        <p className="text-xs text-white/30">
          Social links are stored off-chain in our database and displayed on your token's public page.
          They are not stored on the Solana blockchain.
        </p>
      </div>
    </div>
  );

  // Step 4: SECURITY
  const renderStep4 = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-mono uppercase tracking-widest text-[#00FF41]/70 mb-1">Security Settings</h3>
        <p className="text-xs text-white/40 mb-4">
          These settings are enforced on-chain and affect your Trust Score.
        </p>
      </div>

      {/* Program version info */}
      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 text-xs text-blue-300/70">
        {isCheckingProgram ? (
          <span className="flex items-center gap-2"><Loader size={11} className="animate-spin" /> Checking devnet program...</span>
        ) : isV2Launch ? (
          <><strong className="text-blue-300">V2 devnet</strong> — bonding curve + Raydium CPMM graduation. Funds the curve treasury PDA.</>
        ) : (
          <><strong className="text-blue-300">V1 devnet</strong> — token-lock program is live. V2 curve deploy pending.</>
        )}
        {programStatusError && <div className="mt-1 text-white/30">{programStatusError}</div>}
      </div>

      {isV2Launch && (
        <div>
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
            title="Used for bonding curve liquidity."
          />
          {!validInitialSol && <p className="text-red-400 text-xs mt-1">Minimum 0.5 SOL required.</p>}
          {validInitialSol && insufficientSol && (
            <p className="text-red-400 text-xs mt-1">
              Insufficient balance — max available:{" "}
              <button type="button" className="underline" onClick={() => setInitialSol(Math.max(0.5, maxAffordableSol!).toFixed(2))}>
                ◎ {maxAffordableSol!.toFixed(2)} SOL
              </button>
            </p>
          )}
          <p className="text-white/30 text-xs mt-1">Funds bonding curve treasury — not sent to creator.</p>
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
        min={isV2Launch ? V2_MIN_LOCK_UNITS : 30} max={isV2Launch ? 600 : 360}
        value={lockDays}
        onChange={setLockDays}
        ticks={isV2Launch ? ["30", "300", "600"] : ["30", "180", "360"]}
        unit={isV2Launch ? v2LockUnit : "d"}
      />

      {/* Burn option */}
      <div>
        <label className="block text-sm font-medium text-white/70 mb-2">Burn on unlock</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([0, 25, 50, 75, 100] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setBurn(v)}
              className={cn(
                "p-3 rounded-lg border text-center transition-all",
                burn === v
                  ? "border-[#00FF41]/60 bg-[#00FF41]/10"
                  : "border-white/10 bg-white/5 hover:border-white/20"
              )}
            >
              <div className={cn("font-bold text-base", burn === v ? "text-[#00FF41]" : "text-white")}>
                {v}%
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">
                {v === 0 ? "None" : v === 25 ? "Low" : v === 50 ? "Mid (+score)" : v === 75 ? "High" : "Max"}
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
      <div>
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
                {v === 0 ? "Standard" : "Premium"}
              </div>
              <div className="text-xs text-white/50 mt-0.5">
                {v === 0 ? "~0.057 SOL · standard listing" : "~0.28 SOL · featured + Zodiac Badge"}
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
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Curve Type</label>
            <p className="text-xs text-white/40 mb-2">Determines how token price responds to each buy and sell.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                {
                  v: 0 as const,
                  label: "Protected CPMM",
                  badge: "Recommended",
                  desc: "Constant-product (x·y=k). Smooth, predictable price impact.",
                },
                {
                  v: 1 as const,
                  label: "Quadratic",
                  badge: null,
                  desc: "Price accelerates as supply dwindles (T²·S=k). Higher volatility.",
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

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">LP Policy (after graduation)</label>
            <p className="text-xs text-white/40 mb-2">What happens to Raydium LP tokens on graduation.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                {
                  v: 0 as const,
                  label: "Lock (Recommended)",
                  desc: "LP tokens locked in PDA vault — liquidity permanently secured.",
                },
                {
                  v: 1 as const,
                  label: "Burn",
                  desc: "LP tokens burned on graduation — permanent removal.",
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

          {/* Test mode toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/3 border border-white/10">
            <div>
              <p className="text-sm text-white/70 font-medium">Test mode</p>
              <p className="text-xs text-white/35 mt-0.5">Uses 1-min lock (devnet only). Migration at 5 SOL.</p>
            </div>
            <button
              type="button"
              onClick={() => setTestMode(v => !v)}
              className={cn(
                "w-11 h-6 rounded-full transition-all relative",
                testMode ? "bg-[#00FF41]/40 border border-[#00FF41]/60" : "bg-white/10 border border-white/20",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-5 h-5 rounded-full transition-all",
                  testMode ? "left-5 bg-[#00FF41]" : "left-0.5 bg-white/40",
                )}
              />
            </button>
          </div>
        </>
      )}

      {/* Validation errors */}
      {!validDistribution && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
          <AlertTriangle size={13} className="text-red-400 shrink-0" />
          <p className="text-red-400 text-xs">
            {isV2Launch
              ? `Circulation = ${circulation}% (must be 15–40%). Adjust lock, creator, curve, or airdrop.`
              : `Circulation = ${circulation}% (must be at least 55%). Reduce lock % or creator allocation.`}
          </p>
        </div>
      )}
      {isV2Launch && validDistribution && !validCombinedLiquidity && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
          <AlertTriangle size={13} className="text-red-400 shrink-0" />
          <p className="text-red-400 text-xs">Curve Liquidity % + Circulation % must be at least 50%.</p>
        </div>
      )}
    </div>
  );

  // Step 5: REVIEW
  const renderStep5 = () => (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-mono uppercase tracking-widest text-[#00FF41]/70 mb-1">Review & Confirm</h3>
        <p className="text-xs text-white/40 mb-4">Review all settings before launching. You cannot change these after launch.</p>
      </div>

      {/* Token identity summary */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-4 mb-4">
          <HexLogo src={logoDataUrl || undefined} label={symbol || "TKN"} size={64} variant={tier === 1 ? "gradient" : "green"} />
          <div>
            <p className="text-white font-bold text-lg">{name || <span className="text-white/30">—</span>}</p>
            <p className="text-white/50 font-mono text-sm">${symbol || "—"}</p>
            {tier === 1 && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#B026FF]/20 border border-[#B026FF]/30 text-[#B026FF]">PREMIUM</span>
            )}
          </div>
        </div>

        <h4 className="text-xs font-mono uppercase tracking-widest text-white/30 mb-2">Identity</h4>
        <ReviewRow label="Name" value={name || "—"} dim={!name} />
        <ReviewRow label="Symbol" value={symbol || "—"} dim={!symbol} />
        <ReviewRow label="Description" value={description || "(none)"} dim={!description} />
        <ReviewRow label="Logo" value={logoDataUrl ? "Uploaded" : "(none)"} dim={!logoDataUrl} />
      </GlassPanel>

      {/* Social */}
      <GlassPanel className="p-4">
        <h4 className="text-xs font-mono uppercase tracking-widest text-white/30 mb-2">Social Links</h4>
        <ReviewRow label="Website" value={website || "(none)"} dim={!website} />
        <ReviewRow label="Twitter" value={twitter ? `@${twitter}` : "(none)"} dim={!twitter} />
        <ReviewRow label="Telegram" value={telegram ? `t.me/${telegram}` : "(none)"} dim={!telegram} />
      </GlassPanel>

      {/* Security settings */}
      <GlassPanel className="p-4">
        <h4 className="text-xs font-mono uppercase tracking-widest text-white/30 mb-2">Security Settings</h4>
        <ReviewRow label="Lock %" value={`${lockPercent}%`} />
        <ReviewRow label="Lock days" value={`${testMode ? "1 (test)" : lockDays} ${isV2Launch ? v2LockUnit : "days"}`} />
        <ReviewRow label="Burn on unlock" value={`${burn}%`} />
        <ReviewRow label="Creator alloc" value={`${creatorAlloc}%`} />
        {isV2Launch && <ReviewRow label="Curve liquidity" value={`${curveLiquidity}%`} />}
        {isV2Launch && <ReviewRow label="Circulation" value={`${v2Circulation}%`} />}
        {isV2Launch && <ReviewRow label="Airdrop" value={`${airdrop}%`} />}
        {isV2Launch && <ReviewRow label="Initial SOL" value={`◎ ${initialSol}`} />}
        <ReviewRow label="Tier" value={tier === 0 ? "Standard" : "Premium"} />
        <ReviewRow label="Anti-bot delay" value={`${antiBot}s`} />
        {isV2Launch && <ReviewRow label="Curve type" value={curveType === 0 ? "Protected CPMM" : "Quadratic"} />}
        {isV2Launch && <ReviewRow label="LP policy" value={lpPolicy === 0 ? "Lock" : "Burn"} />}
        {isV2Launch && testMode && <ReviewRow label="Test mode" value="ENABLED — 1-min lock" />}
      </GlassPanel>

      {/* Trust Score summary */}
      <GlassPanel className="p-4">
        <h4 className="text-xs font-mono uppercase tracking-widest text-white/30 mb-3">Trust Score</h4>
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-bold" style={{ color: scoreColor }}>{trustScore}</span>
          <span className="text-xs font-mono px-2 py-1 rounded border" style={{ color: scoreColor, borderColor: `${scoreColor}40` }}>
            {scoreLabel}
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${trustScore}%`, background: scoreColor, boxShadow: `0 0 8px ${scoreColor}` }}
          />
        </div>

        {/* Estimated cost */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <p className="text-xs text-white/40 mb-2">Estimated cost</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/60">Platform fee</span>
            <span className="font-mono text-xs text-white/80">{tier === 0 ? "~0.057 SOL" : "~0.28 SOL"}</span>
          </div>
          {isV2Launch && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-white/60">Initial liquidity</span>
              <span className="font-mono text-xs text-white/80">◎ {initialSol} SOL</span>
            </div>
          )}
        </div>
      </GlassPanel>

      {!canLaunch && !busy && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#FFDB2B]/5 border border-[#FFDB2B]/20">
          <AlertTriangle size={13} className="text-[#FFDB2B] shrink-0" />
          <p className="text-[#FFDB2B] text-xs">
            {!wallet.connected
              ? "Connect your wallet to launch."
              : !step1Valid
              ? "Token name and symbol are required."
              : !step4Valid
              ? "Fix security settings before launching."
              : ""}
          </p>
        </div>
      )}
    </div>
  );

  // Step 6: LAUNCH
  const renderStep6 = () => {
    const phaseLabels = {
      idle: "Ready to launch",
      launching: "Initializing launch...",
      signing: "Awaiting wallet signature...",
      confirming: "Confirming transaction...",
      "minting-cert": "Minting Launch Certificate...",
      success: "Token launched successfully!",
    };

    const phases = ["launching", "signing", "confirming", "minting-cert", "success"] as const;
    const currentPhaseIdx = phases.indexOf(launchPhase as typeof phases[number]);

    if (launchPhase === "success" && result) {
      return (
        <div className="space-y-5">
          {/* Success header */}
          <div className="text-center py-6">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-full bg-[#00FF41]/15 border-2 border-[#00FF41]/50 flex items-center justify-center mx-auto mb-4"
              style={{ boxShadow: "0 0 40px rgba(0,255,65,0.3)" }}
            >
              <CheckCircle2 size={36} className="text-[#00FF41]" />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-white"
            >
              Token Launched!
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-white/40 text-sm mt-1"
            >
              {name} (${symbol}) is now live on Solana devnet
            </motion.p>
          </div>

          {/* Mint address */}
          <GlassPanel className="p-4" glow="green">
            <h4 className="text-xs font-mono uppercase tracking-widest text-white/40 mb-3">Token Details</h4>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-white/40 mb-1">Mint Address</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-[#00FF41] break-all flex-1">{result.mint}</code>
                  <CopyButton text={result.mint} />
                </div>
              </div>
              <div>
                <p className="text-xs text-white/40 mb-1">Transaction</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-white/60 break-all flex-1">{result.signature.slice(0, 32)}...</code>
                  <CopyButton text={result.signature} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <a
                href={`https://solscan.io/token/${result.mint}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[#00FF41] text-xs px-3 py-1.5 rounded-lg bg-[#00FF41]/10 border border-[#00FF41]/30 hover:bg-[#00FF41]/20 transition-all"
              >
                Solscan <ExternalLink size={11} />
              </a>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("ht:open-trade", { detail: result.mint }))}
                className="inline-flex items-center gap-1.5 text-[#B026FF] text-xs px-3 py-1.5 rounded-lg bg-[#B026FF]/10 border border-[#B026FF]/30 hover:bg-[#B026FF]/20 transition-all"
              >
                Open Trade Page
              </button>
            </div>
          </GlassPanel>

          {/* DB saved */}
          {dbSaved && (
            <div className="flex items-center gap-2 text-xs text-[#00FF41] p-3 rounded-lg bg-[#00FF41]/5 border border-[#00FF41]/15">
              <Check size={12} /> Indexed in the network database
            </div>
          )}
          {dbError && (
            <div className="p-3 rounded-lg bg-[#FFDB2B]/5 border border-[#FFDB2B]/20">
              <p className="text-[#FFDB2B] text-xs break-words">DB index failed: {dbError}</p>
            </div>
          )}

          {/* Certificate */}
          {certDone && (
            <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/15">
              <div className="flex items-center gap-2 mb-2">
                <Award size={13} className="text-blue-400" />
                <span className="text-sm font-semibold text-white">Launch Certificate NFT</span>
              </div>
              <p className="text-xs text-[#00FF41]">✓ {certMint ? "Minted" : "Already exists"}</p>
              {certMint && (
                <>
                  <p className="text-white/40 font-mono text-xs break-all mt-1">{certMint}</p>
                  <a
                    href={`https://solscan.io/token/${certMint}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#00FF41] text-xs hover:underline mt-1"
                  >
                    View certificate <ExternalLink size={10} />
                  </a>
                </>
              )}
            </div>
          )}
          {certError && (
            <p className="text-red-400 text-xs p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
              Certificate NFT: {certError}
            </p>
          )}

          {/* Next steps */}
          <GlassPanel className="p-5">
            <h3 className="text-sm font-bold text-white mb-4 border-b border-white/10 pb-3">Next steps</h3>

            <div className="space-y-3">
              {/* Init Reputation */}
              <div className="p-4 rounded-lg bg-[#00FF41]/5 border border-[#00FF41]/15">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck size={13} className="text-[#00FF41]" />
                  <span className="text-sm font-semibold text-white">Creator Reputation</span>
                </div>
                {repDone ? (
                  <div className="flex items-center gap-2 text-xs text-[#00FF41]">
                    <UserCheck size={11} /> Active — your launches are tracked
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleInitReputation}
                      disabled={repBusy || !wallet.connected}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] text-xs hover:bg-[#00FF41]/20 disabled:opacity-50 transition-all"
                    >
                      {repBusy ? <><Loader size={11} className="animate-spin" />Initializing...</> : <><UserCheck size={11} />Init Reputation Account</>}
                    </button>
                    {repError && <p className="text-red-400 text-xs mt-2">{repError}</p>}
                  </>
                )}
              </div>

              {/* Certificate */}
              <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/15">
                <div className="flex items-center gap-2 mb-2">
                  <Award size={13} className="text-blue-400" />
                  <span className="text-sm font-semibold text-white">Launch Certificate (Soulbound)</span>
                </div>
                {certDone ? (
                  <p className="text-xs text-[#00FF41]">✓ Certificate NFT minted</p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleMintCertificate}
                      disabled={certBusy || !isV2Launch}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {certBusy ? <><Loader size={11} className="animate-spin" />Minting...</> : "Mint Certificate NFT"}
                    </button>
                    {certError && <p className="text-red-400 text-xs mt-2">{certError}</p>}
                  </>
                )}
              </div>

              {/* Unlock */}
              <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/15">
                <div className="flex items-center gap-2 mb-2">
                  <Unlock size={13} className="text-purple-400" />
                  <span className="text-sm font-semibold text-white">Unlock Vault (after lock expires)</span>
                </div>
                <p className="text-xs text-white/40 mb-3">Go to the Trade page to release locked tokens when your lock period expires.</p>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("ht:open-trade", { detail: result.mint }))}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs hover:bg-purple-500/20 transition-all"
                >
                  <Unlock size={11} /> Open Trade Page → Creator Panel
                </button>
              </div>

              {/* Raydium */}
              <div className="p-4 rounded-lg bg-[#B026FF]/5 border border-[#B026FF]/15">
                <div className="flex items-center gap-2 mb-2">
                  <Lock size={13} className="text-[#B026FF]" />
                  <span className="text-sm font-semibold text-white">Raydium CPMM Migration</span>
                </div>
                <p className="text-xs text-white/40">
                  At {testMode ? "5 SOL (test)" : "50 SOL"} raised, V2 migrates to Raydium CPMM and locks LP in PDA.
                </p>
              </div>
            </div>
          </GlassPanel>
        </div>
      );
    }

    // Progress state (launching/signing/confirming/minting-cert)
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-mono uppercase tracking-widest text-[#00FF41]/70 mb-1">Launch</h3>
          <p className="text-xs text-white/40 mb-4">
            {launchPhase === "idle"
              ? "Click Launch Token below to execute all on-chain instructions."
              : phaseLabels[launchPhase]}
          </p>
        </div>

        {/* Summary card */}
        {launchPhase === "idle" && (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-white/3 border border-white/10">
            <HexLogo src={logoDataUrl || undefined} label={symbol || "TKN"} size={56} variant={tier === 1 ? "gradient" : "green"} />
            <div className="flex-1">
              <p className="text-white font-bold">{name}</p>
              <p className="text-white/50 font-mono text-sm">${symbol}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono" style={{ color: scoreColor }}>Score: {trustScore}</span>
                <span className="text-white/20">·</span>
                <span className="text-xs text-white/40">{tier === 0 ? "Standard" : "Premium"}</span>
                <span className="text-white/20">·</span>
                <span className="text-xs text-white/40">{lockPercent}% locked {lockDays}d</span>
              </div>
            </div>
          </div>
        )}

        {/* Progress phases */}
        {launchPhase !== "idle" && launchPhase !== "success" && (
          <div className="space-y-2">
            {phases.filter(p => p !== "success").map((phase, idx) => {
              const phaseNames = {
                launching: "Initializing",
                signing: "Wallet Signature",
                confirming: "Confirming Transaction",
                "minting-cert": "Minting Certificate",
              };
              const isDonePhase = idx < currentPhaseIdx;
              const isCurrentPhase = phase === launchPhase;
              return (
                <div
                  key={phase}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all",
                    isCurrentPhase && "border-[#00FF41]/30 bg-[#00FF41]/5",
                    isDonePhase && "border-[#00FF41]/15 bg-[#00FF41]/3",
                    !isCurrentPhase && !isDonePhase && "border-white/8 bg-white/3 opacity-40",
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                    isCurrentPhase && "bg-[#00FF41]/20 border border-[#00FF41]/60",
                    isDonePhase && "bg-[#00FF41]/15 border border-[#00FF41]/30",
                    !isCurrentPhase && !isDonePhase && "bg-white/5 border border-white/15",
                  )}>
                    {isDonePhase ? (
                      <Check size={10} className="text-[#00FF41]" />
                    ) : isCurrentPhase ? (
                      <Loader size={10} className="text-[#00FF41] animate-spin" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs font-medium",
                    isCurrentPhase && "text-[#00FF41]",
                    isDonePhase && "text-[#00FF41]/60",
                    !isCurrentPhase && !isDonePhase && "text-white/30",
                  )}>
                    {phaseNames[phase as keyof typeof phaseNames]}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
            <p className="text-red-400 text-sm break-words">{error}</p>
          </div>
        )}

        {!wallet.connected && launchPhase === "idle" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[#FFDB2B]/5 border border-[#FFDB2B]/20">
            <AlertTriangle size={13} className="text-[#FFDB2B] shrink-0" />
            <p className="text-[#FFDB2B] text-xs">Connect your wallet to launch.</p>
          </div>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const showPreviewPanel = step === 5 || step === 6;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-xs font-mono tracking-widest uppercase text-[#00FF41]/70 mb-1">
          Launch · {isV2Launch ? "V2 Curve" : isCheckingProgram ? "Checking..." : "V1 Live"} · Devnet
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

      {/* Step indicator */}
      <StepIndicator step={step} completedSteps={completedSteps} />

      <div className={cn(
        "grid gap-6",
        showPreviewPanel ? "grid-cols-1 lg:grid-cols-[1fr_360px]" : "grid-cols-1 max-w-2xl mx-auto w-full",
      )}>
        {/* ── Left: wizard form ── */}
        <div>
          <GlassPanel className="p-6" glow={step === 6 && launchPhase === "success" ? "green" : undefined}>
            <AnimatePresence mode="wait" custom={slideDirection}>
              <motion.div
                key={step}
                custom={slideDirection}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
                {step === 5 && renderStep5()}
                {step === 6 && renderStep6()}
              </motion.div>
            </AnimatePresence>

            {/* Only show nav if not in success state */}
            {!(step === 6 && launchPhase === "success") && (
              <WizardNav
                step={step}
                onBack={goBack}
                onNext={goNext}
                onLaunch={() => handleLaunch()}
                onTestLaunch={() => handleLaunch(1)}
                nextDisabled={step === 1 ? !step1Valid : step === 4 ? !step4Valid : false}
                launchDisabled={!canLaunch}
                busy={busy}
                isCheckingProgram={isCheckingProgram}
                isV2Launch={isV2Launch}
                walletConnected={wallet.connected}
              />
            )}

            {/* "Start new launch" button after success */}
            {step === 6 && launchPhase === "success" && (
              <div className="pt-4 mt-4 border-t border-[#1A2332] flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setLaunchPhase("idle");
                    setStep(1);
                    setCompletedSteps(new Set());
                    setName("");
                    setSymbol("");
                    setDescription("");
                    setLogoDataUrl(null);
                    setWebsite("");
                    setTwitter("");
                    setTelegram("");
                    setError(null);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/20 text-white/60 text-sm hover:border-white/40 hover:text-white transition-all"
                >
                  <Rocket size={14} /> Launch another token
                </button>
              </div>
            )}
          </GlassPanel>
        </div>

        {/* ── Right: preview pane (only on review/launch steps) ── */}
        {showPreviewPanel && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="hidden lg:block"
          >
            <PreviewPanel />
          </motion.div>
        )}
      </div>
    </div>
  );
}

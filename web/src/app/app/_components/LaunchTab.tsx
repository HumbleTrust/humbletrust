"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Check, Rocket, Shield, Droplets, FileText } from "lucide-react";
import { TrustScoreMeter } from "@/components/ui/TrustScoreMeter";
import { calculateTrustScore } from "@/lib/trustScore";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormState {
  // Step 1
  tokenName: string;
  tokenSymbol: string;
  totalSupply: string;
  decimals: "6" | "9";
  description: string;

  // Step 2
  lockDuration: 30 | 90 | 180 | 365;
  creatorAllocation: number;
  vestingEnabled: boolean;
  mintRevoked: boolean;
  freezeRevoked: boolean;

  // Step 3
  initialSol: string;
  tokenPctForLp: number;
  dex: "raydium" | "orca";
}

const INITIAL_FORM: FormState = {
  tokenName: "",
  tokenSymbol: "",
  totalSupply: "1,000,000,000",
  decimals: "9",
  description: "",
  lockDuration: 90,
  creatorAllocation: 5,
  vestingEnabled: false,
  mintRevoked: true,
  freezeRevoked: true,
  initialSol: "1",
  tokenPctForLp: 20,
  dex: "raydium",
};

const STEPS = [
  { label: "Token Basics", icon: FileText },
  { label: "Anti-Rug", icon: Shield },
  { label: "Liquidity", icon: Droplets },
  { label: "Deploy", icon: Rocket },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSupplyInput(val: string): string {
  const digits = val.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

function parseSupply(val: string): number {
  return Number(val.replace(/,/g, "")) || 0;
}

function computeLiveScore(form: FormState) {
  const partial = {
    liquidityLocked: true,
    lockDurationSeconds: form.lockDuration * 86400,
    mintRevoked: form.mintRevoked,
    freezeRevoked: form.freezeRevoked,
    vestingEnabled: form.vestingEnabled,
    creatorAllocationPct: form.creatorAllocation,
    createdAt: new Date().toISOString(),
  };
  return calculateTrustScore(partial);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        marginBottom: "2rem",
      }}
    >
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        const Icon = s.icon;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && (
              <div
                style={{
                  width: 48,
                  height: 2,
                  background: done
                    ? "var(--primary)"
                    : "var(--border-subtle)",
                  transition: "background 0.3s ease",
                  marginBottom: 0,
                }}
              />
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <motion.div
                animate={{
                  background: done
                    ? "var(--primary)"
                    : active
                    ? "rgba(0,255,178,0.15)"
                    : "var(--bg-elevated)",
                  borderColor: done || active ? "var(--primary)" : "var(--border-subtle)",
                  scale: active ? 1.1 : 1,
                }}
                transition={{ duration: 0.2 }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: "2px solid",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                {done ? (
                  <Check size={16} color="#05080F" strokeWidth={3} />
                ) : (
                  <Icon
                    size={16}
                    color={active ? "var(--primary)" : "var(--text-muted)"}
                  />
                )}
              </motion.div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: active ? 600 : 400,
                  color: active
                    ? "var(--primary)"
                    : done
                    ? "var(--text-secondary)"
                    : "var(--text-muted)",
                  whiteSpace: "nowrap",
                  fontFamily: "var(--font-inter)",
                }}
              >
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InputLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 12,
        fontWeight: 600,
        color: "var(--text-secondary)",
        marginBottom: 6,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text-primary)",
  fontFamily: "var(--font-inter)",
  outline: "none",
  transition: "border-color 0.15s ease",
};

function StyledInput({
  value,
  onChange,
  placeholder,
  type = "text",
  style: extra,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...inputStyle, ...extra }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-focus)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderRadius: 10,
        background: "var(--bg-elevated)",
        border: `1px solid ${checked ? "rgba(0,255,178,0.2)" : "var(--border-subtle)"}`,
        transition: "border-color 0.15s ease",
        cursor: "pointer",
      }}
      onClick={() => onChange(!checked)}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
          {label}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {description}
          </div>
        )}
      </div>
      <div
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: checked ? "var(--primary)" : "var(--border-subtle)",
          position: "relative",
          transition: "background 0.2s ease",
          flexShrink: 0,
        }}
      >
        <motion.div
          animate={{ left: checked ? 22 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          style={{
            position: "absolute",
            top: 2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: checked ? "#05080F" : "var(--text-muted)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Step components ──────────────────────────────────────────────────────────

function Step1({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <InputLabel>Token Name *</InputLabel>
          <StyledInput
            value={form.tokenName}
            onChange={(v) => setForm((f) => ({ ...f, tokenName: v }))}
            placeholder="e.g. HumbleAI"
          />
        </div>
        <div>
          <InputLabel>Token Symbol * (max 8)</InputLabel>
          <StyledInput
            value={form.tokenSymbol}
            onChange={(v) => setForm((f) => ({ ...f, tokenSymbol: v.toUpperCase().slice(0, 8) }))}
            placeholder="HAI"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <InputLabel>Total Supply</InputLabel>
          <StyledInput
            value={form.totalSupply}
            onChange={(v) =>
              setForm((f) => ({ ...f, totalSupply: formatSupplyInput(v) }))
            }
            placeholder="1,000,000,000"
          />
        </div>
        <div>
          <InputLabel>Decimals</InputLabel>
          <select
            value={form.decimals}
            onChange={(e) =>
              setForm((f) => ({ ...f, decimals: e.target.value as "6" | "9" }))
            }
            style={{
              ...inputStyle,
              cursor: "pointer",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234A5568' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
              paddingRight: 36,
            }}
          >
            <option value="9">9 (Standard)</option>
            <option value="6">6 (USDC-style)</option>
          </select>
        </div>
      </div>

      <div>
        <InputLabel>Description</InputLabel>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Describe your token's purpose and utility..."
          rows={4}
          style={{
            ...inputStyle,
            resize: "vertical",
            minHeight: 100,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-focus)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
        />
      </div>
    </div>
  );
}

function Step2({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const liveScore = computeLiveScore(form);
  const LOCK_OPTIONS: { days: 30 | 90 | 180 | 365; label: string }[] = [
    { days: 30, label: "30 days" },
    { days: 90, label: "90 days" },
    { days: 180, label: "180 days" },
    { days: 365, label: "1 year" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: "2rem", alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Lock Duration */}
        <div>
          <InputLabel>Liquidity Lock Duration</InputLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {LOCK_OPTIONS.map((o) => (
              <button
                key={o.days}
                onClick={() => setForm((f) => ({ ...f, lockDuration: o.days }))}
                style={{
                  padding: "10px 8px",
                  borderRadius: 10,
                  border: `1px solid ${form.lockDuration === o.days ? "var(--primary)" : "var(--border-subtle)"}`,
                  background:
                    form.lockDuration === o.days
                      ? "rgba(0,255,178,0.1)"
                      : "var(--bg-elevated)",
                  color:
                    form.lockDuration === o.days
                      ? "var(--primary)"
                      : "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: form.lockDuration === o.days ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  fontFamily: "var(--font-inter)",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Creator Allocation Slider */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <InputLabel>Creator Allocation</InputLabel>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color:
                  form.creatorAllocation <= 5 ? "var(--primary)" : "var(--warning)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {form.creatorAllocation}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={form.creatorAllocation}
            onChange={(e) =>
              setForm((f) => ({ ...f, creatorAllocation: Number(e.target.value) }))
            }
            style={{ width: "100%", accentColor: "var(--primary)", cursor: "pointer" }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>0%</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>10%</span>
          </div>
        </div>

        {/* Toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Toggle
            checked={form.vestingEnabled}
            onChange={(v) => setForm((f) => ({ ...f, vestingEnabled: v }))}
            label="Vesting Enabled"
            description="Gradually release creator tokens over time"
          />
          <Toggle
            checked={form.mintRevoked}
            onChange={(v) => setForm((f) => ({ ...f, mintRevoked: v }))}
            label="Revoke Mint Authority"
            description="Permanently prevent new token minting"
          />
          <Toggle
            checked={form.freezeRevoked}
            onChange={(v) => setForm((f) => ({ ...f, freezeRevoked: v }))}
            label="Revoke Freeze Authority"
            description="Permanently prevent wallet freezing"
          />
        </div>
      </div>

      {/* Live Trust Score */}
      <div
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
          position: "sticky",
          top: 24,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Live Trust Score
        </div>
        <TrustScoreMeter score={liveScore.score} size="lg" animated />
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {Object.entries(liveScore.breakdown).map(([key, val]) => {
            const maxMap: Record<string, number> = {
              liquidityPresent: 20,
              lockDuration: 20,
              mintRevoked: 20,
              freezeRevoked: 10,
              vestingEnabled: 10,
              allocation: 5,
              age: 15,
            };
            const max = maxMap[key] ?? 10;
            const label = key
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (s) => s.toUpperCase());
            return (
              <div key={key}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginBottom: 3,
                  }}
                >
                  <span>{label}</span>
                  <span
                    style={{
                      color: val > 0 ? "var(--primary)" : "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                    }}
                  >
                    {val}/{max}
                  </span>
                </div>
                <div
                  style={{
                    height: 3,
                    borderRadius: 2,
                    background: "var(--border-subtle)",
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    animate={{ width: `${(val / max) * 100}%` }}
                    transition={{ duration: 0.3 }}
                    style={{
                      height: "100%",
                      background: val > 0 ? "var(--primary)" : "transparent",
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Step3({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const supply = parseSupply(form.totalSupply);
  const decimals = Number(form.decimals);
  const solAmount = Number(form.initialSol) || 0;
  const tokenPct = form.tokenPctForLp / 100;
  const tokensForLp = supply * tokenPct;
  const pricePerToken =
    tokensForLp > 0 ? solAmount / tokensForLp : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <InputLabel>Initial SOL (◎)</InputLabel>
          <StyledInput
            value={form.initialSol}
            onChange={(v) => {
              if (/^\d*\.?\d*$/.test(v)) setForm((f) => ({ ...f, initialSol: v }));
            }}
            placeholder="1.0"
          />
        </div>
        <div>
          <InputLabel>DEX</InputLabel>
          <select
            value={form.dex}
            onChange={(e) =>
              setForm((f) => ({ ...f, dex: e.target.value as "raydium" | "orca" }))
            }
            style={{
              ...inputStyle,
              cursor: "pointer",
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234A5568' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
              paddingRight: 36,
            }}
          >
            <option value="raydium">Raydium</option>
            <option value="orca">Orca</option>
          </select>
        </div>
      </div>

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <InputLabel>Token % for Liquidity Pool</InputLabel>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--secondary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {form.tokenPctForLp}%
          </span>
        </div>
        <input
          type="range"
          min={5}
          max={50}
          step={1}
          value={form.tokenPctForLp}
          onChange={(e) =>
            setForm((f) => ({ ...f, tokenPctForLp: Number(e.target.value) }))
          }
          style={{ width: "100%", accentColor: "var(--secondary)", cursor: "pointer" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>5%</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>50%</span>
        </div>
      </div>

      {/* Price preview */}
      <div
        style={{
          padding: "1.25rem",
          borderRadius: 12,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Liquidity Preview
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1rem",
          }}
        >
          {[
            {
              label: "Tokens for LP",
              value: tokensForLp.toLocaleString("en-US", { maximumFractionDigits: 0 }),
              color: "var(--text-primary)",
            },
            {
              label: "SOL in pool",
              value: `◎ ${solAmount.toFixed(2)}`,
              color: "var(--secondary)",
            },
            {
              label: "Est. price per token",
              value:
                pricePerToken > 0
                  ? pricePerToken < 0.000001
                    ? `◎ ${pricePerToken.toExponential(2)}`
                    : `◎ ${pricePerToken.toFixed(8)}`
                  : "—",
              color: "var(--primary)",
            },
          ].map((item) => (
            <div key={item.label}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                {item.label}
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: item.color,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step4({
  form,
  onDeploy,
  deployed,
  deploying,
}: {
  form: FormState;
  onDeploy: () => void;
  deployed: boolean;
  deploying: boolean;
}) {
  const liveScore = computeLiveScore(form);

  const summaryRows = [
    { label: "Token Name", value: form.tokenName || "—" },
    { label: "Symbol", value: form.tokenSymbol || "—" },
    { label: "Total Supply", value: form.totalSupply || "0" },
    { label: "Decimals", value: form.decimals },
    { label: "Lock Duration", value: `${form.lockDuration} days` },
    { label: "Creator Allocation", value: `${form.creatorAllocation}%` },
    { label: "Vesting", value: form.vestingEnabled ? "Enabled" : "Disabled" },
    { label: "Mint Revoked", value: form.mintRevoked ? "Yes" : "No" },
    { label: "Freeze Revoked", value: form.freezeRevoked ? "Yes" : "No" },
    { label: "Initial SOL", value: `◎ ${form.initialSol}` },
    { label: "LP Token %", value: `${form.tokenPctForLp}%` },
    { label: "DEX", value: form.dex.charAt(0).toUpperCase() + form.dex.slice(1) },
  ];

  if (deployed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
          padding: "3rem 1rem",
          textAlign: "center",
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(0,255,178,0.15)",
            border: "2px solid var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Check size={36} color="var(--primary)" strokeWidth={2.5} />
        </motion.div>
        <div>
          <h3
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--text-primary)",
              fontFamily: "var(--font-geist)",
              marginBottom: 8,
            }}
          >
            Token Deployed!
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            {form.tokenName} ({form.tokenSymbol}) is live on Solana Devnet
          </p>
        </div>
        <div
          style={{
            padding: "12px 20px",
            borderRadius: 10,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          Mint: 9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin
        </div>
        <TrustScoreMeter score={liveScore.score} size="md" />
      </motion.div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: "1.5rem", alignItems: "start" }}>
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          {summaryRows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 16px",
                borderBottom:
                  i < summaryRows.length - 1
                    ? "1px solid var(--border-subtle)"
                    : "none",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                {row.label}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            padding: "1.5rem",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Trust Score
          </div>
          <TrustScoreMeter score={liveScore.score} size="md" />
        </div>
      </div>

      <button
        onClick={onDeploy}
        disabled={deploying}
        style={{
          width: "100%",
          padding: "14px",
          borderRadius: 12,
          border: "none",
          background: deploying
            ? "var(--border-subtle)"
            : "linear-gradient(135deg, var(--primary), #00D4AA)",
          color: deploying ? "var(--text-muted)" : "#05080F",
          fontSize: 15,
          fontWeight: 700,
          cursor: deploying ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontFamily: "var(--font-geist)",
          transition: "opacity 0.15s ease",
          opacity: deploying ? 0.7 : 1,
        }}
      >
        {deploying ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "2px solid transparent",
                borderTopColor: "var(--text-muted)",
              }}
            />
            Deploying to Devnet…
          </>
        ) : (
          <>
            <Rocket size={16} />
            Deploy Token
          </>
        )}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LaunchTab() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [deployed, setDeployed] = useState(false);
  const [deploying, setDeploying] = useState(false);

  const canAdvance = useCallback(() => {
    if (step === 0) {
      return form.tokenName.trim().length > 0 && form.tokenSymbol.trim().length > 0;
    }
    return true;
  }, [step, form]);

  const handleNext = () => {
    if (step < 3 && canAdvance()) setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleDeploy = () => {
    setDeploying(true);
    setTimeout(() => {
      setDeploying(false);
      setDeployed(true);
    }, 2000);
  };

  const stepContent = [
    <Step1 key={0} form={form} setForm={setForm} />,
    <Step2 key={1} form={form} setForm={setForm} />,
    <Step3 key={2} form={form} setForm={setForm} />,
    <Step4
      key={3}
      form={form}
      onDeploy={handleDeploy}
      deployed={deployed}
      deploying={deploying}
    />,
  ];

  return (
    <div style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            fontFamily: "var(--font-geist)",
            fontSize: 28,
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            marginBottom: 6,
          }}
        >
          Launch a Token
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Deploy with verifiable trust signals baked in from day one
        </p>
      </div>

      {/* Step progress */}
      <StepIndicator step={step} />

      {/* Step content */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          padding: "2rem",
          minHeight: 400,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
          >
            {stepContent[step]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      {!deployed && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "1.5rem",
          }}
        >
          <button
            onClick={handleBack}
            disabled={step === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              borderRadius: 10,
              border: "1px solid var(--border-subtle)",
              background: "transparent",
              color: step === 0 ? "var(--text-muted)" : "var(--text-secondary)",
              fontSize: 14,
              fontWeight: 500,
              cursor: step === 0 ? "default" : "pointer",
              opacity: step === 0 ? 0.5 : 1,
              fontFamily: "var(--font-inter)",
            }}
          >
            <ChevronLeft size={16} />
            Back
          </button>

          {step < 3 && (
            <button
              onClick={handleNext}
              disabled={!canAdvance()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 24px",
                borderRadius: 10,
                border: "none",
                background: canAdvance()
                  ? "var(--primary)"
                  : "var(--border-subtle)",
                color: canAdvance() ? "#05080F" : "var(--text-muted)",
                fontSize: 14,
                fontWeight: 600,
                cursor: canAdvance() ? "pointer" : "default",
                fontFamily: "var(--font-inter)",
                transition: "all 0.15s ease",
              }}
            >
              Next
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}

      <style>{`
        textarea::placeholder { color: var(--text-muted); }
        input::placeholder { color: var(--text-muted); }
        select option { background: var(--bg-elevated); color: var(--text-primary); }
      `}</style>
    </div>
  );
}

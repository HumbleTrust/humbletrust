import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatSol(amount: number, decimals = 2): string {
  return `◎ ${amount.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function scoreColor(score: number): string {
  if (score >= 90) return "#00FFB2";
  if (score >= 70) return "#00D4FF";
  if (score >= 40) return "#FFB800";
  if (score >= 20) return "#FF7A00";
  return "#FF4444";
}

export function scoreLabel(score: number): string {
  if (score >= 90) return "Verified";
  if (score >= 70) return "Safe";
  if (score >= 40) return "Moderate";
  if (score >= 20) return "Risky";
  return "Danger";
}

export function scoreBg(score: number): string {
  if (score >= 90) return "rgba(0,255,178,0.1)";
  if (score >= 70) return "rgba(0,212,255,0.1)";
  if (score >= 40) return "rgba(255,184,0,0.1)";
  if (score >= 20) return "rgba(255,122,0,0.1)";
  return "rgba(255,68,68,0.1)";
}

export function timeLeft(unlockAt: string | null | undefined): { days: number; hours: number; mins: number; secs: number; expired: boolean } {
  if (!unlockAt) return { days: 0, hours: 0, mins: 0, secs: 0, expired: true };
  const diff = new Date(unlockAt).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, expired: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return { days, hours, mins, secs, expired: false };
}

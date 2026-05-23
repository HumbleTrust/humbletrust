const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const isValidWallet = (value: unknown) =>
  typeof value === "string" && SOLANA_ADDR_RE.test(value);

export const scoreLevel = (score: number) =>
  score >= 85 ? "ELITE" : score >= 70 ? "STRONG" : score >= 40 ? "OK" : "WEAK";

export const sanitizeApiError = (error: unknown) => {
  if (!(error instanceof Error)) return "Internal server error";
  const message = error.message;
  if (message.includes("password") || message.includes("connect ECONNREFUSED")) return "Database error";
  if (message.includes("relation") || message.includes("column") || message.includes("syntax error")) return "Database error";
  return message.length > 200 ? message.slice(0, 200) : message;
};


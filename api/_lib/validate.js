const { PublicKey } = require("@solana/web3.js");

// Shared validation helpers for API routes

// Solana public key: base58, 32-44 chars
const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const isValidWallet = (w) => {
  if (typeof w !== 'string' || !SOLANA_ADDR_RE.test(w)) return false;
  try {
    new PublicKey(w);
    return true;
  } catch {
    return false;
  }
};

const ALLOWED_ORIGINS = [
  'https://humbletrust.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

const isAllowedOrigin = (origin) => {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow any Vercel preview deploy for this project
  if (/^https:\/\/humbletrust(-[a-z0-9]+)*\.vercel\.app$/.test(origin)) return true;
  return false;
};

const setCors = (req, res) => {
  const origin = req.headers.origin;
  const allowed = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
};

module.exports = { isValidWallet, setCors, ALLOWED_ORIGINS };

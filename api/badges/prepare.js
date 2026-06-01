// POST /api/badges/prepare  { wallet }                          — reserve edition
// POST /api/badges/confirm  → rewrites here { wallet, badge_mint, tx_sig, … }  — confirm mint

const { getClient } = require('../_lib/db');
const { getZodiac, getAuraColor } = require('./_zodiac');
const { isValidWallet, setCors } = require('../_lib/validate');
const { VALID_ZODIACS, VALID_ELEMENTS } = require('../_lib/trust');

const MINT_PRICE_SOL     = 0.2;
const MINT_PRICE_LAMPORTS = Math.round(MINT_PRICE_SOL * 1e9);
const FEE_WALLET          = 'FYRtG8JMun6vqucUaXGcSZrWib6gNVEW4dd2LEP92mGM';
const SOLANA_RPC          = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
const TX_SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

// Verify that tx_signature contains a SOL transfer of ≥ MINT_PRICE_LAMPORTS to FEE_WALLET
async function verifyPayment(txSig) {
  const res = await fetch(SOLANA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'getTransaction',
      params: [txSig, { encoding: 'json', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
    }),
    signal: AbortSignal.timeout(8000),
  });
  const { result } = await res.json();
  if (!result) return false;

  const keys = result.transaction?.message?.accountKeys ?? [];
  const pre  = result.meta?.preBalances  ?? [];
  const post = result.meta?.postBalances ?? [];
  const idx  = keys.indexOf(FEE_WALLET);
  if (idx === -1) return false;

  // Allow 5% tolerance to cover tx fees on edge cases
  return (post[idx] - pre[idx]) >= Math.floor(MINT_PRICE_LAMPORTS * 0.95);
}

module.exports = async (req, res) => {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: 'Supabase not configured' });

  const body = req.body || {};

  // If badge_mint is present → this is the confirm step
  if (body.badge_mint) return handleConfirm(body, res);
  return handlePrepare(body, req, res);
};

async function handlePrepare(body, req, res) {
  const { wallet, token_created_at } = body;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  if (!isValidWallet(wallet)) return res.status(400).json({ error: 'invalid wallet address' });

  const db = getClient();
  try {
    const [{ data: existing }, { data: premiumToken }] = await Promise.all([
      db.from('badges').select('*').eq('wallet', wallet).maybeSingle(),
      db.from('tokens').select('mint,created_at').eq('creator', wallet).eq('tier', 'premium').order('created_at', { ascending: true }).limit(1).maybeSingle(),
    ]);

    if (!premiumToken) return res.status(403).json({ error: 'not_premium_creator' });

    if (existing?.status === 'active') return res.status(409).json({ error: 'already_owns', badge: existing });

    if (existing?.status === 'sold' || existing?.status === 'cooldown') {
      const now = new Date();
      const cooldownUntil = new Date(existing.cooldown_until);
      if (now < cooldownUntil) {
        const daysLeft = Math.ceil((cooldownUntil - now) / (1000 * 60 * 60 * 24));
        return res.status(403).json({ error: 'cooldown', days_left: daysLeft, cooldown_until: existing.cooldown_until });
      }
    }

    const refDate = token_created_at
      ? new Date(token_created_at)
      : premiumToken.created_at ? new Date(premiumToken.created_at) : new Date();

    const { name: zodiac, element } = getZodiac(refDate);
    const auraColor = getAuraColor(wallet);
    const auraHex   = auraColor.replace('#', '');

    const { data: edition, error: edErr } = await db.rpc('increment_badge_edition', { z: zodiac });
    if (edErr) throw edErr;

    const origin = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `https://${req.headers.host || 'humbletrust.vercel.app'}`;
    const metadataUri = `${origin}/api/badges/metadata?zodiac=${encodeURIComponent(zodiac)}&element=${encodeURIComponent(element)}&aura=${auraHex}&edition=${edition}`;

    return res.json({ ok: true, zodiac, element, aura_color: auraColor, edition, metadata_uri: metadataUri });
  } catch (e) {
    console.error('[api/badges/prepare]', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleConfirm(body, res) {
  const { wallet, badge_mint, tx_signature, zodiac, element, aura_color, edition } = body;
  if (!wallet || !isValidWallet(wallet))     return res.status(400).json({ error: 'invalid wallet' });
  if (!badge_mint || !isValidWallet(badge_mint)) return res.status(400).json({ error: 'invalid badge_mint' });
  if (!tx_signature || !TX_SIG_RE.test(tx_signature)) return res.status(400).json({ error: 'invalid tx_signature' });
  if (!zodiac || !VALID_ZODIACS.has(zodiac)) return res.status(400).json({ error: 'invalid zodiac' });
  if (!element || !VALID_ELEMENTS.has(element)) return res.status(400).json({ error: 'invalid element' });
  if (!aura_color || !/^#[0-9A-Fa-f]{6}$/.test(aura_color)) return res.status(400).json({ error: 'invalid aura_color' });
  const ed = parseInt(edition, 10);
  if (!Number.isFinite(ed) || ed < 1) return res.status(400).json({ error: 'invalid edition' });

  const db = getClient();
  try {
    // Verify the SOL payment actually reached FEE_WALLET on-chain
    const paid = await verifyPayment(tx_signature).catch(() => false);
    if (!paid) return res.status(402).json({ error: 'payment_not_verified' });

    const { data: badge, error } = await db.from('badges').upsert({
      wallet, badge_mint, zodiac, element, aura_color, edition: ed,
      tx_signature, price_sol: MINT_PRICE_SOL, status: 'active',
      minted_at: new Date().toISOString(), sold_at: null, cooldown_until: null,
    }, { onConflict: 'wallet' }).select().single();

    if (error) throw error;
    console.info('[api/badges/confirm] zodiac=%s edition=%d mint=%s wallet=%s', zodiac, ed, badge_mint.slice(0,8)+'…', wallet.slice(0,8)+'…');
    return res.json({ ok: true, badge });
  } catch (e) {
    console.error('[api/badges/confirm]', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

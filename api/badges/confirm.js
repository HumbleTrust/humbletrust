// POST /api/badges/confirm  { wallet, badge_mint, tx_signature, zodiac, element, aura_color, edition }
// Stores the on-chain NFT mint address and transaction signature in Supabase.

const { getClient } = require('../_lib/db');
const { isValidWallet, setCors } = require('../_lib/validate');
const { VALID_ZODIACS, VALID_ELEMENTS } = require('../_lib/trust');

const MINT_PRICE_SOL = 0.2;
// Solana tx signature: 64-byte Ed25519, base58-encoded → 87-88 chars
const TX_SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

module.exports = async (req, res) => {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: 'Supabase not configured' });

  const { wallet, badge_mint, tx_signature, zodiac, element, aura_color, edition } = req.body || {};

  if (!wallet || !isValidWallet(wallet)) return res.status(400).json({ error: 'invalid wallet' });
  if (!badge_mint || !isValidWallet(badge_mint)) return res.status(400).json({ error: 'invalid badge_mint' });
  if (!tx_signature || !TX_SIG_RE.test(tx_signature)) return res.status(400).json({ error: 'invalid tx_signature' });
  if (!zodiac || !VALID_ZODIACS.has(zodiac)) return res.status(400).json({ error: 'invalid zodiac' });
  if (!element || !VALID_ELEMENTS.has(element)) return res.status(400).json({ error: 'invalid element' });
  if (!aura_color || !/^#[0-9A-Fa-f]{6}$/.test(aura_color)) return res.status(400).json({ error: 'invalid aura_color' });
  const ed = parseInt(edition, 10);
  if (!Number.isFinite(ed) || ed < 1) return res.status(400).json({ error: 'invalid edition' });

  const db = getClient();

  try {
    const { data: badge, error } = await db
      .from('badges')
      .upsert({
        wallet,
        badge_mint,
        zodiac,
        element,
        aura_color,
        edition: ed,
        tx_signature,
        price_sol: MINT_PRICE_SOL,
        status: 'active',
        minted_at: new Date().toISOString(),
        sold_at: null,
        cooldown_until: null,
      }, { onConflict: 'wallet' })
      .select()
      .single();

    if (error) throw error;

    console.info('[api/badges/confirm] confirmed zodiac=%s edition=%d mint=%s wallet=%s',
      zodiac, ed, badge_mint.slice(0,8) + '…', wallet.slice(0,8) + '…');

    return res.json({ ok: true, badge });
  } catch (e) {
    console.error('[api/badges/confirm]', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const { getClient } = require('../_lib/db');
const { getZodiac, getAuraColor } = require('./_zodiac');

const MINT_PRICE_SOL = 0.2;
const PLATFORM_WALLET = process.env.PLATFORM_WALLET || '';

// POST /api/badges/mint
// Body: { wallet, tx_signature, token_created_at? }
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: 'Supabase not configured' });

  const { wallet, tx_signature, token_created_at } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });

  const db = getClient();

  try {
    // 1. Check eligibility
    const { data: existing } = await db
      .from('badges')
      .select('*')
      .eq('wallet', wallet)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'active') {
        return res.status(409).json({ error: 'wallet already owns a badge', badge: existing });
      }
      if (existing.status === 'sold' || existing.status === 'cooldown') {
        const now = new Date();
        const cooldownUntil = new Date(existing.cooldown_until);
        if (now < cooldownUntil) {
          const daysLeft = Math.ceil((cooldownUntil - now) / (1000 * 60 * 60 * 24));
          return res.status(403).json({
            error: 'cooldown_active',
            message: `This wallet sold its badge. Can mint again in ${daysLeft} day(s).`,
            cooldown_until: existing.cooldown_until,
            days_left: daysLeft,
          });
        }
      }
    }

    // 2. Determine zodiac from token creation date (or today)
    const refDate = token_created_at ? new Date(token_created_at) : new Date();
    const { name: zodiac, element } = getZodiac(refDate);
    const auraColor = getAuraColor(wallet);

    // 3. Get next edition number for this zodiac (atomic increment)
    const { data: edRow, error: edErr } = await db.rpc('increment_badge_edition', { z: zodiac });
    if (edErr) throw edErr;
    const edition = edRow ?? 1;

    // 4. Upsert badge record (badge_mint filled later after on-chain mint)
    const { data: badge, error: insertErr } = await db
      .from('badges')
      .upsert({
        wallet,
        zodiac,
        element,
        aura_color: auraColor,
        edition,
        tx_signature: tx_signature || null,
        price_sol: MINT_PRICE_SOL,
        status: 'active',
        minted_at: new Date().toISOString(),
        sold_at: null,
      }, { onConflict: 'wallet' })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return res.json({
      ok: true,
      badge: {
        wallet,
        zodiac,
        element,
        aura_color: auraColor,
        edition,
        status: 'active',
      },
    });
  } catch (e) {
    console.error('[api/badges/mint]', e.message);
    return res.status(500).json({ error: e.message });
  }
};

// POST /api/badges/prepare  { wallet }
// Checks eligibility and atomically reserves an edition number.
// Returns badge params + metadata_uri for the client to build the NFT.

const { getClient } = require('../_lib/db');
const { getZodiac, getAuraColor } = require('./_zodiac');
const { isValidWallet, setCors } = require('../_lib/validate');

module.exports = async (req, res) => {
  setCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: 'Supabase not configured' });

  const { wallet, token_created_at } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  if (!isValidWallet(wallet)) return res.status(400).json({ error: 'invalid wallet address' });

  const db = getClient();

  try {
    const [{ data: existing }, { data: premiumToken }] = await Promise.all([
      db.from('badges').select('*').eq('wallet', wallet).maybeSingle(),
      db.from('tokens').select('mint,created_at').eq('creator', wallet).eq('tier', 'premium').order('created_at', { ascending: true }).limit(1).maybeSingle(),
    ]);

    if (!premiumToken) {
      return res.status(403).json({ error: 'not_premium_creator' });
    }

    if (existing?.status === 'active') {
      return res.status(409).json({ error: 'already_owns', badge: existing });
    }

    if (existing?.status === 'sold' || existing?.status === 'cooldown') {
      const now = new Date();
      const cooldownUntil = new Date(existing.cooldown_until);
      if (now < cooldownUntil) {
        const daysLeft = Math.ceil((cooldownUntil - now) / (1000 * 60 * 60 * 24));
        return res.status(403).json({ error: 'cooldown', days_left: daysLeft, cooldown_until: existing.cooldown_until });
      }
    }

    // Determine zodiac from token creation date (earliest premium token)
    const refDate = token_created_at
      ? new Date(token_created_at)
      : premiumToken.created_at
        ? new Date(premiumToken.created_at)
        : new Date();

    const { name: zodiac, element } = getZodiac(refDate);
    const auraColor = getAuraColor(wallet);
    const auraHex = auraColor.replace('#', '');

    // Atomically reserve the next edition number
    const { data: edition, error: edErr } = await db.rpc('increment_badge_edition', { z: zodiac });
    if (edErr) throw edErr;

    const origin = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `https://${req.headers.host || 'humbletrust.vercel.app'}`;
    const metadataUri = `${origin}/api/badges/metadata?zodiac=${encodeURIComponent(zodiac)}&element=${encodeURIComponent(element)}&aura=${auraHex}&edition=${edition}`;

    return res.json({
      ok: true,
      zodiac,
      element,
      aura_color: auraColor,
      edition,
      metadata_uri: metadataUri,
    });
  } catch (e) {
    console.error('[api/badges/prepare]', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

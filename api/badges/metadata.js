// GET /api/badges/metadata?zodiac=Aries&element=Fire&aura=FF7A2F&edition=1
// Returns Metaplex-compatible NFT metadata JSON.

const { setCors } = require('../_lib/validate');
const { VALID_ZODIACS, VALID_ELEMENTS } = require('../_lib/trust');

module.exports = (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { zodiac, element, aura, edition } = req.query;

  if (!zodiac || !VALID_ZODIACS.has(zodiac))
    return res.status(400).json({ error: 'invalid zodiac' });
  if (!element || !VALID_ELEMENTS.has(element))
    return res.status(400).json({ error: 'invalid element' });
  if (!aura || !/^[0-9A-Fa-f]{6}$/.test(aura))
    return res.status(400).json({ error: 'invalid aura (6-char hex)' });

  const ed = parseInt(edition, 10);
  if (!Number.isFinite(ed) || ed < 1)
    return res.status(400).json({ error: 'invalid edition' });

  const editionStr = String(ed).padStart(3, '0');
  const origin = `https://${req.headers.host}`;
  const imageUrl = `${origin}/api/badges/image?zodiac=${encodeURIComponent(zodiac)}&element=${encodeURIComponent(element)}&aura=${aura}&edition=${ed}`;

  const metadata = {
    name: `HumbleTrust ${zodiac} Badge #${editionStr}`,
    symbol: 'HTBADGE',
    description: `Zodiac Badge NFT · HumbleTrust Premium · ${zodiac} · ${element} · Edition #${editionStr}. Awarded exclusively to Premium token creators on HumbleTrust.`,
    image: imageUrl,
    external_url: `https://humbletrust.vercel.app/nft`,
    attributes: [
      { trait_type: 'Zodiac',  value: zodiac  },
      { trait_type: 'Element', value: element },
      { trait_type: 'Aura',    value: `#${aura}` },
      { trait_type: 'Edition', value: ed },
      { trait_type: 'Platform', value: 'HumbleTrust' },
    ],
    properties: {
      files: [{ uri: imageUrl, type: 'image/svg+xml' }],
      category: 'image',
    },
    seller_fee_basis_points: 0,
    collection: { name: 'HumbleTrust Zodiac Badges', family: 'HumbleTrust' },
  };

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Type', 'application/json');
  return res.json(metadata);
};

// Combined badges handler
// Routes: list, eligibility, image, metadata, prepare, confirm, sold

const { getClient } = require('../_lib/db');
const { isValidWallet, setCors } = require('../_lib/validate');
const { VALID_ZODIACS, VALID_ELEMENTS } = require('../_lib/trust');
const { getZodiac, getAuraColor } = require('./_zodiac');
const crypto = require('crypto');

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { action } = req.query;

  switch (action) {
    case 'list':        return handleList(req, res);
    case 'eligibility': return handleEligibility(req, res);
    case 'image':       return handleImage(req, res);
    case 'metadata':    return handleMetadata(req, res);
    case 'prepare':
    case 'confirm':     return handlePrepareConfirm(req, res);
    case 'sold':        return handleSold(req, res);
    default:            return res.status(404).json({ error: 'not found' });
  }
};

// ─── GET /api/badges/list  (was index.js) ────────────────────────────────────
async function handleList(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: 'Supabase not configured' });

  const db = getClient();
  const { wallet } = req.query;
  if (wallet && !isValidWallet(wallet)) return res.status(400).json({ error: 'invalid wallet address' });

  try {
    if (wallet) {
      const { data, error } = await db
        .from('badges')
        .select('wallet,zodiac,element,aura_color,edition,status,minted_at,cooldown_until')
        .eq('wallet', wallet)
        .maybeSingle();
      if (error) throw error;
      return res.json({ badge: data });
    }

    const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 200);
    const { data, error } = await db
      .from('badges')
      .select('wallet,zodiac,element,aura_color,edition,status,minted_at')
      .eq('status', 'active')
      .order('edition', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return res.json({ badges: data });
  } catch (e) {
    console.error('[api/badges/list]', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── GET /api/badges/eligibility?wallet=<addr> ───────────────────────────────
async function handleEligibility(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: 'Supabase not configured' });

  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  if (!isValidWallet(wallet)) return res.status(400).json({ error: 'invalid wallet address' });

  const db = getClient();
  try {
    const [{ data: badge }, { data: premiumToken }] = await Promise.all([
      db.from('badges').select('*').eq('wallet', wallet).maybeSingle(),
      db.from('tokens').select('mint').eq('creator', wallet).eq('tier', 'premium').limit(1).maybeSingle(),
    ]);

    const isPremium = !!premiumToken;

    if (!badge) {
      if (!isPremium) return res.json({ can_mint: false, reason: 'not_premium_creator', badge: null });
      return res.json({ can_mint: true, reason: null, badge: null });
    }

    if (badge.status === 'active') return res.json({ can_mint: false, reason: 'already_owns', badge });

    if (badge.status === 'sold' || badge.status === 'cooldown') {
      const now = new Date();
      const cooldownUntil = new Date(badge.cooldown_until);
      if (now < cooldownUntil) {
        const daysLeft = Math.ceil((cooldownUntil - now) / (1000 * 60 * 60 * 24));
        return res.json({ can_mint: false, reason: 'cooldown', cooldown_until: badge.cooldown_until, days_left: daysLeft, badge });
      }
      if (!isPremium) return res.json({ can_mint: false, reason: 'not_premium_creator', badge });
      return res.json({ can_mint: true, reason: 'cooldown_expired', badge });
    }

    if (!isPremium) return res.json({ can_mint: false, reason: 'not_premium_creator', badge });
    return res.json({ can_mint: true, reason: null, badge });
  } catch (e) {
    console.error('[api/badges/eligibility]', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── GET /api/badges/image?zodiac=&element=&aura=&edition= ───────────────────
const ELEMENT_GRADIENT = {
  Fire:  ['#200900', '#05070F'],
  Water: ['#001a1f', '#05070F'],
  Earth: ['#1a0a2e', '#05070F'],
  Air:   ['#00102a', '#05070F'],
};

const CONSTELLATIONS = {
  Aries:       { stars: [[92,78,1.5],[120,60,2],[148,68,1.5],[168,52,2],[145,90,1.5]], lines: [[92,78,120,60],[120,60,148,68],[148,68,168,52],[148,68,145,90]] },
  Taurus:      { stars: [[110,72,2],[146,58,1.5],[164,80,1.5],[83,90,1.5],[66,74,1],[134,108,1.5]], lines: [[110,72,146,58],[146,58,164,80],[110,72,83,90],[83,90,66,74],[110,72,134,108]] },
  Gemini:      { stars: [[80,65,2],[110,58,1.5],[140,65,2],[80,100,1.5],[140,100,1.5],[110,80,1]], lines: [[80,65,110,58],[110,58,140,65],[80,65,80,100],[140,65,140,100],[80,100,140,100]] },
  Cancer:      { stars: [[100,80,1.5],[130,72,2],[120,100,1.5],[110,55,1.5],[145,98,1]], lines: [[110,55,130,72],[130,72,120,100],[100,80,130,72],[130,72,145,98]] },
  Leo:         { stars: [[110,70,2.5],[79,86,1.5],[73,116,1.5],[94,138,1.5],[130,116,2],[156,96,1.5]], lines: [[110,70,79,86],[79,86,73,116],[73,116,94,138],[94,138,130,116],[130,116,156,96],[156,96,110,70]] },
  Virgo:       { stars: [[85,60,2],[115,50,2],[148,62,1.5],[168,90,1.5],[145,115,1.5],[100,95,1]], lines: [[85,60,115,50],[115,50,148,62],[148,62,168,90],[168,90,145,115],[115,50,100,95]] },
  Libra:       { stars: [[75,80,1.5],[110,65,2],[145,80,1.5],[110,100,1.5],[75,115,1],[145,115,1]], lines: [[75,80,110,65],[110,65,145,80],[75,80,75,115],[145,80,145,115],[75,115,145,115]] },
  Scorpio:     { stars: [[73,81,2],[104,86,1.5],[130,76,2.5],[157,86,1.5],[140,112,1.5],[120,134,1.5]], lines: [[73,81,104,86],[104,86,130,76],[130,76,157,86],[157,86,140,112],[140,112,120,134]] },
  Sagittarius: { stars: [[75,125,2],[105,100,2],[140,75,1.5],[158,105,1.5],[128,125,1.5]], lines: [[75,125,105,100],[105,100,140,75],[105,100,158,105],[158,105,128,125]] },
  Capricorn:   { stars: [[72,95,1.5],[100,75,2],[132,85,1.5],[158,68,1.5],[168,95,1.5],[120,115,1]], lines: [[72,95,100,75],[100,75,132,85],[132,85,158,68],[158,68,168,95],[132,85,120,115]] },
  Aquarius:    { stars: [[57,96,1.5],[88,81,2],[120,92,1.5],[153,76,2],[177,92,1.5]], lines: [[57,96,88,81],[88,81,120,92],[120,92,153,76],[153,76,177,92]] },
  Pisces:      { stars: [[72,75,1.5],[100,88,2],[128,75,1.5],[158,90,1.5],[88,112,1.5],[148,110,1.5]], lines: [[72,75,100,88],[100,88,128,75],[128,75,158,90],[88,112,148,110]] },
};

function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = Math.imul(s ^ (s >>> 16), 0x45d9f3b); s = Math.imul(s ^ (s >>> 16), 0x45d9f3b); s ^= s >>> 16; return (s >>> 0) / 0xffffffff; };
}

function hexToRgb(hex) {
  const h = hex.replace('#','');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function darken(hex, f=0.55) {
  const [r,g,b] = hexToRgb(hex);
  const h = n => Math.round(n*f).toString(16).padStart(2,'0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function zodiacGlyph(zodiac, color) {
  const A = `stroke="${color}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const D = (cx,cy,r=2.5,op) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="none"${op?` opacity="${op}"`:''}/>`;
  switch(zodiac) {
    case 'Aries': return `<g ${A}><circle cx="45" cy="57" r="10"/><path d="M37,51 C31,43 21,33 19,21 C17,13 25,11 29,17"/><path d="M53,51 C59,43 69,33 71,21 C73,13 65,11 61,17"/>${D(29,17,3)}${D(61,17,3)}${D(45,47,2,.5)}<line x1="45" y1="67" x2="45" y2="75" stroke-width="1.5" opacity=".5"/></g>`;
    case 'Taurus': return `<g ${A}><circle cx="45" cy="60" r="16"/><path d="M31,50 C25,41 18,28 22,18"/><path d="M59,50 C65,41 72,28 68,18"/>${D(22,18,2.5)}${D(68,18,2.5)}${D(45,44,2,.5)}</g>`;
    case 'Gemini': return `<g ${A}><line x1="29" y1="19" x2="29" y2="71" stroke-width="2.5"/><line x1="61" y1="19" x2="61" y2="71" stroke-width="2.5"/><path d="M29,19 C29,11 61,11 61,19" stroke-width="2"/><path d="M29,71 C29,79 61,79 61,71" stroke-width="2"/><line x1="29" y1="45" x2="61" y2="45" stroke-width="1.5" opacity=".6"/>${D(29,19,2.5)}${D(61,19,2.5)}${D(29,71,2.5)}${D(61,71,2.5)}${D(45,45,2,.6)}</g>`;
    case 'Cancer': return `<g ${A}><circle cx="45" cy="45" r="30" stroke-width="1" opacity=".2" stroke-dasharray="3 4"/><path d="M67,41 C73,33 69,19 57,17 C45,15 37,25 41,35 C45,45 57,45 57,37 C57,31 51,29 47,33" stroke-width="2"/><path d="M23,49 C17,57 21,71 33,73 C45,75 53,65 49,55 C45,45 33,45 33,53 C33,59 39,61 43,57" stroke-width="2"/>${D(47,33,3)}${D(43,57,3)}</g>`;
    case 'Leo': return `<g ${A}><circle cx="45" cy="56" r="12"/><line x1="45" y1="44" x2="45" y2="36" stroke-width="1.5" opacity=".8"/><line x1="33" y1="56" x2="25" y2="56" stroke-width="1.5" opacity=".7"/><line x1="57" y1="56" x2="65" y2="56" stroke-width="1.5" opacity=".7"/><line x1="37" y1="47" x2="30" y2="40" stroke-width="1.2" opacity=".6"/><line x1="53" y1="47" x2="60" y2="40" stroke-width="1.2" opacity=".6"/><path d="M45,68 C45,74 52,78 55,84 C57,88 53,90 50,87" stroke-width="1.8"/>${D(45,56,2.5,.6)}</g>`;
    case 'Virgo': return `<g ${A}><line x1="33" y1="15" x2="33" y2="73" stroke-width="2.2"/><line x1="33" y1="15" x2="57" y2="15" stroke-width="2.2"/><line x1="57" y1="15" x2="57" y2="49" stroke-width="2"/><path d="M57,49 C57,61 45,65 41,59 C37,53 43,47 51,51" stroke-width="2"/><line x1="25" y1="37" x2="41" y2="37" stroke-width="1.5" opacity=".6"/>${D(33,15,2.5,.6)}${D(57,15,2.5)}${D(51,51,3)}${D(33,73,2,.4)}</g>`;
    case 'Libra': return `<g ${A}><path d="M21,41 C21,29 69,29 69,41" stroke-width="2"/><line x1="21" y1="41" x2="69" y2="41" stroke-width="2.5"/><line x1="45" y1="41" x2="45" y2="67" stroke-width="2"/><line x1="27" y1="67" x2="63" y2="67" stroke-width="2.5"/>${D(21,41,2.5,.7)}${D(69,41,2.5,.7)}${D(45,31,3)}${D(27,67,2,.6)}${D(63,67,2,.6)}</g>`;
    case 'Scorpio': return `<g ${A}><path d="M16,38 C16,50 22,58 26,58 C30,58 32,50 37,50 C42,50 44,58 48,58 C52,58 57,52 57,46" stroke-width="2"/><path d="M57,46 C60,38 66,32 66,25" stroke-width="2"/><polyline points="59,25 66,25 66,33" stroke-width="1.8"/>${D(16,38,2.5)}${D(26,58,2,.7)}${D(48,58,2,.7)}${D(66,25,3)}</g>`;
    case 'Sagittarius': return `<g ${A}><line x1="19" y1="71" x2="71" y2="19" stroke-width="2.5"/><polyline points="51,19 71,19 71,39" stroke-width="2.2"/><line x1="35" y1="59" x2="19" y2="59" stroke-width="1.5" opacity=".4"/>${D(71,19,3.5)}${D(19,71,2.5,.6)}</g>`;
    case 'Capricorn': return `<g ${A}><path d="M19,21 C19,21 19,49 33,57 C39,61 45,59 45,59" stroke-width="2.2"/><path d="M45,21 L45,59" stroke-width="2.2"/><path d="M45,59 C49,67 59,69 63,63 C67,57 63,49 55,51" stroke-width="2"/><path d="M19,33 C25,27 39,25 45,29" stroke-width="1.5" opacity=".6"/>${D(19,21,2.5)}${D(45,21,2.5)}${D(55,51,3)}</g>`;
    case 'Aquarius': return `<g ${A}><polyline points="18,47 27,37 36,47 45,37 54,47 63,37 72,41" stroke-width="1.8"/><polyline points="18,62 27,52 36,62 45,52 54,62 63,52 72,56" stroke-width="1.8"/>${D(27,37,2.5)}${D(45,37,2.5)}${D(63,37,2.5)}${D(27,52,2,.7)}${D(45,52,2,.7)}${D(63,52,2,.7)}<line x1="27" y1="37" x2="27" y2="52" stroke-width=".8" opacity=".25"/><line x1="45" y1="37" x2="45" y2="52" stroke-width=".8" opacity=".25"/><line x1="63" y1="37" x2="63" y2="52" stroke-width=".8" opacity=".25"/></g>`;
    case 'Pisces': return `<g ${A}><path d="M19,45 C19,27 71,27 71,45" stroke-width="2.2"/><path d="M19,45 C19,63 71,63 71,45" stroke-width="2.2"/><line x1="19" y1="45" x2="71" y2="45" stroke-width="1.8" opacity=".7"/><polyline points="11,39 19,45 11,51" stroke-width="1.8"/><polyline points="79,39 71,45 79,51" stroke-width="1.8"/>${D(19,45,2.5)}${D(71,45,2.5)}${D(45,27,2,.5)}${D(45,63,2,.5)}</g>`;
    default: return '';
  }
}

function elementSigil(element, color) {
  const A = `stroke="${color}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const D = (cx,cy,r=3) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="none"/>`;
  switch(element) {
    case 'Fire': return `<g ${A}><polygon points="40,6 72,68 8,68" stroke-width="2" opacity=".9"/><polygon points="40,20 62,62 18,62" stroke-width="1.2" fill="${color}0F" opacity=".7"/>${D(40,46,3)}<line x1="26" y1="54" x2="54" y2="54" stroke-width="1.5" opacity=".5"/></g>`;
    case 'Water': return `<g ${A}><circle cx="40" cy="40" r="32" stroke-width="1.5" opacity=".4"/><path d="M40,14 C26,14 16,26 16,40 C16,54 26,66 40,66" stroke-width="2" opacity=".9"/><path d="M40,14 C54,14 64,26 64,40 C64,54 54,66 40,66" stroke-width="2" opacity=".9"/><path d="M40,22 C32,28 28,34 28,40 C28,46 32,52 40,58 C48,52 52,46 52,40 C52,34 48,28 40,22Z" fill="${color}14" stroke-width="1" opacity=".6"/>${D(40,40,3)}<line x1="40" y1="6" x2="40" y2="10" stroke-width="1.5" opacity=".5"/><line x1="40" y1="70" x2="40" y2="74" stroke-width="1.5" opacity=".5"/><line x1="6" y1="40" x2="10" y2="40" stroke-width="1.5" opacity=".5"/><line x1="70" y1="40" x2="74" y2="40" stroke-width="1.5" opacity=".5"/></g>`;
    case 'Earth': return `<g ${A}><rect x="22" y="22" width="36" height="36" transform="rotate(45 40 40)" stroke-width="2" opacity=".8"/><polygon points="40,62 14,18 66,18" stroke-width="2" fill="${color}11" opacity=".9"/><line x1="22" y1="36" x2="58" y2="36" stroke-width="1.8" opacity=".8"/>${D(40,40,3)}</g>`;
    case 'Air': return `<g ${A}><circle cx="40" cy="40" r="32" stroke-width="1.5" stroke-dasharray="4 3" opacity=".5"/><polygon points="40,10 70,64 10,64" stroke-width="2" fill="${color}0D" opacity=".9"/><polygon points="40,24 58,58 22,58" stroke-width="1.2" opacity=".5"/><line x1="40" y1="40" x2="40" y2="10" stroke-width="1" opacity=".22"/><line x1="40" y1="40" x2="70" y2="64" stroke-width="1" opacity=".22"/><line x1="40" y1="40" x2="10" y2="64" stroke-width="1" opacity=".22"/><circle cx="40" cy="40" r="4" stroke-width="1.5" fill="${color}33"/>${D(40,40,1.5)}</g>`;
    default: return '';
  }
}

function generateSVG(zodiac, element, aura, edition) {
  const W = 440, H = 660;
  const [g1, g2] = ELEMENT_GRADIENT[element] ?? ['#1a0a2e','#05070F'];
  const dk = darken(aura);
  const [r,g,b] = hexToRgb(aura);
  const edStr = String(edition).padStart(3,'0');

  const seed = zodiac.split('').reduce((a,c,i) => a + c.charCodeAt(0) * (i+1), edition * 7919);
  const rng = seededRng(seed);
  const stars = Array.from({length:38}, () => ({
    x: (rng()*W).toFixed(1), y: (rng()*H).toFixed(1),
    r: (rng()*1.4+0.3).toFixed(1), op: (rng()*0.5+0.2).toFixed(2),
  }));

  const con = CONSTELLATIONS[zodiac] ?? CONSTELLATIONS.Taurus;
  const conStars = con.stars.map(([x,y,r]) =>
    `<circle cx="${x*2}" cy="${y*2}" r="${r*1.8}" fill="white" opacity="0.55"/>`).join('');
  const conLines = con.lines.map(([x1,y1,x2,y2]) =>
    `<line x1="${x1*2}" y1="${y1*2}" x2="${x2*2}" y2="${y2*2}" stroke="white" stroke-width="0.8" opacity="0.2"/>`).join('');

  const sc = 2.6, sx = (W - 90*sc)/2, sy = 100;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <radialGradient id="bg" cx="50%" cy="28%" r="65%">
    <stop offset="0%" stop-color="${g1}"/>
    <stop offset="100%" stop-color="${g2}"/>
  </radialGradient>
  <linearGradient id="aura" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${aura}"/>
    <stop offset="50%" stop-color="${dk}"/>
    <stop offset="100%" stop-color="${aura}"/>
  </linearGradient>
  <radialGradient id="glow" cx="50%" cy="45%" r="55%">
    <stop offset="0%" stop-color="rgba(${r},${g},${b},0.12)"/>
    <stop offset="100%" stop-color="rgba(${r},${g},${b},0)"/>
  </radialGradient>
  <clipPath id="card"><rect width="${W}" height="${H}" rx="40"/></clipPath>
</defs>
<rect width="${W}" height="${H}" rx="40" fill="url(#bg)"/>
<rect width="${W}" height="${H}" rx="40" fill="url(#glow)"/>
${stars.map(s=>`<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="white" opacity="${s.op}"/>`).join('')}
<g clip-path="url(#card)" opacity="0.12">
${conLines}
${conStars}
</g>
<rect width="${W}" height="${H}" rx="40" fill="none" stroke="url(#aura)" stroke-width="3" opacity="0.85"/>
<text x="26" y="36" font-family="monospace,Courier New" font-size="13" fill="rgba(255,255,255,0.28)" letter-spacing="3">HUMBLETRUST</text>
<text x="${W-26}" y="${H-22}" font-family="monospace,Courier New" font-size="12" fill="rgba(255,255,255,0.22)" letter-spacing="2" text-anchor="end">EDITION #${edStr}</text>
<g transform="translate(${sx.toFixed(1)},${sy}) scale(${sc})">
  <path d="M45,3 L85,18 L85,58 C85,80 45,105 45,105 C45,105 5,80 5,58 L5,18 Z" stroke="${aura}" stroke-width="2" fill="${aura}0D"/>
  <path d="M45,13 L75,26 L75,58 C75,75 45,95 45,95 C45,95 15,75 15,58 L15,26 Z" stroke="${aura}" stroke-width="1.2" fill="none" opacity="0.55"/>
  <line x1="16" y1="48" x2="74" y2="48" stroke="${aura}" stroke-width="1" opacity="0.28"/>
  ${zodiacGlyph(zodiac, aura)}
  <circle cx="45" cy="3" r="3" fill="${aura}"/>
  <circle cx="85" cy="18" r="2.5" fill="${aura}" opacity="0.8"/>
  <circle cx="85" cy="58" r="2" fill="${aura}" opacity="0.6"/>
  <circle cx="45" cy="105" r="3" fill="${aura}"/>
  <circle cx="5" cy="58" r="2" fill="${aura}" opacity="0.6"/>
  <circle cx="5" cy="18" r="2.5" fill="${aura}" opacity="0.8"/>
  <circle cx="78" cy="12" r="11" fill="#05070F" stroke="#00FF94" stroke-width="1.5"/>
  <circle cx="78" cy="12" r="8" stroke="#00FF94" stroke-width="0.8" fill="rgba(0,255,148,0.08)" opacity="0.5"/>
  <polyline points="72,12 77,18 86,6" stroke="#00FF94" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="86" cy="6" r="1.8" fill="#00FF94"/>
</g>
<g transform="translate(${W/2 - 44},${sy + 90*sc + 20})">
  <svg viewBox="0 0 80 80" width="88" height="88">
    ${elementSigil(element, aura)}
  </svg>
</g>
<text x="${W/2}" y="${sy + 90*sc + 140}" font-family="monospace,Courier New" font-size="18" fill="white" letter-spacing="6" text-anchor="middle" opacity="0.92">${zodiac.toUpperCase()}</text>
<line x1="${W/2 - 45}" y1="${sy + 90*sc + 155}" x2="${W/2 + 45}" y2="${sy + 90*sc + 155}" stroke="${aura}" stroke-width="1" opacity="0.6"/>
<text x="${W/2}" y="${sy + 90*sc + 178}" font-family="monospace,Courier New" font-size="13" fill="${aura}" letter-spacing="5" text-anchor="middle" opacity="0.9">${element.toUpperCase()}</text>
</svg>`;
}

function handleImage(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { zodiac, element, aura, edition } = req.query;
  const auraColor = aura ? `#${aura.replace('#','')}` : '#9945FF';
  const editionNum = parseInt(edition) || 1;

  if (!VALID_ZODIACS.has(zodiac) || !VALID_ELEMENTS.has(element))
    return res.status(400).json({ error: 'invalid zodiac or element' });
  if (!/^#?[0-9A-Fa-f]{6}$/.test(auraColor))
    return res.status(400).json({ error: 'invalid aura color' });

  const svg = generateSVG(zodiac, element, auraColor, editionNum);
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.status(200).send(svg);
}

// ─── GET /api/badges/metadata?zodiac=&element=&aura=&edition= ────────────────
function handleMetadata(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { zodiac, element, aura, edition } = req.query;
  if (!zodiac || !VALID_ZODIACS.has(zodiac)) return res.status(400).json({ error: 'invalid zodiac' });
  if (!element || !VALID_ELEMENTS.has(element)) return res.status(400).json({ error: 'invalid element' });
  if (!aura || !/^[0-9A-Fa-f]{6}$/.test(aura)) return res.status(400).json({ error: 'invalid aura (6-char hex)' });

  const ed = parseInt(edition, 10);
  if (!Number.isFinite(ed) || ed < 1) return res.status(400).json({ error: 'invalid edition' });

  const editionStr = String(ed).padStart(3, '0');
  const origin = `https://${req.headers.host}`;
  const imageUrl = `${origin}/api/badges/image?zodiac=${encodeURIComponent(zodiac)}&element=${encodeURIComponent(element)}&aura=${aura}&edition=${ed}`;

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.json({
    name: `HumbleTrust ${zodiac} Badge #${editionStr}`,
    symbol: 'HTBADGE',
    description: `Zodiac Badge NFT · HumbleTrust Premium · ${zodiac} · ${element} · Edition #${editionStr}. Awarded exclusively to Premium token creators on HumbleTrust.`,
    image: imageUrl,
    external_url: `https://humbletrust.vercel.app/nft`,
    attributes: [
      { trait_type: 'Zodiac',   value: zodiac   },
      { trait_type: 'Element',  value: element  },
      { trait_type: 'Aura',     value: `#${aura}` },
      { trait_type: 'Edition',  value: ed       },
      { trait_type: 'Platform', value: 'HumbleTrust' },
    ],
    properties: {
      files: [{ uri: imageUrl, type: 'image/svg+xml' }],
      category: 'image',
    },
    seller_fee_basis_points: 0,
    collection: { name: 'HumbleTrust Zodiac Badges', family: 'HumbleTrust' },
  });
}

// ─── POST /api/badges/prepare  +  POST /api/badges/confirm ───────────────────
const MINT_PRICE_SOL      = 0.2;
const MINT_PRICE_LAMPORTS = Math.round(MINT_PRICE_SOL * 1e9);
const FEE_WALLET          = 'FYRtG8JMun6vqucUaXGcSZrWib6gNVEW4dd2LEP92mGM';
const SOLANA_RPC          = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
const TX_SIG_RE           = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;
const RESERVATION_TTL_MS  = 30 * 60 * 1000;
const CONFIRM_GRACE_MS    = 60 * 60 * 1000;

async function verifyPayment(txSig, wallet, badgeMint) {
  const rpcRes = await fetch(SOLANA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'getTransaction',
      params: [txSig, { encoding: 'json', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
    }),
    signal: AbortSignal.timeout(8000),
  });
  const { result } = await rpcRes.json();
  if (!result) return false;
  if (result.meta?.err) return false;

  const blockTime = result.blockTime;
  if (!blockTime || (Date.now() / 1000 - blockTime) > 7200) return false; // reject tx older than 2h

  const staticKeys  = result.transaction?.message?.accountKeys ?? [];
  const loadedWrite = result.meta?.loadedAddresses?.writable ?? [];
  const loadedRead  = result.meta?.loadedAddresses?.readonly ?? [];
  const keys        = [...staticKeys, ...loadedWrite, ...loadedRead];

  if (staticKeys[0] !== wallet) return false;
  if (!keys.includes(badgeMint)) return false;

  const pre  = result.meta?.preBalances  ?? [];
  const post = result.meta?.postBalances ?? [];
  const idx  = staticKeys.indexOf(FEE_WALLET);
  if (idx === -1) return false;
  return (post[idx] - pre[idx]) >= MINT_PRICE_LAMPORTS;
}

async function handlePrepareConfirm(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY)
    return res.status(503).json({ error: 'Supabase not configured' });

  const body = req.body || {};
  if (body.badge_mint) return doConfirm(body, res);
  return doPrepare(body, req, res);
}

async function doPrepare(body, req, res) {
  const { wallet, token_created_at } = body;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  if (!isValidWallet(wallet)) return res.status(400).json({ error: 'invalid wallet address' });

  const db = getClient();
  try {
    const [{ data: existing }, { data: premiumToken }] = await Promise.all([
      db.from('badges').select('*').eq('wallet', wallet).maybeSingle(),
      db.from('tokens').select('mint,created_at').eq('creator', wallet).eq('tier', 'premium')
        .order('created_at', { ascending: true }).limit(1).maybeSingle(),
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

    if (existing?.status === 'reserved' && existing.reserved_at) {
      const age = Date.now() - new Date(existing.reserved_at).getTime();
      if (age < RESERVATION_TTL_MS) {
        const metadataUri = buildMetadataUri(req, existing.zodiac, existing.element, existing.aura_color, existing.edition);
        return res.json({ ok: true, zodiac: existing.zodiac, element: existing.element,
                          aura_color: existing.aura_color, edition: existing.edition, metadata_uri: metadataUri });
      }
    }

    const refDate = token_created_at
      ? new Date(token_created_at)
      : premiumToken.created_at ? new Date(premiumToken.created_at) : new Date();

    const { name: zodiac, element } = getZodiac(refDate);
    const auraColor = getAuraColor(wallet);

    const { data: edition, error: edErr } = await db.rpc('increment_badge_edition', { z: zodiac });
    if (edErr) throw edErr;

    const { error: upsertErr } = await db.from('badges').upsert({
      wallet, zodiac, element, aura_color: auraColor, edition,
      status: 'reserved', reserved_at: new Date().toISOString(),
      badge_mint: null, tx_signature: null,
      sold_at: null, cooldown_until: null,
    }, { onConflict: 'wallet' });
    if (upsertErr) throw upsertErr;

    const metadataUri = buildMetadataUri(req, zodiac, element, auraColor, edition);
    return res.json({ ok: true, zodiac, element, aura_color: auraColor, edition, metadata_uri: metadataUri });
  } catch (e) {
    console.error('[api/badges/prepare]', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function doConfirm(body, res) {
  const { wallet, badge_mint, tx_signature, zodiac, element, aura_color, edition } = body;
  if (!wallet || !isValidWallet(wallet))              return res.status(400).json({ error: 'invalid wallet' });
  if (!badge_mint || !isValidWallet(badge_mint))      return res.status(400).json({ error: 'invalid badge_mint' });
  if (!tx_signature || !TX_SIG_RE.test(tx_signature)) return res.status(400).json({ error: 'invalid tx_signature' });
  if (!zodiac || !VALID_ZODIACS.has(zodiac))          return res.status(400).json({ error: 'invalid zodiac' });
  if (!element || !VALID_ELEMENTS.has(element))       return res.status(400).json({ error: 'invalid element' });
  if (!aura_color || !/^#[0-9A-Fa-f]{6}$/.test(aura_color)) return res.status(400).json({ error: 'invalid aura_color' });
  const ed = parseInt(edition, 10);
  if (!Number.isFinite(ed) || ed < 1) return res.status(400).json({ error: 'invalid edition' });

  const db = getClient();
  try {
    const { data: reserved } = await db.from('badges').select('*').eq('wallet', wallet).maybeSingle();

    if (reserved?.status === 'active' && reserved.tx_signature === tx_signature)
      return res.json({ ok: true, badge: reserved });

    if (!reserved || reserved.status !== 'reserved')
      return res.status(400).json({ error: 'no_valid_reservation' });

    if (Date.now() - new Date(reserved.reserved_at).getTime() > CONFIRM_GRACE_MS)
      return res.status(400).json({ error: 'reservation_expired' });

    if (reserved.zodiac !== zodiac || reserved.edition !== ed || reserved.aura_color !== aura_color)
      return res.status(400).json({ error: 'reservation_mismatch' });

    const paid = await verifyPayment(tx_signature, wallet, badge_mint).catch(() => false);
    if (!paid) return res.status(402).json({ error: 'payment_not_verified' });

    const { data: badge, error } = await db.from('badges').upsert({
      wallet, badge_mint, zodiac, element, aura_color, edition: ed,
      tx_signature, price_sol: MINT_PRICE_SOL, status: 'active',
      minted_at: new Date().toISOString(), reserved_at: reserved.reserved_at,
      sold_at: null, cooldown_until: null,
    }, { onConflict: 'wallet' }).select().single();

    if (error) throw error;
    console.info('[api/badges/confirm] zodiac=%s edition=%d mint=%s wallet=%s',
      zodiac, ed, badge_mint.slice(0, 8) + '…', wallet.slice(0, 8) + '…');
    return res.json({ ok: true, badge });
  } catch (e) {
    console.error('[api/badges/confirm]', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function buildMetadataUri(req, zodiac, element, auraColor, edition) {
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `https://${req.headers.host || 'humbletrust.vercel.app'}`;
  return `${origin}/api/badges/metadata?zodiac=${encodeURIComponent(zodiac)}&element=${encodeURIComponent(element)}&aura=${auraColor.replace('#','')}&edition=${edition}`;
}

// ─── POST /api/badges/sold ───────────────────────────────────────────────────
function timingSafeEqual(a, b) {
  if (!a || !b) return false;
  try {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) {
      crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch { return false; }
}

async function handleSold(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-internal-secret');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.headers['x-internal-secret'];
  if (!timingSafeEqual(secret, process.env.INTERNAL_SECRET)) {
    console.warn('[api/badges/sold] unauthorized attempt ip=%s', req.headers['x-forwarded-for'] ?? 'unknown');
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { wallet } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  if (!isValidWallet(wallet)) return res.status(400).json({ error: 'invalid wallet address' });

  const db = getClient();
  try {
    const now = new Date();
    const cooldownUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { error } = await db
      .from('badges')
      .update({ status: 'sold', sold_at: now.toISOString(), cooldown_until: cooldownUntil.toISOString() })
      .eq('wallet', wallet)
      .eq('status', 'active');

    if (error) throw error;
    console.info('[api/badges/sold] badge marked sold wallet=%s', wallet.slice(0, 8) + '…');
    return res.json({ ok: true, sold_at: now.toISOString(), cooldown_until: cooldownUntil.toISOString() });
  } catch (e) {
    console.error('[api/badges/sold]', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

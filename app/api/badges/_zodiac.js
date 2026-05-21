// Zodiac date ranges and element mapping
const ZODIACS = [
  { name: 'Capricorn',   element: 'Earth', start: [12, 22], end: [1,  19] },
  { name: 'Aquarius',    element: 'Air',   start: [1,  20], end: [2,  18] },
  { name: 'Pisces',      element: 'Water', start: [2,  19], end: [3,  20] },
  { name: 'Aries',       element: 'Fire',  start: [3,  21], end: [4,  19] },
  { name: 'Taurus',      element: 'Earth', start: [4,  20], end: [5,  20] },
  { name: 'Gemini',      element: 'Air',   start: [5,  21], end: [6,  20] },
  { name: 'Cancer',      element: 'Water', start: [6,  21], end: [7,  22] },
  { name: 'Leo',         element: 'Fire',  start: [7,  23], end: [8,  22] },
  { name: 'Virgo',       element: 'Earth', start: [8,  23], end: [9,  22] },
  { name: 'Libra',       element: 'Air',   start: [9,  23], end: [10, 22] },
  { name: 'Scorpio',     element: 'Water', start: [10, 23], end: [11, 21] },
  { name: 'Sagittarius', element: 'Fire',  start: [11, 22], end: [12, 21] },
];

// Aura color palette — 32 distinct colors derived from wallet hash
const AURA_PALETTE = [
  '#9945FF','#FF3C6B','#00D4FF','#FFDB2B','#39FF14','#DC1FFF',
  '#FF7A2F','#14F195','#1466FF','#FF4DCB','#00FFD1','#FFB800',
  '#FF2D55','#5E5CE6','#30D158','#FF6B35','#BF5AF2','#32D74B',
  '#0A84FF','#FF453A','#AC8E68','#636366','#48CAE4','#F72585',
  '#7209B7','#3A0CA3','#4361EE','#4CC9F0','#06D6A0','#EF233C',
  '#8338EC','#FB5607',
];

function getZodiac(date) {
  if (date == null) return ZODIACS[0];
  const d = new Date(date);
  if (isNaN(d.getTime())) return ZODIACS[0];
  const m = d.getMonth() + 1;
  const day = d.getDate();
  for (const z of ZODIACS) {
    const [sm, sd] = z.start;
    const [em, ed] = z.end;
    if (sm > em) {
      // spans year boundary (Capricorn: Dec 22 – Jan 19)
      if ((m === sm && day >= sd) || (m === em && day <= ed)) return z;
    } else {
      if ((m === sm && day >= sd) || (m > sm && m < em) || (m === em && day <= ed)) return z;
    }
  }
  return ZODIACS[0];
}

// Deterministic aura color from wallet address
function getAuraColor(wallet) {
  if (!wallet || typeof wallet !== 'string') return AURA_PALETTE[0];
  let hash = 0;
  const len = Math.min(wallet.length, 44); // Solana pubkeys are max 44 chars
  for (let i = 0; i < len; i++) {
    hash = ((hash << 5) - hash) + wallet.charCodeAt(i);
    hash |= 0;
  }
  return AURA_PALETTE[Math.abs(hash) % AURA_PALETTE.length];
}

module.exports = { getZodiac, getAuraColor, ZODIACS };

// Shared trust/risk helpers — single source of truth across all API routes

const getTrustLevel = s =>
  s >= 85 ? "ELITE" : s >= 70 ? "STRONG" : s >= 40 ? "OK" : s >= 20 ? "WEAK" : "DANGER";

const getRiskLevel = r =>
  r >= 75 ? "LOW" : r >= 50 ? "MEDIUM" : r >= 25 ? "HIGH" : "CRITICAL";

const VALID_ZODIACS = new Set([
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
]);

const VALID_ELEMENTS = new Set(['Fire', 'Water', 'Earth', 'Air']);

module.exports = { getTrustLevel, getRiskLevel, VALID_ZODIACS, VALID_ELEMENTS };

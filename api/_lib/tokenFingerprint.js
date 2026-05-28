const knownTokens = require('./knownTokens.json');

function fingerprintToken(chain, mint, { isPumpFun = false, hasGraduated = false, isInHumbleTrust = false } = {}) {
  // 1. Check HumbleTrust DB first
  if (isInHumbleTrust) return { archetype: 'humbletrust', tier: 2, confidence: 1.0, knownToken: null };

  // 2. Check known tokens registry
  const chainRegistry = knownTokens[chain] || {};
  const mintNorm = typeof mint === 'string' ? mint.toLowerCase() : mint;

  // Try exact match first, then case-insensitive
  const entry = chainRegistry[mint] || chainRegistry[mintNorm] || chainRegistry['native'];

  // Only use 'native' entry if mint is literally 'native' or a chain alias
  const isNativeAlias = ['native', 'btc', 'bitcoin', 'eth', 'ether', 'bnb', 'bsc', 'ton', 'toncoin', 'sol', 'solana', 'matic', 'polygon'].includes((mint || '').toLowerCase());

  const registryEntry = chainRegistry[mint] || chainRegistry[mintNorm] || (isNativeAlias ? chainRegistry['native'] : null);

  if (registryEntry) {
    return {
      archetype: registryEntry.archetype,
      tier: registryEntry.tier,
      confidence: 1.0,
      knownToken: registryEntry,
    };
  }

  // 3. Solana-specific detection
  if (chain === 'solana') {
    if (isPumpFun && !hasGraduated) return { archetype: 'meme_active',     tier: 4, confidence: 0.9, knownToken: null };
    if (isPumpFun && hasGraduated)  return { archetype: 'meme_graduated',  tier: 3, confidence: 0.9, knownToken: null };
  }

  // 4. Non-Solana unknown
  return { archetype: 'unknown', tier: 5, confidence: 0.5, knownToken: null };
}

module.exports = { fingerprintToken };

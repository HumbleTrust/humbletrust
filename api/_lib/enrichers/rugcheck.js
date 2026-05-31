"use strict";

async function _fetch(url, ms = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    if (!r.ok) return null;
    return r.json();
  } catch { clearTimeout(t); return null; }
}

async function fetchRugCheck(mint) {
  const json = await _fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report/summary`);
  if (!json) return null;

  return {
    score:        typeof json.score === 'number' ? json.score : null,
    risks:        Array.isArray(json.risks) ? json.risks : [],
    token_program: json.tokenProgram || null,
    token_type:    json.tokenType    || null,
    source: 'rugcheck',
  };
}

module.exports = { fetchRugCheck };

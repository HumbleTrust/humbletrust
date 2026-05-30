const API = "https://humbletrust.vercel.app/api";
const CACHE = new Map(); // mint → { data, ts }
const TTL   = 5 * 60 * 1000; // 5 min

async function fetchScore(mint, apiKey) {
  const cached = CACHE.get(mint);
  if (cached && Date.now() - cached.ts < TTL) return cached.data;

  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  const r = await fetch(`${API}/score/${encodeURIComponent(mint)}`, { headers });
  if (!r.ok) return null;
  const data = await r.json();
  CACHE.set(mint, { data, ts: Date.now() });
  return data;
}

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg.type === "SCORE_REQUEST") {
    chrome.storage.sync.get(["apiKey"], async ({ apiKey }) => {
      try {
        const data = await fetchScore(msg.mint, apiKey || "");
        respond({ ok: true, data });
      } catch (e) {
        respond({ ok: false, error: e.message });
      }
    });
    return true; // async
  }
});

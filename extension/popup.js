const API = "https://humbletrust.vercel.app/api";

const COLORS = {
  ELITE:  "#00FF41", STRONG: "#14F195", OK: "#FFDB2B", WEAK: "#FF7A2F", DANGER: "#FF4444",
};

// load saved key
chrome.storage.sync.get(["apiKey"], ({ apiKey }) => {
  if (apiKey) document.getElementById("apiKey").value = apiKey;
});

// save key
document.getElementById("saveBtn").addEventListener("click", () => {
  const key = document.getElementById("apiKey").value.trim();
  chrome.storage.sync.set({ apiKey: key }, () => {
    const msg = document.getElementById("msg");
    msg.textContent = key ? "Key saved ✓" : "Key cleared";
    msg.className = "msg";
    setTimeout(() => { msg.textContent = ""; }, 2000);
  });
});

// check mint
document.getElementById("checkBtn").addEventListener("click", async () => {
  const mint = document.getElementById("mintInput").value.trim();
  const result = document.getElementById("result");
  if (!mint) { result.innerHTML = `<span style="color:#FF4444;font-size:11px;">Paste a mint address first</span>`; return; }

  result.innerHTML = `<span style="color:rgba(255,255,255,0.3);font-size:11px;">Checking…</span>`;

  const { apiKey } = await new Promise(r => chrome.storage.sync.get(["apiKey"], r));
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};

  try {
    const r = await fetch(`${API}/score/${encodeURIComponent(mint)}`, { headers });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();

    const level = d.trust_level || "DANGER";
    const color = COLORS[level] || "#fff";
    const symbol = d.token?.symbol ? ` · $${d.token.symbol}` : "";

    result.innerHTML = `
      <div style="padding:10px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:22px;font-weight:900;color:${color};font-family:monospace;">${d.score}/100</div>
        <div style="font-size:11px;color:${color};font-weight:700;margin-top:2px;">${level}${symbol}</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.3);margin-top:4px;">Rug risk: ${d.rug_risk || "—"}</div>
      </div>`;
  } catch (e) {
    result.innerHTML = `<span style="color:#FF4444;font-size:11px;">Failed: ${e.message}</span>`;
  }
});

// enter key on mint input
document.getElementById("mintInput").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("checkBtn").click();
});

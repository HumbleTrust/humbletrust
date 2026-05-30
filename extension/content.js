/*
 * HumbleTrust Content Script
 * Finds Solana mint addresses in the page, injects TrustScore badges.
 */

const SOL_ADDR_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

const SCORE_COLORS = {
  ELITE:  { bg: "#003d10", border: "#00FF41", text: "#00FF41" },
  STRONG: { bg: "#003d10", border: "#14F195", text: "#14F195" },
  OK:     { bg: "#3d2d00", border: "#FFDB2B", text: "#FFDB2B" },
  WEAK:   { bg: "#3d1500", border: "#FF7A2F", text: "#FF7A2F" },
  DANGER: { bg: "#3d0000", border: "#FF4444", text: "#FF4444" },
};

const HEX_CLIP = "polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)";

// already-badged mints
const badged = new Set();

function makeBadge(data) {
  const level  = data.trust_level || "DANGER";
  const score  = data.score ?? 0;
  const c      = SCORE_COLORS[level] || SCORE_COLORS.DANGER;
  const symbol = data.token?.symbol ? `$${data.token.symbol} · ` : "";

  const el = document.createElement("a");
  el.href   = `https://humbletrust.vercel.app/?score=${encodeURIComponent(data.mint || "")}`;
  el.target = "_blank";
  el.rel    = "noreferrer";
  el.className = "ht-badge";
  el.title  = `HumbleTrust: ${symbol}${score}/100 — ${level}`;

  el.innerHTML = `
    <span class="ht-hex" style="background:${c.bg};border-color:${c.border};color:${c.text};">${score}</span>
    <span class="ht-label" style="color:${c.text};">${level}</span>
  `;
  return el;
}

function makeSpinner() {
  const el = document.createElement("span");
  el.className = "ht-spinner";
  el.innerHTML = `<span class="ht-spin-inner"></span>`;
  return el;
}

async function processNode(node) {
  if (node.nodeType !== Node.TEXT_NODE) return;
  const text = node.textContent || "";
  const matches = [...new Set(text.match(SOL_ADDR_RE) || [])];
  if (!matches.length) return;

  for (const mint of matches) {
    if (mint.length < 32 || badged.has(mint)) continue;

    // look for the closest element containing just this address
    const parent = node.parentElement;
    if (!parent || parent.querySelector(".ht-badge,.ht-spinner")) continue;

    // filter out obvious non-mints (tx hashes > 87 chars, etc.)
    if (mint.length > 44) continue;

    badged.add(mint);

    const spinner = makeSpinner();
    parent.appendChild(spinner);

    chrome.runtime.sendMessage({ type: "SCORE_REQUEST", mint }, (resp) => {
      spinner.remove();
      if (resp?.ok && resp.data) {
        resp.data.mint = mint;
        parent.appendChild(makeBadge(resp.data));
      }
    });
  }
}

function scanDOM(root) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(n) {
        const tag = n.parentElement?.tagName?.toLowerCase();
        if (["script","style","noscript","textarea","input"].includes(tag)) return NodeFilter.FILTER_REJECT;
        if (n.parentElement?.closest(".ht-badge,.ht-spinner")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach(processNode);
}

// initial scan
scanDOM(document.body);

// watch for dynamic content
const obs = new MutationObserver(mutations => {
  for (const m of mutations) {
    m.addedNodes.forEach(n => {
      if (n.nodeType === Node.ELEMENT_NODE) scanDOM(/** @type {Element} */ (n));
      else processNode(n);
    });
  }
});
obs.observe(document.body, { childList: true, subtree: true });

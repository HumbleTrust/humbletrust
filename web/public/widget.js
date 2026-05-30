/**
 * HumbleTrust Widget — v1.0
 * Usage: <ht-score mint="MINT_ADDRESS" api-key="ht_live_..." theme="dark"></ht-score>
 * Docs:  https://humbletrust.vercel.app/api
 */
(function () {
  "use strict";

  const API = "https://humbletrust.vercel.app/api";

  const COLORS = {
    ELITE:  { bg: "#003d10", border: "#00FF41", text: "#00FF41" },
    STRONG: { bg: "#003d10", border: "#14F195", text: "#14F195" },
    OK:     { bg: "#3d2d00", border: "#FFDB2B", text: "#FFDB2B" },
    WEAK:   { bg: "#3d1500", border: "#FF7A2F", text: "#FF7A2F" },
    DANGER: { bg: "#3d0000", border: "#FF4444", text: "#FF4444" },
  };

  const HEX =
    "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

  function buildStyles(theme) {
    const isDark = theme !== "light";
    return {
      wrapper: `
        display:inline-flex;align-items:center;gap:8px;
        padding:6px 12px 6px 8px;border-radius:8px;
        background:${isDark ? "rgba(10,10,15,0.9)" : "#fff"};
        border:1px solid rgba(255,255,255,0.12);
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-size:13px;line-height:1;cursor:default;
        box-shadow:0 2px 12px rgba(0,0,0,0.4);
        backdrop-filter:blur(8px);
      `,
      hex: `
        width:32px;height:32px;clip-path:${HEX};
        display:flex;align-items:center;justify-content:center;
        font-weight:900;font-size:11px;
        transition:transform 0.2s;
      `,
      name: `font-weight:600;color:${isDark ? "#fff" : "#111"};`,
      level: `font-weight:700;font-size:11px;margin-top:2px;`,
      score: `font-weight:900;font-size:15px;margin-left:4px;`,
    };
  }

  function renderLoading(host, theme) {
    const s = buildStyles(theme);
    host.innerHTML = `
      <span style="${s.wrapper}opacity:0.6;">
        <span style="width:12px;height:12px;border-radius:50%;
          border:2px solid rgba(0,255,65,0.3);border-top-color:#00FF41;
          animation:ht-spin 0.7s linear infinite;display:inline-block;"></span>
        <span style="color:rgba(255,255,255,0.4);font-size:11px;font-family:inherit;">Checking trust…</span>
      </span>`;
  }

  function renderError(host, theme, msg) {
    const s = buildStyles(theme);
    host.innerHTML = `
      <span style="${s.wrapper}border-color:rgba(255,68,68,0.3);">
        <span style="color:#FF4444;font-size:11px;font-family:inherit;">⚠ ${msg}</span>
      </span>`;
  }

  function renderScore(host, data, theme, showName) {
    const level = data.trust_level || "DANGER";
    const c = COLORS[level] || COLORS.DANGER;
    const s = buildStyles(theme);
    const name = showName !== "false" && data.token?.symbol
      ? `<span style="display:flex;flex-direction:column;">
           <span style="${s.name}">${data.token.symbol}</span>
           <span style="${s.level}color:${c.text};">${level}</span>
         </span>`
      : `<span style="${s.level}color:${c.text};">${level}</span>`;

    host.innerHTML = `
      <a href="https://humbletrust.vercel.app/?score=${encodeURIComponent(data.mint || '')}"
         target="_blank" rel="noreferrer" style="text-decoration:none;">
        <span style="${s.wrapper}border-color:${c.border}20;background:${c.bg};">
          <span style="${s.hex}background:${c.bg};border:2px solid ${c.border};color:${c.text};">
            ${data.score}
          </span>
          ${name}
          <span style="${s.score}color:${c.text};">${data.score}/100</span>
        </span>
      </a>`;
  }

  class HtScore extends HTMLElement {
    static get observedAttributes() { return ["mint", "api-key", "theme", "show-name"]; }

    connectedCallback() { this._load(); }
    attributeChangedCallback() { if (this.isConnected) this._load(); }

    async _load() {
      const mint  = this.getAttribute("mint");
      const key   = this.getAttribute("api-key") || "";
      const theme = this.getAttribute("theme") || "dark";
      const showName = this.getAttribute("show-name") || "true";

      if (!mint) { renderError(this, theme, "mint required"); return; }

      renderLoading(this, theme);

      try {
        const headers = key ? { Authorization: `Bearer ${key}` } : {};
        const r = await fetch(`${API}/score/${encodeURIComponent(mint)}`, { headers });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        d.mint = mint;
        renderScore(this, d, theme, showName);
      } catch (e) {
        renderError(this, theme, "Score unavailable");
      }
    }
  }

  // inject keyframe animation once
  if (!document.getElementById("ht-widget-styles")) {
    const style = document.createElement("style");
    style.id = "ht-widget-styles";
    style.textContent = `@keyframes ht-spin{to{transform:rotate(360deg)}}`;
    document.head.appendChild(style);
  }

  if (!customElements.get("ht-score")) {
    customElements.define("ht-score", HtScore);
  }
})();

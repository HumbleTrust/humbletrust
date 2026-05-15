// Prices are sample data — live feed via Pyth Oracle planned for Phase 5
const items = [
  { sym: "SOL",  px: "$92.31",       chg: "+1.84%", up: true },
  { sym: "BTC",  px: "$98,420",      chg: "+0.62%", up: true },
  { sym: "ETH",  px: "$3,184",       chg: "-0.41%", up: false },
  { sym: "JUP",  px: "$0.72",        chg: "+2.18%", up: true },
  { sym: "PYTH", px: "$0.31",        chg: "-1.05%", up: false },
  { sym: "BONK", px: "$0.0000218",   chg: "+5.24%", up: true },
  { sym: "WIF",  px: "$1.42",        chg: "+0.83%", up: true },
  { sym: "JTO",  px: "$2.81",        chg: "-0.92%", up: false },
  { sym: "HMT",  px: "—",            chg: "Launch $5",  up: true },
];

export const Ticker = () => (
  <div className="ticker-bar">
    <div className="ticker-track">
      {[...items, ...items].map((it, i) => (
        <div key={i} className="t-item">
          <span className="t-sym">{it.sym}</span>
          <span className="t-px">{it.px}</span>
          <span className={it.up ? "t-up" : "t-dn"}>{it.chg}</span>
          <span className="t-sep">·</span>
        </div>
      ))}
    </div>
  </div>
);

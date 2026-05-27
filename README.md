# HumbleTrust — First Trust Layer for Solana

> "Make every Solana token launch provably honest — before the first trade happens."

HumbleTrust is not just a token launchpad. It is a **Solana Trust & Safety protocol** that enforces security rules on-chain, scores every token transparently via TrustScore, and protects communities from rugs and manipulation.

**Frontend:** https://humbletrust.vercel.app  
**X (Twitter):** https://x.com/HumbleTrust2026  
**GitHub:** https://github.com/HumbleTrust/humbletrust  
**Contact / Security:** humble.trust@outlook.com  
**Status:** Devnet alpha · May 2026

---

## Program IDs

| Version | Network | Program ID | Status |
|---------|---------|-----------|--------|
| v1 legacy | devnet | `Gcz7NMtCqKdvzh53DF1ecoEYe7Hma9kWwdtCmmeBaxRi` | Stable legacy |
| v2 active | devnet | `FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr` | **Active** |

---

## What Is Live (Devnet)

### V2 Token Launch

- Fixed total supply: `1,000,000,000` tokens with 9 decimals.
- PDA-based five-vault model:
  - **Locked Vault** `L`: 30–80% (time-locked, burn-on-unlock option)
  - **Creator Vault** `C`: 0–5% (vested in thirds at day 30/60/90)
  - **Curve Liquidity Vault** `Q`: 25–50% (bonding curve pool)
  - **Circulation Vault** `R`: 15–40% (public supply)
  - **Airdrop Vault** `A`: 0–5%
- Supply validation: `L + C + Q + R + A = 100%`
- Combined liquidity: `Q + R >= 50%` enforced on-chain
- Initial SOL → `curve_treasury_sol` PDA (never to creator)
- Mint authority revoked after launch
- Metaplex Token Metadata created at launch
- **Social fields** stored on-chain registration: description, website, Twitter, Telegram

### Bonding Curve Types

| Type | Formula | Use case |
|------|---------|---------|
| **Protected CPMM** (recommended) | x·y=k (constant product) | Smooth, predictable pricing — same as Raydium/Uniswap |
| **Quadratic (Advanced)** | T²·S=k | Price accelerates as supply sells out — higher volatility |

### LP Policy (on graduation)

| Policy | Behavior |
|--------|---------|
| **Lock** (recommended) | LP tokens locked in PDA vault — liquidity secured permanently |
| **Burn** | LP tokens burned on graduation — permanent removal |

> "To Creator" policy was intentionally removed to prevent manipulation.

### TrustScore V2

Calculated from on-chain allocation parameters only:

| Component | Rule | Max points |
|-----------|------|-----------|
| Lock duration | 30d=4 · 90d=12 · 180d=18 · 270d=22 · 360d=25 | 25 |
| Lock percent | ≥30%=4 · ≥40%=10 · ≥50%=14 · ≥60%=17 · ≥70%=20 | 20 |
| Creator alloc | 0%=15 · ≤3%=12 · ≤5%=9 · ≤8%=6 · ≤10%=3 | 15 |
| Curve liquidity | ≥20%=3 · ≥30%=6 · ≥40%=8 · ≥50%=10 | 10 |
| Airdrop | ≥1%=5 · ≥5%=8 · ≥10%=10 | 10 |
| Burn (on unlock) | 25%=6 · 50%=12 | 12 |
| Circulation | 15–40%=8 · 10–14% or 41–60%=4 · >60%=2 | 8 |

**Score levels:** 0–39 WEAK · 40–69 OK · 70–84 STRONG · 85–100 ELITE

### Bonding Curve Trading

- Buy/sell instructions live on devnet
- 1% fee: 0.5% platform + 0.5% creator
- Anti-bot launch delay: 0–600 seconds
- Slippage protection: 0.5% / 1% / 3% / custom

### Launch Certificate NFT

- Token-2022 NonTransferable soulbound NFT
- Linked to on-chain `launch_certificate` PDA
- Contains: creator, mint, lock %, lock days, TrustScore, burn option, timestamp, serial number

### Frontend Pages

| Page | Description |
|------|-------------|
| Home | Protocol overview, stats, module grid, architecture flow, roadmap |
| Launch | V2 token creation with full parameter controls, social fields, launch preview |
| Trade | Buy/sell on bonding curve with TradingView OHLCV chart |
| Discover | Browse all indexed tokens with TrustScore filters |
| Charts | Standalone chart viewer |
| Market | Market overview |
| NFT Badges | Launch certificate viewer |
| Dashboard | Portfolio and analytics |
| About | Project story, mission, technical stack, security |

### API / Trust Layer

Vercel serverless + Supabase PostgreSQL:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tokens` | GET | List tokens (limit, filters) |
| `/api/tokens` | POST | Register new token (mint, creator, socials, scores) |
| `/api/tokens/:mint` | GET | Single token with full metadata |
| `/api/tokens/:mint/trades` | GET/POST | Trade history, OHLCV, sync |

---

## In Progress

| Area | Current State | Next Step |
|------|--------------|-----------|
| Raydium CPMM migration | Account validation + CPI scaffolding ready | Verify end-to-end devnet pool creation |
| Launch Certificate NFT | Live on devnet | Add richer metadata + collection display |
| Creator reputation | Groundwork in API | Build profile UI + graph signals |
| Chart data | Live OHLCV from trade index | Add Raydium vault-delta precision + holders |
| Mainnet readiness | Devnet alpha | Audit · multisig · production RPC · full test suite |

---

## Local Development

### Prerequisites

```bash
# Node.js 18+
node --version

# Anchor CLI 0.32.1
anchor --version

# Solana CLI 1.18+
solana --version
```

### Frontend

```bash
cd web
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # production build
```

Environment variables (`.env.local`):

```bash
# Leave empty on Vercel — uses /api functions automatically
VITE_API_BASE_URL=http://localhost:3000/api
```

### API (Vercel serverless)

```bash
npm install -g vercel
vercel dev      # runs /api functions locally at http://localhost:3000
```

### Anchor Program

```bash
anchor build
anchor test
anchor deploy --provider.cluster devnet
```

### Devnet Verification

```bash
# Check v2 program
solana program show FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr --url devnet

# Fetch IDL
anchor idl fetch FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr --provider.cluster devnet

# Check GlobalStateV2 PDA
solana account 4AzHwSAGtsTWv1cv3ya1g5MKLGDKRcixrbC3hq3hjroj --url devnet
```

---

## Repository Structure

```
humbletrust/
├── programs/
│   ├── humbletrust/          # V1 legacy program (Rust + Anchor)
│   └── humbletrust-v2/       # V2 active program (Rust + Anchor)
├── web/
│   └── src/
│       ├── app/
│       │   ├── pages/        # React pages (Launch, Trade, Discover, About…)
│       │   └── components/   # Shared components (GlassPanel, Navigation…)
│       └── lib/
│           └── solana/       # Program client, IDL, API bindings
├── api/
│   ├── tokens/               # POST/GET /api/tokens
│   └── tokens/[mint]/        # /api/tokens/:mint, /trades, /ohlcv
├── supabase/
│   └── migrations/           # DB migrations (tokens, trades, social fields…)
├── tests/                    # Anchor integration tests
├── scripts/                  # Devnet utility scripts
├── SECURITY.md               # Vulnerability disclosure policy
├── PHASES.md                 # Development phases
└── DEVNET_MAINNET_READINESS.md
```

---

## Security

See [SECURITY.md](./SECURITY.md) for the full security policy and vulnerability disclosure process.

**Report vulnerabilities to:** humble.trust@outlook.com  
**GitHub Advisories:** https://github.com/HumbleTrust/humbletrust/security/advisories/new

---

## Disclaimer

This is alpha software running on Solana **devnet**. Devnet tokens have no real value. Do not use real assets. This is not financial advice. Mainnet launch will be announced only after formal audit, multisig migration, and signed readiness checklist.

---

*Built in public · HumbleTrust Protocol · © 2026*

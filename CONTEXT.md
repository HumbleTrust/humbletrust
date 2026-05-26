# HumbleTrust — Project Context

> Read this file first before touching any code. It describes what the project is,
> what has already been built, and what still needs to be done.

---

## What is HumbleTrust?

A **Solana token launchpad** with an AMM bonding-curve (Raydium CPMM), built for devnet and
mainnet-ready. Users launch SPL tokens in Standard or Premium tiers; tokens trade on an internal
bonding curve until they reach 50 SOL liquidity cap, at which point they auto-migrate to Raydium.

Premium tier creators get access to the **Zodiac Badge NFT** system (Metaplex NFT minted on Solana,
visible in Phantom / Solana Explorer).

---

## Repository layout

```
humbletrust/
├── web/                        # Vite + React 18 frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navigation.tsx
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── NftPage.tsx          ← /nft marketing + badge minting
│   │   │   ├── LaunchPage.tsx       ← token launch form
│   │   │   ├── TradePage.tsx
│   │   │   ├── MarketPage.tsx
│   │   │   └── ...
│   │   ├── lib/
│   │   │   └── solana/
│   │   └── main.tsx
│   └── package.json
├── api/                         # Vercel serverless functions (Node.js CJS)
│   ├── _lib/
│   ├── badges/
│   └── tokens/
├── programs/
│   └── humbletrust-v2/src/lib.rs    ← Anchor smart contract (deployed on devnet)
├── supabase/
│   └── migrations/                  ← SQL schema files
└── Anchor.toml
```

---

## Smart contract (Anchor / Rust)

**Program ID (devnet):** `FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr`
**Upgrade authority:** `7iMHH7F7SqAtuRo1sC72KKgWf2vZbfsRYHrpdmS3PSW8`
**Last deployed slot:** 464171893

### Key accounts
| Account | Address | Description |
|---|---|---|
| GlobalStateV2 PDA | `4AzHwSAGtsTWv1cv3ya1g5MKLGDKRcixrbC3hq3hjroj` | Seeds: `[b"global_state_v2"]` |
| Fee wallet | `FYRtG8JMun6vqucUaXGcSZrWib6gNVEW4dd2LEP92mGM` | Receives platform fees |
| Admin | `7iMHH7F7SqAtuRo1sC72KKgWf2vZbfsRYHrpdmS3PSW8` | Upgrade authority + admin ops |

### Key constants (from lib.rs)
- `TOTAL_SUPPLY = 1_000_000_000_000_000_000` (1B tokens, 9 decimals)
- `LAUNCH_FEE_STANDARD = 56_818_181` lamports (~0.057 SOL)
- `LAUNCH_FEE_PREMIUM = 281_818_181` lamports (~0.28 SOL)
- `MIGRATION_THRESHOLD_SOL_LAMPORTS = 50_000_000_000` (50 SOL → auto-migrate to Raydium)
- `PLATFORM_FEE_BPS = 50`, `CREATOR_FEE_BPS = 50`
- `LP_FEE_CREATOR_PREMIUM_BPS = 6_000` (60% LP fees to creator)
- Badge mint price (off-chain): **0.2 SOL standard**, **0.5 SOL genesis (first 100/zodiac)**

### Recently added security patch
`is_launches_paused` field in `GlobalStateV2` — confirmed `false` on devnet.
The contract checks `require!(!ctx.accounts.global_state.is_launches_paused, ...)` before every launch.

---

## Database (Supabase)

### `tokens` table
- `mint` text PK — SPL token mint address
- `creator` text — wallet that launched
- `tier` text — `'standard'` | `'premium'`
- Other fields: name, symbol, supply, bonding curve state, etc.

### `badges` table
```sql
wallet       text unique          -- one badge per wallet
badge_mint   text unique          -- Solana NFT mint address (NULL until on-chain)
zodiac       text                 -- Aries, Taurus, etc.
element      text                 -- Fire, Water, Earth, Air
aura_color   text                 -- hex color derived from wallet address
edition      integer              -- sequential per zodiac sign
minted_at    timestamptz
sold_at      timestamptz
cooldown_until timestamptz        -- sold_at + 30 days
tx_signature text                 -- Solana tx sig of mint transaction
price_sol    numeric(10,4)
status       text                 -- 'active' | 'sold' | 'cooldown'
```

### `badge_editions` table
- `zodiac` text PK
- `count` integer — atomic counter, incremented via `increment_badge_edition(z)` RPC

---

## Frontend stack

- **Vite + React 18 + TypeScript**
- **@solana/wallet-adapter-react** — Phantom / other wallet connections
- **@coral-xyz/anchor ^0.32.1** — Anchor IDL client
- **@metaplex-foundation/umi ^0.9.2** — NFT minting (installed, not yet wired)
- **@metaplex-foundation/umi-bundle-defaults ^0.9.2**
- **@metaplex-foundation/mpl-token-metadata ^3.4.0**
- **lightweight-charts** — candlestick chart on Trade page
- No global state manager — React hooks + direct API calls

---

## Badge NFT system — current state

### What works
1. `GET /api/badges/eligibility?wallet=` — returns `can_mint`, reason, badge data
2. `POST /api/badges/mint` — writes badge to Supabase DB (no on-chain NFT yet)
3. `GET /api/badges/image?zodiac=&element=&aura=&edition=` — returns 440×660 SVG matching design
4. `BadgeModal.tsx` — shows ZodiacBadgeCard preview, eligibility states, confirm flow
5. `NFT.tsx` — marketing page for the badge system

### What is NOT done yet (TODO)
These three API files need to be created:

**`api/badges/metadata.js`**
```
GET /api/badges/metadata?zodiac=Aries&element=Fire&aura=FF7A2F&edition=1
Returns standard Metaplex NFT metadata JSON:
{
  name: "HumbleTrust Aries Badge #001",
  symbol: "HTBADGE",
  description: "...",
  image: "{origin}/api/badges/image?zodiac=Aries&element=Fire&aura=FF7A2F&edition=1",
  attributes: [{ trait_type: "Zodiac", value: "Aries" }, ...],
  properties: { files: [...], category: "image" }
}
```

**`api/badges/prepare.js`**
```
POST /api/badges/prepare  { wallet }
1. Checks eligibility (same logic as mint.js)
2. Atomically reserves an edition number via increment_badge_edition()
3. Returns { zodiac, element, aura_color, edition, metadata_uri } for client
   where metadata_uri = "{appUrl}/api/badges/metadata?zodiac=...&edition=N"
```

**`api/badges/confirm.js`**
```
POST /api/badges/confirm  { wallet, badge_mint, tx_signature }
1. Validates wallet + badge_mint are valid Solana addresses
2. Upserts badge row in Supabase with badge_mint + tx_signature + status='active'
```

And one TypeScript lib file:

**`web/src/lib/solana/mintBadgeNft.ts`**
```typescript
// Uses Metaplex Umi + walletAdapterIdentity to create a Metaplex NFT on devnet
// Flow:
//   1. Call POST /api/badges/prepare → get zodiac, element, aura, edition, metadata_uri
//   2. Build Umi with walletAdapterIdentity(wallet)
//   3. Call createNft({ name, uri: metadata_uri, sellerFeeBasisPoints: 0, ... })
//   4. Send transaction — user signs in Phantom
//   5. Call POST /api/badges/confirm → store badge_mint + tx_signature in DB
// Returns: { badge_mint: string, tx_signature: string }
```

And update to `BadgeModal.tsx`:
- Replace current `handleMint()` which calls `POST /api/badges/mint`
- New flow: call `mintBadgeNft(wallet, walletAdapter)` which wraps prepare→createNft→confirm
- Show link to Solana Explorer after successful mint

---

## ZodiacBadgeCard component

`web/src/app/pages/NftPage.tsx` currently contains the canonical Zodiac badge card UI and badge mint modal.

Exports:
- `ZodiacBadgeCard` — main component props: `{ zodiac, element, aura, edition, season? }`
- `ELEMENT_COLOR` — `{ Fire: "#FF7A2F", Water: "#00D4FF", Earth: "#14F195", Air: "#9945FF" }`
- `getAuraVars(aura)` — returns CSS var object for glow effects
- `ShieldGlyph` — zodiac glyph SVG component
- `ElementSigil` — element sigil SVG component

---

## Git

**Main branch:** `main`
**Active branch:** `main`

Create feature branches from `main` for new work, then merge back after testing.

---

## Environment variables (Vercel + local)

```
SUPABASE_URL=          # Supabase project URL
SUPABASE_KEY=          # Supabase anon key (service key for write ops)
VITE_SUPABASE_URL=     # same, exposed to frontend
VITE_SUPABASE_KEY=     # same
VITE_SOLANA_RPC=       # devnet RPC URL (or mainnet)
VITE_PROGRAM_ID=FGQ16c5cmDkmDRG27kt27VrZP3FnhHTH3qtrXoMg3PGr
```

---

## API conventions

All API routes are Vercel serverless functions in `api/` using **CommonJS** (`require`/`module.exports`).
- Use `setCors(req, res)` from `../_lib/validate.js` at the top of every handler
- Use `getClient()` from `../_lib/db.js` for Supabase
- Use `isValidWallet(addr)` for all wallet address inputs
- Return JSON — `res.json({...})` for success, `res.status(4xx).json({ error: '...' })` for errors

---

## Design tokens (CSS vars in `web/src/styles/index.css`)

```
--bg:           #05070F   main background
--bg2:          #080B14   section background
--bg3:          #0C1018   card background
--border:       rgba(255,255,255,.07)
--green-neon:   #00FF94
--muted:        rgba(255,255,255,.45)
--muted2:       rgba(255,255,255,.62)
--font-head:    'Chakra Petch', sans-serif
--font-mono:    'JetBrains Mono', monospace
```

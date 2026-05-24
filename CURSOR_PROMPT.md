# HumbleTrust — Cursor AI Project Directive

## Project Overview

**HumbleTrust** is a Solana-native trust infrastructure platform. It lets token creators launch with on-chain commitments: liquidity locks, creator vesting, mint/freeze revocation, and a composable TrustScore. The tagline is **"Programmable accountability."**

This is **not** a meme-coin launchpad. Do not treat it as one. The product sits closer to Uniswap, Stripe, or Linear in its institutional gravity. Every design and engineering decision should reinforce: *serious infrastructure for people who are done getting rugged.*

---

## Tech Stack

- **Framework**: Next.js 14 App Router (`/web`)
- **Styling**: Tailwind CSS v3 + CSS custom properties (no shadcn/ui)
- **Animation**: Framer Motion (already installed)
- **State / Data**: TanStack React Query v5, Zustand
- **Wallet**: `@solana/wallet-adapter-react`, Phantom + Solflare adapters
- **Blockchain**: Solana mainnet (or devnet for local dev)
- **Language**: TypeScript — strict, no `any`, no `@ts-ignore`
- **Fonts**: Geist (display/body), Inter (body), JetBrains Mono (mono/data)
- **Icons**: Lucide React only (already installed)
- **Package manager**: npm

### File Structure (abridged)

```
web/
  src/
    app/                        # Next.js App Router pages + API routes
      api/projects/[id]/        # REST: get, invest, trust-score
      api/stats/                # REST: platform stats
      app/                      # /app route → dashboard shell
      page.tsx                  # Landing page
      layout.tsx                # Root layout, font config
    components/
      core/                     # Domain components (ProjectCard, TrustBadge, etc.)
      dashboard/
        dashboard-shell.tsx     # Main app: 7-tab shell (Explore, Launch, Portfolio, Analytics, Market, Trade, Badges)
      landing/
        landing-page.tsx        # Marketing landing page
      ui/                       # Primitives: Button, Card, Input, Modal, Select, Tooltip
      providers/
        app-providers.tsx       # QueryClient + WalletProvider
    hooks/
      use-projects.ts           # useProjects, useStats hooks
    lib/
      mock-data.ts              # Seed data (until DB is wired)
      trust-score.ts            # TrustScore calculation engine
      utils.ts                  # cn(), formatSol(), formatNumber()
    types/
      index.ts                  # All shared types
```

---

## Design System

### Color Tokens (CSS custom properties — `globals.css`)

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#05080f` | Page background |
| `--bg-surface` | `#0a0f1a` | Cards, panels |
| `--bg-elevated` | `#0f1624` | Dropdowns, modals |
| `--border-subtle` | `#1a2436` | Default borders |
| `--border-focus` | `#2a3a56` | Hover/focus borders |
| `--primary` | `#00ffb2` | Brand green — CTA, accents |
| `--secondary` | `#3d7fff` | Blue — secondary actions |
| `--accent` | `#7b4fff` | Purple — decorative highlights |
| `--danger` | `#ff4444` | Errors, risky scores |
| `--warning` | `#ffb800` | Warnings, moderate scores |
| `--text-primary` | `#f0f4ff` | Body text |
| `--text-secondary` | `#8896b3` | Labels, subtitles |
| `--text-muted` | `#4a5568` | Placeholders, disabled |

### Tailwind Config Conventions

- `bg-[var(--bg-surface)]` — use CSS var tokens, not raw hex
- `rounded-pill` = `border-radius: 999px` (already in tailwind config)
- `glass-panel` — utility class (in `@layer components`): `rgba(10,15,26,0.76)` + blur(18px) + subtle border
- `eyebrow` — monospace pill label (used before section headings)
- `mono-chip` — small data tag with mono font
- `section-shell` — 1180px max-width centered container
- `noise-overlay` — fixed grid overlay (already in layout)

### Typography Scale

- **Display headings**: `font-geist font-bold` — `text-4xl` to `text-6xl`
- **Section headings**: `font-geist font-semibold` — `text-2xl` to `text-3xl`
- **Body**: `font-inter text-base text-[var(--text-primary)]`
- **Labels / captions**: `font-inter text-sm text-[var(--text-secondary)]`
- **Data / numbers**: `font-mono tabular-nums` — always use for prices, scores, addresses
- **Eyebrow labels**: use `.eyebrow` class, ALL CAPS, monospace

---

## Brand Identity & Visual Language

### Core Principle: Institutional Engineering Aesthetic

HumbleTrust is infrastructure. The UI should feel like it was designed by engineers who care about design — the way Linear, Vercel, Stripe, or Compound feel. **Not** a glowing, neon cyberpunk casino.

**What this means in practice:**

- **Restraint over decoration.** Every glow, gradient, and animation must earn its place by communicating something (state, depth, trust). Remove anything decorative that communicates nothing.
- **Data density with breathing room.** Show numbers cleanly. Use `tabular-nums`. Group related data. Give whitespace — but don't waste vertical space.
- **Precision over personality.** Use sharp grids. Align things. Consistency beats creativity.
- **Trust signals everywhere.** TrustScore badges, lock timers, verification chips, and on-chain proof links should be visible without hunting. If it protects the user, make it prominent.

### Motion Philosophy

- Use `framer-motion` for all transitions. No raw CSS `transition` on interactive elements.
- **Appear**: `opacity: 0 → 1` + `y: 12 → 0`, `duration: 0.22s`, `ease: [0.22, 1, 0.36, 1]`
- **Tab switches**: `AnimatePresence` with `mode="wait"`, slide in from right on advance, left on retreat
- **Spring interactions**: `whileHover={{ scale: 1.02 }}`, `whileTap={{ scale: 0.96 }}` with `stiffness: 600, damping: 35`
- **Stagger**: `staggerChildren: 0.045s` for card lists and grid items
- **Counters**: Animate numeric values with `useMotionValue` + `useTransform` (see `AnimatedNumber` component)
- **Never** animate layout on scroll. Scroll-triggered reveals should use `IntersectionObserver`, not scroll handlers.
- **Reduced motion**: Always wrap in `@media (prefers-reduced-motion: reduce)` — override to instant in `globals.css` already handles this.

### Component Aesthetics

**Cards** (`glass-panel`):
- Background: `rgba(10, 15, 26, 0.76)`, `backdrop-filter: blur(18px)`
- Border: `1px solid rgba(255,255,255,0.06)`
- Box shadow: subtle green glow `0 0 60px rgba(0,255,178,0.04)` + `inset 0 1px 0 rgba(255,255,255,0.05)`
- Hover: border transitions to `rgba(0,255,178,0.18)`, glow intensifies slightly
- Corner radius: `rounded-2xl` (16px) for cards, `rounded-xl` (12px) for inner sections

**Buttons** (see `components/ui/button.tsx`):
- Primary: `bg-[var(--primary)]`, text `#03110c` (dark green-black), `shadow-primary-glow`
- Secondary: `bg-[var(--secondary)]`, `shadow-blue-glow`
- Ghost: transparent, `border-white/5`, hover green tint
- Always `rounded-pill` (999px), `font-semibold`
- Sizes: `sm` (h-9), `md` (h-11), `lg` (h-[52px])

**Inputs** (see `components/ui/input.tsx`):
- Background: `rgba(15,22,36,0.6)`
- Border: `var(--border-subtle)`, focus: `var(--primary)` with ring
- Monospace when showing addresses, amounts, or codes

**Badges / Trust indicators**:
- TrustScore colors: Verified=`#00ffb2`, Safe=`#00d4ff`, Moderate=`#ffb800`, Risky=`#ff7a00`, Danger=`#ff4444`
- Always show TrustScore as `number/100` in monospace
- Lock timer: countdown chip with clock icon, monospace countdown

---

## UX Psychology Principles

1. **Trust is the product.** Every screen should answer: *"Why should I trust this token?"* Surface TrustScore, lock duration, and mint/freeze status before price or volume.

2. **Reduce cognitive load at decision points.** On the Launch form, break into steps. On the Trade screen, show price impact prominently — if >5%, warn in amber; if >15%, warn in red.

3. **Wallet-gated flows.** If the user hasn't connected a wallet, show the feature dimly (not hidden) with a clear "Connect wallet to continue" prompt. Never 404 or redirect — show the wall inline.

4. **Empty states are onboarding.** An empty Portfolio tab is an invitation to explore. An empty project list is a prompt to launch. Design every empty state with a CTA.

5. **Numbers are proof.** Animate counts up on mount (AnimatedNumber). Show on-chain TX signatures as abbreviated monospace links. Make "verified on-chain" feel real.

6. **Mobile-first breakpoints**:
   - Mobile: single column, bottom nav or hamburger
   - Tablet (768px): 2-col grid, sidebar optional
   - Desktop (1024px+): sidebar nav, 3-col grids, full data density

---

## Architecture Rules

1. **No `any`, no `@ts-ignore`, no `as unknown as X`.** Fix the type, or use a proper discriminated union.

2. **Server Components by default.** Only add `"use client"` when the component needs: hooks, event listeners, wallet adapter, or framer-motion. Keep data fetching in Server Components where possible.

3. **API routes** live in `app/api/`. All responses follow `{ data: T }` or `{ error: string }` shape.

4. **React Query** for all client-side data. Keys: `["projects"]`, `["project", id]`, `["stats"]`. staleTime: 30s. Do not fetch inside `useEffect`.

5. **Zustand** for ephemeral UI state only (selected tab, modal open, filter state). Do not put server data in Zustand.

6. **Component co-location.** If a component is only used in one tab of `dashboard-shell.tsx`, write it in the same file as a local function. Extract to `components/` only when used in 2+ places.

7. **Mock data** is in `lib/mock-data.ts`. API routes import from it. When wiring real DB, only `mock-data.ts` and the route handlers need updating — component code should be unchanged.

8. **No default exports** from component files (except pages). Use named exports.

9. **Error boundaries.** Every tab should gracefully handle data fetch failures with a retry button. Don't let one failed request blank the whole dashboard.

---

## Key Domain Concepts

### TrustScore (0–100)
Computed from 7 factors in `lib/trust-score.ts`:
- `liquidityPresent` (20 pts) — LP funded and locked
- `lockDuration` (20 pts) — 0→20 scaled over 365 days
- `mintRevoked` (20 pts) — creator cannot mint new supply
- `freezeRevoked` (15 pts) — creator cannot freeze accounts
- `vestingEnabled` (10 pts) — creator tokens vest over time
- `allocation` (10 pts) — creator % of supply (inverse: <10% = full points)
- `age` (5 pts) — token age in days, capped at 30 days

Labels: Verified (90+), Safe (70–89), Moderate (50–69), Risky (30–49), Danger (<30)

### Bonding Curve (Trade tab)
- Constant product AMM: `x·y=k` where x=SOL reserve, y=token reserve
- Initial state: `solReserve=0.5 SOL`, `tokenReserve=350,000,000 tokens`
- Fee: 1% (`CURVE_FEE = 0.01`) deducted before swap
- `calcBuy(solIn, solReserve, tokenReserve)` → tokens out
- `calcSell(tokensIn, solReserve, tokenReserve)` → SOL out
- Price impact: `Math.abs(estimatedOut/exactOut - 1) * 100`

### Zodiac Badges (NFT tab)
- Token-2022 NFTs, non-transferable
- Sign determined from token launch date (not user birth date)
- 12 signs with fixed date ranges, element (Fire/Earth/Air/Water), and unique color
- Aura color derived from creator wallet address (first 6 hex chars)
- Only 1 badge per wallet per project

### Project Status Flow
`pending → live → (locked | completed)`
- `live`: actively trading, LP open
- `locked`: creator LP lock still active
- `completed`: lock expired or graduated to full DEX

---

## Dashboard Tabs

| Tab | Route param | Description |
|---|---|---|
| Explore | `explore` | Browse all projects, filter by TrustScore |
| Launch | `launch` | Multi-step token creation wizard |
| Portfolio | `portfolio` | User's investments, P&L |
| Analytics | `analytics` | Platform stats, score history charts |
| Market | `market` | Live token prices from DexScreener API |
| Trade | `trade` | Bonding curve buy/sell interface |
| Badges | `nft` | Zodiac Badge NFT mint |

---

## DexScreener Integration (Market tab)

```typescript
// Popular token addresses (comma-separated)
const POPULAR_ADDRESSES = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263,...";

// Endpoints
GET https://api.dexscreener.com/latest/dex/tokens/{addresses}  // batch lookup
GET https://api.dexscreener.com/latest/dex/search?q={query}    // search

// DexPair shape (key fields)
type DexPair = {
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { symbol: string };
  priceUsd?: string;
  volume: { h24: number };
  priceChange: { h24: number };
  liquidity?: { usd: number };
  fdv?: number;
  info?: { imageUrl?: string };
  url: string;  // DexScreener chart link
};
```

Debounce search input 500ms. Deduplicate pairs by baseToken address (keep highest volume). Show embedded chart in modal via `iframe src={pair.url}`.

---

## What Good Looks Like — Reference Designs

- **Linear** (linear.app) — dense data, surgical motion, no decorative gradients
- **Vercel dashboard** — sidebar nav, clean card grids, status chips
- **Compound Finance** — on-chain data front and center, trust through transparency
- **Stripe** — form UX, multi-step flows, clear error states
- **Uniswap** — swap UI layout, price impact warnings, slippage controls

**Not**: Pump.fun, any neon-on-black meme launchpad, anything with spinning 3D logos.

---

## Code Style

```typescript
// Component signature
export function ComponentName({ prop1, prop2 }: { prop1: string; prop2: number }) {
  // ...
}

// Tailwind: prefer template strings over long cn() calls
const cardClass = "glass-panel rounded-2xl p-6 flex flex-col gap-4";

// Numbers: always format
import { formatSol, formatNumber } from "@/lib/utils";
// formatSol(1.23456) → "1.2346 SOL"
// formatNumber(1234567) → "1.23M"

// Colors: never hardcode hex in JSX — use CSS var tokens
// ✅ text-[var(--primary)]
// ❌ text-[#00ffb2]

// Addresses: always truncate
function truncate(addr: string) {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}
```

---

## Immediate Improvement Priorities

When improving the dashboard, focus on these in order:

1. **Polish the Launch form** — it's the core product action. Multi-step wizard, clear validation, preview of resulting TrustScore before submission.

2. **Project cards in Explore** — show TrustScore badge prominently, lock timer, 24h change chip. Make the card feel like a trust report, not a price ticker.

3. **Portfolio tab** — aggregate PnL, position cards with entry price and current value, sparkline charts using `sevenDayActivity` data already on the Project type.

4. **Analytics tab** — platform-level KPIs (totalLockedSol, rugsPrevented, investorsProtected), TrustScore distribution histogram, top-performing projects.

5. **Mobile nav** — current sidebar nav needs a bottom tab bar at mobile breakpoint.

6. **Error and loading states** — skeleton loaders matching the card layout, retry buttons, empty states with CTAs.

7. **Trade tab** — wire the bonding curve preview to the project's actual `totalInvestedSol` from React Query (not a fixed constant).

8. **Landing page** — hero section needs a live stat ticker (animated numbers from `/api/stats`), a 3-project showcase from the live data, and a clear "Launch a Token" CTA.

---

## What NOT To Do

- Do not add shadcn/ui, MUI, Chakra, or any other component library. We have our own primitives.
- Do not use `any` type. Do not bypass TypeScript.
- Do not add `console.log` to production code.
- Do not hardcode wallet addresses, program IDs, or RPC URLs in component files — use environment variables.
- Do not make the UI feel like a meme launchpad. Restraint is a feature.
- Do not introduce new dependencies without checking if an existing one covers it.
- Do not style with inline `style={{}}` except for dynamic CSS custom property values that Tailwind can't handle.
- Do not touch `lib/mock-data.ts` structure — only add/edit entries, never change types.

---

## Environment Variables (`.env.local`)

```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_PROGRAM_ID=<your_program_id>
DATABASE_URL=<postgres_connection_string>
```

---

*This document is the canonical design and engineering specification for HumbleTrust. All code produced for this project must be consistent with the principles, patterns, and constraints described here.*

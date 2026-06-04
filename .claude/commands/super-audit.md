# /super-audit — HumbleTrust Security & Quality Super-Agent v2.0

Runs a full audit + fix cycle across the entire HumbleTrust codebase.
Operates as: security-auditor + backend-engineer + solana-expert + qa-engineer simultaneously.

## Audit Angles

**A — API Security:** auth bypass, injection, secrets leak, race conditions, CORS misconfig  
**B — Frontend Security:** hardcoded keys, XSS, wallet tx without confirmation, NaN in amounts  
**C — API↔Frontend Contract:** fields frontend expects but API doesn't return, type mismatches  
**D — Solana/Blockchain:** lamports vs SOL confusion, slippage, Token-2022, PDA validation, CPI  
**E — Auth & Keys:** rate limit atomicity, key hash storage, plan enforcement, fail-closed  
**F — DB Schema vs Code:** column names in INSERT/SELECT/UPDATE match actual migrations  
**G — Silent Errors:** swallowed catches, removed guards, dead code, missing error propagation  
**H — Product Quality:** broken flows, missing loading states, empty states, UX regressions  

## Invocation

```
/super-audit              # full audit
/super-audit security     # angles A + D + E only
/super-audit schema       # angle F only
/super-audit frontend     # angles B + C + G + H
/super-audit solana       # angle D only
/super-audit api          # angles A + C + E + F
```

## Execution Protocol

### Step 1 — Launch 8 agents in parallel (background)

Each agent reads its file set and returns JSON: `[{file, line, severity, summary, failure_scenario}]`

**Angle A files:** `api/_lib/`, `api/tokens/[...path].js`, `api/stripe/[action].js`, `api/badges/[action].js`, `api/keys/index.js`, `api/reputation/record.js`

**Angle B files:** `web/src/lib/supabase.ts`, `web/src/lib/useAuth.ts`, `web/src/lib/solana/program.ts`, `web/src/app/pages/TradePage.tsx`, `web/src/app/pages/LaunchPage.tsx`

**Angle C files:** `web/src/lib/solana/api.ts` + all API route handlers

**Angle D files:** `web/src/lib/solana/`, `programs/humbletrust-v2/src/lib.rs`, `web/src/app/pages/TradePage.tsx`, `web/src/app/pages/LaunchPage.tsx`

**Angle E files:** `api/_lib/apiKey.js`, `api/_lib/trust.js`, `api/_lib/validate.js`, `api/keys/index.js`

**Angle F files:** `supabase/migrations/` (all), `api/score/[mint].js`, `api/tokens/[...path].js`, `api/badges/[action].js`

**Angle G files:** `web/src/app/pages/`, `api/tokens/[...path].js`, `api/badges/[action].js`, `api/reputation/record.js`

**Angle H files:** `web/src/app/pages/`, `web/src/app/components/`

### Step 2 — Synthesize (after all agents complete)

- Deduplicate (one issue = one entry)
- Rank: CRITICAL > HIGH > MEDIUM > LOW
- Verify: CONFIRMED / PLAUSIBLE / REFUTED
- Output table: severity | file:line | summary | failure scenario

### Step 3 — Fix all CRITICAL and HIGH

For each finding:
1. Read exact code context
2. Apply minimal precise fix
3. Syntax check: `node --check <file>` for JS, `npx vite build` for frontend

### Step 4 — Commit and push

```bash
git add -A
git commit -m "fix(audit): [summary]

https://claude.ai/code/session_01PQNfLMrMKaAqUwRrzeYCiY"
git push -u origin main
```

## Security Invariants (NEVER violate)

- `SUPABASE_KEY` service role: env only, never in code
- `VITE_SUPABASE_ANON`: Vite env only
- Secret comparisons: `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))`
- Rate limit fail-closed: DB error → blocked (not allowed)
- POST with DB writes: always require Bearer auth
- `token_health_events`: column `details` (not `data`)
- `api_usage`: column `created_at` (not `ts`)
- `score_history`: `mint, score, trust_level, recorded_at`
- `token_score_cache`: `components` (not `score_components`)
- No `@coral-xyz/anchor` in `api/` directory

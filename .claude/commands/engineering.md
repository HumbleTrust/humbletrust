---
name: engineering
description: Production-grade engineering workflows covering the full development lifecycle — spec, plan, build, test, review, and ship. Based on Addy Osmani's agent-skills framework. Use when starting features, reviewing code, debugging, or shipping.
metadata:
  trigger: Engineering tasks, new features, code review, debugging, CI/CD, spec writing, PR review, architecture
  author: Addy Osmani (https://github.com/addyosmani/agent-skills) — adapted for HumbleTrust
  source: https://github.com/addyosmani/agent-skills
---

# Engineering Skill

Production-grade engineering workflows for the full development lifecycle.

## Skill Map — Route Incoming Work

```
Task arrives
    │
    ├── Don't know what you want yet? ──────→ /interview
    ├── Have a rough concept? ──────────────→ /idea-refine
    ├── New project/feature/change? ────────→ /spec
    ├── Have a spec, need tasks? ───────────→ /plan
    ├── Implementing code? ──────────────────→ /build
    │   ├── UI work? ──────────────────────→ /uiux-promax
    │   ├── API work? ─────────────────────→ /api-design
    │   └── Stakes high / unfamiliar? ──────→ /doubt
    ├── Writing/running tests? ─────────────→ /test
    ├── Something broke? ────────────────────→ /debug
    ├── Reviewing code? ─────────────────────→ /code-review
    │   ├── Too complex? ──────────────────→ /simplify
    │   ├── Security? ─────────────────────→ /super-audit
    │   └── Performance? ──────────────────→ /perf
    ├── Committing/branching? ──────────────→ /git
    └── Deploying? ──────────────────────────→ /ship
```

## Core Operating Behaviors

These apply at all times across all tasks.

### Surface Assumptions First
Before implementing anything non-trivial:
```
ASSUMPTIONS I'M MAKING:
1. [requirement assumption]
2. [architecture assumption]
3. [scope assumption]
→ Correct me now or I'll proceed with these.
```
Never silently fill in ambiguous requirements.

### Specification Before Code
New projects/features always get a spec first:
1. **Objective** — What + why + success criteria
2. **Commands** — Full executable build/test/dev commands
3. **Project structure** — Where things live
4. **Code style** — One real example beats three paragraphs
5. **Testing strategy** — Framework, location, coverage targets
6. **Boundaries** — Always/Ask/Never table

### Incremental Implementation
- One thin vertical slice at a time
- Working state preserved at every step
- Tests written before or alongside code (never after)
- Never skip a phase because a previous one "felt good"

## Sub-Workflows

### `/spec` — Spec-Driven Development
Write structured specification before writing code.

**Gated phases** (don't advance without human sign-off):
```
SPECIFY → PLAN → TASKS → IMPLEMENT
   │         │       │         │
 Human    Human   Human     Human
 reviews  reviews reviews   reviews
```

For each spec phase:
1. State assumptions explicitly
2. Ask clarifying questions
3. Get confirmation before moving on

### `/plan` — Planning & Task Breakdown
Decompose spec into verifiable atomic tasks.

**Task format:**
```markdown
## Task: [Name]
**Goal:** [One sentence]
**Inputs:** [Files/data needed]
**Outputs:** [Files/data produced]
**Verify:** [How to confirm it's done]
**Rollback:** [How to undo if needed]
```

Rules:
- Each task ≤ 2 hours of work
- Each task has a clear done state
- Prefer reversible over irreversible operations
- Dependencies explicit and minimal

### `/build` — Incremental Implementation
Build one feature slice at a time.

**Approach:**
1. Implement the narrowest path first
2. Run tests after every meaningful change
3. Commit at each stable state
4. Document tradeoffs in code comments (not process)

**Anti-patterns to refuse:**
- "I'll add tests later" — Add them now
- "It works, ship it" — Review it first
- "Just this one exception" — Enforce the standard
- Rewriting working code speculatively

### `/test` — Test-Driven Development
Red-Green-Refactor cycle.

**Test pyramid:**
```
         ╱ E2E ╲           (few, slow, brittle — only critical paths)
        ╱─────────╲
       ╱ Integration╲      (some — verify components work together)
      ╱───────────────╲
     ╱   Unit Tests    ╲   (many — verify units in isolation)
    ╱───────────────────╲
```

**For each test:**
- Arrange: set up state
- Act: invoke the thing
- Assert: verify the outcome
- One assertion per test concept

### `/debug` — Debugging & Error Recovery
Five-step triage:

1. **Reproduce** — Minimal reproducible case
2. **Isolate** — Binary search (divide and narrow)
3. **Hypothesize** — Form specific theory, not "it might be..."
4. **Verify** — Test hypothesis explicitly
5. **Fix** — Minimal targeted change; then add regression test

**Never:**
- Make multiple changes at once when debugging
- "Fix" by suppressing the error
- Assume the bug is where you first looked

### `/code-review` — Five-Axis Review

Every review covers:

1. **Correctness** — Does it match spec? Edge cases? Error paths?
2. **Readability** — Names clear? Control flow obvious? Cuttable abstractions?
3. **Architecture** — Fits existing patterns? Clean boundaries? No unnecessary coupling?
4. **Security** — Auth/authz? Input validation? Injection risks? Secret handling?
5. **Performance** — Unnecessary work? N+1 queries? Memory leaks?

**Approval standard:** Approve if it definitely improves overall code health, even if not perfect. Don't block for style when substance is sound.

### `/ship` — Release Checklist

Before shipping any change:
- [ ] Tests pass (unit + integration)
- [ ] Security review complete for auth/data changes
- [ ] Schema migrations are backwards-compatible
- [ ] Feature flags or rollback plan exists for risky changes
- [ ] Monitoring/logging covers the new behavior
- [ ] No sensitive data in logs or error responses
- [ ] Rate limiting on new API endpoints
- [ ] Documentation updated if API contract changed

### `/doubt` — Doubt-Driven Development
For high-stakes or unfamiliar code:

1. List all the ways this could go wrong
2. For each risk: what's the blast radius? What's the rollback?
3. Build adversarial test cases for each failure mode
4. Only proceed when risks are understood and mitigated

**Trigger this for:**
- Touching auth/security code
- Database migrations with data changes
- Removing code you don't fully understand
- Integration with external systems

## Engineering Principles (from Google SWE Book)

**Hyrum's Law** — All observable behaviors become dependencies. Design APIs with this in mind.

**Beyonce Rule** — If you liked it, put a test on it. If a test doesn't exist, the behavior can change without anyone noticing.

**Chesterton's Fence** — Never remove code you don't understand. Understand why it exists first.

**Trunk-based development** — Short-lived branches, merge to main frequently. Long-lived branches create integration debt.

**Code is liability** — Every line of code is a maintenance burden. Write less, not more.

## HumbleTrust-Specific Engineering Rules

- API endpoints that write to DB require auth (`INTERNAL_API_SECRET` or user Bearer token)
- All secret comparisons use `crypto.timingSafeEqual`
- Rate limiting fails closed (DB error → blocked, not allowed)
- Column names: `details` (token_health_events), `created_at` (api_usage), `components` (token_score_cache), `recorded_at` (score_history)
- Supabase anon key only via `VITE_SUPABASE_ANON` env var
- Service role key only via `SUPABASE_KEY` env var

## How to Invoke

When user says `/engineering [task]` or starts any engineering work:

1. Route to the correct sub-workflow using the skill map
2. Surface assumptions before doing anything
3. Follow the gated workflow for the relevant phase
4. Apply HumbleTrust-specific rules where relevant

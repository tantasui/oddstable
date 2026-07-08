# CLAUDE.md — OddsPool project rules

> Working name "OddsPool" — RENAME. Do NOT reuse "Punter Clash" name/branding/UI.
Standing rules for every session. Read first. Full spec: `contest-prd.md`.

---

## What this is
An on-chain prediction-pool contest platform. Anyone creates a contest (a set of World
Cup matches); many players join and predict 1X2 outcomes; score = **Oddscore** (product
of the odds of correct picks); live leaderboard ranks everyone; results resolve
trustlessly on Solana via TxLINE `validate_stat`. Hackathon: TxODDS Track 1. Deadline
**July 19, 2026**.

## Current phase: PHASE 1 ONLY
Build the free, off-chain contest loop. **Do NOT build Phase 2** (Solana program,
escrow, USDC, payout, `validate_stat`) unless told the phase changed. If a task implies
Phase 2, stop and confirm.

---

## Invariants — never let these drift

### 1. ONE scoring/resolution rule
- Lives ONLY in `/packages/rules`. Never reimplement scoring in server or client — import it.
- Pure functions: same inputs -> same output. No I/O, clock, or randomness inside.
- **Integer fixed-point only.** Odds are integer basis points (`oddsBp`, x100). No floats
  in ranking math (floats cause TS/Rust drift). `oddscoreDisplay` is the only place a
  float appears, and it's display-only.
- Oddscore = product of odds of CORRECT picks; wrong picks dropped (x1.0); 0.00 if none
  correct. Rank by `oddscoreRaw` desc, then earliest `submittedAt`.
- Any scoring change updates the unit tests in the same commit. Tests are the contract.

### 2. Markets
v1 is **1X2 only** (`'1'`/`'X'`/`'2'`). Keep `market` an enum so Over/Under etc. can be
added later, but do not build other markets now.

### 3. Odds are locked at contest creation
Snapshot odds from the odds feed when the contest is created; store on each
`contest_match`; identical for every player; never recompute later.

### 4. Feed abstractions
- Two interfaces: `OddsSource` (snapshot at creation) and `ScoreSource` (live + resolution).
- **Client never calls TxLINE directly.** Only the server subscribes; it pushes
  leaderboards over WebSocket.
- Implementations: `Mock*` (dev default), `TxLine*` (wired last), `ReplayScores`.
- Build everything against `Mock*` first; no TxLINE credentials needed for steps 1-11.

### 5. The free/onchain seam
Contest has `mode: 'free' | 'onchain'`. Phase 1 is always `'free'` and never touches
Solana. Phase 2 is additive — same create/predict/leaderboard/scoring.

### 6. Design = "Playful" (light), and it's ORIGINAL
- Background Oat Canvas `#f6f2ee` (never pure white). Cards Paper White `#ffffff`, 44px
  radius, card shadow. Hot Magenta `#ff2e95` ONLY for primary CTA/links/logo/live pulse.
- No other accent colors. No dark theme. No navy/orange. Do not copy Punter Clash's look.
- Display headlines + big Oddscore numbers: Inter 700/900 italic, large, line-height ~1.0.
- Pill buttons (99px). Shadows on cards only. Live elements pulse magenta (no glow).
- Use the Tailwind `@theme` tokens, not raw hexes, in components.

---

## Conventions
- Monorepo: `/packages/rules`, `/apps/server`, `/apps/client`, `/programs/contest` (empty in P1).
- Client: Next.js + TS + Tailwind v4, mobile-first responsive.
- Server: Node + TS, WebSocket (`ws`/`socket.io`), REST for non-realtime.
- DB: Postgres (or SQLite locally) + Drizzle.
- `/packages/rules` has zero framework deps; both sides import it. Shared types live there.
- Server is source of truth for leaderboards; clients render what's pushed.
- No browser storage (localStorage/sessionStorage) for game state — server-authoritative.
- Persist every score update to `score_log` (it's the live feed + replay source).
- TypeScript strict; no `any` to dodge errors.

## Definition of done (per task)
- `/packages/rules` tests pass after any scoring change.
- Type-checks clean.
- Works end-to-end against `Mock*`.
- UI uses Playful tokens (no stray colors, no dark surfaces).

## Commands
```
install:   bun install
dev:       bun run --filter @oddstable/server dev & bun run --filter @oddstable/client dev
test:      bun run --filter @oddstable/rules test
typecheck: cd packages/rules && bun x tsc --noEmit
db:        cd apps/server && bun run db  # generate + migrate + seed (SQLite local.db)
```

---

## Do NOT
- Build Phase 2 / Solana / escrow / payout / real-money code in Phase 1.
- Reimplement the scoring rule outside `/packages/rules`, or use floats in ranking.
- Add markets beyond 1X2, or recompute odds after contest creation.
- Call TxLINE from the client.
- Clone Punter Clash's name/branding/UI; introduce a dark theme, navy/orange, or any
  color outside the Playful tokens.
- Use Service Level 1 (60s delayed) for live play — only SL12 (real-time).
- Hardcode TxLINE endpoint shapes from memory — fetch the index first:
  https://txline-docs.txodds.com/llms.txt
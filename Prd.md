# OddsPool — Product Requirements Document

> **Working name: "OddsPool" — RENAME IT.** Do not reuse "Punter Clash" or clone its
> branding/UI; this product must be original work (hackathon T&C requires it).
>
> An on-chain **prediction-pool contest** platform. Anyone creates a contest (a set
> of World Cup matches); many players join and predict outcomes; score is **Oddscore**
> (the odds of your correct picks, multiplied); a live leaderboard ranks everyone;
> results are resolved **trustlessly on Solana** via TxLINE's `validate_stat` proofs.
>
> Built for **TxODDS World Cup Hackathon — Track 1: Prediction Markets and
> Settlement** ($18K, deadline **July 19, 2026, 23:59 UTC**).

---

## 0. How to use this document (Claude Code, read first)

- **Build Phase 1 only.** Phase 2 (Solana program / escrow / settlement) is described
  for context so the architecture fits it, but **do not build it yet**.
- **Phase 1 needs no external credentials.** All match data sits behind feed
  interfaces with `Mock` implementations. Build + test against mocks first; wire real
  TxLINE last.
- **Before writing the TxLINE layer, fetch the live docs** (§7). Do not hardcode
  endpoint shapes from memory.
- This product replaces the earlier 1v1 "Pitch Duel" spec. The contest (N-player)
  model is the core now.

---

## 1. Why this model (context)

Cloned in spirit from a proven web2 product (Punter Clash). Two reasons it's a strong
Track 1 core:

- **No matchmaking problem.** A contest is one pool many players join. It fills
  naturally and is more viral than 1v1 pairing.
- **Cleanest possible on-chain resolution.** A 1X2 match outcome = home goals vs away
  goals = **one comparison, one match, one Merkle proof**. You resolve each *match*
  once (not each player), regardless of how many players joined. This maps onto
  `validate_stat` better than any stat-formula game.

**The value-add over the web2 original is the on-chain settlement + verifiable
resolution.** A clone with no chain is a weak Track 1 fit; the proof layer is what
makes it strong. Build your own UI — the mechanic is what we're reusing, not the look.

---

## 2. The Oddscore mechanic (the heart)

- A contest has **M matches**. Each match has a **1X2 market** with three odds:
  `1` (home win), `X` (draw), `2` (away win). **Odds are locked at contest creation**
  (snapshotted from TxLINE's odds feed) and are identical for every player.
- A player's **entry** = one pick (`1`/`X`/`2`) for every match in the contest.
- After matches resolve, **Oddscore = the product of the odds of the picks you got
  right.** Wrong picks are dropped (count as ×1.0), not zeroed.
- Leaderboard ranks by Oddscore (high → low). **Ties broken by earliest submission.**
- Players may be **anonymous**. Anyone can **view another player's picks** ("betslip")
  from the leaderboard.

**Worked example (from the source product):** picks won at odds 1.50, 2.00, 3.00 and
one pick lost (3.30). Oddscore = 1.50 × 2.00 × 3.00 = **9.00**. The lost leg is
dropped. (Total Odds 29.70 = all four multiplied; Oddscore 9.00 = winners only.)

> Rewards being **right AND bold** — a correct longshot scores more than a correct
> favorite.

---

## 3. The core principle (everything depends on it)

There is **ONE scoring/resolution rule**, run in two places, producing the **identical
ranking**:

```
Off-chain (server)  → live + provisional leaderboard. Fast, unverified.
On-chain (Phase 2)  → final settlement + payout. Slow, Merkle-proven.
```

To keep the two from drifting, scoring uses **integer fixed-point** (odds as integer
basis points), never floats. See §6.

---

## 4. Scope

### Phase 1 — Free contests, off-chain (BUILD NOW)
**In:** handle onboarding; create contest (pick matches, lock odds from feed);
browse/join contests (Upcoming/Live/Completed); submit an entry (one pick per match);
live leaderboard that updates from the scores feed; final Oddscore + ranking; view
any entry's picks; anonymous toggle; Replay Mode (§10); feed abstractions with Mock
implementations.

**Out (Phase 2, do not build):** any Solana program, wallet, escrow, USDC, prize
payout, `validate_stat` settlement, on-chain odds proofs.

### Phase 2 — On-chain settlement (LATER, for submission)
Devnet, **test USDC**: staked contests with an escrow pool PDA; per-match resolution
recorded on-chain via `validate_stat`; deterministic recompute of Oddscore ranking
from on-chain data; prize split to top ranks; a **Verifiable Resolution** receipt in
the UI. Wraps Phase 1 without changing the game logic.

### Markets
**Phase 1: `1X2` only.** It's the cleanest to resolve (goals comparison). Double
Chance / Over-Under / Asian Total are later extensions — design the market type as an
enum so they can be added, but do not build them now.

---

## 5. Architecture

Monorepo. The scoring/resolution rule is a shared package = single source of truth.

```
/packages/rules     Oddscore + match resolution + types + constants. SOURCE OF TRUTH.
                    Phase 1: TypeScript. Phase 2: add a Rust port that mirrors it.
/apps/server        Feed ingest (odds + scores), scoring, WebSocket push, REST, DB.
/apps/client        Responsive web app (mobile-first). Phase 1 deliverable.
/programs/contest   (Phase 2 only) Anchor program: escrow pool + settlement. Empty now.
```

### Stack (optimize for build speed)
- Client: Next.js (React + TS), Tailwind v4 (Playful tokens, §8). Mobile-first responsive.
- Server: Node + TS. WebSocket (`ws`/`socket.io`). REST for non-realtime.
- DB: Postgres (or SQLite for local dev) + Drizzle ORM.
- `/packages/rules`: zero framework deps; imported by client + server.

### Realtime model
Server subscribes to the scores feed **once**, holds current stats per fixture, and on
every change recomputes provisional results + Oddscores for affected live contests, and
pushes updated leaderboards to connected clients. **Clients never call TxLINE directly.**

### The Phase-1 / Phase-2 seam
Contest has `mode: 'free' | 'onchain'`. Phase 1 is always `'free'` and never touches
Solana. Phase 2 contests reuse the same create/predict/leaderboard/scoring and add:
escrow deposit on join, on-chain match results, prize-split payout.

---

## 6. The rules package (`/packages/rules`) — build FIRST

### 6.1 Types & constants
```ts
export type Outcome = '1' | 'X' | '2';
export type Market = '1X2';                  // enum-extensible later

export interface ContestMatch {
  fixtureId: string;
  market: Market;                            // '1X2' in v1
  oddsBp: Record<Outcome, number>;           // odds × 100, integer, locked at creation
  result?: Outcome;                          // set when the match resolves
}

export interface Pick { fixtureId: string; selection: Outcome; }
export interface Entry { userId: string; picks: Pick[]; submittedAt: number; }

export const ODDS_SCALE = 100;               // basis points: 1.50 -> 150
```

### 6.2 Resolution + scoring (pure functions)
```ts
/** Decide a 1X2 result from goals. */
export function resolveMatch(homeGoals: number, awayGoals: number): Outcome {
  if (homeGoals > awayGoals) return '1';
  if (homeGoals < awayGoals) return '2';
  return 'X';
}

/** Number of correct picks. */
export function winningCount(entry: Entry, matches: ContestMatch[]): number {
  let c = 0;
  for (const m of matches) {
    const pick = entry.picks.find(p => p.fixtureId === m.fixtureId);
    if (pick && m.result && pick.selection === m.result) c++;
  }
  return c;
}

/**
 * Integer ranking score. CONSTANT scale (ODDS_SCALE^M) across all entries in a
 * contest, so raw values compare directly. Won leg -> its oddsBp; lost/blank -> 100.
 * Use this for ordering (and for on-chain recompute in Phase 2).
 */
export function oddscoreRaw(entry: Entry, matches: ContestMatch[]): bigint {
  let raw = 1n;
  for (const m of matches) {
    const pick = entry.picks.find(p => p.fixtureId === m.fixtureId);
    const won = !!(pick && m.result && pick.selection === m.result);
    raw *= BigInt(won ? m.oddsBp[pick!.selection] : ODDS_SCALE);
  }
  return raw;
}

/** Human-facing Oddscore. 0.00 if no correct picks (matches source UI). */
export function oddscoreDisplay(entry: Entry, matches: ContestMatch[]): number {
  if (winningCount(entry, matches) === 0) return 0;
  let prod = 1;
  for (const m of matches) {
    const pick = entry.picks.find(p => p.fixtureId === m.fixtureId);
    if (pick && m.result && pick.selection === m.result) prod *= m.oddsBp[pick.selection] / ODDS_SCALE;
  }
  return Math.round(prod * 100) / 100;
}

/** Rank: oddscoreRaw desc, then earliest submittedAt. */
export function rankEntries(entries: Entry[], matches: ContestMatch[]): Entry[] {
  return [...entries].sort((a, b) => {
    const ra = oddscoreRaw(a, matches), rb = oddscoreRaw(b, matches);
    if (ra !== rb) return rb > ra ? 1 : -1;
    return a.submittedAt - b.submittedAt;
  });
}
```

### 6.3 Test vectors (write as unit tests before anything else)
A contest of 4 matches; odds 1.50/2.00/3.00/3.30 on the picked side.
```
Results: M1='1', M2='1', M3='X', M4='1'.  Entry picks: 1,1,X,X (M4 wrong).
  winningCount = 3
  oddscoreDisplay = 1.50*2.00*3.00 = 9.00      (M4 dropped)
  oddscoreRaw = 150*200*300*100 = 900,000,000  (scale 100^4)

Entry with all 4 correct  -> display = 1.50*2.00*3.00*3.30 = 29.70
Entry with 0 correct      -> display = 0.00, raw = 100^4 (floor, ranks last)
Tie on raw                -> earlier submittedAt ranks higher
```

### 6.4 Feed abstractions (so Phase 1 needs no credentials)
```ts
// Odds: snapshotted once at contest creation and locked.
export interface OddsSource {
  getOdds(fixtureIds: string[]): Promise<Record<string, Record<Outcome, number>>>;
}
// Scores: drives live leaderboard + final resolution.
export interface ScoreSource {
  subscribe(fixtureIds: string[], onUpdate: (u: ScoreUpdate) => void): () => void;
}
export interface ScoreUpdate { fixtureId: string; homeGoals: number; awayGoals: number; minute: number; status: 'live'|'ft'; }
```
- `MockOdds` / `MockScores` — for all Phase 1 dev. Compressible match length for fast,
  clip-friendly testing.
- `TxLineOdds` / `TxLineScores` — real feeds (§7). Wired last.
- `ReplayScores` — replays a stored score log through `ScoreSource` (§10).

---

## 7. TxLINE integration

> **Fetch the docs index FIRST and follow it to exact schemas:**
> `https://txline-docs.txodds.com/llms.txt`
> Quickstart: `https://txline.txodds.com/documentation/quickstart`
> World Cup free tier (subscribe): `https://txline.txodds.com/documentation/worldcup`

This product uses **two** TxLINE feeds:

- **Odds feed** — consensus 1X2 odds. Snapshot **once at contest creation** and store
  on each `contest_match` (`oddsBp`). This is the points source. (New dependency vs the
  earlier duel spec.)
- **Scores feed (SSE)** — live goals, drives the live leaderboard and final resolution.
  This is the core realtime integration.
- **Auth:** guest session start → token activation. Subscribe on-chain (Solana) and use
  **Service Level 12 (real-time, free)**; not SL1 (60s delayed). All calls send
  `Authorization: Bearer <apiToken>`.

### Phase 2 only (do not build now)
- Per-match **`validate_stat`** resolution: prove the 1X2 result from goals —
  `1` ⇒ (homeGoals − awayGoals) > 0; `2` ⇒ < 0; `X` ⇒ == 0 (two-stat subtract +
  threshold). One proof per match resolves it for all players.
- Optional: prove the **locked odds** were authentic via the odds feed's Merkle proofs.
- Program addresses / IDL; verify against `github.com/txodds/tx-on-chain`.

### Confirm in TxLINE Telegram (don't block Phase 1)
1. Free-tier freshness: SL12 truly real-time vs ~60s sampled?
2. Odds feed: snapshot endpoint + are odds Merkle-proven?
3. `validate_stat` confirmed CPI-able with return data (not just `.view()`)?

---

## 8. Design system — "Playful" (light, warm, editorial)

**Your own UI. NOT Punter Clash's navy/orange. NOT dark. NOT violet.**

### Tailwind v4 `@theme`
```css
@theme {
  --color-oat-canvas: #f6f2ee;   /* page background everywhere (never pure white) */
  --color-paper-white: #ffffff;  /* card surfaces */
  --color-hot-magenta: #ff2e95;  /* ONLY: primary CTA, links, logo, live pulse */
  --color-ink: #111111;          /* headings + body */
  --color-slate: #0f172a;        /* secondary text */
  --color-stone: #848383;        /* icon strokes, muted helpers */
  --color-warm-mist: #e8e5e0;    /* hairline borders */
  --font-display: 'Inter', system-ui, sans-serif;  /* 700/900 ITALIC at scale */
  --font-body: 'Inter', system-ui, sans-serif;
  --radius-card: 44px;
  --radius-pill: 99px;
  --shadow-card: 0 32px 80px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.08);
}
```
Rules: Oat Canvas background; Paper White cards (44px radius, card shadow, never white
on white); Hot Magenta only for primary CTA/links/logo/live pulse (never large fills,
no other accents); display headlines + big Oddscore numbers in Inter 700/900 italic,
large, line-height ~1.0; pill buttons (99px); thin Stone line icons; shadows on cards
only; live elements pulse magenta (no glow).

---

## 9. Screens (Phase 1)

1. **Onboarding** — pick a handle → anonymous user. No login.
2. **Lobby / Home** — tabs **Upcoming / Live / Completed**; contest cards (name, prize
   pool, fill bar + "X joined", match count, **Join for Free**). "Create Contest" pill.
3. **Create Contest** — name it; pick matches from the current round (odds auto-pulled
   from the odds feed and **locked**); free entry (Phase 1); set max entries; create →
   shareable link.
4. **Contest Detail / Predict** — match list with 1X2 odds buttons (odds shown, "can be
   read as points"); tap a selection per match; **Lock in Picks**.
5. **My Picks (locked)** — your selections + each odds + Total Odds; **Leaderboard** button.
6. **Leaderboard (live)** — Rank · Username (or *anonymous*) · Oddscore; **View Betslip**
   opens any entry's picks; updates in real time as matches play. Pre-start shows 0.00.
7. **Result** — final leaderboard + your rank; (Phase 2) payout + **Verifiable
   Resolution** receipt (the on-chain proof).
8. **Replay** — "Replay a past contest" runs a finished match set through `ReplayScores`.

Micro-animations: smooth Oddscore count changes, rank movement, magenta live pulse.
Warm/editorial, not a glassy sportsbook.

---

## 10. Replay Mode (demo insurance — build in Phase 1)

Judging is **July 20–29 with no live matches**, so you must replay finished matches as
live. Persist every `ScoreUpdate` to a log; `ReplayScores` re-emits it through the same
interface at real or accelerated speed; the live leaderboard can't tell the difference.
**Capture real match score logs before July 19, 23:59 UTC** (free data access ends then).

---

## 11. Data model

```
users
  id, handle, created_at

contests
  id, name, creator_id, mode ('free'|'onchain'),     -- Phase 1 always 'free'
  status ('upcoming'|'live'|'resolved'|'cancelled'),
  starts_at, prize_pool, max_entries, created_at

contest_matches
  id, contest_id, fixture_id, market ('1X2'),
  odds_1_bp, odds_x_bp, odds_2_bp,                    -- locked at creation (int x100)
  result ('1'|'X'|'2' | null)

fixtures                       (cached from TxLINE; mock rows to start)
  id, round, home_team, away_team, kickoff, status,
  home_goals, away_goals

entries
  id, contest_id, user_id, submitted_at, anonymous (bool),
  oddscore_raw (cached bigint), winning_count (cached), final_rank (nullable)

picks
  id, entry_id, contest_match_id, selection ('1'|'X'|'2')

score_log                      (live feed + replay source)
  id, fixture_id, home_goals, away_goals, minute, status, created_at
```

---

## 12. Phase 1 build order

```
1.  /packages/rules: resolveMatch + oddscore* + rankEntries + tests (§6.3). FIRST.
2.  DB schema + migrations (§11).
3.  Onboarding: handle → user.
4.  Fixtures + current round (MOCK rows). MockOdds returns locked odds.
5.  Create Contest: select matches, lock odds, persist contest + contest_matches.
6.  Lobby: list contests (Upcoming/Live/Completed) + Join.
7.  Predict: one pick per match → submit entry (+ anonymous toggle).
8.  MockScores → resolveMatch (provisional from live goals) → oddscore → rank.
9.  WebSocket: push live leaderboard to viewers of a contest.
10. Result screen + View Betslip (view any entry's picks).
11. Replay (ReplayScores) + "Replay a past contest".
12. Swap Mock* → TxLine* (odds snapshot + scores SSE, SL12); test on a live match.
```
Steps 1–11 need **no TxLINE credentials**. Only step 12 needs auth + subscription.

---

## 13. Phase 2 preview (context only — do not build now)

Anchor program, **devnet, test USDC**:
- Accounts: `Contest` (matches, locked odds, status, pool, fee), `EscrowPool` (test-USDC
  vault PDA), `Entry` (player picks committed on-chain), `Config` (fee, payout split).
- Instructions: `create_contest`, `join_contest` (deposit test USDC), `resolve_match`
  (CPI `validate_stat` → record the 1X2 result on-chain; one call per match),
  `settle_contest` (recompute `oddscoreRaw` from on-chain picks + odds + results, rank,
  split pool to top ranks, pay out), `cancel_contest` (refund).
- Rust port of the rules package matching the TS test vectors exactly (integer math).
- Prize split: configurable (e.g., top 3 = 50/30/20 of pool − fee); ties → earlier
  submission ranks higher (already in `rankEntries`).
- **Verifiable Resolution receipt** in the UI: the on-chain proof each match result is
  authentic — the verification layer Track 1 highly values.

---

## 14. Non-negotiables checklist

- [ ] Original product + UI. Do not clone Punter Clash's name, branding, or layout.
- [ ] One scoring rule (integer fixed-point); live and on-chain rankings agree exactly.
- [ ] 1X2 market only in v1 (enum-extensible).
- [ ] Odds locked at contest creation from the odds feed; identical for all players.
- [ ] Both feeds behind interfaces (Mock / TxLine / Replay).
- [ ] Replay Mode works with no live matches; capture logs before July 19 23:59 UTC.
- [ ] Playful design (light/cream/magenta), not dark/navy/violet.
- [ ] No real money. Phase 1 free; Phase 2 devnet test USDC only.
- [ ] Service Level 12 (real-time), not SL1.
- [ ] Demo recorded during Round of 32 / Round of 16, not the final.
- [ ] Per-match `validate_stat` resolution is the Track 1 differentiator (Phase 2).
```
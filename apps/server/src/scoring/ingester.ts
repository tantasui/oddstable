import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  fixtures,
  contests,
  contestMatches,
  entries,
  picks,
  scoreLog,
} from '../db/schema.js';
import type { ScoreSource, ScoreUpdate } from '@oddstable/rules';
import {
  resolveMatch,
  oddscoreRaw,
  oddscoreDisplay,
  winningCount,
  rankEntries,
  type ContestMatch,
  type Entry,
  type Outcome,
} from '@oddstable/rules';
import { scoringEvents } from './events.js';
import { computeLeaderboard } from './leaderboard.js';
import { ReplayScores } from '../feeds/replay-scores.js';

// Recompute scores + ranks for every entry in a contest after a result changes.
async function recomputeContest(contestId: string) {
  const cmRows = await db
    .select()
    .from(contestMatches)
    .where(eq(contestMatches.contestId, contestId));

  const rulesMatches: ContestMatch[] = cmRows.map((cm) => ({
    fixtureId: cm.fixtureId,
    market: '1X2' as const,
    oddsBp: { '1': cm.odds1Bp, 'X': cm.oddsXBp, '2': cm.odds2Bp },
    result: (cm.result ?? undefined) as Outcome | undefined,
  }));

  const entryRows = await db
    .select()
    .from(entries)
    .where(eq(entries.contestId, contestId));

  if (entryRows.length === 0) return;

  const entryIds = entryRows.map((e) => e.id);
  const pickRows = await db
    .select({ p: picks, cm: contestMatches })
    .from(picks)
    .innerJoin(contestMatches, eq(picks.contestMatchId, contestMatches.id))
    .where(inArray(picks.entryId, entryIds));

  // Group picks by entryId
  const picksByEntry = new Map<string, typeof pickRows>();
  for (const row of pickRows) {
    const arr = picksByEntry.get(row.p.entryId) ?? [];
    arr.push(row);
    picksByEntry.set(row.p.entryId, arr);
  }

  // Build Entry objects and compute scores
  const rulesEntries: Entry[] = [];
  const entryIdByUserId = new Map<string, string>();

  for (const e of entryRows) {
    const entryPicks = picksByEntry.get(e.id) ?? [];
    const rulesEntry: Entry = {
      userId: e.userId,
      picks: entryPicks.map(({ p, cm }) => ({
        fixtureId: cm.fixtureId,
        selection: p.selection as Outcome,
      })),
      submittedAt: (e.submittedAt as unknown as Date).getTime(),
    };
    rulesEntries.push(rulesEntry);
    entryIdByUserId.set(e.userId, e.id);
  }

  // Rank all entries
  const ranked = rankEntries(rulesEntries, rulesMatches);

  // Batch-update each entry
  for (let rank = 0; rank < ranked.length; rank++) {
    const re = ranked[rank]!;
    const entryId = entryIdByUserId.get(re.userId)!;
    const raw = oddscoreRaw(re, rulesMatches);
    const wCount = winningCount(re, rulesMatches);

    await db
      .update(entries)
      .set({
        oddscoreRaw: raw.toString(),
        winningCount: wCount,
        finalRank: rank + 1,
      })
      .where(eq(entries.id, entryId));
  }

  // If all matches have results, mark contest resolved
  const allResolved = rulesMatches.every((m) => m.result !== undefined);
  if (allResolved) {
    await db
      .update(contests)
      .set({ status: 'resolved' })
      .where(eq(contests.id, contestId));
  }

  // Push updated leaderboard to any connected WebSocket clients
  const lb = await computeLeaderboard(contestId);
  scoringEvents.emit('leaderboard', contestId, lb);
}

async function processUpdate(update: ScoreUpdate, persist = true) {
  const { fixtureId, homeGoals, awayGoals, minute, status } = update;

  // 1. Persist to score_log (skipped during replay to avoid duplicates)
  if (persist) {
    await db.insert(scoreLog).values({
      id: crypto.randomUUID(),
      fixtureId,
      homeGoals,
      awayGoals,
      minute,
      status,
      createdAt: new Date(),
    });
  }

  // 2. Update fixture row
  await db
    .update(fixtures)
    .set({
      homeGoals,
      awayGoals,
      status: status === 'ft' ? 'ft' : 'live',
    })
    .where(eq(fixtures.id, fixtureId));

  // 3. Resolve match result
  const result = resolveMatch(homeGoals, awayGoals);

  // 4. Update contest_matches for this fixture + mark contests live
  const affectedCMs = await db
    .select({ id: contestMatches.id, contestId: contestMatches.contestId })
    .from(contestMatches)
    .where(eq(contestMatches.fixtureId, fixtureId));

  if (affectedCMs.length === 0) return;

  const cmIds = affectedCMs.map((cm) => cm.id);
  await db
    .update(contestMatches)
    .set({ result })
    .where(inArray(contestMatches.id, cmIds));

  // Mark parent contests as live (if not already resolved)
  const contestIds = [...new Set(affectedCMs.map((cm) => cm.contestId))];
  await db
    .update(contests)
    .set({ status: 'live' })
    .where(
      and(
        inArray(contests.id, contestIds),
        eq(contests.status, 'upcoming'),
      ),
    );

  // 5. Recompute scores for each affected contest
  for (const contestId of contestIds) {
    await recomputeContest(contestId);
  }
}

let unsubscribe: (() => void) | null = null;

export async function startIngester(scoreSource: ScoreSource) {
  if (unsubscribe) unsubscribe(); // stop any prior subscription

  const fixtureRows = await db
    .select({ id: fixtures.id })
    .from(fixtures)
    .where(eq(fixtures.status, 'upcoming'));

  const fixtureIds = fixtureRows.map((f) => f.id);
  if (fixtureIds.length === 0) {
    console.log('[ingester] no upcoming fixtures to subscribe to');
    return;
  }

  console.log(`[ingester] subscribing to ${fixtureIds.length} fixtures`);
  unsubscribe = scoreSource.subscribe(fixtureIds, (update) => {
    processUpdate(update).catch((err) =>
      console.error('[ingester] error processing update:', err),
    );
  });
}

export function stopIngester() {
  unsubscribe?.();
  unsubscribe = null;
}

// Replay: re-fires historical score_log events for a resolved contest's fixtures.
// Does NOT re-insert to score_log (persist=false) to avoid duplicating history.
let replayUnsubscribe: (() => void) | null = null;

export async function startReplay(contestId: string, gapMs = 500) {
  if (replayUnsubscribe) replayUnsubscribe();

  const cmRows = await db
    .select({ fixtureId: contestMatches.fixtureId })
    .from(contestMatches)
    .where(eq(contestMatches.contestId, contestId));

  const fixtureIds = cmRows.map((cm) => cm.fixtureId);
  if (fixtureIds.length === 0) {
    console.log('[replay] no fixtures found for contest', contestId);
    return;
  }

  console.log(`[replay] contest ${contestId} — ${fixtureIds.length} fixtures @ ${gapMs}ms gap`);
  const replaySource = new ReplayScores(gapMs);
  replayUnsubscribe = replaySource.subscribe(fixtureIds, (update) => {
    processUpdate(update, false).catch((err) =>
      console.error('[replay] error processing update:', err),
    );
  });
}

export function stopReplay() {
  replayUnsubscribe?.();
  replayUnsubscribe = null;
}

// Re-export so the leaderboard route can use it without reimporting rules
export { oddscoreDisplay, type ContestMatch, type Entry, type Outcome };

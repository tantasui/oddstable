import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { contestMatches, users, entries, picks } from '../db/schema.js';
import {
  oddscoreDisplay,
  oddscoreRaw,
  winningCount,
  rankEntries,
  type ContestMatch,
  type Entry,
  type Outcome,
} from '@oddstable/rules';

export type LeaderboardRow = {
  rank: number;
  userId: string;
  handle: string | null;
  anonymous: boolean;
  oddscoreDisplay: number;
  oddscoreRaw: string;
  winningCount: number;
  totalMatches: number;
};

export async function computeLeaderboard(contestId: string): Promise<LeaderboardRow[]> {
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
    .select({ e: entries, handle: users.handle })
    .from(entries)
    .innerJoin(users, eq(entries.userId, users.id))
    .where(eq(entries.contestId, contestId));

  if (entryRows.length === 0) return [];

  const entryIds = entryRows.map((r) => r.e.id);
  const pickRows = await db
    .select({ p: picks, cm: contestMatches })
    .from(picks)
    .innerJoin(contestMatches, eq(picks.contestMatchId, contestMatches.id))
    .where(inArray(picks.entryId, entryIds));

  const picksByEntry = new Map<string, typeof pickRows>();
  for (const row of pickRows) {
    const arr = picksByEntry.get(row.p.entryId) ?? [];
    arr.push(row);
    picksByEntry.set(row.p.entryId, arr);
  }

  const rulesEntries: Entry[] = entryRows.map(({ e }) => ({
    userId: e.userId,
    picks: (picksByEntry.get(e.id) ?? []).map(({ p, cm }) => ({
      fixtureId: cm.fixtureId,
      selection: p.selection as Outcome,
    })),
    submittedAt: (e.submittedAt as unknown as Date).getTime(),
  }));

  const ranked = rankEntries(rulesEntries, rulesMatches);
  const handleByUserId = Object.fromEntries(entryRows.map(({ e, handle }) => [e.userId, handle]));
  const anonByUserId = Object.fromEntries(entryRows.map(({ e }) => [e.userId, e.anonymous]));

  return ranked.map((re, i) => {
    const display = oddscoreDisplay(re, rulesMatches);
    const raw = oddscoreRaw(re, rulesMatches);
    const wCount = winningCount(re, rulesMatches);
    const anon = anonByUserId[re.userId];
    return {
      rank: i + 1,
      userId: re.userId,
      handle: anon ? null : (handleByUserId[re.userId] ?? null),
      anonymous: !!anon,
      oddscoreDisplay: display,
      oddscoreRaw: raw.toString(),
      winningCount: wCount,
      totalMatches: rulesMatches.length,
    };
  });
}

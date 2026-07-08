import { Hono } from 'hono';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { contests, contestMatches, fixtures, users, entries, picks } from '../db/schema.js';
import { oddsSource } from '../feeds/index.js';
import {
  oddscoreRaw,
  winningCount,
  rankEntries,
  type ContestMatch,
  type Entry,
  type Outcome,
} from '@oddstable/rules';
import { computeLeaderboard } from '../scoring/leaderboard.js';

export const contestsRouter = new Hono();

// POST /api/contests — create contest + lock odds into contest_matches
contestsRouter.post('/', async (c) => {
  const body = await c.req.json<{
    name?: unknown;
    creatorId?: unknown;
    fixtureIds?: unknown;
    maxEntries?: unknown;
  }>();

  const name =
    typeof body.name === 'string' ? body.name.trim() : '';
  const creatorId =
    typeof body.creatorId === 'string' ? body.creatorId : '';
  const fixtureIds: string[] = Array.isArray(body.fixtureIds)
    ? body.fixtureIds.filter((x): x is string => typeof x === 'string')
    : [];
  const maxEntries =
    typeof body.maxEntries === 'number' ? Math.floor(body.maxEntries) : 0;

  if (name.length < 3 || name.length > 100)
    return c.json({ error: 'Name must be 3–100 chars' }, 400);
  if (!creatorId)
    return c.json({ error: 'creatorId required' }, 400);
  if (fixtureIds.length === 0 || fixtureIds.length > 10)
    return c.json({ error: 'Select 1–10 fixtures' }, 400);
  if (maxEntries < 2 || maxEntries > 1000)
    return c.json({ error: 'maxEntries must be 2–1000' }, 400);

  const [creator] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, creatorId))
    .limit(1);
  if (!creator) return c.json({ error: 'User not found' }, 404);

  const fixtureRows = await db
    .select()
    .from(fixtures)
    .where(inArray(fixtures.id, fixtureIds));

  if (fixtureRows.length !== fixtureIds.length)
    return c.json({ error: 'One or more fixtures not found' }, 400);
  if (fixtureRows.some((f) => f.status !== 'upcoming'))
    return c.json({ error: 'All fixtures must be upcoming' }, 400);

  // Lock odds from the configured OddsSource (MockOdds in Phase 1).
  const oddsMap = await oddsSource.getOdds(fixtureIds);

  const startsAt = new Date(
    Math.min(...fixtureRows.map((f) => (f.kickoff as Date).getTime())),
  );

  const contestId = crypto.randomUUID();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(contests).values({
      id: contestId,
      name,
      creatorId,
      mode: 'free',
      status: 'upcoming',
      startsAt,
      prizePool: 0,
      maxEntries,
      createdAt: now,
    });

    for (const fixId of fixtureIds) {
      const odds = oddsMap[fixId];
      if (!odds) {
        console.warn(`[contests] no odds for fixture ${fixId} — skipping match`);
        continue;
      }
      await tx.insert(contestMatches).values({
        id: crypto.randomUUID(),
        contestId,
        fixtureId: fixId,
        market: '1X2',
        odds1Bp: odds['1'],
        oddsXBp: odds['X'],
        odds2Bp: odds['2'],
        result: null,
      });
    }
  });

  // Verify at least one match got odds — otherwise the contest is unusable
  const matchCount = await db
    .select({ n: sql<number>`count(*)` })
    .from(contestMatches)
    .where(eq(contestMatches.contestId, contestId));
  if ((matchCount[0]?.n ?? 0) === 0) {
    await db.delete(contests).where(eq(contests.id, contestId));
    return c.json(
      { error: 'No odds available for the selected fixtures right now — try again later or pick different fixtures' },
      422,
    );
  }

  return c.json({ id: contestId }, 201);
});

// GET /api/contests/:id — contest detail with matches + fixture info
contestsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  const [contest] = await db
    .select()
    .from(contests)
    .where(eq(contests.id, id))
    .limit(1);

  if (!contest) return c.json({ error: 'Not found' }, 404);

  const matchRows = await db
    .select({ cm: contestMatches, fx: fixtures })
    .from(contestMatches)
    .innerJoin(fixtures, eq(contestMatches.fixtureId, fixtures.id))
    .where(eq(contestMatches.contestId, id))
    .orderBy(fixtures.kickoff);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(entries)
    .where(eq(entries.contestId, id));

  return c.json({
    id: contest.id,
    name: contest.name,
    mode: contest.mode,
    status: contest.status,
    startsAt: contest.startsAt,
    maxEntries: contest.maxEntries,
    entryCount: count,
    creatorId: contest.creatorId,
    matches: matchRows.map(({ cm, fx }) => ({
      id: cm.id,
      fixtureId: cm.fixtureId,
      market: cm.market,
      oddsBp: { '1': cm.odds1Bp, 'X': cm.oddsXBp, '2': cm.odds2Bp },
      result: cm.result,
      fixture: {
        homeTeam: fx.homeTeam,
        awayTeam: fx.awayTeam,
        kickoff: fx.kickoff,
        status: fx.status,
        homeGoals: fx.homeGoals,
        awayGoals: fx.awayGoals,
      },
    })),
  });
});

// GET /api/contests — list (used by lobby in Step 6)
contestsRouter.get('/', async (c) => {
  const status = c.req.query('status');

  const rows = await db
    .select({
      id: contests.id,
      name: contests.name,
      status: contests.status,
      startsAt: contests.startsAt,
      maxEntries: contests.maxEntries,
      createdAt: contests.createdAt,
    })
    .from(contests)
    .where(status ? eq(contests.status, status as 'upcoming') : undefined)
    .orderBy(contests.startsAt);

  const contestIds = rows.map((r) => r.id);

  // Entry counts per contest
  const entryCounts = contestIds.length
    ? await db
        .select({ contestId: entries.contestId, count: sql<number>`count(*)` })
        .from(entries)
        .where(inArray(entries.contestId, contestIds))
        .groupBy(entries.contestId)
    : [];

  // Match counts per contest
  const matchCounts = contestIds.length
    ? await db
        .select({ contestId: contestMatches.contestId, count: sql<number>`count(*)` })
        .from(contestMatches)
        .where(inArray(contestMatches.contestId, contestIds))
        .groupBy(contestMatches.contestId)
    : [];

  const entryMap = Object.fromEntries(entryCounts.map((r) => [r.contestId, r.count]));
  const matchMap = Object.fromEntries(matchCounts.map((r) => [r.contestId, r.count]));

  return c.json(
    rows.map((r) => ({
      ...r,
      entryCount: entryMap[r.id] ?? 0,
      matchCount: matchMap[r.id] ?? 0,
    })),
  );
});

// POST /api/contests/:contestId/entries — submit picks + create entry
contestsRouter.post('/:contestId/entries', async (c) => {
  const contestId = c.req.param('contestId');
  const body = await c.req.json<{
    userId?: unknown;
    picks?: unknown;
    anonymous?: unknown;
  }>();

  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const rawPicks: Array<{ contestMatchId: string; selection: string }> = Array.isArray(body.picks)
    ? body.picks.filter(
        (p): p is { contestMatchId: string; selection: string } =>
          typeof p === 'object' &&
          p !== null &&
          typeof (p as Record<string, unknown>).contestMatchId === 'string' &&
          typeof (p as Record<string, unknown>).selection === 'string',
      )
    : [];
  const anonymous = body.anonymous === true;

  if (!userId) return c.json({ error: 'userId required' }, 400);
  if (rawPicks.length === 0) return c.json({ error: 'picks required' }, 400);

  const [contest] = await db
    .select()
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);
  if (!contest) return c.json({ error: 'Contest not found' }, 404);
  if (contest.status !== 'upcoming' && contest.status !== 'live')
    return c.json({ error: 'Contest is not open for entries' }, 409);

  const [{ count: entryCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(entries)
    .where(eq(entries.contestId, contestId));
  if (entryCount >= contest.maxEntries)
    return c.json({ error: 'Contest is full' }, 409);

  const [existing] = await db
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.contestId, contestId), eq(entries.userId, userId)))
    .limit(1);
  if (existing) return c.json({ error: 'Already entered this contest' }, 409);

  const cmRows = await db
    .select()
    .from(contestMatches)
    .where(eq(contestMatches.contestId, contestId));

  const cmIdSet = new Set(cmRows.map((cm) => cm.id));
  const pickedIdSet = new Set(rawPicks.map((p) => p.contestMatchId));
  if (
    cmIdSet.size !== pickedIdSet.size ||
    [...cmIdSet].some((id) => !pickedIdSet.has(id))
  )
    return c.json({ error: 'Must pick exactly one outcome for every match' }, 400);

  const validSelections = new Set(['1', 'X', '2']);
  if (rawPicks.some((p) => !validSelections.has(p.selection)))
    return c.json({ error: "Selection must be '1', 'X', or '2'" }, 400);

  // Build rules types to compute initial oddscoreRaw + winningCount
  const cmById = Object.fromEntries(cmRows.map((cm) => [cm.id, cm]));
  const rulesMatches: ContestMatch[] = cmRows.map((cm) => ({
    fixtureId: cm.fixtureId,
    market: '1X2' as const,
    oddsBp: { '1': cm.odds1Bp, 'X': cm.oddsXBp, '2': cm.odds2Bp },
    result: (cm.result ?? undefined) as Outcome | undefined,
  }));
  const submittedAtMs = Date.now();
  const rulesEntry: Entry = {
    userId,
    picks: rawPicks.map((p) => ({
      fixtureId: cmById[p.contestMatchId]!.fixtureId,
      selection: p.selection as Outcome,
    })),
    submittedAt: submittedAtMs,
  };

  const rawScore = oddscoreRaw(rulesEntry, rulesMatches);
  const wCount = winningCount(rulesEntry, rulesMatches);

  const entryId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(entries).values({
      id: entryId,
      contestId,
      userId,
      submittedAt: new Date(submittedAtMs),
      anonymous,
      oddscoreRaw: rawScore.toString(),
      winningCount: wCount,
      finalRank: null,
    });
    for (const p of rawPicks) {
      await tx.insert(picks).values({
        id: crypto.randomUUID(),
        entryId,
        contestMatchId: p.contestMatchId,
        selection: p.selection as '1' | 'X' | '2',
      });
    }
  });

  return c.json({ id: entryId }, 201);
});

// GET /api/contests/:contestId/my-entry?userId= — the current user's entry + picks
contestsRouter.get('/:contestId/my-entry', async (c) => {
  const contestId = c.req.param('contestId');
  const userId = c.req.query('userId');
  if (!userId) return c.json({ error: 'userId query param required' }, 400);

  const [entry] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.contestId, contestId), eq(entries.userId, userId)))
    .limit(1);
  if (!entry) return c.json({ error: 'Not found' }, 404);

  const pickRows = await db
    .select({ p: picks, cm: contestMatches, fx: fixtures })
    .from(picks)
    .innerJoin(contestMatches, eq(picks.contestMatchId, contestMatches.id))
    .innerJoin(fixtures, eq(contestMatches.fixtureId, fixtures.id))
    .where(eq(picks.entryId, entry.id))
    .orderBy(fixtures.kickoff);

  return c.json({
    id: entry.id,
    contestId: entry.contestId,
    submittedAt: entry.submittedAt,
    anonymous: entry.anonymous,
    oddscoreRaw: entry.oddscoreRaw,
    winningCount: entry.winningCount,
    finalRank: entry.finalRank,
    picks: pickRows.map(({ p, cm, fx }) => ({
      id: p.id,
      contestMatchId: cm.id,
      selection: p.selection,
      oddsBp: { '1': cm.odds1Bp, 'X': cm.oddsXBp, '2': cm.odds2Bp },
      result: cm.result,
      fixture: {
        homeTeam: fx.homeTeam,
        awayTeam: fx.awayTeam,
        kickoff: fx.kickoff,
        status: fx.status,
      },
    })),
  });
});

// GET /api/contests/:contestId/leaderboard — ranked entries with oddscores
contestsRouter.get('/:contestId/leaderboard', async (c) => {
  const contestId = c.req.param('contestId');

  const [contest] = await db
    .select({ id: contests.id })
    .from(contests)
    .where(eq(contests.id, contestId))
    .limit(1);
  if (!contest) return c.json({ error: 'Not found' }, 404);

  return c.json(await computeLeaderboard(contestId));
});

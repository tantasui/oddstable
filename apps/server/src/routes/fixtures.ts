import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { fixtures } from '../db/schema.js';
import { oddsSource } from '../feeds/index.js';

export const fixturesRouter = new Hono();

// GET /api/fixtures?status=upcoming  (default: upcoming)
// Returns fixtures with locked-at-call odds from the configured OddsSource.
fixturesRouter.get('/', async (c) => {
  const status = (c.req.query('status') ?? 'upcoming') as
    | 'upcoming'
    | 'live'
    | 'ft';

  const rows = await db
    .select()
    .from(fixtures)
    .where(eq(fixtures.status, status))
    .orderBy(fixtures.kickoff);

  const ids = rows.map((r) => r.id);
  const odds = ids.length > 0 ? await oddsSource.getOdds(ids) : {};

  const result = rows.map((r) => ({
    id: r.id,
    round: r.round,
    homeTeam: r.homeTeam,
    awayTeam: r.awayTeam,
    kickoff: r.kickoff,
    status: r.status,
    homeGoals: r.homeGoals,
    awayGoals: r.awayGoals,
    odds: odds[r.id] ?? null,
  }));

  return c.json(result);
});

// GET /api/fixtures/:id
fixturesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [row] = await db
    .select()
    .from(fixtures)
    .where(eq(fixtures.id, id))
    .limit(1);

  if (!row) return c.json({ error: 'Not found' }, 404);

  const odds = await oddsSource.getOdds([id]);

  return c.json({ ...row, odds: odds[id] ?? null });
});

import { Hono } from 'hono';
import { upgradeWebSocket, websocket } from 'hono/bun';
import { usersRouter } from './routes/users.js';
import { fixturesRouter } from './routes/fixtures.js';
import { contestsRouter } from './routes/contests.js';
import { scoreSource } from './feeds/index.js';
import { startIngester, stopIngester, startReplay, stopReplay } from './scoring/ingester.js';
import { syncFixtures } from './feeds/txline-fixtures.js';
import { scoringEvents, type LeaderboardRow } from './scoring/events.js';
import { computeLeaderboard } from './scoring/leaderboard.js';

const app = new Hono();

app.route('/api/users', usersRouter);
app.route('/api/fixtures', fixturesRouter);
app.route('/api/contests', contestsRouter);

app.get('/health', (c) => c.json({ ok: true }));

// WebSocket: ws://localhost:PORT/ws/contests/:contestId/leaderboard
// Sends { type: 'leaderboard', data: LeaderboardRow[] } on connect + every ingester update.
app.get(
  '/ws/contests/:contestId/leaderboard',
  upgradeWebSocket((c) => {
    const contestId = c.req.param('contestId') ?? '';
    let listener: ((cid: string, rows: LeaderboardRow[]) => void) | null = null;

    return {
      onOpen(_evt, ws) {
        // Send current leaderboard immediately
        computeLeaderboard(contestId)
          .then((lb) => ws.send(JSON.stringify({ type: 'leaderboard', data: lb })))
          .catch(console.error);

        // Subscribe to future updates pushed by the ingester
        listener = (cid, rows) => {
          if (cid !== contestId) return;
          ws.send(JSON.stringify({ type: 'leaderboard', data: rows }));
        };
        scoringEvents.on('leaderboard', listener);
      },
      onClose() {
        if (listener) scoringEvents.off('leaderboard', listener);
      },
    };
  }),
);

// Dev-only: trigger MockScores simulation for upcoming fixtures.
// POST /api/dev/simulate   → (re)starts ingester + MockScores
// POST /api/dev/stop       → stops ingester
app.post('/api/dev/simulate', async (c) => {
  await startIngester(scoreSource);
  return c.json({ ok: true, message: 'MockScores simulation started' });
});

app.post('/api/dev/stop', (c) => {
  stopIngester();
  return c.json({ ok: true, message: 'Ingester stopped' });
});

// POST /api/dev/replay/:contestId?gap=500
// Replays a resolved contest's score_log at gapMs between events.
// Opens the leaderboard WebSocket to watch it update in real time.
app.post('/api/dev/replay/:contestId', async (c) => {
  const contestId = c.req.param('contestId') ?? '';
  const gapMs = Number(c.req.query('gap') ?? 500);
  await startReplay(contestId, gapMs);
  return c.json({ ok: true, contestId, gapMs });
});

app.post('/api/dev/replay-stop', (c) => {
  stopReplay();
  return c.json({ ok: true });
});

// POST /api/dev/sync-fixtures?competition={id}
// Fetches the TxLINE fixture snapshot and upserts into our DB.
// Fixtures are stored with IDs like 'txl-{FixtureId}' for feed routing.
// Optional ?competition=N to filter by TxLINE competition ID.
app.post('/api/dev/sync-fixtures', async (c) => {
  if (!process.env.TXLINE_API_TOKEN) {
    return c.json({ error: 'TXLINE_API_TOKEN not set' }, 400);
  }
  const competitionId = c.req.query('competition')
    ? Number(c.req.query('competition'))
    : undefined;
  const upserted = await syncFixtures(competitionId);
  return c.json({ ok: true, upserted });
});

const PORT = Number(process.env.PORT ?? 3001);
console.log(`Server running on http://localhost:${PORT}`);

export default { port: PORT, fetch: app.fetch, websocket };

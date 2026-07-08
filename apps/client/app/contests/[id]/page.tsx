import { notFound } from 'next/navigation';
import { triggerReplay } from './actions';

const SERVER = process.env.SERVER_URL ?? 'http://localhost:3001';

type ContestDetail = {
  id: string;
  name: string;
  status: string;
  startsAt: string;
  maxEntries: number;
  entryCount: number;
  matches: Array<{
    id: string;
    fixtureId: string;
    market: string;
    oddsBp: { '1': number; 'X': number; '2': number };
    result: string | null;
    fixture: {
      homeTeam: string;
      awayTeam: string;
      kickoff: string;
      status: string;
    };
  }>;
};

type LeaderboardRow = {
  rank: number;
  userId: string;
  handle: string | null;
  anonymous: boolean;
  oddscoreDisplay: number;
  winningCount: number;
  totalMatches: number;
};

function bp(value: number) {
  return (value / 100).toFixed(2);
}

export default async function ContestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await fetch(`${SERVER}/api/contests/${id}`, { cache: 'no-store' });
  if (!res.ok) notFound();

  const contest = await res.json() as ContestDetail;
  const isResolved = contest.status === 'resolved';
  const isLive = contest.status === 'live';

  // Fetch winner only when resolved
  let winner: LeaderboardRow | null = null;
  if (isResolved) {
    const lbRes = await fetch(`${SERVER}/api/contests/${id}/leaderboard`, { cache: 'no-store' });
    if (lbRes.ok) {
      const rows = await lbRes.json() as LeaderboardRow[];
      winner = rows[0] ?? null;
    }
  }

  const spotsLeft = contest.maxEntries - contest.entryCount;

  return (
    <main className="min-h-screen bg-mist-gray">
      {/* Top bar */}
      <div className="bg-soft-white border-b border-smoke">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="text-xs font-semibold uppercase tracking-widest text-midnight-ink">
            ← OddsPool
          </a>
          {isLive && (
            <span
              className="flex items-center gap-1.5 text-xs font-semibold text-midnight-ink bg-signal-yellow px-3 py-1"
              style={{ borderRadius: 4 }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-midnight-ink animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Winner banner — only when resolved */}
        {isResolved && (
          <div className="bg-signal-yellow p-6 mb-6" style={{ borderRadius: 8 }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-midnight-ink mb-3">
              Final Result
            </p>
            {winner ? (
              <>
                <p
                  className="text-3xl font-bold text-midnight-ink leading-tight"
                  style={{ fontFamily: 'var(--font-platform)' }}
                >
                  🥇 {winner.handle ?? 'Anonymous'}
                </p>
                <p className="text-sm text-midnight-ink mt-1">
                  Oddscore {winner.oddscoreDisplay.toFixed(2)} · {winner.winningCount}/{winner.totalMatches} correct
                </p>
              </>
            ) : (
              <p className="text-sm text-midnight-ink">No entries were submitted.</p>
            )}
            <div className="mt-5 flex gap-3 flex-wrap">
              <a
                href={`/contests/${contest.id}/leaderboard`}
                className="inline-flex items-center gap-2 bg-midnight-ink text-soft-white font-semibold text-sm px-5 py-2.5 hover:opacity-80 transition-opacity"
                style={{ borderRadius: 4 }}
              >
                View Final Leaderboard →
              </a>
              <form action={triggerReplay.bind(null, contest.id)}>
                <button
                  type="submit"
                  className="border border-midnight-ink text-midnight-ink font-semibold text-sm px-5 py-2.5 hover:bg-midnight-ink hover:text-soft-white transition-colors"
                  style={{ borderRadius: 4 }}
                >
                  Replay ↺
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Contest header card */}
        <div className="bg-soft-white border border-smoke p-8 mb-6" style={{ borderRadius: 8 }}>
          <div className="flex items-start justify-between gap-4 mb-1">
            <h1
              className="text-3xl font-bold text-midnight-ink leading-tight"
              style={{ fontFamily: 'var(--font-platform)', lineHeight: 1.1 }}
            >
              {contest.name}
            </h1>
            <span
              className="shrink-0 text-xs font-semibold text-pewter border border-smoke px-2 py-1 uppercase tracking-wide"
              style={{ borderRadius: 4 }}
            >
              {contest.status}
            </span>
          </div>

          <p className="text-graphite text-sm mt-2">
            {contest.entryCount} joined · {spotsLeft} spots left
          </p>

          {/* Shareable link */}
          <div
            className="mt-5 flex items-center gap-3 border border-smoke p-3"
            style={{ borderRadius: 4 }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-pewter shrink-0">Share</p>
            <code className="text-xs text-graphite flex-1 truncate">{`/contests/${contest.id}`}</code>
          </div>

          {/* CTAs — adapt to contest status */}
          <div className="mt-5 flex flex-col gap-2">
            {isResolved ? (
              <div
                className="flex items-center justify-center w-full border border-smoke text-pewter font-semibold py-3 text-sm"
                style={{ borderRadius: 4 }}
              >
                Picks Closed
              </div>
            ) : (
              <a
                href={`/contests/${contest.id}/predict`}
                className="flex items-center justify-center w-full bg-midnight-ink text-soft-white font-semibold py-3 text-sm hover:opacity-80 transition-opacity"
                style={{ borderRadius: 4 }}
              >
                Lock in Picks →
              </a>
            )}

            <a
              href={`/contests/${contest.id}/leaderboard`}
              className="flex items-center justify-center w-full border border-smoke text-graphite font-semibold py-3 text-sm hover:border-midnight-ink hover:text-midnight-ink transition-colors"
              style={{ borderRadius: 4 }}
            >
              {isResolved ? 'View Final Results →' : 'View Leaderboard'}
            </a>
          </div>
        </div>

        {/* Match list */}
        <p className="text-xs font-semibold uppercase tracking-widest text-pewter mb-4">
          {contest.matches.length} {contest.matches.length === 1 ? 'Match' : 'Matches'}
        </p>

        <div className="flex flex-col gap-2">
          {contest.matches.map((m) => (
            <div
              key={m.id}
              className="bg-soft-white border border-smoke p-4"
              style={{ borderRadius: 8 }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-midnight-ink text-sm">
                    {m.fixture.homeTeam}{' '}
                    <span className="text-pewter font-normal">vs</span>{' '}
                    {m.fixture.awayTeam}
                  </p>
                  <p className="text-pewter text-xs mt-0.5">
                    {new Date(m.fixture.kickoff).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZoneName: 'short',
                    })}
                  </p>
                </div>

                {/* Locked odds chips — winning result highlighted */}
                <div className="flex gap-1.5 shrink-0">
                  {(['1', 'X', '2'] as const).map((o) => (
                    <span
                      key={o}
                      className={`text-xs font-semibold px-2 py-1 border ${
                        m.result === o
                          ? 'bg-midnight-ink text-soft-white border-midnight-ink'
                          : 'border-smoke text-graphite'
                      }`}
                      style={{ borderRadius: 4 }}
                    >
                      {o} {bp(m.oddsBp[o])}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

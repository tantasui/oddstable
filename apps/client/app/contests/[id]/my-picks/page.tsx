import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';

export const metadata = { title: 'OddsPool — My Picks' };

const SERVER = process.env.SERVER_URL ?? 'http://localhost:3001';

type Pick = {
  contestMatchId: string;
  selection: '1' | 'X' | '2';
  oddsBp: { '1': number; 'X': number; '2': number };
  result: string | null;
  fixture: { homeTeam: string; awayTeam: string; kickoff: string };
};

type MyEntry = {
  id: string;
  contestId: string;
  anonymous: boolean;
  oddscoreRaw: string;
  winningCount: number;
  finalRank: number | null;
  picks: Pick[];
};

function bp(value: number) {
  return (value / 100).toFixed(2);
}

export default async function MyPicksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const jar = await cookies();
  const userId = jar.get('oddstable_uid')?.value;
  if (!userId) redirect('/onboarding');

  const res = await fetch(
    `${SERVER}/api/contests/${id}/my-entry?userId=${userId}`,
    { cache: 'no-store' },
  );
  if (res.status === 404) redirect(`/contests/${id}/predict`);
  if (!res.ok) notFound();

  const entry = await res.json() as MyEntry;

  const totalOdds = entry.picks.reduce(
    (acc, p) => acc * (p.oddsBp[p.selection] / 100),
    1,
  );

  const hasResults = entry.picks.some((p) => p.result !== null);
  const oddscoreDisplay = hasResults && entry.winningCount > 0
    ? entry.picks
        .filter((p) => p.result === p.selection)
        .reduce((acc, p) => acc * (p.oddsBp[p.selection] / 100), 1)
    : 0;

  return (
    <main className="min-h-screen bg-mist-gray">
      {/* Top bar */}
      <div className="bg-soft-white border-b border-smoke">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center">
          <a href={`/contests/${id}`} className="text-xs font-semibold uppercase tracking-widest text-midnight-ink">
            ← Contest
          </a>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Oddscore hero card */}
        <div className="bg-soft-white border border-smoke p-8 mb-6" style={{ borderRadius: 8 }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-pewter mb-2">
            {hasResults ? 'Your Oddscore' : 'Oddscore — live after kickoff'}
          </p>
          <p
            className="text-7xl font-bold text-midnight-ink leading-none mb-6"
            style={{ fontFamily: 'var(--font-platform)', lineHeight: 1 }}
          >
            {hasResults ? oddscoreDisplay.toFixed(2) : '—'}
          </p>

          <div className="flex items-center justify-between border-t border-smoke pt-4">
            <div>
              <p className="text-xs text-pewter uppercase tracking-widest mb-1">Total Odds</p>
              <p className="text-2xl font-bold text-graphite" style={{ fontFamily: 'var(--font-platform)' }}>
                {totalOdds.toFixed(2)}
              </p>
            </div>
            {hasResults && (
              <div className="text-right">
                <p className="text-xs text-pewter uppercase tracking-widest mb-1">Correct</p>
                <p className="text-2xl font-bold text-graphite" style={{ fontFamily: 'var(--font-platform)' }}>
                  {entry.winningCount}/{entry.picks.length}
                </p>
              </div>
            )}
          </div>

          <Link
            href={`/contests/${id}/leaderboard`}
            className="mt-6 flex items-center justify-center w-full bg-midnight-ink text-soft-white font-semibold py-3 text-sm hover:opacity-80 transition-opacity"
            style={{ borderRadius: 4 }}
          >
            View Leaderboard →
          </Link>
        </div>

        {/* Picks list */}
        <p className="text-xs font-semibold uppercase tracking-widest text-pewter mb-4">
          Your Picks
        </p>

        <div className="flex flex-col gap-2">
          {entry.picks.map((p) => {
            const correct = p.result !== null && p.result === p.selection;
            const wrong = p.result !== null && p.result !== p.selection;
            return (
              <div
                key={p.contestMatchId}
                className="bg-soft-white border border-smoke p-4"
                style={{ borderRadius: 8 }}
              >
                <div className="flex items-center gap-4">
                  {/* Selection badge */}
                  <div
                    className={`shrink-0 w-10 h-10 flex items-center justify-center font-bold text-sm ${
                      correct
                        ? 'bg-midnight-ink text-soft-white'
                        : wrong
                          ? 'bg-smoke text-pewter'
                          : 'bg-mist-gray text-graphite border border-smoke'
                    }`}
                    style={{ borderRadius: 4 }}
                  >
                    <span className={wrong ? 'line-through' : ''}>{p.selection}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-midnight-ink text-sm">
                      {p.fixture.homeTeam}{' '}
                      <span className="text-pewter font-normal">vs</span>{' '}
                      {p.fixture.awayTeam}
                    </p>
                    <p className="text-pewter text-xs mt-0.5">
                      {p.selection === '1'
                        ? p.fixture.homeTeam
                        : p.selection === '2'
                          ? p.fixture.awayTeam
                          : 'Draw'}{' '}
                      · {bp(p.oddsBp[p.selection])}
                    </p>
                  </div>

                  {p.result && (
                    <span
                      className={`shrink-0 text-xs font-semibold px-2 py-1 ${correct ? 'bg-signal-yellow text-midnight-ink' : 'bg-smoke text-pewter'}`}
                      style={{ borderRadius: 4 }}
                    >
                      {correct ? '✓ Correct' : `Result: ${p.result}`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {entry.anonymous && (
          <p className="text-pewter text-xs mt-6 text-center">
            You appear anonymously on the leaderboard.
          </p>
        )}
      </div>
    </main>
  );
}

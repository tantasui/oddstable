import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { submitPicks } from './actions';

export const metadata = { title: 'OddsPool — Lock in Picks' };

const SERVER = process.env.SERVER_URL ?? 'http://localhost:3001';

type Match = {
  id: string;
  oddsBp: { '1': number; 'X': number; '2': number };
  result: string | null;
  fixture: { homeTeam: string; awayTeam: string; kickoff: string };
};

type ContestDetail = {
  id: string;
  name: string;
  status: string;
  matches: Match[];
};

function bp(value: number) {
  return (value / 100).toFixed(2);
}

export default async function PredictPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const jar = await cookies();
  const userId = jar.get('oddstable_uid')?.value;
  if (userId) {
    const check = await fetch(`${SERVER}/api/contests/${id}/my-entry?userId=${userId}`, { cache: 'no-store' });
    if (check.ok) redirect(`/contests/${id}/my-picks`);
  }

  const res = await fetch(`${SERVER}/api/contests/${id}`, { cache: 'no-store' });
  if (!res.ok) notFound();
  const contest = await res.json() as ContestDetail;

  if (contest.status === 'resolved' || contest.status === 'cancelled') {
    redirect(`/contests/${id}`);
  }

  const action = submitPicks.bind(null, id);

  return (
    <main className="min-h-screen bg-mist-gray">
      {/* Top bar */}
      <div className="bg-soft-white border-b border-smoke">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center">
          <a href={`/contests/${id}`} className="text-xs font-semibold uppercase tracking-widest text-midnight-ink">
            ← {contest.name}
          </a>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1
          className="text-4xl font-bold text-midnight-ink mb-2 leading-tight"
          style={{ fontFamily: 'var(--font-platform)', lineHeight: 1.1 }}
        >
          Lock in<br />your picks.
        </h1>
        <p className="text-graphite text-sm mb-10">
          One pick per match. Your Oddscore = product of the odds you get right.
        </p>

        <form action={action} className="flex flex-col gap-3">
          {contest.matches.map((m) => (
            <div
              key={m.id}
              className="bg-soft-white border border-smoke p-5"
              style={{ borderRadius: 8 }}
            >
              <p className="font-semibold text-midnight-ink text-sm mb-0.5">
                {m.fixture.homeTeam}{' '}
                <span className="text-pewter font-normal">vs</span>{' '}
                {m.fixture.awayTeam}
              </p>
              <p className="text-pewter text-xs mb-4">
                {new Date(m.fixture.kickoff).toLocaleDateString('en-GB', {
                  weekday: 'short', day: 'numeric', month: 'short',
                  hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
                })}
              </p>

              {/* 1/X/2 radio buttons — each in own div to scope peer-checked */}
              <div className="flex gap-2">
                {(['1', 'X', '2'] as const).map((outcome) => (
                  <div key={outcome} className="flex-1">
                    <input
                      type="radio"
                      name={`pick_${m.id}`}
                      value={outcome}
                      id={`pick_${m.id}_${outcome}`}
                      required
                      className="peer sr-only"
                    />
                    <label
                      htmlFor={`pick_${m.id}_${outcome}`}
                      className="flex flex-col items-center justify-center w-full py-3 border-2 border-smoke cursor-pointer select-none transition-colors peer-checked:border-midnight-ink peer-checked:bg-midnight-ink peer-checked:text-soft-white text-graphite hover:border-midnight-ink"
                      style={{ borderRadius: 4 }}
                    >
                      <span className="text-xs font-semibold">{outcome}</span>
                      <span className="text-sm font-bold mt-0.5" style={{ fontFamily: 'var(--font-platform)' }}>
                        {bp(m.oddsBp[outcome])}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Anonymous toggle */}
          <label className="flex items-center gap-3 cursor-pointer py-3 px-1">
            <input
              type="checkbox"
              name="anonymous"
              className="w-4 h-4 accent-midnight-ink"
            />
            <span className="text-sm text-graphite">
              Hide my name on the leaderboard (anonymous)
            </span>
          </label>

          {error && (
            <p className="text-xs text-midnight-ink bg-signal-yellow px-3 py-2" style={{ borderRadius: 4 }}>
              {decodeURIComponent(error)}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-midnight-ink text-soft-white font-semibold py-4 text-sm hover:opacity-80 transition-opacity active:opacity-60 mt-2"
            style={{ borderRadius: 4 }}
          >
            Lock in Picks →
          </button>
        </form>
      </div>
    </main>
  );
}

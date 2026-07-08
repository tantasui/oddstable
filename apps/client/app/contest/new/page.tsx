import { createContest } from './actions';

export const metadata = { title: 'OddsPool — Create a Contest' };

const SERVER = process.env.SERVER_URL ?? 'http://localhost:3001';

type Fixture = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  odds: { '1': number; 'X': number; '2': number } | null;
};

function bp(value: number) {
  return (value / 100).toFixed(2);
}

export default async function NewContestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const fixturesRes = await fetch(`${SERVER}/api/fixtures?status=upcoming`, { cache: 'no-store' });
  const fixtures: Fixture[] = fixturesRes.ok ? (await fixturesRes.json() as Fixture[]) : [];

  return (
    <main className="min-h-screen bg-mist-gray">
      {/* Top bar */}
      <div className="bg-soft-white border-b border-smoke">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <a
            href="/"
            className="text-xs font-semibold uppercase tracking-widest text-midnight-ink"
          >
            ← OddsPool
          </a>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1
          className="text-4xl font-bold text-midnight-ink mb-2 leading-tight"
          style={{ fontFamily: 'var(--font-platform)', lineHeight: 1.1 }}
        >
          Create a Contest.
        </h1>
        <p className="text-graphite text-sm mb-10">
          Pick matches, lock the odds, share the link.
        </p>

        <form action={createContest} className="flex flex-col gap-6">
          {/* Contest details */}
          <div className="bg-soft-white border border-smoke p-6" style={{ borderRadius: 8 }}>
            <label className="block text-xs font-semibold uppercase tracking-widest text-pewter mb-2">
              Contest name
            </label>
            <input
              name="name"
              required
              minLength={3}
              maxLength={100}
              placeholder="Round of 32 Showdown"
              className="w-full border border-smoke px-4 py-3 text-midnight-ink placeholder:text-pewter outline-none focus:border-midnight-ink transition-colors text-sm mb-6"
              style={{ borderRadius: 4 }}
            />

            <label className="block text-xs font-semibold uppercase tracking-widest text-pewter mb-2">
              Max entries
            </label>
            <input
              name="maxEntries"
              type="number"
              min={2}
              max={1000}
              defaultValue={100}
              className="w-36 border border-smoke px-4 py-3 text-midnight-ink outline-none focus:border-midnight-ink transition-colors text-sm"
              style={{ borderRadius: 4 }}
            />
          </div>

          {/* Fixture selection */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-pewter mb-4">
              Pick matches ({fixtures.length} available)
            </p>

            {fixtures.length === 0 && (
              <p className="text-graphite text-sm">No upcoming fixtures — seed the DB first.</p>
            )}

            <div className="flex flex-col gap-2">
              {fixtures.map((f) => (
                <label key={f.id} className="relative cursor-pointer">
                  <input type="checkbox" name="fixtureIds" value={f.id} className="peer sr-only" />
                  <div
                    className="bg-soft-white border border-smoke peer-checked:border-midnight-ink peer-checked:bg-mist-gray transition-colors p-4 select-none"
                    style={{ borderRadius: 8 }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-midnight-ink text-sm">
                          {f.homeTeam} <span className="text-pewter font-normal">vs</span>{' '}
                          {f.awayTeam}
                        </p>
                        <p className="text-pewter text-xs mt-0.5">
                          {new Date(f.kickoff).toLocaleDateString('en-GB', {
                            weekday: 'short', day: 'numeric', month: 'short',
                            hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
                          })}
                        </p>
                      </div>
                      {f.odds && (
                        <div className="flex gap-1.5 shrink-0">
                          {(['1', 'X', '2'] as const).map((o) => (
                            <span
                              key={o}
                              className="text-xs font-semibold px-2 py-1 border border-smoke text-graphite bg-soft-white"
                              style={{ borderRadius: 4 }}
                            >
                              {o} {bp(f.odds![o])}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-midnight-ink bg-signal-yellow px-3 py-2" style={{ borderRadius: 4 }}>
              {decodeURIComponent(error)}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-midnight-ink text-soft-white font-semibold py-4 text-sm hover:opacity-80 transition-opacity active:opacity-60"
            style={{ borderRadius: 4 }}
          >
            Create Contest →
          </button>
        </form>
      </div>
    </main>
  );
}

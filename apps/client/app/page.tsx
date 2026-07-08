import { cookies } from 'next/headers';
import Link from 'next/link';

export const metadata = { title: 'OddsPool' };

const SERVER = process.env.SERVER_URL ?? 'http://localhost:3001';

type ContestCard = {
  id: string;
  name: string;
  status: string;
  startsAt: string;
  maxEntries: number;
  entryCount: number;
  matchCount: number;
};

const TABS = [
  { label: 'Upcoming', status: 'upcoming' },
  { label: 'Live',     status: 'live' },
  { label: 'Completed', status: 'resolved' },
] as const;

function FillBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1 w-full bg-smoke overflow-hidden" style={{ borderRadius: 2 }}>
      <div className="h-full bg-midnight-ink transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function LobbyPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = 'upcoming' } = await searchParams;
  const activeStatus = TABS.find((t) => t.label.toLowerCase() === tab)?.status ?? 'upcoming';
  const activeLabel = TABS.find((t) => t.status === activeStatus)?.label ?? 'Upcoming';

  const jar = await cookies();
  const uid = jar.get('oddstable_uid')?.value;
  let handle: string | null = null;
  if (uid) {
    try {
      const r = await fetch(`${SERVER}/api/users/${uid}`, { cache: 'no-store' });
      if (r.ok) handle = ((await r.json()) as { handle: string }).handle;
    } catch { /* server offline */ }
  }

  let contests: ContestCard[] = [];
  try {
    const r = await fetch(`${SERVER}/api/contests?status=${activeStatus}`, { cache: 'no-store' });
    if (r.ok) contests = await r.json() as ContestCard[];
  } catch { /* server offline */ }

  return (
    <main className="min-h-screen bg-mist-gray">
      {/* Pink hero — full bleed */}
      <section className="bg-preply-pink">
        {/* Nav row inside hero */}
        <nav className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
          <span
            className="text-lg font-bold text-midnight-ink tracking-tight"
            style={{ fontFamily: 'var(--font-platform)' }}
          >
            OddsPool
          </span>
          <div className="flex items-center gap-3">
            {handle && (
              <span className="text-xs font-semibold text-midnight-ink border border-midnight-ink px-3 py-1" style={{ borderRadius: 4 }}>
                {handle}
              </span>
            )}
            <Link
              href="/contest/new"
              className="bg-midnight-ink text-soft-white text-xs font-semibold px-4 py-2 hover:opacity-80 transition-opacity"
              style={{ borderRadius: 4 }}
            >
              + Create
            </Link>
          </div>
        </nav>

        {/* Hero copy */}
        <div className="max-w-screen-xl mx-auto px-6 pb-16 pt-8">
          <h1
            className="text-5xl font-bold text-midnight-ink leading-none tracking-tight mb-4"
            style={{ fontFamily: 'var(--font-platform)', lineHeight: 1.06 }}
          >
            Free prediction<br />pools. World Cup<br />2026.
          </h1>
          <p className="text-midnight-ink text-base mb-8 max-w-md">
            Pick every match. Score with the odds. Top Oddscore wins.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Link
              href="/contest/new"
              className="bg-midnight-ink text-soft-white font-semibold text-sm px-6 py-3.5 hover:opacity-80 transition-opacity inline-flex items-center gap-2"
              style={{ borderRadius: 4 }}
            >
              Create a Contest →
            </Link>
            {!handle && (
              <Link
                href="/onboarding"
                className="border border-midnight-ink text-midnight-ink font-semibold text-sm px-6 py-3.5 hover:bg-midnight-ink hover:text-soft-white transition-colors inline-flex items-center gap-2"
                style={{ borderRadius: 4 }}
              >
                Pick a handle
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Contest catalog */}
      <div className="max-w-screen-xl mx-auto px-6 py-12">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-smoke pb-4">
          {TABS.map((t) => {
            const isActive = t.status === activeStatus;
            return (
              <Link
                key={t.status}
                href={`/?tab=${t.label.toLowerCase()}`}
                className={`text-sm font-semibold px-4 py-2 transition-colors border ${
                  isActive
                    ? 'bg-midnight-ink text-soft-white border-midnight-ink'
                    : 'bg-soft-white text-graphite border-smoke hover:border-midnight-ink hover:text-midnight-ink'
                }`}
                style={{ borderRadius: 4 }}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {/* Contest cards */}
        {contests.length === 0 ? (
          <div className="bg-soft-white border border-smoke p-10 text-center" style={{ borderRadius: 8 }}>
            <p className="text-graphite text-sm mb-4">
              {activeLabel === 'Upcoming'
                ? 'No contests yet — be the first to create one.'
                : `No ${activeLabel.toLowerCase()} contests.`}
            </p>
            {activeLabel === 'Upcoming' && (
              <Link
                href="/contest/new"
                className="inline-flex items-center gap-2 bg-midnight-ink text-soft-white text-sm font-semibold px-5 py-2.5 hover:opacity-80 transition-opacity"
                style={{ borderRadius: 4 }}
              >
                Create Contest →
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contests.map((contest) => (
              <div
                key={contest.id}
                className="bg-soft-white border border-smoke p-6 flex flex-col gap-4"
                style={{ borderRadius: 8 }}
              >
                {/* Name + live badge */}
                <div className="flex items-start justify-between gap-3">
                  <h2
                    className="text-xl font-bold leading-tight text-midnight-ink flex-1"
                    style={{ fontFamily: 'var(--font-platform)' }}
                  >
                    {contest.name}
                  </h2>
                  {contest.status === 'live' && (
                    <span
                      className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-midnight-ink bg-signal-yellow px-2 py-0.5"
                      style={{ borderRadius: 4 }}
                    >
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-midnight-ink animate-pulse" />
                      LIVE
                    </span>
                  )}
                  {contest.status === 'resolved' && (
                    <span className="shrink-0 text-xs font-semibold text-pewter border border-smoke px-2 py-0.5" style={{ borderRadius: 4 }}>
                      Final
                    </span>
                  )}
                </div>

                {/* Metadata */}
                <p className="text-graphite text-xs">
                  {contest.matchCount} {contest.matchCount === 1 ? 'match' : 'matches'} ·{' '}
                  {new Date(contest.startsAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short',
                  })}
                </p>

                {/* Fill bar */}
                <div>
                  <FillBar value={contest.entryCount} max={contest.maxEntries} />
                  <p className="text-pewter text-xs mt-1.5">
                    {contest.entryCount} joined · {contest.maxEntries - contest.entryCount} spots left
                  </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-smoke">
                  <span className="text-xs font-semibold text-pewter uppercase tracking-widest">Free</span>
                  <Link
                    href={`/contests/${contest.id}`}
                    className="bg-midnight-ink text-soft-white text-xs font-semibold px-4 py-2 hover:opacity-80 transition-opacity"
                    style={{ borderRadius: 4 }}
                  >
                    Join for Free →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

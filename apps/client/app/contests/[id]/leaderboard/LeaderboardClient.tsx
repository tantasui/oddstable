'use client';

import { useEffect, useRef, useState } from 'react';

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

type Props = {
  contestId: string;
  contestName: string;
  contestStatus: string;
  initialRows: LeaderboardRow[];
};

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001';

export function LeaderboardClient({ contestId, contestName, contestStatus, initialRows }: Props) {
  const [rows, setRows] = useState<LeaderboardRow[]>(initialRows);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (contestStatus === 'resolved') return;

    let active = true;

    function connect() {
      if (!active) return;
      const ws = new WebSocket(`${WS_URL}/ws/contests/${contestId}/leaderboard`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data as string) as { type: string; data: LeaderboardRow[] };
        if (msg.type === 'leaderboard') setRows(msg.data);
      };

      ws.onclose = (evt) => {
        setConnected(false);
        if (!evt.wasClean && active) setTimeout(connect, 3000);
      };

      ws.onerror = () => {};
    }

    connect();
    return () => {
      active = false;
      wsRef.current?.close();
    };
  }, [contestId, contestStatus]);

  const isLive = contestStatus === 'live';
  const isResolved = contestStatus === 'resolved';

  return (
    <main className="min-h-screen bg-mist-gray">
      {/* Top bar */}
      <div className="bg-soft-white border-b border-smoke">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href={`/contests/${contestId}`} className="text-xs font-semibold uppercase tracking-widest text-midnight-ink">
            ← Back to Contest
          </a>
          <div className="flex items-center gap-3">
            {isLive && (
              <span
                className="flex items-center gap-1.5 text-xs font-semibold text-midnight-ink bg-signal-yellow px-3 py-1"
                style={{ borderRadius: 4 }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-midnight-ink opacity-40" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-midnight-ink" />
                </span>
                Live
              </span>
            )}
            {isResolved && (
              <span className="text-xs font-semibold text-pewter border border-smoke px-3 py-1" style={{ borderRadius: 4 }}>
                Final
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-2">
          <h1
            className="text-4xl font-bold text-midnight-ink leading-tight"
            style={{ fontFamily: 'var(--font-platform)', lineHeight: 1.1 }}
          >
            Leaderboard.
          </h1>
          <p className="text-graphite text-sm mt-2">{contestName}</p>
        </div>

        {isLive && (
          <p className={`text-xs mb-6 ${connected ? 'text-graphite' : 'text-pewter'}`}>
            {connected ? '● Live updates connected' : '◌ Reconnecting…'}
          </p>
        )}

        {/* Rows */}
        {rows.length === 0 ? (
          <div className="bg-soft-white border border-smoke p-10 text-center text-graphite" style={{ borderRadius: 8 }}>
            No entries yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => {
              const isWinner = row.rank === 1 && isResolved;
              return (
                <div
                  key={row.userId}
                  className={`bg-soft-white border p-4 flex items-center gap-4 ${isWinner ? 'border-signal-yellow border-2' : 'border-smoke'}`}
                  style={{ borderRadius: 8 }}
                >
                  {/* Rank */}
                  <div className="w-12 text-center shrink-0">
                    {row.rank <= 3 && isResolved ? (
                      <span className="text-xl">
                        {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : '🥉'}
                      </span>
                    ) : (
                      <span
                        className="text-xl font-bold text-pewter"
                        style={{ fontFamily: 'var(--font-platform)' }}
                      >
                        #{row.rank}
                      </span>
                    )}
                  </div>

                  {/* Handle */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-midnight-ink text-sm truncate">
                      {row.handle ?? <span className="text-pewter italic">Anonymous</span>}
                    </p>
                    <p className="text-xs text-pewter mt-0.5">
                      {row.winningCount}/{row.totalMatches} correct
                    </p>
                  </div>

                  {/* Oddscore */}
                  <div className="text-right shrink-0">
                    <p
                      className={`text-lg font-bold tabular-nums ${row.winningCount > 0 ? 'text-midnight-ink' : 'text-pewter'}`}
                      style={{ fontFamily: 'var(--font-platform)' }}
                    >
                      {row.oddscoreDisplay.toFixed(2)}
                    </p>
                    <p className="text-xs text-pewter">oddscore</p>
                  </div>

                  {/* Betslip link (Step 10) */}
                  <a
                    href={`/contests/${contestId}/betslip/${row.userId}`}
                    className="shrink-0 text-xs font-semibold text-graphite border border-smoke px-2 py-1 hover:border-midnight-ink hover:text-midnight-ink transition-colors"
                    style={{ borderRadius: 4 }}
                  >
                    Betslip
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

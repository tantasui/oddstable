import type { ScoreSource, ScoreUpdate } from '@oddstable/rules';
import { asc, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { scoreLog } from '../db/schema.js';

/**
 * Replays a contest's historical score_log events at a fixed interval.
 * Events are ordered by createdAt (the original wall-clock order) and
 * fired every gapMs milliseconds — no DB writes, only callbacks.
 */
export class ReplayScores implements ScoreSource {
  constructor(private gapMs = 500) {}

  subscribe(
    fixtureIds: string[],
    onUpdate: (u: ScoreUpdate) => void,
  ): () => void {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    db.select()
      .from(scoreLog)
      .where(inArray(scoreLog.fixtureId, fixtureIds))
      .orderBy(asc(scoreLog.createdAt))
      .then((rows) => {
        if (cancelled) return;
        rows.forEach((row, i) => {
          timers.push(
            setTimeout(() => {
              if (cancelled) return;
              onUpdate({
                fixtureId: row.fixtureId,
                homeGoals: row.homeGoals,
                awayGoals: row.awayGoals,
                minute: row.minute,
                status: row.status,
              });
            }, i * this.gapMs),
          );
        });
        console.log(`[replay] scheduled ${rows.length} events across ${fixtureIds.length} fixtures`);
      })
      .catch((err) => console.error('[replay] failed to load score_log:', err));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }
}

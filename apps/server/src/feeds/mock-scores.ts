import type { ScoreSource, ScoreUpdate } from '@oddstable/rules';
import { FIXTURE_IDS } from '../db/fixture-ids.js';

type MatchEvent = {
  realMinute: number; // position in a 90-min match timeline
  minute: number;     // displayed match minute
  homeGoals: number;
  awayGoals: number;
  status: 'live' | 'ft';
};

// Scripted FT results (varied — some upsets for interesting Oddscores):
//   fix-eng-arg  X  1:1   draw
//   fix-fra-ger  1  2:1   France win
//   fix-bra-mex  1  3:0   Brazil win (strong fave delivers)
//   fix-esp-por  2  0:2   Portugal win (away upset)
//   fix-ned-bel  X  0:0   draw
//   fix-usa-can  2  1:2   Canada win (away upset)
//   fix-cro-mar  1  1:0   Croatia win
//   fix-jpn-sen  2  0:1   Senegal win (away fave delivers)
const SCRIPTS: Record<string, MatchEvent[]> = {
  [FIXTURE_IDS.ENG_ARG]: [
    { realMinute: 1,  minute: 1,  homeGoals: 0, awayGoals: 0, status: 'live' },
    { realMinute: 28, minute: 28, homeGoals: 1, awayGoals: 0, status: 'live' },
    { realMinute: 67, minute: 67, homeGoals: 1, awayGoals: 1, status: 'live' },
    { realMinute: 91, minute: 90, homeGoals: 1, awayGoals: 1, status: 'ft'   },
  ],
  [FIXTURE_IDS.FRA_GER]: [
    { realMinute: 1,  minute: 1,  homeGoals: 0, awayGoals: 0, status: 'live' },
    { realMinute: 22, minute: 22, homeGoals: 1, awayGoals: 0, status: 'live' },
    { realMinute: 44, minute: 44, homeGoals: 2, awayGoals: 0, status: 'live' },
    { realMinute: 80, minute: 80, homeGoals: 2, awayGoals: 1, status: 'live' },
    { realMinute: 91, minute: 90, homeGoals: 2, awayGoals: 1, status: 'ft'   },
  ],
  [FIXTURE_IDS.BRA_MEX]: [
    { realMinute: 1,  minute: 1,  homeGoals: 0, awayGoals: 0, status: 'live' },
    { realMinute: 15, minute: 15, homeGoals: 1, awayGoals: 0, status: 'live' },
    { realMinute: 58, minute: 58, homeGoals: 2, awayGoals: 0, status: 'live' },
    { realMinute: 75, minute: 75, homeGoals: 3, awayGoals: 0, status: 'live' },
    { realMinute: 91, minute: 90, homeGoals: 3, awayGoals: 0, status: 'ft'   },
  ],
  [FIXTURE_IDS.ESP_POR]: [
    { realMinute: 1,  minute: 1,  homeGoals: 0, awayGoals: 0, status: 'live' },
    { realMinute: 55, minute: 55, homeGoals: 0, awayGoals: 1, status: 'live' },
    { realMinute: 88, minute: 88, homeGoals: 0, awayGoals: 2, status: 'live' },
    { realMinute: 91, minute: 90, homeGoals: 0, awayGoals: 2, status: 'ft'   },
  ],
  [FIXTURE_IDS.NED_BEL]: [
    { realMinute: 1,  minute: 1,  homeGoals: 0, awayGoals: 0, status: 'live' },
    { realMinute: 91, minute: 90, homeGoals: 0, awayGoals: 0, status: 'ft'   },
  ],
  [FIXTURE_IDS.USA_CAN]: [
    { realMinute: 1,  minute: 1,  homeGoals: 0, awayGoals: 0, status: 'live' },
    { realMinute: 33, minute: 33, homeGoals: 1, awayGoals: 0, status: 'live' },
    { realMinute: 61, minute: 61, homeGoals: 1, awayGoals: 1, status: 'live' },
    { realMinute: 82, minute: 82, homeGoals: 1, awayGoals: 2, status: 'live' },
    { realMinute: 91, minute: 90, homeGoals: 1, awayGoals: 2, status: 'ft'   },
  ],
  [FIXTURE_IDS.CRO_MAR]: [
    { realMinute: 1,  minute: 1,  homeGoals: 0, awayGoals: 0, status: 'live' },
    { realMinute: 71, minute: 71, homeGoals: 1, awayGoals: 0, status: 'live' },
    { realMinute: 91, minute: 90, homeGoals: 1, awayGoals: 0, status: 'ft'   },
  ],
  [FIXTURE_IDS.JPN_SEN]: [
    { realMinute: 1,  minute: 1,  homeGoals: 0, awayGoals: 0, status: 'live' },
    { realMinute: 49, minute: 49, homeGoals: 0, awayGoals: 1, status: 'live' },
    { realMinute: 91, minute: 90, homeGoals: 0, awayGoals: 1, status: 'ft'   },
  ],
};

export class MockScores implements ScoreSource {
  /**
   * @param speedMultiplier 600 → 90-min match plays out in ~9 s (good for demos/tests).
   *   Set via MOCK_SPEED env var. Use 1 for real-time (will take ~91 min).
   */
  constructor(private speedMultiplier = 600) {}

  subscribe(
    fixtureIds: string[],
    onUpdate: (u: ScoreUpdate) => void,
  ): () => void {
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const fixtureId of fixtureIds) {
      const script = SCRIPTS[fixtureId];
      if (!script) continue;

      for (const event of script) {
        const delayMs = Math.round(
          event.realMinute * (60_000 / this.speedMultiplier),
        );
        timers.push(
          setTimeout(
            () =>
              onUpdate({
                fixtureId,
                homeGoals: event.homeGoals,
                awayGoals: event.awayGoals,
                minute: event.minute,
                status: event.status,
              }),
            delayMs,
          ),
        );
      }
    }

    return () => timers.forEach(clearTimeout);
  }
}

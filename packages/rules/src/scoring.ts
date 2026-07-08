import { type Entry, type ContestMatch, type Outcome, ODDS_SCALE } from './types.js';

/** Decide a 1X2 result from goals. */
export function resolveMatch(homeGoals: number, awayGoals: number): Outcome {
  if (homeGoals > awayGoals) return '1';
  if (homeGoals < awayGoals) return '2';
  return 'X';
}

/** Number of correct picks. */
export function winningCount(entry: Entry, matches: ContestMatch[]): number {
  let c = 0;
  for (const m of matches) {
    const pick = entry.picks.find(p => p.fixtureId === m.fixtureId);
    if (pick && m.result && pick.selection === m.result) c++;
  }
  return c;
}

/**
 * Integer ranking score. CONSTANT scale (ODDS_SCALE^M) across all entries in a
 * contest, so raw values compare directly. Won leg -> its oddsBp; lost/blank -> 100.
 * Use this for ordering (and for on-chain recompute in Phase 2).
 */
export function oddscoreRaw(entry: Entry, matches: ContestMatch[]): bigint {
  let raw = 1n;
  for (const m of matches) {
    const pick = entry.picks.find(p => p.fixtureId === m.fixtureId);
    const won = !!(pick && m.result && pick.selection === m.result);
    raw *= BigInt(won ? m.oddsBp[pick!.selection] : ODDS_SCALE);
  }
  return raw;
}

/** Human-facing Oddscore. 0.00 if no correct picks (matches source UI). */
export function oddscoreDisplay(entry: Entry, matches: ContestMatch[]): number {
  if (winningCount(entry, matches) === 0) return 0;
  let prod = 1;
  for (const m of matches) {
    const pick = entry.picks.find(p => p.fixtureId === m.fixtureId);
    if (pick && m.result && pick.selection === m.result) prod *= m.oddsBp[pick.selection] / ODDS_SCALE;
  }
  return Math.round(prod * 100) / 100;
}

/** Rank: oddscoreRaw desc, then earliest submittedAt. */
export function rankEntries(entries: Entry[], matches: ContestMatch[]): Entry[] {
  return [...entries].sort((a, b) => {
    const ra = oddscoreRaw(a, matches), rb = oddscoreRaw(b, matches);
    if (ra !== rb) return rb > ra ? 1 : -1;
    return a.submittedAt - b.submittedAt;
  });
}

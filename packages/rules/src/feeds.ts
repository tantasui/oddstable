import type { Outcome, ScoreUpdate } from './types.js';

// Odds: snapshotted once at contest creation and locked.
export interface OddsSource {
  getOdds(fixtureIds: string[]): Promise<Record<string, Record<Outcome, number>>>;
}

// Scores: drives live leaderboard + final resolution.
export interface ScoreSource {
  subscribe(fixtureIds: string[], onUpdate: (u: ScoreUpdate) => void): () => void;
}

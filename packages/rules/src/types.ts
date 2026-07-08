export type Outcome = '1' | 'X' | '2';
export type Market = '1X2'; // enum-extensible later

export interface ContestMatch {
  fixtureId: string;
  market: Market;
  oddsBp: Record<Outcome, number>; // odds × 100, integer, locked at creation
  result?: Outcome;                // set when the match resolves
}

export interface Pick {
  fixtureId: string;
  selection: Outcome;
}

export interface Entry {
  userId: string;
  picks: Pick[];
  submittedAt: number;
}

export const ODDS_SCALE = 100; // basis points: 1.50 -> 150

export interface ScoreUpdate {
  fixtureId: string;
  homeGoals: number;
  awayGoals: number;
  minute: number;
  status: 'live' | 'ft';
}

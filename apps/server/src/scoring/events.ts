import { EventEmitter } from 'events';
import type { LeaderboardRow } from './leaderboard.js';

export const scoringEvents = new EventEmitter();

export type { LeaderboardRow };

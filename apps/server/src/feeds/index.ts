import type { OddsSource, ScoreSource } from '@oddstable/rules';
import { MockOdds } from './mock-odds.js';
import { MockScores } from './mock-scores.js';
import { TxLineOdds } from './txline-odds.js';
import { TxLineScores } from './txline-scores.js';

const useTxLine = Boolean(process.env.TXLINE_API_TOKEN);

if (useTxLine) {
  console.log('[feeds] using TxLINE live feeds (origin:', process.env.TXLINE_ORIGIN, ')');
} else {
  console.log('[feeds] using mock feeds (set TXLINE_API_TOKEN to switch to live)');
}

export const oddsSource: OddsSource = useTxLine ? new TxLineOdds() : new MockOdds();

const speed = Number(process.env.MOCK_SPEED ?? 600);
export const scoreSource: ScoreSource = useTxLine ? new TxLineScores() : new MockScores(speed);

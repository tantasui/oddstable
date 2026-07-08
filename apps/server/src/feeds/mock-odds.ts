import type { OddsSource, Outcome } from '@oddstable/rules';
import { FIXTURE_IDS } from '../db/fixture-ids.js';

// Realistic 1X2 odds in basis points (decimal × 100) for the mock Round-of-32 fixtures.
// These are locked at contest creation — identical for every player in the same contest.
const MOCK_ODDS: Record<string, Record<Outcome, number>> = {
  [FIXTURE_IDS.ENG_ARG]: { '1': 225, 'X': 290, '2': 185 }, // Argentina slight fave
  [FIXTURE_IDS.FRA_GER]: { '1': 190, 'X': 285, '2': 230 }, // France slight fave
  [FIXTURE_IDS.BRA_MEX]: { '1': 155, 'X': 320, '2': 500 }, // Brazil strong fave
  [FIXTURE_IDS.ESP_POR]: { '1': 200, 'X': 275, '2': 215 }, // toss-up
  [FIXTURE_IDS.NED_BEL]: { '1': 210, 'X': 280, '2': 205 }, // toss-up
  [FIXTURE_IDS.USA_CAN]: { '1': 185, 'X': 300, '2': 240 }, // USA slight fave
  [FIXTURE_IDS.CRO_MAR]: { '1': 215, 'X': 275, '2': 215 }, // toss-up
  [FIXTURE_IDS.JPN_SEN]: { '1': 230, 'X': 285, '2': 190 }, // Senegal slight fave
};

export class MockOdds implements OddsSource {
  async getOdds(
    fixtureIds: string[],
  ): Promise<Record<string, Record<Outcome, number>>> {
    return Object.fromEntries(
      fixtureIds
        .filter((id) => id in MOCK_ODDS)
        .map((id) => [id, MOCK_ODDS[id]!]),
    );
  }
}

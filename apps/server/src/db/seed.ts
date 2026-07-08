import { db } from './index.js';
import { fixtures, picks, entries, scoreLog, contestMatches, contests, users } from './schema.js';
import { FIXTURE_IDS } from './fixture-ids.js';

const MOCK_FIXTURES = [
  { id: FIXTURE_IDS.ENG_ARG, homeTeam: 'England',     awayTeam: 'Argentina', kickoffIso: '2026-07-10T15:00:00Z' },
  { id: FIXTURE_IDS.FRA_GER, homeTeam: 'France',      awayTeam: 'Germany',   kickoffIso: '2026-07-10T18:00:00Z' },
  { id: FIXTURE_IDS.BRA_MEX, homeTeam: 'Brazil',      awayTeam: 'Mexico',    kickoffIso: '2026-07-11T15:00:00Z' },
  { id: FIXTURE_IDS.ESP_POR, homeTeam: 'Spain',       awayTeam: 'Portugal',  kickoffIso: '2026-07-11T18:00:00Z' },
  { id: FIXTURE_IDS.NED_BEL, homeTeam: 'Netherlands', awayTeam: 'Belgium',   kickoffIso: '2026-07-12T15:00:00Z' },
  { id: FIXTURE_IDS.USA_CAN, homeTeam: 'USA',         awayTeam: 'Canada',    kickoffIso: '2026-07-12T18:00:00Z' },
  { id: FIXTURE_IDS.CRO_MAR, homeTeam: 'Croatia',     awayTeam: 'Morocco',   kickoffIso: '2026-07-13T15:00:00Z' },
  { id: FIXTURE_IDS.JPN_SEN, homeTeam: 'Japan',       awayTeam: 'Senegal',   kickoffIso: '2026-07-13T18:00:00Z' },
];

if (import.meta.main) {
  // Wipe in FK-safe order so re-runs always start clean.
  await db.delete(picks);
  await db.delete(entries);
  await db.delete(scoreLog);
  await db.delete(contestMatches);
  await db.delete(contests);
  await db.delete(users);
  await db.delete(fixtures);

  for (const f of MOCK_FIXTURES) {
    await db.insert(fixtures).values({
      id: f.id,
      round: 'Round of 32',
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      kickoff: new Date(f.kickoffIso),
      status: 'upcoming',
      homeGoals: 0,
      awayGoals: 0,
    });
  }

  console.log(`Seeded ${MOCK_FIXTURES.length} mock fixtures with stable IDs.`);
}

export { FIXTURE_IDS };

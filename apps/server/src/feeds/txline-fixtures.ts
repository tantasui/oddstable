// Syncs TxLINE fixture snapshot into our local DB.
// Fixtures are stored with IDs of the form 'txl-{FixtureId}' so that
// TxLineOdds and TxLineScores can extract the TxLINE ID without a DB lookup.

import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { fixtures } from '../db/schema.js';
import { txlineFetch } from './txline-client.js';

// TxLINE Fixture from /api/fixtures/snapshot
type TxLineFixture = {
  FixtureId: number;
  Participant1: string;
  Participant2: string;
  Participant1IsHome?: boolean;
  StartTime: string;   // ISO 8601
  CompetitionId?: number;
  CompetitionName?: string;
  Round?: string | number;
};

export async function syncFixtures(competitionId?: number): Promise<number> {
  const path = competitionId
    ? `/api/fixtures/snapshot?competitionId=${competitionId}`
    : '/api/fixtures/snapshot';

  const res = await txlineFetch(path);
  const raw = await res.json() as TxLineFixture[];

  console.log(`[txline-fixtures] received ${raw.length} fixtures from TxLINE`);
  if (raw.length === 0) return 0;

  // Log first fixture so we can see exact field names returned by the API
  console.log('[txline-fixtures] first fixture sample:', JSON.stringify(raw[0]).slice(0, 300));

  let upserted = 0;

  for (const f of raw) {
    const id = `txl-${f.FixtureId}`;

    // Participant1IsHome: true → Participant1 is the home team
    const homeTeam = f.Participant1IsHome !== false ? f.Participant1 : f.Participant2;
    const awayTeam = f.Participant1IsHome !== false ? f.Participant2 : f.Participant1;
    const kickoff  = new Date(f.StartTime);
    const round    = f.Round?.toString() ?? f.CompetitionName ?? 'Group Stage';

    const existing = await db
      .select({ id: fixtures.id, status: fixtures.status })
      .from(fixtures)
      .where(eq(fixtures.id, id))
      .limit(1);

    if (existing.length > 0) {
      // Update team names and kickoff in case they changed; preserve live/ft status
      await db
        .update(fixtures)
        .set({ homeTeam, awayTeam, kickoff, round })
        .where(eq(fixtures.id, id));
    } else {
      await db.insert(fixtures).values({
        id,
        round,
        homeTeam,
        awayTeam,
        kickoff,
        status: 'upcoming',
        homeGoals: 0,
        awayGoals: 0,
      });
      upserted++;
    }
  }

  console.log(`[txline-fixtures] upserted ${upserted} new fixtures`);
  return upserted;
}

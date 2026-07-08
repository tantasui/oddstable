import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  handle: text('handle').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const fixtures = sqliteTable('fixtures', {
  id: text('id').primaryKey(),
  round: text('round').notNull(),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  kickoff: integer('kickoff', { mode: 'timestamp_ms' }).notNull(),
  status: text('status', { enum: ['upcoming', 'live', 'ft'] }).notNull().default('upcoming'),
  homeGoals: integer('home_goals').notNull().default(0),
  awayGoals: integer('away_goals').notNull().default(0),
});

export const contests = sqliteTable('contests', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  creatorId: text('creator_id').notNull().references(() => users.id),
  mode: text('mode', { enum: ['free', 'onchain'] }).notNull().default('free'),
  status: text('status', { enum: ['upcoming', 'live', 'resolved', 'cancelled'] }).notNull().default('upcoming'),
  startsAt: integer('starts_at', { mode: 'timestamp_ms' }).notNull(),
  prizePool: integer('prize_pool').notNull().default(0),
  maxEntries: integer('max_entries').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const contestMatches = sqliteTable('contest_matches', {
  id: text('id').primaryKey(),
  contestId: text('contest_id')
    .notNull()
    .references(() => contests.id, { onDelete: 'cascade' }),
  fixtureId: text('fixture_id')
    .notNull()
    .references(() => fixtures.id),
  market: text('market', { enum: ['1X2'] }).notNull().default('1X2'),
  odds1Bp: integer('odds_1_bp').notNull(),
  oddsXBp: integer('odds_x_bp').notNull(),
  odds2Bp: integer('odds_2_bp').notNull(),
  result: text('result', { enum: ['1', 'X', '2'] }),
});

export const entries = sqliteTable('entries', {
  id: text('id').primaryKey(),
  contestId: text('contest_id')
    .notNull()
    .references(() => contests.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  submittedAt: integer('submitted_at', { mode: 'timestamp_ms' }).notNull(),
  anonymous: integer('anonymous', { mode: 'boolean' }).notNull().default(false),
  // bigint stored as text; recomputed from picks + odds on demand
  oddscoreRaw: text('oddscore_raw').notNull().default('0'),
  winningCount: integer('winning_count').notNull().default(0),
  finalRank: integer('final_rank'),
});

export const picks = sqliteTable('picks', {
  id: text('id').primaryKey(),
  entryId: text('entry_id')
    .notNull()
    .references(() => entries.id, { onDelete: 'cascade' }),
  contestMatchId: text('contest_match_id')
    .notNull()
    .references(() => contestMatches.id),
  selection: text('selection', { enum: ['1', 'X', '2'] }).notNull(),
});

export const scoreLog = sqliteTable('score_log', {
  id: text('id').primaryKey(),
  fixtureId: text('fixture_id').notNull().references(() => fixtures.id),
  homeGoals: integer('home_goals').notNull(),
  awayGoals: integer('away_goals').notNull(),
  minute: integer('minute').notNull(),
  status: text('status', { enum: ['live', 'ft'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

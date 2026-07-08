import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

const dbPath = process.env.DB_PATH ?? './local.db';
const sqlite = new Database(dbPath);
sqlite.exec('PRAGMA foreign_keys = ON;');

const db = drizzle(sqlite);
migrate(db, { migrationsFolder: './drizzle' });
sqlite.close();

console.log('Migrations applied to', dbPath);

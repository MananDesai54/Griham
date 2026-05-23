import Database, { type Database as DB } from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS projects (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     provider TEXT NOT NULL DEFAULT 'gemini',
     style_anchor_blob_id TEXT,
     created_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS rooms (
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     label TEXT NOT NULL,
     source_blob_id TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS designs (
     id TEXT PRIMARY KEY,
     room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
     blob_id TEXT,
     prompt TEXT NOT NULL,
     parent_design_id TEXT REFERENCES designs(id),
     status TEXT NOT NULL DEFAULT 'pending',
     error TEXT,
     created_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS blobs (
     id TEXT PRIMARY KEY,
     path TEXT NOT NULL,
     mime TEXT NOT NULL,
     bytes INTEGER NOT NULL
   )`,
];

const globalForDb = globalThis as unknown as { __griham_db?: DB };

export function openDb(path: string): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  for (const sql of MIGRATIONS) db.exec(sql);
  return db;
}

export function getDb(): DB {
  if (globalForDb.__griham_db) return globalForDb.__griham_db;
  const path = process.env.GRIHAM_DB_PATH ?? `${process.env.GRIHAM_DATA_DIR ?? "./data"}/griham.db`;
  globalForDb.__griham_db = openDb(path);
  return globalForDb.__griham_db;
}

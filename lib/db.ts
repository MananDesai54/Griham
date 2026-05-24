import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

type DB = Database;

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
  `ALTER TABLE designs ADD COLUMN edit_instruction TEXT`,
  `ALTER TABLE designs ADD COLUMN mask_blob_id TEXT REFERENCES blobs(id)`,
  `CREATE TABLE IF NOT EXISTS meshes (
     id TEXT PRIMARY KEY,
     design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
     glb_blob_id TEXT,
     job_id TEXT,
     status TEXT NOT NULL DEFAULT 'pending',
     error TEXT,
     created_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS meshes_design_id ON meshes(design_id)`,
  `ALTER TABLE projects ADD COLUMN style_brief TEXT`,
  `ALTER TABLE rooms ADD COLUMN hint TEXT`,
];

const globalForDb = globalThis as unknown as { __griham_db?: DB };

export function openDb(path: string): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  for (const sql of MIGRATIONS) {
    try { db.exec(sql); }
    catch (e) {
      const msg = (e as Error).message;
      if (!/duplicate column name/i.test(msg)) throw e;
    }
  }
  return db;
}

export function getDb(): DB {
  if (globalForDb.__griham_db) return globalForDb.__griham_db;
  const path = process.env.GRIHAM_DB_PATH ?? `${process.env.GRIHAM_DATA_DIR ?? "./data"}/griham.db`;
  globalForDb.__griham_db = openDb(path);
  return globalForDb.__griham_db;
}

export type { DB };

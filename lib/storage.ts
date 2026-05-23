import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "better-sqlite3";
import { newId } from "./ids";

export async function writeBlob(db: Database, baseDir: string, data: Buffer, mime: string): Promise<string> {
  const id = newId();
  const dir = join(baseDir, "blobs");
  mkdirSync(dir, { recursive: true });
  const path = join("blobs", id);
  writeFileSync(join(baseDir, path), data);
  db.prepare("INSERT INTO blobs (id, path, mime, bytes) VALUES (?,?,?,?)").run(id, path, mime, data.byteLength);
  return id;
}

export async function readBlob(db: Database, baseDir: string, id: string): Promise<{ bytes: Buffer; mime: string }> {
  const row = db.prepare("SELECT path, mime FROM blobs WHERE id=?").get(id) as { path: string; mime: string } | undefined;
  if (!row) throw new Error(`blob not found: ${id}`);
  const bytes = readFileSync(join(baseDir, row.path));
  return { bytes, mime: row.mime };
}

export function dataDir(): string {
  return process.env.GRIHAM_DATA_DIR ?? "./data";
}

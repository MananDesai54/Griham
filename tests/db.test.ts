import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../lib/db";

describe("db", () => {
  let dbPath: string;
  beforeEach(() => { dbPath = ":memory:"; });

  it("creates tables on open", () => {
    const db = openDb(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
    const names = tables.map(t => t.name);
    expect(names).toContain("projects");
    expect(names).toContain("rooms");
    expect(names).toContain("designs");
    expect(names).toContain("blobs");
  });

  it("inserts and reads a project", () => {
    const db = openDb(":memory:");
    db.prepare("INSERT INTO projects (id, name, provider, created_at) VALUES (?,?,?,?)").run("p1","Test","gemini",1);
    const row = db.prepare("SELECT * FROM projects WHERE id=?").get("p1") as any;
    expect(row.name).toBe("Test");
    expect(row.provider).toBe("gemini");
  });
});

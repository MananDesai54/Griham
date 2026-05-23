import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb } from "../lib/db";
import { writeBlob, readBlob } from "../lib/storage";

describe("storage", () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "griham-")); });

  it("writes a blob and reads back bytes + mime", async () => {
    const db = openDb(":memory:");
    const data = Buffer.from("hello-bytes");
    const id = await writeBlob(db, dir, data, "image/png");
    const out = await readBlob(db, dir, id);
    expect(out.bytes.equals(data)).toBe(true);
    expect(out.mime).toBe("image/png");
  });

  it("throws on missing blob", async () => {
    const db = openDb(":memory:");
    await expect(readBlob(db, dir, "nope")).rejects.toThrow();
  });
});

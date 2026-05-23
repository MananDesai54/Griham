import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("@/lib/ai/index", async () => {
  return {
    getProvider: () => ({
      name: "gemini",
      generateAnchor: vi.fn(async (rooms: any[]) => ({
        anchor: { bytes: Buffer.from("anchor-img"), mime: "image/png" },
        anchorRoomLabel: rooms[0].label,
      })),
      generateRoom: vi.fn(async (_anchor: any, room: any) => {
        if (room.label === "fail-me") throw new Error("provider boom");
        return { bytes: Buffer.from(`room-${room.label}`), mime: "image/png" };
      }),
    }),
    MissingApiKeyError: class extends Error {},
  };
});

let POST: any;

describe("designs.generate", () => {
  beforeEach(async () => {
    const dir = mkdtempSync(join(tmpdir(), "griham-int-"));
    process.env.GRIHAM_DATA_DIR = dir;
    process.env.GRIHAM_DB_PATH = join(dir, "griham.db");
    // Reset globalThis singleton so each test gets a fresh DB
    (globalThis as any).__griham_db = undefined;
    vi.resetModules();
    vi.clearAllMocks();
    ({ POST } = await import("../app/api/designs/generate/route"));
  });

  it("creates anchor on first call, succeeds for ok rooms, marks fail rooms failed", async () => {
    const { getDb } = await import("../lib/db");
    const { writeBlob, dataDir } = await import("../lib/storage");
    const db = getDb();

    db.prepare("INSERT INTO projects (id, name, provider, created_at) VALUES (?,?,?,?)").run("p1", "Home", "gemini", 1);
    const srcA = await writeBlob(db, dataDir(), Buffer.from("a"), "image/jpeg");
    const srcB = await writeBlob(db, dataDir(), Buffer.from("b"), "image/jpeg");
    const srcC = await writeBlob(db, dataDir(), Buffer.from("c"), "image/jpeg");
    db.prepare("INSERT INTO rooms (id, project_id, label, source_blob_id, created_at) VALUES (?,?,?,?,?)")
      .run("r1", "p1", "living room", srcA, 1);
    db.prepare("INSERT INTO rooms (id, project_id, label, source_blob_id, created_at) VALUES (?,?,?,?,?)")
      .run("r2", "p1", "kitchen", srcB, 2);
    db.prepare("INSERT INTO rooms (id, project_id, label, source_blob_id, created_at) VALUES (?,?,?,?,?)")
      .run("r3", "p1", "fail-me", srcC, 3);

    const req = new Request("http://x", { method: "POST", body: JSON.stringify({ project_id: "p1" }), headers: { "content-type": "application/json" } });
    const res = await POST(req as any);
    expect(res.status).toBe(200);

    const proj = db.prepare("SELECT style_anchor_blob_id FROM projects WHERE id=?").get("p1") as any;
    expect(proj.style_anchor_blob_id).toBeTruthy();

    const designs = db.prepare("SELECT room_id, status FROM designs ORDER BY created_at").all() as any[];
    const byRoom = Object.fromEntries(designs.map(d => [d.room_id, d.status]));
    expect(byRoom.r1).toBe("ready");
    expect(byRoom.r2).toBe("ready");
    expect(byRoom.r3).toBe("failed");
  });

  it("re-running skips ready rooms and retries failed", async () => {
    const { getDb } = await import("../lib/db");
    const db = getDb();
    db.prepare("INSERT INTO projects (id, name, provider, created_at) VALUES (?,?,?,?)").run("p2", "Home2", "gemini", 1);
    const { writeBlob, dataDir } = await import("../lib/storage");
    const srcAnchor = await writeBlob(db, dataDir(), Buffer.from("anc"), "image/jpeg");
    const src = await writeBlob(db, dataDir(), Buffer.from("a"), "image/jpeg");
    db.prepare("INSERT INTO rooms (id, project_id, label, source_blob_id, created_at) VALUES (?,?,?,?,?)")
      .run("ra", "p2", "living room", srcAnchor, 1);
    db.prepare("INSERT INTO rooms (id, project_id, label, source_blob_id, created_at) VALUES (?,?,?,?,?)")
      .run("rx", "p2", "fail-me", src, 2);

    const req1 = new Request("http://x", { method: "POST", body: JSON.stringify({ project_id: "p2" }), headers: { "content-type": "application/json" } });
    await POST(req1 as any);
    let d = db.prepare("SELECT status FROM designs WHERE room_id='rx'").get() as any;
    expect(d.status).toBe("failed");

    // rename the room so it won't fail this time
    db.prepare("UPDATE rooms SET label='kitchen' WHERE id='rx'").run();
    const req2 = new Request("http://x", { method: "POST", body: JSON.stringify({ project_id: "p2" }), headers: { "content-type": "application/json" } });
    await POST(req2 as any);
    const ready = db.prepare("SELECT 1 FROM designs WHERE room_id='rx' AND status='ready' LIMIT 1").get();
    expect(ready).toBeTruthy();
  });
});

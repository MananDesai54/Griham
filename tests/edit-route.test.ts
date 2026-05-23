import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("@/lib/ai/index", () => ({
  getProvider: () => ({
    name: "gemini",
    generateAnchor: vi.fn(),
    generateRoom: vi.fn(),
    editRoom: vi.fn(async (_base: any, mask: any, instruction: string) => ({
      bytes: Buffer.from(`edited:${instruction}:${mask ? "with-mask" : "no-mask"}`),
      mime: "image/png",
    })),
  }),
  MissingApiKeyError: class extends Error {},
}));

let POST: any;

describe("designs.edit", () => {
  beforeEach(async () => {
    const dir = mkdtempSync(join(tmpdir(), "griham-edit-"));
    process.env.GRIHAM_DATA_DIR = dir;
    process.env.GRIHAM_DB_PATH = join(dir, "griham.db");
    (globalThis as any).__griham_db = undefined;
    vi.resetModules();
    ({ POST } = await import("../app/api/designs/[id]/edit/route"));
  });

  it("creates a new design row chained to the base", async () => {
    const { getDb } = await import("../lib/db");
    const { writeBlob, dataDir } = await import("../lib/storage");
    const db = getDb();
    db.prepare("INSERT INTO projects (id, name, provider, created_at) VALUES (?,?,?,?)").run("p1","H","gemini",1);
    const srcBlob = await writeBlob(db, dataDir(), Buffer.from("src"), "image/jpeg");
    db.prepare("INSERT INTO rooms (id, project_id, label, source_blob_id, created_at) VALUES (?,?,?,?,?)").run("r1","p1","living room",srcBlob,1);
    const baseBlob = await writeBlob(db, dataDir(), Buffer.from("base-img"), "image/png");
    db.prepare("INSERT INTO designs (id, room_id, blob_id, prompt, status, created_at) VALUES (?,?,?,?,?,?)").run("d1","r1",baseBlob,"prompt","ready",1);

    const fd = new FormData();
    fd.set("instruction", "move sofa");
    const req = new Request("http://x/api/designs/d1/edit", { method: "POST", body: fd });
    const res = await POST(req as any, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.design_id).toBeTruthy();

    const newRow = db.prepare("SELECT * FROM designs WHERE id=?").get(body.design_id) as any;
    expect(newRow.parent_design_id).toBe("d1");
    expect(newRow.status).toBe("ready");
    expect(newRow.edit_instruction).toBe("move sofa");
    expect(newRow.room_id).toBe("r1");
  });

  it("rejects edit on non-ready base", async () => {
    const { getDb } = await import("../lib/db");
    const db = getDb();
    db.prepare("INSERT INTO projects (id, name, provider, created_at) VALUES (?,?,?,?)").run("p2","H","gemini",1);
    const { writeBlob, dataDir } = await import("../lib/storage");
    const srcBlob = await writeBlob(db, dataDir(), Buffer.from("src"), "image/jpeg");
    db.prepare("INSERT INTO rooms (id, project_id, label, source_blob_id, created_at) VALUES (?,?,?,?,?)").run("rx","p2","kitchen",srcBlob,1);
    db.prepare("INSERT INTO designs (id, room_id, blob_id, prompt, status, created_at) VALUES (?,?,?,?,?,?)").run("d2","rx",null,"prompt","pending",1);

    const fd = new FormData();
    fd.set("instruction", "x");
    const req = new Request("http://x", { method: "POST", body: fd });
    const res = await POST(req as any, { params: Promise.resolve({ id: "d2" }) });
    expect(res.status).toBe(400);
  });

  it("rejects empty instruction", async () => {
    const { getDb } = await import("../lib/db");
    const db = getDb();
    db.prepare("INSERT INTO projects (id, name, provider, created_at) VALUES (?,?,?,?)").run("p3","H","gemini",1);
    const { writeBlob, dataDir } = await import("../lib/storage");
    const srcBlob = await writeBlob(db, dataDir(), Buffer.from("src"), "image/jpeg");
    db.prepare("INSERT INTO rooms (id, project_id, label, source_blob_id, created_at) VALUES (?,?,?,?,?)").run("rq","p3","k",srcBlob,1);
    const baseBlob = await writeBlob(db, dataDir(), Buffer.from("base"), "image/png");
    db.prepare("INSERT INTO designs (id, room_id, blob_id, prompt, status, created_at) VALUES (?,?,?,?,?,?)").run("d3","rq",baseBlob,"prompt","ready",1);

    const fd = new FormData();
    fd.set("instruction", "");
    const req = new Request("http://x", { method: "POST", body: fd });
    const res = await POST(req as any, { params: Promise.resolve({ id: "d3" }) });
    expect(res.status).toBe(400);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const startJob = vi.fn();
const pollJob = vi.fn();
vi.mock("@/lib/mesh/meshy", () => ({
  MeshyProvider: vi.fn().mockImplementation(() => ({ name: "meshy", startJob, pollJob })),
}));

// Stub fetch for GLB download in poll route.
global.fetch = vi.fn(async () => ({
  ok: true,
  arrayBuffer: async () => new Uint8Array(Buffer.from("glb-bytes")).buffer,
})) as any;

let startRoute: any;
let pollRoute: any;

describe("mesh routes", () => {
  beforeEach(async () => {
    const dir = mkdtempSync(join(tmpdir(), "griham-mesh-"));
    process.env.GRIHAM_DATA_DIR = dir;
    process.env.GRIHAM_DB_PATH = join(dir, "griham.db");
    (globalThis as any).__griham_db = undefined;
    startJob.mockReset();
    pollJob.mockReset();
    vi.resetModules();
    vi.clearAllMocks();
    ({ POST: startRoute } = await import("../app/api/designs/[id]/mesh/route"));
    ({ GET: pollRoute } = await import("../app/api/meshes/[id]/route"));
  });

  async function seed() {
    const { getDb } = await import("../lib/db");
    const { writeBlob, dataDir } = await import("../lib/storage");
    const db = getDb();
    db.prepare("INSERT INTO projects (id, name, provider, created_at) VALUES (?,?,?,?)").run("p1","H","gemini",1);
    const src = await writeBlob(db, dataDir(), Buffer.from("src"), "image/jpeg");
    db.prepare("INSERT INTO rooms (id, project_id, label, source_blob_id, created_at) VALUES (?,?,?,?,?)").run("r1","p1","k",src,1);
    const designBlob = await writeBlob(db, dataDir(), Buffer.from("design-img"), "image/png");
    db.prepare("INSERT INTO designs (id, room_id, blob_id, prompt, status, created_at) VALUES (?,?,?,?,?,?)").run("d1","r1",designBlob,"p","ready",1);
    return { db };
  }

  it("startJob inserts row with job_id and returns mesh_id", async () => {
    const { db } = await seed();
    startJob.mockResolvedValueOnce({ jobId: "job-1" });
    const req = new Request("http://x", { method: "POST" });
    const res = await startRoute(req as any, { params: Promise.resolve({ id: "d1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    const row = db.prepare("SELECT * FROM meshes WHERE id=?").get(body.mesh_id) as any;
    expect(row.job_id).toBe("job-1");
    expect(row.status).toBe("pending");
  });

  it("poll transitions pending → ready and downloads GLB", async () => {
    const { db } = await seed();
    startJob.mockResolvedValueOnce({ jobId: "job-2" });
    const req = new Request("http://x", { method: "POST" });
    const sres = await startRoute(req as any, { params: Promise.resolve({ id: "d1" }) });
    const { mesh_id } = await sres.json();

    pollJob.mockResolvedValueOnce({ status: "ready", glbUrl: "https://cdn/x.glb" });
    const greq = new Request("http://x", { method: "GET" });
    const gres = await pollRoute(greq as any, { params: Promise.resolve({ id: mesh_id }) });
    const body = await gres.json();
    expect(body.status).toBe("ready");
    expect(body.glb_url).toMatch(/\/api\/blobs\//);

    const row = db.prepare("SELECT * FROM meshes WHERE id=?").get(mesh_id) as any;
    expect(row.status).toBe("ready");
    expect(row.glb_blob_id).toBeTruthy();

    const blobRow = db.prepare("SELECT mime FROM blobs WHERE id=?").get(row.glb_blob_id) as any;
    expect(blobRow.mime).toBe("model/gltf-binary");
  });

  it("poll marks failed when provider returns failed", async () => {
    const { db } = await seed();
    startJob.mockResolvedValueOnce({ jobId: "job-3" });
    const sres = await startRoute(new Request("http://x", { method: "POST" }) as any, { params: Promise.resolve({ id: "d1" }) });
    const { mesh_id } = await sres.json();

    pollJob.mockResolvedValueOnce({ status: "failed", error: "boom" });
    const gres = await pollRoute(new Request("http://x") as any, { params: Promise.resolve({ id: mesh_id }) });
    const body = await gres.json();
    expect(body.status).toBe("failed");
    expect(body.error).toBe("boom");
    const row = db.prepare("SELECT status, error FROM meshes WHERE id=?").get(mesh_id) as any;
    expect(row.status).toBe("failed");
  });
});

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { writeBlob, dataDir } from "@/lib/storage";
import { MeshyProvider } from "@/lib/mesh/meshy";

const MAX_GLB_BYTES = 50 * 1024 * 1024;
const TIMEOUT_MS = 30 * 60 * 1000;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare("SELECT id, design_id, glb_blob_id, job_id, status, error, created_at FROM meshes WHERE id=?").get(id) as
    | { id: string; design_id: string; glb_blob_id: string | null; job_id: string | null; status: string; error: string | null; created_at: number }
    | undefined;
  if (!row) return NextResponse.json({ error: "mesh not found" }, { status: 404 });

  if (row.status === "ready") {
    return NextResponse.json({ status: "ready", glb_url: `/api/blobs/${row.glb_blob_id}` });
  }
  if (row.status === "failed") {
    return NextResponse.json({ status: "failed", error: row.error });
  }

  if (Date.now() - row.created_at > TIMEOUT_MS) {
    db.prepare("UPDATE meshes SET status='failed', error='timeout' WHERE id=?").run(id);
    return NextResponse.json({ status: "failed", error: "timeout" });
  }

  if (!row.job_id) {
    return NextResponse.json({ status: "pending" });
  }

  const provider = new MeshyProvider();
  const poll = await provider.pollJob(row.job_id);

  if (poll.status === "pending") {
    return NextResponse.json({ status: "pending" });
  }

  if (poll.status === "failed") {
    db.prepare("UPDATE meshes SET status='failed', error=? WHERE id=? AND status='pending'").run(poll.error ?? "failed", id);
    return NextResponse.json({ status: "failed", error: poll.error });
  }

  // ready
  if (!poll.glbUrl) {
    db.prepare("UPDATE meshes SET status='failed', error='no glbUrl' WHERE id=?").run(id);
    return NextResponse.json({ status: "failed", error: "no glbUrl" });
  }
  const dl = await fetch(poll.glbUrl);
  if (!dl.ok) {
    db.prepare("UPDATE meshes SET status='failed', error=? WHERE id=?").run(`glb fetch ${dl.status}`, id);
    return NextResponse.json({ status: "failed", error: `glb fetch ${dl.status}` });
  }
  const bytes = Buffer.from(await dl.arrayBuffer());
  if (bytes.byteLength > MAX_GLB_BYTES) {
    db.prepare("UPDATE meshes SET status='failed', error='glb too large' WHERE id=?").run(id);
    return NextResponse.json({ status: "failed", error: "glb too large" });
  }
  const blobId = await writeBlob(db, dataDir(), bytes, "model/gltf-binary");
  db.prepare("UPDATE meshes SET status='ready', glb_blob_id=? WHERE id=? AND status='pending'").run(blobId, id);

  return NextResponse.json({ status: "ready", glb_url: `/api/blobs/${blobId}` });
}

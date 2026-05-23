import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/ids";
import { readBlob, dataDir } from "@/lib/storage";
import { MeshyProvider } from "@/lib/mesh/meshy";
import { MissingApiKeyError } from "@/lib/ai/index";

export const maxDuration = 60;

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const design = db.prepare("SELECT id, blob_id, status FROM designs WHERE id=?").get(id) as
    | { id: string; blob_id: string | null; status: string }
    | undefined;
  if (!design) return NextResponse.json({ error: "design not found" }, { status: 404 });
  if (design.status !== "ready" || !design.blob_id) return NextResponse.json({ error: "design not ready" }, { status: 400 });

  const meshId = newId();
  db.prepare("INSERT INTO meshes (id, design_id, status, created_at) VALUES (?,?,?,?)").run(meshId, id, "pending", Date.now());

  try {
    const provider = new MeshyProvider();
    const { bytes, mime } = await readBlob(db, dataDir(), design.blob_id);
    const { jobId } = await provider.startJob(bytes, mime);
    db.prepare("UPDATE meshes SET job_id=? WHERE id=?").run(jobId, meshId);
    return NextResponse.json({ mesh_id: meshId, status: "pending" });
  } catch (e) {
    const msg = (e as Error).message;
    db.prepare("UPDATE meshes SET status='failed', error=? WHERE id=?").run(msg, meshId);
    const status = e instanceof MissingApiKeyError ? 400 : 500;
    return NextResponse.json({ mesh_id: meshId, status: "failed", error: msg }, { status });
  }
}

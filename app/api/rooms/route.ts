import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/ids";
import { writeBlob, dataDir } from "@/lib/storage";
import { normalizeImage } from "@/lib/image";

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const projectId = form.get("project_id");
  const label = form.get("label");
  const file = form.get("file");
  if (typeof projectId !== "string" || typeof label !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "project_id, label, file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file too large" }, { status: 413 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "image required" }, { status: 400 });

  const db = getDb();
  const proj = db.prepare("SELECT id FROM projects WHERE id=?").get(projectId);
  if (!proj) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const raw = Buffer.from(await file.arrayBuffer());
  const { bytes, mime } = await normalizeImage(raw);
  const blobId = await writeBlob(db, dataDir(), bytes, mime);
  const id = newId();
  db.prepare("INSERT INTO rooms (id, project_id, label, source_blob_id, created_at) VALUES (?,?,?,?,?)")
    .run(id, projectId, label, blobId, Date.now());
  return NextResponse.json({ id, label, source_blob_id: blobId });
}

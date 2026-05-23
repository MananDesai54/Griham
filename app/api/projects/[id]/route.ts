import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id=?").get(id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  const rooms = db.prepare("SELECT id, label, source_blob_id, created_at FROM rooms WHERE project_id=? ORDER BY created_at").all(id);
  const designs = db.prepare(
    `SELECT d.id, d.room_id, d.blob_id, d.status, d.error, d.created_at
     FROM designs d JOIN rooms r ON r.id=d.room_id WHERE r.project_id=? ORDER BY d.created_at`
  ).all(id);
  return NextResponse.json({ project, rooms, designs });
}

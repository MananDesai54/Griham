import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { NextRequest } from "next/server";

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

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await _req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if (typeof body.style_brief === "string" || body.style_brief === null) {
    updates.style_brief = typeof body.style_brief === "string" ? body.style_brief.trim() || null : null;
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  const db = getDb();
  const project = db.prepare("SELECT id FROM projects WHERE id=?").get(id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  db.prepare("UPDATE projects SET style_brief=? WHERE id=?").run(updates.style_brief as string | null, id);
  return NextResponse.json({ id, style_brief: updates.style_brief });
}

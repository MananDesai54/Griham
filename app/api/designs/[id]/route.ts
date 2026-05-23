import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getDb().prepare("SELECT id, room_id, blob_id, status, error, created_at FROM designs WHERE id=?").get(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ design: row });
}

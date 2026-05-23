import { NextRequest, NextResponse } from "next/server";
import pLimit from "p-limit";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/ids";
import { writeBlob, readBlob, dataDir } from "@/lib/storage";
import { pickAnchorRoom, buildStylePrompt } from "@/lib/style";
import { getProvider, MissingApiKeyError } from "@/lib/ai/index";
import type { ProviderName, RoomInput } from "@/lib/ai/types";

export const maxDuration = 300;

type RoomRow = { id: string; label: string; source_blob_id: string; created_at: number };

async function loadRoomInput(db: ReturnType<typeof getDb>, base: string, row: RoomRow): Promise<RoomInput> {
  const { bytes, mime } = await readBlob(db, base, row.source_blob_id);
  return { label: row.label, bytes, mime };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const projectId: string | undefined = body?.project_id;
  if (!projectId) return NextResponse.json({ error: "project_id required" }, { status: 400 });

  const db = getDb();
  const base = dataDir();

  const project = db.prepare("SELECT id, provider, style_anchor_blob_id FROM projects WHERE id=?").get(projectId) as
    | { id: string; provider: ProviderName; style_anchor_blob_id: string | null }
    | undefined;
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  let provider;
  try { provider = getProvider(project.provider); }
  catch (e) {
    if (e instanceof MissingApiKeyError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  const rooms = db.prepare("SELECT id, label, source_blob_id, created_at FROM rooms WHERE project_id=? ORDER BY created_at").all(projectId) as RoomRow[];
  if (rooms.length === 0) return NextResponse.json({ error: "no rooms uploaded" }, { status: 400 });

  const stylePrompt = buildStylePrompt();
  let anchorBlobId = project.style_anchor_blob_id;

  if (!anchorBlobId) {
    const anchorRoomRow = pickAnchorRoom(rooms)!;
    const inputs = await Promise.all(rooms.map(r => loadRoomInput(db, base, r)));
    try {
      const out = await provider.generateAnchor(inputs, stylePrompt);
      const blobId = await writeBlob(db, base, out.anchor.bytes, out.anchor.mime);
      db.prepare("UPDATE projects SET style_anchor_blob_id=? WHERE id=?").run(blobId, projectId);
      anchorBlobId = blobId;
    } catch (e) {
      if (e instanceof MissingApiKeyError) return NextResponse.json({ error: e.message }, { status: 400 });
      return NextResponse.json({ error: `anchor generation failed: ${(e as Error).message}` }, { status: 500 });
    }
  }

  const anchorBlob = await readBlob(db, base, anchorBlobId);
  const limit = pLimit(2);
  const results: { room_id: string; status: string; error?: string }[] = [];

  const remaining = rooms.filter(r => {
    const ready = db.prepare("SELECT 1 FROM designs WHERE room_id=? AND status='ready' LIMIT 1").get(r.id);
    return !ready;
  });

  await Promise.all(remaining.map(r => limit(async () => {
    const designId = newId();
    db.prepare(
      "INSERT INTO designs (id, room_id, blob_id, prompt, status, created_at) VALUES (?,?,?,?,?,?)"
    ).run(designId, r.id, null, stylePrompt, "pending", Date.now());
    try {
      const input = await loadRoomInput(db, base, r);
      const out = await provider.generateRoom(anchorBlob, input, stylePrompt);
      const blobId = await writeBlob(db, base, out.bytes, out.mime);
      db.prepare("UPDATE designs SET blob_id=?, status='ready' WHERE id=?").run(blobId, designId);
      results.push({ room_id: r.id, status: "ready" });
    } catch (e) {
      const msg = (e as Error).message;
      db.prepare("UPDATE designs SET status='failed', error=? WHERE id=?").run(msg, designId);
      results.push({ room_id: r.id, status: "failed", error: msg });
    }
  })));

  return NextResponse.json({ project_id: projectId, anchor_blob_id: anchorBlobId, results });
}

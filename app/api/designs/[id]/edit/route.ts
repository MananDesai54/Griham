import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/ids";
import { writeBlob, readBlob, dataDir } from "@/lib/storage";
import { buildStylePrompt } from "@/lib/style";
import { getProvider, MissingApiKeyError } from "@/lib/ai/index";
import type { ProviderName } from "@/lib/ai/types";

export const maxDuration = 300;

const MAX_MASK_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await req.formData();
  const instruction = form.get("instruction");
  const maskFile = form.get("mask");
  if (typeof instruction !== "string" || instruction.trim().length === 0) {
    return NextResponse.json({ error: "instruction required" }, { status: 400 });
  }

  const db = getDb();
  const base = db.prepare("SELECT id, room_id, blob_id, status FROM designs WHERE id=?").get(id) as
    | { id: string; room_id: string; blob_id: string | null; status: string }
    | undefined;
  if (!base) return NextResponse.json({ error: "design not found" }, { status: 404 });
  if (base.status !== "ready" || !base.blob_id) return NextResponse.json({ error: "base design not ready" }, { status: 400 });

  const room = db.prepare("SELECT project_id FROM rooms WHERE id=?").get(base.room_id) as { project_id: string };
  const project = db.prepare("SELECT provider, style_brief FROM projects WHERE id=?").get(room.project_id) as { provider: ProviderName; style_brief: string | null };

  let provider;
  try { provider = getProvider(project.provider); }
  catch (e) {
    if (e instanceof MissingApiKeyError) return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    throw e;
  }

  let maskBuf: Buffer | null = null;
  let maskBlobId: string | null = null;
  if (maskFile instanceof File && maskFile.size > 0) {
    if (maskFile.size > MAX_MASK_BYTES) return NextResponse.json({ error: "mask too large" }, { status: 413 });
    maskBuf = Buffer.from(await maskFile.arrayBuffer());
    maskBlobId = await writeBlob(db, dataDir(), maskBuf, "image/png");
  }

  const baseImage = await readBlob(db, dataDir(), base.blob_id);

  const newDesignId = newId();
  const stylePrompt = buildStylePrompt(project.style_brief);
  db.prepare(
    "INSERT INTO designs (id, room_id, blob_id, prompt, parent_design_id, status, edit_instruction, mask_blob_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).run(newDesignId, base.room_id, null, stylePrompt, base.id, "pending", instruction, maskBlobId, Date.now());

  try {
    const out = await provider.editRoom(baseImage, maskBuf, instruction);
    const outBlobId = await writeBlob(db, dataDir(), out.bytes, out.mime);
    db.prepare("UPDATE designs SET blob_id=?, status='ready' WHERE id=?").run(outBlobId, newDesignId);
    return NextResponse.json({ design_id: newDesignId, status: "ready" });
  } catch (e) {
    const msg = (e as Error).message;
    db.prepare("UPDATE designs SET status='failed', error=? WHERE id=?").run(msg, newDesignId);
    return NextResponse.json({ design_id: newDesignId, status: "failed", error: msg }, { status: 500 });
  }
}

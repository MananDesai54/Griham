import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function GET() {
  const rows = getDb().prepare("SELECT id, name, provider, created_at FROM projects ORDER BY created_at DESC").all();
  return NextResponse.json({ projects: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name: string | undefined = body?.name;
  const provider: string = body?.provider ?? process.env.DEFAULT_PROVIDER ?? "gemini";
  if (!name || typeof name !== "string") return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!["gemini", "openai", "replicate"].includes(provider)) return NextResponse.json({ error: "invalid provider" }, { status: 400 });
  const id = newId();
  getDb().prepare("INSERT INTO projects (id, name, provider, created_at) VALUES (?,?,?,?)").run(id, name, provider, Date.now());
  return NextResponse.json({ id, name, provider });
}

import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { RoomUploader } from "@/components/RoomUploader";
import { GenerateButton } from "@/components/GenerateButton";
import { DesignGrid } from "@/components/DesignGrid";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const project = db.prepare("SELECT id, name, provider FROM projects WHERE id=?").get(id) as any;
  if (!project) notFound();
  const rooms = db.prepare("SELECT id, label, source_blob_id FROM rooms WHERE project_id=? ORDER BY created_at").all(id) as any[];
  const designs = db.prepare(
    `SELECT d.id, d.room_id, d.blob_id, d.status, d.error, d.parent_design_id
     FROM designs d JOIN rooms r ON r.id=d.room_id WHERE r.project_id=? ORDER BY d.created_at`
  ).all(id) as any[];

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1>{project.name} <span style={{ fontSize: 14, color: "#888" }}>({project.provider})</span></h1>
      <section style={{ margin: "16px 0" }}><RoomUploader projectId={id} /></section>
      <section style={{ margin: "16px 0" }}><GenerateButton projectId={id} /></section>
      <section><DesignGrid rooms={rooms} designs={designs} /></section>
    </main>
  );
}

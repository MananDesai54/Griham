import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { RoomUploader } from "@/components/RoomUploader";
import { GenerateButton } from "@/components/GenerateButton";
import { DesignGrid } from "@/components/DesignGrid";
import { StyleBriefCard } from "@/components/StyleBriefCard";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const project = db
    .prepare("SELECT id, name, provider, style_brief FROM projects WHERE id=?")
    .get(id) as any;
  if (!project) notFound();

  const rooms = db
    .prepare(
      "SELECT id, label, source_blob_id FROM rooms WHERE project_id=? ORDER BY created_at"
    )
    .all(id) as any[];

  const designs = db
    .prepare(
      `SELECT d.id, d.room_id, d.blob_id, d.status, d.error, d.parent_design_id
       FROM designs d JOIN rooms r ON r.id=d.room_id WHERE r.project_id=? ORDER BY d.created_at`
    )
    .all(id) as any[];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Top bar */}
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] transition-colors mb-4 inline-block"
        >
          ← Back to projects
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-[var(--color-foreground)]">
            {project.name}
          </h1>
          <Badge>{project.provider}</Badge>
        </div>
      </div>

      {/* Style brief */}
      <section className="mb-6">
        <h2 className="font-serif text-xl font-semibold mb-3 text-[var(--color-foreground)]">
          Style brief
        </h2>
        <StyleBriefCard projectId={id} initial={project.style_brief ?? null} />
      </section>

      {/* Add a room */}
      <section className="mb-6">
        <h2 className="font-serif text-xl font-semibold mb-3 text-[var(--color-foreground)]">
          Add a room
        </h2>
        <RoomUploader projectId={id} />
      </section>

      {/* Generate */}
      <section className="mb-6">
        <h2 className="font-serif text-xl font-semibold mb-3 text-[var(--color-foreground)]">
          Generate
        </h2>
        <GenerateButton projectId={id} />
      </section>

      {/* Designs */}
      <section>
        <h2 className="font-serif text-xl font-semibold mb-4 text-[var(--color-foreground)]">
          Designs
        </h2>
        <DesignGrid rooms={rooms} designs={designs} />
      </section>
    </div>
  );
}

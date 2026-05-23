import { ProjectList } from "@/components/ProjectList";
import { ProjectCreateForm } from "@/components/ProjectCreateForm";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Home() {
  const projects = getDb()
    .prepare("SELECT id, name, provider, created_at FROM projects ORDER BY created_at DESC")
    .all() as any[];

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="font-serif text-5xl font-semibold tracking-tight text-[var(--color-foreground)] mb-2">
            Griham
          </h1>
          <p className="text-[var(--color-muted-foreground)] text-base">
            AI home decor for your rooms.
          </p>
        </div>

        <section className="mb-8">
          <ProjectCreateForm />
        </section>

        <section>
          <ProjectList projects={projects} />
        </section>
      </div>
    </main>
  );
}

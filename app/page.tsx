import { ProjectList } from "@/components/ProjectList";
import { ProjectCreateForm } from "@/components/ProjectCreateForm";
import { getDb } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function Home() {
  const projects = getDb()
    .prepare("SELECT id, name, provider, created_at FROM projects ORDER BY created_at DESC")
    .all() as any[];

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-16">
          <h1 className="font-serif text-5xl sm:text-6xl font-semibold tracking-tight">
            Design every room.{" "}
            <span className="text-[var(--color-primary)]">Together.</span>
          </h1>
          <p className="mt-4 text-lg text-[var(--color-muted-foreground)] max-w-xl mx-auto">
            Upload photos of your rooms. Get a redesigned home with one coherent
            style across every space.
          </p>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="font-serif text-xl">
              Create your first project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectCreateForm embedded />
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-[var(--color-muted-foreground)]">
          Tip: give your project a descriptive name like "Modern minimalist home"
          to guide the AI style.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-serif text-4xl font-semibold tracking-tight mb-8">
        Your projects
      </h1>

      <section className="mb-8">
        <ProjectCreateForm />
      </section>

      <section>
        <ProjectList projects={projects} />
      </section>
    </div>
  );
}

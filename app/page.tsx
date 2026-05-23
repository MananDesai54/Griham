import { ProjectList } from "@/components/ProjectList";
import { ProjectCreateForm } from "@/components/ProjectCreateForm";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Home() {
  const projects = getDb().prepare("SELECT id, name, provider, created_at FROM projects ORDER BY created_at DESC").all() as any[];
  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h1>Griham</h1>
      <section style={{ margin: "16px 0" }}><ProjectCreateForm /></section>
      <section><ProjectList projects={projects} /></section>
    </main>
  );
}

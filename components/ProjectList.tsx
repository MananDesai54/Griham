"use client";
import Link from "next/link";

type Project = { id: string; name: string; provider: string; created_at: number };

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) return <p>No projects yet.</p>;
  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {projects.map(p => (
        <li key={p.id} style={{ padding: 8, borderBottom: "1px solid #eee" }}>
          <Link href={`/project/${p.id}`}>{p.name}</Link>
          <span style={{ marginLeft: 8, color: "#888" }}>({p.provider})</span>
        </li>
      ))}
    </ul>
  );
}

"use client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Project = { id: string; name: string; provider: string; created_at: number };

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <p className="text-center text-[var(--color-muted-foreground)] py-8">
        No projects yet. Create one above to get started.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="font-serif text-lg font-semibold text-[var(--color-foreground)] mb-4">
        Your projects
      </h2>
      {projects.map((p) => (
        <Link key={p.id} href={`/project/${p.id}`} className="block group">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="p-4 flex items-center justify-between">
              <span className="font-medium text-[var(--color-foreground)] group-hover:text-[var(--color-primary)] transition-colors">
                {p.name}
              </span>
              <Badge>{p.provider}</Badge>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

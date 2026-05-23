"use client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Project = { id: string; name: string; provider: string; created_at: number };

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {projects.map((p) => (
        <Link key={p.id} href={`/project/${p.id}`} className="block group">
          <Card className="transition-all duration-200 hover:shadow-md hover:border-[var(--color-ring)]">
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

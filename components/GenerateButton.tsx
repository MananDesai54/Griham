"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function GenerateButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/designs/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "failed");
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <Button onClick={go} disabled={busy}>
            {busy ? "Generating…" : "Generate designs"}
          </Button>
          {err && (
            <p className="text-sm text-[var(--color-destructive)]">{err}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

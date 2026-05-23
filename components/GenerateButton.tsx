"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function GenerateButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const res = await fetch("/api/designs/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });
      if (res.ok) {
        toast.success("Generation started");
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(`Generation failed: ${j.error ?? "unknown error"}`);
      }
    } catch {
      toast.error("Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <Button onClick={go} disabled={busy}>
            {busy ? "Generating…" : "Generate designs"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

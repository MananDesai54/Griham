"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function StyleBriefCard({ projectId, initial }: { projectId: string; initial: string | null }) {
  const router = useRouter();
  const [brief, setBrief] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ style_brief: brief }),
      });
      if (res.ok) {
        toast.success("Style brief updated");
        router.refresh();
      } else {
        toast.error("Failed to save brief");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Style brief</CardTitle>
        <CardDescription>
          One-line vision for the whole home. Drives the anchor + every room.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="e.g. modern minimalist with warm woods, soft natural light, sage greens, mid-century furniture"
          rows={3}
        />
        <div className="flex justify-end">
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save brief"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

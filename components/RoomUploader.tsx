"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RoomUploader({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !label) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("project_id", projectId);
    fd.set("label", label);
    fd.set("file", file);
    const res = await fetch("/api/rooms", { method: "POST", body: fd });
    setBusy(false);
    if (res.ok) {
      setLabel("");
      setFile(null);
      router.refresh();
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1">
              Room label
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. living room"
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1">
              Photo
            </label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
              className="cursor-pointer"
            />
          </div>
          <Button type="submit" disabled={busy || !file || !label}>
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

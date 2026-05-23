"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
    if (res.ok) { setLabel(""); setFile(null); router.refresh(); }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Room label (e.g. living room)" required />
      <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} required />
      <button disabled={busy || !file || !label}>Upload</button>
    </form>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/designs/generate", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error ?? "failed"); return; }
    router.refresh();
  }

  return (
    <div>
      <button onClick={go} disabled={busy}>{busy ? "Generating…" : "Generate designs"}</button>
      {err && <p style={{ color: "red" }}>{err}</p>}
    </div>
  );
}

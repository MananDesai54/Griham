"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MaskCanvas, type MaskCanvasHandle } from "./MaskCanvas";

export function DesignEditor({ designId, src, onClose }: { designId: string; src: string; onClose: () => void }) {
  const router = useRouter();
  const canvasRef = useRef<MaskCanvasHandle>(null);
  const [instruction, setInstruction] = useState("");
  const [brush, setBrush] = useState(20);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function apply() {
    if (!instruction.trim()) { setErr("instruction required"); return; }
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("instruction", instruction);
    const mask = await canvasRef.current?.exportMask();
    if (mask) fd.set("mask", mask, "mask.png");
    const res = await fetch(`/api/designs/${designId}/edit`, { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error ?? "failed"); return; }
    onClose();
    router.refresh();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ background: "white", padding: 16, borderRadius: 8, maxWidth: 800, width: "90%" }}>
        <MaskCanvas ref={canvasRef} src={src} brushSize={brush} />
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
          <label>Brush: {brush}</label>
          <input type="range" min={4} max={80} value={brush} onChange={e => setBrush(Number(e.target.value))} />
          <button onClick={() => canvasRef.current?.clear()}>Clear mask</button>
        </div>
        <textarea
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          placeholder="e.g. replace sofa with green velvet"
          rows={3}
          style={{ width: "100%", marginTop: 8 }}
        />
        {err && <p style={{ color: "red" }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} disabled={busy}>Cancel</button>
          <button onClick={apply} disabled={busy || !instruction.trim()}>{busy ? "Applying…" : "Apply edit"}</button>
        </div>
      </div>
    </div>
  );
}

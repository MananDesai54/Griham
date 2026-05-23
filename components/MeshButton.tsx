"use client";
import { useEffect, useRef, useState } from "react";

type State =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "pending"; meshId: string }
  | { kind: "ready"; glbUrl: string }
  | { kind: "failed"; error: string };

export function MeshButton({ designId, onView }: { designId: string; onView: (glbUrl: string) => void }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  async function start() {
    setState({ kind: "starting" });
    const res = await fetch(`/api/designs/${designId}/mesh`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setState({ kind: "failed", error: body.error ?? "failed" }); return; }
    setState({ kind: "pending", meshId: body.mesh_id });
    schedulePoll(body.mesh_id);
  }

  function schedulePoll(meshId: string) {
    timerRef.current = setTimeout(() => poll(meshId), 5000);
  }

  async function poll(meshId: string) {
    const res = await fetch(`/api/meshes/${meshId}`);
    const body = await res.json().catch(() => ({}));
    if (body.status === "ready" && body.glb_url) {
      setState({ kind: "ready", glbUrl: body.glb_url });
      return;
    }
    if (body.status === "failed") {
      setState({ kind: "failed", error: body.error ?? "failed" });
      return;
    }
    schedulePoll(meshId);
  }

  if (state.kind === "idle") return <button onClick={start}>Generate 3D</button>;
  if (state.kind === "starting") return <span>Starting…</span>;
  if (state.kind === "pending") return <span>Building mesh…</span>;
  if (state.kind === "ready") return <button onClick={() => onView(state.glbUrl)}>View 3D</button>;
  return (
    <span>
      <span style={{ color: "red" }}>failed: {state.error}</span>{" "}
      <button onClick={start}>Retry</button>
    </span>
  );
}

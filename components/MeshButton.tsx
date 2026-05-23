"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader, Box, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type State =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "pending"; meshId: string }
  | { kind: "ready"; glbUrl: string }
  | { kind: "failed"; error: string };

export function MeshButton({
  designId,
  onView,
}: {
  designId: string;
  onView: (glbUrl: string) => void;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  async function start() {
    setState({ kind: "starting" });
    const res = await fetch(`/api/designs/${designId}/mesh`, {
      method: "POST",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = body.error ?? "failed";
      setState({ kind: "failed", error: errMsg });
      toast.error(`3D failed: ${errMsg}`);
      return;
    }
    toast.success("3D generation started");
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
      const errMsg = body.error ?? "failed";
      setState({ kind: "failed", error: errMsg });
      toast.error(`3D failed: ${errMsg}`);
      return;
    }
    schedulePoll(meshId);
  }

  if (state.kind === "idle") {
    return (
      <Button variant="outline" size="sm" onClick={start}>
        <Box className="h-3.5 w-3.5" />
        Generate 3D
      </Button>
    );
  }

  if (state.kind === "starting" || state.kind === "pending") {
    return (
      <Badge variant="warning" className="flex items-center gap-1.5 py-1 px-2.5">
        <Loader className="h-3 w-3 animate-spin" />
        {state.kind === "starting" ? "Starting…" : "Building mesh…"}
      </Badge>
    );
  }

  if (state.kind === "ready") {
    return (
      <Button variant="outline" size="sm" onClick={() => onView(state.glbUrl)}>
        <Box className="h-3.5 w-3.5" />
        View 3D
      </Button>
    );
  }

  // failed
  return (
    <div className="flex items-center gap-2">
      <Badge variant="error" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        {state.error}
      </Badge>
      <Button variant="ghost" size="sm" onClick={start}>
        Retry
      </Button>
    </div>
  );
}

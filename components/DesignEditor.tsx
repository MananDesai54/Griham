"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MaskCanvas, type MaskCanvasHandle } from "./MaskCanvas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";

export function DesignEditor({
  designId,
  src,
  onClose,
}: {
  designId: string;
  src: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const canvasRef = useRef<MaskCanvasHandle>(null);
  const [instruction, setInstruction] = useState("");
  const [brush, setBrush] = useState(20);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function apply() {
    if (!instruction.trim()) {
      setErr("instruction required");
      return;
    }
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set("instruction", instruction);
    const mask = await canvasRef.current?.exportMask();
    if (mask) fd.set("mask", mask, "mask.png");
    const res = await fetch(`/api/designs/${designId}/edit`, {
      method: "POST",
      body: fd,
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "failed");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl w-[92vw]">
        <DialogHeader>
          <DialogTitle>Edit design</DialogTitle>
          <DialogDescription>
            Paint the area you want to change, then describe the edit.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md overflow-hidden border">
          <MaskCanvas ref={canvasRef} src={src} brushSize={brush} />
        </div>

        <div className="flex items-center gap-4 mt-4">
          <span className="text-sm text-[var(--color-muted-foreground)] whitespace-nowrap">
            Brush: {brush}px
          </span>
          <Slider
            min={4}
            max={80}
            step={1}
            value={[brush]}
            onValueChange={([v]) => setBrush(v)}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => canvasRef.current?.clear()}
          >
            Clear mask
          </Button>
        </div>

        <Textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. replace sofa with green velvet"
          rows={3}
          className="mt-3"
        />

        {err && (
          <p className="text-sm text-[var(--color-destructive)] mt-2">{err}</p>
        )}

        <div className="flex gap-3 justify-end mt-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={apply}
            disabled={busy || !instruction.trim()}
          >
            {busy ? "Applying…" : "Apply edit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

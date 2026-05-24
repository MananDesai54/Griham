"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UploadCloud, X, ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Pending = {
  id: string;
  file: File;
  preview: string;
  label: string;
  hint: string;
  status: "queued" | "uploading" | "done" | "failed";
  error?: string;
};

const SUGGESTED = ["living room", "bedroom", "kitchen", "bathroom", "dining", "study", "parking"];

function suggestLabel(filename: string, existing: string[]): string {
  const base = filename.toLowerCase().replace(/[_\-.]/g, " ");
  const hit = SUGGESTED.find(s => base.includes(s));
  if (hit && !existing.includes(hit)) return hit;
  const free = SUGGESTED.find(s => !existing.includes(s));
  return free ?? "";
}

export function RoomUploader({ projectId }: { projectId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  function addFiles(files: FileList | File[]) {
    const existing = items.map(i => i.label);
    const next: Pending[] = [];
    Array.from(files).forEach((file, i) => {
      if (!file.type.startsWith("image/")) return;
      next.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        preview: URL.createObjectURL(file),
        label: suggestLabel(file.name, [...existing, ...next.map(n => n.label)]),
        hint: "",
        status: "queued",
      });
    });
    setItems(prev => [...prev, ...next]);
  }

  function removeItem(id: string) {
    setItems(prev => {
      const x = prev.find(p => p.id === id);
      if (x) URL.revokeObjectURL(x.preview);
      return prev.filter(p => p.id !== id);
    });
  }

  function updateLabel(id: string, label: string) {
    setItems(prev => prev.map(p => (p.id === id ? { ...p, label } : p)));
  }

  function updateHint(id: string, hint: string) {
    setItems(prev => prev.map(p => (p.id === id ? { ...p, hint } : p)));
  }

  async function uploadAll() {
    const queued = items.filter(i => i.status === "queued" && i.label.trim());
    if (queued.length === 0) {
      toast.error("Add a label to each room first.");
      return;
    }
    setUploading(true);
    let okCount = 0;
    for (const item of queued) {
      setItems(prev => prev.map(p => (p.id === item.id ? { ...p, status: "uploading" } : p)));
      const fd = new FormData();
      fd.set("project_id", projectId);
      fd.set("label", item.label.trim());
      fd.set("file", item.file);
      fd.set("hint", item.hint || "");
      try {
        const res = await fetch("/api/rooms", { method: "POST", body: fd });
        if (res.ok) {
          setItems(prev => prev.map(p => (p.id === item.id ? { ...p, status: "done" } : p)));
          okCount += 1;
        } else {
          const j = await res.json().catch(() => ({}));
          setItems(prev =>
            prev.map(p => (p.id === item.id ? { ...p, status: "failed", error: j.error ?? "failed" } : p))
          );
        }
      } catch (e) {
        setItems(prev =>
          prev.map(p =>
            p.id === item.id ? { ...p, status: "failed", error: (e as Error).message } : p
          )
        );
      }
    }
    setUploading(false);
    if (okCount > 0) {
      toast.success(`Uploaded ${okCount} room${okCount > 1 ? "s" : ""}`);
      // Clean up done items
      setItems(prev => {
        prev.filter(p => p.status === "done").forEach(p => URL.revokeObjectURL(p.preview));
        return prev.filter(p => p.status !== "done");
      });
      router.refresh();
    }
    const failed = items.filter(i => i.status === "failed").length;
    if (failed > 0) toast.error(`${failed} upload${failed > 1 ? "s" : ""} failed`);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors text-center",
            dragging ? "border-[var(--color-primary)] bg-[var(--color-accent)]" : "border-[var(--color-border)] hover:bg-[var(--color-accent)]"
          )}
        >
          <UploadCloud className="h-8 w-8 text-[var(--color-muted-foreground)] mb-2" />
          <p className="text-sm font-medium">Drop room photos here</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">or click to browse — pick multiple at once</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {items.length > 0 && (
          <div className="mt-4 space-y-2">
            {items.map(item => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-md border bg-[var(--color-card)] p-2"
              >
                <img
                  src={item.preview}
                  alt={item.label || "room"}
                  className="h-14 w-14 rounded object-cover flex-shrink-0"
                />
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <Input
                    value={item.label}
                    onChange={e => updateLabel(item.id, e.target.value)}
                    placeholder="Room label"
                    disabled={item.status === "uploading" || item.status === "done"}
                    className="w-full"
                  />
                  <Input
                    value={item.hint}
                    onChange={e => updateHint(item.id, e.target.value)}
                    placeholder="Optional hint (e.g. add plants)"
                    disabled={item.status === "uploading" || item.status === "done"}
                    className="w-full text-xs"
                  />
                </div>
                <div className="flex items-center gap-2 w-28 justify-end text-xs flex-shrink-0">
                  {item.status === "queued" && <span className="text-[var(--color-muted-foreground)]">queued</span>}
                  {item.status === "uploading" && (
                    <span className="inline-flex items-center gap-1 text-[var(--color-muted-foreground)]">
                      <Loader2 className="h-3 w-3 animate-spin" /> uploading
                    </span>
                  )}
                  {item.status === "done" && <span className="text-emerald-700">done</span>}
                  {item.status === "failed" && (
                    <span className="text-red-700" title={item.error}>failed</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(item.id)}
                  disabled={item.status === "uploading"}
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  items.forEach(i => URL.revokeObjectURL(i.preview));
                  setItems([]);
                }}
                disabled={uploading}
              >
                Clear
              </Button>
              <Button onClick={uploadAll} disabled={uploading || items.every(i => !i.label.trim())}>
                {uploading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                ) : (
                  <><ImagePlus className="h-4 w-4" /> Upload {items.filter(i => i.status === "queued").length} rooms</>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

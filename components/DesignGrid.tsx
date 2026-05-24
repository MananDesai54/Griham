"use client";
import { useMemo, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { DesignEditor } from "./DesignEditor";
import { MeshButton } from "./MeshButton";
import { MeshViewer } from "./MeshViewer";
import { CompareSlider } from "./CompareSlider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Room = { id: string; label: string; source_blob_id: string };
type Design = {
  id: string;
  room_id: string;
  blob_id: string | null;
  status: "pending" | "ready" | "failed";
  error: string | null;
  parent_design_id: string | null;
};

function chainFor(roomId: string, designs: Design[]): Design[] {
  const forRoom = designs.filter((d) => d.room_id === roomId);
  if (forRoom.length === 0) return [];
  const childOf = new Map<string | null, Design[]>();
  for (const d of forRoom) {
    const arr = childOf.get(d.parent_design_id) ?? [];
    arr.push(d);
    childOf.set(d.parent_design_id, arr);
  }
  let node = (childOf.get(null) ?? [])[0];
  if (!node) {
    return [...forRoom].sort((a, b) => a.id.localeCompare(b.id));
  }
  const chain = [node];
  while (true) {
    const kids = childOf.get(node.id) ?? [];
    const next = kids.sort((a, b) => a.id.localeCompare(b.id)).at(-1);
    if (!next) break;
    chain.push(next);
    node = next;
  }
  return chain;
}

export function DesignGrid({
  rooms,
  designs,
}: {
  rooms: Room[];
  designs: Design[];
}) {
  const [editing, setEditing] = useState<{ id: string; src: string } | null>(
    null
  );
  const [viewing, setViewing] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<{ blobId: string; label: string } | null>(null);
  const chains = useMemo(() => {
    const m = new Map<string, Design[]>();
    for (const r of rooms) m.set(r.id, chainFor(r.id, designs));
    return m;
  }, [rooms, designs]);
  const [idxByRoom, setIdxByRoom] = useState<Record<string, number>>({});

  if (rooms.length === 0) {
    return (
      <p className="text-[var(--color-muted-foreground)] text-sm">
        No rooms yet. Upload a room photo above to get started.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {rooms.map((r) => {
          const chain = chains.get(r.id) ?? [];
          const idx = Math.min(
            idxByRoom[r.id] ?? chain.length - 1,
            chain.length - 1
          );
          const current = chain[idx];
          const sourceUrl = `/api/blobs/${r.source_blob_id}`;

          return (
            <Card
              key={r.id}
              className="overflow-hidden transition-colors hover:border-[var(--color-ring)]"
            >
              <CardContent className="p-4">
                <div className="font-serif font-semibold text-lg mb-3 text-[var(--color-foreground)]">
                  {r.label}
                </div>

                {/* Image area — full-width slider when ready, source-only otherwise */}
                {current?.status === "ready" && current.blob_id ? (
                  <div
                    className="cursor-zoom-in"
                    onClick={() =>
                      setZoomed({ blobId: current.blob_id!, label: r.label })
                    }
                  >
                    <CompareSlider
                      beforeSrc={sourceUrl}
                      afterSrc={`/api/blobs/${current.blob_id}`}
                      beforeLabel="Before"
                      afterLabel="After"
                    />
                  </div>
                ) : (
                  <div className="relative w-full rounded-md overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
                    <img
                      src={sourceUrl}
                      alt={r.label}
                      className="w-full h-full object-cover"
                    />
                    {current?.status === "pending" && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Badge
                          variant="warning"
                          className="flex items-center gap-1.5 animate-pulse"
                        >
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Generating…
                        </Badge>
                      </div>
                    )}
                    {current?.status === "failed" && (
                      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1 px-2">
                        <Badge
                          variant="error"
                          className="flex items-center gap-1"
                        >
                          <AlertCircle className="h-3 w-3" />
                          Failed
                        </Badge>
                        {current.error && (
                          <p className="text-xs text-white text-center line-clamp-2">
                            {current.error}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {chain.length > 1 && (
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 text-xs"
                      disabled={idx === 0}
                      onClick={() =>
                        setIdxByRoom((s) => ({ ...s, [r.id]: idx - 1 }))
                      }
                    >
                      ←
                    </Button>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      v{idx + 1} of {chain.length}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 text-xs"
                      disabled={idx === chain.length - 1}
                      onClick={() =>
                        setIdxByRoom((s) => ({ ...s, [r.id]: idx + 1 }))
                      }
                    >
                      →
                    </Button>
                  </div>
                )}

                {current?.status === "ready" && current.blob_id && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditing({
                          id: current.id,
                          src: `/api/blobs/${current.blob_id}`,
                        })
                      }
                    >
                      Edit
                    </Button>
                    <MeshButton
                      designId={current.id}
                      onView={(url) => setViewing(url)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editing && (
        <DesignEditor
          designId={editing.id}
          src={editing.src}
          onClose={() => setEditing(null)}
        />
      )}
      {viewing && (
        <MeshViewer glbUrl={viewing} onClose={() => setViewing(null)} />
      )}

      <Dialog open={!!zoomed} onOpenChange={(open) => { if (!open) setZoomed(null); }}>
        <DialogContent className="max-w-4xl p-4">
          {zoomed && (
            <>
              <div className="font-serif font-semibold text-lg mb-3">{zoomed.label}</div>
              <img
                src={`/api/blobs/${zoomed.blobId}`}
                alt={zoomed.label}
                className="w-full rounded-md object-contain max-h-[80vh]"
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

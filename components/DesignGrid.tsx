"use client";
import { useMemo, useState } from "react";
import { DesignEditor } from "./DesignEditor";
import { MeshButton } from "./MeshButton";
import { MeshViewer } from "./MeshViewer";

type Room = { id: string; label: string; source_blob_id: string };
type Design = { id: string; room_id: string; blob_id: string | null; status: "pending" | "ready" | "failed"; error: string | null; parent_design_id: string | null };

function chainFor(roomId: string, designs: Design[]): Design[] {
  const forRoom = designs.filter(d => d.room_id === roomId);
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

export function DesignGrid({ rooms, designs }: { rooms: Room[]; designs: Design[] }) {
  const [editing, setEditing] = useState<{ id: string; src: string } | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const chains = useMemo(() => {
    const m = new Map<string, Design[]>();
    for (const r of rooms) m.set(r.id, chainFor(r.id, designs));
    return m;
  }, [rooms, designs]);
  const [idxByRoom, setIdxByRoom] = useState<Record<string, number>>({});

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 16 }}>
        {rooms.map(r => {
          const chain = chains.get(r.id) ?? [];
          const idx = Math.min(idxByRoom[r.id] ?? chain.length - 1, chain.length - 1);
          const current = chain[idx];
          return (
            <div key={r.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{r.label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#666" }}>Source</div>
                  <img src={`/api/blobs/${r.source_blob_id}`} alt={r.label} style={{ width: "100%", borderRadius: 4 }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#666" }}>Design</div>
                  {!current && <div style={{ color: "#888" }}>—</div>}
                  {current?.status === "ready" && current.blob_id && <img src={`/api/blobs/${current.blob_id}`} alt="design" style={{ width: "100%", borderRadius: 4 }} />}
                  {current?.status === "pending" && <div>pending…</div>}
                  {current?.status === "failed" && <div style={{ color: "red" }}>failed: {current.error}</div>}
                </div>
              </div>
              {chain.length > 1 && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, fontSize: 12 }}>
                  <button disabled={idx === 0} onClick={() => setIdxByRoom(s => ({ ...s, [r.id]: idx - 1 }))}>←</button>
                  <span>v{idx + 1} of {chain.length}</span>
                  <button disabled={idx === chain.length - 1} onClick={() => setIdxByRoom(s => ({ ...s, [r.id]: idx + 1 }))}>→</button>
                </div>
              )}
              {current?.status === "ready" && current.blob_id && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => setEditing({ id: current.id, src: `/api/blobs/${current.blob_id}` })}>Edit</button>
                  <MeshButton designId={current.id} onView={url => setViewing(url)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {editing && <DesignEditor designId={editing.id} src={editing.src} onClose={() => setEditing(null)} />}
      {viewing && <MeshViewer glbUrl={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

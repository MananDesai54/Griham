"use client";

type Room = { id: string; label: string; source_blob_id: string };
type Design = { id: string; room_id: string; blob_id: string | null; status: "pending" | "ready" | "failed"; error: string | null };

export function DesignGrid({ rooms, designs }: { rooms: Room[]; designs: Design[] }) {
  const byRoom = new Map<string, Design[]>();
  for (const d of designs) {
    const arr = byRoom.get(d.room_id) ?? [];
    arr.push(d);
    byRoom.set(d.room_id, arr);
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 16 }}>
      {rooms.map(r => {
        const latest = (byRoom.get(r.id) ?? []).sort((a, b) => b.id.localeCompare(a.id))[0];
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
                {!latest && <div style={{ color: "#888" }}>—</div>}
                {latest?.status === "ready" && latest.blob_id && <img src={`/api/blobs/${latest.blob_id}`} alt="design" style={{ width: "100%", borderRadius: 4 }} />}
                {latest?.status === "pending" && <div>pending…</div>}
                {latest?.status === "failed" && <div style={{ color: "red" }}>failed: {latest.error}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

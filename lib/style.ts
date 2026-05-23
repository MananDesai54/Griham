export type RoomLike = { id: string; label: string; created_at: number };

export function pickAnchorRoom<T extends RoomLike>(rooms: T[]): T | null {
  if (rooms.length === 0) return null;
  const living = rooms.find(r => r.label.toLowerCase().includes("living"));
  if (living) return living;
  return [...rooms].sort((a, b) => a.created_at - b.created_at)[0];
}

export function pickAnchorRoomByLabel<T extends { label: string }>(rooms: T[]): T | null {
  if (rooms.length === 0) return null;
  return rooms.find(r => r.label.toLowerCase().includes("living")) ?? rooms[0];
}

export function buildStylePrompt(): string {
  return (
    "Redesign with a modern, warm, cohesive interior design. " +
    "Use a consistent color palette and material set across all rooms. " +
    "Preserve the room geometry: walls, windows, doors, ceilings must stay in place. " +
    "Replace furniture, surfaces, lighting, and decor with a cohesive design."
  );
}

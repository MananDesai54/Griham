import { describe, it, expect } from "vitest";
import { pickAnchorRoom, buildStylePrompt } from "../lib/style";

type Room = { id: string; label: string; created_at: number };

describe("style", () => {
  it("prefers a room with 'living' in label", () => {
    const rooms: Room[] = [
      { id: "a", label: "parking", created_at: 1 },
      { id: "b", label: "Living Room", created_at: 2 },
      { id: "c", label: "kitchen", created_at: 3 },
    ];
    expect(pickAnchorRoom(rooms)!.id).toBe("b");
  });

  it("falls back to earliest created_at when no living room", () => {
    const rooms: Room[] = [
      { id: "a", label: "kitchen", created_at: 5 },
      { id: "b", label: "parking", created_at: 2 },
      { id: "c", label: "bedroom", created_at: 9 },
    ];
    expect(pickAnchorRoom(rooms)!.id).toBe("b");
  });

  it("returns null on empty list", () => {
    expect(pickAnchorRoom([])).toBeNull();
  });

  it("buildStylePrompt mentions consistency and preserves geometry", () => {
    const p = buildStylePrompt();
    expect(p.toLowerCase()).toContain("consistent");
    expect(p.toLowerCase()).toContain("geometry");
  });
});

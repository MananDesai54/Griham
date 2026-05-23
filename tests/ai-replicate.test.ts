import { describe, it, expect, vi } from "vitest";

const run = vi.fn();
vi.mock("replicate", () => ({
  default: vi.fn().mockImplementation(() => ({ run })),
}));

// Provider downloads the returned URL; stub global fetch.
global.fetch = vi.fn(async () => ({
  ok: true,
  arrayBuffer: async () => new Uint8Array(Buffer.from("rep-bytes")).buffer,
  headers: new Headers({ "content-type": "image/png" }),
})) as any;

import { ReplicateProvider } from "../lib/ai/replicate";

describe("ReplicateProvider", () => {
  it("generateAnchor returns image bytes from URL", async () => {
    process.env.REPLICATE_API_TOKEN = "test";
    run.mockResolvedValueOnce(["https://cdn.example/img.png"]);
    const p = new ReplicateProvider();
    const out = await p.generateAnchor(
      [{ label: "living room", bytes: Buffer.from("a"), mime: "image/jpeg" }],
      "style"
    );
    expect(out.anchor.bytes.toString()).toBe("rep-bytes");
    expect(out.anchorRoomLabel).toBe("living room");
  });

  it("generateRoom passes anchor as IP-Adapter conditioning", async () => {
    process.env.REPLICATE_API_TOKEN = "test";
    run.mockResolvedValueOnce(["https://cdn.example/k.png"]);
    const p = new ReplicateProvider();
    const out = await p.generateRoom(
      { bytes: Buffer.from("anc"), mime: "image/png" },
      { label: "kitchen", bytes: Buffer.from("k"), mime: "image/jpeg" },
      "style"
    );
    expect(out.bytes.toString()).toBe("rep-bytes");
    const args = run.mock.calls[0][1];
    expect(args.input.ip_adapter_image).toBeDefined();
  });

  it("throws on missing token", async () => {
    delete process.env.REPLICATE_API_TOKEN;
    const p = new ReplicateProvider();
    await expect(p.generateAnchor([], "x")).rejects.toThrow(/REPLICATE_API_TOKEN/);
  });
});

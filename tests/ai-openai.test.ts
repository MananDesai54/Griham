import { describe, it, expect, vi } from "vitest";

const editsCreate = vi.fn();
const imagesGenerate = vi.fn();
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    images: { generate: imagesGenerate, edit: editsCreate },
  })),
  toFile: vi.fn(async (data: any, name: string, opts: any) => ({ data, name, ...opts })),
}));

import { OpenAIProvider } from "../lib/ai/openai";

describe("OpenAIProvider", () => {
  it("generateAnchor calls images.edit with room photos and returns bytes", async () => {
    process.env.OPENAI_API_KEY = "test";
    editsCreate.mockResolvedValueOnce({ data: [{ b64_json: Buffer.from("anchor").toString("base64") }] });
    const p = new OpenAIProvider();
    const rooms = [{ label: "living room", bytes: Buffer.from("a"), mime: "image/jpeg" }];
    const out = await p.generateAnchor(rooms, "style");
    expect(out.anchor.bytes.toString()).toBe("anchor");
    expect(out.anchorRoomLabel).toBe("living room");
    expect(editsCreate).toHaveBeenCalled();
  });

  it("generateRoom calls images.edit with anchor + room", async () => {
    process.env.OPENAI_API_KEY = "test";
    editsCreate.mockResolvedValueOnce({ data: [{ b64_json: Buffer.from("kitchen").toString("base64") }] });
    const p = new OpenAIProvider();
    const out = await p.generateRoom(
      { bytes: Buffer.from("anc"), mime: "image/png" },
      { label: "kitchen", bytes: Buffer.from("k"), mime: "image/png" },
      "style"
    );
    expect(out.bytes.toString()).toBe("kitchen");
    expect(editsCreate).toHaveBeenCalled();
  });

  it("throws on missing key", async () => {
    delete process.env.OPENAI_API_KEY;
    const p = new OpenAIProvider();
    await expect(p.generateAnchor([], "x")).rejects.toThrow(/OPENAI_API_KEY/);
  });
});

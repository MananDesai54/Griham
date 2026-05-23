import { describe, it, expect, vi } from "vitest";
import { GeminiProvider } from "../lib/ai/gemini";

vi.mock("@google/genai", () => {
  const generateContent = vi.fn().mockResolvedValue({
    candidates: [{ content: { parts: [{ inlineData: { data: Buffer.from("img-bytes").toString("base64"), mimeType: "image/png" } }] } }],
  });
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({ models: { generateContent } })),
    __gen: generateContent,
  };
});

describe("GeminiProvider", () => {
  it("generateAnchor sends all rooms and returns first image", async () => {
    process.env.GEMINI_API_KEY = "test";
    const p = new GeminiProvider();
    const rooms = [
      { label: "living room", bytes: Buffer.from("a"), mime: "image/jpeg" },
      { label: "kitchen", bytes: Buffer.from("b"), mime: "image/jpeg" },
    ];
    const out = await p.generateAnchor(rooms, "style");
    expect(out.anchor.bytes.toString()).toBe("img-bytes");
    expect(out.anchor.mime).toBe("image/png");
    expect(out.anchorRoomLabel).toBe("living room");
  });

  it("generateRoom sends anchor + room source", async () => {
    process.env.GEMINI_API_KEY = "test";
    const p = new GeminiProvider();
    const out = await p.generateRoom(
      { bytes: Buffer.from("anc"), mime: "image/png" },
      { label: "kitchen", bytes: Buffer.from("k"), mime: "image/jpeg" },
      "style"
    );
    expect(out.bytes.toString()).toBe("img-bytes");
  });

  it("throws MissingApiKeyError when env missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const p = new GeminiProvider();
    await expect(p.generateAnchor([], "x")).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it("editRoom sends base + instruction (no mask)", async () => {
    process.env.GEMINI_API_KEY = "test";
    const p = new GeminiProvider();
    const out = await p.editRoom(
      { bytes: Buffer.from("base"), mime: "image/png" },
      null,
      "move sofa left"
    );
    expect(out.bytes.toString()).toBe("img-bytes");
  });

  it("editRoom sends base + mask + instruction", async () => {
    process.env.GEMINI_API_KEY = "test";
    const p = new GeminiProvider();
    const out = await p.editRoom(
      { bytes: Buffer.from("base"), mime: "image/png" },
      Buffer.from("mask"),
      "replace sofa with green velvet"
    );
    expect(out.bytes.toString()).toBe("img-bytes");
  });
});

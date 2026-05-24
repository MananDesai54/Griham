import { GoogleGenAI } from "@google/genai";
import type { DesignProvider, ImageOut, RoomInput, AnchorOut } from "./types";
import { MissingApiKeyError } from "./index";

const MODEL = "gemini-3.1-flash-image-preview";

function client() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new MissingApiKeyError("GEMINI_API_KEY");
  return new GoogleGenAI({ apiKey: key });
}

function inlinePart(buf: Buffer, mime: string) {
  return { inlineData: { data: buf.toString("base64"), mimeType: mime } };
}

function extractImage(resp: any): ImageOut {
  const parts = resp?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (p.inlineData?.data) {
      return { bytes: Buffer.from(p.inlineData.data, "base64"), mime: p.inlineData.mimeType ?? "image/png" };
    }
  }
  throw new Error("Gemini returned no image");
}

const IMAGE_CONFIG = {
  responseModalities: ["IMAGE"],
  responseFormat: {
    image: { aspectRatio: "16:9", imageSize: "2K" },
  },
};

function strictAnchorPrompt(stylePrompt: string, anchorLabel: string, allLabels: string[]): string {
  return (
    `You are a professional interior designer. ${stylePrompt}\n\n` +
    `I am providing photos of these rooms in a single home: ${allLabels.join(", ")}.\n` +
    `Your task: produce ONE redesigned photo-realistic image of the "${anchorLabel}" room. ` +
    `This image will define the style anchor (palette, materials, lighting, furniture language) that every other room must match.\n\n` +
    `STRICT RULES — do not violate:\n` +
    `1. Preserve the exact room geometry: walls, windows, doors, ceiling height, floor plan. Do not move, add, or remove architectural elements.\n` +
    `2. Preserve the camera angle and framing of the source photo exactly.\n` +
    `3. Replace only furniture, decor, surfaces (floor finish, wall finish), lighting fixtures, and soft furnishings.\n` +
    `4. Use a single cohesive palette (3–5 colors) and material set that will work across all rooms.\n` +
    `5. Photorealistic output. No cartoons, no text, no watermarks.`
  );
}

function strictRoomPrompt(stylePrompt: string, roomLabel: string, hint?: string): string {
  const hintLine = hint?.trim()
    ? `\n\nADDITIONAL ROOM HINT: ${hint.trim()}\nIncorporate this hint while still matching the anchor's overall style.`
    : "";
  return (
    `You are a professional interior designer. ${stylePrompt}\n\n` +
    `I am providing two images:\n` +
    `- IMAGE 1: the established style anchor (palette, materials, lighting). Match this style EXACTLY.\n` +
    `- IMAGE 2: the source photo of the "${roomLabel}" room. This defines the geometry and camera framing.\n\n` +
    `Your task: produce ONE redesigned photo-realistic image of "${roomLabel}" that:\n` +
    `1. Preserves IMAGE 2's exact geometry: walls, windows, doors, ceiling, floor plan, camera angle.\n` +
    `2. Uses the palette, materials, lighting language, and overall style of IMAGE 1.\n` +
    `3. Replaces furniture, decor, surfaces, and fixtures to fit ${roomLabel} but in the anchor's style.\n` +
    `4. Photorealistic. No text, no watermarks. No cartoon style.` +
    hintLine
  );
}

function strictEditPrompt(instruction: string, hasMask: boolean): string {
  if (hasMask) {
    return (
      `You will receive two images:\n` +
      `- IMAGE 1: the base room design.\n` +
      `- IMAGE 2: a mask. White pixels mark the area you must edit. Black/transparent pixels MUST be preserved exactly.\n\n` +
      `Instruction: ${instruction}\n\n` +
      `Rules:\n` +
      `1. Modify ONLY the masked (white) region of IMAGE 1.\n` +
      `2. Outside the mask: pixel-perfect preservation.\n` +
      `3. Maintain photorealism, lighting, perspective consistency.\n` +
      `4. No text, no watermarks.`
    );
  }
  return (
    `Edit IMAGE 1 according to this instruction: ${instruction}\n\n` +
    `Rules:\n` +
    `1. Preserve room geometry, camera angle, and overall lighting unless the instruction explicitly changes them.\n` +
    `2. Photorealistic output. No text, no watermarks.`
  );
}

export class GeminiProvider implements DesignProvider {
  name = "gemini" as const;

  async generateAnchor(rooms: RoomInput[], stylePrompt: string): Promise<AnchorOut> {
    const ai = client();
    if (rooms.length === 0) throw new Error("no rooms");
    const anchorRoom = rooms.find(r => r.label.toLowerCase().includes("living")) ?? rooms[0];
    const text = strictAnchorPrompt(stylePrompt, anchorRoom.label, rooms.map(r => r.label));
    const parts: any[] = [{ text }];
    for (const r of rooms) {
      parts.push({ text: `Room: ${r.label}` });
      parts.push(inlinePart(r.bytes, r.mime));
    }
    const resp = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
      config: IMAGE_CONFIG,
    });
    return { anchor: extractImage(resp), anchorRoomLabel: anchorRoom.label };
  }

  async generateRoom(anchor: ImageOut, room: RoomInput, stylePrompt: string): Promise<ImageOut> {
    const ai = client();
    const text = strictRoomPrompt(stylePrompt, room.label, room.hint);
    const parts = [
      { text },
      inlinePart(anchor.bytes, anchor.mime),
      inlinePart(room.bytes, room.mime),
    ];
    const resp = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
      config: IMAGE_CONFIG,
    });
    return extractImage(resp);
  }

  async editRoom(base: ImageOut, mask: Buffer | null, instruction: string): Promise<ImageOut> {
    const ai = client();
    const text = strictEditPrompt(instruction, !!mask);
    const parts: any[] = [{ text }, inlinePart(base.bytes, base.mime)];
    if (mask) parts.push(inlinePart(mask, "image/png"));
    const resp = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
      config: IMAGE_CONFIG,
    });
    return extractImage(resp);
  }
}

import { GoogleGenAI } from "@google/genai";
import type { DesignProvider, ImageOut, RoomInput, AnchorOut } from "./types";
import { MissingApiKeyError } from "./index";
import { pickAnchorRoomByLabel } from "../style";

const MODEL = "gemini-2.5-flash-image";

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

export class GeminiProvider implements DesignProvider {
  name = "gemini" as const;

  async generateAnchor(rooms: RoomInput[], stylePrompt: string): Promise<AnchorOut> {
    const ai = client();
    if (rooms.length === 0) throw new Error("no rooms");
    const anchorRoom = pickAnchorRoomByLabel(rooms)!;
    const text =
      `${stylePrompt}\n\nThe following images show the rooms in the home. ` +
      `Render a redesigned view of the room labeled "${anchorRoom.label}". ` +
      `Establish the cohesive style that will be applied to every other room.`;
    const parts: any[] = [{ text }];
    for (const r of rooms) parts.push({ text: `Room: ${r.label}` }, inlinePart(r.bytes, r.mime));
    const resp = await ai.models.generateContent({ model: MODEL, contents: [{ role: "user", parts }] });
    return { anchor: extractImage(resp), anchorRoomLabel: anchorRoom.label };
  }

  async generateRoom(anchor: ImageOut, room: RoomInput, stylePrompt: string): Promise<ImageOut> {
    const ai = client();
    const text =
      `${stylePrompt}\n\nThe first image is the established style anchor. ` +
      `The second image is the source photo of the room labeled "${room.label}". ` +
      `Render a redesigned view of "${room.label}" that exactly matches the palette, materials, and design language of the anchor.`;
    const parts = [
      { text },
      inlinePart(anchor.bytes, anchor.mime),
      inlinePart(room.bytes, room.mime),
    ];
    const resp = await ai.models.generateContent({ model: MODEL, contents: [{ role: "user", parts }] });
    return extractImage(resp);
  }
}

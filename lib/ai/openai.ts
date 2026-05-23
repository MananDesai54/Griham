import OpenAI, { toFile } from "openai";
import type { DesignProvider, ImageOut, RoomInput, AnchorOut } from "./types";
import { MissingApiKeyError } from "./index";
import { pickAnchorRoomByLabel } from "../style";

const MODEL = "gpt-image-1";

function client() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new MissingApiKeyError("OPENAI_API_KEY");
  return new OpenAI({ apiKey: key });
}

function decode(b64: string | undefined): Buffer {
  if (!b64) throw new Error("OpenAI returned no image data");
  return Buffer.from(b64, "base64");
}

export class OpenAIProvider implements DesignProvider {
  name = "openai" as const;

  async generateAnchor(rooms: RoomInput[], stylePrompt: string): Promise<AnchorOut> {
    const c = client();
    if (rooms.length === 0) throw new Error("no rooms");
    const anchorRoom = pickAnchorRoomByLabel(rooms)!;
    const labels = rooms.map(r => r.label).join(", ");
    const prompt =
      `${stylePrompt}\n` +
      `Rooms in the home: ${labels}. ` +
      `Render a redesigned interior view of the room labeled "${anchorRoom.label}". ` +
      `Establish a cohesive style that will be applied to every other room.`;
    const imageFiles = await Promise.all(
      rooms.map((r, i) => toFile(r.bytes, `room-${i}.png`, { type: r.mime }))
    );
    const resp = await c.images.edit({ model: MODEL, image: imageFiles, prompt, size: "1024x1024" });
    return {
      anchor: { bytes: decode(resp.data?.[0]?.b64_json), mime: "image/png" },
      anchorRoomLabel: anchorRoom.label,
    };
  }

  async generateRoom(anchor: ImageOut, room: RoomInput, stylePrompt: string): Promise<ImageOut> {
    const c = client();
    const anchorFile = await toFile(anchor.bytes, "anchor.png", { type: anchor.mime });
    const roomFile = await toFile(room.bytes, "room.png", { type: room.mime });
    const prompt =
      `${stylePrompt}\n` +
      `First image is the style anchor. Second image is the source photo of "${room.label}". ` +
      `Redesign "${room.label}" matching the anchor's palette and materials exactly.`;
    const resp = await c.images.edit({ model: MODEL, image: [anchorFile, roomFile], prompt, size: "1024x1024" });
    return { bytes: decode(resp.data?.[0]?.b64_json), mime: "image/png" };
  }
}

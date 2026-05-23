import Replicate from "replicate";
import type { DesignProvider, ImageOut, RoomInput, AnchorOut } from "./types";
import { MissingApiKeyError } from "./index";

// IP-Adapter SDXL on Replicate. If this slug rots, pin a newer IP-Adapter SDXL variant.
const MODEL = "lucataco/sdxl-ip-adapter:0c8d0f1e9d3a9f8c2e6b5a1c4d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e" as `${string}/${string}:${string}`;

function client() {
  const auth = process.env.REPLICATE_API_TOKEN;
  if (!auth) throw new MissingApiKeyError("REPLICATE_API_TOKEN");
  return new Replicate({ auth });
}

function dataUri(buf: Buffer, mime: string): string {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function downloadImage(url: string): Promise<ImageOut> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`replicate output fetch failed: ${r.status}`);
  const mime = r.headers.get("content-type") ?? "image/png";
  const bytes = Buffer.from(await r.arrayBuffer());
  return { bytes, mime };
}

function asUrl(out: unknown): string {
  if (Array.isArray(out)) return String(out[0]);
  if (typeof out === "string") return out;
  throw new Error("unexpected replicate output");
}

export class ReplicateProvider implements DesignProvider {
  name = "replicate" as const;

  async generateAnchor(rooms: RoomInput[], stylePrompt: string): Promise<AnchorOut> {
    const r = client();
    if (rooms.length === 0) throw new Error("no rooms");
    const anchorRoom = rooms.find(x => x.label.toLowerCase().includes("living")) ?? rooms[0];
    const prompt = `${stylePrompt} Interior of ${anchorRoom.label}, cohesive palette, high detail.`;
    const out = await r.run(MODEL, {
      input: {
        prompt,
        image: dataUri(anchorRoom.bytes, anchorRoom.mime),
        ip_adapter_image: dataUri(anchorRoom.bytes, anchorRoom.mime),
        width: 1024,
        height: 1024,
      },
    });
    return { anchor: await downloadImage(asUrl(out)), anchorRoomLabel: anchorRoom.label };
  }

  async generateRoom(anchor: ImageOut, room: RoomInput, stylePrompt: string): Promise<ImageOut> {
    const r = client();
    const prompt = `${stylePrompt} Interior of ${room.label}, matching the reference style exactly.`;
    const out = await r.run(MODEL, {
      input: {
        prompt,
        image: dataUri(room.bytes, room.mime),
        ip_adapter_image: dataUri(anchor.bytes, anchor.mime),
        width: 1024,
        height: 1024,
      },
    });
    return downloadImage(asUrl(out));
  }
}

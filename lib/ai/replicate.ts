// TODO: pin a specific version hash before production use. Slug-only resolves to the model's latest published version, which may change.
import Replicate from "replicate";
import type { DesignProvider, ImageOut, RoomInput, AnchorOut } from "./types";
import { MissingApiKeyError } from "./index";
import { pickAnchorRoomByLabel } from "../style";

const MODEL = "lucataco/sdxl-ip-adapter" as `${string}/${string}`;
// TODO: pin a specific version hash before production use.
const INPAINT_MODEL = "lucataco/sdxl-inpainting" as `${string}/${string}`;

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
    const anchorRoom = pickAnchorRoomByLabel(rooms)!;
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

  async editRoom(base: ImageOut, mask: Buffer | null, instruction: string): Promise<ImageOut> {
    const r = client();
    const input: Record<string, unknown> = {
      prompt: instruction,
      image: dataUri(base.bytes, base.mime),
      width: 1024,
      height: 1024,
    };
    if (mask) input.mask = dataUri(mask, "image/png");
    const out = await r.run(INPAINT_MODEL, { input });
    return downloadImage(asUrl(out));
  }
}

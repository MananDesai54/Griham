export interface RoomInput {
  label: string;
  bytes: Buffer;
  mime: string;
}

export interface ImageOut {
  bytes: Buffer;
  mime: string;
}

export interface AnchorOut {
  anchor: ImageOut;
  anchorRoomLabel: string;
}

export type ProviderName = "gemini" | "openai" | "replicate";

export interface DesignProvider {
  name: ProviderName;
  generateAnchor(rooms: RoomInput[], stylePrompt: string): Promise<AnchorOut>;
  generateRoom(anchor: ImageOut, room: RoomInput, stylePrompt: string): Promise<ImageOut>;
  editRoom?(base: ImageOut, mask: Buffer | null, instruction: string): Promise<ImageOut>;
}

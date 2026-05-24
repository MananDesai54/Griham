import sharp from "sharp";

export async function normalizeImage(input: Buffer): Promise<{ bytes: Buffer; mime: string }> {
  const out = await sharp(input)
    .rotate()
    .resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92 })
    .toBuffer();
  return { bytes: out, mime: "image/jpeg" };
}

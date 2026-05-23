import sharp from "sharp";

export async function normalizeImage(input: Buffer): Promise<{ bytes: Buffer; mime: string }> {
  const out = await sharp(input)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  return { bytes: out, mime: "image/jpeg" };
}

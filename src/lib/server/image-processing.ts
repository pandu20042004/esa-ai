import sharp from "sharp";

export type WebpResult = { buffer: Buffer; contentType: "image/webp" };

export async function toWebp(file: File): Promise<WebpResult> {
  const arrayBuffer = await file.arrayBuffer();
  const input = Buffer.from(arrayBuffer);

  const buffer = await sharp(input)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  return { buffer, contentType: "image/webp" };
}

import sharp from "sharp";

export type WebpResult = { buffer: Buffer; contentType: "image/webp" };

export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1350;

/**
 * Convert an image File to WebP at poster aspect (1080x1350, cover crop).
 * Oversized images are scaled down; smaller images are upscaled to fit.
 */
export async function toWebp(file: File): Promise<WebpResult> {
  const arrayBuffer = await file.arrayBuffer();
  const input = Buffer.from(arrayBuffer);

  const buffer = await sharp(input)
    .rotate()
    .resize({
      width: POSTER_WIDTH,
      height: POSTER_HEIGHT,
      fit: "cover",
      position: "attention",
    })
    .webp({ quality: 86 })
    .toBuffer();

  return { buffer, contentType: "image/webp" };
}

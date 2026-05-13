import sharp from "sharp";

export type WebpResult = { buffer: Buffer; contentType: "image/webp" };

export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1350;
export const SQUARE_SIZE = 1080;

export type WebpOptions = {
  width?: number;
  height?: number;
  fit?: "cover" | "contain" | "inside";
  quality?: number;
};

/**
 * Convert a File to WebP.
 * Defaults: poster aspect 1080x1350 cover crop.
 */
export async function toWebp(file: File, opts: WebpOptions = {}): Promise<WebpResult> {
  const width = opts.width ?? POSTER_WIDTH;
  const height = opts.height ?? POSTER_HEIGHT;
  const fit = opts.fit ?? "cover";
  const quality = opts.quality ?? 86;

  const arrayBuffer = await file.arrayBuffer();
  const input = Buffer.from(arrayBuffer);

  const buffer = await sharp(input)
    .rotate()
    .resize({
      width,
      height,
      fit,
      position: "attention",
      withoutEnlargement: false,
    })
    .webp({ quality })
    .toBuffer();

  return { buffer, contentType: "image/webp" };
}

/**
 * Convert a File to portrait WebP (1080x1350) for Instagram feed.
 * Used for twibbons, user photos, and combined assets.
 */
export async function toPortraitWebp(file: File): Promise<WebpResult> {
  return toWebp(file, { width: POSTER_WIDTH, height: POSTER_HEIGHT, fit: "cover" });
}

/** @deprecated use toPortraitWebp */
export const toSquareWebp = toPortraitWebp;

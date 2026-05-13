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

/**
 * Process a twibbon image. Resizes to 1080x1350, then:
 *   - If the image already has transparent pixels, keep as-is.
 *   - If fully opaque, flood-fill from the center pixel outward and make
 *     connected pixels of a similar color transparent (photo hole detection).
 * Returns a WebP buffer with alpha channel.
 */
export async function toTwibbonWebp(file: File): Promise<WebpResult> {
  const arrayBuffer = await file.arrayBuffer();
  const input = Buffer.from(arrayBuffer);

  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: POSTER_WIDTH, height: POSTER_HEIGHT, fit: "cover", position: "center" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const channels = info.channels;
  const pixels = new Uint8ClampedArray(data);

  // Check for any existing transparency
  let hasTransparency = false;
  for (let i = 3; i < pixels.length; i += channels) {
    if (pixels[i] < 250) {
      hasTransparency = true;
      break;
    }
  }

  if (!hasTransparency) {
    // Flood-fill from center
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const refIdx = (cy * width + cx) * channels;
    const refR = pixels[refIdx];
    const refG = pixels[refIdx + 1];
    const refB = pixels[refIdx + 2];

    const tolerance = 36;
    const visited = new Uint8Array(width * height);
    const stack: number[] = [cy * width + cx];

    while (stack.length > 0) {
      const pos = stack.pop() as number;
      if (visited[pos]) continue;
      visited[pos] = 1;

      const pi = pos * channels;
      const dr = Math.abs(pixels[pi] - refR);
      const dg = Math.abs(pixels[pi + 1] - refG);
      const db = Math.abs(pixels[pi + 2] - refB);
      if (dr > tolerance || dg > tolerance || db > tolerance) continue;

      pixels[pi + 3] = 0; // alpha = 0

      const x = pos % width;
      const y = (pos - x) / width;
      if (x > 0) stack.push(pos - 1);
      if (x < width - 1) stack.push(pos + 1);
      if (y > 0) stack.push(pos - width);
      if (y < height - 1) stack.push(pos + width);
    }
  }

  const buffer = await sharp(Buffer.from(pixels), {
    raw: { width, height, channels: channels as 3 | 4 },
  })
    .webp({ quality: 92, alphaQuality: 100 })
    .toBuffer();

  return { buffer, contentType: "image/webp" };
}

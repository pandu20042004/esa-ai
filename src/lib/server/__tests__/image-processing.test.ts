import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { toWebp } from "../image-processing";

describe("toWebp", () => {
  it("converts a PNG file to WebP", async () => {
    const pngBytes = await readFile(path.join(__dirname, "fixtures", "sample.png"));
    const file = new File([pngBytes], "sample.png", { type: "image/png" });

    const result = await toWebp(file);

    expect(result.contentType).toBe("image/webp");
    expect(result.buffer.length).toBeGreaterThan(0);
    // WebP magic bytes: "RIFF....WEBP"
    expect(result.buffer.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(result.buffer.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });
});

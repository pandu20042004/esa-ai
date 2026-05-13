import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractText } from "../file-extraction";

async function loadFile(name: string, mime: string): Promise<File> {
  const bytes = await readFile(path.join(__dirname, "fixtures", name));
  return new File([bytes], name, { type: mime });
}

describe("extractText", () => {
  it("reads plain text", async () => {
    const file = await loadFile("sample.txt", "text/plain");
    const text = await extractText(file);
    expect(text).toContain("Plain text content");
  });

  it("reads markdown", async () => {
    const file = await loadFile("sample.md", "text/markdown");
    const text = await extractText(file);
    expect(text).toContain("Sample guidebook");
  });

  it("returns empty string for unsupported mime", async () => {
    const file = new File(["hello"], "x.bin", { type: "application/octet-stream" });
    const text = await extractText(file);
    expect(text).toBe("");
  });
});

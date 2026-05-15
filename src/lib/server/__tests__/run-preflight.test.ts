import { describe, expect, it } from "vitest";

import { buildMainAgentInputFiles, hasUsableExtractedText } from "@/lib/server/run-preflight";

describe("run preflight input assembly", () => {
  it("rejects whitespace-only extracted guidebook text", () => {
    expect(hasUsableExtractedText("\n\n\n\n")).toBe(false);
    expect(hasUsableExtractedText("Guidebook has minimum 1000 words.")).toBe(true);
  });

  it("includes both guidebook and user-level style profile in main agent inputs", () => {
    const inputs = buildMainAgentInputFiles(
      {
        signedUrl: "https://signed.example/guidebook.pdf",
        row: {
          id: "guidebook-id",
          file_name: "Guidebook.pdf",
          file_role: "guidebook",
          content_text: "\n\n\n",
          mime_type: "application/pdf",
          storage_bucket: "competition-files",
          storage_path: "user/competition/guidebook.pdf",
        },
      },
      {
        row: {
          id: "style-id",
          file_name: "00_style_profile.md",
          file_role: "style_profile",
          content_text: "# Style Profile\n\nUse concise analytical prose.",
          mime_type: "text/markdown",
        },
      },
    );

    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toMatchObject({
      fileId: "guidebook-id",
      fileRole: "guidebook",
      signedUrl: "https://signed.example/guidebook.pdf",
    });
    expect(inputs[0].contentText).toContain("TEXT EXTRACTION IS EMPTY");
    expect(inputs[1]).toMatchObject({
      fileId: "style-id",
      fileRole: "style_profile",
      contentText: "# Style Profile\n\nUse concise analytical prose.",
    });
  });
});

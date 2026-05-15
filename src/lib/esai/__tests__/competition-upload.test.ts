import { describe, expect, it } from "vitest";

import { isCompetitionUploadComplete } from "../competition-upload";

describe("competition upload readiness", () => {
  it("requires a persisted competition id and guidebook file id before workflow can open", () => {
    expect(isCompetitionUploadComplete({ id: "c1", guidebookFileId: "g1" })).toBe(true);
    expect(isCompetitionUploadComplete({ id: "c1" })).toBe(false);
    expect(isCompetitionUploadComplete(null)).toBe(false);
  });
});

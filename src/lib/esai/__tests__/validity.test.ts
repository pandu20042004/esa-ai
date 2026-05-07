import { describe, expect, it } from "vitest";

import { createValidityUploadFile, getValidityPaneFiles } from "@/lib/esai/validity";
import type { CompetitionFile } from "@/types/esai";

const files: CompetitionFile[] = [
  {
    id: "file-output",
    competitionId: "comp-test",
    fileName: "final-paper-output.pdf",
    fileRole: "final_output",
    fileSource: "user_upload",
    sourceDetail: "User upload",
    approved: true,
    createdAt: "2026-05-06T10:30:00.000Z",
  },
  {
    id: "file-research",
    competitionId: "comp-test",
    fileName: "03_research_brief.md",
    fileRole: "research_output",
    fileSource: "agent_output",
    sourceDetail: "Research Agent",
    approved: true,
    createdAt: "2026-05-06T09:30:00.000Z",
  },
  {
    id: "file-guidebook",
    competitionId: "comp-test",
    fileName: "Guidebook.pdf",
    fileRole: "guidebook",
    fileSource: "user_upload",
    sourceDetail: "User Upload",
    approved: true,
    createdAt: "2026-05-05T13:05:00.000Z",
  },
  {
    id: "file-journal",
    competitionId: "comp-test",
    fileName: "journal-pet-adsorbent.pdf",
    fileRole: "journal_pdf",
    fileSource: "user_upload",
    sourceDetail: "User Upload",
    approved: true,
    createdAt: "2026-05-06T12:00:00.000Z",
  },
  {
    id: "file-journal-zeolite",
    competitionId: "comp-test",
    fileName: "zeolite-13x-co2-review.pdf",
    fileRole: "journal_pdf",
    fileSource: "user_upload",
    sourceDetail: "User Upload",
    approved: true,
    createdAt: "2026-05-06T12:10:00.000Z",
  },
  {
    id: "file-journal-plastic",
    competitionId: "comp-test",
    fileName: "plastic-carbon-thermal.pdf",
    fileRole: "journal_pdf",
    fileSource: "user_upload",
    sourceDetail: "User Upload",
    approved: true,
    createdAt: "2026-05-06T12:20:00.000Z",
  },
];

describe("validity checker file scoping", () => {
  it("shows only output/research/stage files in the output vault", () => {
    const outputFiles = getValidityPaneFiles(files, "output");

    expect(outputFiles.map((file) => file.fileName)).toContain("final-paper-output.pdf");
    expect(outputFiles.map((file) => file.fileName)).toContain("03_research_brief.md");
    expect(outputFiles.map((file) => file.fileName)).not.toContain("journal-pet-adsorbent.pdf");
    expect(outputFiles.map((file) => file.fileName)).not.toContain("Guidebook.pdf");
  });

  it("shows only journal PDFs in the input journal vault", () => {
    const inputFiles = getValidityPaneFiles(files, "input");

    expect(inputFiles.map((file) => file.fileName)).toEqual([
      "journal-pet-adsorbent.pdf",
      "zeolite-13x-co2-review.pdf",
      "plastic-carbon-thermal.pdf",
    ]);
  });

  it("creates uploads scoped to the active pane", () => {
    expect(createValidityUploadFile("output", 4).fileRole).toBe("final_output");
    expect(createValidityUploadFile("input", 4).fileRole).toBe("journal_pdf");
  });
});

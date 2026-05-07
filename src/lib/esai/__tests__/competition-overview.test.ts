import { describe, expect, it } from "vitest";

import { buildCompetitionOverview } from "@/lib/esai/competition-overview";
import type { Competition, CompetitionFile } from "@/types/esai";

const competition: Competition = {
  id: "comp-test",
  title: "User Competition",
  category: "Essay",
  institution: "User Institution",
  status: "Setup",
  progress: 0,
  deadline: "2026-08-15",
  registrationLink: "https://registration.example/path",
  currentStageId: "onboarding",
  posterTone: "new brief",
};

const files: CompetitionFile[] = [
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
    id: "file-draft",
    competitionId: "comp-test",
    fileName: "04_draft_essay.md",
    fileRole: "stage_output",
    fileSource: "agent_output",
    sourceDetail: "Writing Agent",
    approved: false,
    createdAt: "2026-05-06T11:00:00.000Z",
  },
];

describe("buildCompetitionOverview", () => {
  it("keeps real user uploads separate from AI agent outputs", () => {
    const overview = buildCompetitionOverview(competition, files);

    expect(overview.userUploadedFiles.map((file) => file.name)).toEqual(["Guidebook.pdf"]);
    expect(overview.agentOutputFiles.map((file) => [file.name, file.state])).toEqual([
      ["04_draft_essay.md", "Draft"],
    ]);
  });

  it("maps selected competition metadata without fallback demo links", () => {
    const overview = buildCompetitionOverview(competition, files);

    expect(overview.title).toBe("User Competition");
    expect(overview.subtitle).toBe("Essay - User Institution");
    expect(overview.deadline).toBe("2026-08-15");
    expect(overview.progress).toBe(0);
    expect(overview.registrationDisplay).toBe("registration.example/path");
  });
});

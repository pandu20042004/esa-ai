import type { CompetitionFile } from "@/types/esai";

export type ValidityPane = "output" | "input";

export function getValidityPaneFiles(files: CompetitionFile[], pane: ValidityPane) {
  if (pane === "output") {
    const priority = new Map([
      ["final_output", 0],
      ["research_output", 1],
      ["supervisor", 2],
    ]);

    return files
      .filter((file) => {
        if (["final_output", "research_output"].includes(file.fileRole)) return true;
        return file.fileRole === "stage_output" && file.stageId === "supervisor";
      })
      .sort((a, b) => {
        const left = a.stageId === "supervisor" ? "supervisor" : a.fileRole;
        const right = b.stageId === "supervisor" ? "supervisor" : b.fileRole;
        return (priority.get(left) ?? 10) - (priority.get(right) ?? 10);
      });
  }

  return files.filter((file) => file.fileRole === "journal_pdf");
}

export function createValidityUploadFile(pane: ValidityPane, index: number): CompetitionFile {
  const now = new Date().toISOString();

  if (pane === "output") {
    return {
      id: `uploaded-output-${index}`,
      competitionId: "comp-pimnas-2026",
      fileName: `uploaded-output-${index}.pdf`,
      fileRole: "final_output",
      fileSource: "user_upload",
      sourceDetail: "User upload",
      contentText: "Uploaded output PDF ready for citation comparison.",
      approved: true,
      createdAt: now,
    };
  }

  return {
    id: `uploaded-journal-${index}`,
    competitionId: "comp-pimnas-2026",
    fileName: `uploaded-journal-${index}.pdf`,
    fileRole: "journal_pdf",
    fileSource: "user_upload",
    sourceDetail: "User upload",
    contentText: "Uploaded journal PDF ready for evidence retrieval.",
    approved: true,
    createdAt: now,
  };
}

import type { Competition, CompetitionFile } from "@/types/esai";

export type OverviewFileState = "Ready" | "Approved" | "Draft";

export type OverviewFileItem = {
  name: string;
  state: OverviewFileState;
};

export type CompetitionOverview = {
  title: string;
  subtitle: string;
  deadline: string;
  progress: number;
  registrationDisplay: string;
  userUploadedFiles: OverviewFileItem[];
  agentOutputFiles: OverviewFileItem[];
};

function displayRegistrationLink(link?: string) {
  if (!link) return "No registration link";

  try {
    const url = new URL(link);
    return `${url.hostname}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return link.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

function fileState(file?: CompetitionFile): OverviewFileState {
  if (!file) return "Ready";
  if (file.fileSource === "user_upload") return "Ready";
  return file.approved ? "Approved" : "Draft";
}

export function buildCompetitionOverview(competition: Competition, files: CompetitionFile[]): CompetitionOverview {
  const competitionFiles = files.filter((file) => file.competitionId === competition.id);

  return {
    title: competition.title,
    subtitle: `${competition.category} - ${competition.institution}`,
    deadline: competition.deadline,
    progress: competition.progress,
    registrationDisplay: displayRegistrationLink(competition.registrationLink),
    userUploadedFiles: competitionFiles
      .filter((file) => file.fileSource === "user_upload")
      .map((file) => ({
        name: file.fileName,
        state: fileState(file),
      })),
    agentOutputFiles: competitionFiles
      .filter((file) => file.fileSource === "agent_output" || file.fileSource === "devs")
      .map((file) => ({
        name: file.fileName,
        state: fileState(file),
      })),
  };
}

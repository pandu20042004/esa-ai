export type CompetitionUploadCheck = {
  id?: string;
  guidebookFileId?: string;
} | null | undefined;

export function isCompetitionUploadComplete(competition: CompetitionUploadCheck): boolean {
  return Boolean(competition?.id && competition.guidebookFileId);
}

export type SelectableCompetition = {
  id: string;
};

export function selectInitialCompetition<T extends SelectableCompetition>(
  competitions: T[],
  savedCompetitionId: string | null | undefined,
): T | null {
  if (savedCompetitionId) {
    const restored = competitions.find((competition) => competition.id === savedCompetitionId);
    if (restored) return restored;
  }
  return competitions[0] ?? null;
}

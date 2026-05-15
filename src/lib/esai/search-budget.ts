import type { StageId } from "@/types/esai";

export type SearchMode = "fast" | "balanced" | "deep";

export type SearchBudget = {
  mode: SearchMode;
  scholarlySoftLimit: number;
  scholarlyHardLimit: number;
  webSoftLimit: number;
  webHardLimit: number;
};

const BUDGETS: Record<SearchMode, Partial<Record<StageId, Omit<SearchBudget, "mode">>>> = {
  fast: {
    onboarding: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 3, webHardLimit: 8 },
    ideation: { scholarlySoftLimit: 6, scholarlyHardLimit: 12, webSoftLimit: 3, webHardLimit: 6 },
    research: { scholarlySoftLimit: 20, scholarlyHardLimit: 40, webSoftLimit: 5, webHardLimit: 10 },
    writing: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 0, webHardLimit: 0 },
    flowchart: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 0, webHardLimit: 0 },
    prototype: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 5, webHardLimit: 10 },
    ui: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 5, webHardLimit: 10 },
    supervisor: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 5, webHardLimit: 10 },
  },
  balanced: {
    onboarding: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 5, webHardLimit: 10 },
    ideation: { scholarlySoftLimit: 20, scholarlyHardLimit: 60, webSoftLimit: 10, webHardLimit: 25 },
    research: { scholarlySoftLimit: 60, scholarlyHardLimit: 150, webSoftLimit: 20, webHardLimit: 50 },
    writing: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 0, webHardLimit: 0 },
    flowchart: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 0, webHardLimit: 0 },
    prototype: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 8, webHardLimit: 16 },
    ui: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 8, webHardLimit: 16 },
    supervisor: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 10, webHardLimit: 20 },
  },
  deep: {
    onboarding: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 8, webHardLimit: 16 },
    ideation: { scholarlySoftLimit: 40, scholarlyHardLimit: 100, webSoftLimit: 20, webHardLimit: 30 },
    research: { scholarlySoftLimit: 150, scholarlyHardLimit: 300, webSoftLimit: 50, webHardLimit: 100 },
    writing: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 0, webHardLimit: 0 },
    flowchart: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 0, webHardLimit: 0 },
    prototype: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 12, webHardLimit: 24 },
    ui: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 12, webHardLimit: 24 },
    supervisor: { scholarlySoftLimit: 0, scholarlyHardLimit: 0, webSoftLimit: 15, webHardLimit: 30 },
  },
};

export function getSearchBudget(stageId: StageId, mode: SearchMode = "balanced"): SearchBudget {
  const selectedMode = BUDGETS[mode] ? mode : "balanced";
  const budget = BUDGETS[selectedMode][stageId] ?? BUDGETS.balanced[stageId] ?? {
    scholarlySoftLimit: 0,
    scholarlyHardLimit: 0,
    webSoftLimit: 0,
    webHardLimit: 0,
  };
  return { mode: selectedMode, ...budget };
}

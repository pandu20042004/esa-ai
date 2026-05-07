import type { AgentChoicePrompt, StageId, StageStatus } from "@/types/esai";

import { STAGES, stageById } from "./stages";

export function getStageState(
  stageId: StageId,
  currentStageId: StageId,
  approvedOutputNames: string[],
): { stageId: StageId; status: StageStatus; visibility: "visible" } {
  const stage = stageById.get(stageId);
  const currentStage = stageById.get(currentStageId);

  if (!stage || !currentStage) {
    throw new Error(`Unknown stage id: ${stageId}`);
  }

  const previousStages = STAGES.filter((candidate) => candidate.index < stage.index);
  const previousOutputsApproved = previousStages.every((candidate) =>
    approvedOutputNames.includes(candidate.output),
  );

  if (stage.id === currentStage.id) {
    return { stageId, status: "active", visibility: "visible" };
  }

  if (stage.index < currentStage.index && approvedOutputNames.includes(stage.output)) {
    return { stageId, status: "completed", visibility: "visible" };
  }

  if (stage.index <= currentStage.index || previousOutputsApproved) {
    return { stageId, status: "active", visibility: "visible" };
  }

  return { stageId, status: "locked", visibility: "visible" };
}

export function resolveNextUnlock(stageId: StageId, outputFileName: string, approved: boolean) {
  const stage = stageById.get(stageId);
  if (!stage || !approved || outputFileName !== stage.output) {
    return null;
  }

  return STAGES[stage.index + 1] ?? null;
}

export function isModelSelectionReady(modelId: string | null | undefined) {
  if (!modelId?.trim()) {
    return { ready: false, message: "Select a model before generating." };
  }

  return { ready: true, message: null };
}

export const STAGE_CHOICE_PROMPTS: Record<StageId, AgentChoicePrompt> = {
  onboarding: {
    question: "Use template_essay_onboarding.md and 00_style_profile.md to start this competition?",
    options: [
      { key: "A", label: "Essay", detail: "Theme, subtheme, guidebook rules, and style.", result: "Creates an essay onboarding map." },
      { key: "B", label: "KTI", detail: "Problem statement, method, novelty, and bibliography scope.", result: "Creates a KTI onboarding map." },
      { key: "C", label: "Prototype", detail: "Target user, feasibility, and visual asset plan.", result: "Creates a prototype onboarding map." },
    ],
  },
  ideation: {
    question: "Which idea direction should ideation prioritize?",
    options: [
      { key: "A", label: "Novelty", detail: "Prioritize originality and competitive differentiation.", result: "Builds unusual idea angles." },
      { key: "B", label: "Feasibility", detail: "Prioritize executable proposals and available evidence.", result: "Builds realistic idea angles." },
      { key: "C", label: "Impact", detail: "Prioritize measurable social or scientific benefit.", result: "Builds impact-led angles." },
    ],
  },
  research: {
    question: "What research lens should be strictest?",
    options: [
      { key: "A", label: "Recent sources", detail: "Prefer recent papers and current data.", result: "Creates a recency-weighted research brief." },
      { key: "B", label: "Official data", detail: "Prefer official institutions and guidebook constraints.", result: "Creates an official-source brief." },
      { key: "C", label: "Citation safety", detail: "Reject weak or unsupported claims.", result: "Creates a conservative evidence brief." },
    ],
  },
  writing: {
    question: "How should the writing pass behave?",
    options: [
      { key: "A", label: "Rewrite", detail: "Rewrite from research and style profile.", result: "Creates a fresh draft." },
      { key: "B", label: "Revise", detail: "Use uploaded draft as the base.", result: "Creates a revision." },
      { key: "C", label: "Outline first", detail: "Generate structure before prose.", result: "Creates a staged writing outline." },
    ],
  },
  flowchart: {
    question: "What should the flowchart emphasize?",
    options: [
      { key: "A", label: "Problem flow", detail: "Show problem to intervention logic.", result: "Creates a solution flow." },
      { key: "B", label: "System flow", detail: "Show components and data movement.", result: "Creates a system flow." },
      { key: "C", label: "User flow", detail: "Show how target users experience the proposal.", result: "Creates a user journey flow." },
    ],
  },
  prototype: {
    question: "What prototype output is needed?",
    options: [
      { key: "A", label: "Physical", detail: "Parts, sizes, and operating logic.", result: "Creates a physical prototype spec." },
      { key: "B", label: "Digital", detail: "Screens, data, and behavior.", result: "Creates a digital prototype spec." },
      { key: "C", label: "Hybrid", detail: "Connect device and app behavior.", result: "Creates a hybrid prototype spec." },
    ],
  },
  ui: {
    question: "What UI artifact should be produced?",
    options: [
      { key: "A", label: "Dashboard", detail: "Operational dashboard surfaces.", result: "Creates dashboard mockup." },
      { key: "B", label: "Mobile", detail: "Student-facing mobile flow.", result: "Creates mobile mockup." },
      { key: "C", label: "Pitch", detail: "Screens optimized for paper figures.", result: "Creates pitch visual mockup." },
    ],
  },
  supervisor: {
    question: "What review lens should the supervisor use?",
    options: [
      { key: "A", label: "Rubric scoring", detail: "Score against guidebook criteria.", result: "Creates rubric review." },
      { key: "B", label: "Citation risk", detail: "Prioritize source validity and claim support.", result: "Creates citation risk review." },
      { key: "C", label: "Judge panel", detail: "Simulate multi-judge feedback.", result: "Creates panel review." },
    ],
  },
};


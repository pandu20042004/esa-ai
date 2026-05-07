import type { DevsAgentValidation, DevsNeed, DevsProduces } from "@/types/esai";

export const CONTROLLED_OUTPUT_LABELS = [
  "guidebook",
  "style_profile",
  "ideation_output",
  "research_output",
  "draft_output",
  "flowchart_output",
  "parts_list_output",
  "prototype_output",
  "ui_mockup_output",
  "supervisor_review",
  "final_output",
  "citation_evidence",
] as const;

export type ControlledOutputLabel = (typeof CONTROLLED_OUTPUT_LABELS)[number];

export type ValidateAgentDraftInput = {
  prompt: string;
  needs: DevsNeed[];
  produces: DevsProduces[];
  existingRolesInCompartment?: string[];
};

const CONTROLLED_OUTPUT_LABEL_SET = new Set<string>(CONTROLLED_OUTPUT_LABELS);

export function createSafeContractKey(label: string): string {
  const key = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return key || "untitled";
}

export function isSafeContractKey(key: string): boolean {
  return /^[a-z0-9_]+$/.test(key);
}

export function getOutputLabelName(role: string): string {
  if (!CONTROLLED_OUTPUT_LABEL_SET.has(role)) {
    return role;
  }

  const label = role.replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function validateAgentDraft(input: ValidateAgentDraftInput): DevsAgentValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const existingRoles = new Set(input.existingRolesInCompartment ?? []);

  if (!input.prompt.trim()) {
    blocking.push("Prompt is empty.");
  }

  if (input.produces.length === 0) {
    blocking.push("Add at least one Produces item before publishing.");
  }

  addDuplicateKeyBlocks("Need", input.needs, blocking);
  addDuplicateKeyBlocks("Produces", input.produces, blocking);

  for (const need of input.needs) {
    if (!isSafeContractKey(need.key)) {
      blocking.push(`Need key ${need.key} is not safe.`);
    }

    if (need.required && need.acceptedRoles.length === 0) {
      blocking.push(`Required Need ${need.key} must accept at least one role.`);
    }
  }

  for (const produce of input.produces) {
    if (!isSafeContractKey(produce.key)) {
      blocking.push(`Produces key ${produce.key} is not safe.`);
    }

    if (!produce.role.trim()) {
      blocking.push(`Produces ${produce.key} must include an output label.`);
      continue;
    }

    if (
      !CONTROLLED_OUTPUT_LABEL_SET.has(produce.role) &&
      !existingRoles.has(produce.role)
    ) {
      warnings.push(`No other agent currently uses output label ${produce.role}.`);
    }
  }

  return {
    blocking,
    warnings,
    pipelineReady: blocking.length === 0,
  };
}

function addDuplicateKeyBlocks(
  label: "Need" | "Produces",
  items: Array<{ key: string }>,
  blocking: string[],
) {
  const seenKeys = new Set<string>();
  const duplicateKeys = new Set<string>();

  for (const item of items) {
    if (seenKeys.has(item.key)) {
      duplicateKeys.add(item.key);
    }
    seenKeys.add(item.key);
  }

  for (const key of duplicateKeys) {
    blocking.push(`Duplicate ${label} key ${key}.`);
  }
}

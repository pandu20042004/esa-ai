import { describe, expect, it } from "vitest";

import {
  CONTROLLED_OUTPUT_LABELS,
  createSafeContractKey,
  getOutputLabelName,
  validateAgentDraft,
} from "@/lib/esai/agent-contracts";

describe("agent contract utilities", () => {
  it("creates safe contract keys from labels", () => {
    expect(createSafeContractKey("Research Brief")).toBe("research_brief");
    expect(createSafeContractKey("  Draft Essay!!! ")).toBe("draft_essay");
    expect(createSafeContractKey("")).toBe("untitled");
  });

  it("exposes friendly names for controlled output labels", () => {
    expect(CONTROLLED_OUTPUT_LABELS).toContain("research_output");
    expect(getOutputLabelName("research_output")).toBe("Research output");
    expect(getOutputLabelName("literature_scan")).toBe("literature_scan");
  });

  it("blocks an empty prompt from publishing", () => {
    expect(
      validateAgentDraft({
        prompt: "",
        needs: [],
        produces: [{ key: "research_output", label: "Research output", role: "research_output" }],
        existingRolesInCompartment: [],
      }),
    ).toEqual({
      blocking: ["Prompt is empty."],
      warnings: [],
      pipelineReady: false,
    });
  });

  it("blocks publishing without a Produces item", () => {
    expect(
      validateAgentDraft({
        prompt: "Write a research brief.",
        needs: [],
        produces: [],
        existingRolesInCompartment: [],
      }).blocking,
    ).toContain("Add at least one Produces item before publishing.");
  });

  it("warns when a custom output label is not used in the compartment", () => {
    expect(
      validateAgentDraft({
        prompt: "Scan the literature.",
        needs: [],
        produces: [{ key: "literature_scan", label: "Literature scan", role: "literature_scan" }],
        existingRolesInCompartment: ["research_output"],
      }),
    ).toEqual({
      blocking: [],
      warnings: ["No other agent currently uses output label literature_scan."],
      pipelineReady: true,
    });
  });
});

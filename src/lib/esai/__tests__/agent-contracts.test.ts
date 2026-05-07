import { describe, expect, it } from "vitest";

import {
  CONTROLLED_OUTPUT_LABELS,
  createSafeContractKey,
  getOutputLabelName,
  isSafeContractKey,
  validateAgentDraft,
} from "@/lib/esai/agent-contracts";

describe("agent contract utilities", () => {
  it("defines the controlled output label set exactly", () => {
    expect(CONTROLLED_OUTPUT_LABELS).toEqual([
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
    ]);
  });

  it("creates safe contract keys from labels", () => {
    expect(createSafeContractKey("Research Brief")).toBe("research_brief");
    expect(createSafeContractKey("  Draft Essay!!! ")).toBe("draft_essay");
    expect(createSafeContractKey("")).toBe("untitled");
  });

  it("checks safe contract key formatting", () => {
    expect(isSafeContractKey("research_brief")).toBe(true);
    expect(isSafeContractKey("draft_essay_2")).toBe(true);
    expect(isSafeContractKey("Research Brief")).toBe(false);
    expect(isSafeContractKey("research-brief")).toBe(false);
    expect(isSafeContractKey("")).toBe(false);
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

  it("blocks duplicate Need keys", () => {
    expect(
      validateAgentDraft({
        prompt: "Write a draft.",
        needs: [
          {
            key: "research_brief",
            label: "Research brief",
            acceptedRoles: ["research_output"],
            required: true,
            includeMode: "full",
          },
          {
            key: "research_brief",
            label: "Research brief copy",
            acceptedRoles: ["research_output"],
            required: false,
            includeMode: "summary",
          },
        ],
        produces: [{ key: "draft_essay", label: "Draft essay", role: "draft_output" }],
        existingRolesInCompartment: [],
      }).blocking,
    ).toContain("Duplicate Needs key: research_brief.");
  });

  it("blocks duplicate Produces keys", () => {
    expect(
      validateAgentDraft({
        prompt: "Write a draft.",
        needs: [],
        produces: [
          { key: "draft_essay", label: "Draft essay", role: "draft_output" },
          { key: "draft_essay", label: "Draft essay copy", role: "draft_output" },
        ],
        existingRolesInCompartment: [],
      }).blocking,
    ).toContain("Duplicate Produces key: draft_essay.");
  });

  it("blocks required Needs without accepted roles", () => {
    expect(
      validateAgentDraft({
        prompt: "Write a draft.",
        needs: [
          {
            key: "research_brief",
            label: "Research brief",
            acceptedRoles: [],
            required: true,
            includeMode: "full",
          },
        ],
        produces: [{ key: "draft_essay", label: "Draft essay", role: "draft_output" }],
        existingRolesInCompartment: [],
      }).blocking,
    ).toContain("Research brief accepts no output labels yet.");
  });

  it("blocks Produces items with empty output roles", () => {
    expect(
      validateAgentDraft({
        prompt: "Write a draft.",
        needs: [],
        produces: [{ key: "draft_essay", label: "Draft essay", role: " " }],
        existingRolesInCompartment: [],
      }).blocking,
    ).toContain("Draft essay has no output label.");
  });

  it("blocks unsafe Need and Produces keys", () => {
    const blocking = validateAgentDraft({
      prompt: "Write a draft.",
      needs: [
        {
          key: "Research Brief",
          label: "Research brief",
          acceptedRoles: ["research_output"],
          required: true,
          includeMode: "full",
        },
      ],
      produces: [{ key: "Draft Essay", label: "Draft essay", role: "draft_output" }],
      existingRolesInCompartment: [],
    }).blocking;

    expect(blocking).toContain("Needs key Research Brief uses unsafe characters.");
    expect(blocking).toContain("Produces key Draft Essay uses unsafe characters.");
  });
});

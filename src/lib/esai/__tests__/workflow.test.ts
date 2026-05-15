import { describe, expect, it } from "vitest";

import { STAGES } from "@/lib/esai/stages";
import {
  getStageState,
  isModelSelectionReady,
  resolveNextUnlock,
} from "@/lib/esai/workflow";

describe("workflow stage gating", () => {
  it("shows every stage but locks stages after the current approved output chain", () => {
    const states = STAGES.map((stage) =>
      getStageState(stage.id, "research", ["01_onboarding_map.md", "01_ideation.md"]),
    );

    expect(states.map((state) => state.visibility)).toEqual(Array(STAGES.length).fill("visible"));
    expect(states.find((state) => state.stageId === "ideation")?.status).toBe("completed");
    expect(states.find((state) => state.stageId === "research")?.status).toBe("active");
    expect(states.find((state) => state.stageId === "writing")?.status).toBe("locked");
  });

  it("unlocks the next stage only when the current stage output is approved", () => {
    expect(resolveNextUnlock("research", "03_research_brief.md", true)?.id).toBe("writing");
    expect(resolveNextUnlock("research", "draft_without_approval.md", false)).toBeNull();
  });
});

describe("model selection validation", () => {
  it("blocks generation until the user selects a model", () => {
    expect(isModelSelectionReady("")).toEqual({
      ready: false,
      message: "Select a model before generating.",
    });
    expect(isModelSelectionReady("GPT-5.4")).toEqual({ ready: true, message: null });
  });
});

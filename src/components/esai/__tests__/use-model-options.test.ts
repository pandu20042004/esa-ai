import { describe, expect, it } from "vitest";

import { getReasoningEffortsForModel, isSelectedModelReady } from "@/components/esai/useModelOptions";

describe("model option helpers", () => {
  it("returns configured reasoning efforts for the selected model", () => {
    const efforts = getReasoningEffortsForModel(
      [
        { provider: "codex-cli", id: "gpt-5.5", label: "GPT-5.5", reasoningEfforts: ["low", "medium", "high"] },
        { provider: "gemini-cli", id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      ],
      "codex-cli::gpt-5.5",
    );

    expect(efforts).toEqual(["low", "medium", "high"]);
  });

  it("returns no reasoning efforts for models without support metadata", () => {
    expect(getReasoningEffortsForModel([
      { provider: "gemini-cli", id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ], "gemini-cli::gemini-2.5-pro")).toEqual([]);
  });

  it("requires the selected model to exist in loaded options before run is ready", () => {
    expect(isSelectedModelReady([], "codex-cli::gpt-5.4")).toBe(false);
    expect(isSelectedModelReady([
      { provider: "codex-cli", id: "gpt-5.4", label: "GPT-5.4" },
    ], "codex-cli::gpt-5.4")).toBe(true);
  });
});

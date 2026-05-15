import { describe, expect, it } from "vitest";

import {
  buildModelPickerValue,
  parseCodexDebugModels,
  parseGeminiModelCatalog,
  parseOpenClawModelsStatus,
} from "@/lib/server/cli-providers";

describe("CLI model discovery", () => {
  it("uses Codex debug model catalog instead of a hardcoded list", () => {
    const models = parseCodexDebugModels(JSON.stringify({
      models: [
        {
          slug: "gpt-5.5",
          display_name: "GPT-5.5",
          description: "Frontier model.",
          supported_reasoning_levels: [
            { effort: "low" },
            { effort: "medium" },
            { effort: "high" },
            { effort: "xhigh" },
          ],
          default_reasoning_level: "medium",
          visibility: "list",
        },
        {
          slug: "hidden-model",
          display_name: "Hidden",
          visibility: "internal",
        },
      ],
    }));

    expect(models).toEqual([
      {
        id: "gpt-5.5",
        label: "GPT-5.5",
        provider: "codex-cli",
        description: "Frontier model.",
        reasoningEfforts: ["low", "medium", "high", "xhigh"],
        defaultReasoningEffort: "medium",
        source: "codex-debug-models",
      },
    ]);
  });

  it("uses OpenClaw status allowed models", () => {
    const models = parseOpenClawModelsStatus(JSON.stringify({
      defaultModel: "openai-codex/gpt-5.4",
      allowed: ["openai-codex/gpt-5.4", "openai/gpt-5.4"],
    }));

    expect(models).toEqual([
      {
        id: "openai-codex/gpt-5.4",
        label: "openai-codex/gpt-5.4 (current)",
        provider: "openclaw",
        source: "openclaw-models-status",
      },
      {
        id: "openai/gpt-5.4",
        label: "openai/gpt-5.4",
        provider: "openclaw",
        source: "openclaw-models-status",
      },
    ]);
  });

  it("extracts Gemini models from installed CLI catalog text", () => {
    const models = parseGeminiModelCatalog(`
      "auto-gemini-3": { displayName: "Auto (Gemini 3)" }
      "gemini-3-pro-preview": { family: "gemini-3" }
      "gemini-2.5-flash": { family: "gemini-2.5" }
      "not-gemini": { family: "other" }
    `);

    expect(models.map((model) => model.id)).toEqual([
      "auto-gemini-3",
      "gemini-3-pro-preview",
      "gemini-2.5-flash",
    ]);
  });

  it("keeps provider in picker values", () => {
    expect(buildModelPickerValue({ provider: "codex-cli", id: "gpt-5.5" })).toBe("codex-cli::gpt-5.5");
  });
});

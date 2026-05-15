import { describe, expect, it } from "vitest";

import {
  buildFollowUpPrompt,
  shouldBootstrapStageSession,
  shouldReuseStageSession,
} from "@/lib/server/stage-sessions";

describe("stage session helpers", () => {
  it("reuses active sessions only for the same provider and model", () => {
    const session = {
      status: "active",
      modelProvider: "codex-cli",
      modelId: "gpt-5.4",
      providerSessionId: "019e-session",
    };

    expect(shouldReuseStageSession(session, "codex-cli", "gpt-5.4")).toBe(true);
    expect(shouldReuseStageSession(session, "codex-cli", "gpt-5.5")).toBe(false);
    expect(shouldReuseStageSession({ ...session, status: "closed" }, "codex-cli", "gpt-5.4")).toBe(false);
  });

  it("bootstraps when there is no resumable provider session", () => {
    expect(shouldBootstrapStageSession(null)).toBe(true);
    expect(shouldBootstrapStageSession({ status: "active", providerSessionId: "abc" })).toBe(false);
    expect(shouldBootstrapStageSession({ status: "active", providerSessionId: null })).toBe(true);
  });

  it("builds compact follow-up prompts without full skill reload", () => {
    const prompt = buildFollowUpPrompt({
      stageId: "ideation",
      userMessage: "Saya pilih angle 2",
      summaryText: "Guidebook loaded. Five angles were proposed.",
    });

    expect(prompt).toContain("## Stage follow-up");
    expect(prompt).toContain("Saya pilih angle 2");
    expect(prompt).toContain("Guidebook loaded");
    expect(prompt).not.toContain("# Ideation Agent");
  });
});

import { describe, expect, it } from "vitest";
import { parseToolCalls } from "../tool-calls";

describe("parseToolCalls", () => {
  it("extracts a valid write_file call and strips the fence from prose", () => {
    const input = [
      "Here is the onboarding map:",
      "",
      "```tool",
      JSON.stringify({
        tool: "write_file",
        params: {
          artifact_key: "onboarding_map",
          file_name: "01_onboarding_map.md",
          file_role: "stage_output",
          artifact_role: "onboarding_map",
          content: "# Onboarding Map\n- rule 1",
        },
      }),
      "```",
      "",
      "Let me know when ready.",
    ].join("\n");

    const result = parseToolCalls(input);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].params.artifact_key).toBe("onboarding_map");
    expect(result.chatText).toContain("Here is the onboarding map");
    expect(result.chatText).toContain("Let me know when ready");
    expect(result.chatText).not.toContain("write_file");
    expect(result.invalid).toHaveLength(0);
  });

  it("collects invalid JSON blocks without throwing", () => {
    const input = ["```tool", "{ not json", "```", "chat after"].join("\n");
    const result = parseToolCalls(input);
    expect(result.toolCalls).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].reason).toMatch(/Invalid JSON/);
    expect(result.chatText).toContain("chat after");
  });

  it("rejects unsupported tool names", () => {
    const body = JSON.stringify({ tool: "web_search", params: {} });
    const input = ["```tool", body, "```"].join("\n");
    const result = parseToolCalls(input);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].reason).toMatch(/Unsupported/);
  });

  it("rejects bad params shape", () => {
    const body = JSON.stringify({
      tool: "write_file",
      params: { artifact_key: "Bad Key", file_name: "x.md", file_role: "stage_output", artifact_role: "x", content: "c" },
    });
    const input = ["```tool", body, "```"].join("\n");
    const result = parseToolCalls(input);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].reason).toMatch(/Invalid params/);
  });

  it("returns empty arrays for plain prose", () => {
    const result = parseToolCalls("Just some regular chat, no tools here.");
    expect(result.toolCalls).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
    expect(result.chatText).toBe("Just some regular chat, no tools here.");
  });

  it("handles multiple tool calls in one response", () => {
    const body1 = JSON.stringify({
      tool: "write_file",
      params: { artifact_key: "a", file_name: "a.md", file_role: "stage_output", artifact_role: "a", content: "a" },
    });
    const body2 = JSON.stringify({
      tool: "write_file",
      params: { artifact_key: "b", file_name: "b.md", file_role: "stage_output", artifact_role: "b", content: "b" },
    });
    const input = ["before", "```tool", body1, "```", "middle", "```tool", body2, "```", "after"].join("\n");
    const result = parseToolCalls(input);
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0].params.artifact_key).toBe("a");
    expect(result.toolCalls[1].params.artifact_key).toBe("b");
  });
});

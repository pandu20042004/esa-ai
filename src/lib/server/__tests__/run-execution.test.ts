import { describe, expect, it } from "vitest";

import { RunCancelledError, buildCodexCliArgs, buildCodexResumeCliArgs, formatCliProgressLines, isRunCancelledError, parseCodexJsonEvent, resolveSpawnCommandForPlatform } from "@/lib/server/run-execution";

describe("run execution CLI dispatch", () => {
  it("uses Windows shell mode for npm CLI shims", () => {
    expect(resolveSpawnCommandForPlatform("gemini", "win32")).toEqual({
      command: "gemini",
      shell: true,
    });
  });

  it("passes Codex reasoning effort through CLI config", () => {
    expect(buildCodexCliArgs("gpt-5.5", "high")).toEqual([
      "exec",
      "--json",
      "--ignore-user-config",
      "--ignore-rules",
      "--disable",
      "plugins",
      "--model",
      "gpt-5.5",
      "--skip-git-repo-check",
      "--dangerously-bypass-approvals-and-sandbox",
      "-c",
      "model_reasoning_effort=\"high\"",
      "-c",
      "mcp.remote_mcp_client_enabled=false",
      "-",
    ]);
  });

  it("puts Codex web search before the exec subcommand", () => {
    const args = buildCodexCliArgs("gpt-5.5", "low", true);
    expect(args.slice(0, 2)).toEqual(["--search", "exec"]);
  });

  it("builds Codex resume args with the stored provider session id", () => {
    const args = buildCodexResumeCliArgs("019e29db-8ec4-7ed2-ba49-4b6e02de6cf0", "gpt-5.5", true);
    expect(args.slice(0, 4)).toEqual([
      "--search",
      "exec",
      "resume",
      "--json",
    ]);
    expect(args).toContain("019e29db-8ec4-7ed2-ba49-4b6e02de6cf0");
    expect(args.at(-1)).toBe("-");
  });

  it("parses Codex JSON events into session, activity, and token signals", () => {
    expect(parseCodexJsonEvent(JSON.stringify({ type: "thread.started", thread_id: "thread-1" }))).toEqual({
      kind: "session",
      providerSessionId: "thread-1",
    });
    expect(parseCodexJsonEvent(JSON.stringify({ type: "turn.started" }))).toEqual({
      kind: "activity",
      activity: { kind: "thinking", label: "Thinking..." },
    });
    expect(parseCodexJsonEvent(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "Hello" } }))).toEqual({
      kind: "token",
      text: "Hello",
    });
  });

  it("extracts concise live progress from noisy Codex stderr", () => {
    expect(formatCliProgressLines([
      "OpenAI Codex v0.130.0",
      "--------",
      "user",
      "---",
      "name: main-agent",
      "description: very long hidden prompt",
      "exec \"powershell.exe\" -NoProfile -Command 'Get-ChildItem -Force' in D:\\Esa.Ai\\web",
      "succeeded in 1099ms:",
      "model: gpt-5.4",
      "reasoning effort: low",
    ].join("\n"))).toEqual([
      "OpenAI Codex v0.130.0",
      "model: gpt-5.4",
      "reasoning effort: low",
      "exec \"powershell.exe\" -NoProfile -Command 'Get-ChildItem -Force' in D:\\Esa.Ai\\web",
      "succeeded in 1099ms:",
    ]);
  });

  it("identifies user cancellation errors distinctly from model failures", () => {
    expect(isRunCancelledError(new RunCancelledError())).toBe(true);
    expect(isRunCancelledError(new Error("codex failed"))).toBe(false);
  });
});

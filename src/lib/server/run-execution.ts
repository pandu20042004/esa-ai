import "server-only";

import { spawn, type SpawnOptions } from "node:child_process";
import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { RunEventEmitter } from "@/lib/server/run-events";
import { collectRunSearchSources, formatSearchContext, type SearchSource } from "@/lib/server/run-search";
import { parseToolCalls, type WriteFileToolCall } from "@/lib/server/tool-calls";

export class RunCancelledError extends Error {
  constructor(message = "Run cancelled by user.") {
    super(message);
    this.name = "RunCancelledError";
  }
}

export function isRunCancelledError(error: unknown): error is RunCancelledError {
  return error instanceof RunCancelledError || (error instanceof Error && error.name === "RunCancelledError");
}

export type RunExecutionInput = {
  runId: string;
  userId: string;
  competitionId: string | null;
  stageId: string;
  pipelineNodeId: string | null;
  skillContent: string;
  userMessage: string;
  modelProvider: string;
  modelId: string;
  reasoningEffort: string;
  webSearch?: boolean;
  imageGeneration?: boolean;
  searchMode?: "fast" | "balanced" | "deep";
  providerSessionId?: string | null;
  stageSessionSummary?: string | null;
  inputFiles: Array<{
    fileId: string;
    fileName: string;
    fileRole: string;
    contentText: string | null;
    mimeType?: string | null;
    storageBucket?: string | null;
    storagePath?: string | null;
    signedUrl?: string | null;
  }>;
  isCancelled?: () => Promise<boolean>;
};

export type RunExecutionResult = {
  status: "completed" | "failed" | "needs_choice" | "cancelled";
  assistantText: string;
  toolCalls: WriteFileToolCall[];
  needsUserChoice?: Record<string, unknown>;
  providerSessionId?: string | null;
  summaryText?: string | null;
  errorMessage?: string;
};

/**
 * Execute a run end-to-end:
 *   1. Build prompt from skill + inputs + user message.
 *   2. Call the model (CLI or BYOK / env-key SDK).
 *   3. Stream tokens via RunEventEmitter.
 *   4. Parse tool calls and apply file writes.
 *   5. Record final assistant message, update agent_runs row.
 *
 * Throws nothing. Returns a status so the worker can translate to DB state.
 */
export async function executeRun(
  supabase: SupabaseClient,
  emitter: RunEventEmitter,
  input: RunExecutionInput,
): Promise<RunExecutionResult> {
  const searchSources = input.webSearch
    ? await collectRunSearchSources(supabase, emitter, {
      runId: input.runId,
      userId: input.userId,
      competitionId: input.competitionId,
      stageId: input.stageId,
      userMessage: input.userMessage,
      inputFiles: input.inputFiles,
      searchMode: input.searchMode,
    })
    : [];
  const prompt = buildPrompt(input, searchSources);

  await emitter.emit("status", { phase: "prompt_built", length: prompt.length });

  let assistantText = "";
  const abortController = new AbortController();
  const cancelCheck = input.isCancelled
    ? setInterval(() => {
        input.isCancelled?.()
          .then((cancelled) => {
            if (cancelled && !abortController.signal.aborted) {
              abortController.abort(new RunCancelledError());
            }
          })
          .catch(() => undefined);
      }, 1000)
    : null;

  let providerSessionId = input.providerSessionId ?? null;
  try {
    if (await input.isCancelled?.()) throw new RunCancelledError();
    if (!input.providerSessionId) {
      for (const file of input.inputFiles) {
        await emitter.emit("activity", {
          kind: "reading",
          label: `Reading ${file.fileName}`,
          fileName: file.fileName,
        });
      }
    }
    assistantText = await callModel({
      provider: input.modelProvider,
      modelId: input.modelId,
      reasoningEffort: input.reasoningEffort,
      prompt,
      webSearch: input.webSearch,
      providerSessionId: input.providerSessionId,
      signal: abortController.signal,
      onActivity: async (activity) => {
        if (activity.kind === "session") {
          providerSessionId = activity.providerSessionId;
          await emitter.emit("activity", { kind: "session", providerSessionId: activity.providerSessionId });
        } else if (activity.kind === "activity") {
          await emitter.emit("activity", activity.activity);
          if (activity.activity.kind === "searching" && activity.activity.url) {
            await recordRunSource(supabase, input, activity.activity).catch((error) => {
              console.error(`[run ${input.runId.slice(0, 8)}] source record failed:`, (error as Error).message);
            });
          }
        }
      },
      onToken: async (chunk) => {
        if (chunk) await emitter.emit("token", { text: chunk });
      },
      onStderr: async (chunk) => {
        if (chunk) {
          const text = chunk.trim();
          if (text) {
            console.error(`[run ${input.runId.slice(0, 8)}] CLI stderr: ${text}`);
            const progressLines = formatCliProgressLines(text);
            if (progressLines.length > 0) {
              await emitter.emit("progress", { source: input.modelProvider, lines: progressLines });
              await emitter.emit("status", { phase: "cli_progress", text: progressLines.at(-1)?.slice(0, 500) ?? "" });
            }
          }
        }
      },
    });
  } catch (err) {
    if (isRunCancelledError(err) || abortController.signal.aborted) {
      await emitter.emit("status", { phase: "cancelled", text: "Run cancelled by user." });
      return { status: "cancelled", assistantText, toolCalls: [], providerSessionId, errorMessage: "Run cancelled by user." };
    }
    const message = (err as Error).message ?? String(err);
    await emitter.emit("error", { reason: "model_call_failed", message });
    return { status: "failed", assistantText: "", toolCalls: [], providerSessionId, errorMessage: message };
  } finally {
    if (cancelCheck) clearInterval(cancelCheck);
  }

  const parsed = parseToolCalls(assistantText);

  for (const invalid of parsed.invalid) {
    await emitter.emit("error", { reason: "invalid_tool_call", detail: invalid.reason });
  }

  const appliedToolCalls: WriteFileToolCall[] = [];
  for (const call of parsed.toolCalls) {
    await emitter.emit("tool_call", { tool: call.tool, params: { ...call.params, content: `<${call.params.content.length} chars>` } });
    try {
      const fileResult = await applyWriteFile(supabase, input, call);
      await emitter.emit("tool_result", {
        tool: call.tool,
        ok: true,
        fileId: fileResult.fileId,
        fileName: call.params.file_name,
        bytes: Buffer.byteLength(call.params.content, "utf8"),
        newVersion: fileResult.newVersion,
      });
      appliedToolCalls.push(call);
    } catch (err) {
      await emitter.emit("tool_result", {
        tool: call.tool,
        ok: false,
        error: (err as Error).message ?? String(err),
      });
    }
  }

  const finalChat = parsed.chatText || (parsed.needsUserChoice ? parsed.needsUserChoice.question : appliedToolCalls.length > 0 ? "Saved stage output." : assistantText);
  const { data: messageRow, error: msgErr } = await supabase
    .from("agent_messages")
    .insert({
      competition_id: input.competitionId,
      user_id: input.userId,
      stage_id: input.stageId,
      thread_type: "stage",
      role: "assistant",
      content: finalChat,
      context: {
        runId: input.runId,
        toolCalls: appliedToolCalls.map((t) => t.params.artifact_key),
        needsUserChoice: parsed.needsUserChoice,
      },
    })
    .select("id")
    .single();
  if (msgErr) {
    await emitter.emit("error", { reason: "message_insert_failed", message: msgErr.message });
  } else {
    await emitter.emit("message", { id: String(messageRow.id), content: finalChat });
  }

  if (parsed.needsUserChoice) {
    await supabase
      .from("agent_runs")
      .update({ needs_user_choice: parsed.needsUserChoice })
      .eq("id", input.runId)
      .eq("user_id", input.userId);
    await emitter.emit("choice", parsed.needsUserChoice);
    await emitter.emit("status", { phase: "needs_choice" });
    return { status: "needs_choice", assistantText, toolCalls: appliedToolCalls, needsUserChoice: parsed.needsUserChoice, providerSessionId, summaryText: buildRunSummary(input, finalChat, appliedToolCalls.length) };
  }

  await emitter.emit("status", { phase: "completed", toolCalls: appliedToolCalls.length });
  return { status: "completed", assistantText, toolCalls: appliedToolCalls, providerSessionId, summaryText: buildRunSummary(input, finalChat, appliedToolCalls.length) };
}

// --- Prompt builder ------------------------------------------------------------------

function buildPrompt(input: RunExecutionInput, searchSources: SearchSource[] = []): string {
  if (input.providerSessionId) {
    return buildFollowUpPrompt({
      stageId: input.stageId,
      userMessage: input.userMessage,
      summaryText: input.stageSessionSummary,
      searchContext: input.webSearch ? formatSearchContext(searchSources) : null,
    });
  }

  const inputSections = input.inputFiles
    .map((f) => {
      const header = `### Input: ${f.fileName} (role: ${f.fileRole})`;
      const metadata = [
        f.mimeType ? `MIME: ${f.mimeType}` : null,
        f.storageBucket && f.storagePath ? `Storage: ${f.storageBucket}/${f.storagePath}` : null,
        f.signedUrl ? `Signed URL: ${f.signedUrl}` : null,
      ].filter(Boolean).join("\n");
      const body = f.contentText && f.contentText.trim().length > 0
        ? f.contentText.slice(0, 120_000)
        : "(binary or empty — no text extracted)";
      return `${header}${metadata ? `\n${metadata}` : ""}\n${body}`;
    })
    .join("\n\n");

  const userLine = input.userMessage.trim().length > 0 ? input.userMessage.trim() : "Run this stage now.";

  return [
    input.skillContent,
    "",
    "## Run context",
    `- Stage: ${input.stageId}`,
    `- Model: ${input.modelProvider}:${input.modelId} (reasoning: ${input.reasoningEffort})`,
    `- Web search: ${input.webSearch ? "enabled" : "disabled"}`,
    `- Image generation mode: ${input.imageGeneration ? "enabled" : "disabled"}`,
    input.webSearch
      ? "- When the stage requires current evidence, trends, websites, or URLs, use live web search and cite the sources in the saved output."
      : "- Do not browse the web unless the model/provider exposes a required built-in tool for this run.",
    input.imageGeneration
      ? "- If the user asks for image generation, produce a production-ready image prompt/spec in the stage output. The web app records the intent; raster generation requires an image-capable backend endpoint."
      : "- Do not create image prompts unless the user explicitly asks for visual assets.",
    input.webSearch ? formatSearchContext(searchSources) : "",
    "",
    "## Inputs",
    inputSections || "(no input files)",
    "",
    "## User message",
    userLine,
  ].join("\n");
}

function buildFollowUpPrompt(input: { stageId: string; userMessage: string; summaryText?: string | null; searchContext?: string | null }): string {
  return [
    "## Stage follow-up",
    `- Stage: ${input.stageId}`,
    "- Continue the existing stage conversation.",
    "- Use the already-loaded skill, guidebook, and upstream context from this provider session.",
    input.summaryText ? `- Current stage memory: ${input.summaryText.slice(0, 4000)}` : null,
    input.searchContext ?? null,
    "",
    "## User message",
    input.userMessage.trim() || "Continue.",
  ].filter((line): line is string => typeof line === "string").join("\n");
}

function buildRunSummary(input: RunExecutionInput, finalChat: string, toolCallCount: number): string {
  const prior = input.stageSessionSummary?.trim();
  const next = [
    prior ? `Previous: ${prior.slice(0, 3000)}` : null,
    `Last stage: ${input.stageId}.`,
    `Last user message: ${input.userMessage.trim().slice(0, 1000) || "Run this stage now."}`,
    `Last assistant result: ${finalChat.slice(0, 2000)}`,
    `Files written: ${toolCallCount}.`,
  ].filter(Boolean).join("\n");
  return next.slice(0, 6000);
}

// --- Model dispatch ------------------------------------------------------------------

type CallModelArgs = {
  provider: string;
  modelId: string;
  reasoningEffort: string;
  webSearch?: boolean;
  prompt: string;
  onToken: (chunk: string) => Promise<void> | void;
  onStderr?: (chunk: string) => Promise<void> | void;
  signal?: AbortSignal;
  providerSessionId?: string | null;
  onActivity?: (activity: CodexParsedEvent) => Promise<void> | void;
};

export type RunActivity =
  | { kind: "thinking"; label: string }
  | { kind: "searching"; label: string; url?: string; domain?: string }
  | { kind: "reading"; label: string; fileName?: string }
  | { kind: "tool"; label: string; tool?: string }
  | { kind: "writing"; label: string };

export type CodexParsedEvent =
  | { kind: "session"; providerSessionId: string }
  | { kind: "activity"; activity: RunActivity }
  | { kind: "token"; text: string };

async function callModel(args: CallModelArgs): Promise<string> {
  if (args.provider === "claude-code") return callClaudeCli(args);
  if (args.provider === "codex-cli") return callCodexCli(args);
  if (args.provider === "gemini-cli") return callGeminiCli(args);
  if (args.provider === "openclaw") return callOpenClawCli(args);
  if (args.provider === "mock-cli") return callMockCli(args);
  if (args.provider === "openai-api") return callOpenAiApi(args);
  if (args.provider === "anthropic-api") return callAnthropicApi(args);
  if (args.provider === "openrouter") return callOpenRouterApi(args);
  throw new Error(`Unsupported model provider: ${args.provider}`);
}

async function callClaudeCli(args: CallModelArgs): Promise<string> {
  return streamSpawnWithStdin("claude", ["--model", args.modelId, "-p", "--permission-mode", "bypassPermissions"], args.prompt, args.onToken, args.onStderr, args.signal);
}

async function callCodexCli(args: CallModelArgs): Promise<string> {
  return streamSpawnWithStdin(
    "codex",
    args.providerSessionId
      ? buildCodexResumeCliArgs(args.providerSessionId, args.modelId, args.webSearch, args.reasoningEffort)
      : buildCodexCliArgs(args.modelId, args.reasoningEffort, args.webSearch),
    args.prompt,
    args.onToken,
    args.onStderr,
    args.signal,
    parseCodexJsonEvent,
    args.onActivity,
  );
}

async function callGeminiCli(args: CallModelArgs): Promise<string> {
  return streamSpawnWithStdin("gemini", ["--model", args.modelId, "-p", "-"], args.prompt, args.onToken, args.onStderr, args.signal);
}

async function callOpenClawCli(args: CallModelArgs): Promise<string> {
  const raw = await streamSpawn(
    "openclaw",
    ["infer", "model", "run", "--local", "--json", "--model", args.modelId, "--prompt", args.prompt],
    () => undefined,
    args.signal,
  );
  const text = extractOpenClawText(raw);
  await args.onToken(text);
  return text;
}

function extractOpenClawText(raw: string): string {
  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    for (const key of ["text", "output", "content", "message", "response"]) {
      if (typeof json[key] === "string") return json[key];
    }
    const nested = json.result;
    if (nested && typeof nested === "object") {
      for (const key of ["text", "output", "content", "message", "response"]) {
        const value = (nested as Record<string, unknown>)[key];
        if (typeof value === "string") return value;
      }
    }
  } catch {
    // OpenClaw can return plain text on older versions.
  }
  return raw;
}

async function callMockCli(args: CallModelArgs): Promise<string> {
  // Deterministic mock for tests. Echoes a tool_call that writes a short file.
  const text = [
    "I will produce a short onboarding map.",
    "",
    "```tool",
    JSON.stringify({
      tool: "write_file",
      params: {
        artifact_key: "onboarding_map",
        file_name: "01_onboarding_map.md",
        file_role: "stage_output",
        artifact_role: "onboarding_map",
        content: `# Onboarding Map\n\nPrompt length: ${args.prompt.length} chars\n\n- Run complete.`,
      },
    }),
    "```",
    "",
    "Done.",
  ].join("\n");
  // stream chunks in 80-char pieces
  for (let i = 0; i < text.length; i += 80) {
    const chunk = text.slice(i, i + 80);
    await args.onToken(chunk);
  }
  return text;
}

function streamSpawn(
  command: string,
  cliArgs: string[],
  onToken: (s: string) => Promise<void> | void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const spawnCommand = resolveSpawnCommandForPlatform(command);
    const child = spawn(spawnCommand.command, cliArgs, { shell: spawnCommand.shell });
    const abort = () => {
      killChildProcessTree(child.pid);
      reject(new RunCancelledError());
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    let out = "";
    let err = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      out += chunk;
      void onToken(chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      err += chunk;
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      signal?.removeEventListener("abort", abort);
      if (code === 0) resolve(out);
      else reject(new Error(`${command} exited with code ${code}: ${err.slice(0, 500)}`));
    });
  });
}

function streamSpawnWithStdin(
  command: string,
  cliArgs: string[],
  stdinData: string,
  onToken: (s: string) => Promise<void> | void,
  onStderr?: (s: string) => Promise<void> | void,
  signal?: AbortSignal,
  parseStdoutLine?: (line: string) => CodexParsedEvent | null,
  onActivity?: (activity: CodexParsedEvent) => Promise<void> | void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`[run-exec] spawning: ${command} ${cliArgs.join(" ")} (stdin: ${stdinData.length} chars)`);
    const spawnCommand = resolveSpawnCommandForPlatform(command);
    const child = spawn(spawnCommand.command, cliArgs, { shell: spawnCommand.shell });
    let settled = false;
    const finishReject = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const abort = () => {
      killChildProcessTree(child.pid);
      finishReject(new RunCancelledError());
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    let out = "";
    let err = "";
    let stdoutBuffer = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (!parseStdoutLine) {
        out += chunk;
        void onToken(chunk);
        return;
      }
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const event = parseStdoutLine(line);
        if (!event) continue;
        if (event.kind === "token") {
          out += event.text;
          void onToken(event.text);
        } else if (onActivity) {
          void onActivity(event);
        }
      }
    });
    child.stderr.on("data", (chunk: string) => {
      err += chunk;
      if (onStderr) void onStderr(chunk);
    });
    child.on("error", (error) => finishReject(error));
    child.on("close", (code) => {
      signal?.removeEventListener("abort", abort);
      if (settled) return;
      settled = true;
      if (parseStdoutLine && stdoutBuffer.trim()) {
        const event = parseStdoutLine(stdoutBuffer);
        if (event?.kind === "token") out += event.text;
      }
      if (code === 0) resolve(out);
      else reject(new Error(`${command} ${cliArgs.slice(0, 3).join(" ")} exited with code ${code}.${err ? " stderr: " + err.slice(0, 800) : ""}`));
    });

    // Pipe prompt via stdin
    child.stdin.on("error", (error) => {
      finishReject(error);
    });
    child.stdin.write(stdinData, "utf8");
    child.stdin.end();
  });
}

function killChildProcessTree(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { shell: false, stdio: "ignore" });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process already exited.
    }
  }
}

export function resolveSpawnCommandForPlatform(command: string, platform: NodeJS.Platform = process.platform): Pick<SpawnOptions, "shell"> & { command: string } {
  return {
    command,
    shell: platform === "win32",
  };
}

export function buildCodexCliArgs(modelId: string, reasoningEffort: string, webSearch = false): string[] {
  const args = [
    "exec",
    "--json",
    "--ignore-user-config",
    "--ignore-rules",
    "--disable",
    "plugins",
    "--model",
    modelId,
    "--skip-git-repo-check",
    "--dangerously-bypass-approvals-and-sandbox",
    "-c",
    `model_reasoning_effort="${reasoningEffort}"`,
    "-c",
    "mcp.remote_mcp_client_enabled=false",
    "-",
  ];
  return webSearch ? ["--search", ...args] : args;
}

export function buildCodexResumeCliArgs(providerSessionId: string, modelId: string, webSearch = false, reasoningEffort = "medium"): string[] {
  const args = [
    "exec",
    "resume",
    "--json",
    "--ignore-user-config",
    "--ignore-rules",
    "--disable",
    "plugins",
    "--model",
    modelId,
    "--skip-git-repo-check",
    "--dangerously-bypass-approvals-and-sandbox",
    "-c",
    `model_reasoning_effort="${reasoningEffort}"`,
    "-c",
    "mcp.remote_mcp_client_enabled=false",
    providerSessionId,
    "-",
  ];
  return webSearch ? ["--search", ...args] : args;
}

export function parseCodexJsonEvent(line: string): CodexParsedEvent | null {
  if (!line.trim().startsWith("{")) return null;
  try {
    const event = JSON.parse(line) as Record<string, unknown>;
    const type = String(event.type ?? "");
    if (type === "thread.started" && typeof event.thread_id === "string") {
      return { kind: "session", providerSessionId: event.thread_id };
    }
    if (type === "turn.started") {
      return { kind: "activity", activity: { kind: "thinking", label: "Thinking..." } };
    }
    if (type === "item.completed") {
      const item = event.item as Record<string, unknown> | undefined;
      if (item?.type === "agent_message" && typeof item.text === "string") {
        return { kind: "token", text: item.text };
      }
      const activity = activityFromCodexItem(item);
      return activity ? { kind: "activity", activity } : null;
    }
    if (/web_search|search/i.test(type)) {
      const url = typeof event.url === "string" ? event.url : undefined;
      return { kind: "activity", activity: { kind: "searching", label: url ? `Searching ${domainFromUrl(url)}` : "Searching web", url, domain: url ? domainFromUrl(url) : undefined } };
    }
  } catch {
    return null;
  }
  return null;
}

function activityFromCodexItem(item: Record<string, unknown> | undefined): RunActivity | null {
  if (!item) return null;
  const type = String(item.type ?? "");
  const text = typeof item.text === "string" ? item.text : "";
  if (/web_search|search/i.test(type) || /\bsearching\b/i.test(text)) {
    const url = firstUrl(text);
    return { kind: "searching", label: url ? `Searching ${domainFromUrl(url)}` : "Searching web", url, domain: url ? domainFromUrl(url) : undefined };
  }
  if (/tool|function/i.test(type)) {
    return { kind: "tool", label: "Using tool", tool: type };
  }
  return null;
}

function firstUrl(text: string): string | undefined {
  return text.match(/https?:\/\/[^\s)]+/i)?.[0];
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function recordRunSource(
  supabase: SupabaseClient,
  input: RunExecutionInput,
  activity: Extract<RunActivity, { kind: "searching" }>,
): Promise<void> {
  if (!activity.url) return;
  await supabase.from("run_sources").insert({
    user_id: input.userId,
    run_id: input.runId,
    competition_id: input.competitionId,
    stage_id: input.stageId,
    url: activity.url,
    domain: activity.domain ?? domainFromUrl(activity.url),
    provider: input.modelProvider,
    captured_from: "provider_event",
    metadata: { label: activity.label },
  });
}

export function formatCliProgressLines(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const intro = new Set<string>();
  const commands = new Set<string>();
  const errors = new Set<string>();

  for (const line of lines) {
    if (line.length > 500) continue;
    if (/^OpenAI Codex\b/i.test(line)) intro.add(line);
    if (/^model:\s+/i.test(line)) intro.add(line);
    if (/^reasoning effort:\s+/i.test(line)) intro.add(line);
    if (/^exec\b/i.test(line)) commands.add(line);
    if (/^(succeeded|failed) in \d+/i.test(line)) commands.add(line);
    if (/\bERROR\b|error:/i.test(line)) errors.add(line);
    if (/^worker\b|^tool\b|^saved\b/i.test(line)) commands.add(line);
  }

  return [...intro, ...commands, ...errors].slice(-12);
}

async function callOpenAiApi(args: CallModelArgs): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: args.modelId,
      messages: [{ role: "user", content: args.prompt }],
      stream: true,
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  }
  return consumeSseStream(response.body, args.onToken, (line) => {
    try {
      const json = JSON.parse(line);
      return json?.choices?.[0]?.delta?.content ?? "";
    } catch {
      return "";
    }
  });
}

async function callAnthropicApi(args: CallModelArgs): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set.");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: args.modelId,
      max_tokens: 8192,
      stream: true,
      messages: [{ role: "user", content: args.prompt }],
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
  }
  return consumeSseStream(response.body, args.onToken, (line) => {
    try {
      const json = JSON.parse(line);
      if (json.type === "content_block_delta") return json.delta?.text ?? "";
      return "";
    } catch {
      return "";
    }
  });
}

async function callOpenRouterApi(args: CallModelArgs): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set.");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: args.modelId,
      messages: [{ role: "user", content: args.prompt }],
      stream: true,
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`OpenRouter ${response.status}: ${await response.text()}`);
  }
  return consumeSseStream(response.body, args.onToken, (line) => {
    try {
      const json = JSON.parse(line);
      return json?.choices?.[0]?.delta?.content ?? "";
    } catch {
      return "";
    }
  });
}

async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  onToken: (s: string) => Promise<void> | void,
  extract: (line: string) => string,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      const text = extract(data);
      if (text) {
        full += text;
        await onToken(text);
      }
    }
  }
  return full;
}

// --- Tool application ----------------------------------------------------------------

async function applyWriteFile(
  supabase: SupabaseClient,
  input: RunExecutionInput,
  call: WriteFileToolCall,
): Promise<{ fileId: string; newVersion: number }> {
  const content = call.params.content;
  const contentBytes = Buffer.byteLength(content, "utf8");
  const scopedToCompetition = Boolean(input.competitionId);

  // Look up existing file for this scope + artifact_role.
  let existingQuery = supabase
    .from("competition_files")
    .select("id, storage_bucket, storage_path, content_text")
    .eq("user_id", input.userId)
    .eq("artifact_role", call.params.artifact_role);
  existingQuery = scopedToCompetition
    ? existingQuery.eq("competition_id", input.competitionId!)
    : existingQuery.is("competition_id", null);
  const { data: existing, error: lookupErr } = await existingQuery.maybeSingle();
  if (lookupErr) throw new Error(`tool/write_file lookup failed: ${lookupErr.message}`);

  const storageBucket = scopedToCompetition ? "agent-outputs" : "profile-assets";
  const storagePath = scopedToCompetition
    ? `${input.userId}/${input.competitionId}/${call.params.artifact_role}.md`
    : `${input.userId}/style/${call.params.artifact_role}.md`;

  // Upload to storage (upsert).
  const uploadRes = await supabase.storage
    .from(storageBucket)
    .upload(storagePath, Buffer.from(content, "utf8"), {
      contentType: "text/markdown",
      upsert: true,
    });
  if (uploadRes.error) throw new Error(`tool/write_file upload failed: ${uploadRes.error.message}`);

  let fileId: string;
  let newVersion = 1;

  if (existing) {
    fileId = String(existing.id);

    // Snapshot prior content into output_versions.
    const priorText = typeof existing.content_text === "string" ? existing.content_text : null;
    if (priorText) {
      const { data: priorVersions, error: priorErr } = await supabase
        .from("output_versions")
        .select("version_number")
        .eq("file_id", fileId)
        .order("version_number", { ascending: false })
        .limit(1);
      if (priorErr) throw new Error(`tool/write_file version lookup: ${priorErr.message}`);
      const nextVersion = (priorVersions?.[0]?.version_number ?? 0) + 1;
      newVersion = nextVersion + 1;

      const { error: snapshotErr } = await supabase.from("output_versions").insert({
        user_id: input.userId,
        file_id: fileId,
        version_number: nextVersion,
        content_text: priorText,
        change_summary: `Auto-snapshot before run ${input.runId.slice(0, 8)}.`,
        status: "archived",
        created_by_run_id: input.runId,
      });
      if (snapshotErr) throw new Error(`tool/write_file snapshot: ${snapshotErr.message}`);
    }

    const { error: updateErr } = await supabase
      .from("competition_files")
      .update({
        file_name: call.params.file_name,
        file_role: call.params.file_role,
        file_source: "agent_output",
        artifact_key: call.params.artifact_key,
        artifact_role: call.params.artifact_role,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        mime_type: "text/markdown",
        size_bytes: contentBytes,
        content_text: content,
        status: "draft",
        approved: false,
        approved_at: null,
        approved_by: null,
        producer_node_id: input.pipelineNodeId,
        stage_id: input.stageId,
      })
      .eq("id", fileId)
      .eq("user_id", input.userId);
    if (updateErr) throw new Error(`tool/write_file update: ${updateErr.message}`);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("competition_files")
      .insert({
        id: randomUUID(),
        user_id: input.userId,
        competition_id: input.competitionId,
        file_name: call.params.file_name,
        file_role: call.params.file_role,
        file_source: "agent_output",
        artifact_key: call.params.artifact_key,
        artifact_role: call.params.artifact_role,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        mime_type: "text/markdown",
        size_bytes: contentBytes,
        content_text: content,
        status: "draft",
        approved: false,
        producer_node_id: input.pipelineNodeId,
        stage_id: input.stageId,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(`tool/write_file insert: ${insErr.message}`);
    fileId = String(inserted.id);
    newVersion = 1;
  }

  // Update agent_runs.output_file_id to point at the produced file.
  const { error: runUpdateErr } = await supabase
    .from("agent_runs")
    .update({ output_file_id: fileId })
    .eq("id", input.runId)
    .eq("user_id", input.userId);
  if (runUpdateErr) throw new Error(`tool/write_file run link: ${runUpdateErr.message}`);

  return { fileId, newVersion };
}

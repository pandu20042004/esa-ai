import "server-only";

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { RunEventEmitter } from "@/lib/server/run-events";
import { parseToolCalls, type WriteFileToolCall } from "@/lib/server/tool-calls";

export type RunExecutionInput = {
  runId: string;
  userId: string;
  competitionId: string;
  stageId: string;
  pipelineNodeId: string | null;
  skillContent: string;
  userMessage: string;
  modelProvider: string;
  modelId: string;
  reasoningEffort: string;
  inputFiles: Array<{
    fileId: string;
    fileName: string;
    fileRole: string;
    contentText: string | null;
  }>;
};

export type RunExecutionResult = {
  status: "completed" | "failed";
  assistantText: string;
  toolCalls: WriteFileToolCall[];
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
  const prompt = buildPrompt(input);

  await emitter.emit("status", { phase: "prompt_built", length: prompt.length });

  let assistantText = "";
  try {
    assistantText = await callModel({
      provider: input.modelProvider,
      modelId: input.modelId,
      reasoningEffort: input.reasoningEffort,
      prompt,
      onToken: async (chunk) => {
        if (chunk) await emitter.emit("token", { text: chunk });
      },
    });
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    await emitter.emit("error", { reason: "model_call_failed", message });
    return { status: "failed", assistantText: "", toolCalls: [], errorMessage: message };
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

  const finalChat = parsed.chatText || (appliedToolCalls.length > 0 ? "Saved stage output." : assistantText);
  const { data: messageRow, error: msgErr } = await supabase
    .from("agent_messages")
    .insert({
      competition_id: input.competitionId,
      user_id: input.userId,
      stage_id: input.stageId,
      thread_type: "stage",
      role: "assistant",
      content: finalChat,
      context: { runId: input.runId, toolCalls: appliedToolCalls.map((t) => t.params.artifact_key) },
    })
    .select("id")
    .single();
  if (msgErr) {
    await emitter.emit("error", { reason: "message_insert_failed", message: msgErr.message });
  } else {
    await emitter.emit("message", { id: String(messageRow.id), content: finalChat });
  }

  await emitter.emit("status", { phase: "completed", toolCalls: appliedToolCalls.length });
  return { status: "completed", assistantText, toolCalls: appliedToolCalls };
}

// --- Prompt builder ------------------------------------------------------------------

function buildPrompt(input: RunExecutionInput): string {
  const inputSections = input.inputFiles
    .map((f) => {
      const header = `### Input: ${f.fileName} (role: ${f.fileRole})`;
      const body = f.contentText && f.contentText.trim().length > 0
        ? f.contentText.slice(0, 120_000)
        : "(binary or empty — no text extracted)";
      return `${header}\n${body}`;
    })
    .join("\n\n");

  const userLine = input.userMessage.trim().length > 0 ? input.userMessage.trim() : "Run this stage now.";

  return [
    input.skillContent,
    "",
    "## Run context",
    `- Stage: ${input.stageId}`,
    `- Model: ${input.modelProvider}:${input.modelId} (reasoning: ${input.reasoningEffort})`,
    "",
    "## Inputs",
    inputSections || "(no input files)",
    "",
    "## User message",
    userLine,
  ].join("\n");
}

// --- Model dispatch ------------------------------------------------------------------

type CallModelArgs = {
  provider: string;
  modelId: string;
  reasoningEffort: string;
  prompt: string;
  onToken: (chunk: string) => Promise<void> | void;
};

async function callModel(args: CallModelArgs): Promise<string> {
  if (args.provider === "claude-code") return callClaudeCli(args);
  if (args.provider === "codex-cli") return callCodexCli(args);
  if (args.provider === "gemini-cli") return callGeminiCli(args);
  if (args.provider === "mock-cli") return callMockCli(args);
  if (args.provider === "openai-api") return callOpenAiApi(args);
  if (args.provider === "anthropic-api") return callAnthropicApi(args);
  if (args.provider === "openrouter") return callOpenRouterApi(args);
  throw new Error(`Unsupported model provider: ${args.provider}`);
}

async function callClaudeCli(args: CallModelArgs): Promise<string> {
  return streamSpawn("claude", ["--model", args.modelId, "-p", args.prompt], args.onToken);
}

async function callCodexCli(args: CallModelArgs): Promise<string> {
  return streamSpawn("codex", ["exec", "--model", args.modelId, args.prompt], args.onToken);
}

async function callGeminiCli(args: CallModelArgs): Promise<string> {
  return streamSpawn("gemini", ["--model", args.modelId, "-p", args.prompt], args.onToken);
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
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, cliArgs, { shell: false });
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
      if (code === 0) resolve(out);
      else reject(new Error(`${command} exited with code ${code}: ${err.slice(0, 500)}`));
    });
  });
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

  // Look up existing file for this competition + artifact_role.
  const { data: existing, error: lookupErr } = await supabase
    .from("competition_files")
    .select("id, storage_bucket, storage_path, content_text")
    .eq("competition_id", input.competitionId)
    .eq("user_id", input.userId)
    .eq("artifact_role", call.params.artifact_role)
    .maybeSingle();
  if (lookupErr) throw new Error(`tool/write_file lookup failed: ${lookupErr.message}`);

  const storageBucket = "agent-outputs";
  const storagePath = `${input.userId}/${input.competitionId}/${call.params.artifact_role}.md`;

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

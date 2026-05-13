import "server-only";

import { z } from "zod";

// Subset of FileRole the agent can write. Keep conservative for ship-one.
const AGENT_WRITABLE_ROLES = [
  "stage_output",
  "research_output",
  "final_output",
  "style_profile",
] as const;

const writeFileParamsSchema = z.object({
  artifact_key: z.string().regex(/^[a-z0-9_]+$/).min(1).max(80),
  file_name: z.string().min(1).max(200),
  file_role: z.enum(AGENT_WRITABLE_ROLES),
  artifact_role: z.string().regex(/^[a-z0-9_]+$/).min(1).max(80),
  content: z.string().min(1).max(400_000),
});

export type WriteFileToolCall = {
  tool: "write_file";
  params: z.infer<typeof writeFileParamsSchema>;
};

export type InvalidToolCall = {
  raw: string;
  reason: string;
};

export type ToolCallParseResult = {
  chatText: string; // the remaining assistant prose after stripping tool blocks
  toolCalls: WriteFileToolCall[];
  invalid: InvalidToolCall[];
};

const toolFenceRegex = /```tool\s*\n([\s\S]*?)\n```/g;

/**
 * Scan an assistant response for ```tool fenced JSON blocks, extract and validate them.
 *
 * - Returns the prose with tool blocks removed.
 * - Valid tool calls are parsed against the Zod schema.
 * - Invalid blocks (bad JSON / bad shape) are collected in `invalid` so the caller can
 *   surface them as error events without failing the whole run.
 */
export function parseToolCalls(assistantText: string): ToolCallParseResult {
  const toolCalls: WriteFileToolCall[] = [];
  const invalid: InvalidToolCall[] = [];

  const chatText = assistantText.replace(toolFenceRegex, (_match, body: string) => {
    const trimmed = body.trim();
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch (err) {
      invalid.push({ raw: trimmed, reason: `Invalid JSON: ${(err as Error).message}` });
      return ""; // still strip the block from prose
    }
    if (!data || typeof data !== "object" || (data as { tool?: unknown }).tool !== "write_file") {
      invalid.push({ raw: trimmed, reason: "Unsupported or missing tool name." });
      return "";
    }
    const parsed = writeFileParamsSchema.safeParse((data as { params?: unknown }).params);
    if (!parsed.success) {
      invalid.push({ raw: trimmed, reason: `Invalid params: ${parsed.error.message}` });
      return "";
    }
    toolCalls.push({ tool: "write_file", params: parsed.data });
    return "";
  });

  return {
    chatText: chatText.replace(/\n{3,}/g, "\n\n").trim(),
    toolCalls,
    invalid,
  };
}

/**
 * Produce the system prompt fragment that tells the model how to emit tool calls.
 * Appended to the agent's skill content at run start.
 */
export function toolProtocolInstructions(): string {
  return [
    "",
    "## Tool protocol",
    "",
    "When you want to save a file as this stage's output, emit a fenced JSON block with the tag `tool`:",
    "",
    "```tool",
    "{",
    '  "tool": "write_file",',
    '  "params": {',
    '    "artifact_key": "onboarding_map",',
    '    "file_name": "01_onboarding_map.md",',
    '    "file_role": "stage_output",',
    '    "artifact_role": "onboarding_map",',
    '    "content": "# Onboarding Map\\n..."',
    "  }",
    "}",
    "```",
    "",
    "Rules:",
    "- Anything outside a ```tool fenced block is shown to the user as chat.",
    "- You may include both prose and one or more tool calls in the same response.",
    "- `artifact_key` and `artifact_role` must be lowercase letters, numbers, or underscores.",
    "- Do not wrap file content in extra code fences inside the JSON; escape newlines with `\\n`.",
    "",
  ].join("\n");
}

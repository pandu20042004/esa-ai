import { z } from "zod";

import { errorResponse } from "@/lib/server/api-errors";
import { unauthorizedResponse, getRequestUser } from "@/lib/server/auth";
import { getAllAvailableModels } from "@/lib/server/cli-providers";
import { preflightMainAgentRun } from "@/lib/server/run-preflight";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const STAGES_SUPPORTED = ["onboarding"] as const;

const runSchema = z.object({
  competitionId: z.string().uuid(),
  stageId: z.enum(STAGES_SUPPORTED),
  modelProvider: z.string().trim().min(1),
  modelId: z.string().trim().min(1),
  reasoningEffort: z.enum(["low", "medium", "high", "xhigh"]).default("medium"),
  userMessage: z.string().max(8000).optional(),
});

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const supabase = createSupabaseAdminClient();
  if (!supabase) return errorResponse({ message: "Supabase admin not configured.", code: "ERR_NO_ADMIN", status: 500 });

  const body = await request.json().catch(() => ({}));
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse({
      message: "Invalid run payload.",
      code: "ERR_VALIDATION",
      status: 400,
      details: { issues: parsed.error.flatten() },
    });
  }

  // Validate model exists.
  const allModels = getAllAvailableModels();
  const modelMatch = allModels.find(
    (m) => m.provider === parsed.data.modelProvider && m.id === parsed.data.modelId,
  );
  if (!modelMatch) {
    return errorResponse({
      message: "Unknown model. Install a CLI or set API key in .env.",
      code: "ERR_MODEL_UNKNOWN",
      status: 400,
      details: { provider: parsed.data.modelProvider, id: parsed.data.modelId },
    });
  }

  const preflight = await preflightMainAgentRun(supabase, user.id, parsed.data.competitionId);
  if (!preflight.ok) {
    return errorResponse({ message: preflight.message, code: preflight.code, status: 400 });
  }

  // Insert the trigger user message (always — even when click-to-start with blank message).
  const triggerText = parsed.data.userMessage?.trim() || "[Run Main Agent]";
  const { data: msgRow, error: msgErr } = await supabase
    .from("agent_messages")
    .insert({
      competition_id: parsed.data.competitionId,
      user_id: user.id,
      stage_id: parsed.data.stageId,
      thread_type: "stage",
      role: "user",
      content: triggerText,
      model_provider: parsed.data.modelProvider,
      model_id: parsed.data.modelId,
      reasoning_effort: parsed.data.reasoningEffort,
      context: { trigger: parsed.data.userMessage ? "chat" : "manual" },
    })
    .select("id")
    .single();
  if (msgErr) {
    return errorResponse({ message: msgErr.message, code: "ERR_MESSAGE_INSERT", status: 500 });
  }

  // Insert the agent_runs row as queued.
  const { data: runRow, error: runErr } = await supabase
    .from("agent_runs")
    .insert({
      competition_id: parsed.data.competitionId,
      user_id: user.id,
      stage_id: parsed.data.stageId,
      pipeline_id: preflight.pipelineId,
      pipeline_node_id: preflight.pipelineNodeId,
      skill_version_id: preflight.skillVersionId,
      status: "queued",
      model_provider: parsed.data.modelProvider,
      model_id: parsed.data.modelId,
      reasoning_effort: parsed.data.reasoningEffort,
      input_file_ids: [preflight.guidebookFileId],
      context_snapshot: {
        inputFiles: preflight.inputFiles,
        userMessage: triggerText,
      },
      queued_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (runErr) {
    return errorResponse({ message: runErr.message, code: "ERR_RUN_INSERT", status: 500 });
  }

  return Response.json(
    {
      data: {
        runId: String(runRow.id),
        messageId: String(msgRow.id),
        skillVersionId: preflight.skillVersionId,
        pipelineNodeId: preflight.pipelineNodeId,
      },
    },
    { status: 202 },
  );
}

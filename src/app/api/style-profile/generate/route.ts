import { z } from "zod";

import { errorResponse } from "@/lib/server/api-errors";
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { getAllAvailableModels } from "@/lib/server/cli-providers";
import {
  ensureStyleBuilderUserAgent,
  getEssayCompartmentId,
} from "@/lib/server/pipeline-bootstrap";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  modelProvider: z.string().trim().min(1),
  modelId: z.string().trim().min(1),
  reasoningEffort: z.enum(["low", "medium", "high", "xhigh"]).default("medium"),
  userMessage: z.string().max(8000).optional(),
});

/**
 * POST /api/style-profile/generate
 * Queues an agent_runs row that runs the Style Profile Builder skill against
 * all user-level style_profile_source files. Competition_id is NULL.
 */
export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const supabase = createSupabaseAdminClient();
  if (!supabase) return errorResponse({ message: "Supabase admin not configured.", code: "ERR_NO_ADMIN", status: 500 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse({
      message: "Invalid payload.",
      code: "ERR_VALIDATION",
      status: 400,
      details: { issues: parsed.error.flatten() },
    });
  }

  const allModels = getAllAvailableModels();
  const modelMatch = allModels.find(
    (m) => m.provider === parsed.data.modelProvider && m.id === parsed.data.modelId,
  );
  if (!modelMatch) {
    return errorResponse({
      message: "Unknown model. Install a CLI or set API key in .env.",
      code: "ERR_MODEL_UNKNOWN",
      status: 400,
    });
  }

  // Load all source files.
  const { data: sources, error: srcErr } = await supabase
    .from("competition_files")
    .select("id, file_name, content_text")
    .eq("user_id", user.id)
    .is("competition_id", null)
    .eq("file_role", "style_profile_source")
    .order("created_at", { ascending: true });
  if (srcErr) return errorResponse({ message: srcErr.message, code: "ERR_SOURCES", status: 500 });

  if (!sources || sources.length === 0) {
    return errorResponse({
      message: "Upload at least one essay PDF before generating the style profile.",
      code: "ERR_NO_SOURCES",
      status: 400,
    });
  }

  const compartmentId = await getEssayCompartmentId(supabase, user.id);
  const { activeSkillVersionId } = await ensureStyleBuilderUserAgent(supabase, user.id, compartmentId);

  const inputFiles = sources.map((row) => ({
    fileId: String(row.id),
    fileName: String(row.file_name ?? "source.pdf"),
    fileRole: "style_profile_source",
    contentText: typeof row.content_text === "string" ? row.content_text : null,
  }));

  const triggerText = parsed.data.userMessage?.trim() || "[Generate Style Profile]";

  const { data: msg, error: msgErr } = await supabase
    .from("agent_messages")
    .insert({
      competition_id: null,
      user_id: user.id,
      stage_id: "style",
      thread_type: "style_profile",
      role: "user",
      content: triggerText,
      model_provider: parsed.data.modelProvider,
      model_id: parsed.data.modelId,
      reasoning_effort: parsed.data.reasoningEffort,
      context: { trigger: parsed.data.userMessage ? "chat" : "manual" },
    })
    .select("id")
    .single();
  if (msgErr) return errorResponse({ message: msgErr.message, code: "ERR_MSG", status: 500 });

  const { data: run, error: runErr } = await supabase
    .from("agent_runs")
    .insert({
      competition_id: null,
      user_id: user.id,
      stage_id: "style",
      pipeline_id: null,
      pipeline_node_id: null,
      skill_version_id: activeSkillVersionId,
      status: "queued",
      model_provider: parsed.data.modelProvider,
      model_id: parsed.data.modelId,
      reasoning_effort: parsed.data.reasoningEffort,
      input_file_ids: inputFiles.map((f) => f.fileId),
      context_snapshot: {
        inputFiles,
        userMessage: triggerText,
      },
      queued_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (runErr) return errorResponse({ message: runErr.message, code: "ERR_RUN", status: 500 });

  return Response.json(
    { data: { runId: String(run.id), messageId: String(msg.id) } },
    { status: 202 },
  );
}

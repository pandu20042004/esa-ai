import { z } from "zod";

import { errorResponse } from "@/lib/server/api-errors";
import { unauthorizedResponse, getRequestUser } from "@/lib/server/auth";
import { getSearchBudget } from "@/lib/esai/search-budget";
import { getCachedAvailableModels } from "@/lib/server/cli-providers";
import { preflightAgentRun } from "@/lib/server/run-preflight";
import { createStageSession, findActiveStageSession, shouldReuseStageSession } from "@/lib/server/stage-sessions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const STAGES_SUPPORTED = ["onboarding", "ideation"] as const;
const DEFAULT_TRIGGER: Record<(typeof STAGES_SUPPORTED)[number], string> = {
  onboarding: "[Run Main Agent]",
  ideation: "[Run Ideation Agent]",
};

const runSchema = z.object({
  competitionId: z.string().uuid(),
  stageId: z.enum(STAGES_SUPPORTED),
  modelProvider: z.string().trim().min(1),
  modelId: z.string().trim().min(1),
  reasoningEffort: z.enum(["low", "medium", "high", "xhigh"]).default("medium"),
  userMessage: z.string().max(8000).optional(),
  webSearch: z.boolean().optional().default(false),
  imageGeneration: z.boolean().optional().default(false),
  searchMode: z.enum(["fast", "balanced", "deep"]).optional().default("balanced"),
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

  // Validate against the already-discovered picker cache. Do not re-scan CLIs on submit.
  const cachedModels = getCachedAvailableModels();
  const modelMatch = cachedModels.find(
    (m) => m.provider === parsed.data.modelProvider && m.id === parsed.data.modelId,
  );
  if (cachedModels.length > 0 && !modelMatch) {
    return errorResponse({
      message: "Unknown model. Install a CLI or set API key in .env.",
      code: "ERR_MODEL_UNKNOWN",
      status: 400,
      details: { provider: parsed.data.modelProvider, id: parsed.data.modelId },
    });
  }

  const preflight = await preflightAgentRun(supabase, user.id, parsed.data.competitionId, parsed.data.stageId);
  if (!preflight.ok) {
    return errorResponse({ message: preflight.message, code: preflight.code, status: 400 });
  }

  const sessionState = await getOptionalStageSession(supabase, {
    userId: user.id,
    competitionId: parsed.data.competitionId,
    stageId: parsed.data.stageId,
    modelProvider: parsed.data.modelProvider,
    modelId: parsed.data.modelId,
    skillVersionId: preflight.skillVersionId,
  });
  const existingSession = sessionState.existingSession;
  const session = sessionState.session;
  const shouldResume = shouldReuseStageSession(
    existingSession ? {
      status: existingSession.status,
      modelProvider: existingSession.model_provider,
      modelId: existingSession.model_id,
      providerSessionId: existingSession.provider_session_id,
    } : null,
    parsed.data.modelProvider,
    parsed.data.modelId,
  );
  const searchBudget = getSearchBudget(parsed.data.stageId, parsed.data.searchMode);

  // Insert the trigger user message (always — even when click-to-start with blank message).
  const triggerText = parsed.data.userMessage?.trim() || DEFAULT_TRIGGER[parsed.data.stageId];
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
      context: {
        trigger: parsed.data.userMessage ? "chat" : "manual",
        webSearch: parsed.data.webSearch,
        imageGeneration: parsed.data.imageGeneration,
        searchMode: parsed.data.searchMode,
      },
    })
    .select("id")
    .single();
  if (msgErr) {
    return errorResponse({ message: msgErr.message, code: "ERR_MESSAGE_INSERT", status: 500 });
  }

  // Insert the agent_runs row as queued. The stage-session fields are optional
  // so older Supabase schemas can still run before the migration is applied.
  const baseRunInsert = {
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
    input_file_ids: preflight.inputFileIds,
    context_snapshot: {
      inputFiles: shouldResume ? [] : preflight.inputFiles,
      userMessage: triggerText,
      webSearch: parsed.data.webSearch,
      imageGeneration: parsed.data.imageGeneration,
      searchMode: parsed.data.searchMode,
      searchBudget,
      stageSessionId: session?.id ?? null,
      providerSessionId: shouldResume ? session?.provider_session_id ?? null : null,
      stageSessionSummary: shouldResume ? session?.summary_text ?? null : null,
      bootstrapped: !shouldResume,
    },
    queued_at: new Date().toISOString(),
  };
  const runInsert = sessionState.available
    ? {
        ...baseRunInsert,
        stage_session_id: session?.id ?? null,
        provider_session_id: shouldResume ? session?.provider_session_id ?? null : null,
        search_mode: parsed.data.searchMode,
        search_budget: searchBudget,
      }
    : baseRunInsert;

  const insertedRun = await insertAgentRunWithFallback(supabase, runInsert, baseRunInsert);
  if (insertedRun.error) {
    return errorResponse({ message: insertedRun.error.message, code: "ERR_RUN_INSERT", status: 500 });
  }
  const runRow = insertedRun.data;

  await supabase
    .from("agent_messages")
    .update({
      context: {
        trigger: parsed.data.userMessage ? "chat" : "manual",
        runId: String(runRow.id),
        webSearch: parsed.data.webSearch,
        imageGeneration: parsed.data.imageGeneration,
        searchMode: parsed.data.searchMode,
      },
    })
    .eq("id", msgRow.id)
    .eq("user_id", user.id);

  return Response.json(
    {
      data: {
        runId: String(runRow.id),
        messageId: String(msgRow.id),
        skillVersionId: preflight.skillVersionId,
        stageSessionId: session?.id ?? null,
        resumed: shouldResume,
        pipelineNodeId: preflight.pipelineNodeId,
      },
    },
    { status: 202 },
  );
}

type OptionalStageSessionInput = {
  userId: string;
  competitionId: string;
  stageId: string;
  modelProvider: string;
  modelId: string;
  skillVersionId?: string | null;
};

async function getOptionalStageSession(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: OptionalStageSessionInput,
) {
  if (!supabase) return { available: false, existingSession: null, session: null };
  try {
    const existingSession = await findActiveStageSession(supabase, input);
    const session = existingSession ?? await createStageSession(supabase, input);
    return { available: true, existingSession, session };
  } catch (error) {
    const message = (error as Error).message ?? "";
    if (/stage_sessions|schema cache|Could not find|does not exist/i.test(message)) {
      console.warn("[agent-runs] stage_sessions unavailable; continuing without provider session persistence.");
      return { available: false, existingSession: null, session: null };
    }
    throw error;
  }
}

async function insertAgentRunWithFallback(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  runInsert: Record<string, unknown>,
  fallbackInsert: Record<string, unknown>,
) {
  const first = await supabase
    .from("agent_runs")
    .insert(runInsert)
    .select("id")
    .single();
  if (!first.error) return first;
  if (!/stage_session_id|provider_session_id|search_mode|search_budget|schema cache|column .* does not exist/i.test(first.error.message)) {
    return first;
  }
  console.warn("[agent-runs] agent_runs session columns unavailable; retrying legacy insert.");
  return supabase
    .from("agent_runs")
    .insert(fallbackInsert)
    .select("id")
    .single();
}

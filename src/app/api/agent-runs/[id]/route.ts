import { errorResponse } from "@/lib/server/api-errors";
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { loadRunEvents } from "@/lib/server/run-events";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, context: RouteContext<"/api/agent-runs/[id]">) {
  const { id } = await context.params;
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const supabase = createSupabaseAdminClient();
  if (!supabase) return errorResponse({ message: "Supabase admin not configured.", code: "ERR_NO_ADMIN", status: 500 });

  const { data: run, error: runErr } = await supabase
    .from("agent_runs")
    .select("id, status, stage_id, competition_id, model_provider, model_id, reasoning_effort, output_file_id, error, queued_at, started_at, completed_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (runErr) return errorResponse({ message: runErr.message, code: "ERR_RUN_LOOKUP", status: 500 });
  if (!run) return errorResponse({ message: "Run not found.", code: "ERR_NOT_FOUND", status: 404 });

  const events = await loadRunEvents(supabase, String(run.id));

  return Response.json({
    data: {
      run: {
        id: String(run.id),
        status: String(run.status),
        stageId: String(run.stage_id),
        competitionId: String(run.competition_id),
        modelProvider: String(run.model_provider),
        modelId: String(run.model_id),
        reasoningEffort: run.reasoning_effort ? String(run.reasoning_effort) : undefined,
        outputFileId: run.output_file_id ? String(run.output_file_id) : undefined,
        error: run.error ? String(run.error) : undefined,
        queuedAt: run.queued_at ? String(run.queued_at) : undefined,
        startedAt: run.started_at ? String(run.started_at) : undefined,
        completedAt: run.completed_at ? String(run.completed_at) : undefined,
      },
      events,
    },
  });
}

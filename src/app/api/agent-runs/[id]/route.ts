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
    .select("id, status, stage_id, competition_id, model_provider, model_id, reasoning_effort, output_file_id, needs_user_choice, selected_choice, error, queued_at, started_at, completed_at")
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
        needsUserChoice: run.needs_user_choice ?? undefined,
        selectedChoice: run.selected_choice ?? undefined,
        error: run.error ? String(run.error) : undefined,
        queuedAt: run.queued_at ? String(run.queued_at) : undefined,
        startedAt: run.started_at ? String(run.started_at) : undefined,
        completedAt: run.completed_at ? String(run.completed_at) : undefined,
      },
      events,
    },
  });
}

export async function PATCH(request: Request, context: RouteContext<"/api/agent-runs/[id]">) {
  const { id } = await context.params;
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const supabase = createSupabaseAdminClient();
  if (!supabase) return errorResponse({ message: "Supabase admin not configured.", code: "ERR_NO_ADMIN", status: 500 });

  const body = await request.json().catch(() => ({}));
  if (body?.action !== "cancel") {
    return errorResponse({ message: "Unsupported run action.", code: "ERR_VALIDATION", status: 400 });
  }

  const { data: run, error: lookupErr } = await supabase
    .from("agent_runs")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupErr) return errorResponse({ message: lookupErr.message, code: "ERR_RUN_LOOKUP", status: 500 });
  if (!run) return errorResponse({ message: "Run not found.", code: "ERR_NOT_FOUND", status: 404 });

  const status = String(run.status);
  if (["completed", "failed", "cancelled", "needs_choice"].includes(status)) {
    return Response.json({ data: { runId: id, status } });
  }

  const nextStatus = status === "queued" ? "cancelled" : "cancelling";
  const { error: updateErr } = await supabase
    .from("agent_runs")
    .update({
      status: nextStatus,
      error: nextStatus === "cancelled" ? "Run cancelled by user." : "Cancellation requested by user.",
      completed_at: nextStatus === "cancelled" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (updateErr) return errorResponse({ message: updateErr.message, code: "ERR_RUN_CANCEL", status: 500 });

  const events = await loadRunEvents(supabase, id).catch(() => []);
  await supabase.from("agent_run_events").insert({
    run_id: id,
    user_id: user.id,
    sequence: events.length + 1,
    event_type: "status",
    payload: { phase: nextStatus === "cancelled" ? "cancelled" : "cancelling", text: "Cancellation requested by user." },
  });

  return Response.json({ data: { runId: id, status: nextStatus } });
}

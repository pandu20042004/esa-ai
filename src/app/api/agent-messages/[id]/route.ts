import { errorResponse } from "@/lib/server/api-errors";
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { closeStageSessions } from "@/lib/server/stage-sessions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type MessageContext = {
  runId?: unknown;
};

export async function DELETE(request: Request, context: RouteContext<"/api/agent-messages/[id]">) {
  const { id } = await context.params;
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const supabase = createSupabaseAdminClient();
  if (!supabase) return errorResponse({ message: "Supabase admin not configured.", code: "ERR_NO_ADMIN", status: 500 });

  const url = new URL(request.url);
  const cascadeRun = url.searchParams.get("cascadeRun") === "1";

  const { data: message, error: lookupErr } = await supabase
    .from("agent_messages")
    .select("id, role, context, competition_id, stage_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupErr) return errorResponse({ message: lookupErr.message, code: "ERR_MESSAGE_LOOKUP", status: 500 });
  if (!message) return errorResponse({ message: "Message not found.", code: "ERR_NOT_FOUND", status: 404 });

  const runId = getRunId(message.context);

  if (cascadeRun && message.role === "user" && runId) {
    const { data: run, error: runErr } = await supabase
      .from("agent_runs")
      .select("id, output_file_id")
      .eq("id", runId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (runErr) return errorResponse({ message: runErr.message, code: "ERR_RUN_LOOKUP", status: 500 });

    const outputFileId = run?.output_file_id ? String(run.output_file_id) : null;
    if (outputFileId) {
      await supabase.from("artifact_versions").delete().eq("file_id", outputFileId);
      await supabase.from("competition_files").delete().eq("id", outputFileId).eq("user_id", user.id);
    }

    const { error: runMessagesErr } = await supabase
      .from("agent_messages")
      .delete()
      .eq("user_id", user.id)
      .contains("context", { runId });
    if (runMessagesErr) return errorResponse({ message: runMessagesErr.message, code: "ERR_RUN_MESSAGES_DELETE", status: 500 });

    await supabase.from("agent_runs").delete().eq("id", runId).eq("user_id", user.id);
    await closeMessageStageSession(supabase, user.id, message.competition_id, message.stage_id);
    return Response.json({ data: { deleted: true, cascadeRun: true, runId, outputFileId } });
  }

  const { error: deleteErr } = await supabase
    .from("agent_messages")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (deleteErr) return errorResponse({ message: deleteErr.message, code: "ERR_MESSAGE_DELETE", status: 500 });
  await closeMessageStageSession(supabase, user.id, message.competition_id, message.stage_id);

  return Response.json({ data: { deleted: true } });
}

async function closeMessageStageSession(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  competitionId: unknown,
  stageId: unknown,
) {
  if (!supabase || typeof competitionId !== "string" || typeof stageId !== "string") return;
  await closeStageSessions(supabase, {
    userId,
    competitionId,
    stageId,
    status: "reset",
  }).catch((cause) => console.error("[agent-message] close stage session failed:", (cause as Error).message));
}

function getRunId(context: unknown): string | null {
  if (!context || typeof context !== "object") return null;
  const runId = (context as MessageContext).runId;
  return typeof runId === "string" && runId.trim() ? runId : null;
}

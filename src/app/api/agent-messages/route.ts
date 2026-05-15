import { z } from "zod";

import { errorResponse } from "@/lib/server/api-errors";
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { closeStageSessions } from "@/lib/server/stage-sessions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type MessageContext = {
  runId?: unknown;
};

const bulkDeleteSchema = z.object({
  messageIds: z.array(z.string().uuid()).min(1).max(100),
  cascadeUserRuns: z.boolean().optional().default(true),
});

export async function DELETE(request: Request) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const supabase = createSupabaseAdminClient();
  if (!supabase) return errorResponse({ message: "Supabase admin not configured.", code: "ERR_NO_ADMIN", status: 500 });

  let body: unknown;
  try {
    body = await request.json();
  } catch (cause) {
    return errorResponse({ message: "Invalid request body.", code: "ERR_BAD_BODY", status: 400, cause });
  }

  const parsed = bulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse({ message: "messageIds must contain at least one message id.", code: "ERR_VALIDATION", status: 400 });
  }

  const messageIds = Array.from(new Set(parsed.data.messageIds));
  const { data: messages, error: lookupErr } = await supabase
    .from("agent_messages")
    .select("id, role, context, competition_id, stage_id")
    .eq("user_id", user.id)
    .in("id", messageIds);
  if (lookupErr) return errorResponse({ message: lookupErr.message, code: "ERR_MESSAGE_LOOKUP", status: 500 });

  const runIds = parsed.data.cascadeUserRuns
    ? Array.from(new Set((messages ?? [])
      .filter((message) => message.role === "user")
      .map((message) => getRunId(message.context))
      .filter((runId): runId is string => Boolean(runId))))
    : [];

  const outputFileIds: string[] = [];
  if (runIds.length > 0) {
    const { data: runs, error: runsErr } = await supabase
      .from("agent_runs")
      .select("id, output_file_id")
      .eq("user_id", user.id)
      .in("id", runIds);
    if (runsErr) return errorResponse({ message: runsErr.message, code: "ERR_RUN_LOOKUP", status: 500 });
    for (const run of runs ?? []) {
      if (run.output_file_id) outputFileIds.push(String(run.output_file_id));
    }
  }

  if (outputFileIds.length > 0) {
    await supabase.from("artifact_versions").delete().in("file_id", outputFileIds);
    await supabase.from("competition_files").delete().eq("user_id", user.id).in("id", outputFileIds);
  }

  for (const runId of runIds) {
    const { error: runMessagesErr } = await supabase
      .from("agent_messages")
      .delete()
      .eq("user_id", user.id)
      .contains("context", { runId });
    if (runMessagesErr) return errorResponse({ message: runMessagesErr.message, code: "ERR_RUN_MESSAGES_DELETE", status: 500 });
  }

  const nonCascadedIds = messageIds.filter((id) => {
    const message = messages?.find((item) => item.id === id);
    return !message || message.role !== "user" || !runIds.includes(getRunId(message.context) ?? "");
  });

  if (nonCascadedIds.length > 0) {
    const { error: deleteErr } = await supabase
      .from("agent_messages")
      .delete()
      .eq("user_id", user.id)
      .in("id", nonCascadedIds);
    if (deleteErr) return errorResponse({ message: deleteErr.message, code: "ERR_MESSAGE_DELETE", status: 500 });
  }

  if (runIds.length > 0) {
    await supabase.from("agent_runs").delete().eq("user_id", user.id).in("id", runIds);
  }

  const stageKeys = new Set(
    (messages ?? [])
      .map((message) => `${String(message.competition_id ?? "")}::${String(message.stage_id ?? "")}`)
      .filter((key) => !key.startsWith("::") && !key.endsWith("::")),
  );
  for (const key of stageKeys) {
    const [competitionId, stageId] = key.split("::");
    await closeStageSessions(supabase, { userId: user.id, competitionId, stageId, status: "reset" })
      .catch((cause) => console.error("[agent-messages] close stage session failed:", (cause as Error).message));
  }

  return Response.json({
    data: {
      deleted: true,
      messageIds,
      cascadedRunIds: runIds,
      outputFileIds,
    },
  });
}

function getRunId(context: unknown): string | null {
  if (!context || typeof context !== "object") return null;
  const runId = (context as MessageContext).runId;
  return typeof runId === "string" && runId.trim() ? runId : null;
}

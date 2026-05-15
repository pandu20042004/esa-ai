import { z } from "zod";

import { errorResponse } from "@/lib/server/api-errors";
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { closeStageSessions } from "@/lib/server/stage-sessions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  stageId: z.string().trim().min(1),
});

export async function GET(request: Request, context: RouteContext<"/api/competitions/[id]/agent-thread">) {
  const { id } = await context.params;
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const supabase = createSupabaseAdminClient();
  if (!supabase) return errorResponse({ message: "Supabase admin not configured.", code: "ERR_NO_ADMIN", status: 500 });

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ stageId: url.searchParams.get("stageId") ?? "" });
  if (!parsed.success) {
    return errorResponse({ message: "stageId query param required.", code: "ERR_VALIDATION", status: 400 });
  }

  const { data, error } = await supabase
    .from("agent_messages")
    .select("id, role, content, stage_id, model_provider, model_id, context, created_at")
    .eq("competition_id", id)
    .eq("user_id", user.id)
    .eq("stage_id", parsed.data.stageId)
    .eq("thread_type", "stage")
    .order("created_at", { ascending: true });
  if (error) return errorResponse({ message: error.message, code: "ERR_THREAD_LOOKUP", status: 500 });

  return Response.json({
    data: (data ?? []).map((row) => ({
      id: String(row.id),
      role: String(row.role),
      content: String(row.content ?? ""),
      stageId: row.stage_id ? String(row.stage_id) : undefined,
      modelProvider: row.model_provider ? String(row.model_provider) : undefined,
      modelId: row.model_id ? String(row.model_id) : undefined,
      context: row.context ?? {},
      createdAt: String(row.created_at),
    })),
  });
}

export async function DELETE(request: Request, context: RouteContext<"/api/competitions/[id]/agent-thread">) {
  const { id } = await context.params;
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const supabase = createSupabaseAdminClient();
  if (!supabase) return errorResponse({ message: "Supabase admin not configured.", code: "ERR_NO_ADMIN", status: 500 });

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ stageId: url.searchParams.get("stageId") ?? "" });
  if (!parsed.success) {
    return errorResponse({ message: "stageId query param required.", code: "ERR_VALIDATION", status: 400 });
  }

  const { error } = await supabase
    .from("agent_messages")
    .delete()
    .eq("competition_id", id)
    .eq("user_id", user.id)
    .eq("stage_id", parsed.data.stageId)
    .eq("thread_type", "stage");

  if (error) return errorResponse({ message: error.message, code: "ERR_THREAD_CLEAR", status: 500 });
  await closeStageSessions(supabase, {
    userId: user.id,
    competitionId: id,
    stageId: parsed.data.stageId,
    status: "reset",
  }).catch((cause) => console.error("[agent-thread] close stage session failed:", (cause as Error).message));
  return Response.json({ data: { deleted: true } });
}

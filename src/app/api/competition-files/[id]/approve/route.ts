import { errorResponse } from "@/lib/server/api-errors";
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { closeStageSessions } from "@/lib/server/stage-sessions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, context: RouteContext<"/api/competition-files/[id]/approve">) {
  const { id } = await context.params;
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const supabase = createSupabaseAdminClient();
  if (!supabase) return errorResponse({ message: "Supabase admin not configured.", code: "ERR_NO_ADMIN", status: 500 });

  const { data: file, error: lookupErr } = await supabase
    .from("competition_files")
    .select("id, competition_id, producer_node_id, stage_id, artifact_role")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupErr) return errorResponse({ message: lookupErr.message, code: "ERR_LOOKUP", status: 500 });
  if (!file) return errorResponse({ message: "File not found.", code: "ERR_NOT_FOUND", status: 404 });

  const { error: updateErr } = await supabase
    .from("competition_files")
    .update({
      status: "approved",
      approved: true,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (updateErr) return errorResponse({ message: updateErr.message, code: "ERR_APPROVE", status: 500 });

  // Bump competitions.current_stage_id if the stage has a known successor.
  const nextStage = NEXT_STAGE[String(file.stage_id ?? "")] ?? null;
  if (file.competition_id && file.stage_id) {
    await closeStageSessions(supabase, {
      userId: user.id,
      competitionId: String(file.competition_id),
      stageId: String(file.stage_id),
      status: "closed",
    }).catch((error) => console.error("[approve] close stage session failed:", (error as Error).message));
  }
  if (nextStage) {
    await supabase
      .from("competitions")
      .update({ current_stage_id: nextStage })
      .eq("id", file.competition_id)
      .eq("user_id", user.id);
  }

  return Response.json({ data: { approved: true, nextStageId: nextStage } });
}

const NEXT_STAGE: Record<string, string | undefined> = {
  onboarding: "ideation",
  ideation: "research",
  research: "writing",
  writing: "flowchart",
  flowchart: "prototype",
  prototype: "ui",
  ui: "supervisor",
};

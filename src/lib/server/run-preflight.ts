import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureCompetitionPipeline, ensureMainAgentUserAgent, getEssayCompartmentId } from "@/lib/server/pipeline-bootstrap";

export type PreflightResult = {
  ok: true;
  pipelineId: string;
  pipelineNodeId: string | null;
  skillVersionId: string;
  guidebookFileId: string;
  inputFiles: Array<{
    fileId: string;
    fileName: string;
    fileRole: string;
    contentText: string | null;
  }>;
} | {
  ok: false;
  code: string;
  message: string;
};

export async function preflightMainAgentRun(
  supabase: SupabaseClient,
  userId: string,
  competitionId: string,
): Promise<PreflightResult> {
  // Ownership + existence check.
  const { data: competition, error: cErr } = await supabase
    .from("competitions")
    .select("id, user_id, compartment_id")
    .eq("id", competitionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (cErr) return { ok: false, code: "ERR_PREFLIGHT_LOOKUP", message: cErr.message };
  if (!competition) return { ok: false, code: "ERR_NOT_FOUND", message: "Competition not found." };

  // Guidebook must exist with status approved or draft.
  const { data: guidebook, error: gErr } = await supabase
    .from("competition_files")
    .select("id, file_name, file_role, content_text, status")
    .eq("competition_id", competitionId)
    .eq("user_id", userId)
    .eq("file_role", "guidebook")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (gErr) return { ok: false, code: "ERR_PREFLIGHT_GUIDEBOOK", message: gErr.message };
  if (!guidebook) {
    return {
      ok: false,
      code: "ERR_MISSING_GUIDEBOOK",
      message: "Upload a guidebook for this competition before running Main Agent.",
    };
  }

  // Ensure compartment + user_agent + pipeline.
  let compartmentId = (competition as { compartment_id?: string | null }).compartment_id ?? null;
  if (!compartmentId) {
    compartmentId = await getEssayCompartmentId(supabase, userId);
    // Link competition to the default compartment so future calls skip this step.
    await supabase.from("competitions").update({ compartment_id: compartmentId }).eq("id", competitionId).eq("user_id", userId);
  }

  const { activeSkillVersionId } = await ensureMainAgentUserAgent(supabase, userId, compartmentId);
  const { pipelineId, onboardingNodeId } = await ensureCompetitionPipeline(
    supabase,
    userId,
    competitionId,
    compartmentId,
  );

  return {
    ok: true,
    pipelineId,
    pipelineNodeId: onboardingNodeId,
    skillVersionId: activeSkillVersionId,
    guidebookFileId: String(guidebook.id),
    inputFiles: [
      {
        fileId: String(guidebook.id),
        fileName: String(guidebook.file_name ?? "guidebook"),
        fileRole: "guidebook",
        contentText: typeof guidebook.content_text === "string" ? guidebook.content_text : null,
      },
    ],
  };
}

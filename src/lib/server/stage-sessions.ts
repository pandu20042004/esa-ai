import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type StageSessionStatus = "active" | "closed" | "reset";

export type StageSessionSummary = {
  id?: string;
  status: string;
  modelProvider?: string | null;
  modelId?: string | null;
  providerSessionId?: string | null;
  summaryText?: string | null;
};

export type StageSessionRow = {
  id: string;
  user_id: string;
  competition_id: string;
  stage_id: string;
  model_provider: string;
  model_id: string;
  provider_session_id: string | null;
  summary_text: string | null;
  status: StageSessionStatus;
};

export function shouldReuseStageSession(
  session: StageSessionSummary | null | undefined,
  modelProvider: string,
  modelId: string,
): boolean {
  return Boolean(
    session &&
    session.status === "active" &&
    session.modelProvider === modelProvider &&
    session.modelId === modelId &&
    session.providerSessionId,
  );
}

export function shouldBootstrapStageSession(session: Pick<StageSessionSummary, "status" | "providerSessionId"> | null | undefined): boolean {
  return !session || session.status !== "active" || !session.providerSessionId;
}

export function buildFollowUpPrompt(input: { stageId: string; userMessage: string; summaryText?: string | null }): string {
  return [
    "## Stage follow-up",
    `- Stage: ${input.stageId}`,
    "- Continue the existing stage conversation.",
    "- Do not reload the full skill or guidebook unless the user explicitly asks to restart.",
    input.summaryText ? `- Current stage memory: ${input.summaryText.slice(0, 4000)}` : null,
    "",
    "## User message",
    input.userMessage.trim() || "Continue.",
  ].filter((line): line is string => typeof line === "string").join("\n");
}

export async function findActiveStageSession(
  supabase: SupabaseClient,
  input: { userId: string; competitionId: string; stageId: string; modelProvider: string; modelId: string },
): Promise<StageSessionRow | null> {
  const { data, error } = await supabase
    .from("stage_sessions")
    .select("*")
    .eq("user_id", input.userId)
    .eq("competition_id", input.competitionId)
    .eq("stage_id", input.stageId)
    .eq("model_provider", input.modelProvider)
    .eq("model_id", input.modelId)
    .eq("status", "active")
    .order("last_used_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findActiveStageSession: ${error.message}`);
  return (data as StageSessionRow | null) ?? null;
}

export async function createStageSession(
  supabase: SupabaseClient,
  input: { userId: string; competitionId: string; stageId: string; modelProvider: string; modelId: string; skillVersionId?: string | null },
): Promise<StageSessionRow> {
  const { data, error } = await supabase
    .from("stage_sessions")
    .insert({
      user_id: input.userId,
      competition_id: input.competitionId,
      stage_id: input.stageId,
      model_provider: input.modelProvider,
      model_id: input.modelId,
      skill_version_id: input.skillVersionId ?? null,
      status: "active",
      bootstrapped_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(`createStageSession: ${error.message}`);
  return data as StageSessionRow;
}

export async function touchStageSession(
  supabase: SupabaseClient,
  sessionId: string,
  patch: { providerSessionId?: string | null; summaryText?: string | null; status?: StageSessionStatus } = {},
) {
  const update: Record<string, unknown> = { last_used_at: new Date().toISOString() };
  if ("providerSessionId" in patch) update.provider_session_id = patch.providerSessionId;
  if ("summaryText" in patch) update.summary_text = patch.summaryText;
  if (patch.status) update.status = patch.status;
  const { error } = await supabase.from("stage_sessions").update(update).eq("id", sessionId);
  if (error) throw new Error(`touchStageSession: ${error.message}`);
}

export async function closeStageSessions(
  supabase: SupabaseClient,
  input: { userId: string; competitionId: string; stageId: string; status?: Exclude<StageSessionStatus, "active"> },
) {
  const { error } = await supabase
    .from("stage_sessions")
    .update({
      status: input.status ?? "closed",
      closed_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId)
    .eq("competition_id", input.competitionId)
    .eq("stage_id", input.stageId)
    .eq("status", "active");
  if (error) throw new Error(`closeStageSessions: ${error.message}`);
}

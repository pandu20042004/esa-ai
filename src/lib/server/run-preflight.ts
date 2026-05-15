import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureCompetitionPipeline, ensureMainAgentUserAgent, getEssayCompartmentId } from "@/lib/server/pipeline-bootstrap";
import { toolProtocolInstructions } from "@/lib/server/tool-calls";

type RunnableStageId = "onboarding" | "ideation";

export type PreflightResult = {
  ok: true;
  pipelineId: string;
  pipelineNodeId: string | null;
  skillVersionId: string;
  guidebookFileId: string;
  inputFileIds: string[];
  inputFiles: Array<{
    fileId: string;
    fileName: string;
    fileRole: string;
    contentText: string | null;
    mimeType?: string | null;
    storageBucket?: string | null;
    storagePath?: string | null;
    signedUrl?: string | null;
  }>;
} | {
  ok: false;
  code: string;
  message: string;
};

export async function preflightAgentRun(
  supabase: SupabaseClient,
  userId: string,
  competitionId: string,
  stageId: RunnableStageId,
): Promise<PreflightResult> {
  if (stageId === "onboarding") return preflightMainAgentRun(supabase, userId, competitionId);
  return preflightIdeationRun(supabase, userId, competitionId);
}

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
    .select("id, file_name, file_role, content_text, status, mime_type, storage_bucket, storage_path")
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

  const { data: styleProfile, error: styleErr } = await supabase
    .from("competition_files")
    .select("id, file_name, file_role, content_text, status, mime_type, storage_bucket, storage_path")
    .eq("user_id", userId)
    .is("competition_id", null)
    .eq("file_role", "style_profile")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (styleErr) return { ok: false, code: "ERR_PREFLIGHT_STYLE_PROFILE", message: styleErr.message };

  const guidebookSignedUrl = await createSignedInputUrl(supabase, guidebook.storage_bucket, guidebook.storage_path);
  const styleSignedUrl = styleProfile
    ? await createSignedInputUrl(supabase, styleProfile.storage_bucket, styleProfile.storage_path)
    : null;

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
    inputFileIds: [
      String(guidebook.id),
      ...(styleProfile ? [String(styleProfile.id)] : []),
    ],
    inputFiles: buildMainAgentInputFiles({ row: guidebook, signedUrl: guidebookSignedUrl }, styleProfile ? { row: styleProfile, signedUrl: styleSignedUrl } : null),
  };
}

async function preflightIdeationRun(
  supabase: SupabaseClient,
  userId: string,
  competitionId: string,
): Promise<PreflightResult> {
  const base = await ensurePipelineBase(supabase, userId, competitionId);
  if (!base.ok) return base;

  const { data: node, error: nodeErr } = await supabase
    .from("pipeline_nodes")
    .select("id, user_agent_id")
    .eq("pipeline_id", base.pipelineId)
    .eq("node_key", "ideation")
    .maybeSingle();
  if (nodeErr) return { ok: false, code: "ERR_PREFLIGHT_NODE", message: nodeErr.message };
  if (!node?.user_agent_id) {
    return {
      ok: false,
      code: "ERR_IDEATION_NOT_WIRED",
      message: "Ideation Agent is not synced into this pipeline yet. Sync local agent templates first.",
    };
  }

  const { data: onboardingNode, error: onboardingNodeErr } = await supabase
    .from("pipeline_nodes")
    .select("id")
    .eq("pipeline_id", base.pipelineId)
    .eq("node_key", "onboarding")
    .maybeSingle();
  if (onboardingNodeErr) return { ok: false, code: "ERR_ONBOARDING_NODE", message: onboardingNodeErr.message };
  if (!onboardingNode?.id) {
    return { ok: false, code: "ERR_ONBOARDING_NODE_MISSING", message: "Onboarding node is missing from this pipeline." };
  }

  const { data: onboardingOutput, error: outErr } = await supabase
    .from("competition_files")
    .select("id, file_name, file_role, content_text, status, mime_type, storage_bucket, storage_path, artifact_role, producer_node_id")
    .eq("competition_id", competitionId)
    .eq("user_id", userId)
    .eq("producer_node_id", String(onboardingNode.id))
    .eq("artifact_role", "onboarding_map")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (outErr) return { ok: false, code: "ERR_PREFLIGHT_ONBOARDING_OUTPUT", message: outErr.message };
  if (!onboardingOutput) {
    return {
      ok: false,
      code: "ERR_ONBOARDING_NOT_APPROVED",
      message: "Approve the Main Agent onboarding output before running Ideation.",
    };
  }

  const { data: guidebook, error: gErr } = await supabase
    .from("competition_files")
    .select("id, file_name, file_role, content_text, status, mime_type, storage_bucket, storage_path")
    .eq("competition_id", competitionId)
    .eq("user_id", userId)
    .eq("file_role", "guidebook")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (gErr) return { ok: false, code: "ERR_PREFLIGHT_GUIDEBOOK", message: gErr.message };
  if (!guidebook) return { ok: false, code: "ERR_MISSING_GUIDEBOOK", message: "Upload a guidebook before running Ideation." };

  const { data: styleProfile, error: styleErr } = await supabase
    .from("competition_files")
    .select("id, file_name, file_role, content_text, status, mime_type, storage_bucket, storage_path")
    .eq("user_id", userId)
    .is("competition_id", null)
    .eq("file_role", "style_profile")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (styleErr) return { ok: false, code: "ERR_PREFLIGHT_STYLE_PROFILE", message: styleErr.message };

  const skillVersionId = await ensureActiveSkillVersionForUserAgent(
    supabase,
    userId,
    String(node.user_agent_id),
    "Auto-provisioned from ideation-agent template.",
  );

  const guidebookSignedUrl = await createSignedInputUrl(supabase, guidebook.storage_bucket, guidebook.storage_path);
  const styleSignedUrl = styleProfile
    ? await createSignedInputUrl(supabase, styleProfile.storage_bucket, styleProfile.storage_path)
    : null;

  return {
    ok: true,
    pipelineId: base.pipelineId,
    pipelineNodeId: String(node.id),
    skillVersionId,
    guidebookFileId: String(guidebook.id),
    inputFileIds: [
      String(onboardingOutput.id),
      String(guidebook.id),
      ...(styleProfile ? [String(styleProfile.id)] : []),
    ],
    inputFiles: [
      toInputFile(onboardingOutput, "onboarding_map"),
      toInputFile(guidebook, "guidebook", guidebookSignedUrl),
      ...(styleProfile ? [toInputFile(styleProfile, "style_profile", styleSignedUrl)] : []),
    ],
  };
}

async function ensurePipelineBase(
  supabase: SupabaseClient,
  userId: string,
  competitionId: string,
): Promise<{ ok: true; pipelineId: string; compartmentId: string } | Extract<PreflightResult, { ok: false }>> {
  const { data: competition, error: cErr } = await supabase
    .from("competitions")
    .select("id, user_id, compartment_id")
    .eq("id", competitionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (cErr) return { ok: false, code: "ERR_PREFLIGHT_LOOKUP", message: cErr.message };
  if (!competition) return { ok: false, code: "ERR_NOT_FOUND", message: "Competition not found." };

  let compartmentId = (competition as { compartment_id?: string | null }).compartment_id ?? null;
  if (!compartmentId) {
    compartmentId = await getEssayCompartmentId(supabase, userId);
    await supabase.from("competitions").update({ compartment_id: compartmentId }).eq("id", competitionId).eq("user_id", userId);
  }
  const { pipelineId } = await ensureCompetitionPipeline(supabase, userId, competitionId, compartmentId);
  return { ok: true, pipelineId, compartmentId };
}

async function ensureActiveSkillVersionForUserAgent(
  supabase: SupabaseClient,
  userId: string,
  userAgentId: string,
  changeSummary: string,
): Promise<string> {
  const { data: agent, error: agentErr } = await supabase
    .from("user_agents")
    .select("id, template_id, active_skill_version_id, input_contracts, output_contracts")
    .eq("id", userAgentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (agentErr) throw new Error(`ensureActiveSkillVersion lookup: ${agentErr.message}`);
  if (!agent) throw new Error("Pipeline agent not found.");
  if (agent.active_skill_version_id) return String(agent.active_skill_version_id);

  const { data: tmpl, error: tmplErr } = await supabase
    .from("agent_templates")
    .select("id, default_skill_content, default_input_contracts, default_output_contracts")
    .eq("id", String(agent.template_id))
    .maybeSingle();
  if (tmplErr) throw new Error(`ensureActiveSkillVersion template: ${tmplErr.message}`);
  if (!tmpl) throw new Error("Agent template missing for pipeline agent.");

  const skillContent = `${String(tmpl.default_skill_content ?? "")}\n${toolProtocolInstructions()}`;
  const { data: version, error: vErr } = await supabase
    .from("agent_skill_versions")
    .insert({
      user_id: userId,
      user_agent_id: userAgentId,
      template_id: String(tmpl.id),
      version_number: 1,
      skill_content: skillContent,
      input_contracts: agent.input_contracts ?? tmpl.default_input_contracts ?? [],
      output_contracts: agent.output_contracts ?? tmpl.default_output_contracts ?? [],
      change_summary: changeSummary,
      is_active: true,
    })
    .select("id")
    .single();
  if (vErr) throw new Error(`ensureActiveSkillVersion create: ${vErr.message}`);

  const id = String(version.id);
  const { error: linkErr } = await supabase
    .from("user_agents")
    .update({ active_skill_version_id: id })
    .eq("id", userAgentId)
    .eq("user_id", userId);
  if (linkErr) throw new Error(`ensureActiveSkillVersion link: ${linkErr.message}`);
  return id;
}

type InputFileRow = {
  id: unknown;
  file_name?: unknown;
  file_role?: unknown;
  content_text?: unknown;
  mime_type?: unknown;
  storage_bucket?: unknown;
  storage_path?: unknown;
};

type InputFile = Extract<PreflightResult, { ok: true }>["inputFiles"][number];

export function hasUsableExtractedText(value: unknown): value is string {
  return typeof value === "string" && value.replace(/\s+/g, "").length >= 20;
}

export function buildMainAgentInputFiles(
  guidebook: { row: InputFileRow; signedUrl?: string | null },
  styleProfile: { row: InputFileRow; signedUrl?: string | null } | null,
): InputFile[] {
  return [
    toInputFile(guidebook.row, "guidebook", guidebook.signedUrl),
    ...(styleProfile ? [toInputFile(styleProfile.row, "style_profile", styleProfile.signedUrl)] : []),
  ];
}

function toInputFile(row: InputFileRow, fallbackRole: string, signedUrl?: string | null): InputFile {
  const role = typeof row.file_role === "string" ? row.file_role : fallbackRole;
  const extracted = hasUsableExtractedText(row.content_text) ? row.content_text : null;
  return {
    fileId: String(row.id),
    fileName: String(row.file_name ?? role),
    fileRole: role,
    contentText: extracted ?? buildMissingTextFallback(row, role, signedUrl),
    mimeType: typeof row.mime_type === "string" ? row.mime_type : null,
    storageBucket: typeof row.storage_bucket === "string" ? row.storage_bucket : null,
    storagePath: typeof row.storage_path === "string" ? row.storage_path : null,
    signedUrl: signedUrl ?? null,
  };
}

function buildMissingTextFallback(row: InputFileRow, role: string, signedUrl?: string | null): string {
  const fileName = String(row.file_name ?? role);
  const mimeType = typeof row.mime_type === "string" ? row.mime_type : "unknown";
  const storageBucket = typeof row.storage_bucket === "string" ? row.storage_bucket : "unknown";
  const storagePath = typeof row.storage_path === "string" ? row.storage_path : "unknown";
  return [
    `[${role.toUpperCase()} UPLOADED BUT TEXT EXTRACTION IS EMPTY]`,
    `File: ${fileName}`,
    `MIME: ${mimeType}`,
    `Storage: ${storageBucket}/${storagePath}`,
    signedUrl ? `Signed URL: ${signedUrl}` : "Signed URL: unavailable",
    "Do not assume guidebook clauses from missing text. Tell the user the uploaded file is present but needs OCR/readable text if exact rules are required.",
  ].join("\n");
}

async function createSignedInputUrl(
  supabase: SupabaseClient,
  bucket: unknown,
  storagePath: unknown,
): Promise<string | null> {
  if (typeof bucket !== "string" || typeof storagePath !== "string" || !bucket || !storagePath) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

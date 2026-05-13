import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_COMPARTMENTS } from "@/lib/server/agent-bootstrap";
import { toolProtocolInstructions } from "@/lib/server/tool-calls";

/**
 * Ensure the four default compartments exist for a user.
 * Idempotent: uses slug unique constraint (user_id, slug).
 */
export async function ensureDefaultCompartments(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const rows = DEFAULT_COMPARTMENTS.map((c) => ({
    user_id: userId,
    name: c.name,
    slug: c.slug,
    is_default: true,
    archived: false,
    sort_order: c.sortOrder,
  }));
  // upsert on (user_id, slug) — existing rows untouched
  const { error } = await supabase
    .from("compartments")
    .upsert(rows, { onConflict: "user_id,slug", ignoreDuplicates: true });
  if (error) throw new Error(`ensureDefaultCompartments: ${error.message}`);
}

/**
 * Resolve the Essay compartment for a user (create defaults if missing).
 */
export async function getEssayCompartmentId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  await ensureDefaultCompartments(supabase, userId);
  const { data, error } = await supabase
    .from("compartments")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", "essay")
    .maybeSingle();
  if (error) throw new Error(`getEssayCompartmentId: ${error.message}`);
  if (!data) throw new Error("Essay compartment missing after ensureDefaults.");
  return String(data.id);
}

/**
 * Ensure a user_agents row + initial active agent_skill_versions row for the Main Agent
 * in the given compartment. Idempotent via (user_id, compartment_id, template_id) unique index.
 *
 * Returns `{ userAgentId, activeSkillVersionId }`.
 */
export async function ensureMainAgentUserAgent(
  supabase: SupabaseClient,
  userId: string,
  compartmentId: string,
): Promise<{ userAgentId: string; activeSkillVersionId: string }> {
  // 1) Find the main_agent template.
  const { data: tmpl, error: tmplErr } = await supabase
    .from("agent_templates")
    .select("id, name, description, default_skill_content, default_input_contracts, default_output_contracts")
    .eq("template_key", "main_agent")
    .maybeSingle();
  if (tmplErr) throw new Error(`ensureMainAgentUserAgent: ${tmplErr.message}`);
  if (!tmpl) throw new Error("main_agent template is not synced. Run /api/agent-templates/sync-local first.");

  const templateId = String(tmpl.id);
  const inputContracts = normalizeInputs(tmpl.default_input_contracts);
  const outputContracts = normalizeOutputs(tmpl.default_output_contracts);
  const skillContent = `${String(tmpl.default_skill_content ?? "")}\n${toolProtocolInstructions()}`;

  // 2) Look for an existing user_agents row.
  const { data: existing, error: exErr } = await supabase
    .from("user_agents")
    .select("id, active_skill_version_id")
    .eq("user_id", userId)
    .eq("compartment_id", compartmentId)
    .eq("template_id", templateId)
    .maybeSingle();
  if (exErr) throw new Error(`ensureMainAgentUserAgent lookup: ${exErr.message}`);

  let userAgentId: string;
  let activeSkillVersionId: string | null = null;

  if (existing) {
    userAgentId = String(existing.id);
    activeSkillVersionId = existing.active_skill_version_id ? String(existing.active_skill_version_id) : null;
  } else {
    const { data: created, error: createErr } = await supabase
      .from("user_agents")
      .insert({
        user_id: userId,
        compartment_id: compartmentId,
        template_id: templateId,
        name: String(tmpl.name ?? "Main Agent"),
        description: String(tmpl.description ?? ""),
        is_custom: false,
        enabled: true,
        archived: false,
        input_contracts: inputContracts,
        output_contracts: outputContracts,
        sort_order: 0,
      })
      .select("id")
      .single();
    if (createErr) throw new Error(`ensureMainAgentUserAgent create: ${createErr.message}`);
    userAgentId = String(created.id);
  }

  // 3) Ensure an active skill version exists.
  if (!activeSkillVersionId) {
    const { data: version, error: vErr } = await supabase
      .from("agent_skill_versions")
      .insert({
        user_id: userId,
        user_agent_id: userAgentId,
        template_id: templateId,
        version_number: 1,
        skill_content: skillContent,
        input_contracts: inputContracts,
        output_contracts: outputContracts,
        change_summary: "Auto-provisioned from main_agent template.",
        is_active: true,
      })
      .select("id")
      .single();
    if (vErr) throw new Error(`ensureMainAgentUserAgent seed version: ${vErr.message}`);
    activeSkillVersionId = String(version.id);

    const { error: linkErr } = await supabase
      .from("user_agents")
      .update({ active_skill_version_id: activeSkillVersionId })
      .eq("id", userAgentId)
      .eq("user_id", userId);
    if (linkErr) throw new Error(`ensureMainAgentUserAgent link version: ${linkErr.message}`);
  }

  return { userAgentId, activeSkillVersionId: activeSkillVersionId! };
}

type SeedStage = {
  key: string;            // pipeline_node node_key
  templateKey: string;    // agent_templates.template_key the node references
  label: string;          // human-visible
  inputs: Array<{ key: string; acceptedRoles: string[]; required: boolean }>;
  outputs: Array<{ key: string; role: string; defaultFilename: string }>;
};

// Ship-one: only main_agent node is runnable. Placeholders for the rest so the UI
// can render the pipeline list correctly.
const SEED_STAGES: SeedStage[] = [
  {
    key: "onboarding",
    templateKey: "main_agent",
    label: "Main Agent Onboarding",
    inputs: [{ key: "guidebook", acceptedRoles: ["guidebook"], required: true }],
    outputs: [{ key: "onboarding_map", role: "onboarding_map", defaultFilename: "01_onboarding_map.md" }],
  },
  {
    key: "ideation",
    templateKey: "ideation-agent",
    label: "Ideation",
    inputs: [{ key: "onboarding_map", acceptedRoles: ["onboarding_map"], required: true }],
    outputs: [{ key: "ideation_output", role: "ideation_output", defaultFilename: "02_ideation_options.md" }],
  },
  {
    key: "research",
    templateKey: "research-agent",
    label: "Research",
    inputs: [{ key: "ideation_output", acceptedRoles: ["ideation_output"], required: true }],
    outputs: [{ key: "research_output", role: "research_output", defaultFilename: "03_research_brief.md" }],
  },
  {
    key: "writing",
    templateKey: "writing-agent",
    label: "Writing",
    inputs: [{ key: "research_output", acceptedRoles: ["research_output"], required: true }],
    outputs: [{ key: "draft_output", role: "draft_output", defaultFilename: "04_draft_essay.md" }],
  },
  {
    key: "flowchart",
    templateKey: "flowchart-agent",
    label: "Flowchart",
    inputs: [{ key: "draft_output", acceptedRoles: ["draft_output"], required: true }],
    outputs: [{ key: "flowchart_output", role: "flowchart_output", defaultFilename: "05_flowchart.png" }],
  },
  {
    key: "prototype",
    templateKey: "prototype-design-agent",
    label: "Prototype",
    inputs: [{ key: "flowchart_output", acceptedRoles: ["flowchart_output"], required: true }],
    outputs: [{ key: "prototype_output", role: "prototype_output", defaultFilename: "06_prototype_spec.html" }],
  },
  {
    key: "ui",
    templateKey: "ui-design-agent",
    label: "UI Design",
    inputs: [{ key: "prototype_output", acceptedRoles: ["prototype_output"], required: true }],
    outputs: [{ key: "ui_mockup_output", role: "ui_mockup_output", defaultFilename: "07_ui_mockup.html" }],
  },
  {
    key: "supervisor",
    templateKey: "supervisor-agent",
    label: "Supervisor",
    inputs: [{ key: "draft_output", acceptedRoles: ["draft_output"], required: true }],
    outputs: [{ key: "supervisor_review", role: "supervisor_review", defaultFilename: "08_supervisor_review.md" }],
  },
];

/**
 * Ensure a competition_pipelines row + seed pipeline_nodes + pipeline_edges exist for the
 * given competition. Creates user_agents rows lazily for templates that exist in agent_templates.
 * Safe to call on every workbench open.
 */
export async function ensureCompetitionPipeline(
  supabase: SupabaseClient,
  userId: string,
  competitionId: string,
  compartmentId: string,
): Promise<{ pipelineId: string; onboardingNodeId: string | null }> {
  // Existing pipeline?
  const { data: existing, error: existingErr } = await supabase
    .from("competition_pipelines")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingErr) throw new Error(`ensureCompetitionPipeline lookup: ${existingErr.message}`);

  let pipelineId: string;
  if (existing) {
    pipelineId = String(existing.id);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("competition_pipelines")
      .insert({
        user_id: userId,
        competition_id: competitionId,
        compartment_id: compartmentId,
        name: "Default pipeline",
        status: "draft",
      })
      .select("id")
      .single();
    if (insErr) throw new Error(`ensureCompetitionPipeline create: ${insErr.message}`);
    pipelineId = String(inserted.id);
  }

  // Resolve templates we can see.
  const { data: templates, error: tErr } = await supabase
    .from("agent_templates")
    .select("id, template_key");
  if (tErr) throw new Error(`ensureCompetitionPipeline templates: ${tErr.message}`);
  const templateByKey = new Map<string, string>();
  for (const t of templates ?? []) templateByKey.set(String(t.template_key), String(t.id));

  // Resolve or create user_agents for each node template.
  const userAgentByStage = new Map<string, string>();
  for (const stage of SEED_STAGES) {
    const templateId = templateByKey.get(stage.templateKey);
    if (!templateId) continue; // template not synced (non-main stages in ship-one)

    const { data: ua, error: uaErr } = await supabase
      .from("user_agents")
      .select("id")
      .eq("user_id", userId)
      .eq("compartment_id", compartmentId)
      .eq("template_id", templateId)
      .maybeSingle();
    if (uaErr) throw new Error(`ensureCompetitionPipeline user_agents lookup ${stage.key}: ${uaErr.message}`);
    let userAgentId: string;
    if (ua) {
      userAgentId = String(ua.id);
    } else {
      const { data: created, error: createErr } = await supabase
        .from("user_agents")
        .insert({
          user_id: userId,
          compartment_id: compartmentId,
          template_id: templateId,
          name: stage.label,
          description: "",
          is_custom: false,
          enabled: true,
          archived: false,
          input_contracts: stage.inputs.map((i) => ({
            key: i.key, label: i.key, acceptedRoles: i.acceptedRoles, required: i.required, includeMode: "full",
          })),
          output_contracts: stage.outputs.map((o) => ({
            key: o.key, label: o.key, role: o.role, defaultFilename: o.defaultFilename,
          })),
        })
        .select("id")
        .single();
      if (createErr) throw new Error(`ensureCompetitionPipeline user_agents create ${stage.key}: ${createErr.message}`);
      userAgentId = String(created.id);
    }
    userAgentByStage.set(stage.key, userAgentId);
  }

  // Upsert pipeline_nodes.
  const nodeIdByStage = new Map<string, string>();
  for (let i = 0; i < SEED_STAGES.length; i++) {
    const stage = SEED_STAGES[i];
    const userAgentId = userAgentByStage.get(stage.key);
    if (!userAgentId) continue;

    const { data: existingNode, error: nErr } = await supabase
      .from("pipeline_nodes")
      .select("id")
      .eq("pipeline_id", pipelineId)
      .eq("node_key", stage.key)
      .maybeSingle();
    if (nErr) throw new Error(`ensureCompetitionPipeline node lookup ${stage.key}: ${nErr.message}`);
    if (existingNode) {
      nodeIdByStage.set(stage.key, String(existingNode.id));
      continue;
    }
    const { data: created, error: createNodeErr } = await supabase
      .from("pipeline_nodes")
      .insert({
        pipeline_id: pipelineId,
        user_agent_id: userAgentId,
        node_key: stage.key,
        label: stage.label,
        position_index: i,
        input_contracts: stage.inputs.map((inp) => ({
          key: inp.key, acceptedRoles: inp.acceptedRoles, required: inp.required, includeMode: "full",
        })),
        output_contracts: stage.outputs.map((out) => ({
          key: out.key, role: out.role, defaultFilename: out.defaultFilename,
        })),
      })
      .select("id")
      .single();
    if (createNodeErr) throw new Error(`ensureCompetitionPipeline node create ${stage.key}: ${createNodeErr.message}`);
    nodeIdByStage.set(stage.key, String(created.id));
  }

  // Seed sequential edges between consecutive nodes.
  for (let i = 1; i < SEED_STAGES.length; i++) {
    const from = SEED_STAGES[i - 1];
    const to = SEED_STAGES[i];
    const fromId = nodeIdByStage.get(from.key);
    const toId = nodeIdByStage.get(to.key);
    if (!fromId || !toId) continue;

    const toInputKey = to.inputs[0]?.key;
    const fromOutputKey = from.outputs[0]?.key;
    if (!toInputKey || !fromOutputKey) continue;

    const { data: existingEdge, error: eErr } = await supabase
      .from("pipeline_edges")
      .select("id")
      .eq("pipeline_id", pipelineId)
      .eq("from_node_id", fromId)
      .eq("to_node_id", toId)
      .eq("to_input_key", toInputKey)
      .maybeSingle();
    if (eErr) throw new Error(`ensureCompetitionPipeline edge lookup: ${eErr.message}`);
    if (existingEdge) continue;

    const { error: createEdgeErr } = await supabase.from("pipeline_edges").insert({
      pipeline_id: pipelineId,
      from_node_id: fromId,
      from_output_key: fromOutputKey,
      to_node_id: toId,
      to_input_key: toInputKey,
      source_type: "agent_output",
      required: true,
      allow_any_file: false,
    });
    if (createEdgeErr) throw new Error(`ensureCompetitionPipeline edge create: ${createEdgeErr.message}`);
  }

  return { pipelineId, onboardingNodeId: nodeIdByStage.get("onboarding") ?? null };
}

function normalizeInputs(raw: unknown) {
  if (Array.isArray(raw) && raw.length > 0) return raw;
  return [{ key: "guidebook", label: "Guidebook", acceptedRoles: ["guidebook"], required: true, includeMode: "full" }];
}

function normalizeOutputs(raw: unknown) {
  if (Array.isArray(raw) && raw.length > 0) return raw;
  return [{ key: "onboarding_map", label: "Onboarding Map", role: "onboarding_map", defaultFilename: "01_onboarding_map.md" }];
}

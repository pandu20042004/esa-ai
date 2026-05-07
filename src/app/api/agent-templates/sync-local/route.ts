import path from "node:path";

import {
  DEFAULT_COMPARTMENTS,
  buildAgentTemplateUpsertRows,
  getVisibleEssayTemplates,
} from "@/lib/server/agent-bootstrap";
import { discoverAgentTemplates } from "@/lib/server/agent-template-sync";
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export async function POST() {
  if (!isSupabaseAdminConfigured()) {
    return Response.json(
      {
        error: "Supabase admin is not configured",
        message: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before syncing templates.",
      },
      { status: 503 },
    );
  }

  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return Response.json({ error: "Supabase admin client unavailable" }, { status: 503 });
  }

  const skillsRoot = path.join(process.cwd(), "skills");
  const templates = discoverAgentTemplates(skillsRoot);
  const templateRows = buildAgentTemplateUpsertRows(templates);

  const { data: syncedTemplates, error: templateError } = await supabase
    .from("agent_templates")
    .upsert(templateRows, { onConflict: "template_key" })
    .select("*");

  if (templateError) {
    return Response.json({ error: templateError.message }, { status: 500 });
  }

  const compartmentRows = DEFAULT_COMPARTMENTS.map((compartment) => ({
    user_id: user.id,
    name: compartment.name,
    slug: compartment.slug,
    is_default: true,
    sort_order: compartment.sortOrder,
  }));

  const { data: compartments, error: compartmentError } = await supabase
    .from("compartments")
    .upsert(compartmentRows, { onConflict: "user_id,slug" })
    .select("*");

  if (compartmentError) {
    return Response.json({ error: compartmentError.message }, { status: 500 });
  }

  const essayCompartment = compartments?.find((item) => item.slug === "essay");
  const visibleEssayTemplates = getVisibleEssayTemplates(templates);
  const templateByKey = new Map((syncedTemplates ?? []).map((item) => [item.template_key, item]));

  if (essayCompartment) {
    for (const [index, template] of visibleEssayTemplates.entries()) {
      const syncedTemplate = templateByKey.get(template.templateKey);
      if (!syncedTemplate) continue;

      const { data: userAgent, error: agentError } = await supabase
        .from("user_agents")
        .upsert(
          {
            user_id: user.id,
            compartment_id: essayCompartment.id,
            template_id: syncedTemplate.id,
            name: template.name,
            description: template.description,
            stage_key: null,
            input_contracts: [],
            output_contracts: [],
            is_custom: false,
            enabled: true,
            sort_order: index,
          },
          { onConflict: "user_id,compartment_id,template_id" },
        )
        .select("*")
        .single();

      if (agentError) {
        return Response.json({ error: agentError.message }, { status: 500 });
      }

      const { data: version, error: versionError } = await supabase
        .from("agent_skill_versions")
        .insert({
          user_id: user.id,
          user_agent_id: userAgent.id,
          template_id: syncedTemplate.id,
          version_number: 1,
          skill_content: template.defaultSkillContent,
          input_contracts: [],
          output_contracts: [],
          change_summary: "Initial version from built-in template.",
          is_active: true,
        })
        .select("id")
        .single();

      if (versionError && versionError.code !== "23505") {
        return Response.json({ error: versionError.message }, { status: 500 });
      }

      if (version?.id) {
        await supabase.from("user_agents").update({ active_skill_version_id: version.id }).eq("id", userAgent.id);
      }
    }
  }

  return Response.json({
    data: {
      templates: templateRows.length,
      compartments: compartmentRows.length,
      essayAgents: visibleEssayTemplates.length,
    },
    meta: {
      backendMode: "supabase",
      message: "Local skills synced to Supabase templates and user Essay compartment.",
    },
  });
}

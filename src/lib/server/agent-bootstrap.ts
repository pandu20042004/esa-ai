import type { DiscoveredAgentTemplate } from "@/lib/server/agent-template-sync";

export const DEFAULT_COMPARTMENTS = [
  { name: "Essay", slug: "essay", sortOrder: 0 },
  { name: "KTI", slug: "kti", sortOrder: 1 },
  { name: "Business Plan", slug: "business-plan", sortOrder: 2 },
  { name: "PKM", slug: "pkm", sortOrder: 3 },
] as const;

export function buildAgentTemplateUpsertRows(templates: DiscoveredAgentTemplate[]) {
  return templates.map((template) => ({
    template_key: template.templateKey,
    source_path: template.sourcePath,
    name: template.name,
    description: template.description,
    default_compartment_key: template.defaultCompartmentKey,
    default_stage_key: null,
    default_skill_content: template.defaultSkillContent,
    default_input_contracts: [],
    default_output_contracts: [],
    visible_in_agent_list: template.visibleInAgentList,
    template_kind: template.templateKind,
    metadata: {},
    content_hash: template.contentHash,
  }));
}

export function getVisibleEssayTemplates(templates: DiscoveredAgentTemplate[]) {
  return templates.filter(
    (template) =>
      template.defaultCompartmentKey === "Essay" &&
      template.visibleInAgentList &&
      template.templateKind === "workflow_agent",
  );
}

import { describe, expect, it } from "vitest";

import {
  DEFAULT_COMPARTMENTS,
  buildAgentTemplateUpsertRows,
  getVisibleEssayTemplates,
} from "@/lib/server/agent-bootstrap";
import type { DiscoveredAgentTemplate } from "@/lib/server/agent-template-sync";

const templates: DiscoveredAgentTemplate[] = [
  {
    templateKey: "research-agent",
    sourcePath: "skills/research-agent/SKILL.md",
    name: "Research Agent",
    description: "Research",
    defaultCompartmentKey: "Essay",
    defaultSkillContent: "# Research",
    visibleInAgentList: true,
    templateKind: "workflow_agent",
    contentHash: "hash-research",
  },
  {
    templateKey: "supabase",
    sourcePath: "skills/supabase/SKILL.md",
    name: "Supabase",
    description: "Hidden",
    defaultCompartmentKey: null,
    defaultSkillContent: "# Supabase",
    visibleInAgentList: false,
    templateKind: "infrastructure_skill",
    contentHash: "hash-supabase",
  },
];

describe("agent bootstrap", () => {
  it("defines the default user compartments", () => {
    expect(DEFAULT_COMPARTMENTS.map((item) => item.name)).toEqual([
      "Essay",
      "KTI",
      "Business Plan",
      "PKM",
    ]);
  });

  it("builds Supabase rows for discovered templates", () => {
    expect(buildAgentTemplateUpsertRows(templates)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          template_key: "research-agent",
          visible_in_agent_list: true,
          template_kind: "workflow_agent",
        }),
        expect.objectContaining({
          template_key: "supabase",
          visible_in_agent_list: false,
          template_kind: "infrastructure_skill",
        }),
      ]),
    );
  });

  it("copies only visible Essay templates into user agents", () => {
    expect(getVisibleEssayTemplates(templates).map((item) => item.templateKey)).toEqual([
      "research-agent",
    ]);
  });
});

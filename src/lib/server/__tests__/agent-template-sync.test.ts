import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { discoverAgentTemplates } from "@/lib/server/agent-template-sync";

describe("agent template sync", () => {
  it("discovers visible essay agents and hides infrastructure skills", () => {
    const root = mkdtempSync(path.join(tmpdir(), "esai-skills-"));

    mkdirSync(path.join(root, "research-agent"));
    writeFileSync(
      path.join(root, "research-agent", "SKILL.md"),
      "---\nname: research-agent\ndescription: Research skill\n---\n# Research Agent\nBody",
    );

    mkdirSync(path.join(root, "supabase"));
    writeFileSync(
      path.join(root, "supabase", "SKILL.md"),
      "---\nname: supabase\ndescription: Infra\n---\n# Supabase\nBody",
    );

    mkdirSync(path.join(root, "essay-profile"));
    writeFileSync(path.join(root, "essay-profile", "00_style_profile.md"), "# Style");

    const templates = discoverAgentTemplates(root);

    expect(templates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          templateKey: "research-agent",
          visibleInAgentList: true,
          templateKind: "workflow_agent",
        }),
        expect.objectContaining({
          templateKey: "supabase",
          visibleInAgentList: false,
          templateKind: "infrastructure_skill",
        }),
        expect.objectContaining({
          templateKey: "essay-profile",
          visibleInAgentList: false,
          templateKind: "style_profile",
        }),
      ]),
    );
  });
});

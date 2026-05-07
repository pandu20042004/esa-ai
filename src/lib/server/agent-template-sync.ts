import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export type DiscoveredAgentTemplate = {
  templateKey: string;
  sourcePath: string;
  name: string;
  description: string;
  defaultCompartmentKey: string | null;
  defaultSkillContent: string;
  visibleInAgentList: boolean;
  templateKind: "workflow_agent" | "style_builder" | "style_profile" | "infrastructure_skill";
  contentHash: string;
};

const hiddenSkillKeys = new Set(["supabase", "supabase-postgres-best-practices"]);

function hashContent(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function readFrontmatter(content: string) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatter = match?.[1] ?? "";
  const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim();

  return { name, description };
}

function templateKindForKey(templateKey: string): DiscoveredAgentTemplate["templateKind"] {
  if (templateKey === "essay-profile") return "style_profile";
  if (templateKey === "style-profile-builder") return "style_builder";
  if (hiddenSkillKeys.has(templateKey)) return "infrastructure_skill";
  return "workflow_agent";
}

function contentPathForSkill(skillPath: string) {
  const skillMd = path.join(skillPath, "SKILL.md");
  if (existsSync(skillMd)) return skillMd;

  const styleProfile = path.join(skillPath, "00_style_profile.md");
  if (existsSync(styleProfile)) return styleProfile;

  return null;
}

export function discoverAgentTemplates(skillsRoot: string): DiscoveredAgentTemplate[] {
  if (!existsSync(skillsRoot)) return [];

  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const templateKey = entry.name;
      const skillPath = path.join(skillsRoot, templateKey);
      const sourcePath = contentPathForSkill(skillPath);

      if (!sourcePath) return [];

      const defaultSkillContent = readFileSync(sourcePath, "utf8");
      const frontmatter = readFrontmatter(defaultSkillContent);
      const templateKind = templateKindForKey(templateKey);

      return [
        {
          templateKey,
          sourcePath,
          name: frontmatter.name ?? templateKey,
          description: frontmatter.description ?? "",
          defaultCompartmentKey: templateKind === "infrastructure_skill" ? null : "Essay",
          defaultSkillContent,
          visibleInAgentList: templateKind === "workflow_agent",
          templateKind,
          contentHash: hashContent(defaultSkillContent),
        },
      ];
    })
    .sort((a, b) => a.templateKey.localeCompare(b.templateKey));
}

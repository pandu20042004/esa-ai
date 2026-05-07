import path from "node:path";

import { discoverAgentTemplates } from "@/lib/server/agent-template-sync";

export async function GET() {
  const skillsRoot = path.join(process.cwd(), "skills");
  const templates = discoverAgentTemplates(skillsRoot);

  return Response.json({
    data: templates.map((template) => ({
      templateKey: template.templateKey,
      sourcePath: template.sourcePath,
      name: template.name,
      description: template.description,
      defaultCompartmentKey: template.defaultCompartmentKey,
      visibleInAgentList: template.visibleInAgentList,
      templateKind: template.templateKind,
      contentHash: template.contentHash,
    })),
    meta: {
      backendMode: "local",
      message: "Discovered local web/skills templates. Sync to Supabase after applying migrations.",
    },
  });
}

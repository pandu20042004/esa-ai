import { getAllAvailableModels } from "@/lib/server/cli-providers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh") === "1";
  const models = getAllAvailableModels(refresh);

  return Response.json({
    data: models.map((m) => ({
      provider: m.provider,
      id: m.id,
      label: m.label,
      description: m.description,
      reasoningEfforts: m.reasoningEfforts,
      defaultReasoningEffort: m.defaultReasoningEffort,
      source: m.source,
    })),
  });
}

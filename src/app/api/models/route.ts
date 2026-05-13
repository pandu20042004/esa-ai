import { getAllAvailableModels } from "@/lib/server/cli-providers";

export const dynamic = "force-dynamic";

export async function GET() {
  const models = getAllAvailableModels();

  return Response.json({
    data: models.map((m) => ({
      provider: m.provider,
      id: m.id,
      label: m.label,
    })),
  });
}

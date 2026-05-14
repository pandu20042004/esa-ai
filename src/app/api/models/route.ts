import { detectCliProviders, getApiProviderModels, getMockProviderModels, getAllAvailableModels } from "@/lib/server/cli-providers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh") === "1";
  if (refresh) {
    // Force-refresh CLI detection cache.
    detectCliProviders(true);
  }
  const models = getAllAvailableModels();
  // Suppress unused import warnings (used implicitly by getAllAvailableModels).
  void getApiProviderModels;
  void getMockProviderModels;

  return Response.json({
    data: models.map((m) => ({
      provider: m.provider,
      id: m.id,
      label: m.label,
    })),
  });
}

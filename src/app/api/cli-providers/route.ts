import { detectCliProviders, getApiProviderModels } from "@/lib/server/cli-providers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh") === "1";

  const cliProviders = detectCliProviders(refresh);
  const apiModels = getApiProviderModels();

  const apiProviders = [];

  if (process.env.OPENAI_API_KEY) {
    apiProviders.push({ id: "openai-api", name: "OpenAI API", configured: true });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    apiProviders.push({ id: "anthropic-api", name: "Anthropic API", configured: true });
  }
  if (process.env.OPENROUTER_API_KEY) {
    apiProviders.push({ id: "openrouter", name: "OpenRouter", configured: true });
  }

  return Response.json({
    data: {
      cliProviders,
      apiProviders,
      apiModels,
      localCliEnabled: process.env.ENABLE_LOCAL_CLI_PROVIDERS === "true",
    },
  });
}

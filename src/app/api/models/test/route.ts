import { validateModelRequest } from "@/lib/esai/api";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = validateModelRequest(body);

  if (!parsed.success) {
    return Response.json({ error: "Model selection required", issues: parsed.error.flatten() }, { status: 400 });
  }

  return Response.json({
    data: {
      ok: true,
      provider: parsed.data.provider,
      model: parsed.data.model,
      reasoningEffort: parsed.data.reasoningEffort,
    },
    meta: {
      backendMode: "mock",
      message: "Model test passed locally. Add provider keys for real network calls.",
    },
  });
}


import { z } from "zod";

import { createApiEnvelope, validateModelRequest } from "@/lib/esai/api";

const chatSchema = z.object({
  message: z.string().trim().min(1),
  model: z.string().trim().min(1),
  reasoningEffort: z.enum(["low", "medium", "high", "xhigh"]).default("medium"),
  context: z.record(z.string(), z.unknown()).default({}),
  threadType: z.string().default("global"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = chatSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid chat payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const model = validateModelRequest(parsed.data);
  if (!model.success) {
    return Response.json({ error: "Model selection required", issues: model.error.flatten() }, { status: 400 });
  }

  return Response.json(
    createApiEnvelope(
      {
        id: `message-${Date.now()}`,
        role: "assistant",
        content:
          "I received the current ESAI context. Configure a model provider to replace this mock response with real execution.",
        context: parsed.data.context,
      },
      { supabaseConfigured: false },
    ),
    { status: 201 },
  );
}


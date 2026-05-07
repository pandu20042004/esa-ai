import { z } from "zod";

import { createApiEnvelope, validateModelRequest } from "@/lib/esai/api";

const runSchema = z.object({
  competitionId: z.string().trim().min(1),
  agentId: z.string().trim().min(1),
  stageId: z.enum(["onboarding", "ideation", "research", "writing", "flowchart", "prototype", "ui", "supervisor"]),
  model: z.string().trim().min(1),
  reasoningEffort: z.enum(["low", "medium", "high", "xhigh"]).default("medium"),
  inputFileIds: z.array(z.string()).default([]),
  pipelineId: z.string().trim().optional(),
  pipelineNodeId: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = runSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid agent run payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const model = validateModelRequest({
    model: parsed.data.model,
    reasoningEffort: parsed.data.reasoningEffort,
  });

  if (!model.success) {
    return Response.json({ error: "Model selection required", issues: model.error.flatten() }, { status: 400 });
  }

  const data = {
    id: `run-${Date.now()}`,
    status: "queued",
    ...parsed.data,
    queuedAt: new Date().toISOString(),
  };

  return Response.json(createApiEnvelope(data, { supabaseConfigured: false }), { status: 201 });
}

import { z } from "zod";

import { createApiEnvelope } from "@/lib/esai/api";
import { unauthorizedResponse } from "@/lib/server/auth";
import { createRequestRepository } from "@/lib/server/request-repository";

const validityCheckSchema = z.object({
  competitionId: z.string().trim().min(1),
  outputFileId: z.string().trim().min(1),
  journalFileId: z.string().trim().min(1),
  selectedClaim: z.string().trim().min(1),
});

export async function GET() {
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();
  return Response.json(await repository.listValidityChecks());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = validityCheckSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid validity check payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  return Response.json(
    createApiEnvelope(
      {
        id: `validity-${Date.now()}`,
        ...parsed.data,
        verdict: "supported",
        evidenceText:
          "Mock evidence paragraph. Configure PDF extraction and retrieval before using this verdict academically.",
      },
      { supabaseConfigured: false },
    ),
    { status: 201 },
  );
}

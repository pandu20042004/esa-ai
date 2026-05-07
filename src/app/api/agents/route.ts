import { unauthorizedResponse } from "@/lib/server/auth";
import { createRequestRepository } from "@/lib/server/request-repository";

export async function GET() {
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();
  return Response.json(await repository.listAgents());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  return Response.json(
    {
      data: {
        id: `agent-${Date.now()}`,
        enabled: true,
        isCustom: true,
        ...body,
      },
      meta: {
        backendMode: "mock",
        message: "Custom agent accepted locally. Configure Supabase to persist it.",
      },
    },
    { status: 201 },
  );
}

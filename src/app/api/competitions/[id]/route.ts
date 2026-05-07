import { unauthorizedResponse } from "@/lib/server/auth";
import { createRequestRepository } from "@/lib/server/request-repository";

export async function GET(_request: Request, context: RouteContext<"/api/competitions/[id]">) {
  const { id } = await context.params;
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();
  const response = await repository.getCompetition(id);

  return Response.json(response, { status: response.data ? 200 : 404 });
}

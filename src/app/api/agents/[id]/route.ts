import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

const meta = { backendMode: "supabase" };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const { id } = await context.params;

  try {
    const repository = createDevsAgentsRepository(user.id);
    const data = await repository.getAgent(id);

    return Response.json({ data, meta }, { status: data ? 200 : 404 });
  } catch (error) {
    return errorResponse(error, "Unable to get agent.");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  try {
    const repository = createDevsAgentsRepository(user.id);
    if (body.archived === true) {
      await repository.archiveAgent(id);
    }

    const data = await repository.getAgent(id);
    return Response.json({ data, meta }, { status: data ? 200 : 404 });
  } catch (error) {
    return errorResponse(error, "Unable to update agent.");
  }
}

function errorResponse(error: unknown, fallback = "Request failed.") {
  const message = error instanceof Error ? error.message : fallback;
  const status = /required|not found/i.test(message) ? 400 : 500;
  return Response.json({ error: message }, { status });
}

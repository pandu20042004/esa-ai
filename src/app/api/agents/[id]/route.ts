import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

const meta = { backendMode: "supabase" };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const { id } = await context.params;
  const repository = createDevsAgentsRepository(user.id);
  const data = await repository.getAgent(id);

  return Response.json({ data, meta }, { status: data ? 200 : 404 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const repository = createDevsAgentsRepository(user.id);

  try {
    if (body.archived === true) {
      await repository.archiveAgent(id);
    }

    const data = await repository.getAgent(id);
    return Response.json({ data, meta }, { status: data ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update agent.";
    return Response.json({ error: message }, { status: 500 });
  }
}

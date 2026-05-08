import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

const meta = { backendMode: "supabase" };

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const repository = createDevsAgentsRepository(user.id);

  try {
    const data = await repository.updateCompartment(id, {
      name: typeof body.name === "string" ? body.name : undefined,
      archived: typeof body.archived === "boolean" ? body.archived : undefined,
    });

    return Response.json({ data, meta }, { status: data ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update compartment.";
    const status = message.toLowerCase().includes("required") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}

import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

const meta = { backendMode: "supabase" };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const { id } = await context.params;

  try {
    const repository = createDevsAgentsRepository(user.id);
    const data = await repository.listVersions(id);

    return Response.json({ data, meta });
  } catch (error) {
    return errorResponse(error, "Unable to list versions.");
  }
}

function errorResponse(error: unknown, fallback = "Request failed.") {
  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: 500 });
}

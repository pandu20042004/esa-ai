import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

const meta = { backendMode: "supabase" };

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  try {
    const repository = createDevsAgentsRepository(user.id);
    const data = await repository.saveDraft(id, {
      skillContent: typeof body.skillContent === "string" ? body.skillContent : "",
      needs: Array.isArray(body.needs) ? body.needs : [],
      produces: Array.isArray(body.produces) ? body.produces : [],
    });

    return Response.json({ data, meta });
  } catch (error) {
    return errorResponse(error, "Unable to save draft.");
  }
}

function errorResponse(error: unknown, fallback = "Request failed.") {
  const message = error instanceof Error ? error.message : fallback;
  const status = message === "Agent not found." ? 404 : 500;
  return Response.json({ error: message }, { status });
}

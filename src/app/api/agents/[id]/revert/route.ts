import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

const meta = { backendMode: "supabase" };

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  try {
    const repository = createDevsAgentsRepository(user.id);
    const data = await repository.copyVersionToDraft(id, {
      useTemplate: body.source === "template",
      versionId: typeof body.versionId === "string" ? body.versionId : undefined,
    });

    return Response.json({ data, meta });
  } catch (error) {
    return errorResponse(error, "Unable to revert draft.");
  }
}

function errorResponse(error: unknown, fallback = "Request failed.") {
  const message = error instanceof Error ? error.message : fallback;
  const status = /not found/i.test(message) ? 404 : /required|template/i.test(message) ? 400 : 500;
  return Response.json({ error: message }, { status });
}

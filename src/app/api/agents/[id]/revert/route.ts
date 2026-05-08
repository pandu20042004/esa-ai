import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import {
  ValidationError,
  createDevsAgentsRepository,
} from "@/lib/server/devs-agents-repository";

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
  let status = 500;

  if (error instanceof ValidationError || (error instanceof Error && error.name === "ValidationError")) {
    status = 400;
  } else if (["Agent not found.", "Version not found.", "Template not found."].includes(message)) {
    status = 404;
  } else if (message === "Version is required." || message === "Agent has no template.") {
    status = 400;
  }

  return Response.json({ error: message }, { status });
}

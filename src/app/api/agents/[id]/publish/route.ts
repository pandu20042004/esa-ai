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
    const data = await repository.publishDraft(
      id,
      typeof body.changeSummary === "string" ? body.changeSummary : undefined,
    );

    return Response.json({ data, meta });
  } catch (error) {
    return errorResponse(error, "Unable to publish draft.");
  }
}

function errorResponse(error: unknown, fallback = "Request failed.") {
  const message = error instanceof Error ? error.message : fallback;
  let status = 500;

  if (error instanceof ValidationError || (error instanceof Error && error.name === "ValidationError")) {
    status = 400;
  } else if (["Agent not found.", "Version not found.", "Template not found."].includes(message)) {
    status = 404;
  }

  return Response.json({ error: message }, { status });
}

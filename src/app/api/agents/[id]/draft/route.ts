import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import {
  ValidationError,
  createDevsAgentsRepository,
} from "@/lib/server/devs-agents-repository";

const meta = { backendMode: "supabase" };

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const { id } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isDraftBody(body)) {
    return Response.json({ error: "Invalid draft body." }, { status: 400 });
  }

  try {
    const repository = createDevsAgentsRepository(user.id);
    const data = await repository.saveDraft(id, {
      skillContent: body.skillContent,
      needs: body.needs,
      produces: body.produces,
    });

    return Response.json({ data, meta });
  } catch (error) {
    return errorResponse(error, "Unable to save draft.");
  }
}

type DraftBody = {
  skillContent: string;
  needs: unknown[];
  produces: unknown[];
};

function isDraftBody(value: unknown): value is DraftBody {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as DraftBody).skillContent === "string" &&
    Array.isArray((value as DraftBody).needs) &&
    Array.isArray((value as DraftBody).produces)
  );
}

function errorResponse(error: unknown, fallback = "Request failed.") {
  const message = error instanceof Error ? error.message : fallback;
  let status = 500;

  if (error instanceof ValidationError || (error instanceof Error && error.name === "ValidationError")) {
    status = 400;
  } else if (message === "Agent not found.") {
    status = 404;
  }

  return Response.json({ error: message }, { status });
}

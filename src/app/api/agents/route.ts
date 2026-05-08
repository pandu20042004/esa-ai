import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

const meta = { backendMode: "supabase" };

export async function GET(request: Request) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const compartmentId = searchParams.get("compartmentId");
    const repository = createDevsAgentsRepository(user.id);
    const data = await repository.listAgents(compartmentId);

    return Response.json({ data, meta });
  } catch (error) {
    return errorResponse(error, "Unable to list agents.");
  }
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const body = await request.json().catch(() => ({}));

  try {
    const repository = createDevsAgentsRepository(user.id);
    const data = await repository.createAgent({
      compartmentId: typeof body.compartmentId === "string" ? body.compartmentId : "",
      name: typeof body.name === "string" ? body.name : "",
      description: typeof body.description === "string" ? body.description : "",
    });

    return Response.json({ data, meta }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to create agent.");
  }
}

function errorResponse(error: unknown, fallback = "Request failed.") {
  const message = error instanceof Error ? error.message : fallback;
  const status = /required|not found/i.test(message) ? 400 : 500;
  return Response.json({ error: message }, { status });
}

import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

const meta = { backendMode: "supabase" };

export async function GET() {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  try {
    const repository = createDevsAgentsRepository(user.id);
    const data = await repository.listCompartments();

    return Response.json({ data, meta });
  } catch (error) {
    return errorResponse(error, "Unable to list compartments.");
  }
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const body = await request.json().catch(() => ({}));

  try {
    const repository = createDevsAgentsRepository(user.id);
    const data = await repository.createCompartment(typeof body.name === "string" ? body.name : "");
    return Response.json({ data, meta }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Unable to create compartment.");
  }
}

function errorResponse(error: unknown, fallback = "Request failed.") {
  const message = error instanceof Error ? error.message : fallback;
  const status = /required|not found/i.test(message) ? 400 : 500;
  return Response.json({ error: message }, { status });
}

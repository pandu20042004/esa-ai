import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

const meta = { backendMode: "supabase" };

export async function GET() {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const repository = createDevsAgentsRepository(user.id);
  const data = await repository.listCompartments();

  return Response.json({ data, meta });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const body = await request.json().catch(() => ({}));
  const repository = createDevsAgentsRepository(user.id);

  try {
    const data = await repository.createCompartment(typeof body.name === "string" ? body.name : "");
    return Response.json({ data, meta }, { status: 201 });
  } catch (error) {
    return repositoryErrorResponse(error);
  }
}

function repositoryErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to create compartment.";
  const status = message.toLowerCase().includes("required") ? 400 : 500;
  return Response.json({ error: message }, { status });
}

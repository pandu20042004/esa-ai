import { z } from "zod";
import { errorResponse } from "@/lib/server/api-errors";
import { unauthorizedResponse } from "@/lib/server/auth";
import { createRequestRepository } from "@/lib/server/request-repository";

export async function GET(_request: Request, context: RouteContext<"/api/competitions/[id]">) {
  const { id } = await context.params;
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();
  const response = await repository.getCompetition(id);
  return Response.json(response, { status: response.data ? 200 : 404 });
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  institution: z.string().trim().max(200).nullable().optional(),
  deadline: z.string().trim().nullable().optional(),
  registrationLink: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(request: Request, context: RouteContext<"/api/competitions/[id]">) {
  const { id } = await context.params;
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse({
      message: "Invalid patch payload.",
      code: "ERR_VALIDATION",
      status: 400,
      details: { issues: parsed.error.flatten() },
    });
  }

  try {
    const response = await repository.updateCompetition(id, parsed.data);
    return Response.json(response);
  } catch (cause) {
    return errorResponse({
      message: cause instanceof Error ? cause.message : "Update failed.",
      code: "ERR_UPDATE_COMPETITION",
      status: 500,
      cause,
    });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/competitions/[id]">) {
  const { id } = await context.params;
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();

  try {
    const response = await repository.deleteCompetition(id);
    return Response.json(response);
  } catch (cause) {
    return errorResponse({
      message: cause instanceof Error ? cause.message : "Delete failed.",
      code: "ERR_DELETE_COMPETITION",
      status: 500,
      cause,
    });
  }
}

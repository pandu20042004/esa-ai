import { errorResponse } from "@/lib/server/api-errors";
import { unauthorizedResponse } from "@/lib/server/auth";
import { createRequestRepository } from "@/lib/server/request-repository";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();

  try {
    const response = await repository.getFileSignedUrl(id);
    return Response.json(response);
  } catch (cause) {
    return errorResponse({
      message: cause instanceof Error ? cause.message : "Failed to sign URL.",
      code: "ERR_SIGN_URL",
      status: 500,
      cause,
    });
  }
}

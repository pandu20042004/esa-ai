import { unauthorizedResponse } from "@/lib/server/auth";
import { createRequestRepository } from "@/lib/server/request-repository";

export async function GET() {
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();
  return Response.json(await repository.listFiles());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  return Response.json(
    {
      data: {
        id: `file-${Date.now()}`,
        ...body,
        approved: false,
      },
      meta: {
        backendMode: "mock",
        message: "Upload metadata accepted locally. Configure Supabase Storage for real file persistence.",
      },
    },
    { status: 201 },
  );
}

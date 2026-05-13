import { z } from "zod";

import { unauthorizedResponse } from "@/lib/server/auth";
import { createRequestRepository } from "@/lib/server/request-repository";

const createCompetitionSchema = z.object({
  title: z.string().trim().min(1),
  category: z.string().trim().min(1).default("Essay"),
  institution: z.string().trim().min(1).default("Institution"),
  deadline: z.string().trim().optional(),
  registrationLink: z.string().trim().optional(),
  posterFileId: z.string().trim().optional(),
});

export async function GET() {
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();
  return Response.json(await repository.listCompetitions());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = createCompetitionSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid competition payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();
  return Response.json(await repository.createCompetition(parsed.data), { status: 201 });
}

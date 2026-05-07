import { z } from "zod";

import { unauthorizedResponse } from "@/lib/server/auth";
import { createRequestRepository } from "@/lib/server/request-repository";

const calendarEventSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  startTime: z.string().trim().optional(),
  endTime: z.string().trim().optional(),
  category: z.enum(["Deadline", "Stage", "Asset", "Review", "Personal"]).default("Personal"),
  color: z.enum(["accent", "neutral", "warn", "danger"]).default("accent"),
  tags: z.array(z.string()).default(["personal"]),
  source: z.enum(["competition_deadline", "guidebook", "user", "agent", "review"]).default("user"),
  competitionId: z.string().optional(),
  stageId: z.enum(["onboarding", "ideation", "research", "writing", "flowchart", "prototype", "ui", "supervisor"]).optional(),
});

export async function GET() {
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();
  return Response.json(await repository.listCalendarEvents());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = calendarEventSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Invalid calendar event payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();
  return Response.json(await repository.createCalendarEvent(parsed.data), { status: 201 });
}

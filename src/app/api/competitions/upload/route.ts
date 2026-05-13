import { z } from "zod";
import { errorResponse } from "@/lib/server/api-errors";
import { unauthorizedResponse } from "@/lib/server/auth";
import { createRequestRepository } from "@/lib/server/request-repository";

const POSTER_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const GUIDEBOOK_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/markdown",
  "text/plain",
]);
const POSTER_MAX = 5 * 1024 * 1024;
const GUIDEBOOK_MAX = 20 * 1024 * 1024;

const fieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  institution: z.string().trim().max(200).optional(),
  deadline: z.string().trim().optional(),
  registrationLink: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();

  let form: FormData;
  try {
    form = await request.formData();
  } catch (cause) {
    return errorResponse({ message: "Invalid multipart form.", code: "ERR_BAD_FORM", status: 400, cause });
  }

  const parsed = fieldsSchema.safeParse({
    title: form.get("title"),
    category: form.get("category"),
    institution: form.get("institution") || undefined,
    deadline: form.get("deadline") || undefined,
    registrationLink: form.get("registrationLink") || undefined,
  });
  if (!parsed.success) {
    return errorResponse({
      message: "Invalid competition fields.",
      code: "ERR_VALIDATION",
      status: 400,
      details: { issues: parsed.error.flatten() },
    });
  }

  const poster = form.get("poster");
  const guidebook = form.get("guidebook");
  if (!(poster instanceof File) || !(guidebook instanceof File)) {
    return errorResponse({ message: "Poster and guidebook files are required.", code: "ERR_MISSING_FILES", status: 400 });
  }
  if (!POSTER_MIME.has(poster.type)) {
    return errorResponse({ message: `Poster must be PNG, JPEG, or WebP. Got ${poster.type}.`, code: "ERR_POSTER_MIME", status: 400 });
  }
  if (poster.size > POSTER_MAX) {
    return errorResponse({ message: "Poster exceeds 5 MB.", code: "ERR_POSTER_SIZE", status: 400 });
  }
  if (!GUIDEBOOK_MIME.has(guidebook.type)) {
    return errorResponse({ message: `Guidebook must be PDF, DOCX, MD, or TXT. Got ${guidebook.type}.`, code: "ERR_GUIDEBOOK_MIME", status: 400 });
  }
  if (guidebook.size > GUIDEBOOK_MAX) {
    return errorResponse({ message: "Guidebook exceeds 20 MB.", code: "ERR_GUIDEBOOK_SIZE", status: 400 });
  }

  try {
    const response = await repository.createCompetitionAtomic({
      title: parsed.data.title,
      category: parsed.data.category,
      institution: parsed.data.institution,
      deadline: parsed.data.deadline,
      registrationLink: parsed.data.registrationLink,
      poster,
      guidebook,
    });
    return Response.json(response, { status: 201 });
  } catch (cause) {
    return errorResponse({
      message: cause instanceof Error ? cause.message : "Failed to create competition.",
      code: "ERR_CREATE_COMPETITION",
      status: 500,
      cause,
    });
  }
}

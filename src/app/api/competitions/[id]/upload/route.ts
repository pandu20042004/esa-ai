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

export async function POST(request: Request, context: RouteContext<"/api/competitions/[id]/upload">) {
  const { id } = await context.params;
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();

  let form: FormData;
  try {
    form = await request.formData();
  } catch (cause) {
    return errorResponse({ message: "Invalid multipart form.", code: "ERR_BAD_FORM", status: 400, cause });
  }

  const poster = form.get("poster");
  const guidebook = form.get("guidebook");

  try {
    if (poster instanceof File) {
      if (!POSTER_MIME.has(poster.type)) {
        return errorResponse({ message: "Poster must be PNG/JPEG/WebP.", code: "ERR_POSTER_MIME", status: 400 });
      }
      if (poster.size > POSTER_MAX) {
        return errorResponse({ message: "Poster exceeds 5 MB.", code: "ERR_POSTER_SIZE", status: 400 });
      }
      await repository.replaceCompetitionAsset(id, "poster", poster);
    }
    if (guidebook instanceof File) {
      if (!GUIDEBOOK_MIME.has(guidebook.type)) {
        return errorResponse({ message: "Guidebook must be PDF/DOCX/MD/TXT.", code: "ERR_GUIDEBOOK_MIME", status: 400 });
      }
      if (guidebook.size > GUIDEBOOK_MAX) {
        return errorResponse({ message: "Guidebook exceeds 20 MB.", code: "ERR_GUIDEBOOK_SIZE", status: 400 });
      }
      await repository.replaceCompetitionAsset(id, "guidebook", guidebook);
    }

    if (!(poster instanceof File) && !(guidebook instanceof File)) {
      return errorResponse({ message: "No files submitted.", code: "ERR_NO_FILES", status: 400 });
    }

    const response = await repository.getCompetition(id);
    return Response.json(response);
  } catch (cause) {
    return errorResponse({
      message: cause instanceof Error ? cause.message : "Upload failed.",
      code: "ERR_REPLACE_ASSET",
      status: 500,
      cause,
    });
  }
}

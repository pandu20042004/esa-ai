import { z } from "zod";
import { errorResponse } from "@/lib/server/api-errors";
import { unauthorizedResponse } from "@/lib/server/auth";
import { createRequestRepository } from "@/lib/server/request-repository";

const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const IMAGE_MAX = 8 * 1024 * 1024;

// PATCH - update Instagram caption
const captionSchema = z.object({
  instagramCaption: z.string().trim().max(2200).nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();

  const body = await request.json().catch(() => ({}));
  const parsed = captionSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse({
      message: "Invalid caption payload.",
      code: "ERR_VALIDATION",
      status: 400,
      details: { issues: parsed.error.flatten() },
    });
  }

  try {
    const response = await repository.saveInstagramCaption(
      id,
      parsed.data.instagramCaption ?? "",
    );
    return Response.json(response);
  } catch (cause) {
    return errorResponse({
      message: cause instanceof Error ? cause.message : "Failed to save caption.",
      code: "ERR_SAVE_CAPTION",
      status: 500,
      cause,
    });
  }
}

// POST - upload twibbon / user_photo / combined_asset
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();

  let form: FormData;
  try {
    form = await request.formData();
  } catch (cause) {
    return errorResponse({ message: "Invalid multipart form.", code: "ERR_BAD_FORM", status: 400, cause });
  }

  const roleRaw = form.get("role");
  const file = form.get("file");

  if (typeof roleRaw !== "string" || !["twibbon", "user_photo", "combined_asset"].includes(roleRaw)) {
    return errorResponse({ message: "Invalid role. Use twibbon | user_photo | combined_asset.", code: "ERR_ROLE", status: 400 });
  }
  if (!(file instanceof File)) {
    return errorResponse({ message: "File is required.", code: "ERR_MISSING_FILE", status: 400 });
  }
  if (!IMAGE_MIME.has(file.type)) {
    return errorResponse({ message: `Image must be PNG/JPEG/WebP. Got ${file.type}.`, code: "ERR_IMAGE_MIME", status: 400 });
  }
  if (file.size > IMAGE_MAX) {
    return errorResponse({ message: "Image exceeds 8 MB.", code: "ERR_IMAGE_SIZE", status: 400 });
  }

  const role = roleRaw as "twibbon" | "user_photo" | "combined_asset";

  try {
    const response = await repository.saveAssetMakerFile(id, role, file);
    return Response.json(response);
  } catch (cause) {
    return errorResponse({
      message: cause instanceof Error ? cause.message : "Failed to save asset.",
      code: "ERR_SAVE_ASSET",
      status: 500,
      cause,
    });
  }
}

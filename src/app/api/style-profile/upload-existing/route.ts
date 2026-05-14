import { randomUUID } from "node:crypto";

import { errorResponse } from "@/lib/server/api-errors";
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ACCEPTED_MIME = new Set(["text/markdown", "text/plain"]);
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/style-profile/upload-existing
 *
 * Multipart form with a single `file` entry (a .md or .txt style profile).
 * Saves directly as the active style_profile without running the generator.
 * If a prior profile exists, it's archived to output_versions.
 */
export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const supabase = createSupabaseAdminClient();
  if (!supabase) return errorResponse({ message: "Supabase admin not configured.", code: "ERR_NO_ADMIN", status: 500 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch (cause) {
    return errorResponse({ message: "Invalid multipart form.", code: "ERR_BAD_FORM", status: 400, cause });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return errorResponse({ message: "A style profile file (.md or .txt) is required.", code: "ERR_NO_FILE", status: 400 });
  }
  if (!ACCEPTED_MIME.has(file.type)) {
    return errorResponse({
      message: `Unsupported file type: ${file.name} (${file.type}). Allowed: .md, .txt.`,
      code: "ERR_BAD_MIME",
      status: 400,
    });
  }
  if (file.size > MAX_BYTES) {
    return errorResponse({ message: "File exceeds 5 MB.", code: "ERR_FILE_TOO_LARGE", status: 400 });
  }

  const contentText = await file.text();
  if (contentText.trim().length === 0) {
    return errorResponse({ message: "File is empty.", code: "ERR_EMPTY_FILE", status: 400 });
  }

  const bytes = Buffer.from(contentText, "utf8");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const storagePath = `${user.id}/style/00_style_profile.md`;

  // Upload to storage (overwrite).
  const upload = await supabase.storage
    .from("profile-assets")
    .upload(storagePath, bytes, { contentType: "text/markdown", upsert: true });
  if (upload.error) {
    return errorResponse({ message: upload.error.message, code: "ERR_UPLOAD", status: 500 });
  }

  // Check for existing profile row.
  const { data: existing } = await supabase
    .from("competition_files")
    .select("id, content_text")
    .eq("user_id", user.id)
    .eq("file_role", "style_profile")
    .is("competition_id", null)
    .maybeSingle();

  let fileId: string;

  if (existing) {
    fileId = String(existing.id);

    // Archive prior content to output_versions.
    if (existing.content_text && typeof existing.content_text === "string") {
      const { data: priorVersions } = await supabase
        .from("output_versions")
        .select("version_number")
        .eq("file_id", fileId)
        .order("version_number", { ascending: false })
        .limit(1);
      const nextVersion = ((priorVersions?.[0]?.version_number as number) ?? 0) + 1;

      await supabase.from("output_versions").insert({
        user_id: user.id,
        file_id: fileId,
        version_number: nextVersion,
        content_text: existing.content_text as string,
        change_summary: "Archived before user uploaded a new style profile.",
        status: "archived",
      });
    }

    // Update existing row.
    const { error: updateErr } = await supabase
      .from("competition_files")
      .update({
        file_name: safeName,
        storage_path: storagePath,
        mime_type: "text/markdown",
        size_bytes: bytes.length,
        content_text: contentText,
        file_source: "user_upload",
        status: "approved",
        approved: true,
      })
      .eq("id", fileId)
      .eq("user_id", user.id);
    if (updateErr) return errorResponse({ message: updateErr.message, code: "ERR_UPDATE", status: 500 });
  } else {
    // Insert new profile row.
    const { data: inserted, error: insErr } = await supabase
      .from("competition_files")
      .insert({
        id: randomUUID(),
        user_id: user.id,
        competition_id: null,
        file_name: safeName,
        file_role: "style_profile",
        file_source: "user_upload",
        storage_bucket: "profile-assets",
        storage_path: storagePath,
        mime_type: "text/markdown",
        size_bytes: bytes.length,
        content_text: contentText,
        status: "approved",
        approved: true,
      })
      .select("id")
      .single();
    if (insErr) return errorResponse({ message: insErr.message, code: "ERR_INSERT", status: 500 });
    fileId = String(inserted.id);
  }

  return Response.json({
    data: {
      id: fileId,
      fileName: safeName,
      status: "approved",
      message: "Style profile uploaded and saved. It will be used by the Main Agent on next run.",
    },
  }, { status: 201 });
}

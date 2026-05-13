import { randomUUID } from "node:crypto";

import { errorResponse } from "@/lib/server/api-errors";
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { extractText } from "@/lib/server/file-extraction";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ACCEPTED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/markdown",
  "text/plain",
]);
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * POST /api/style-profile/upload
 * Multipart form with one or more `files` entries. Each file is stored as a
 * `competition_files` row with file_role='style_profile_source' and
 * competition_id=null. Text extracted for use by the builder prompt.
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

  const files = form.getAll("files").filter((v): v is File => v instanceof File);
  if (files.length === 0) {
    return errorResponse({ message: "At least one PDF is required.", code: "ERR_NO_FILES", status: 400 });
  }

  const accepted: Array<{ id: string; fileName: string; size: number }> = [];

  for (const file of files) {
    if (!ACCEPTED_MIME.has(file.type)) {
      return errorResponse({
        message: `Unsupported file type: ${file.name} (${file.type}). Allowed: PDF, DOCX, MD, TXT.`,
        code: "ERR_BAD_MIME",
        status: 400,
      });
    }
    if (file.size > MAX_BYTES) {
      return errorResponse({
        message: `File too large: ${file.name} (>${MAX_BYTES} bytes).`,
        code: "ERR_FILE_TOO_LARGE",
        status: 400,
      });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const storagePath = `${user.id}/style/sources/${randomUUID()}-${safeName}`;

    const upload = await supabase.storage
      .from("profile-assets")
      .upload(storagePath, bytes, { contentType: file.type, upsert: true });
    if (upload.error) {
      return errorResponse({ message: upload.error.message, code: "ERR_UPLOAD", status: 500 });
    }

    let text = "";
    try {
      text = await extractText(file);
    } catch {
      text = "";
    }

    const { data, error } = await supabase
      .from("competition_files")
      .insert({
        id: randomUUID(),
        user_id: user.id,
        competition_id: null,
        file_name: file.name,
        file_role: "style_profile_source",
        file_source: "user_upload",
        storage_bucket: "profile-assets",
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: bytes.length,
        content_text: text || null,
        status: "approved",
        approved: true,
      })
      .select("id, file_name, size_bytes")
      .single();
    if (error) return errorResponse({ message: error.message, code: "ERR_INSERT", status: 500 });
    accepted.push({ id: String(data.id), fileName: String(data.file_name), size: Number(data.size_bytes ?? 0) });
  }

  return Response.json({ data: { uploaded: accepted } }, { status: 201 });
}

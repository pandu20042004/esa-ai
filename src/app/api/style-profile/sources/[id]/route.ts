import { errorResponse } from "@/lib/server/api-errors";
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_request: Request, context: RouteContext<"/api/style-profile/sources/[id]">) {
  const { id } = await context.params;
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const supabase = createSupabaseAdminClient();
  if (!supabase) return errorResponse({ message: "Supabase admin not configured.", code: "ERR_NO_ADMIN", status: 500 });

  const { data: row, error: lookupErr } = await supabase
    .from("competition_files")
    .select("id, storage_bucket, storage_path, file_role")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("file_role", "style_profile_source")
    .maybeSingle();
  if (lookupErr) return errorResponse({ message: lookupErr.message, code: "ERR_LOOKUP", status: 500 });
  if (!row) return errorResponse({ message: "Source not found.", code: "ERR_NOT_FOUND", status: 404 });

  if (row.storage_bucket && row.storage_path) {
    await supabase.storage.from(String(row.storage_bucket)).remove([String(row.storage_path)]);
  }

  const { error: delErr } = await supabase
    .from("competition_files")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (delErr) return errorResponse({ message: delErr.message, code: "ERR_DELETE", status: 500 });

  return Response.json({ data: { deleted: true } });
}

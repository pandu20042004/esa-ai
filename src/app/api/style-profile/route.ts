import { errorResponse } from "@/lib/server/api-errors";
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/style-profile
 * Returns: { sources: CompetitionFile[], profile: CompetitionFile | null, versions: OutputVersion[] }
 */
export async function GET() {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const supabase = createSupabaseAdminClient();
  if (!supabase) return errorResponse({ message: "Supabase admin not configured.", code: "ERR_NO_ADMIN", status: 500 });

  const { data: sources, error: srcErr } = await supabase
    .from("competition_files")
    .select("id, file_name, mime_type, size_bytes, created_at, status")
    .eq("user_id", user.id)
    .is("competition_id", null)
    .eq("file_role", "style_profile_source")
    .order("created_at", { ascending: false });
  if (srcErr) return errorResponse({ message: srcErr.message, code: "ERR_SOURCES", status: 500 });

  const { data: profile, error: profErr } = await supabase
    .from("competition_files")
    .select("id, file_name, content_text, created_at, status")
    .eq("user_id", user.id)
    .is("competition_id", null)
    .eq("file_role", "style_profile")
    .maybeSingle();
  if (profErr) return errorResponse({ message: profErr.message, code: "ERR_PROFILE", status: 500 });

  let versions: Array<{ id: string; versionNumber: number; changeSummary: string; createdAt: string }> = [];
  if (profile) {
    const { data: ver } = await supabase
      .from("output_versions")
      .select("id, version_number, change_summary, created_at")
      .eq("user_id", user.id)
      .eq("file_id", profile.id)
      .order("version_number", { ascending: false });
    versions = (ver ?? []).map((row) => ({
      id: String(row.id),
      versionNumber: Number(row.version_number),
      changeSummary: String(row.change_summary ?? ""),
      createdAt: String(row.created_at),
    }));
  }

  return Response.json({
    data: {
      sources: (sources ?? []).map((row) => ({
        id: String(row.id),
        fileName: String(row.file_name),
        mimeType: String(row.mime_type ?? ""),
        sizeBytes: Number(row.size_bytes ?? 0),
        createdAt: String(row.created_at),
        status: String(row.status ?? "draft"),
      })),
      profile: profile
        ? {
            id: String(profile.id),
            fileName: String(profile.file_name),
            contentText: String(profile.content_text ?? ""),
            createdAt: String(profile.created_at),
            status: String(profile.status ?? "draft"),
          }
        : null,
      versions,
    },
  });
}

import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "competition-files";

export type AssetRole = "poster" | "guidebook";

export type UploadArgs = {
  userId: string;
  competitionId: string;
  role: AssetRole;
  buffer: Buffer;
  mimeType: string;
  ext: string;
};

function pathFor(userId: string, competitionId: string, role: AssetRole, ext: string) {
  return `${userId}/${competitionId}/${role}.${ext}`;
}

export async function uploadCompetitionAsset(args: UploadArgs): Promise<{ storagePath: string }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase admin client not configured.");

  const storagePath = pathFor(args.userId, args.competitionId, args.role, args.ext);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, args.buffer, { contentType: args.mimeType, upsert: true });
  if (error) throw error;

  return { storagePath };
}

export async function deleteCompetitionAssets(userId: string, competitionId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const prefix = `${userId}/${competitionId}`;
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix);
  if (error) throw error;

  if (data && data.length > 0) {
    const paths = data.map((entry) => `${prefix}/${entry.name}`);
    const { error: delError } = await supabase.storage.from(BUCKET).remove(paths);
    if (delError) throw delError;
  }
}

export async function signedCompetitionUrl(storagePath: string, expirySeconds = 3600): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expirySeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export { BUCKET as COMPETITION_FILES_BUCKET };

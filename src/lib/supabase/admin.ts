import "server-only";

import { createClient } from "@supabase/supabase-js";

import { readSupabaseEnv } from "./env";

export function createSupabaseAdminClient() {
  const env = readSupabaseEnv();

  if (!env.url || !env.serviceRoleKey) {
    return null;
  }

  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}


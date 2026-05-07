import "server-only";

import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { getRequestUser } from "@/lib/server/auth";
import { createEsaiRepository } from "@/lib/server/repositories/esai-repository";

export async function createRequestRepository() {
  if (!isSupabaseAdminConfigured()) {
    return {
      repository: createEsaiRepository({ supabaseConfigured: false }),
      user: null,
      requiresAuth: false,
    };
  }

  const user = await getRequestUser();

  return {
    repository: createEsaiRepository({ supabaseConfigured: true, userId: user?.id ?? null }),
    user,
    requiresAuth: true,
  };
}

import "server-only";

import { readSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RequestUser = {
  id: string;
  email?: string;
};

export async function getRequestUser(): Promise<RequestUser | null> {
  const env = readSupabaseEnv();

  if (!env.url || !env.publishableKey) {
    return null;
  }

  if (env.disableAuth && process.env.DEV_USER_ID) {
    return { id: process.env.DEV_USER_ID };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase?.auth.getUser() ?? { data: null, error: null };

  if (error || !data?.user) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email,
  };
}

export function unauthorizedResponse() {
  return Response.json(
    {
      error: "Authentication required",
      message: "Sign in or set NEXT_PUBLIC_DISABLE_AUTH=true with DEV_USER_ID for local development.",
    },
    { status: 401 },
  );
}

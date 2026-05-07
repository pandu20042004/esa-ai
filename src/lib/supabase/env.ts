export type SupabaseRuntimeEnv = {
  url?: string;
  publishableKey?: string;
  serviceRoleKey?: string;
  disableAuth: boolean;
};

export function readSupabaseEnv(env: NodeJS.ProcessEnv = process.env): SupabaseRuntimeEnv {
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    disableAuth: env.NEXT_PUBLIC_DISABLE_AUTH === "true",
  };
}

export function isSupabaseConfigured(env: SupabaseRuntimeEnv = readSupabaseEnv()) {
  return Boolean(env.url && env.publishableKey);
}

export function isSupabaseAdminConfigured(env: SupabaseRuntimeEnv = readSupabaseEnv()) {
  return Boolean(env.url && env.serviceRoleKey);
}


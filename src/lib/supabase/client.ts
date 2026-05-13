"use client";

import { createBrowserClient } from "@supabase/ssr";
import { readSupabaseEnv } from "./env";

export function createSupabaseBrowserClient() {
  const env = readSupabaseEnv();
  if (!env.url || !env.publishableKey) return null;
  return createBrowserClient(env.url, env.publishableKey);
}

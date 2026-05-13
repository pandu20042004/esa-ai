"use client";

import { createBrowserClient } from "@supabase/ssr";

import { readSupabaseEnv } from "./env";

let cached: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  const env = readSupabaseEnv();

  if (!env.url || !env.publishableKey) {
    return null;
  }

  return createBrowserClient(env.url, env.publishableKey);
}

/**
 * Singleton helper. Safe to call from React; returns the same client across renders.
 */
export function getBrowserSupabase() {
  if (cached) return cached;
  cached = createSupabaseBrowserClient();
  return cached;
}


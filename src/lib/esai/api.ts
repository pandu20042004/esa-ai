import { z } from "zod";

import type { BackendMode } from "@/types/esai";

export function createApiEnvelope<TData>(
  data: TData,
  options: { supabaseConfigured: boolean; message?: string },
) {
  const backendMode: BackendMode = options.supabaseConfigured ? "supabase" : "mock";

  return {
    data,
    meta: {
      backendMode,
      message:
        options.message ??
        (backendMode === "mock"
          ? "Supabase is not configured; returning deterministic local data."
          : "Supabase backend active."),
    },
  };
}

export const reasoningEffortSchema = z.enum(["low", "medium", "high", "xhigh"]);

export const modelRequestSchema = z.object({
  model: z.string().trim().min(1, "Select a model before generating."),
  reasoningEffort: reasoningEffortSchema.default("medium"),
  provider: z.string().trim().default("openclaw-cli"),
  webSearch: z.boolean().optional().default(false),
});

export function validateModelRequest(input: unknown) {
  return modelRequestSchema.safeParse(input);
}

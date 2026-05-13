import { z } from "zod";

import type { BackendMode, Competition } from "@/types/esai";

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

export class ApiError extends Error {
  code: string;
  correlationId?: string;
  details?: Record<string, unknown>;
  status: number;
  constructor(init: { message: string; code: string; correlationId?: string; details?: Record<string, unknown>; status: number }) {
    super(init.message);
    this.code = init.code;
    this.correlationId = init.correlationId;
    this.details = init.details;
    this.status = init.status;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError({
      message: body?.error ?? `Request failed with ${res.status}`,
      code: body?.code ?? "ERR_UNKNOWN",
      correlationId: body?.correlationId ?? res.headers.get("X-Correlation-Id") ?? undefined,
      details: body?.details,
      status: res.status,
    });
  }
  return res.json() as Promise<T>;
}

type Envelope<T> = { data: T; meta: { backendMode: string; message?: string } };

export async function fetchCompetitions(): Promise<Competition[]> {
  const res = await fetch("/api/competitions", { cache: "no-store" });
  const body = await handle<Envelope<Competition[]>>(res);
  return body.data ?? [];
}

export async function createCompetition(form: FormData): Promise<Competition> {
  const res = await fetch("/api/competitions/upload", { method: "POST", body: form });
  const body = await handle<Envelope<Competition>>(res);
  return body.data;
}

export async function updateCompetition(id: string, patch: Partial<Competition>): Promise<Competition> {
  const res = await fetch(`/api/competitions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const body = await handle<Envelope<Competition>>(res);
  return body.data;
}

export async function deleteCompetition(id: string): Promise<void> {
  const res = await fetch(`/api/competitions/${id}`, { method: "DELETE" });
  await handle<Envelope<{ deleted: true }>>(res);
}

export async function replaceCompetitionAssets(id: string, form: FormData): Promise<Competition> {
  const res = await fetch(`/api/competitions/${id}/upload`, { method: "POST", body: form });
  const body = await handle<Envelope<Competition>>(res);
  return body.data;
}

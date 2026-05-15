import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type RunEventType =
  | "status"
  | "activity"
  | "progress"
  | "token"
  | "tool_call"
  | "tool_result"
  | "message"
  | "choice"
  | "error";

export type RunEventPayload = Record<string, unknown>;

/**
 * Helper that tracks the per-run sequence counter and appends events atomically.
 * One instance per run lifecycle inside the worker.
 */
export class RunEventEmitter {
  private sequence = 0;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly runId: string,
    private readonly userId: string,
  ) {}

  async emit(eventType: RunEventType, payload: RunEventPayload = {}): Promise<void> {
    this.sequence += 1;
    const { error } = await this.supabase.from("agent_run_events").insert({
      run_id: this.runId,
      user_id: this.userId,
      sequence: this.sequence,
      event_type: eventType,
      payload,
    });
    if (error) {
      // Surface to stdout and keep going — event loss is better than aborting a run.
      console.error("[run-events] insert failed", error.message, { runId: this.runId, eventType });
    }
  }

  /** Expose next-sequence hint for callers that want to batch-insert. */
  get nextSequence() {
    return this.sequence + 1;
  }
}

/**
 * Fetch events for a run in order. Used by the API replay endpoint on page refresh.
 */
export async function loadRunEvents(
  supabase: SupabaseClient,
  runId: string,
): Promise<Array<{ sequence: number; eventType: RunEventType; payload: RunEventPayload; createdAt: string }>> {
  const { data, error } = await supabase
    .from("agent_run_events")
    .select("sequence, event_type, payload, created_at")
    .eq("run_id", runId)
    .order("sequence", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    sequence: Number(row.sequence),
    eventType: row.event_type as RunEventType,
    payload: (row.payload ?? {}) as RunEventPayload,
    createdAt: String(row.created_at),
  }));
}

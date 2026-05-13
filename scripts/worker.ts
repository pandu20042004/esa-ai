/**
 * Local agent-run executor.
 *
 * Run with: npm run worker
 *
 * Responsibilities:
 *   - poll `agent_runs` where status='queued'
 *   - claim one at a time, mark running
 *   - resolve skill + inputs from context_snapshot
 *   - call the model (CLI or SDK) via run-execution
 *   - stream tokens into agent_run_events
 *   - transition status to completed / failed
 *   - recover runs stuck in running (worker crash)
 *
 * Single-tenant assumption: one worker per process. Running multiple workers is safe —
 * the update/returning claim keeps them from double-executing a run.
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
dotenvConfig({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { RunEventEmitter, loadRunEvents } from "@/lib/server/run-events";
import { executeRun, type RunExecutionInput } from "@/lib/server/run-execution";

const POLL_INTERVAL_MS = 2000;
const STUCK_RUN_THRESHOLD_MS = 5 * 60 * 1000;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[worker] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`[worker] caught ${signal}, finishing in-flight run then exiting…`);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  console.log("[worker] started. polling every", POLL_INTERVAL_MS, "ms.");

  // Recover stuck runs on startup.
  await recoverStuckRuns(supabase);

  while (!stopping) {
    try {
      const claimed = await claimNextRun(supabase);
      if (claimed) {
        await runOne(supabase, claimed);
      } else {
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (err) {
      console.error("[worker] loop error:", (err as Error).message);
      await sleep(POLL_INTERVAL_MS);
    }
  }

  console.log("[worker] bye.");
  process.exit(0);
}

async function claimNextRun(supabase: SupabaseClient): Promise<ClaimedRun | null> {
  // First peek to find a candidate id (admin client so RLS doesn't bite).
  const { data: candidate, error: peekErr } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("status", "queued")
    .order("queued_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (peekErr) throw new Error(`claim peek: ${peekErr.message}`);
  if (!candidate) return null;

  // Race-safe claim: only flip if still queued.
  const { data, error } = await supabase
    .from("agent_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", candidate.id)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`claim update: ${error.message}`);
  if (!data) return null; // another worker grabbed it

  return data as ClaimedRun;
}

type ClaimedRun = {
  id: string;
  user_id: string;
  competition_id: string;
  stage_id: string;
  pipeline_id: string | null;
  pipeline_node_id: string | null;
  skill_version_id: string | null;
  model_provider: string;
  model_id: string;
  reasoning_effort: string | null;
  input_file_ids: string[] | null;
  context_snapshot: Record<string, unknown> | null;
};

async function runOne(supabase: SupabaseClient, run: ClaimedRun): Promise<void> {
  const runId = String(run.id);
  console.log(`[worker] running ${runId} (${run.model_provider}:${run.model_id})`);

  const emitter = new RunEventEmitter(supabase, runId, String(run.user_id));

  // Resume-safe: reset sequence to current max+1 so replays stay monotonic even if
  // we've emitted events before (e.g. after a restart mid-run — not expected but cheap).
  const prior = await loadRunEvents(supabase, runId);
  (emitter as unknown as { sequence: number }).sequence = prior.length;

  await emitter.emit("status", { phase: "started" });

  try {
    const skillContent = await loadSkillContent(supabase, String(run.skill_version_id));
    const inputFiles = extractInputFiles(run.context_snapshot);
    const userMessage = extractUserMessage(run.context_snapshot);

    const execInput: RunExecutionInput = {
      runId,
      userId: String(run.user_id),
      competitionId: String(run.competition_id),
      stageId: String(run.stage_id),
      pipelineNodeId: run.pipeline_node_id ? String(run.pipeline_node_id) : null,
      skillContent,
      userMessage,
      modelProvider: String(run.model_provider),
      modelId: String(run.model_id),
      reasoningEffort: String(run.reasoning_effort ?? "medium"),
      inputFiles,
    };

    const result = await executeRun(supabase, emitter, execInput);

    if (result.status === "completed") {
      await supabase
        .from("agent_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          raw_log: result.assistantText.slice(0, 200_000),
        })
        .eq("id", runId);
    } else {
      await supabase
        .from("agent_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error: (result.errorMessage ?? "Run failed.").slice(0, 2000),
        })
        .eq("id", runId);
    }
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    console.error("[worker] run", runId, "crashed:", message);
    await emitter.emit("error", { reason: "worker_exception", message });
    await supabase
      .from("agent_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error: message.slice(0, 2000),
      })
      .eq("id", runId);
  }
}

async function loadSkillContent(supabase: SupabaseClient, skillVersionId: string): Promise<string> {
  const { data, error } = await supabase
    .from("agent_skill_versions")
    .select("skill_content")
    .eq("id", skillVersionId)
    .maybeSingle();
  if (error) throw new Error(`loadSkillContent: ${error.message}`);
  if (!data) throw new Error("Active skill version not found.");
  return String(data.skill_content ?? "");
}

function extractInputFiles(snapshot: Record<string, unknown> | null): RunExecutionInput["inputFiles"] {
  const raw = snapshot?.inputFiles;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === "object")
    .map((f) => ({
      fileId: String(f.fileId ?? ""),
      fileName: String(f.fileName ?? ""),
      fileRole: String(f.fileRole ?? "guidebook"),
      contentText: typeof f.contentText === "string" ? f.contentText : null,
    }))
    .filter((f) => f.fileId.length > 0);
}

function extractUserMessage(snapshot: Record<string, unknown> | null): string {
  const v = snapshot?.userMessage;
  return typeof v === "string" ? v : "";
}

async function recoverStuckRuns(supabase: SupabaseClient): Promise<void> {
  const threshold = new Date(Date.now() - STUCK_RUN_THRESHOLD_MS).toISOString();
  const { data, error } = await supabase
    .from("agent_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error: "worker crashed before finishing — recovered on restart",
    })
    .eq("status", "running")
    .lt("started_at", threshold)
    .select("id");
  if (error) {
    console.error("[worker] recoverStuckRuns error:", error.message);
    return;
  }
  if (data && data.length > 0) {
    console.log(`[worker] recovered ${data.length} stuck runs.`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});

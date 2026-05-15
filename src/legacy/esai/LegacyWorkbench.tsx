"use client";

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/purity */

import {
  Bot,
  Check,
  FileText,
  Globe,
  Lock,
  Maximize2,
  Minimize2,
  Moon,
  MoreHorizontal,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { deleteFile } from "@/lib/esai/api";
import { extractAgentChoiceFromMessage, isAgentChoice, type AgentChoice, type AgentChoiceOption } from "@/lib/esai/agent-choice";
import { STAGES } from "@/lib/esai/stages";
import { getRunIdFromMessageContext, getThreadMessageActions } from "@/lib/esai/thread-actions";
import { isModelSelectionReady } from "@/lib/esai/workflow";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { Competition, StageId } from "@/types/esai";
import {
  buildModelPickerValue,
  getReasoningEffortsForModel,
  getSelectedModelOption,
  isSelectedModelReady,
  parseModelPickerValue,
  useModelOptions,
  type ModelOption,
} from "@/components/esai/useModelOptions";

type ReasoningEffort = "low" | "medium" | "high" | "xhigh";
type SearchMode = "fast" | "balanced" | "deep";

const REASONING_LABELS: Record<ReasoningEffort, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
};

const SEARCH_MODE_META: Record<SearchMode, { label: string; description: string }> = {
  fast: {
    label: "Fast",
    description: "Quick ideas with fewer searches and lower cost.",
  },
  balanced: {
    label: "Balanced",
    description: "Default. Solid evidence with controlled cost.",
  },
  deep: {
    label: "Deep",
    description: "Slower final-work mode with more source checks.",
  },
};

function getActiveReasoningEffort(models: ModelOption[], selectedModel: string, current: ReasoningEffort): ReasoningEffort {
  const efforts = getReasoningEffortsForModel(models, selectedModel) as ReasoningEffort[];
  if (efforts.length === 0) return "medium";
  if (efforts.includes(current)) return current;
  const defaultEffort = getSelectedModelOption(models, selectedModel)?.defaultReasoningEffort as ReasoningEffort | undefined;
  return defaultEffort && efforts.includes(defaultEffort) ? defaultEffort : efforts[0];
}

function formatChatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function Workbench({ competition, assistantOpen, darkMode, onBack, onToggleAssistant, onToggleTheme }: { competition: Competition; assistantOpen: boolean; darkMode: boolean; onBack: () => void; onToggleAssistant: () => void; onToggleTheme: () => void }) {
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [currentStageId, setCurrentStageId] = useState<StageId>(competition.currentStageId);
  const [outputOpen, setOutputOpen] = useState(false);
  const [stages, setStages] = useState<StageStateEntry[]>([]);
  const { models, selectedModel, setSelectedModel, modelsLoading } = useModelOptions({ refreshOnMount: true });
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(() => {
    if (typeof window === "undefined") return "medium";
    return (window.localStorage.getItem("esai-reasoning") as ReasoningEffort) ?? "medium";
  });
  const [stagesLoading, setStagesLoading] = useState(true);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [streamingRun, setStreamingRun] = useState<ActiveRun | null>(null);
  const [completedActivity, setCompletedActivity] = useState<Record<string, CompletedRunActivity>>({});
  const [composerValue, setComposerValue] = useState("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [imageGenerationEnabled, setImageGenerationEnabled] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>("balanced");
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [messageSelectionMode, setMessageSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(() => new Set());
  const [deleteChatRequest, setDeleteChatRequest] = useState<ChatDeleteRequest | null>(null);
  const [rerunTarget, setRerunTarget] = useState<StageStateEntry | null>(null);
  const [approveRequest, setApproveRequest] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runSubmitting, setRunSubmitting] = useState(false);
  const [runSubmittingStageId, setRunSubmittingStageId] = useState<StageId | null>(null);
  const [runCancelling, setRunCancelling] = useState(false);

  const currentStage = STAGES.find((stage) => stage.id === currentStageId) ?? STAGES[0];
  const currentStageIndex = STAGES.findIndex((stage) => stage.id === currentStage.id);
  const nextStage = STAGES[currentStageIndex + 1];
  const currentStageEntry = stages.find((s) => s.nodeKey === currentStage.id) ?? null;
  const outputFile = currentStageEntry?.outputFile ?? null;
  const isApproved = outputFile?.status === "approved";
  const isStale = outputFile?.status === "stale";
  const stageUnlocked = currentStageEntry?.unlocked ?? (currentStage.id === "onboarding");
  const visibleStreamingRun = streamingRun?.stageId === currentStage.id ? streamingRun : null;
  const currentStageSubmitting = runSubmitting && runSubmittingStageId === currentStage.id;
  const runInFlight = Boolean(visibleStreamingRun && !isTerminalRunPhase(visibleStreamingRun.phase));
  const isRunning = runInFlight || currentStageSubmitting;
  const modelReady = isSelectedModelReady(models, selectedModel);
  const isMainAgentStage = currentStage.id === "onboarding";
  const stageRunnable = currentStage.id === "onboarding" || currentStage.id === "ideation";
  const canTerminateRun = runInFlight && !runCancelling;
  const runButtonDisabled = runInFlight ? !canTerminateRun : currentStageSubmitting || !stageUnlocked || !modelReady || !stageRunnable;
  const reasoningEfforts = getReasoningEffortsForModel(models, selectedModel) as ReasoningEffort[];
  const activeReasoningEffort = getActiveReasoningEffort(models, selectedModel, reasoningEffort);
  const reasoningDisabled = reasoningEfforts.length === 0;
  const activeToolCount = Number(webSearchEnabled) + Number(imageGenerationEnabled);
  const visibleStreamingRunPersisted = Boolean(
    visibleStreamingRun && thread.some((message) => getRunIdFromMessageContext(message.context) === visibleStreamingRun.runId),
  );
  const showStreamingBubble = Boolean(visibleStreamingRun && !visibleStreamingRunPersisted);

  const reloadStageState = useCallback(async () => {
    setStagesLoading(true);
    try {
      const res = await fetch(`/api/competitions/${competition.id}/stage-state`, { cache: "no-store" });
      const json = await res.json();
      const list: StageStateEntry[] = json?.data?.stages ?? [];
      setStages(list);
    } catch {
      setStages([]);
    } finally {
      setStagesLoading(false);
    }
  }, [competition.id]);

  const reloadThread = useCallback(async () => {
    try {
      const res = await fetch(`/api/competitions/${competition.id}/agent-thread?stageId=${currentStage.id}`, { cache: "no-store" });
      const json = await res.json();
      setThread(json?.data ?? []);
    } catch {
      setThread([]);
    }
  }, [competition.id, currentStage.id]);

  useEffect(() => {
    window.localStorage.setItem("esai-reasoning", reasoningEffort);
  }, [reasoningEffort]);

  useEffect(() => {
    if (!toolsMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && toolsMenuRef.current?.contains(target)) return;
      setToolsMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [toolsMenuOpen]);

  useEffect(() => {
    setCurrentStageId(competition.currentStageId);
    setThread([]);
    setStreamingRun(null);
    setCompletedActivity({});
    setRunError(null);
    setMessageMenuId(null);
    setMessageSelectionMode(false);
    setSelectedMessageIds(new Set());
    setDeleteChatRequest(null);
    setRunCancelling(false);
  }, [competition.id, competition.currentStageId]);

  // Reload stage state + thread when stage or competition changes.
  useEffect(() => {
    reloadStageState();
    reloadThread();
  }, [reloadStageState, reloadThread]);

  const startRun = async (overrideMessage?: string) => {
    setRunError(null);
    if (!stageUnlocked) { setRunError("Upstream stage not approved yet."); return; }
    if (!modelReady) { setRunError("Pick a model first."); return; }

    setRunSubmitting(true);
    setRunSubmittingStageId(currentStage.id);
    setRunCancelling(false);
    const messageToSend = overrideMessage ?? (composerValue.trim() ? composerValue.trim() : undefined);
    const { provider, modelId } = parseModelPickerValue(selectedModel);
    try {
      const res = await fetch("/api/agent-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionId: competition.id,
          stageId: currentStage.id,
          modelProvider: provider,
          modelId,
          reasoningEffort: activeReasoningEffort,
          userMessage: messageToSend,
          webSearch: webSearchEnabled,
          imageGeneration: imageGenerationEnabled,
          searchMode,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setRunError(err?.error?.message ?? err?.message ?? `Run failed (${res.status}).`);
        setRunSubmitting(false);
        setRunSubmittingStageId(null);
        return;
      }
      const json = await res.json();
      const runId: string = json?.data?.runId;
      setCompletedActivity((items) => {
        const next = { ...items };
        delete next[currentStage.id];
        return next;
      });
      setStreamingRun({ runId, stageId: currentStage.id, tokens: "", activities: [], progressLines: [], toolWrites: [], phase: "queued", phaseDetail: "Run queued. Worker polls every 2s.", startedAt: Date.now() });
      setComposerValue("");
      // Keep runSubmitting true until the first token arrives or the request errors.
      await reloadThread();
    } catch (error) {
      setRunError((error as Error).message ?? "Run failed.");
      setRunSubmitting(false);
      setRunSubmittingStageId(null);
    }
  };

  const terminateRun = async () => {
    const activeRun = streamingRun?.stageId === currentStage.id ? streamingRun : null;
    if (!activeRun || runCancelling) return;
    setRunCancelling(true);
    setRunError(null);
    setStreamingRun((prev) => prev ? {
      ...prev,
      phase: "cancelling",
      phaseDetail: "Termination requested. Stopping the CLI process...",
    } : prev);
    try {
      const res = await fetch(`/api/agent-runs/${activeRun.runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setRunError(err?.error?.message ?? err?.message ?? "Failed to terminate run.");
        setRunCancelling(false);
      }
    } catch (error) {
      setRunError((error as Error).message ?? "Failed to terminate run.");
      setRunCancelling(false);
    }
  };

  // Realtime subscribe to events for the active run.
  useEffect(() => {
    if (!streamingRun) return;
    const runId = streamingRun.runId;

    let active = true;
    let cleanup = () => {};

    (async () => {
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      const channel = supabase
        .channel(`agent-run-${runId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "agent_run_events", filter: `run_id=eq.${runId}` },
          (payload: { new: { event_type: string; payload: Record<string, unknown> } }) => {
            if (!active) return;
            handleRunEvent(payload.new.event_type, payload.new.payload);
          },
        )
        .subscribe();

      // Replay any prior events that fired before the subscription attached.
      try {
        const res = await fetch(`/api/agent-runs/${runId}`, { cache: "no-store" });
        const json = await res.json();
        for (const e of json?.data?.events ?? []) {
          if (!active) break;
          handleRunEvent(e.eventType, e.payload);
        }
      } catch { /* ignore */ }

      cleanup = () => {
        active = false;
        supabase.removeChannel(channel);
      };
    })();

    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingRun?.runId]);

  // Poll run status from DB while waiting; catches cases where worker died after queueing.
  // or finished without our subscription getting events. Stops once we see streaming or completion.
  useEffect(() => {
    if (!streamingRun) return;
    if (streamingRun.phase === "completed" || streamingRun.phase === "failed") return;
    const runId = streamingRun.runId;
    let stopped = false;

    const check = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/agent-runs/${runId}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const dbStatus = json?.data?.run?.status;
        const dbError = json?.data?.run?.error;
        const queuedAt = json?.data?.run?.queuedAt ? new Date(json.data.run.queuedAt).getTime() : 0;
        const queuedSec = queuedAt ? (Date.now() - queuedAt) / 1000 : 0;

        if ((dbStatus === "cancelled" || dbStatus === "cancelling") && !stopped) {
          setStreamingRun((prev) => prev ? {
            ...prev,
            phase: dbStatus,
            phaseDetail: dbStatus === "cancelled" ? "Run cancelled by user." : "Termination requested. Waiting for worker to stop the process...",
          } : prev);
          setRunSubmitting(false);
          setRunSubmittingStageId(null);
          setRunCancelling(dbStatus === "cancelling");
          if (dbStatus === "cancelled") {
            queueMicrotask(() => {
              reloadThread();
              setStreamingRun(null);
              setRunCancelling(false);
            });
          }
        } else if (dbStatus === "failed" && !stopped) {
          setStreamingRun((prev) => prev ? {
            ...prev,
            phase: "failed",
            phaseDetail: dbError || "Run failed.",
          } : prev);
          setRunError(dbError || "Run failed.");
          setRunSubmitting(false);
          setRunSubmittingStageId(null);
          setRunCancelling(false);
        } else if (dbStatus === "needs_choice" && !stopped) {
          const choice = json?.data?.run?.needsUserChoice;
          setStreamingRun((prev) => prev ? {
            ...prev,
            phase: "needs_choice",
            phaseDetail: "Agent needs a user decision before continuing.",
            needsUserChoice: isNeedsUserChoice(choice) ? choice : prev.needsUserChoice,
          } : prev);
          setRunSubmitting(false);
          setRunSubmittingStageId(null);
          setRunCancelling(false);
        } else if (dbStatus === "completed" && !stopped) {
          reloadStageState();
          reloadThread();
          setStreamingRun(null);
          setRunSubmitting(false);
          setRunSubmittingStageId(null);
          setRunCancelling(false);
        } else if (dbStatus === "queued" && queuedSec > 30 && !stopped) {
          // Worker likely not running.
          setStreamingRun((prev) => prev && prev.phase === "queued" ? {
            ...prev,
            phaseDetail: `Still queued after ${Math.floor(queuedSec)}s. The worker process may not be running. Start it with: npm run worker`,
          } : prev);
        }
      } catch {
        // ignore
      }
    };

    // Poll every 3s so choice/completion state is recovered even if realtime misses an event.
    const id = setInterval(() => {
      void check();
    }, 3000);

    return () => { stopped = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingRun?.runId, streamingRun?.phase]);

  const handleRunEvent = (eventType: string, payload: Record<string, unknown>) => {
    setStreamingRun((prev) => {
      if (!prev) return prev;
      if (eventType === "status") {
        const phase = String(payload.phase ?? "");
        if (phase === "started") {
          return { ...prev, phase: "started", phaseDetail: "Worker started the run." };
        }
        if (phase === "prompt_built") {
          const length = Number(payload.length ?? 0);
          return { ...prev, phase: "prompt_built", phaseDetail: `Prompt built (${length.toLocaleString()} chars). Calling model...` };
        }
        if (phase === "cli_stderr" || phase === "cli_progress") {
          const text = String(payload.text ?? "").trim();
          if (!text) return prev;
          return { ...prev, phaseDetail: `CLI: ${text.slice(0, 200)}` };
        }
        if (phase === "completed") {
          const completed = {
            activities: appendRunActivity(prev.activities, { kind: "writing", label: "Run complete" }),
            progressLines: prev.progressLines,
            phaseDetail: "Run complete.",
          };
          queueMicrotask(() => {
            setCompletedActivity((items) => ({ ...items, [prev.stageId]: completed }));
            reloadStageState();
            reloadThread();
            setStreamingRun(null);
            setRunSubmitting(false);
            setRunSubmittingStageId(null);
            setRunCancelling(false);
          });
          return { ...prev, phase: "completed", phaseDetail: "Run complete." };
        }
        if (phase === "needs_choice") {
          setRunSubmitting(false);
          setRunSubmittingStageId(null);
          setRunCancelling(false);
          return { ...prev, phase: "needs_choice", phaseDetail: "Agent needs a user decision before continuing." };
        }
        if (phase === "cancelling" || phase === "cancelled") {
          setRunSubmitting(false);
          setRunSubmittingStageId(null);
          setRunCancelling(phase === "cancelling");
          if (phase === "cancelled") {
            const completed = {
              activities: appendRunActivity(prev.activities, { kind: "tool", label: "Run cancelled" }),
              progressLines: prev.progressLines,
              phaseDetail: "Run cancelled by user.",
            };
            queueMicrotask(() => {
              setCompletedActivity((items) => ({ ...items, [prev.stageId]: completed }));
              reloadThread();
              setStreamingRun(null);
              setRunCancelling(false);
            });
          }
          return { ...prev, phase, phaseDetail: String(payload.text ?? "Run cancelled by user.") };
        }
        return prev;
      }
      if (eventType === "token") {
        const text = typeof payload.text === "string" ? payload.text : "";
        if (text) {
          setRunSubmitting(false);
          setRunSubmittingStageId(null);
        }
        const nextTokens = prev.tokens + text;
        return {
          ...prev,
          phase: "streaming",
          phaseDetail: `Streaming response... ${nextTokens.length.toLocaleString()} chars received`,
          tokens: nextTokens,
        };
      }
      if (eventType === "progress") {
        const lines = Array.isArray(payload.lines)
          ? payload.lines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
          : [];
        if (lines.length === 0) return prev;
        return {
          ...prev,
          phase: prev.phase === "queued" ? "started" : prev.phase,
          phaseDetail: lines.at(-1)?.slice(0, 200) ?? prev.phaseDetail,
          progressLines: [...prev.progressLines, ...lines].slice(-24),
        };
      }
      if (eventType === "activity") {
        const activity = normalizeRunActivity(payload);
        if (!activity) return prev;
        return {
          ...prev,
          activities: appendRunActivity(prev.activities, activity),
          phaseDetail: activity.label || prev.phaseDetail,
        };
      }
      if (eventType === "choice") {
        if (!isNeedsUserChoice(payload)) return prev;
        setRunSubmitting(false);
        setRunSubmittingStageId(null);
        setRunCancelling(false);
        return {
          ...prev,
          phase: "needs_choice",
          phaseDetail: "Agent needs a user decision before continuing.",
          needsUserChoice: payload,
        };
      }
      if (eventType === "tool_call") {
        const tool = String(payload.tool ?? "tool");
        const fileName = (payload.params as { file_name?: string } | undefined)?.file_name ?? "";
        return { ...prev, phase: "tool_writing", phaseDetail: `Calling ${tool}${fileName ? ` -> ${fileName}` : ""}...` };
      }
      if (eventType === "tool_result") {
        if (payload.ok === true) {
          return {
            ...prev,
            toolWrites: [...prev.toolWrites, { fileName: String(payload.fileName ?? "output"), fileId: String(payload.fileId ?? "") }],
            phaseDetail: `Saved ${String(payload.fileName ?? "output")} (${Number(payload.bytes ?? 0).toLocaleString()} bytes)`,
          };
        }
        return { ...prev, phaseDetail: `Tool failed: ${String(payload.error ?? "unknown")}` };
      }
      if (eventType === "error") {
        setRunError(String(payload.message ?? payload.reason ?? "Run error."));
        setRunSubmitting(false);
        setRunSubmittingStageId(null);
        return { ...prev, phase: "failed", phaseDetail: String(payload.message ?? payload.reason ?? "Run error.") };
      }
      return prev;
    });
  };

  const approve = async () => {
    if (!outputFile) return;
    setApproveRequest(false);
    setRunError(null);
    const res = await fetch(`/api/competition-files/${outputFile.id}/approve`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setRunError(err?.error ?? "Approve failed.");
      return;
    }
    const json = await res.json().catch(() => ({}));
    await reloadStageState();
    const nextStageId = json?.data?.nextStageId;
    if (typeof nextStageId === "string" && STAGES.some((stage) => stage.id === nextStageId)) {
      setCurrentStageId(nextStageId as StageId);
      setStreamingRun(null);
      setComposerValue("");
    }
  };

  const requestRerun = () => {
    if (!currentStageEntry) {
      // Pipeline not bootstrapped yet; first run will create it.
      void startRun();
      return;
    }
    if (isApproved && (currentStageEntry.downstreamStageKeys ?? []).length > 0) {
      setRerunTarget(currentStageEntry);
      return;
    }
    // No approved output or no downstream: run immediately.
    void startRun();
  };

  const confirmRerun = async () => {
    setRerunTarget(null);
    // Mark downstream as stale, then start the run.
    try {
      await fetch(`/api/competitions/${competition.id}/mark-stale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromStageKey: currentStage.id }),
      });
    } catch { /* not fatal */ }
    void startRun();
  };

  const answerAgentChoice = (choice: AgentRuntimeChoiceOption) => {
    const detail = choice.description ?? choice.detail ?? choice.result ?? "";
    const text = [
      `Selected choice: ${choice.label}`,
      `Choice id: ${choice.id ?? choice.key ?? choice.label}`,
      detail ? `Reason/context: ${detail}` : null,
    ].filter(Boolean).join("\n");
    setStreamingRun(null);
    void startRun(text);
  };

  const deleteThreadMessage = async (message: ThreadMessage, cascadeRun = false) => {
    if (isRunning) {
      setRunError("Wait for the current run to finish before editing or deleting chat.");
      return false;
    }
    setMessageMenuId(null);
    setRunError(null);
    const res = await fetch(`/api/agent-messages/${message.id}${cascadeRun ? "?cascadeRun=1" : ""}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setRunError(json?.error?.message ?? json?.message ?? "Failed to delete message.");
      return false;
    }
    await reloadThread();
    await reloadStageState();
    return true;
  };

  const deleteThreadMessages = async (messages: ThreadMessage[], cascadeUserRuns = true) => {
    if (isRunning) {
      setRunError("Wait for the current run to finish before deleting chat.");
      return false;
    }
    if (messages.length === 0) return false;
    setMessageMenuId(null);
    setRunError(null);
    const res = await fetch("/api/agent-messages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageIds: messages.map((message) => message.id), cascadeUserRuns }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setRunError(json?.error?.message ?? json?.message ?? "Failed to delete messages.");
      return false;
    }
    setSelectedMessageIds(new Set());
    setMessageSelectionMode(false);
    await reloadThread();
    await reloadStageState();
    return true;
  };

  const requestDeleteMessage = (message: ThreadMessage) => {
    const runId = getRunIdFromMessageContext(message.context);
    setMessageMenuId(null);
    setDeleteChatRequest({
      mode: "single",
      messages: [message],
      cascadeUserRuns: message.role === "user" && Boolean(runId),
    });
  };

  const requestDeleteSelectedMessages = () => {
    const messages = thread.filter((message) => selectedMessageIds.has(message.id));
    if (messages.length === 0) return;
    setDeleteChatRequest({ mode: "bulk", messages, cascadeUserRuns: true });
  };

  const editThreadMessage = async (message: ThreadMessage) => {
    if (message.role !== "user") return;
    const next = window.prompt("Edit this prompt and rerun it:", message.content);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) {
      setRunError("Edited prompt cannot be empty.");
      return;
    }
    const hasLinkedRun = Boolean(getRunIdFromMessageContext(message.context));
    const deleted = await deleteThreadMessage(message, true);
    if (!deleted) return;
    if (!hasLinkedRun && outputFile?.id) {
      try {
        await deleteFile(outputFile.id);
        await reloadStageState();
      } catch {
        setRunError("Prompt was edited, but the old output file could not be deleted.");
        return;
      }
    }
    void startRun(trimmed);
  };

  const clearThread = async () => {
    if (isRunning) {
      setRunError("Wait for the current run to finish before clearing chat.");
      return;
    }
    setDeleteChatRequest({ mode: "clear", messages: thread, cascadeUserRuns: false });
  };

  const confirmDeleteChat = async () => {
    if (!deleteChatRequest) return;
    setRunError(null);
    if (deleteChatRequest.mode === "clear") {
      const res = await fetch(`/api/competitions/${competition.id}/agent-thread?stageId=${currentStage.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setRunError(json?.error?.message ?? json?.message ?? "Failed to clear chat.");
        return;
      }
      setThread([]);
      setMessageMenuId(null);
      setSelectedMessageIds(new Set());
      setMessageSelectionMode(false);
    } else if (deleteChatRequest.messages.length === 1) {
      const deleted = await deleteThreadMessage(deleteChatRequest.messages[0], deleteChatRequest.cascadeUserRuns);
      if (!deleted) return;
    } else {
      const deleted = await deleteThreadMessages(deleteChatRequest.messages, deleteChatRequest.cascadeUserRuns);
      if (!deleted) return;
    }
    setDeleteChatRequest(null);
  };

  const selectedMessageCount = selectedMessageIds.size;
  const toggleMessageSelected = (messageId: string) => {
    setSelectedMessageIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  return (
    <section className={`reference-workbench ${railCollapsed ? "rail-collapsed" : ""}`}>
      <aside className={`reference-workflow-rail ${railCollapsed ? "collapsed" : ""}`}>
        <button className="rail-handle inside" onClick={() => setRailCollapsed((value) => !value)}>
          {railCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
        {!railCollapsed ? (
          <div className="reference-rail-header">
            <div>
              <h2>Workflow Pipeline</h2>
              <button onClick={onBack}>Overview</button>
            </div>
            <button className="reference-theme-button" onClick={onToggleTheme}>
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        ) : null}

        <div className="reference-stage-list">
          {STAGES.map((stage) => {
            const entry = stages.find((s) => s.nodeKey === stage.id);
            const unlocked = entry?.unlocked ?? (stage.id === "onboarding");
            const file = entry?.outputFile;
            const status = file?.status;
            const statusClass = status === "approved"
              ? "completed"
              : status === "stale"
                ? "stale"
                : unlocked
                  ? "active"
                  : "locked";
            const active = stage.id === currentStageId;
            return (
              <button
                key={stage.id}
                disabled={!unlocked}
                className={`reference-stage-row ${statusClass} ${active ? "selected" : ""}`}
                onClick={() => {
                  setCurrentStageId(stage.id);
                  setRunError(null);
                }}
                title={stage.label}
              >
                <span className="reference-stage-dot">
                  {status === "approved" ? <Check size={10} /> : !unlocked ? <Lock size={9} /> : null}
                </span>
                {!railCollapsed ? (
                  <span className="reference-stage-copy">
                    <strong>{stage.label}</strong>
                    <small>{status === "stale" ? "Upstream changed - needs re-run" : `Needs: ${stage.input}`}</small>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>

      <div className="reference-workbench-center">
        <div className="reference-stage-summary-strip">
          <FileControl label="Input file" fileName={currentStage.input} source={isMainAgentStage ? "Guidebook" : "Upstream agent output"} />
          <FileControl label="Output file" fileName={outputFile?.fileName ?? currentStage.output} source={outputFile?.status ?? "Not produced yet"} />
        </div>

        <div className="reference-ready-line">
          <span><Bot size={18} /></span>
          <p>
            <strong>Input gate:</strong>{" "}
            {stagesLoading
              ? "checking upstream..."
              : stageUnlocked
                ? "ready - upstream inputs approved."
                : "locked - approve upstream outputs first."}
          </p>
        </div>

        {!stageRunnable ? (
          <section className="reference-agent-question">
            <div className="reference-choice-header">
              <span>Stage status</span>
              <small>not wired</small>
            </div>
            <div className="reference-choice-body">
              <h2>This agent isn&apos;t wired yet.</h2>
              <p>Main Agent and Ideation are wired first. The remaining stages will run once their skills are connected.</p>
            </div>
          </section>
        ) : null}

        <div className="reference-thread-toolbar">
          <span>
            {messageSelectionMode && selectedMessageCount > 0
              ? `${selectedMessageCount} selected`
              : `${thread.length} chat message${thread.length === 1 ? "" : "s"}`}
          </span>
          <div className="reference-thread-actions">
            {messageSelectionMode ? (
              <>
                <button
                  className="btn-ghost reference-small-button"
                  type="button"
                  onClick={() => {
                    setMessageSelectionMode(false);
                    setSelectedMessageIds(new Set());
                  }}
                  disabled={isRunning}
                >
                  Cancel
                </button>
                <button
                  className="btn-ghost danger reference-small-button"
                  type="button"
                  onClick={requestDeleteSelectedMessages}
                  disabled={selectedMessageCount === 0 || isRunning}
                >
                  <Trash2 size={13} /> Delete selected
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-ghost reference-small-button"
                  type="button"
                  onClick={() => setMessageSelectionMode(true)}
                  disabled={thread.length === 0 || isRunning}
                >
                  Select
                </button>
                <button className="ghost-icon" type="button" onClick={clearThread} disabled={thread.length === 0 || isRunning} title="Clear stage chat">
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="reference-agent-thread">
          {thread.length === 0 && !visibleStreamingRun ? (
            <p className="reference-thread-empty">No messages yet. Click {getRunButtonText(currentStage.id, false, false, false, false)} below to start this stage.</p>
          ) : null}
          {thread.map((message) => {
            const actions = getThreadMessageActions(message.role);
            const extracted = extractAgentChoiceFromMessage(message.content, message.context);
            const chatTime = message.role === "user" ? formatChatTime(message.createdAt) : "";
            return (
              <div key={message.id} className={`reference-chat-bubble ${message.role} ${selectedMessageIds.has(message.id) ? "selected" : ""}`}>
                <div className="reference-message-head">
                  <div className="reference-message-title">
                    {messageSelectionMode ? (
                      <label className="reference-message-check" title="Select message">
                        <input
                          type="checkbox"
                          checked={selectedMessageIds.has(message.id)}
                          onChange={() => toggleMessageSelected(message.id)}
                          disabled={isRunning}
                        />
                      </label>
                    ) : null}
                    <span className="reference-chat-role">{message.role === "user" ? "You" : "Agent"}</span>
                  </div>
                  <div className="reference-message-menu-wrap">
                    <button
                      className="ghost-icon reference-message-menu-button"
                      type="button"
                      onClick={() => setMessageMenuId((current) => current === message.id ? null : message.id)}
                      disabled={isRunning}
                      title="Message actions"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {messageMenuId === message.id ? (
                      <div className="reference-message-menu">
                        {actions.includes("edit") ? (
                          <button type="button" onClick={() => void editThreadMessage(message)}>
                            <Pencil size={13} /> Edit and rerun
                          </button>
                        ) : null}
                        {actions.includes("delete") ? (
                          <button type="button" onClick={() => requestDeleteMessage(message)}>
                            <Trash2 size={13} /> Delete
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                {extracted.displayText ? <MarkdownText text={extracted.displayText} /> : null}
                {chatTime ? <span className="reference-chat-time">{chatTime}</span> : null}
                {extracted.choice ? (
                  <AgentChoiceCard choice={extracted.choice} onSelect={answerAgentChoice} />
                ) : null}
              </div>
            );
          })}
          {showStreamingBubble && visibleStreamingRun ? (
            <div className="reference-chat-bubble assistant streaming">
              <span className="reference-chat-role">Agent - streaming</span>
              <MarkdownText text={visibleStreamingRun.tokens || "..."} />
              {visibleStreamingRun.needsUserChoice ? (
                <AgentChoiceCard choice={visibleStreamingRun.needsUserChoice} onSelect={answerAgentChoice} />
              ) : null}
              {visibleStreamingRun.progressLines.length > 0 ? (
                <div className="reference-progress-log">
                  {visibleStreamingRun.progressLines.slice(-8).map((line, index) => (
                    <span key={`${index}-${line}`}>{line}</span>
                  ))}
                </div>
              ) : null}
              {visibleStreamingRun.toolWrites.length > 0 ? (
                <div className="reference-tool-writes">
                  {visibleStreamingRun.toolWrites.map((w) => (
                    <span key={w.fileId} className="reference-tool-chip">
                      <FileText size={12} /> {w.fileName}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {showStreamingBubble && visibleStreamingRun && visibleStreamingRun.activities.length > 0 ? (
            <RunActivityFeed
              activities={visibleStreamingRun.activities}
              collapsed={isTerminalRunPhase(visibleStreamingRun.phase)}
            />
          ) : null}
          {!visibleStreamingRun && completedActivity[currentStage.id]?.activities.length > 0 ? (
            <RunActivityFeed
              activities={completedActivity[currentStage.id].activities}
              collapsed
            />
          ) : null}
          {runError ? <p className="reference-run-error">{runError}</p> : null}
          {visibleStreamingRun || currentStageSubmitting ? (
            <RunStatusBar
              phase={visibleStreamingRun?.phase ?? (currentStageSubmitting ? "submitting" : "")}
              detail={visibleStreamingRun?.phaseDetail ?? "Submitting run to backend..."}
              startedAt={visibleStreamingRun?.startedAt}
              tokens={visibleStreamingRun?.tokens.length ?? 0}
              toolWrites={visibleStreamingRun?.toolWrites.length ?? 0}
              progressLines={visibleStreamingRun?.progressLines ?? []}
            />
          ) : null}
          {outputFile ? (
            <section className="reference-handoff chat-handoff">
              <div>
                <small>Stage Handoff</small>
                <h2>
                  {isApproved
                    ? "Approved. Next stage unlocked."
                    : isStale
                      ? "Upstream changed. Re-run this stage to refresh the output."
                      : "Approve this stage output to unlock connected downstream inputs."}
                </h2>
              </div>
              <div className="reference-handoff-actions">
                {!isApproved ? (
                  <button className="btn-primary reference-small-button" onClick={() => setApproveRequest(true)} disabled={isStale}>
                    <Check size={14} /> Approve &amp; unlock next stage
                  </button>
                ) : (
                  <span className="comp-status-pill">Approved</span>
                )}
              </div>
            </section>
          ) : null}
        </div>

        <div className="reference-chat-composer">
          <textarea
            placeholder={`Optional: instructions for ${currentStage.label}. Leave blank to let the agent start.`}
            value={composerValue}
            onChange={(event) => setComposerValue(event.target.value)}
            disabled={isRunning}
          />
          <div className="reference-chat-controls">
            <select
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              disabled={models.length === 0 || isRunning}
            >
              {modelsLoading && models.length === 0 ? <option value="">Loading models...</option> : null}
              {!modelsLoading && models.length === 0 ? <option value="">No models configured</option> : null}
              {models.map((m) => (
                <option key={buildModelPickerValue(m)} value={buildModelPickerValue(m)}>
                  {m.label} ({m.provider})
                </option>
              ))}
            </select>
            <div className="composer-tools" ref={toolsMenuRef}>
              <button
                className={`composer-tools-button ${activeToolCount > 0 ? "active" : ""}`}
                type="button"
                onClick={() => setToolsMenuOpen((open) => !open)}
                disabled={isRunning}
                title="Run tools"
              >
                <SlidersHorizontal size={15} />
                <span>Tools</span>
              </button>
              {toolsMenuOpen ? (
                <div className="composer-tools-menu">
                  <button
                    type="button"
                    className={webSearchEnabled ? "active" : ""}
                    onClick={() => {
                      setWebSearchEnabled((value) => !value);
                    }}
                  >
                    <Globe size={16} />
                    <span>Search the web</span>
                    {webSearchEnabled ? <Check size={14} /> : null}
                  </button>
                  <button
                    type="button"
                    className={imageGenerationEnabled ? "active" : ""}
                    onClick={() => {
                      setImageGenerationEnabled((value) => !value);
                    }}
                  >
                    <Palette size={16} />
                    <span>Create an image</span>
                    {imageGenerationEnabled ? <Check size={14} /> : null}
                  </button>
                  {webSearchEnabled ? (
                    <div className="composer-search-mode">
                      <small>Search depth</small>
                      <div>
                        {(["fast", "balanced", "deep"] as SearchMode[]).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className={searchMode === mode ? "active" : ""}
                            onClick={() => setSearchMode(mode)}
                            title={SEARCH_MODE_META[mode].description}
                          >
                            {SEARCH_MODE_META[mode].label}
                          </button>
                        ))}
                      </div>
                      <p>{SEARCH_MODE_META[searchMode].description}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <select
              value={reasoningDisabled ? "" : activeReasoningEffort}
              onChange={(event) => setReasoningEffort(event.target.value as ReasoningEffort)}
              disabled={isRunning || reasoningDisabled}
            >
              {reasoningDisabled ? <option value="">No thinking effort</option> : null}
              {reasoningEfforts.map((effort) => (
                <option key={effort} value={effort}>{REASONING_LABELS[effort]}</option>
              ))}
            </select>
            <button
              className="btn-primary reference-run-button"
              onClick={runInFlight ? terminateRun : requestRerun}
              disabled={runButtonDisabled}
              title={runButtonDisabled && !modelReady ? "Pick a model first" : runButtonDisabled && !stageUnlocked ? "Upstream not approved" : runButtonDisabled && !stageRunnable ? "This stage is not wired yet" : undefined}
            >
              {getRunButtonText(currentStage.id, runInFlight, runCancelling, runSubmitting, Boolean(isApproved))} {runInFlight ? <X size={14} /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>

      <aside className="reference-current-file">
        <div className="reference-current-card">
          <div className="reference-current-head">
            <div>
              <small>Current File</small>
              <strong>{outputFile?.fileName ?? currentStage.output}</strong>
            </div>
            <span>{outputFile?.status ?? "Not produced"}</span>
          </div>
          <div className="reference-unlocks">
            <small>Unlocks Next</small>
            <p>{nextStage ? `${nextStage.label} can run after this file is approved.` : "All required stage outputs are ready for final review."}</p>
          </div>
          {visibleStreamingRun || currentStageSubmitting ? (
            <div className="reference-live-output">
              <small>Live agent output</small>
              <LiveWritingPreview
                text={visibleStreamingRun?.tokens ?? ""}
                fallback={visibleStreamingRun?.phaseDetail ?? "Submitting run to backend..."}
              />
            </div>
          ) : outputFile ? (
            <button className="reference-fullscreen-button" onClick={() => setOutputOpen(true)}>
              <Maximize2 size={15} /> Full screen
            </button>
          ) : (
            <p className="reference-thread-empty">Nothing produced yet.</p>
          )}
        </div>
      </aside>

      {assistantOpen ? (
        <aside className="workspace-assistant reference-assistant">
          <AssistantPanel context={`Workbench stage: ${currentStage.label}. Input: ${currentStage.input}. Output: ${outputFile?.fileName ?? currentStage.output}.`} onClose={onToggleAssistant} />
        </aside>
      ) : null}
      {rerunTarget ? (
        <RerunConfirmDialog
          stage={rerunTarget}
          onCancel={() => setRerunTarget(null)}
          onConfirm={confirmRerun}
        />
      ) : null}
      {deleteChatRequest ? (
        <DeleteChatConfirmDialog
          request={deleteChatRequest}
          onCancel={() => setDeleteChatRequest(null)}
          onConfirm={confirmDeleteChat}
        />
      ) : null}
      {approveRequest && outputFile ? (
        <ApproveConfirmDialog
          stageLabel={currentStage.label}
          fileName={outputFile.fileName}
          onCancel={() => setApproveRequest(false)}
          onConfirm={approve}
        />
      ) : null}
      {outputOpen && outputFile ? (
        <FullscreenOutputReader
          fileId={outputFile.id}
          fileName={outputFile.fileName}
          onClose={() => setOutputOpen(false)}
        />
      ) : null}
    </section>
  );
}

type StageStateEntry = {
  nodeId: string;
  nodeKey: string;
  label: string;
  positionIndex: number;
  unlocked: boolean;
  outputFile: { id: string; fileName: string; status: string } | null;
  downstreamStageKeys: string[];
};

type ThreadMessage = {
  id: string;
  role: string;
  content: string;
  stageId?: string;
  modelProvider?: string;
  modelId?: string;
  context?: Record<string, unknown>;
  createdAt: string;
};

type ChatDeleteRequest = {
  mode: "single" | "bulk" | "clear";
  messages: ThreadMessage[];
  cascadeUserRuns: boolean;
};

type ActiveRun = {
  runId: string;
  stageId: StageId;
  tokens: string;
  activities: RunActivityItem[];
  progressLines: string[];
  toolWrites: Array<{ fileName: string; fileId: string }>;
  needsUserChoice?: AgentRuntimeChoice;
  phase: string; // 'queued' | 'started' | 'prompt_built' | 'streaming' | 'tool_writing' | 'completed' | 'failed'
  phaseDetail: string;
  startedAt: number;
};

type CompletedRunActivity = {
  activities: RunActivityItem[];
  progressLines: string[];
  phaseDetail: string;
};

type RunActivityItem = {
  kind: "thinking" | "searching" | "reading" | "tool" | "writing" | "session";
  label: string;
  url?: string;
  domain?: string;
  fileName?: string;
  tool?: string;
};

type AgentRuntimeChoiceOption = AgentChoiceOption;
type AgentRuntimeChoice = AgentChoice;

function isNeedsUserChoice(value: unknown): value is AgentRuntimeChoice {
  return isAgentChoice(value);
}

function isTerminalRunPhase(phase: string | undefined): boolean {
  return phase === "completed" || phase === "failed" || phase === "cancelled" || phase === "needs_choice";
}

function getRunButtonText(stageId: string, streaming: boolean, cancelling: boolean, submitting: boolean, approved: boolean): string {
  if (streaming) return cancelling ? "Terminating..." : "Terminate";
  if (submitting) return "Submitting...";
  if (approved) return "Re-run";
  if (stageId === "onboarding") return "Run Main Agent";
  if (stageId === "ideation") return "Run Ideation Agent";
  return "Run";
}

function normalizeRunActivity(payload: Record<string, unknown>): RunActivityItem | null {
  const kind = String(payload.kind ?? "");
  if (!["thinking", "searching", "reading", "tool", "writing", "session"].includes(kind)) return null;
  const label = typeof payload.label === "string" && payload.label.trim()
    ? payload.label
    : kind === "session"
      ? "Provider session attached"
      : kind;
  return {
    kind: kind as RunActivityItem["kind"],
    label,
    url: typeof payload.url === "string" ? payload.url : undefined,
    domain: typeof payload.domain === "string" ? payload.domain : undefined,
    fileName: typeof payload.fileName === "string" ? payload.fileName : undefined,
    tool: typeof payload.tool === "string" ? payload.tool : undefined,
  };
}

function appendRunActivity(current: RunActivityItem[], next: RunActivityItem): RunActivityItem[] {
  const last = current.at(-1);
  if (last && last.kind === next.kind && last.label === next.label && last.url === next.url) return current;
  return [...current, next].slice(-24);
}

function RunActivityFeed({
  activities,
  collapsed,
}: {
  activities: RunActivityItem[];
  collapsed: boolean;
}) {
  const items = activities;
  const visible = collapsed ? items.slice(-1) : items.slice(-8);
  if (visible.length === 0) return null;
  return (
    <div className={`reference-activity-feed ${collapsed ? "collapsed" : ""}`}>
      {visible.map((item, index) => (
        <div className={`reference-activity-row ${item.kind}`} key={`${item.kind}-${item.label}-${index}`}>
          <span className="reference-activity-dot" />
          <div>
            <strong>{activityLabel(item.kind)}</strong>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer">{item.domain ?? item.url}</a>
            ) : (
              <small>{item.label}</small>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function activityLabel(kind: RunActivityItem["kind"]): string {
  if (kind === "searching") return "Searching";
  if (kind === "reading") return "Reading";
  if (kind === "tool") return "Using tool";
  if (kind === "session") return "Session";
  if (kind === "writing") return "Writing";
  return "Thinking";
}

function LiveWritingPreview({ text, fallback }: { text: string; fallback: string }) {
  const [visibleLineCount, setVisibleLineCount] = useState(1);
  const lines = (text.trim() ? text : fallback).split(/\r?\n/);
  useEffect(() => {
    setVisibleLineCount(Math.min(1, Math.max(lines.length, 1)));
    if (!text.trim()) return;
    const id = setInterval(() => {
      setVisibleLineCount((count) => {
        if (count >= lines.length) {
          clearInterval(id);
          return count;
        }
        return count + 1;
      });
    }, 120);
    return () => clearInterval(id);
  }, [text, lines.length]);
  return (
    <div className="reference-live-stream writing-only">
      {(text.trim() ? lines.slice(0, visibleLineCount) : lines).join("\n")}
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((part) => part.length > 0);
  return (
    <div className="markdown-text">
      {blocks.map((block, blockIndex) => {
        const lines = block.split(/\n/);
        return lines.map((line, lineIndex) => renderMarkdownLine(line, `${blockIndex}-${lineIndex}`));
      })}
    </div>
  );
}

function renderMarkdownLine(line: string, key: string): ReactNode {
  const heading = line.match(/^(#{1,4})\s+(.+)$/);
  if (heading) {
    const level = Math.min(heading[1].length, 4);
    if (level === 1) return <h3 key={key}>{renderInlineMarkdown(heading[2])}</h3>;
    if (level === 2) return <h4 key={key}>{renderInlineMarkdown(heading[2])}</h4>;
    if (level === 3) return <h5 key={key}>{renderInlineMarkdown(heading[2])}</h5>;
    return <h6 key={key}>{renderInlineMarkdown(heading[2])}</h6>;
  }

  const unordered = line.match(/^\s*[-*]\s+(.+)$/);
  if (unordered) {
    return (
      <p key={key} className="markdown-list-line">
        <span className="markdown-list-marker">-</span>
        <span>{renderInlineMarkdown(unordered[1])}</span>
      </p>
    );
  }

  const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
  if (ordered) {
    return (
      <p key={key} className="markdown-list-line">
        <span className="markdown-list-marker">{ordered[1]}.</span>
        <span>{renderInlineMarkdown(ordered[2])}</span>
      </p>
    );
  }

  return <p key={key}>{renderInlineMarkdown(line)}</p>;
}

function renderInlineMarkdown(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) nodes.push(line.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${match.index}-${token}`;
    if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < line.length) nodes.push(line.slice(lastIndex));
  return nodes;
}

function AgentChoiceCard({ choice, onSelect }: { choice: AgentRuntimeChoice; onSelect: (choice: AgentRuntimeChoiceOption) => void }) {
  if (isContextlessChoice(choice.question)) return null;
  return (
    <div className="reference-agent-question inline-choice">
      <div className="reference-choice-header">
        <span>Decision needed</span>
        <small>agent checkpoint</small>
      </div>
      <div className="reference-choice-body">
        <h2>{choice.question}</h2>
        <div className="reference-choice-row">
          {choice.options.map((option) => (
            <button
              key={option.id ?? option.key ?? option.label}
              type="button"
              className="reference-choice-pill"
              onClick={() => onSelect(option)}
            >
              <span>{option.key ?? option.id?.slice(0, 1).toUpperCase() ?? ">"}</span>
              <strong>{option.label}</strong>
              <small>{option.description ?? option.detail ?? option.result}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function isContextlessChoice(question: string): boolean {
  const words = question.trim().split(/\s+/).filter(Boolean).length;
  return words < 8;
}

function ApproveConfirmDialog({
  stageLabel,
  fileName,
  onCancel,
  onConfirm,
}: {
  stageLabel: string;
  fileName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="modal-backdrop">
      <div className="small-modal approve-modal">
        <div className="modal-header">
          <h2>Approve {stageLabel} output?</h2>
          <button className="ghost-icon" onClick={onCancel} disabled={busy}>
            <X size={18} />
          </button>
        </div>
        <p>
          This freezes <strong>{fileName}</strong> and unlocks the next stage. If you later edit or re-run this stage,
          the app will treat it as a fresh run and downstream outputs may need to be regenerated or approved again.
        </p>
        {err ? <p className="modal-error">{err}</p> : null}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={async () => {
              try {
                setBusy(true);
                setErr(null);
                await onConfirm();
              } catch (error) {
                setErr(error instanceof Error ? error.message : "Approve failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Approving..." : "Approve and unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteChatConfirmDialog({
  request,
  onCancel,
  onConfirm,
}: {
  request: ChatDeleteRequest;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const count = request.mode === "clear" ? request.messages.length : request.messages.length;
  const title = request.mode === "clear"
    ? "Clear chat"
    : request.mode === "bulk"
      ? "Delete selected chat"
      : "Delete chat";
  const body = request.mode === "clear"
    ? "This removes all visible chat messages for this stage from the database. Output files are kept."
    : request.cascadeUserRuns
      ? "Deleting user prompts also deletes the linked run messages and generated output files from the database."
      : "This removes the selected chat message from the database.";

  return (
    <div className="modal-backdrop">
      <div className="small-modal chat-delete-modal">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="ghost-icon" onClick={onCancel} disabled={busy}>
            <X size={18} />
          </button>
        </div>
        <p>{body}</p>
        <div className="chat-delete-summary">
          <strong>{count}</strong>
          <span>{count === 1 ? "message will be deleted" : "messages will be deleted"}</span>
        </div>
        {err ? <p className="modal-error">{err}</p> : null}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={busy || count === 0}
            onClick={async () => {
              try {
                setBusy(true);
                setErr(null);
                await onConfirm();
              } catch (error) {
                setErr(error instanceof Error ? error.message : "Delete failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RunStatusBar({
  phase,
  detail,
  startedAt,
  tokens,
  toolWrites,
  progressLines,
}: {
  phase: string;
  detail: string;
  startedAt?: number;
  tokens: number;
  toolWrites: number;
  progressLines: string[];
}) {
  const [, force] = useState(0);
  // Tick once a second for elapsed time display.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  const elapsedDisplay = formatElapsed(elapsedSec);

  const phaseLabel = ({
    submitting: "Submitting",
    queued: "Queued",
    started: "Worker started",
    prompt_built: "Prompt built",
    streaming: "Streaming",
    tool_writing: "Writing file",
    completed: "Completed",
    failed: "Failed",
  } as Record<string, string>)[phase] ?? phase;

  const isFailed = phase === "failed";
  const isComplete = phase === "completed";

  return (
    <div className={`reference-run-status ${isFailed ? "failed" : isComplete ? "complete" : ""}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isFailed ? <X size={14} /> : isComplete ? <Check size={14} /> : <RefreshCw size={14} className="spin" />}
          <strong style={{ fontSize: 13 }}>{phaseLabel}</strong>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>- {elapsedDisplay}</span>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--muted)" }}>
          {tokens > 0 ? <span>{tokens.toLocaleString()} chars streamed</span> : null}
          {toolWrites > 0 ? <span>{toolWrites} file{toolWrites !== 1 ? "s" : ""} written</span> : null}
        </div>
      </div>
      <p style={{ margin: "6px 0 0 22px", fontSize: 12, color: "var(--muted)" }}>{detail}</p>
      {progressLines.length > 0 ? (
        <div className="reference-progress-log compact">
          {progressLines.slice(-6).map((line, index) => (
            <span key={`${index}-${line}`}>{line}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function RerunConfirmDialog({ stage, onCancel, onConfirm }: { stage: StageStateEntry; onCancel: () => void; onConfirm: () => void }) {
  const downstream = stage.downstreamStageKeys;
  return (
    <div className="modal-backdrop">
      <div className="small-modal">
        <div className="modal-header">
          <h2>Re-run {stage.label}?</h2>
          <button className="ghost-icon" onClick={onCancel}><X size={18} /></button>
        </div>
        <p>
          Re-running will replace the current output. Approved downstream outputs will be
          marked <strong>stale</strong> and need re-approval or re-run:
        </p>
        {downstream.length > 0 ? (
          <ul className="reference-stale-list">
            {downstream.map((key) => <li key={key}>- {stageLabelFor(key)}</li>)}
          </ul>
        ) : <p><em>No downstream stages currently consume this output.</em></p>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={onConfirm}>Re-run and mark downstream stale</button>
        </div>
      </div>
    </div>
  );
}

function stageLabelFor(nodeKey: string): string {
  const s = STAGES.find((stg) => stg.id === nodeKey);
  return s?.label ?? nodeKey;
}

function FullscreenOutputReader({ fileId, fileName, onClose }: { fileId: string; fileName: string; onClose: () => void }) {
  const [content, setContent] = useState<string>("Loading...");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/files/${fileId}`, { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) setContent(String(json?.data?.contentText ?? "No content."));
      } catch {
        if (!cancelled) setContent("Failed to load file.");
      }
    })();
    return () => { cancelled = true; };
  }, [fileId]);
  return (
    <div className="reference-editor-overlay">
      <div className="reference-editor-shell">
        <header className="reference-editor-header">
          <div><small>Stage Output</small><strong>{fileName}</strong></div>
          <button className="reference-round-button" onClick={onClose}><Minimize2 size={15} /></button>
        </header>
        <main className="reference-editor-body">
          <article className="reference-document-page">
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-body)" }}>{content}</pre>
          </article>
        </main>
      </div>
    </div>
  );
}

function FileControl({ label, fileName, source }: { label: string; fileName: string; source: string }) {
  return <button className="file-control reference-file-control"><span><small>{label}</small><strong>{fileName}</strong><em>{source}</em></span>{label === "Output file" ? <FileText size={16} /> : <span>Agent Output</span>}</button>;
}


function AssistantPanel({ context, onClose }: { context: string; onClose: () => void }) {
  const { models, selectedModel: model, setSelectedModel: setModel, modelsLoading } = useModelOptions();
  const [effort, setEffort] = useState<ReasoningEffort>("medium");
  const readiness = isModelSelectionReady(model);
  const reasoningEfforts = getReasoningEffortsForModel(models, model) as ReasoningEffort[];
  const activeEffort = getActiveReasoningEffort(models, model, effort);
  const reasoningDisabled = reasoningEfforts.length === 0;
  return <div className="assistant-panel"><div className="assistant-header"><div><strong>Context AI Assistant</strong><small>{context}</small></div><button className="ghost-icon" onClick={onClose}><X size={16} /></button></div><div className="assistant-body"><div className="assistant-bubble"><Bot size={18} />Saya membaca lokasi kerja aktif dan file yang dipilih. Pilih model sebelum generate.</div></div><div className="assistant-composer"><div className="composer-controls"><select value={model} onChange={(event) => setModel(event.target.value)} disabled={models.length === 0}><option value="">{modelsLoading ? "Loading models..." : "Select model"}</option>{models.map((item) => <option key={buildModelPickerValue(item)} value={buildModelPickerValue(item)}>{item.label} ({item.provider})</option>)}</select><select value={reasoningDisabled ? "" : activeEffort} onChange={(event) => setEffort(event.target.value as ReasoningEffort)} disabled={reasoningDisabled}>{reasoningDisabled ? <option value="">No thinking effort</option> : null}{reasoningEfforts.map((item) => <option key={item} value={item}>{REASONING_LABELS[item]}</option>)}</select><button>Tools</button></div>{!readiness.ready ? <p className="notice">{readiness.message}</p> : null}<div className="composer-row"><textarea placeholder="Ask for edits, citations, next steps..." /><button className="send-button" disabled={!readiness.ready} title={`Send with ${activeEffort}`}><Send size={16} /></button></div></div></div>;
}

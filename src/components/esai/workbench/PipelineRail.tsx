"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StageId } from "@/types/esai";

export type StageStateEntry = {
  id: StageId;
  label: string;
  status: "completed" | "active" | "locked";
};

type PipelineRailProps = {
  stages: StageStateEntry[];
  currentStageId: StageId;
  selectedStageId: StageId;
  onSelectStage: (stageId: StageId) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export function PipelineRail({
  stages,
  currentStageId,
  selectedStageId,
  onSelectStage,
  collapsed,
  onToggleCollapsed,
}: PipelineRailProps) {
  return (
    <aside
      className={cn(
        "relative grid content-start gap-4 border-r border-[var(--border)] bg-[var(--surface)] p-4 transition-[width] duration-200",
        collapsed ? "w-[84px]" : "w-[280px]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {!collapsed ? (
          <div>
            <h2 className="m-0 text-base font-bold">Pipeline</h2>
            <p className="m-0 text-xs text-[var(--muted)]">Tahap kerja agent</p>
          </div>
        ) : null}
        <Button type="button" variant="ghost" size="icon" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand pipeline" : "Collapse pipeline"}>
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </Button>
      </div>

      <ol className="relative grid gap-3">
        {!collapsed ? <span className="absolute left-5 top-5 h-[calc(100%-40px)] w-px bg-[linear-gradient(var(--success),var(--primary),var(--border))]" /> : null}
        {stages.map((stage, index) => {
          const selected = stage.id === selectedStageId;
          const current = stage.id === currentStageId || stage.status === "active";
          const completed = stage.status === "completed";
          return (
            <li key={stage.id}>
              <button
                type="button"
                disabled={stage.status === "locked"}
                onClick={() => onSelectStage(stage.id)}
                aria-current={selected ? "step" : undefined}
                className={cn(
                  "relative flex min-h-12 w-full items-center gap-3 rounded-[14px] p-2 text-left text-sm font-semibold transition",
                  selected && "bg-[var(--primary-soft)]",
                  stage.status === "locked" && "cursor-not-allowed opacity-55",
                  collapsed && "justify-center",
                )}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full border text-sm font-bold",
                    completed && "border-[var(--success)] bg-[var(--success)] text-white",
                    current && !completed && "border-[var(--primary)] bg-[var(--surface)] text-[var(--primary)] shadow-[0_0_0_4px_var(--primary-soft)]",
                    stage.status === "locked" && "border-dashed border-[var(--border)] text-[var(--muted)]",
                  )}
                >
                  {completed ? <Check className="size-4" /> : index + 1}
                </span>
                {!collapsed ? (
                  <span className="grid min-w-0 gap-1">
                    <span className="truncate">{stage.label}</span>
                    <small className="capitalize text-[var(--muted)]">{stage.status}</small>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

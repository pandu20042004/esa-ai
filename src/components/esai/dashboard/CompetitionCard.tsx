"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { STAGES } from "@/lib/esai/stages";
import type { Competition } from "@/types/esai";

export type CompetitionCardProps = {
  competition: Competition;
  selected: boolean;
  onOpen: (competition: Competition) => void;
  onEdit: (competition: Competition) => void;
  onDelete: (competition: Competition) => void;
};

function formatDeadline(value: string) {
  if (!value) return "Deadline belum diisi";
  return new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function isUrgent(value: string) {
  if (!value) return false;
  const deadline = new Date(value).getTime();
  if (Number.isNaN(deadline)) return false;
  const days = Math.ceil((deadline - Date.now()) / 86_400_000);
  return days >= 0 && days < 7;
}

export function CompetitionCard({ competition, selected, onOpen, onEdit, onDelete }: CompetitionCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const stageLabel = STAGES.find((stage) => stage.id === competition.currentStageId)?.label ?? competition.currentStageId;
  const progress = Math.max(0, Math.min(100, competition.progress ?? 0));
  const deadlineUrgent = isUrgent(competition.deadline);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(competition)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen(competition);
      }}
      className={cn(
        "group overflow-hidden rounded-[16px] border-[var(--border)] bg-[var(--surface)] p-0 shadow-[var(--soft-shadow)] transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:border-[var(--primary-border)]",
        selected && "border-[var(--primary-border)] shadow-[0_0_0_3px_var(--primary-soft)]",
      )}
    >
      <div className="relative aspect-[2/1] overflow-hidden bg-[var(--primary-soft)]">
        {competition.posterImageUrl ? (
          <img src={competition.posterImageUrl} alt={competition.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center bg-[linear-gradient(145deg,var(--surface),var(--primary-soft))]">
            <span className="grid size-16 place-items-center rounded-full bg-[var(--surface)] text-3xl font-extrabold text-[var(--primary)] shadow-sm">
              {competition.title.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        <Badge className="absolute bottom-3 left-4 rounded-full bg-[var(--chip-bg)] px-3 py-1 text-[var(--primary)] shadow-sm">{competition.status || "Setup"}</Badge>
        <div
          className={cn(
            "absolute right-3 top-3 transition-opacity md:opacity-0 md:group-hover:opacity-100",
            menuOpen && "opacity-100",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="secondary" aria-label={`Options for ${competition.title}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(competition)}>
                <Pencil className="size-4" />
                Rename / edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[var(--danger)]" onClick={() => onDelete(competition)}>
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-5 p-5">
        <div className="grid gap-1">
          <h3 className="truncate text-lg font-bold leading-tight">{competition.title}</h3>
          <p className="truncate text-sm text-[var(--muted)]">
            {competition.category}
            {competition.institution ? ` - ${competition.institution}` : ""}
          </p>
        </div>

        <div className="grid gap-2" title={`Progress ${progress}%`}>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--muted)]">Progress</span>
            <strong>{progress}%</strong>
          </div>
          <Progress value={progress} aria-label={`Progress ${progress}%`} />
        </div>

        <div className="grid gap-4 text-xs font-semibold text-[var(--muted)]">
          <div className="flex items-center justify-between gap-3">
            <span>Deadline</span>
            <span className={cn("truncate", deadlineUrgent ? "text-[var(--primary)]" : "text-[var(--muted)]")}>
              {formatDeadline(competition.deadline)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button className="flex-1 bg-[var(--button-soft)] text-[var(--primary)] hover:bg-[var(--primary-soft)]" type="button" onClick={(event) => { event.stopPropagation(); onOpen(competition); }}>
              Lanjutkan
            </Button>
            <Button size="icon" variant="outline" type="button" aria-label={`Open ${stageLabel}`} onClick={(event) => { event.stopPropagation(); onEdit(competition); }}>
              <MoreHorizontal className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

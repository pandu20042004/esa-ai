"use client";

import type { Competition } from "@/types/esai";
import { CompetitionCard } from "./CompetitionCard";

type CompetitionGridProps = {
  competitions: Competition[];
  selectedCompetition: Competition | null;
  onOpen: (competition: Competition) => void;
  onEdit: (competition: Competition) => void;
  onDelete: (competition: Competition) => void;
};

export function CompetitionGrid({ competitions, selectedCompetition, onOpen, onEdit, onDelete }: CompetitionGridProps) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {competitions.map((competition) => (
        <CompetitionCard
          key={competition.id}
          competition={competition}
          selected={selectedCompetition?.id === competition.id}
          onOpen={onOpen}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { CompetitionCard } from "@/components/esai/dashboard/CompetitionCard";
import type { Competition } from "@/types/esai";

const competition: Competition = {
  id: "comp-1",
  title: "Lomba Esai Nasional",
  category: "Essay",
  institution: "Universitas Contoh",
  status: "Active",
  progress: 42,
  deadline: "2026-09-01",
  currentStageId: "ideation",
};

describe("CompetitionCard", () => {
  it("shows title, deadline, progress, and action menu", () => {
    const onOpen = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <CompetitionCard
        competition={competition}
        selected={false}
        onOpen={onOpen}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText("Lomba Esai Nasional")).toBeInTheDocument();
    expect(screen.getByText("01 Sep 2026")).toBeInTheDocument();
    expect(screen.getByLabelText("Progress 42%")).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole("button", { name: /Options for Lomba Esai Nasional/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Rename \/ edit/i }));
    expect(onEdit).toHaveBeenCalledWith(competition);
  });
});

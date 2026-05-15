import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { PipelineRail, type StageStateEntry } from "@/components/esai/workbench/PipelineRail";

const stages: StageStateEntry[] = [
  { id: "onboarding", label: "Onboarding", status: "completed" },
  { id: "ideation", label: "Ideation", status: "active" },
  { id: "research", label: "Research", status: "locked" },
];

describe("PipelineRail", () => {
  it("renders completed, current, locked stages and supports selection", () => {
    const onSelectStage = vi.fn();
    render(
      <PipelineRail
        stages={stages}
        currentStageId="ideation"
        selectedStageId="ideation"
        onSelectStage={onSelectStage}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
      />,
    );

    expect(screen.getByText("Onboarding")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ideation/i })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: /Research/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Onboarding/i }));
    expect(onSelectStage).toHaveBeenCalledWith("onboarding");
  });
});

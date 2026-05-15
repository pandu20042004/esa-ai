import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { DashboardRoute } from "@/components/esai/routes/DashboardRoute";
import { CompetitionProvider } from "@/components/esai/shell/CompetitionProvider";

// Mock the API module so fetchCompetitions resolves immediately with empty array
vi.mock("@/lib/esai/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/esai/api")>();
  return {
    ...actual,
    fetchCompetitions: vi.fn().mockResolvedValue([]),
    fetchFiles: vi.fn().mockResolvedValue([]),
    fetchCompetitionFiles: vi.fn().mockResolvedValue([]),
  };
});

describe("dashboard overview flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("starts without demo competitions and opens the create flow", async () => {
    render(
      <CompetitionProvider>
        <DashboardRoute />
      </CompetitionProvider>,
    );

    // Wait for loading to finish and empty state to appear
    await waitFor(() => {
      expect(screen.getByText("Belum ada kompetisi")).toBeInTheDocument();
    });
    expect(screen.queryByText("Workflow Pipeline")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Tambah Kompetisi/i })[0]);

    expect(screen.getByText("Setup Kompetisi Baru")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Competition name")).toBeInTheDocument();
  });
});

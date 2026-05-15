import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { EsaiPremiumApp } from "@/components/esai/EsaiPremiumApp";

// Mock the API module so fetchCompetitions resolves immediately with empty array
vi.mock("@/lib/esai/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/esai/api")>();
  return {
    ...actual,
    fetchCompetitions: vi.fn().mockResolvedValue([]),
  };
});

describe("dashboard overview flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts without demo competitions and opens the create flow", async () => {
    render(<EsaiPremiumApp />);

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

import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { OutputsRoute } from "@/components/esai/routes/OutputsRoute";
import { CompetitionProvider } from "@/components/esai/shell/CompetitionProvider";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/esai/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/esai/api")>();
  return {
    ...actual,
    fetchCompetitions: vi.fn().mockResolvedValue([
      {
        id: "competition-1",
        title: "Lomba Esai Humanisasi AI",
        category: "Esai",
        institution: "Universitas Contoh",
        status: "completed",
        progress: 100,
        deadline: "2026-06-20",
        currentStageId: "supervisor",
      },
    ]),
    fetchFiles: vi.fn().mockResolvedValue([]),
  };
});

describe("OutputsRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("renders completed competitions as export-ready outputs", async () => {
    render(
      <CompetitionProvider>
        <OutputsRoute />
      </CompetitionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Lomba Esai Humanisasi AI")).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "Outputs" })).toBeInTheDocument();
    expect(screen.getByText("Esai - Universitas Contoh")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Workbench/i })).toHaveAttribute("href", "/workbench/competition-1");
  });
});

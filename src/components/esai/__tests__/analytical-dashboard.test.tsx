import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { EsaiPremiumApp } from "@/components/esai/EsaiPremiumApp";

describe("AnalyticalDashboard", () => {
  it("renders the full analytical dashboard sections from the reference", () => {
    render(<EsaiPremiumApp />);

    fireEvent.click(screen.getByRole("button", { name: /User Account/i }));
    fireEvent.click(screen.getByRole("button", { name: /Open Dashboard/i }));

    expect(screen.getByRole("heading", { name: "Analytical Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Wins Over Time")).toBeInTheDocument();
    expect(screen.getByText("Outcome Mix")).toBeInTheDocument();
    expect(screen.getByText("Strongest Fields")).toBeInTheDocument();
    expect(screen.getByText("Suggestions to Improve")).toBeInTheDocument();
    expect(screen.getByText("Log Competition Results")).toBeInTheDocument();
    expect(screen.getByText("No competition results logged yet.")).toBeInTheDocument();
  });
});

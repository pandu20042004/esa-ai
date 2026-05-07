import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { EsaiPremiumApp } from "@/components/esai/EsaiPremiumApp";

describe("dashboard overview flow", () => {
  it("starts without demo competitions and opens the create flow", () => {
    render(<EsaiPremiumApp />);

    expect(screen.getByText("No competitions yet")).toBeInTheDocument();
    expect(screen.queryByText("Workflow Pipeline")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.getByText("Add Competition")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Competition name")).toBeInTheDocument();
  });
});

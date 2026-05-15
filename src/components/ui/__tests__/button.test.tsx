import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders as a command button", () => {
    render(<Button>Tambah Kompetisi</Button>);

    expect(screen.getByRole("button", { name: "Tambah Kompetisi" })).toBeInTheDocument();
  });
});

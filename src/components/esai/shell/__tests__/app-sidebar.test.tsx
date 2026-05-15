import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/esai/shell/AppSidebar";
import { CompetitionProvider } from "@/components/esai/shell/CompetitionProvider";
import { ThemeProvider } from "@/components/esai/shell/ThemeProvider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));

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

vi.mock("@/lib/esai/api", () => ({
  fetchCompetitions: vi.fn().mockResolvedValue([]),
  fetchFiles: vi.fn().mockResolvedValue([]),
  ApiError: class ApiError extends Error {},
}));

describe("AppSidebar", () => {
  it("renders grouped navigation and marks Dashboard active", () => {
    render(
      <ThemeProvider>
        <CompetitionProvider>
          <AppSidebar />
        </CompetitionProvider>
      </ThemeProvider>,
    );

    expect(screen.getByText("MAIN")).toBeInTheDocument();
    expect(screen.getByText("TOOLS")).toBeInTheDocument();
    expect(screen.getByText("ADVANCED")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dashboard/i })).toHaveAttribute("aria-current", "page");
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DevsAgentsWorkspace } from "@/components/esai/DevsAgentsWorkspace";

const compartments = [
  { id: "c1", name: "Essay", slug: "essay", isDefault: true, archived: false, sortOrder: 0 },
];

const agents = [
  {
    id: "a1",
    compartmentId: "c1",
    kind: "template_copy",
    state: "published",
    name: "Research Agent",
    description: "Research",
    enabled: true,
    archived: false,
    publishedSkillContent: "# Research",
    draftSkillContent: "# Research",
    draftNeeds: [],
    draftProduces: [{ key: "research_brief", label: "Research brief", role: "research_output" }],
    publishedNeeds: [],
    publishedProduces: [{ key: "research_brief", label: "Research brief", role: "research_output" }],
  },
];

describe("DevsAgentsWorkspace", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("loads compartments and agents", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/compartments")) return Response.json({ data: compartments });
      if (url.includes("/api/agents")) return Response.json({ data: agents });
      return Response.json({ data: [] });
    });

    render(<DevsAgentsWorkspace />);

    expect(await screen.findAllByText("Research Agent")).toHaveLength(2);
    expect(screen.getAllByText("Template copy")).toHaveLength(2);
    expect(screen.getByDisplayValue("# Research")).toBeInTheDocument();
  });

  it("creates a custom agent", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/compartments")) return Response.json({ data: compartments });
      if (url.includes("/api/agents") && init?.method === "POST") {
        return Response.json(
          { data: { ...agents[0], id: "a2", name: "Citation Agent", kind: "custom" } },
          { status: 201 },
        );
      }
      if (url.includes("/api/agents")) return Response.json({ data: agents });
      return Response.json({ data: [] });
    });

    render(<DevsAgentsWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: /New Agent/i }));
    fireEvent.change(screen.getByPlaceholderText("Agent name"), { target: { value: "Citation Agent" } });
    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/agents", expect.objectContaining({ method: "POST" })),
    );
  });

  it("publishes the selected agent", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/compartments")) return Response.json({ data: compartments });
      if (url.includes("/api/agents/a1/publish")) {
        return Response.json({ data: { ...agents[0], state: "published" } });
      }
      if (url.includes("/api/agents")) return Response.json({ data: agents });
      return Response.json({ data: [] });
    });

    render(<DevsAgentsWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: /Publish version/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/agents/a1/publish",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});

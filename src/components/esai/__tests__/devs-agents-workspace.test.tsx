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

    expect((await screen.findAllByText("Research Agent")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Template copy").length).toBeGreaterThanOrEqual(2);
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

  it("creates a compartment", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/compartments") && init?.method === "POST") {
        return Response.json(
          { data: { id: "c2", name: "KTI", slug: "kti", isDefault: false, archived: false, sortOrder: 1 } },
          { status: 201 },
        );
      }
      if (url.includes("/api/compartments")) return Response.json({ data: compartments });
      if (url.includes("/api/agents")) return Response.json({ data: agents });
      return Response.json({ data: [] });
    });

    render(<DevsAgentsWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: /Compartment/i }));
    fireEvent.change(screen.getByPlaceholderText("Compartment name"), { target: { value: "KTI" } });
    fireEvent.click(screen.getByRole("button", { name: "Create compartment" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/compartments", expect.objectContaining({ method: "POST" })),
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
    fireEvent.click(await screen.findByRole("button", { name: /^Publish$/i }));
    expect(await screen.findByRole("dialog", { name: /Publish agent version/i })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /Confirm publish/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/agents/a1/publish",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("shows whether editor changes are saved to the database", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/compartments")) return Response.json({ data: compartments });
      if (url.includes("/api/agents/a1/draft") && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        return Response.json({ data: { ...agents[0], draftSkillContent: body.skillContent } });
      }
      if (url.includes("/api/agents")) return Response.json({ data: agents });
      return Response.json({ data: [] });
    });

    render(<DevsAgentsWorkspace />);
    expect(await screen.findByText("Saved to database")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Agent prompt"), { target: { value: "# Research\nNew line" } });
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Saved to database")).toBeInTheDocument(), { timeout: 1200 });
  });

  it("expands editor textareas while focused", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/compartments")) return Response.json({ data: compartments });
      if (url.includes("/api/agents")) return Response.json({ data: agents });
      return Response.json({ data: [] });
    });

    render(<DevsAgentsWorkspace />);
    const prompt = await screen.findByLabelText("Agent prompt");

    fireEvent.focus(prompt);
    expect(prompt).toHaveClass("textarea-expanded");

    fireEvent.blur(prompt);
    expect(prompt).not.toHaveClass("textarea-expanded");
  });

  it("toggles the agent editor full screen mode", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/compartments")) return Response.json({ data: compartments });
      if (url.includes("/api/agents")) return Response.json({ data: agents });
      return Response.json({ data: [] });
    });

    render(<DevsAgentsWorkspace />);
    const expandButton = await screen.findByRole("button", { name: "Open full screen agent editor" });

    fireEvent.click(expandButton);
    expect(screen.getByLabelText("Exit full screen prompt editor")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Exit full screen prompt editor"));
    expect(screen.queryByLabelText("Exit full screen prompt editor")).not.toBeInTheDocument();
  });

  it("renders validation warnings as styled alerts", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/compartments")) return Response.json({ data: compartments });
      if (url.includes("/api/agents")) return Response.json({ data: [{ ...agents[0], draftProduces: [] }] });
      return Response.json({ data: [] });
    });

    render(<DevsAgentsWorkspace />);

    const warning = await screen.findByText("Add at least one Produces item before publishing.");
    expect(warning.closest(".validation-alert")).toHaveClass("validation-alert-error");
  });

  it("saves edited agent descriptions", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/compartments")) return Response.json({ data: compartments });
      if (url.includes("/api/agents/a1") && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        return Response.json({ data: { ...agents[0], description: body.description } });
      }
      if (url.includes("/api/agents")) return Response.json({ data: agents });
      return Response.json({ data: [] });
    });

    render(<DevsAgentsWorkspace />);
    const description = await screen.findByLabelText("Agent description");
    fireEvent.change(description, { target: { value: "Short research helper" } });
    fireEvent.blur(description);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/agents/a1",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
  });

  it("saves structured contract edits", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/compartments")) return Response.json({ data: compartments });
      if (url.includes("/api/agents/a1/draft") && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        return Response.json({
          data: {
            ...agents[0],
            draftNeeds: body.needs,
            draftProduces: body.produces,
            draftSkillContent: body.skillContent,
          },
        });
      }
      if (url.includes("/api/agents")) return Response.json({ data: agents });
      return Response.json({ data: [] });
    });

    render(<DevsAgentsWorkspace />);
    await screen.findByDisplayValue("# Research");
    fireEvent.click(screen.getByRole("button", { name: /Needs \/ Produces/i }));
    fireEvent.click(screen.getByRole("button", { name: "Add Needs" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/agents/a1/draft",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
  });

  it("copies a version into draft", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/compartments")) return Response.json({ data: compartments });
      if (url.includes("/api/agents/a1/versions")) {
        return Response.json({
          data: [{ id: "v1", versionNumber: 1, changeSummary: "Initial", isActive: true, createdAt: "2026-05-08" }],
        });
      }
      if (url.includes("/api/agents/a1/revert") && init?.method === "POST") {
        return Response.json({ data: { ...agents[0], draftSkillContent: "# Restored" } });
      }
      if (url.includes("/api/agents")) return Response.json({ data: agents });
      return Response.json({ data: [] });
    });

    render(<DevsAgentsWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: /History/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Copy to draft" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/agents/a1/revert",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("does not save the prompt on every keystroke", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/compartments")) return Response.json({ data: compartments });
      if (url.includes("/api/agents/a1/draft") && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        return Response.json({ data: { ...agents[0], draftSkillContent: body.skillContent } });
      }
      if (url.includes("/api/agents")) return Response.json({ data: agents });
      return Response.json({ data: [] });
    });

    render(<DevsAgentsWorkspace />);
    const prompt = await screen.findByLabelText("Agent prompt");
    fireEvent.change(prompt, { target: { value: "# Research\nA" } });
    fireEvent.change(prompt, { target: { value: "# Research\nAB" } });

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/agents/a1/draft",
      expect.objectContaining({ method: "PATCH" }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/agents/a1/draft",
        expect.objectContaining({ method: "PATCH" }),
      ),
      { timeout: 1200 },
    );
  });

  it("sends the selected assistant model with draft requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/models")) {
        return Response.json({
          data: [{ provider: "codex-cli", id: "gpt-5.5", label: "gpt-5.5 via Codex CLI" }],
        });
      }
      if (url.includes("/api/compartments")) return Response.json({ data: compartments });
      if (url.includes("/api/agent-draft-assistant") && init?.method === "POST") {
        return Response.json({
          data: {
            draftSkillContent: "# Suggested",
            needs: [],
            produces: [{ key: "final", label: "Final", role: "final_output" }],
            explanation: "Prepared",
          },
        });
      }
      if (url.includes("/api/agents")) return Response.json({ data: agents });
      return Response.json({ data: [] });
    });

    render(<DevsAgentsWorkspace />);
    fireEvent.change(await screen.findByPlaceholderText("Describe what this agent should do"), {
      target: { value: "Make this agent write summaries" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Suggest draft" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/agent-draft-assistant",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"model":"gpt-5.5"'),
        }),
      ),
    );
  });
});

"use client";

import { Bot, History, Plus, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getOutputLabelName, validateAgentDraft } from "@/lib/esai/agent-contracts";
import type {
  DevsAgent,
  DevsAgentVersion,
  DevsCompartment,
  DevsNeed,
  DevsProduces,
} from "@/types/esai";

type SideTab = "assistant" | "contracts" | "versions" | "template";

type ApiEnvelope<T> = {
  data?: T;
  error?: string;
  message?: string;
};

async function readData<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  const json = (await response.json()) as ApiEnvelope<T[]>;
  if (!response.ok) throw new Error(json.error ?? "Request failed.");
  return json.data ?? [];
}

export function DevsAgentsWorkspace() {
  const [compartments, setCompartments] = useState<DevsCompartment[]>([]);
  const [agents, setAgents] = useState<DevsAgent[]>([]);
  const [selectedCompartmentId, setSelectedCompartmentId] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [tab, setTab] = useState<SideTab>("assistant");
  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void readData<DevsCompartment>("/api/compartments")
      .then((items) => {
        setCompartments(items);
        setSelectedCompartmentId((current) => current || items[0]?.id || "");
      })
      .catch((error: Error) => setNotice(error.message));
  }, []);

  useEffect(() => {
    if (!selectedCompartmentId) return;

    void readData<DevsAgent>(`/api/agents?compartmentId=${selectedCompartmentId}`)
      .then((items) => {
        setAgents(items);
        setSelectedAgentId((current) =>
          items.some((agent) => agent.id === current) ? current : items[0]?.id || "",
        );
      })
      .catch((error: Error) => setNotice(error.message));
  }, [selectedCompartmentId]);

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null;
  const validation = useMemo(() => {
    if (!selectedAgent) return null;

    return validateAgentDraft({
      prompt: selectedAgent.draftSkillContent,
      needs: selectedAgent.draftNeeds,
      produces: selectedAgent.draftProduces,
      existingRolesInCompartment: agents.flatMap((agent) => [
        ...agent.draftProduces.map((produce) => produce.role),
        ...agent.publishedProduces.map((produce) => produce.role),
      ]),
    });
  }, [agents, selectedAgent]);

  async function createAgent() {
    if (!selectedCompartmentId || !newAgentName.trim()) return;

    const response = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compartmentId: selectedCompartmentId, name: newAgentName }),
    });
    const json = (await response.json()) as ApiEnvelope<DevsAgent>;

    if (!response.ok || !json.data) {
      setNotice(json.error ?? "Unable to create agent.");
      return;
    }

    setAgents((items) => [json.data as DevsAgent, ...items]);
    setSelectedAgentId(json.data.id);
    setNewAgentName("");
    setNewAgentOpen(false);
    setNotice("Custom agent saved as draft.");
  }

  async function saveDraft(
    patch: Partial<Pick<DevsAgent, "draftSkillContent" | "draftNeeds" | "draftProduces">>,
  ) {
    if (!selectedAgent) return;

    const nextAgent = { ...selectedAgent, ...patch };
    setAgents((items) => items.map((agent) => (agent.id === nextAgent.id ? nextAgent : agent)));

    const response = await fetch(`/api/agents/${selectedAgent.id}/draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skillContent: nextAgent.draftSkillContent,
        needs: nextAgent.draftNeeds,
        produces: nextAgent.draftProduces,
      }),
    });
    const json = (await response.json()) as ApiEnvelope<DevsAgent>;

    if (!response.ok || !json.data) {
      setNotice(json.error ?? "Unable to save draft.");
      return;
    }

    setAgents((items) => items.map((agent) => (agent.id === json.data?.id ? json.data : agent)));
    setNotice("Draft saved.");
  }

  async function publishAgent() {
    if (!selectedAgent) return;

    const response = await fetch(`/api/agents/${selectedAgent.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeSummary: "Published from Devs editor" }),
    });
    const json = (await response.json()) as ApiEnvelope<DevsAgent>;

    if (!response.ok || !json.data) {
      setNotice(json.error ?? "Unable to publish draft.");
      return;
    }

    setAgents((items) => items.map((agent) => (agent.id === json.data?.id ? json.data : agent)));
    setNotice("Published version is now active.");
  }

  return (
    <section className="devs-agents">
      <div className="devs-agent-toolbar">
        <select
          aria-label="Compartment"
          value={selectedCompartmentId}
          onChange={(event) => setSelectedCompartmentId(event.target.value)}
        >
          {compartments.map((compartment) => (
            <option key={compartment.id} value={compartment.id}>
              {compartment.name}
            </option>
          ))}
        </select>
        <button className="btn-secondary" type="button">
          <Plus size={15} />
          Compartment
        </button>
        <button className="btn-primary" type="button" onClick={() => setNewAgentOpen(true)}>
          <Plus size={15} />
          New Agent
        </button>
      </div>

      {newAgentOpen ? (
        <div className="agent-create-row">
          <input
            placeholder="Agent name"
            value={newAgentName}
            onChange={(event) => setNewAgentName(event.target.value)}
          />
          <button className="btn-primary" type="button" onClick={createAgent}>
            Create agent
          </button>
        </div>
      ) : null}

      {notice ? <p className="form-note">{notice}</p> : null}

      <div className="devs-agent-grid">
        <aside className="devs-agent-list" aria-label="Agents">
          {agents.length === 0 ? <p className="form-note">No agents in this compartment yet.</p> : null}
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className={agent.id === selectedAgent?.id ? "active" : ""}
              onClick={() => setSelectedAgentId(agent.id)}
            >
              <Bot size={17} />
              <span>
                <strong>{agent.name}</strong>
                <small>{agent.description || "No description yet"}</small>
              </span>
              <em>{agent.kind === "template_copy" ? "Template copy" : "Custom"}</em>
            </button>
          ))}
        </aside>

        <main className="devs-agent-editor">
          {selectedAgent ? (
            <>
              <header>
                <div>
                  <h2>{selectedAgent.name}</h2>
                  <p>{selectedAgent.kind === "template_copy" ? "Template copy" : "Custom agent"}</p>
                </div>
                <button className="btn-primary" type="button" onClick={publishAgent}>
                  Publish version
                </button>
              </header>
              <textarea
                aria-label="Agent prompt"
                value={selectedAgent.draftSkillContent}
                onChange={(event) => void saveDraft({ draftSkillContent: event.target.value })}
              />
              {validation?.blocking.map((item) => (
                <p className="form-warning" key={item}>
                  {item}
                </p>
              ))}
              {validation?.warnings.map((item) => (
                <p className="form-note" key={item}>
                  {item}
                </p>
              ))}
            </>
          ) : (
            <p className="form-note">Select or create an agent.</p>
          )}
        </main>

        <aside className="devs-agent-side">
          <div className="side-tabs">
            <button
              className={tab === "assistant" ? "active" : ""}
              type="button"
              onClick={() => setTab("assistant")}
            >
              <Sparkles size={14} />
              Assistant
            </button>
            <button
              className={tab === "contracts" ? "active" : ""}
              type="button"
              onClick={() => setTab("contracts")}
            >
              Needs / Produces
            </button>
            <button
              className={tab === "versions" ? "active" : ""}
              type="button"
              onClick={() => setTab("versions")}
            >
              <History size={14} />
              Versions
            </button>
            <button
              className={tab === "template" ? "active" : ""}
              type="button"
              onClick={() => setTab("template")}
            >
              <RotateCcw size={14} />
              Template
            </button>
          </div>
          {selectedAgent && tab === "assistant" ? (
            <AssistantDraftPanel agent={selectedAgent} onApply={saveDraft} onNotice={setNotice} />
          ) : null}
          {selectedAgent && tab === "contracts" ? (
            <ContractsPanel agent={selectedAgent} onSave={saveDraft} />
          ) : null}
          {selectedAgent && tab === "versions" ? <VersionsPanel agentId={selectedAgent.id} /> : null}
          {selectedAgent && tab === "template" ? (
            <p className="form-note">{selectedAgent.templateSourcePath || "This is a custom agent."}</p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function ContractsPanel({
  agent,
  onSave,
}: {
  agent: DevsAgent;
  onSave: (patch: Partial<Pick<DevsAgent, "draftNeeds" | "draftProduces">>) => Promise<void>;
}) {
  function addProduces() {
    const next: DevsProduces = {
      key: "new_output",
      label: "New output",
      role: "final_output",
      defaultFilename: "new_output.md",
    };
    void onSave({ draftProduces: [...agent.draftProduces, next] });
  }

  return (
    <div className="contracts-panel">
      <h3>Needs</h3>
      {agent.draftNeeds.length === 0 ? <p className="form-note">No required inputs yet.</p> : null}
      {agent.draftNeeds.map((need: DevsNeed) => (
        <p key={need.key}>
          {need.label}: accepts {need.acceptedRoles.map(getOutputLabelName).join(", ") || "nothing yet"}
        </p>
      ))}
      <h3>Produces</h3>
      {agent.draftProduces.map((produce) => (
        <p key={produce.key}>
          {produce.label}: {getOutputLabelName(produce.role)}
        </p>
      ))}
      <button className="btn-secondary" type="button" onClick={addProduces}>
        Add Produces
      </button>
    </div>
  );
}

function AssistantDraftPanel({
  agent,
  onApply,
  onNotice,
}: {
  agent: DevsAgent;
  onApply: (
    patch: Partial<Pick<DevsAgent, "draftSkillContent" | "draftNeeds" | "draftProduces">>,
  ) => Promise<void>;
  onNotice: (message: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [proposal, setProposal] = useState<null | {
    draftSkillContent: string;
    needs: DevsNeed[];
    produces: DevsProduces[];
    explanation: string;
  }>(null);

  async function askAssistant() {
    const response = await fetch("/api/agent-draft-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName: agent.name, message }),
    });
    const json = (await response.json()) as ApiEnvelope<{
      draftSkillContent: string;
      needs: DevsNeed[];
      produces: DevsProduces[];
      explanation: string;
    }>;

    if (!response.ok || !json.data) {
      onNotice(json.error ?? json.message ?? "Assistant could not prepare a draft.");
      return;
    }

    setProposal(json.data);
  }

  return (
    <div className="assistant-draft-panel">
      <textarea
        placeholder="Describe what this agent should do"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
      <button className="btn-secondary" type="button" onClick={askAssistant}>
        Suggest draft
      </button>
      {proposal ? (
        <div className="assistant-proposal">
          <p>{proposal.explanation}</p>
          <button
            className="btn-primary"
            type="button"
            onClick={() =>
              void onApply({
                draftSkillContent: proposal.draftSkillContent,
                draftNeeds: proposal.needs,
                draftProduces: proposal.produces,
              })
            }
          >
            Apply to draft
          </button>
        </div>
      ) : null}
    </div>
  );
}

function VersionsPanel({ agentId }: { agentId: string }) {
  const [versions, setVersions] = useState<DevsAgentVersion[]>([]);

  useEffect(() => {
    void readData<DevsAgentVersion>(`/api/agents/${agentId}/versions`).then(setVersions);
  }, [agentId]);

  return (
    <div className="versions-list">
      {versions.length === 0 ? <p className="form-note">No published versions yet.</p> : null}
      {versions.map((version) => (
        <button className={version.isActive ? "active" : ""} key={version.id} type="button">
          Version {version.versionNumber}
          <small>{version.changeSummary || "No summary"}</small>
        </button>
      ))}
    </div>
  );
}

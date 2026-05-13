"use client";

import { Bot, History, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { type FocusEvent, type TextareaHTMLAttributes, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CONTROLLED_OUTPUT_LABELS,
  createSafeContractKey,
  getOutputLabelName,
  validateAgentDraft,
} from "@/lib/esai/agent-contracts";
import type {
  ArtifactIncludeMode,
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

type AssistantModel = {
  provider: string;
  id: string;
  label: string;
};

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

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
  const [newCompartmentOpen, setNewCompartmentOpen] = useState(false);
  const [newCompartmentName, setNewCompartmentName] = useState("");
  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [promptDraft, setPromptDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
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
        setSelectedAgentId((current) => {
          const nextId = items.some((agent) => agent.id === current) ? current : items[0]?.id || "";
          const nextAgent = items.find((agent) => agent.id === nextId);
          setPromptDraft(nextAgent?.draftSkillContent ?? "");
          setDescriptionDraft(nextAgent?.description ?? "");
          setSaveStatus(nextAgent ? "saved" : "idle");
          return nextId;
        });
      })
      .catch((error: Error) => setNotice(error.message));
  }, [selectedCompartmentId]);

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null;

  const saveDraft = useCallback(
    async (patch: Partial<Pick<DevsAgent, "draftSkillContent" | "draftNeeds" | "draftProduces">>) => {
      if (!selectedAgent) return;

      const nextAgent = { ...selectedAgent, ...patch };
      setAgents((items) => items.map((agent) => (agent.id === nextAgent.id ? nextAgent : agent)));
      setSaveStatus("saving");

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
        setSaveStatus("error");
        return;
      }

      setAgents((items) => items.map((agent) => (agent.id === json.data?.id ? json.data : agent)));
      setSaveStatus("saved");
      setNotice("Draft saved.");
    },
    [selectedAgent],
  );

  useEffect(() => {
    if (!selectedAgent || promptDraft === selectedAgent.draftSkillContent) return;

    const timeout = window.setTimeout(() => {
      void saveDraft({ draftSkillContent: promptDraft });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [promptDraft, saveDraft, selectedAgent]);

  const validation = useMemo(() => {
    if (!selectedAgent) return null;

    return validateAgentDraft({
      prompt: promptDraft,
      needs: selectedAgent.draftNeeds,
      produces: selectedAgent.draftProduces,
      existingRolesInCompartment: agents.flatMap((agent) => [
        ...agent.draftProduces.map((produce) => produce.role),
        ...agent.publishedProduces.map((produce) => produce.role),
      ]),
    });
  }, [agents, promptDraft, selectedAgent]);

  async function createCompartment() {
    if (!newCompartmentName.trim()) return;

    const response = await fetch("/api/compartments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCompartmentName }),
    });
    const json = (await response.json()) as ApiEnvelope<DevsCompartment>;

    if (!response.ok || !json.data) {
      setNotice(json.error ?? "Unable to create compartment.");
      return;
    }

    setCompartments((items) => [...items, json.data as DevsCompartment]);
    setSelectedCompartmentId(json.data.id);
    setSelectedAgentId("");
    setNewCompartmentName("");
    setNewCompartmentOpen(false);
    setNotice("Compartment created.");
  }

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
    setPromptDraft(json.data.draftSkillContent);
    setDescriptionDraft(json.data.description);
    setSaveStatus("saved");
    setNewAgentName("");
    setNewAgentOpen(false);
    setNotice("Custom agent saved as draft.");
  }

  async function publishAgent() {
    if (!selectedAgent) return;
    setPublishConfirmOpen(false);

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

  async function saveDescription() {
    if (!selectedAgent || descriptionDraft.trim() === selectedAgent.description.trim()) return;
    setSaveStatus("saving");

    const response = await fetch(`/api/agents/${selectedAgent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: descriptionDraft }),
    });
    const json = (await response.json()) as ApiEnvelope<DevsAgent>;

    if (!response.ok || !json.data) {
      setNotice(json.error ?? "Unable to save description.");
      setSaveStatus("error");
      return;
    }

    setAgents((items) => items.map((agent) => (agent.id === json.data?.id ? json.data : agent)));
    setDescriptionDraft(json.data.description);
    setSaveStatus("saved");
    setNotice("Description saved.");
  }

  async function revertAgent(source: "template" | "version", versionId?: string) {
    if (!selectedAgent) return;

    const response = await fetch(`/api/agents/${selectedAgent.id}/revert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(source === "template" ? { source } : { source, versionId }),
    });
    const json = (await response.json()) as ApiEnvelope<DevsAgent>;

    if (!response.ok || !json.data) {
      setNotice(json.error ?? "Unable to copy into draft.");
      return;
    }

    setAgents((items) => items.map((agent) => (agent.id === json.data?.id ? json.data : agent)));
    setNotice(source === "template" ? "Template copied into draft." : "Version copied into draft.");
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
        <button className="btn-secondary" type="button" onClick={() => setNewCompartmentOpen(true)}>
          <Plus size={15} />
          Compartment
        </button>
        <button className="btn-primary" type="button" onClick={() => setNewAgentOpen(true)}>
          <Plus size={15} />
          New Agent
        </button>
      </div>

      {newCompartmentOpen ? (
        <div className="agent-create-row">
          <input
            placeholder="Compartment name"
            value={newCompartmentName}
            onChange={(event) => setNewCompartmentName(event.target.value)}
          />
          <button className="btn-primary" type="button" onClick={createCompartment}>
            Create compartment
          </button>
          <button className="btn-secondary" type="button" onClick={() => setNewCompartmentOpen(false)}>
            Cancel
          </button>
        </div>
      ) : null}

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
        <header className="devs-agent-stage-header">
          <div>
            <small>Editable Agent Draft</small>
            <strong>{selectedAgent?.name ?? "Select an agent"}</strong>
          </div>
          <div className="devs-agent-stage-actions">
            <button
              className={tab === "assistant" ? "reference-text-button active" : "reference-text-button"}
              type="button"
              onClick={() => setTab("assistant")}
            >
              Assistant
            </button>
            <button
              className={tab === "contracts" ? "reference-text-button active" : "reference-text-button"}
              type="button"
              onClick={() => setTab("contracts")}
            >
              Needs / Produces
            </button>
            <button
              className={tab === "versions" ? "reference-text-button active" : "reference-text-button"}
              type="button"
              onClick={() => setTab("versions")}
            >
              History
            </button>
            <button
              className={tab === "template" ? "reference-text-button active" : "reference-text-button"}
              type="button"
              onClick={() => setTab("template")}
            >
              Template
            </button>
            <SaveStatusBadge status={saveStatus} />
            {selectedAgent ? (
              <button className="btn-primary reference-small-button" type="button" onClick={() => setPublishConfirmOpen(true)}>
                Publish
              </button>
            ) : null}
          </div>
        </header>

        <div className="devs-agent-stage-body">
        <aside className="devs-agent-list" aria-label="Agents">
          {agents.length === 0 ? <p className="form-note">No agents in this compartment yet.</p> : null}
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className={agent.id === selectedAgent?.id ? "active" : ""}
              onClick={() => {
                setSelectedAgentId(agent.id);
                setPromptDraft(agent.draftSkillContent);
                setDescriptionDraft(agent.description);
                setPublishConfirmOpen(false);
                setSaveStatus("saved");
              }}
            >
              <Bot size={17} />
              <span>
                <strong>{agent.name}</strong>
                <small title={agent.description || "No description yet"}>
                  {agent.description || "No description yet"}
                </small>
              </span>
              <em>{agent.kind === "template_copy" ? "Template copy" : "Custom"}</em>
            </button>
          ))}
        </aside>

        <main className="devs-agent-editor">
          {selectedAgent ? (
            <>
              <div className="devs-agent-document-toolbar">
                <span>Agent Vault / {selectedAgent.name}</span>
                <em>{selectedAgent.kind === "template_copy" ? "Template copy" : "Custom agent"}</em>
              </div>
              <article className="devs-agent-document-page">
                <h2>{selectedAgent.name}</h2>
                <label className="agent-description-field">
                  Agent description
                  <AutoGrowTextarea
                    value={descriptionDraft}
                    placeholder="Short purpose shown in the agent list"
                    onBlur={saveDescription}
                    onChange={(event) => {
                      setDescriptionDraft(event.target.value);
                      setSaveStatus("dirty");
                    }}
                  />
                </label>
                <label className="agent-prompt-field">
                  Agent prompt
                  <AutoGrowTextarea
                    className="agent-prompt-textarea"
                    aria-label="Agent prompt"
                    value={promptDraft}
                    onChange={(event) => {
                      setPromptDraft(event.target.value);
                      setSaveStatus("dirty");
                    }}
                  />
                </label>
                <ValidationMessages blocking={validation?.blocking ?? []} warnings={validation?.warnings ?? []} />
              </article>
            </>
          ) : (
            <p className="form-note">Select or create an agent.</p>
          )}
        </main>

        <aside className="devs-agent-side">
          <header className="devs-agent-side-header">
            {tab === "assistant" ? <Sparkles size={16} /> : null}
            {tab === "versions" ? <History size={16} /> : null}
            {tab === "template" ? <RotateCcw size={16} /> : null}
            <strong>{tab === "contracts" ? "Needs / Produces" : tab === "versions" ? "History" : tab === "template" ? "Template" : "Assistant"}</strong>
          </header>
          {selectedAgent && tab === "assistant" ? (
            <AssistantDraftPanel
              agent={selectedAgent}
              onApply={async (patch) => {
                if (typeof patch.draftSkillContent === "string") {
                  setPromptDraft(patch.draftSkillContent);
                }
                await saveDraft(patch);
              }}
              onNotice={setNotice}
            />
          ) : null}
          {selectedAgent && tab === "contracts" ? (
            <ContractsPanel agent={selectedAgent} onSave={saveDraft} />
          ) : null}
          {selectedAgent && tab === "versions" ? (
            <VersionsPanel agentId={selectedAgent.id} onRevert={(versionId) => revertAgent("version", versionId)} />
          ) : null}
          {selectedAgent && tab === "template" ? (
            <TemplatePanel agent={selectedAgent} onRevert={() => revertAgent("template")} />
          ) : null}
        </aside>
        </div>
      </div>
      {publishConfirmOpen && selectedAgent ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setPublishConfirmOpen(false)}>
          <div
            className="small-modal publish-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="publish-confirm-title">Publish agent version?</h2>
              <button className="ghost-icon" type="button" onClick={() => setPublishConfirmOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <p>
              This will make the current draft active for <strong>{selectedAgent.name}</strong>. Version history will keep
              the previous published copy.
            </p>
            <div className="modal-actions">
              <button className="btn-ghost" type="button" onClick={() => setPublishConfirmOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" type="button" onClick={publishAgent}>
                Confirm publish
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AutoGrowTextarea({
  className,
  onFocus,
  onBlur,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  const resize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || !expanded) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [expanded]);

  useEffect(() => {
    resize();
  }, [props.value, resize]);

  function handleFocus(event: FocusEvent<HTMLTextAreaElement>) {
    setExpanded(true);
    window.requestAnimationFrame(resize);
    onFocus?.(event);
  }

  function handleBlur(event: FocusEvent<HTMLTextAreaElement>) {
    setExpanded(false);
    event.currentTarget.style.height = "";
    onBlur?.(event);
  }

  return (
    <textarea
      {...props}
      ref={textareaRef}
      className={[className, expanded ? "textarea-expanded" : ""].filter(Boolean).join(" ")}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}

function ValidationMessages({ blocking, warnings }: { blocking: string[]; warnings: string[] }) {
  if (blocking.length === 0 && warnings.length === 0) return null;

  return (
    <div className="validation-stack" aria-live="polite">
      {blocking.map((item, index) => (
        <div className="validation-alert validation-alert-error" key={`blocking-${index}-${item}`}>
          <strong>Needs attention</strong>
          <span>{item}</span>
        </div>
      ))}
      {warnings.map((item, index) => (
        <div className="validation-alert validation-alert-warning" key={`warning-${index}-${item}`}>
          <strong>Check setup</strong>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function ContractsPanel({
  agent,
  onSave,
}: {
  agent: DevsAgent;
  onSave: (patch: Partial<Pick<DevsAgent, "draftNeeds" | "draftProduces">>) => Promise<void>;
}) {
  function addNeed() {
    const key = createUniqueContractKey("new_input", agent.draftNeeds);
    const next: DevsNeed = {
      key,
      label: "New input",
      acceptedRoles: [],
      required: true,
      includeMode: "summary",
    };
    void onSave({ draftNeeds: [...agent.draftNeeds, next] });
  }

  function updateNeed(index: number, patch: Partial<DevsNeed>) {
    const next = agent.draftNeeds.map((need, itemIndex) =>
      itemIndex === index ? { ...need, ...patch } : need,
    );
    void onSave({ draftNeeds: next });
  }

  function removeNeed(index: number) {
    void onSave({ draftNeeds: agent.draftNeeds.filter((_, itemIndex) => itemIndex !== index) });
  }

  function addProduces() {
    const key = createUniqueContractKey("new_output", agent.draftProduces);
    const next: DevsProduces = {
      key,
      label: "New output",
      role: "final_output",
      defaultFilename: `${key}.md`,
    };
    void onSave({ draftProduces: [...agent.draftProduces, next] });
  }

  function updateProduces(index: number, patch: Partial<DevsProduces>) {
    const next = agent.draftProduces.map((produce, itemIndex) =>
      itemIndex === index ? { ...produce, ...patch } : produce,
    );
    void onSave({ draftProduces: next });
  }

  function removeProduces(index: number) {
    void onSave({ draftProduces: agent.draftProduces.filter((_, itemIndex) => itemIndex !== index) });
  }

  return (
    <div className="contracts-panel">
      <h3>Needs</h3>
      {agent.draftNeeds.length === 0 ? <p className="form-note">No required inputs yet.</p> : null}
      {agent.draftNeeds.map((need: DevsNeed, index) => (
        <NeedEditor
          key={`${need.key}-${index}`}
          need={need}
          onChange={(patch) => updateNeed(index, patch)}
          onRemove={() => removeNeed(index)}
        />
      ))}
      <button className="btn-secondary" type="button" onClick={addNeed}>
        Add Needs
      </button>
      <h3>Produces</h3>
      {agent.draftProduces.map((produce, index) => (
        <ProducesEditor
          key={`${produce.key}-${index}`}
          produce={produce}
          onChange={(patch) => updateProduces(index, patch)}
          onRemove={() => removeProduces(index)}
        />
      ))}
      <button className="btn-secondary" type="button" onClick={addProduces}>
        Add Produces
      </button>
    </div>
  );
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  const label =
    status === "dirty"
      ? "Unsaved changes"
      : status === "saving"
        ? "Saving to database"
        : status === "saved"
          ? "Saved to database"
          : status === "error"
            ? "Database save failed"
            : "Database status";

  return (
    <span className={`save-status save-status-${status}`} aria-live="polite">
      {label}
    </span>
  );
}

function createUniqueContractKey(baseKey: string, items: Array<{ key: string }>) {
  const keys = new Set(items.map((item) => item.key));
  if (!keys.has(baseKey)) return baseKey;

  let index = 2;
  while (keys.has(`${baseKey}_${index}`)) {
    index += 1;
  }
  return `${baseKey}_${index}`;
}

function NeedEditor({
  need,
  onChange,
  onRemove,
}: {
  need: DevsNeed;
  onChange: (patch: Partial<DevsNeed>) => void;
  onRemove: () => void;
}) {
  const customLabels = need.acceptedRoles
    .filter((role) => !CONTROLLED_OUTPUT_LABELS.includes(role as (typeof CONTROLLED_OUTPUT_LABELS)[number]))
    .join(", ");

  function setControlledRole(role: string, checked: boolean) {
    const nextRoles = checked
      ? [...need.acceptedRoles, role]
      : need.acceptedRoles.filter((item) => item !== role);
    onChange({ acceptedRoles: Array.from(new Set(nextRoles)) });
  }

  function setCustomLabels(value: string) {
    const controlled = need.acceptedRoles.filter((role) =>
      CONTROLLED_OUTPUT_LABELS.includes(role as (typeof CONTROLLED_OUTPUT_LABELS)[number]),
    );
    const custom = value
      .split(",")
      .map((item) => createSafeContractKey(item))
      .filter(Boolean);
    onChange({ acceptedRoles: Array.from(new Set([...controlled, ...custom])) });
  }

  return (
    <div className="contract-editor">
      <label>
        Need name
        <input
          value={need.label}
          onChange={(event) =>
            onChange({ label: event.target.value, key: createSafeContractKey(event.target.value) })
          }
        />
      </label>
      <label>
        Stable key
        <input value={need.key} onChange={(event) => onChange({ key: event.target.value })} />
      </label>
      <label>
        Include as
        <select
          value={need.includeMode}
          onChange={(event) => onChange({ includeMode: event.target.value as ArtifactIncludeMode })}
        >
          <option value="summary">Summary</option>
          <option value="full">Full file</option>
          <option value="metadata">Metadata only</option>
        </select>
      </label>
      <label className="contract-check">
        <input
          type="checkbox"
          checked={need.required}
          onChange={(event) => onChange({ required: event.target.checked })}
        />
        Required before this agent can run
      </label>
      <fieldset>
        <legend>Accepts outputs labeled</legend>
        {CONTROLLED_OUTPUT_LABELS.map((role) => (
          <label className="contract-check" key={role}>
            <input
              type="checkbox"
              checked={need.acceptedRoles.includes(role)}
              onChange={(event) => setControlledRole(role, event.target.checked)}
            />
            {getOutputLabelName(role)}
          </label>
        ))}
      </fieldset>
      <label>
        Custom labels
        <input
          placeholder="comma separated"
          value={customLabels}
          onChange={(event) => setCustomLabels(event.target.value)}
        />
      </label>
      <button className="btn-secondary" type="button" onClick={onRemove}>
        Remove Need
      </button>
    </div>
  );
}

function ProducesEditor({
  produce,
  onChange,
  onRemove,
}: {
  produce: DevsProduces;
  onChange: (patch: Partial<DevsProduces>) => void;
  onRemove: () => void;
}) {
  const isControlledRole = CONTROLLED_OUTPUT_LABELS.includes(
    produce.role as (typeof CONTROLLED_OUTPUT_LABELS)[number],
  );

  return (
    <div className="contract-editor">
      <label>
        Output name
        <input
          value={produce.label}
          onChange={(event) =>
            onChange({ label: event.target.value, key: createSafeContractKey(event.target.value) })
          }
        />
      </label>
      <label>
        Stable key
        <input value={produce.key} onChange={(event) => onChange({ key: event.target.value })} />
      </label>
      <label>
        Output label
        <select
          value={isControlledRole ? produce.role : "custom"}
          onChange={(event) =>
            onChange({ role: event.target.value === "custom" ? "custom_output" : event.target.value })
          }
        >
          {CONTROLLED_OUTPUT_LABELS.map((role) => (
            <option key={role} value={role}>
              {getOutputLabelName(role)}
            </option>
          ))}
          <option value="custom">Custom label</option>
        </select>
      </label>
      {!isControlledRole ? (
        <label>
          Custom output label
          <input value={produce.role} onChange={(event) => onChange({ role: createSafeContractKey(event.target.value) })} />
        </label>
      ) : null}
      <label>
        Suggested filename
        <input
          value={produce.defaultFilename ?? ""}
          onChange={(event) => onChange({ defaultFilename: event.target.value })}
        />
      </label>
      <button className="btn-secondary" type="button" onClick={onRemove}>
        Remove Produces
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
  const [models, setModels] = useState<AssistantModel[]>([]);
  const [model, setModel] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("medium");
  const [proposal, setProposal] = useState<null | {
    draftSkillContent: string;
    needs: DevsNeed[];
    produces: DevsProduces[];
    explanation: string;
  }>(null);

  useEffect(() => {
    void readData<AssistantModel>("/api/models")
      .then((items) => {
        setModels(items);
        setModel((current) => current || items[0]?.id || "");
      })
      .catch((error: Error) => onNotice(error.message));
  }, [onNotice]);

  async function askAssistant() {
    if (!model) {
      onNotice("Choose a model first.");
      return;
    }

    const response = await fetch("/api/agent-draft-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName: agent.name, message, model, reasoningEffort }),
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
      <div className="assistant-model-controls">
        <select aria-label="Assistant model" value={model} onChange={(event) => setModel(event.target.value)}>
          <option value="">Select model</option>
          {models.map((item) => (
            <option key={`${item.provider}-${item.id}`} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Assistant reasoning"
          value={reasoningEffort}
          onChange={(event) => setReasoningEffort(event.target.value)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="xhigh">Extra High</option>
        </select>
      </div>
      <textarea
        placeholder="Describe what this agent should do"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
      <button className="btn-secondary" type="button" onClick={askAssistant} disabled={!model}>
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

function VersionsPanel({ agentId, onRevert }: { agentId: string; onRevert: (versionId: string) => void }) {
  const [versions, setVersions] = useState<DevsAgentVersion[]>([]);

  useEffect(() => {
    void readData<DevsAgentVersion>(`/api/agents/${agentId}/versions`).then(setVersions);
  }, [agentId]);

  return (
    <div className="versions-list">
      {versions.length === 0 ? <p className="form-note">No published versions yet.</p> : null}
      {versions.map((version) => (
        <div className={version.isActive ? "active" : ""} key={version.id}>
          <strong>Version {version.versionNumber}</strong>
          <small>{version.changeSummary || "No summary"}</small>
          <button className="btn-secondary" type="button" onClick={() => onRevert(version.id)}>
            Copy to draft
          </button>
        </div>
      ))}
    </div>
  );
}

function TemplatePanel({ agent, onRevert }: { agent: DevsAgent; onRevert: () => void }) {
  if (!agent.templateSourcePath) {
    return <p className="form-note">This is a custom agent, so there is no built-in template to restore.</p>;
  }

  return (
    <div className="template-panel">
      <p className="form-note">{agent.templateSourcePath}</p>
      <button className="btn-secondary" type="button" onClick={onRevert}>
        Copy built-in template to draft
      </button>
    </div>
  );
}

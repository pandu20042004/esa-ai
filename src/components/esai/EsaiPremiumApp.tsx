"use client";

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/purity */

import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bot,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Download,
  FileCheck,
  FileText,
  Globe,
  KeyRound,
  LayoutDashboard,
  Lock,
  Maximize2,
  MessageCircle,
  Minimize2,
  Monitor,
  Moon,
  MoreHorizontal,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Terminal,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { ApiError, fetchCompetitions, fetchCompetitionFiles, fetchFiles, createCompetition, updateCompetition, deleteCompetition, replaceCompetitionAssets, uploadAssetMakerImage, saveInstagramCaption, deleteFile, getFileSignedUrl } from "@/lib/esai/api";
import { extractAgentChoiceFromMessage, isAgentChoice, type AgentChoice, type AgentChoiceOption } from "@/lib/esai/agent-choice";
import { selectInitialCompetition } from "@/lib/esai/competition-selection";
import { isCompetitionUploadComplete } from "@/lib/esai/competition-upload";
import { STAGES } from "@/lib/esai/stages";
import { getRunIdFromMessageContext, getThreadMessageActions } from "@/lib/esai/thread-actions";
import { isModelSelectionReady } from "@/lib/esai/workflow";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { CalendarCategory, Competition, CompetitionFile, StageId } from "@/types/esai";
import { DevsAgentsWorkspace } from "./DevsAgentsWorkspace";
import {
  buildModelPickerValue,
  getReasoningEffortsForModel,
  getSelectedModelOption,
  isSelectedModelReady,
  parseModelPickerValue,
  useModelOptions,
  type ModelOption,
} from "./useModelOptions";

type Screen = "dashboard" | "calendar" | "workbench" | "validity" | "outputs" | "devs" | "profile";
type ReasoningEffort = "low" | "medium" | "high" | "xhigh";
type SearchMode = "fast" | "balanced" | "deep";

const REASONING_LABELS: Record<ReasoningEffort, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
};

const SEARCH_MODE_META: Record<SearchMode, { label: string; description: string }> = {
  fast: {
    label: "Fast",
    description: "Quick ideas with fewer searches and lower cost.",
  },
  balanced: {
    label: "Balanced",
    description: "Default. Solid evidence with controlled cost.",
  },
  deep: {
    label: "Deep",
    description: "Slower final-work mode with more source checks.",
  },
};

function getActiveReasoningEffort(models: ModelOption[], selectedModel: string, current: ReasoningEffort): ReasoningEffort {
  const efforts = getReasoningEffortsForModel(models, selectedModel) as ReasoningEffort[];
  if (efforts.length === 0) return "medium";
  if (efforts.includes(current)) return current;
  const defaultEffort = getSelectedModelOption(models, selectedModel)?.defaultReasoningEffort as ReasoningEffort | undefined;
  return defaultEffort && efforts.includes(defaultEffort) ? defaultEffort : efforts[0];
}

function formatChatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function groupFilesByCompetition(files: CompetitionFile[], competitions: Competition[]): Record<string, CompetitionFile[]> {
  const grouped: Record<string, CompetitionFile[]> = {};
  for (const competition of competitions) grouped[competition.id] = [];
  for (const file of files) {
    if (!file.competitionId) continue;
    grouped[file.competitionId] = [...(grouped[file.competitionId] ?? []), file];
  }
  return grouped;
}

const categories: Array<CalendarCategory | "All"> = ["All", "Deadline", "Stage", "Asset", "Review", "Personal"];
const tags = ["All", "urgent", "guidebook", "writing", "asset", "team", "personal"];

function getStoredValue(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

export function EsaiPremiumApp() {
  const [activeScreen, setActiveScreen] = useState<Screen>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => getStoredValue("esai-theme", "light") === "dark");
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [competitionFilesCache, setCompetitionFilesCache] = useState<Record<string, CompetitionFile[]>>({});

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    window.localStorage.setItem("esai-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, files] = await Promise.all([fetchCompetitions(), fetchFiles()]);
        if (cancelled) return;
        setCompetitions(list);
        setCompetitionFilesCache(groupFilesByCompetition(files, list));
        setSelectedCompetition(selectInitialCompetition(list, window.localStorage.getItem("esai-selected-competition-id")));
      } catch (error) {
        const err = error as ApiError | Error;
        const correlationId = (err as ApiError).correlationId ?? "";
        const msg = encodeURIComponent(err.message ?? "Failed to load dashboard");
        const cid = encodeURIComponent(correlationId);
        window.location.href = `/error-page?source=dashboard&message=${msg}&correlationId=${cid}&returnTo=${encodeURIComponent("/")}`;
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openScreen = (screen: Screen) => {
    setActiveScreen(screen);
    if (screen === "workbench" && !selectedCompetition) {
      const competition = selectInitialCompetition(competitions, window.localStorage.getItem("esai-selected-competition-id"));
      setSelectedCompetition(competition);
      if (competition) window.localStorage.setItem("esai-selected-competition-id", competition.id);
    }
  };

  const selectCompetition = (competition: Competition) => {
    setSelectedCompetition(competition);
    window.localStorage.setItem("esai-selected-competition-id", competition.id);
  };

  const rememberCompetitionFiles = useCallback((competitionId: string, list: CompetitionFile[]) => {
    setCompetitionFilesCache((cache) => ({ ...cache, [competitionId]: list }));
  }, []);

  return (
    <div className="esai-app">
      <Sidebar
        activeScreen={activeScreen}
        collapsed={sidebarCollapsed}
        assistantOpen={assistantOpen}
        onToggleAssistant={() => setAssistantOpen((value) => !value)}
        onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
        onOpenScreen={openScreen}
      />

      <div className={`content-shell ${sidebarCollapsed ? "collapsed" : ""}`}>
        <main className={`main-surface ${assistantOpen && activeScreen !== "workbench" && activeScreen !== "validity" ? "with-assistant" : ""}`}>
          {activeScreen === "dashboard" && (
            dataLoading ? (
              <section className="screen dashboard-screen"><p style={{ padding: 32, color: "#5f6b7a" }}>Loading…</p></section>
            ) : (
              <DashboardScreen
                competitions={competitions}
                onAdd={() => setShowWizard(true)}
                onSelect={(competition) => {
                  selectCompetition(competition);
                  setActiveScreen("workbench");
                }}
          onDelete={async (id) => {
            await deleteCompetition(id);
            setCompetitions((items) => items.filter((c) => c.id !== id));
            setCompetitionFilesCache((cache) => {
              const next = { ...cache };
              delete next[id];
              return next;
            });
          }}
                onEdit={(competition) => {
                  selectCompetition(competition);
                  setOverviewOpen(true);
                }}
              />
            )
          )}
          {activeScreen === "calendar" && <CalendarScreen />}
          {activeScreen === "workbench" && selectedCompetition && (
            <Workbench
              competition={selectedCompetition}
              assistantOpen={assistantOpen}
              darkMode={darkMode}
              onBack={() => setOverviewOpen(true)}
              onToggleAssistant={() => setAssistantOpen((value) => !value)}
              onToggleTheme={() => setDarkMode((value) => !value)}
            />
          )}
          {activeScreen === "validity" && <ValidityChecker assistantOpen={assistantOpen} onToggleAssistant={() => setAssistantOpen((value) => !value)} />}
          {activeScreen === "outputs" && <FinalOutputs competitions={competitions} />}
          {activeScreen === "devs" && <DevsScreen />}
          {activeScreen === "profile" && <AnalyticalBoard darkMode={darkMode} onToggleTheme={() => setDarkMode((value) => !value)} />}
        </main>

        {assistantOpen && activeScreen !== "workbench" && activeScreen !== "validity" ? (
          <aside className="page-assistant">
            <AssistantPanel context={`Current screen: ${activeScreen}. Competition: ${selectedCompetition?.title ?? "none selected"}.`} onClose={() => setAssistantOpen(false)} />
          </aside>
        ) : null}
      </div>

      {showWizard ? (
        <AddCompetitionWizard
          onCancel={() => setShowWizard(false)}
          onFinish={(competition) => {
            setCompetitions((items) => [competition, ...items]);
            void fetchCompetitionFiles(competition.id)
              .then((files) => rememberCompetitionFiles(competition.id, files))
              .catch(() => rememberCompetitionFiles(competition.id, []));
            selectCompetition(competition);
            setShowWizard(false);
            setActiveScreen("workbench");
          }}
        />
      ) : null}
      {overviewOpen && selectedCompetition ? (
        <CompetitionOverviewModal
          competition={selectedCompetition}
          cachedFiles={competitionFilesCache[selectedCompetition.id]}
          onAdd={() => setShowWizard(true)}
          onClose={() => setOverviewOpen(false)}
          onSelect={(competition) => {
            selectCompetition(competition);
            setActiveScreen("workbench");
            setOverviewOpen(false);
          }}
          onUpdated={(updated) => {
            setCompetitions((items) => items.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
            selectCompetition(updated);
          }}
          onFilesLoaded={rememberCompetitionFiles}
          onDeleted={(id) => {
            setCompetitions((items) => items.filter((c) => c.id !== id));
            setCompetitionFilesCache((cache) => {
              const next = { ...cache };
              delete next[id];
              return next;
            });
            setSelectedCompetition(null);
            window.localStorage.removeItem("esai-selected-competition-id");
            setOverviewOpen(false);
            setActiveScreen("dashboard");
          }}
        />
      ) : null}
    </div>
  );
}

function Sidebar(props: {
  activeScreen: Screen;
  collapsed: boolean;
  assistantOpen: boolean;
  onToggleAssistant: () => void;
  onToggleSidebar: () => void;
  onOpenScreen: (screen: Screen) => void;
}) {
  const menu = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "calendar" as const, label: "Calendar", icon: CalendarDays },
    { id: "validity" as const, label: "Validity-Checker", icon: ShieldCheck },
    { id: "outputs" as const, label: "Final Outputs", icon: FileCheck },
    { id: "devs" as const, label: "Devs", icon: Code2 },
  ];

  return (
    <aside className={`sidebar ${props.collapsed ? "collapsed" : ""}`}>
      <div className="brand">
        <span className="brand-mark">E</span>
        {!props.collapsed ? <span className="brand-name">ESAI.ai</span> : null}
      </div>
      <nav className="sidebar-nav">
        <button className={`sidebar-item ${props.assistantOpen ? "active" : ""}`} onClick={props.onToggleAssistant}>
          <MessageCircle size={18} />
          {!props.collapsed ? <span>AI Assistant</span> : null}
        </button>
        {menu.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} className={`sidebar-item ${props.activeScreen === item.id ? "active" : ""}`} onClick={() => props.onOpenScreen(item.id)}>
              <Icon size={18} />
              {!props.collapsed ? <span>{item.label}</span> : null}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <form action="/api/auth/logout" method="post" className="sidebar-logout-form">
          <button type="submit" className="sidebar-item sidebar-logout-button" title="Sign out">
            <span style={{ display: "inline-flex", width: 18, height: 18, alignItems: "center", justifyContent: "center" }}>⏻</span>
            {!props.collapsed ? <span>Sign out</span> : null}
          </button>
        </form>
        <button className={`profile-button ${props.activeScreen === "profile" ? "active" : ""}`} onClick={() => props.onOpenScreen("profile")}>
          <span className="avatar">AS</span>
          {!props.collapsed ? <span><strong>User Account</strong><small>Settings</small></span> : null}
        </button>
      </div>
      <button className="rail-handle" onClick={props.onToggleSidebar}>
        {props.collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
      </button>
    </aside>
  );
}

function DashboardScreen({
  competitions,
  onAdd,
  onSelect,
  onDelete,
  onEdit,
}: {
  competitions: Competition[];
  onAdd: () => void;
  onSelect: (competition: Competition) => void;
  onDelete: (id: string) => Promise<void>;
  onEdit: (competition: Competition) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<Competition | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  if (competitions.length === 0) {
    return (
      <section className="screen dashboard-screen">
        <header className="screen-header">
          <div>
            <h1>Dashboard</h1>
            <p>Lanjutkan progres kompetisi akademik Anda hari ini.</p>
          </div>
          <button className="btn-primary" onClick={onAdd}>
            <Plus size={17} /> Tambah Kompetisi
          </button>
        </header>
        <div className="dashboard-empty">
          <div className="dashboard-empty-icon">
            <Plus size={36} />
          </div>
          <h2>Belum ada kompetisi</h2>
          <p>Buat kompetisi pertamamu untuk mulai pipeline.</p>
          <button className="btn-primary" onClick={onAdd}>
            <Plus size={17} /> Tambah Kompetisi
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="screen dashboard-screen" onClick={() => setMenuOpenId(null)}>
      <header className="screen-header">
        <div>
          <h1>Dashboard</h1>
          <p>Lanjutkan progres kompetisi akademik Anda hari ini.</p>
        </div>
        <button className="btn-primary" onClick={onAdd}>
          <Plus size={17} /> Tambah Kompetisi
        </button>
      </header>

      <div className="comp-grid">
        {competitions.map((competition) => {
          const stageLabel = STAGES.find((s) => s.id === competition.currentStageId)?.label ?? competition.currentStageId;
          const deadlineDisplay = competition.deadline
            ? new Date(competition.deadline).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
            : "—";
          const menuOpen = menuOpenId === competition.id;
          return (
            <article key={competition.id} className="comp-card" onClick={() => onSelect(competition)}>
              <div className="comp-card-poster">
                {competition.posterImageUrl ? (
                  <img src={competition.posterImageUrl} alt={competition.title} loading="lazy" />
                ) : (
                  <div className="comp-card-poster-fallback">
                    <span>{competition.title.slice(0, 1)}</span>
                  </div>
                )}
                <div className="comp-card-poster-chips">
                  <span className="comp-chip">Poster</span>
                </div>
              </div>

              <div className="comp-card-body">
                <div className="comp-card-head">
                  <div>
                    <span className="comp-status-pill">{competition.status || "Setup"}</span>
                    <h3>{competition.title}</h3>
                    <p>{competition.category}{competition.institution ? ` · ${competition.institution}` : ""}</p>
                  </div>
                  <div
                    className="comp-card-menu"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpen ? null : competition.id);
                    }}
                  >
                    <button className="ghost-icon" aria-label="Options">
                      <MoreHorizontal size={18} />
                    </button>
                    {menuOpen ? (
                      <div className="comp-card-menu-pop" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            onEdit(competition);
                          }}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          className="danger"
                          onClick={() => {
                            setMenuOpenId(null);
                            setPendingDelete(competition);
                          }}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="comp-card-progress">
                  <div className="comp-card-progress-head">
                    <span>Progress</span>
                    <strong>{competition.progress ?? 0}%</strong>
                  </div>
                  <div className="comp-card-progress-bar">
                    <span style={{ width: `${competition.progress ?? 0}%` }} />
                  </div>
                </div>

                <div className="comp-card-foot">
                  <span className="comp-card-meta">
                    <CalendarDays size={14} />
                    {deadlineDisplay}
                  </span>
                  <span className="comp-card-stage">
                    Tahap: {stageLabel}
                    <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {pendingDelete ? (
        <DeleteConfirmDialog
          competition={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            await onDelete(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      ) : null}
    </section>
  );
}

function DeleteConfirmDialog({
  competition,
  onCancel,
  onConfirm,
}: {
  competition: Competition;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="modal-backdrop">
      <div className="small-modal">
        <div className="modal-header">
          <h2>Delete competition</h2>
          <button className="ghost-icon" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <p>
          <strong>{competition.title}</strong> and all related files (poster, guidebook, outputs, events) will be deleted
          permanently. This cannot be undone.
        </p>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          I understand this will permanently delete all data for this competition.
        </label>
        {err ? <p style={{ color: "#c52b2b" }}>{err}</p> : null}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!confirmed || busy}
            onClick={async () => {
              try {
                setBusy(true);
                setErr(null);
                await onConfirm();
              } catch (error) {
                setErr(error instanceof Error ? error.message : "Delete failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompetitionOverviewModal({
  competition,
  cachedFiles,
  onAdd: _onAdd,
  onClose,
  onSelect,
  onUpdated,
  onFilesLoaded,
  onDeleted,
}: {
  competition: Competition;
  cachedFiles?: CompetitionFile[];
  onAdd: () => void;
  onClose: () => void;
  onSelect: (competition: Competition) => void;
  onUpdated: (competition: Competition) => void;
  onFilesLoaded: (competitionId: string, files: CompetitionFile[]) => void;
  onDeleted: (id: string) => void;
}) {
  const [draft, setDraft] = useState({
    title: competition.title,
    category: competition.category,
    institution: competition.institution,
    deadline: competition.deadline,
    registrationLink: competition.registrationLink ?? "",
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [replacingAsset, setReplacingAsset] = useState<null | "poster" | "guidebook">(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [files, setFiles] = useState<CompetitionFile[]>(() => cachedFiles ?? []);
  const [filesLoading, setFilesLoading] = useState(!cachedFiles);
  const [viewingFile, setViewingFile] = useState<CompetitionFile | null>(null);
  const [fileDeleting, setFileDeleting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (cachedFiles) {
      setFiles(cachedFiles);
      setFilesLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setFilesLoading(true);
    fetchCompetitionFiles(competition.id)
      .then((list) => {
        if (!cancelled) {
          setFiles(list);
          onFilesLoaded(competition.id, list);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFiles([]);
          const ae = err as ApiError;
          setError(ae.message ?? "Failed to load competition files.");
        }
      })
      .finally(() => {
        if (!cancelled) setFilesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cachedFiles, competition.id, onFilesLoaded]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCompetition(competition.id, {
        title: draft.title,
        category: draft.category,
        institution: draft.institution,
        deadline: draft.deadline,
        registrationLink: draft.registrationLink,
      });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.message ?? "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  const replaceFile = async (role: "poster" | "guidebook", file: File) => {
    setReplacingAsset(role);
    setError(null);
    try {
      const form = new FormData();
      form.set(role, file);
      const updated = await replaceCompetitionAssets(competition.id, form);
      onUpdated(updated);
      // refresh file list
      const list = await fetchCompetitionFiles(competition.id);
      setFiles(list);
      onFilesLoaded(competition.id, list);
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.message ?? "Replace failed.");
    } finally {
      setReplacingAsset(null);
    }
  };

  const deadlineDisplay = competition.deadline
    ? new Date(competition.deadline).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  const userFiles = files.filter((f) => f.fileSource === "user_upload");
  const agentFiles = files.filter((f) => f.fileSource === "agent_output");

  const stageLabel = STAGES.find((s) => s.id === competition.currentStageId)?.label ?? competition.currentStageId;

  return (
    <div className="overview-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <section className="overview-shell" onClick={(e) => e.stopPropagation()}>
        {/* Hero header */}
        <header className="overview-hero-simple">
          <div>
            <h2>{competition.title}</h2>
            <p>{competition.category}{competition.institution ? ` - ${competition.institution}` : ""}</p>
          </div>
          <div className="overview-hero-simple-actions">
            <button className="btn-ghost" onClick={() => setEditing((v) => !v)} title={editing ? "Cancel edit" : "Edit"}>
              <Pencil size={14} /> {editing ? "Cancel" : "Edit"}
            </button>
            <button className="btn-ghost danger" onClick={() => setPendingDelete(true)} title="Delete competition">
              <Trash2 size={14} /> Delete
            </button>
            <button className="btn-primary overview-submit-final">Submit Final</button>
            <button className="ghost-icon" onClick={onClose} aria-label="Close overview">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="overview-body">
          {/* Editable form */}
          {editing ? (
            <section className="overview-section">
              <div className="overview-section-head">
                <div>
                  <h3>Edit Details</h3>
                  <p>Update the competition metadata. Files are managed below.</p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  Title
                  <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </label>
                <label>
                  Category
                  <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                    <option>Sains & Teknologi</option>
                    <option>Sosial & Humaniora</option>
                    <option>Inovasi Digital</option>
                    <option>KTI</option>
                    <option>Business Plan</option>
                    <option>Essay</option>
                  </select>
                </label>
                <label>
                  Institution
                  <input value={draft.institution} onChange={(e) => setDraft({ ...draft, institution: e.target.value })} />
                </label>
                <label>
                  Deadline
                  <input type="date" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} />
                </label>
                <label className="wide">
                  Registration link
                  <input value={draft.registrationLink} onChange={(e) => setDraft({ ...draft, registrationLink: e.target.value })} placeholder="https://..." />
                </label>
              </div>
              <div className="overview-section-actions">
                <button className="btn-ghost" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </section>
          ) : null}

          {/* Info section */}
          <section className="overview-section">
            <div className="overview-section-head">
              <div>
                <h3>Info</h3>
                <p>Status kompetisi, deadline, dan akses pendaftaran.</p>
              </div>
              <span className="comp-status-pill">Active</span>
            </div>
            <div className="overview-info-grid">
              <div className="overview-info-tile">
                <small>Deadline</small>
                <strong>{deadlineDisplay}</strong>
                <span>Auto-synced into Calendar.</span>
              </div>
              <div className="overview-info-tile">
                <small>Progress</small>
                <strong className="accent">{competition.progress ?? 0}%</strong>
                <div className="overview-progress-bar">
                  <span style={{ width: `${competition.progress ?? 0}%` }} />
                </div>
                <span>Tahap: {stageLabel}</span>
              </div>
              <div className="overview-info-tile">
                <small>Link Registration</small>
                {competition.registrationLink ? (
                  <a href={competition.registrationLink} target="_blank" rel="noreferrer" className="overview-link">
                    {competition.registrationLink.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <strong style={{ color: "var(--muted)" }}>Not set</strong>
                )}
                <span>Pinned for every stage and output export.</span>
              </div>
            </div>
          </section>

          {/* Asset Maker section */}
          <AssetMakerSection competition={competition} onUpdated={onUpdated} />

          {/* Files section */}
          <section className="overview-section">
            <div className="overview-section-head">
              <div>
                <h3>Files</h3>
                <p>User uploads and agent-generated stage outputs.</p>
              </div>
              <div className="overview-section-actions">
                <label className="btn-ghost" style={{ cursor: replacingAsset ? "wait" : "pointer" }}>
                  <UploadCloud size={14} />
                  {replacingAsset === "poster" ? "Uploading..." : "Replace Poster"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: "none" }}
                    disabled={!!replacingAsset}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) replaceFile("poster", f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className="btn-ghost" style={{ cursor: replacingAsset ? "wait" : "pointer" }}>
                  <UploadCloud size={14} />
                  {replacingAsset === "guidebook" ? "Uploading..." : "Replace Guidebook"}
                  <input
                    type="file"
                    accept=".pdf,.docx,.md,.txt"
                    style={{ display: "none" }}
                    disabled={!!replacingAsset}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) replaceFile("guidebook", f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="overview-files-grid">
              <div className="overview-files-group">
                <h4>User Uploaded Content</h4>
                {filesLoading ? (
                  <p className="overview-files-hint">Loading files…</p>
                ) : userFiles.length === 0 ? (
                  <p className="overview-files-hint">No user uploads yet.</p>
                ) : (
                  <div className="overview-file-list">
                    {userFiles.map((f) => (
                      <FileRow
                        key={f.id}
                        file={f}
                        onView={() => setViewingFile(f)}
                        onDelete={async () => {
                          setFileDeleting(f.id);
                          try {
                            await deleteFile(f.id);
                            const next = files.filter((x) => x.id !== f.id);
                            setFiles(next);
                            onFilesLoaded(competition.id, next);
                            // Also refetch competition to clear FK references (poster etc.)
                            const refetched = await fetchCompetitionFiles(competition.id);
                            setFiles(refetched);
                            onFilesLoaded(competition.id, refetched);
                          } catch (err) {
                            setError((err as ApiError).message ?? "Delete failed.");
                          } finally {
                            setFileDeleting(null);
                          }
                        }}
                        deleting={fileDeleting === f.id}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="overview-files-group">
                <h4>Output of AI Agent</h4>
                {filesLoading ? (
                  <p className="overview-files-hint">Loading outputs…</p>
                ) : agentFiles.length === 0 ? (
                  <p className="overview-files-hint">No agent outputs yet. Run a stage to produce one.</p>
                ) : (
                  <div className="overview-file-list">
                    {agentFiles.map((f) => (
                      <FileRow
                        key={f.id}
                        file={f}
                        onView={() => setViewingFile(f)}
                        onDelete={async () => {
                          setFileDeleting(f.id);
                          try {
                            await deleteFile(f.id);
                            const next = files.filter((x) => x.id !== f.id);
                            setFiles(next);
                            onFilesLoaded(competition.id, next);
                          } catch (err) {
                            setError((err as ApiError).message ?? "Delete failed.");
                          } finally {
                            setFileDeleting(null);
                          }
                        }}
                        deleting={fileDeleting === f.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {error ? (
            <div className="wizard-error">
              <strong>Error:</strong> {error}
            </div>
          ) : null}
        </div>

        {viewingFile ? (
          <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />
        ) : null}

        {pendingDelete ? (
          <DeleteConfirmDialog
            competition={competition}
            onCancel={() => setPendingDelete(false)}
            onConfirm={async () => {
              await deleteCompetition(competition.id);
              setPendingDelete(false);
              onDeleted(competition.id);
              onClose();
            }}
          />
        ) : null}
      </section>
    </div>
  );
}

function FileRow({
  file,
  onView,
  onDelete,
  deleting,
}: {
  file: CompetitionFile;
  onView: () => void;
  onDelete: () => void | Promise<void>;
  deleting: boolean;
}) {
  return (
    <div className="overview-file-row">
      <button className="overview-file-row-main" onClick={onView} title="View file">
        <FileText size={14} />
        <span>{file.fileName}</span>
      </button>
      <small>{file.fileRole.replace(/_/g, " ")}</small>
      <button
        className="overview-file-row-delete"
        onClick={onDelete}
        disabled={deleting}
        title="Delete file"
        aria-label="Delete file"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function FileViewer({ file, onClose }: { file: CompetitionFile; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setErr(null);
    getFileSignedUrl(file.id)
      .then((res) => {
        if (cancelled) return;
        setUrl(res.url);
        setMime(res.mimeType);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load file.");
      });
    return () => { cancelled = true; };
  }, [file.id]);

  const isPdf = (mime ?? "").includes("pdf") || file.fileName.toLowerCase().endsWith(".pdf");
  const isImage = (mime ?? "").startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(file.fileName);
  const isText = (mime ?? "").startsWith("text/") ||
    /\.(md|txt|json|csv)$/i.test(file.fileName);

  return (
    <div className="file-viewer-backdrop" onClick={onClose}>
      <section className="file-viewer" onClick={(e) => e.stopPropagation()}>
        <header className="file-viewer-head">
          <div>
            <strong>{file.fileName}</strong>
            <small>{file.fileRole.replace(/_/g, " ")}</small>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {url ? (
              <a href={url} download={file.fileName} className="btn-ghost" target="_blank" rel="noreferrer">
                <Download size={14} /> Download
              </a>
            ) : null}
            <button className="ghost-icon" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="file-viewer-body">
          {err ? (
            <div className="wizard-error"><strong>Error:</strong> {err}</div>
          ) : !url ? (
            <p style={{ color: "var(--muted)", padding: 24 }}>Loading…</p>
          ) : isPdf ? (
            <iframe src={url} title={file.fileName} className="file-viewer-frame" />
          ) : isImage ? (
            <div className="file-viewer-image-wrap">
              <img src={url} alt={file.fileName} />
            </div>
          ) : isText ? (
            <TextFileViewer url={url} />
          ) : (
            <div style={{ padding: 24 }}>
              <p>Preview not supported for this file type.</p>
              <a href={url} download={file.fileName} className="btn-primary" target="_blank" rel="noreferrer">
                <Download size={14} /> Download
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function TextFileViewer({ url }: { url: string }) {
  const [content, setContent] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => r.text())
      .then((t) => { if (!cancelled) setContent(t); })
      .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to read."); });
    return () => { cancelled = true; };
  }, [url]);
  if (err) return <div className="wizard-error">{err}</div>;
  return <pre className="file-viewer-text">{content}</pre>;
}

function AssetMakerSection({
  competition,
  onUpdated,
}: {
  competition: Competition;
  onUpdated: (c: Competition) => void;
}) {
  const [position, setPosition] = useState(50); // 0..100 vertical Y
  const [scale, setScale] = useState(100);       // 50..200 %
  const [caption, setCaption] = useState(competition.instagramCaption ?? "");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [twibbonSrc, setTwibbonSrc] = useState<string | undefined>(competition.twibbonImageUrl);
  const [photoSrc, setPhotoSrc] = useState<string | undefined>(competition.userPhotoImageUrl);
  const [combinedUrl, setCombinedUrl] = useState<string | undefined>(competition.combinedAssetImageUrl);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [twibbonFile, setTwibbonFile] = useState<File | null>(null);
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTwibbonSrc(competition.twibbonImageUrl);
    setPhotoSrc(competition.userPhotoImageUrl);
    setCombinedUrl(competition.combinedAssetImageUrl);
  }, [competition.twibbonImageUrl, competition.userPhotoImageUrl, competition.combinedAssetImageUrl]);

  // Debounced caption autosave
  const saveCaption = (value: string) => {
    setCaption(value);
    if (saveTimer) clearTimeout(saveTimer);
    const t = setTimeout(async () => {
      try {
        const updated = await saveInstagramCaption(competition.id, value);
        onUpdated(updated);
      } catch {
        // silent; user sees no feedback for now
      }
    }, 700);
    setSaveTimer(t);
  };

  const handleUpload = async (role: "twibbon" | "user_photo", file: File) => {
    setError(null);
    try {
      // Preview immediately
      const previewUrl = URL.createObjectURL(file);
      if (role === "twibbon") {
        setTwibbonFile(file);
        setTwibbonSrc(previewUrl);
      } else {
        setPhotoFile(file);
        setPhotoSrc(previewUrl);
      }
      const updated = await uploadAssetMakerImage(competition.id, role, file);
      onUpdated(updated);
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.message ?? "Upload failed.");
    }
  };

  // Generate combined image using canvas
  const generate = async () => {
    if (!twibbonSrc || !photoSrc) {
      setError("Upload both twibbon and photo first.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D not available.");

      const loadImage = (src: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("Failed to load image."));
          img.src = src;
        });

      const [photoImg, twibbonImg] = await Promise.all([loadImage(photoSrc), loadImage(twibbonSrc)]);

      // Fill background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 1080, 1350);

      // Draw photo: scale horizontally to 1080*scaleFactor, keep aspect, position vertically by slider
      const scaleFactor = scale / 100;
      const baseW = 1080 * scaleFactor;
      const baseH = (photoImg.height / photoImg.width) * baseW;
      const cx = (1080 - baseW) / 2;
      // position 0..100 maps to vertical cover range inside 1350 canvas
      const cy = ((position / 100) * (1350 - baseH));

      ctx.drawImage(photoImg, cx, cy, baseW, baseH);

      // Draw twibbon overlay full-frame at 1080x1350
      ctx.drawImage(twibbonImg, 0, 0, 1080, 1350);

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
      if (!blob) throw new Error("Failed to render combined image.");

      const localUrl = URL.createObjectURL(blob);
      setCombinedUrl(localUrl);

      const pngFile = new File([blob], "combined_asset.png", { type: "image/png" });
      const updated = await uploadAssetMakerImage(competition.id, "combined_asset", pngFile);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadCombined = () => {
    if (!combinedUrl) return;
    const a = document.createElement("a");
    a.href = combinedUrl;
    a.download = `${competition.title.replace(/\s+/g, "-").toLowerCase()}-twibbon.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const scaleFactor = scale / 100;

  return (
    <section className="overview-section asset-maker">
      <div className="overview-section-head">
        <div>
          <h3>Asset Maker</h3>
          <p>Buat twibbon Instagram dari foto dan frame kamu.</p>
        </div>
        <button
          className="btn-primary"
          onClick={generate}
          disabled={generating || !twibbonSrc || !photoSrc}
        >
          {generating ? "Generating…" : "Generate Combined Photo"}
        </button>
      </div>

      <div className="asset-maker-grid">
        {/* Preview */}
        <div className="asset-maker-preview-wrap">
          <div className="asset-maker-preview-outer">
            <div className="asset-maker-preview">
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt="user photo"
                  className="asset-maker-photo"
                  style={{
                    transform: `translateY(${(position - 50) * 2}%) scale(${scaleFactor})`,
                  }}
                />
              ) : (
                <>
                  <div className="asset-maker-placeholder-circle" />
                  <div className="asset-maker-placeholder">Upload your photo</div>
                </>
              )}
              {twibbonSrc ? (
                <img src={twibbonSrc} alt="twibbon frame" className="asset-maker-twibbon" />
              ) : null}
            </div>
          </div>
          <div className="asset-maker-preview-caption">
            <strong>Twibbon + Photo Preview</strong>
            <span>Drag sliders to adjust</span>
          </div>
        </div>

        {/* Controls */}
        <div className="asset-maker-side">
          <div className="overview-info-tile">
            <small>Photo Controls</small>
            <label className="asset-maker-slider-label">Photo position</label>
            <input
              type="range"
              min={0}
              max={100}
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
            />
            <label className="asset-maker-slider-label">Scale</label>
            <input
              type="range"
              min={50}
              max={200}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
            />
          </div>

          <div className="overview-info-tile">
            <small>Assets</small>
            <div className="asset-maker-upload-row">
              <label className="btn-ghost">
                <UploadCloud size={14} /> {photoFile || photoSrc ? "Replace Photo" : "Upload Photo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload("user_photo", f);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="btn-ghost">
                <UploadCloud size={14} /> {twibbonFile || twibbonSrc ? "Replace Twibbon" : "Upload Twibbon"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload("twibbon", f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <small style={{ fontWeight: 400, fontSize: 11 }}>
              Upload poster twibbon (PNG/JPG). Jika tidak transparan, area tengah otomatis dijadikan transparan.
            </small>
          </div>

          <div className="overview-info-tile">
            <small>Instagram Caption</small>
            <textarea
              className="asset-maker-caption"
              value={caption}
              onChange={(e) => saveCaption(e.target.value)}
              placeholder="Tulis caption Instagram di sini..."
            />
          </div>

          {combinedUrl ? (
            <div className="overview-info-tile">
              <small>Combined Result</small>
              <img src={combinedUrl} alt="combined" className="asset-maker-combined-preview" />
              <button className="btn-ghost" onClick={downloadCombined}>
                <Download size={14} /> Download .png
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="wizard-error" style={{ marginTop: 14 }}>
          <strong>Error:</strong> {error}
        </div>
      ) : null}
    </section>
  );
}

function AddCompetitionWizard({ onCancel, onFinish }: { onCancel: () => void; onFinish: (competition: Competition) => void }) {
  const [step, setStep] = useState(1);
  const [fields, setFields] = useState({
    title: "",
    category: "Sains & Teknologi",
    institution: "",
    deadline: "2026-09-01",
    registrationLink: "",
  });
  const [poster, setPoster] = useState<File | null>(null);
  const [guidebook, setGuidebook] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdCompetition, setCreatedCompetition] = useState<Competition | null>(null);
  const [uploadModal, setUploadModal] = useState<{ title: string; message: string } | null>(null);
  const [error, setError] = useState<{ message: string; correlationId?: string } | null>(null);

  const posterOk = poster && /^image\/(png|jpeg|webp)$/.test(poster.type) && poster.size <= 5 * 1024 * 1024;
  const guidebookOk = guidebook && /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/markdown|text\/plain)$/.test(guidebook.type) && guidebook.size <= 20 * 1024 * 1024;
  const canFinish = Boolean(fields.title.trim() && posterOk && guidebookOk);

  const createAndVerify = async () => {
    if (!canFinish || submitting) return;
    setSubmitting(true);
    setUploadModal({
      title: "Uploading competition files",
      message: "Please wait while the poster and guidebook are saved. The workflow will open only after the guidebook row is confirmed.",
    });
    setError(null);
    try {
      const formData = new FormData();
      formData.set("title", fields.title);
      formData.set("category", fields.category);
      formData.set("institution", fields.institution);
      formData.set("deadline", fields.deadline);
      formData.set("registrationLink", fields.registrationLink);
      formData.set("poster", poster!);
      formData.set("guidebook", guidebook!);

      const competition = await createCompetition(formData);
      if (!isCompetitionUploadComplete(competition)) {
        throw new Error("Guidebook upload was not confirmed. Please try again before opening the workflow pipeline.");
      }
      setCreatedCompetition(competition);
      setStep(3);
    } catch (err) {
      const ae = err as ApiError;
      setError({ message: ae.message ?? (err as Error).message ?? "Failed to create competition.", correlationId: ae.correlationId });
    } finally {
      setSubmitting(false);
      setUploadModal(null);
    }
  };

  const finish = () => {
    if (!createdCompetition || !isCompetitionUploadComplete(createdCompetition)) {
      setError({ message: "Guidebook upload is not confirmed yet. Please upload the files before opening the workflow pipeline." });
      return;
    }
    onFinish(createdCompetition);
  };

  return (
    <div className="modal-backdrop">
      <div className="wizard">
        <div className="modal-header">
          <h2>Setup Kompetisi Baru</h2>
          <button className="ghost-icon" onClick={onCancel} disabled={submitting}>
            <X size={18} />
          </button>
        </div>
        <div className="step-track">
          {[1, 2, 3].map((item) => (
            <span key={item} className={item <= step ? "active" : ""} />
          ))}
        </div>

        {step === 1 ? (
          <div className="form-grid">
            <label>
              Nama Kompetisi
              <input value={fields.title} onChange={(e) => setFields({ ...fields, title: e.target.value })} placeholder="Competition name" />
            </label>
            <label>
              Kategori
              <select value={fields.category} onChange={(e) => setFields({ ...fields, category: e.target.value })}>
                <option>Sains & Teknologi</option>
                <option>Sosial & Humaniora</option>
                <option>Inovasi Digital</option>
                <option>KTI</option>
                <option>Business Plan</option>
                <option>Essay</option>
              </select>
            </label>
            <label>
              Institusi
              <input value={fields.institution} onChange={(e) => setFields({ ...fields, institution: e.target.value })} placeholder="Institution" />
            </label>
            <label>
              Deadline
              <input type="date" value={fields.deadline} onChange={(e) => setFields({ ...fields, deadline: e.target.value })} />
            </label>
            <label className="wide">
              Link pendaftaran
              <input value={fields.registrationLink} onChange={(e) => setFields({ ...fields, registrationLink: e.target.value })} placeholder="https://..." />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="wizard-upload-grid">
            <label className={`upload-zone ${poster ? (posterOk ? "has-file" : "has-error") : ""}`}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setPoster(e.target.files?.[0] ?? null)}
                className="upload-zone-input"
                disabled={submitting || Boolean(createdCompetition)}
              />
              <UploadCloud size={30} />
              <strong>Poster</strong>
              <span>PNG, JPG, or WebP. Max 5 MB.</span>
              {poster ? (
                <small className={posterOk ? "upload-ok" : "upload-err"}>
                  {poster.name} ({Math.round(poster.size / 1024)} KB)
                </small>
              ) : (
                <small className="upload-hint">Click to choose a file</small>
              )}
            </label>
            <label className={`upload-zone ${guidebook ? (guidebookOk ? "has-file" : "has-error") : ""}`}>
              <input
                type="file"
                accept=".pdf,.docx,.md,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
                onChange={(e) => setGuidebook(e.target.files?.[0] ?? null)}
                className="upload-zone-input"
                disabled={submitting || Boolean(createdCompetition)}
              />
              <UploadCloud size={30} />
              <strong>Guidebook</strong>
              <span>PDF, DOCX, MD, or TXT. Max 20 MB.</span>
              {guidebook ? (
                <small className={guidebookOk ? "upload-ok" : "upload-err"}>
                  {guidebook.name} ({Math.round(guidebook.size / 1024)} KB)
                </small>
              ) : (
                <small className="upload-hint">Click to choose a file</small>
              )}
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="success-pane">
            <Check size={34} />
            <h3>Upload Confirmed</h3>
            <p>Guidebook is saved and verified. You can now open the workflow pipeline.</p>
            {error ? (
              <div className="wizard-error">
                <strong>Gagal:</strong> {error.message}
                {error.correlationId ? <div><small>Correlation ID: <code>{error.correlationId}</code></small></div> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={() => (step > 1 ? setStep(step - 1) : onCancel())} disabled={submitting}>
            {step === 1 ? "Batal" : "Kembali"}
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              if (step === 1) setStep(2);
              else if (step === 2) void createAndVerify();
              else finish();
            }}
            disabled={(step === 2 && (!(posterOk && guidebookOk) || submitting || Boolean(createdCompetition))) || (step === 3 && (!createdCompetition || submitting))}
          >
            {step === 2 ? (submitting ? "Uploading..." : "Upload and verify") : step === 3 ? "Open workflow pipeline" : "Lanjut"}
          </button>
        </div>
      </div>
      {uploadModal ? (
        <BlockingLoadingModal title={uploadModal.title} message={uploadModal.message} />
      ) : null}
    </div>
  );
}

function BlockingLoadingModal({ title, message }: { title: string; message: string }) {
  return (
    <div className="modal-backdrop upload-blocking-backdrop" role="alertdialog" aria-modal="true">
      <div className="small-modal upload-blocking-modal">
        <RefreshCw size={30} className="spin" />
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
    </div>
  );
}

function CalendarScreen() {
  return (
    <section className="screen calendar-screen">
      <header className="screen-header">
        <div>
          <h1>Calendar</h1>
          <p>Deadlines, guidebook dates, agent tasks, review reminders, and submission milestones.</p>
        </div>
      </header>
      <div className="dashboard-empty">
        <div className="dashboard-empty-icon">
          <CalendarDays size={36} />
        </div>
        <h2>No events yet</h2>
        <p>Events auto-sync from approved stage outputs and competition deadlines. Create a competition to seed this view.</p>
      </div>
    </section>
  );
}

export function Workbench({ competition, assistantOpen, darkMode, onBack, onToggleAssistant, onToggleTheme }: { competition: Competition; assistantOpen: boolean; darkMode: boolean; onBack: () => void; onToggleAssistant: () => void; onToggleTheme: () => void }) {
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [currentStageId, setCurrentStageId] = useState<StageId>(competition.currentStageId);
  const [outputOpen, setOutputOpen] = useState(false);
  const [stages, setStages] = useState<StageStateEntry[]>([]);
  const { models, selectedModel, setSelectedModel, modelsLoading } = useModelOptions({ refreshOnMount: true });
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(() => {
    if (typeof window === "undefined") return "medium";
    return (window.localStorage.getItem("esai-reasoning") as ReasoningEffort) ?? "medium";
  });
  const [stagesLoading, setStagesLoading] = useState(true);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [streamingRun, setStreamingRun] = useState<ActiveRun | null>(null);
  const [completedActivity, setCompletedActivity] = useState<Record<string, CompletedRunActivity>>({});
  const [composerValue, setComposerValue] = useState("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [imageGenerationEnabled, setImageGenerationEnabled] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>("balanced");
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [messageSelectionMode, setMessageSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(() => new Set());
  const [deleteChatRequest, setDeleteChatRequest] = useState<ChatDeleteRequest | null>(null);
  const [rerunTarget, setRerunTarget] = useState<StageStateEntry | null>(null);
  const [approveRequest, setApproveRequest] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runSubmitting, setRunSubmitting] = useState(false);
  const [runSubmittingStageId, setRunSubmittingStageId] = useState<StageId | null>(null);
  const [runCancelling, setRunCancelling] = useState(false);

  const currentStage = STAGES.find((stage) => stage.id === currentStageId) ?? STAGES[0];
  const currentStageIndex = STAGES.findIndex((stage) => stage.id === currentStage.id);
  const nextStage = STAGES[currentStageIndex + 1];
  const currentStageEntry = stages.find((s) => s.nodeKey === currentStage.id) ?? null;
  const outputFile = currentStageEntry?.outputFile ?? null;
  const isApproved = outputFile?.status === "approved";
  const isStale = outputFile?.status === "stale";
  const stageUnlocked = currentStageEntry?.unlocked ?? (currentStage.id === "onboarding");
  const visibleStreamingRun = streamingRun?.stageId === currentStage.id ? streamingRun : null;
  const currentStageSubmitting = runSubmitting && runSubmittingStageId === currentStage.id;
  const runInFlight = Boolean(visibleStreamingRun && !isTerminalRunPhase(visibleStreamingRun.phase));
  const isRunning = runInFlight || currentStageSubmitting;
  const modelReady = isSelectedModelReady(models, selectedModel);
  const isMainAgentStage = currentStage.id === "onboarding";
  const stageRunnable = currentStage.id === "onboarding" || currentStage.id === "ideation";
  const canTerminateRun = runInFlight && !runCancelling;
  const runButtonDisabled = runInFlight ? !canTerminateRun : currentStageSubmitting || !stageUnlocked || !modelReady || !stageRunnable;
  const reasoningEfforts = getReasoningEffortsForModel(models, selectedModel) as ReasoningEffort[];
  const activeReasoningEffort = getActiveReasoningEffort(models, selectedModel, reasoningEffort);
  const reasoningDisabled = reasoningEfforts.length === 0;
  const activeToolCount = Number(webSearchEnabled) + Number(imageGenerationEnabled);
  const visibleStreamingRunPersisted = Boolean(
    visibleStreamingRun && thread.some((message) => getRunIdFromMessageContext(message.context) === visibleStreamingRun.runId),
  );
  const showStreamingBubble = Boolean(visibleStreamingRun && !visibleStreamingRunPersisted);

  const reloadStageState = useCallback(async () => {
    setStagesLoading(true);
    try {
      const res = await fetch(`/api/competitions/${competition.id}/stage-state`, { cache: "no-store" });
      const json = await res.json();
      const list: StageStateEntry[] = json?.data?.stages ?? [];
      setStages(list);
    } catch {
      setStages([]);
    } finally {
      setStagesLoading(false);
    }
  }, [competition.id]);

  const reloadThread = useCallback(async () => {
    try {
      const res = await fetch(`/api/competitions/${competition.id}/agent-thread?stageId=${currentStage.id}`, { cache: "no-store" });
      const json = await res.json();
      setThread(json?.data ?? []);
    } catch {
      setThread([]);
    }
  }, [competition.id, currentStage.id]);

  useEffect(() => {
    window.localStorage.setItem("esai-reasoning", reasoningEffort);
  }, [reasoningEffort]);

  useEffect(() => {
    if (!toolsMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && toolsMenuRef.current?.contains(target)) return;
      setToolsMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [toolsMenuOpen]);

  useEffect(() => {
    setCurrentStageId(competition.currentStageId);
    setThread([]);
    setStreamingRun(null);
    setCompletedActivity({});
    setRunError(null);
    setMessageMenuId(null);
    setMessageSelectionMode(false);
    setSelectedMessageIds(new Set());
    setDeleteChatRequest(null);
    setRunCancelling(false);
  }, [competition.id, competition.currentStageId]);

  // Reload stage state + thread when stage or competition changes.
  useEffect(() => {
    reloadStageState();
    reloadThread();
  }, [reloadStageState, reloadThread]);

  const startRun = async (overrideMessage?: string) => {
    setRunError(null);
    if (!stageUnlocked) { setRunError("Upstream stage not approved yet."); return; }
    if (!modelReady) { setRunError("Pick a model first."); return; }

    setRunSubmitting(true);
    setRunSubmittingStageId(currentStage.id);
    setRunCancelling(false);
    const messageToSend = overrideMessage ?? (composerValue.trim() ? composerValue.trim() : undefined);
    const { provider, modelId } = parseModelPickerValue(selectedModel);
    try {
      const res = await fetch("/api/agent-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionId: competition.id,
          stageId: currentStage.id,
          modelProvider: provider,
          modelId,
          reasoningEffort: activeReasoningEffort,
          userMessage: messageToSend,
          webSearch: webSearchEnabled,
          imageGeneration: imageGenerationEnabled,
          searchMode,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setRunError(err?.error?.message ?? err?.message ?? `Run failed (${res.status}).`);
        setRunSubmitting(false);
        setRunSubmittingStageId(null);
        return;
      }
      const json = await res.json();
      const runId: string = json?.data?.runId;
      setCompletedActivity((items) => {
        const next = { ...items };
        delete next[currentStage.id];
        return next;
      });
      setStreamingRun({ runId, stageId: currentStage.id, tokens: "", activities: [], progressLines: [], toolWrites: [], phase: "queued", phaseDetail: "Run queued. Worker polls every 2s.", startedAt: Date.now() });
      setComposerValue("");
      // Keep runSubmitting true — it will be cleared when first token arrives or on error.
      await reloadThread();
    } catch (error) {
      setRunError((error as Error).message ?? "Run failed.");
      setRunSubmitting(false);
      setRunSubmittingStageId(null);
    }
  };

  const terminateRun = async () => {
    const activeRun = streamingRun?.stageId === currentStage.id ? streamingRun : null;
    if (!activeRun || runCancelling) return;
    setRunCancelling(true);
    setRunError(null);
    setStreamingRun((prev) => prev ? {
      ...prev,
      phase: "cancelling",
      phaseDetail: "Termination requested. Stopping the CLI process...",
    } : prev);
    try {
      const res = await fetch(`/api/agent-runs/${activeRun.runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setRunError(err?.error?.message ?? err?.message ?? "Failed to terminate run.");
        setRunCancelling(false);
      }
    } catch (error) {
      setRunError((error as Error).message ?? "Failed to terminate run.");
      setRunCancelling(false);
    }
  };

  // Realtime subscribe to events for the active run.
  useEffect(() => {
    if (!streamingRun) return;
    const runId = streamingRun.runId;

    let active = true;
    let cleanup = () => {};

    (async () => {
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      const channel = supabase
        .channel(`agent-run-${runId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "agent_run_events", filter: `run_id=eq.${runId}` },
          (payload: { new: { event_type: string; payload: Record<string, unknown> } }) => {
            if (!active) return;
            handleRunEvent(payload.new.event_type, payload.new.payload);
          },
        )
        .subscribe();

      // Replay any prior events that fired before the subscription attached.
      try {
        const res = await fetch(`/api/agent-runs/${runId}`, { cache: "no-store" });
        const json = await res.json();
        for (const e of json?.data?.events ?? []) {
          if (!active) break;
          handleRunEvent(e.eventType, e.payload);
        }
      } catch { /* ignore */ }

      cleanup = () => {
        active = false;
        supabase.removeChannel(channel);
      };
    })();

    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingRun?.runId]);

  // Poll run status from DB while waiting — catches cases where worker died after queueing
  // or finished without our subscription getting events. Stops once we see streaming or completion.
  useEffect(() => {
    if (!streamingRun) return;
    if (streamingRun.phase === "completed" || streamingRun.phase === "failed") return;
    const runId = streamingRun.runId;
    let stopped = false;

    const check = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/agent-runs/${runId}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const dbStatus = json?.data?.run?.status;
        const dbError = json?.data?.run?.error;
        const queuedAt = json?.data?.run?.queuedAt ? new Date(json.data.run.queuedAt).getTime() : 0;
        const queuedSec = queuedAt ? (Date.now() - queuedAt) / 1000 : 0;

        if ((dbStatus === "cancelled" || dbStatus === "cancelling") && !stopped) {
          setStreamingRun((prev) => prev ? {
            ...prev,
            phase: dbStatus,
            phaseDetail: dbStatus === "cancelled" ? "Run cancelled by user." : "Termination requested. Waiting for worker to stop the process...",
          } : prev);
          setRunSubmitting(false);
          setRunSubmittingStageId(null);
          setRunCancelling(dbStatus === "cancelling");
          if (dbStatus === "cancelled") {
            queueMicrotask(() => {
              reloadThread();
              setStreamingRun(null);
              setRunCancelling(false);
            });
          }
        } else if (dbStatus === "failed" && !stopped) {
          setStreamingRun((prev) => prev ? {
            ...prev,
            phase: "failed",
            phaseDetail: dbError || "Run failed.",
          } : prev);
          setRunError(dbError || "Run failed.");
          setRunSubmitting(false);
          setRunSubmittingStageId(null);
          setRunCancelling(false);
        } else if (dbStatus === "needs_choice" && !stopped) {
          const choice = json?.data?.run?.needsUserChoice;
          setStreamingRun((prev) => prev ? {
            ...prev,
            phase: "needs_choice",
            phaseDetail: "Agent needs a user decision before continuing.",
            needsUserChoice: isNeedsUserChoice(choice) ? choice : prev.needsUserChoice,
          } : prev);
          setRunSubmitting(false);
          setRunSubmittingStageId(null);
          setRunCancelling(false);
        } else if (dbStatus === "completed" && !stopped) {
          reloadStageState();
          reloadThread();
          setStreamingRun(null);
          setRunSubmitting(false);
          setRunSubmittingStageId(null);
          setRunCancelling(false);
        } else if (dbStatus === "queued" && queuedSec > 30 && !stopped) {
          // Worker likely not running.
          setStreamingRun((prev) => prev && prev.phase === "queued" ? {
            ...prev,
            phaseDetail: `Still queued after ${Math.floor(queuedSec)}s. The worker process may not be running. Start it with: npm run worker`,
          } : prev);
        }
      } catch {
        // ignore
      }
    };

    // Poll every 3s so choice/completion state is recovered even if realtime misses an event.
    const id = setInterval(() => {
      void check();
    }, 3000);

    return () => { stopped = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingRun?.runId, streamingRun?.phase]);

  const handleRunEvent = (eventType: string, payload: Record<string, unknown>) => {
    setStreamingRun((prev) => {
      if (!prev) return prev;
      if (eventType === "status") {
        const phase = String(payload.phase ?? "");
        if (phase === "started") {
          return { ...prev, phase: "started", phaseDetail: "Worker started the run." };
        }
        if (phase === "prompt_built") {
          const length = Number(payload.length ?? 0);
          return { ...prev, phase: "prompt_built", phaseDetail: `Prompt built (${length.toLocaleString()} chars). Calling model…` };
        }
        if (phase === "cli_stderr" || phase === "cli_progress") {
          const text = String(payload.text ?? "").trim();
          if (!text) return prev;
          return { ...prev, phaseDetail: `CLI: ${text.slice(0, 200)}` };
        }
        if (phase === "completed") {
          const completed = {
            activities: appendRunActivity(prev.activities, { kind: "writing", label: "Run complete" }),
            progressLines: prev.progressLines,
            phaseDetail: "Run complete.",
          };
          queueMicrotask(() => {
            setCompletedActivity((items) => ({ ...items, [prev.stageId]: completed }));
            reloadStageState();
            reloadThread();
            setStreamingRun(null);
            setRunSubmitting(false);
            setRunSubmittingStageId(null);
            setRunCancelling(false);
          });
          return { ...prev, phase: "completed", phaseDetail: "Run complete." };
        }
        if (phase === "needs_choice") {
          setRunSubmitting(false);
          setRunSubmittingStageId(null);
          setRunCancelling(false);
          return { ...prev, phase: "needs_choice", phaseDetail: "Agent needs a user decision before continuing." };
        }
        if (phase === "cancelling" || phase === "cancelled") {
          setRunSubmitting(false);
          setRunSubmittingStageId(null);
          setRunCancelling(phase === "cancelling");
          if (phase === "cancelled") {
            const completed = {
              activities: appendRunActivity(prev.activities, { kind: "tool", label: "Run cancelled" }),
              progressLines: prev.progressLines,
              phaseDetail: "Run cancelled by user.",
            };
            queueMicrotask(() => {
              setCompletedActivity((items) => ({ ...items, [prev.stageId]: completed }));
              reloadThread();
              setStreamingRun(null);
              setRunCancelling(false);
            });
          }
          return { ...prev, phase, phaseDetail: String(payload.text ?? "Run cancelled by user.") };
        }
        return prev;
      }
      if (eventType === "token") {
        const text = typeof payload.text === "string" ? payload.text : "";
        if (text) {
          setRunSubmitting(false);
          setRunSubmittingStageId(null);
        }
        const nextTokens = prev.tokens + text;
        return {
          ...prev,
          phase: "streaming",
          phaseDetail: `Streaming response… ${nextTokens.length.toLocaleString()} chars received`,
          tokens: nextTokens,
        };
      }
      if (eventType === "progress") {
        const lines = Array.isArray(payload.lines)
          ? payload.lines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
          : [];
        if (lines.length === 0) return prev;
        return {
          ...prev,
          phase: prev.phase === "queued" ? "started" : prev.phase,
          phaseDetail: lines.at(-1)?.slice(0, 200) ?? prev.phaseDetail,
          progressLines: [...prev.progressLines, ...lines].slice(-24),
        };
      }
      if (eventType === "activity") {
        const activity = normalizeRunActivity(payload);
        if (!activity) return prev;
        return {
          ...prev,
          activities: appendRunActivity(prev.activities, activity),
          phaseDetail: activity.label || prev.phaseDetail,
        };
      }
      if (eventType === "choice") {
        if (!isNeedsUserChoice(payload)) return prev;
        setRunSubmitting(false);
        setRunSubmittingStageId(null);
        setRunCancelling(false);
        return {
          ...prev,
          phase: "needs_choice",
          phaseDetail: "Agent needs a user decision before continuing.",
          needsUserChoice: payload,
        };
      }
      if (eventType === "tool_call") {
        const tool = String(payload.tool ?? "tool");
        const fileName = (payload.params as { file_name?: string } | undefined)?.file_name ?? "";
        return { ...prev, phase: "tool_writing", phaseDetail: `Calling ${tool}${fileName ? ` → ${fileName}` : ""}…` };
      }
      if (eventType === "tool_result") {
        if (payload.ok === true) {
          return {
            ...prev,
            toolWrites: [...prev.toolWrites, { fileName: String(payload.fileName ?? "output"), fileId: String(payload.fileId ?? "") }],
            phaseDetail: `Saved ${String(payload.fileName ?? "output")} (${Number(payload.bytes ?? 0).toLocaleString()} bytes)`,
          };
        }
        return { ...prev, phaseDetail: `Tool failed: ${String(payload.error ?? "unknown")}` };
      }
      if (eventType === "error") {
        setRunError(String(payload.message ?? payload.reason ?? "Run error."));
        setRunSubmitting(false);
        setRunSubmittingStageId(null);
        return { ...prev, phase: "failed", phaseDetail: String(payload.message ?? payload.reason ?? "Run error.") };
      }
      return prev;
    });
  };

  const approve = async () => {
    if (!outputFile) return;
    setApproveRequest(false);
    setRunError(null);
    const res = await fetch(`/api/competition-files/${outputFile.id}/approve`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setRunError(err?.error ?? "Approve failed.");
      return;
    }
    const json = await res.json().catch(() => ({}));
    await reloadStageState();
    const nextStageId = json?.data?.nextStageId;
    if (typeof nextStageId === "string" && STAGES.some((stage) => stage.id === nextStageId)) {
      setCurrentStageId(nextStageId as StageId);
      setStreamingRun(null);
      setComposerValue("");
    }
  };

  const requestRerun = () => {
    if (!currentStageEntry) {
      // Pipeline not bootstrapped yet — first run will create it.
      void startRun();
      return;
    }
    if (isApproved && (currentStageEntry.downstreamStageKeys ?? []).length > 0) {
      setRerunTarget(currentStageEntry);
      return;
    }
    // no approved output or no downstream → just run immediately
    void startRun();
  };

  const confirmRerun = async () => {
    setRerunTarget(null);
    // Mark downstream as stale, then start the run.
    try {
      await fetch(`/api/competitions/${competition.id}/mark-stale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromStageKey: currentStage.id }),
      });
    } catch { /* not fatal */ }
    void startRun();
  };

  const answerAgentChoice = (choice: AgentRuntimeChoiceOption) => {
    const detail = choice.description ?? choice.detail ?? choice.result ?? "";
    const text = [
      `Selected choice: ${choice.label}`,
      `Choice id: ${choice.id ?? choice.key ?? choice.label}`,
      detail ? `Reason/context: ${detail}` : null,
    ].filter(Boolean).join("\n");
    setStreamingRun(null);
    void startRun(text);
  };

  const deleteThreadMessage = async (message: ThreadMessage, cascadeRun = false) => {
    if (isRunning) {
      setRunError("Wait for the current run to finish before editing or deleting chat.");
      return false;
    }
    setMessageMenuId(null);
    setRunError(null);
    const res = await fetch(`/api/agent-messages/${message.id}${cascadeRun ? "?cascadeRun=1" : ""}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setRunError(json?.error?.message ?? json?.message ?? "Failed to delete message.");
      return false;
    }
    await reloadThread();
    await reloadStageState();
    return true;
  };

  const deleteThreadMessages = async (messages: ThreadMessage[], cascadeUserRuns = true) => {
    if (isRunning) {
      setRunError("Wait for the current run to finish before deleting chat.");
      return false;
    }
    if (messages.length === 0) return false;
    setMessageMenuId(null);
    setRunError(null);
    const res = await fetch("/api/agent-messages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageIds: messages.map((message) => message.id), cascadeUserRuns }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setRunError(json?.error?.message ?? json?.message ?? "Failed to delete messages.");
      return false;
    }
    setSelectedMessageIds(new Set());
    setMessageSelectionMode(false);
    await reloadThread();
    await reloadStageState();
    return true;
  };

  const requestDeleteMessage = (message: ThreadMessage) => {
    const runId = getRunIdFromMessageContext(message.context);
    setMessageMenuId(null);
    setDeleteChatRequest({
      mode: "single",
      messages: [message],
      cascadeUserRuns: message.role === "user" && Boolean(runId),
    });
  };

  const requestDeleteSelectedMessages = () => {
    const messages = thread.filter((message) => selectedMessageIds.has(message.id));
    if (messages.length === 0) return;
    setDeleteChatRequest({ mode: "bulk", messages, cascadeUserRuns: true });
  };

  const editThreadMessage = async (message: ThreadMessage) => {
    if (message.role !== "user") return;
    const next = window.prompt("Edit this prompt and rerun it:", message.content);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) {
      setRunError("Edited prompt cannot be empty.");
      return;
    }
    const hasLinkedRun = Boolean(getRunIdFromMessageContext(message.context));
    const deleted = await deleteThreadMessage(message, true);
    if (!deleted) return;
    if (!hasLinkedRun && outputFile?.id) {
      try {
        await deleteFile(outputFile.id);
        await reloadStageState();
      } catch {
        setRunError("Prompt was edited, but the old output file could not be deleted.");
        return;
      }
    }
    void startRun(trimmed);
  };

  const clearThread = async () => {
    if (isRunning) {
      setRunError("Wait for the current run to finish before clearing chat.");
      return;
    }
    setDeleteChatRequest({ mode: "clear", messages: thread, cascadeUserRuns: false });
  };

  const confirmDeleteChat = async () => {
    if (!deleteChatRequest) return;
    setRunError(null);
    if (deleteChatRequest.mode === "clear") {
      const res = await fetch(`/api/competitions/${competition.id}/agent-thread?stageId=${currentStage.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setRunError(json?.error?.message ?? json?.message ?? "Failed to clear chat.");
        return;
      }
      setThread([]);
      setMessageMenuId(null);
      setSelectedMessageIds(new Set());
      setMessageSelectionMode(false);
    } else if (deleteChatRequest.messages.length === 1) {
      const deleted = await deleteThreadMessage(deleteChatRequest.messages[0], deleteChatRequest.cascadeUserRuns);
      if (!deleted) return;
    } else {
      const deleted = await deleteThreadMessages(deleteChatRequest.messages, deleteChatRequest.cascadeUserRuns);
      if (!deleted) return;
    }
    setDeleteChatRequest(null);
  };

  const selectedMessageCount = selectedMessageIds.size;
  const toggleMessageSelected = (messageId: string) => {
    setSelectedMessageIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  return (
    <section className={`reference-workbench ${railCollapsed ? "rail-collapsed" : ""}`}>
      <aside className={`reference-workflow-rail ${railCollapsed ? "collapsed" : ""}`}>
        <button className="rail-handle inside" onClick={() => setRailCollapsed((value) => !value)}>
          {railCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
        {!railCollapsed ? (
          <div className="reference-rail-header">
            <div>
              <h2>Workflow Pipeline</h2>
              <button onClick={onBack}>Overview</button>
            </div>
            <button className="reference-theme-button" onClick={onToggleTheme}>
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        ) : null}

        <div className="reference-stage-list">
          {STAGES.map((stage) => {
            const entry = stages.find((s) => s.nodeKey === stage.id);
            const unlocked = entry?.unlocked ?? (stage.id === "onboarding");
            const file = entry?.outputFile;
            const status = file?.status;
            const statusClass = status === "approved"
              ? "completed"
              : status === "stale"
                ? "stale"
                : unlocked
                  ? "active"
                  : "locked";
            const active = stage.id === currentStageId;
            return (
              <button
                key={stage.id}
                disabled={!unlocked}
                className={`reference-stage-row ${statusClass} ${active ? "selected" : ""}`}
                onClick={() => {
                  setCurrentStageId(stage.id);
                  setRunError(null);
                }}
                title={stage.label}
              >
                <span className="reference-stage-dot">
                  {status === "approved" ? <Check size={10} /> : !unlocked ? <Lock size={9} /> : null}
                </span>
                {!railCollapsed ? (
                  <span className="reference-stage-copy">
                    <strong>{stage.label}</strong>
                    <small>{status === "stale" ? "Upstream changed — needs re-run" : `Needs: ${stage.input}`}</small>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>

      <div className="reference-workbench-center">
        <div className="reference-stage-summary-strip">
          <FileControl label="Input file" fileName={currentStage.input} source={isMainAgentStage ? "Guidebook" : "Upstream agent output"} />
          <FileControl label="Output file" fileName={outputFile?.fileName ?? currentStage.output} source={outputFile?.status ?? "Not produced yet"} />
        </div>

        <div className="reference-ready-line">
          <span><Bot size={18} /></span>
          <p>
            <strong>Input gate:</strong>{" "}
            {stagesLoading
              ? "checking upstream…"
              : stageUnlocked
                ? "ready — upstream inputs approved."
                : "locked — approve upstream outputs first."}
          </p>
        </div>

        {!stageRunnable ? (
          <section className="reference-agent-question">
            <div className="reference-choice-header">
              <span>Stage status</span>
              <small>not wired</small>
            </div>
            <div className="reference-choice-body">
              <h2>This agent isn&apos;t wired yet.</h2>
              <p>Main Agent and Ideation are wired first. The remaining stages will run once their skills are connected.</p>
            </div>
          </section>
        ) : null}

        <div className="reference-thread-toolbar">
          <span>
            {messageSelectionMode && selectedMessageCount > 0
              ? `${selectedMessageCount} selected`
              : `${thread.length} chat message${thread.length === 1 ? "" : "s"}`}
          </span>
          <div className="reference-thread-actions">
            {messageSelectionMode ? (
              <>
                <button
                  className="btn-ghost reference-small-button"
                  type="button"
                  onClick={() => {
                    setMessageSelectionMode(false);
                    setSelectedMessageIds(new Set());
                  }}
                  disabled={isRunning}
                >
                  Cancel
                </button>
                <button
                  className="btn-ghost danger reference-small-button"
                  type="button"
                  onClick={requestDeleteSelectedMessages}
                  disabled={selectedMessageCount === 0 || isRunning}
                >
                  <Trash2 size={13} /> Delete selected
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-ghost reference-small-button"
                  type="button"
                  onClick={() => setMessageSelectionMode(true)}
                  disabled={thread.length === 0 || isRunning}
                >
                  Select
                </button>
                <button className="ghost-icon" type="button" onClick={clearThread} disabled={thread.length === 0 || isRunning} title="Clear stage chat">
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="reference-agent-thread">
          {thread.length === 0 && !visibleStreamingRun ? (
            <p className="reference-thread-empty">No messages yet. Click {getRunButtonText(currentStage.id, false, false, false, false)} below to start this stage.</p>
          ) : null}
          {thread.map((message) => {
            const actions = getThreadMessageActions(message.role);
            const extracted = extractAgentChoiceFromMessage(message.content, message.context);
            const chatTime = message.role === "user" ? formatChatTime(message.createdAt) : "";
            return (
              <div key={message.id} className={`reference-chat-bubble ${message.role} ${selectedMessageIds.has(message.id) ? "selected" : ""}`}>
                <div className="reference-message-head">
                  <div className="reference-message-title">
                    {messageSelectionMode ? (
                      <label className="reference-message-check" title="Select message">
                        <input
                          type="checkbox"
                          checked={selectedMessageIds.has(message.id)}
                          onChange={() => toggleMessageSelected(message.id)}
                          disabled={isRunning}
                        />
                      </label>
                    ) : null}
                    <span className="reference-chat-role">{message.role === "user" ? "You" : "Agent"}</span>
                  </div>
                  <div className="reference-message-menu-wrap">
                    <button
                      className="ghost-icon reference-message-menu-button"
                      type="button"
                      onClick={() => setMessageMenuId((current) => current === message.id ? null : message.id)}
                      disabled={isRunning}
                      title="Message actions"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {messageMenuId === message.id ? (
                      <div className="reference-message-menu">
                        {actions.includes("edit") ? (
                          <button type="button" onClick={() => void editThreadMessage(message)}>
                            <Pencil size={13} /> Edit and rerun
                          </button>
                        ) : null}
                        {actions.includes("delete") ? (
                          <button type="button" onClick={() => requestDeleteMessage(message)}>
                            <Trash2 size={13} /> Delete
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                {extracted.displayText ? <MarkdownText text={extracted.displayText} /> : null}
                {chatTime ? <span className="reference-chat-time">{chatTime}</span> : null}
                {extracted.choice ? (
                  <AgentChoiceCard choice={extracted.choice} onSelect={answerAgentChoice} />
                ) : null}
              </div>
            );
          })}
          {showStreamingBubble && visibleStreamingRun ? (
            <div className="reference-chat-bubble assistant streaming">
              <span className="reference-chat-role">Agent · streaming</span>
              <MarkdownText text={visibleStreamingRun.tokens || "…"} />
              {visibleStreamingRun.needsUserChoice ? (
                <AgentChoiceCard choice={visibleStreamingRun.needsUserChoice} onSelect={answerAgentChoice} />
              ) : null}
              {visibleStreamingRun.progressLines.length > 0 ? (
                <div className="reference-progress-log">
                  {visibleStreamingRun.progressLines.slice(-8).map((line, index) => (
                    <span key={`${index}-${line}`}>{line}</span>
                  ))}
                </div>
              ) : null}
              {visibleStreamingRun.toolWrites.length > 0 ? (
                <div className="reference-tool-writes">
                  {visibleStreamingRun.toolWrites.map((w) => (
                    <span key={w.fileId} className="reference-tool-chip">
                      <FileText size={12} /> {w.fileName}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {showStreamingBubble && visibleStreamingRun && visibleStreamingRun.activities.length > 0 ? (
            <RunActivityFeed
              activities={visibleStreamingRun.activities}
              collapsed={isTerminalRunPhase(visibleStreamingRun.phase)}
            />
          ) : null}
          {!visibleStreamingRun && completedActivity[currentStage.id]?.activities.length > 0 ? (
            <RunActivityFeed
              activities={completedActivity[currentStage.id].activities}
              collapsed
            />
          ) : null}
          {runError ? <p className="reference-run-error">{runError}</p> : null}
          {visibleStreamingRun || currentStageSubmitting ? (
            <RunStatusBar
              phase={visibleStreamingRun?.phase ?? (currentStageSubmitting ? "submitting" : "")}
              detail={visibleStreamingRun?.phaseDetail ?? "Submitting run to backend…"}
              startedAt={visibleStreamingRun?.startedAt}
              tokens={visibleStreamingRun?.tokens.length ?? 0}
              toolWrites={visibleStreamingRun?.toolWrites.length ?? 0}
              progressLines={visibleStreamingRun?.progressLines ?? []}
            />
          ) : null}
          {outputFile ? (
            <section className="reference-handoff chat-handoff">
              <div>
                <small>Stage Handoff</small>
                <h2>
                  {isApproved
                    ? "Approved. Next stage unlocked."
                    : isStale
                      ? "Upstream changed. Re-run this stage to refresh the output."
                      : "Approve this stage output to unlock connected downstream inputs."}
                </h2>
              </div>
              <div className="reference-handoff-actions">
                {!isApproved ? (
                  <button className="btn-primary reference-small-button" onClick={() => setApproveRequest(true)} disabled={isStale}>
                    <Check size={14} /> Approve &amp; unlock next stage
                  </button>
                ) : (
                  <span className="comp-status-pill">Approved</span>
                )}
              </div>
            </section>
          ) : null}
        </div>

        <div className="reference-chat-composer">
          <textarea
            placeholder={`Optional: instructions for ${currentStage.label}. Leave blank to let the agent start.`}
            value={composerValue}
            onChange={(event) => setComposerValue(event.target.value)}
            disabled={isRunning}
          />
          <div className="reference-chat-controls">
            <select
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              disabled={models.length === 0 || isRunning}
            >
              {modelsLoading && models.length === 0 ? <option value="">Loading models…</option> : null}
              {!modelsLoading && models.length === 0 ? <option value="">No models configured</option> : null}
              {models.map((m) => (
                <option key={buildModelPickerValue(m)} value={buildModelPickerValue(m)}>
                  {m.label} ({m.provider})
                </option>
              ))}
            </select>
            <div className="composer-tools" ref={toolsMenuRef}>
              <button
                className={`composer-tools-button ${activeToolCount > 0 ? "active" : ""}`}
                type="button"
                onClick={() => setToolsMenuOpen((open) => !open)}
                disabled={isRunning}
                title="Run tools"
              >
                <SlidersHorizontal size={15} />
                <span>Tools</span>
              </button>
              {toolsMenuOpen ? (
                <div className="composer-tools-menu">
                  <button
                    type="button"
                    className={webSearchEnabled ? "active" : ""}
                    onClick={() => {
                      setWebSearchEnabled((value) => !value);
                    }}
                  >
                    <Globe size={16} />
                    <span>Search the web</span>
                    {webSearchEnabled ? <Check size={14} /> : null}
                  </button>
                  <button
                    type="button"
                    className={imageGenerationEnabled ? "active" : ""}
                    onClick={() => {
                      setImageGenerationEnabled((value) => !value);
                    }}
                  >
                    <Palette size={16} />
                    <span>Create an image</span>
                    {imageGenerationEnabled ? <Check size={14} /> : null}
                  </button>
                  {webSearchEnabled ? (
                    <div className="composer-search-mode">
                      <small>Search depth</small>
                      <div>
                        {(["fast", "balanced", "deep"] as SearchMode[]).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className={searchMode === mode ? "active" : ""}
                            onClick={() => setSearchMode(mode)}
                            title={SEARCH_MODE_META[mode].description}
                          >
                            {SEARCH_MODE_META[mode].label}
                          </button>
                        ))}
                      </div>
                      <p>{SEARCH_MODE_META[searchMode].description}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <select
              value={reasoningDisabled ? "" : activeReasoningEffort}
              onChange={(event) => setReasoningEffort(event.target.value as ReasoningEffort)}
              disabled={isRunning || reasoningDisabled}
            >
              {reasoningDisabled ? <option value="">No thinking effort</option> : null}
              {reasoningEfforts.map((effort) => (
                <option key={effort} value={effort}>{REASONING_LABELS[effort]}</option>
              ))}
            </select>
            <button
              className="btn-primary reference-run-button"
              onClick={runInFlight ? terminateRun : requestRerun}
              disabled={runButtonDisabled}
              title={runButtonDisabled && !modelReady ? "Pick a model first" : runButtonDisabled && !stageUnlocked ? "Upstream not approved" : runButtonDisabled && !stageRunnable ? "This stage is not wired yet" : undefined}
            >
              {getRunButtonText(currentStage.id, runInFlight, runCancelling, runSubmitting, Boolean(isApproved))} {runInFlight ? <X size={14} /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>

      <aside className="reference-current-file">
        <div className="reference-current-card">
          <div className="reference-current-head">
            <div>
              <small>Current File</small>
              <strong>{outputFile?.fileName ?? currentStage.output}</strong>
            </div>
            <span>{outputFile?.status ?? "Not produced"}</span>
          </div>
          <div className="reference-unlocks">
            <small>Unlocks Next</small>
            <p>{nextStage ? `${nextStage.label} can run after this file is approved.` : "All required stage outputs are ready for final review."}</p>
          </div>
          {visibleStreamingRun || currentStageSubmitting ? (
            <div className="reference-live-output">
              <small>Live agent output</small>
              <LiveWritingPreview
                text={visibleStreamingRun?.tokens ?? ""}
                fallback={visibleStreamingRun?.phaseDetail ?? "Submitting run to backend..."}
              />
            </div>
          ) : outputFile ? (
            <button className="reference-fullscreen-button" onClick={() => setOutputOpen(true)}>
              <Maximize2 size={15} /> Full screen
            </button>
          ) : (
            <p className="reference-thread-empty">Nothing produced yet.</p>
          )}
        </div>
      </aside>

      {assistantOpen ? (
        <aside className="workspace-assistant reference-assistant">
          <AssistantPanel context={`Workbench stage: ${currentStage.label}. Input: ${currentStage.input}. Output: ${outputFile?.fileName ?? currentStage.output}.`} onClose={onToggleAssistant} />
        </aside>
      ) : null}
      {rerunTarget ? (
        <RerunConfirmDialog
          stage={rerunTarget}
          onCancel={() => setRerunTarget(null)}
          onConfirm={confirmRerun}
        />
      ) : null}
      {deleteChatRequest ? (
        <DeleteChatConfirmDialog
          request={deleteChatRequest}
          onCancel={() => setDeleteChatRequest(null)}
          onConfirm={confirmDeleteChat}
        />
      ) : null}
      {approveRequest && outputFile ? (
        <ApproveConfirmDialog
          stageLabel={currentStage.label}
          fileName={outputFile.fileName}
          onCancel={() => setApproveRequest(false)}
          onConfirm={approve}
        />
      ) : null}
      {outputOpen && outputFile ? (
        <FullscreenOutputReader
          fileId={outputFile.id}
          fileName={outputFile.fileName}
          onClose={() => setOutputOpen(false)}
        />
      ) : null}
    </section>
  );
}

type StageStateEntry = {
  nodeId: string;
  nodeKey: string;
  label: string;
  positionIndex: number;
  unlocked: boolean;
  outputFile: { id: string; fileName: string; status: string } | null;
  downstreamStageKeys: string[];
};

type ThreadMessage = {
  id: string;
  role: string;
  content: string;
  stageId?: string;
  modelProvider?: string;
  modelId?: string;
  context?: Record<string, unknown>;
  createdAt: string;
};

type ChatDeleteRequest = {
  mode: "single" | "bulk" | "clear";
  messages: ThreadMessage[];
  cascadeUserRuns: boolean;
};

type ActiveRun = {
  runId: string;
  stageId: StageId;
  tokens: string;
  activities: RunActivityItem[];
  progressLines: string[];
  toolWrites: Array<{ fileName: string; fileId: string }>;
  needsUserChoice?: AgentRuntimeChoice;
  phase: string; // 'queued' | 'started' | 'prompt_built' | 'streaming' | 'tool_writing' | 'completed' | 'failed'
  phaseDetail: string;
  startedAt: number;
};

type CompletedRunActivity = {
  activities: RunActivityItem[];
  progressLines: string[];
  phaseDetail: string;
};

type RunActivityItem = {
  kind: "thinking" | "searching" | "reading" | "tool" | "writing" | "session";
  label: string;
  url?: string;
  domain?: string;
  fileName?: string;
  tool?: string;
};

type AgentRuntimeChoiceOption = AgentChoiceOption;
type AgentRuntimeChoice = AgentChoice;

function isNeedsUserChoice(value: unknown): value is AgentRuntimeChoice {
  return isAgentChoice(value);
}

function isTerminalRunPhase(phase: string | undefined): boolean {
  return phase === "completed" || phase === "failed" || phase === "cancelled" || phase === "needs_choice";
}

function getRunButtonText(stageId: string, streaming: boolean, cancelling: boolean, submitting: boolean, approved: boolean): string {
  if (streaming) return cancelling ? "Terminating..." : "Terminate";
  if (submitting) return "Submitting...";
  if (approved) return "Re-run";
  if (stageId === "onboarding") return "Run Main Agent";
  if (stageId === "ideation") return "Run Ideation Agent";
  return "Run";
}

function normalizeRunActivity(payload: Record<string, unknown>): RunActivityItem | null {
  const kind = String(payload.kind ?? "");
  if (!["thinking", "searching", "reading", "tool", "writing", "session"].includes(kind)) return null;
  const label = typeof payload.label === "string" && payload.label.trim()
    ? payload.label
    : kind === "session"
      ? "Provider session attached"
      : kind;
  return {
    kind: kind as RunActivityItem["kind"],
    label,
    url: typeof payload.url === "string" ? payload.url : undefined,
    domain: typeof payload.domain === "string" ? payload.domain : undefined,
    fileName: typeof payload.fileName === "string" ? payload.fileName : undefined,
    tool: typeof payload.tool === "string" ? payload.tool : undefined,
  };
}

function appendRunActivity(current: RunActivityItem[], next: RunActivityItem): RunActivityItem[] {
  const last = current.at(-1);
  if (last && last.kind === next.kind && last.label === next.label && last.url === next.url) return current;
  return [...current, next].slice(-24);
}

function RunActivityFeed({
  activities,
  collapsed,
}: {
  activities: RunActivityItem[];
  collapsed: boolean;
}) {
  const items = activities;
  const visible = collapsed ? items.slice(-1) : items.slice(-8);
  if (visible.length === 0) return null;
  return (
    <div className={`reference-activity-feed ${collapsed ? "collapsed" : ""}`}>
      {visible.map((item, index) => (
        <div className={`reference-activity-row ${item.kind}`} key={`${item.kind}-${item.label}-${index}`}>
          <span className="reference-activity-dot" />
          <div>
            <strong>{activityLabel(item.kind)}</strong>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer">{item.domain ?? item.url}</a>
            ) : (
              <small>{item.label}</small>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function activityLabel(kind: RunActivityItem["kind"]): string {
  if (kind === "searching") return "Searching";
  if (kind === "reading") return "Reading";
  if (kind === "tool") return "Using tool";
  if (kind === "session") return "Session";
  if (kind === "writing") return "Writing";
  return "Thinking";
}

function LiveWritingPreview({ text, fallback }: { text: string; fallback: string }) {
  const [visibleLineCount, setVisibleLineCount] = useState(1);
  const lines = (text.trim() ? text : fallback).split(/\r?\n/);
  useEffect(() => {
    setVisibleLineCount(Math.min(1, Math.max(lines.length, 1)));
    if (!text.trim()) return;
    const id = setInterval(() => {
      setVisibleLineCount((count) => {
        if (count >= lines.length) {
          clearInterval(id);
          return count;
        }
        return count + 1;
      });
    }, 120);
    return () => clearInterval(id);
  }, [text, lines.length]);
  return (
    <div className="reference-live-stream writing-only">
      {(text.trim() ? lines.slice(0, visibleLineCount) : lines).join("\n")}
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((part) => part.length > 0);
  return (
    <div className="markdown-text">
      {blocks.map((block, blockIndex) => {
        const lines = block.split(/\n/);
        return lines.map((line, lineIndex) => renderMarkdownLine(line, `${blockIndex}-${lineIndex}`));
      })}
    </div>
  );
}

function renderMarkdownLine(line: string, key: string): ReactNode {
  const heading = line.match(/^(#{1,4})\s+(.+)$/);
  if (heading) {
    const level = Math.min(heading[1].length, 4);
    if (level === 1) return <h3 key={key}>{renderInlineMarkdown(heading[2])}</h3>;
    if (level === 2) return <h4 key={key}>{renderInlineMarkdown(heading[2])}</h4>;
    if (level === 3) return <h5 key={key}>{renderInlineMarkdown(heading[2])}</h5>;
    return <h6 key={key}>{renderInlineMarkdown(heading[2])}</h6>;
  }

  const unordered = line.match(/^\s*[-*]\s+(.+)$/);
  if (unordered) {
    return (
      <p key={key} className="markdown-list-line">
        <span className="markdown-list-marker">-</span>
        <span>{renderInlineMarkdown(unordered[1])}</span>
      </p>
    );
  }

  const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
  if (ordered) {
    return (
      <p key={key} className="markdown-list-line">
        <span className="markdown-list-marker">{ordered[1]}.</span>
        <span>{renderInlineMarkdown(ordered[2])}</span>
      </p>
    );
  }

  return <p key={key}>{renderInlineMarkdown(line)}</p>;
}

function renderInlineMarkdown(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) nodes.push(line.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${match.index}-${token}`;
    if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < line.length) nodes.push(line.slice(lastIndex));
  return nodes;
}

function AgentChoiceCard({ choice, onSelect }: { choice: AgentRuntimeChoice; onSelect: (choice: AgentRuntimeChoiceOption) => void }) {
  if (isContextlessChoice(choice.question)) return null;
  return (
    <div className="reference-agent-question inline-choice">
      <div className="reference-choice-header">
        <span>Decision needed</span>
        <small>agent checkpoint</small>
      </div>
      <div className="reference-choice-body">
        <h2>{choice.question}</h2>
        <div className="reference-choice-row">
          {choice.options.map((option) => (
            <button
              key={option.id ?? option.key ?? option.label}
              type="button"
              className="reference-choice-pill"
              onClick={() => onSelect(option)}
            >
              <span>{option.key ?? option.id?.slice(0, 1).toUpperCase() ?? ">"}</span>
              <strong>{option.label}</strong>
              <small>{option.description ?? option.detail ?? option.result}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function isContextlessChoice(question: string): boolean {
  const words = question.trim().split(/\s+/).filter(Boolean).length;
  return words < 8;
}

function ApproveConfirmDialog({
  stageLabel,
  fileName,
  onCancel,
  onConfirm,
}: {
  stageLabel: string;
  fileName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="modal-backdrop">
      <div className="small-modal approve-modal">
        <div className="modal-header">
          <h2>Approve {stageLabel} output?</h2>
          <button className="ghost-icon" onClick={onCancel} disabled={busy}>
            <X size={18} />
          </button>
        </div>
        <p>
          This freezes <strong>{fileName}</strong> and unlocks the next stage. If you later edit or re-run this stage,
          the app will treat it as a fresh run and downstream outputs may need to be regenerated or approved again.
        </p>
        {err ? <p className="modal-error">{err}</p> : null}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={async () => {
              try {
                setBusy(true);
                setErr(null);
                await onConfirm();
              } catch (error) {
                setErr(error instanceof Error ? error.message : "Approve failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Approving..." : "Approve and unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteChatConfirmDialog({
  request,
  onCancel,
  onConfirm,
}: {
  request: ChatDeleteRequest;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const count = request.mode === "clear" ? request.messages.length : request.messages.length;
  const title = request.mode === "clear"
    ? "Clear chat"
    : request.mode === "bulk"
      ? "Delete selected chat"
      : "Delete chat";
  const body = request.mode === "clear"
    ? "This removes all visible chat messages for this stage from the database. Output files are kept."
    : request.cascadeUserRuns
      ? "Deleting user prompts also deletes the linked run messages and generated output files from the database."
      : "This removes the selected chat message from the database.";

  return (
    <div className="modal-backdrop">
      <div className="small-modal chat-delete-modal">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="ghost-icon" onClick={onCancel} disabled={busy}>
            <X size={18} />
          </button>
        </div>
        <p>{body}</p>
        <div className="chat-delete-summary">
          <strong>{count}</strong>
          <span>{count === 1 ? "message will be deleted" : "messages will be deleted"}</span>
        </div>
        {err ? <p className="modal-error">{err}</p> : null}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={busy || count === 0}
            onClick={async () => {
              try {
                setBusy(true);
                setErr(null);
                await onConfirm();
              } catch (error) {
                setErr(error instanceof Error ? error.message : "Delete failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RunStatusBar({
  phase,
  detail,
  startedAt,
  tokens,
  toolWrites,
  progressLines,
}: {
  phase: string;
  detail: string;
  startedAt?: number;
  tokens: number;
  toolWrites: number;
  progressLines: string[];
}) {
  const [, force] = useState(0);
  // Tick once a second for elapsed time display.
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  const elapsedDisplay = formatElapsed(elapsedSec);

  const phaseLabel = ({
    submitting: "Submitting",
    queued: "Queued",
    started: "Worker started",
    prompt_built: "Prompt built",
    streaming: "Streaming",
    tool_writing: "Writing file",
    completed: "Completed",
    failed: "Failed",
  } as Record<string, string>)[phase] ?? phase;

  const isFailed = phase === "failed";
  const isComplete = phase === "completed";

  return (
    <div className={`reference-run-status ${isFailed ? "failed" : isComplete ? "complete" : ""}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isFailed ? <X size={14} /> : isComplete ? <Check size={14} /> : <RefreshCw size={14} className="spin" />}
          <strong style={{ fontSize: 13 }}>{phaseLabel}</strong>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>· {elapsedDisplay}</span>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--muted)" }}>
          {tokens > 0 ? <span>{tokens.toLocaleString()} chars streamed</span> : null}
          {toolWrites > 0 ? <span>{toolWrites} file{toolWrites !== 1 ? "s" : ""} written</span> : null}
        </div>
      </div>
      <p style={{ margin: "6px 0 0 22px", fontSize: 12, color: "var(--muted)" }}>{detail}</p>
      {progressLines.length > 0 ? (
        <div className="reference-progress-log compact">
          {progressLines.slice(-6).map((line, index) => (
            <span key={`${index}-${line}`}>{line}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function RerunConfirmDialog({ stage, onCancel, onConfirm }: { stage: StageStateEntry; onCancel: () => void; onConfirm: () => void }) {
  const downstream = stage.downstreamStageKeys;
  return (
    <div className="modal-backdrop">
      <div className="small-modal">
        <div className="modal-header">
          <h2>Re-run {stage.label}?</h2>
          <button className="ghost-icon" onClick={onCancel}><X size={18} /></button>
        </div>
        <p>
          Re-running will replace the current output. Approved downstream outputs will be
          marked <strong>stale</strong> and need re-approval or re-run:
        </p>
        {downstream.length > 0 ? (
          <ul className="reference-stale-list">
            {downstream.map((key) => <li key={key}>• {stageLabelFor(key)}</li>)}
          </ul>
        ) : <p><em>No downstream stages currently consume this output.</em></p>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={onConfirm}>Re-run and mark downstream stale</button>
        </div>
      </div>
    </div>
  );
}

function stageLabelFor(nodeKey: string): string {
  const s = STAGES.find((stg) => stg.id === nodeKey);
  return s?.label ?? nodeKey;
}

function FullscreenOutputReader({ fileId, fileName, onClose }: { fileId: string; fileName: string; onClose: () => void }) {
  const [content, setContent] = useState<string>("Loading…");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/files/${fileId}`, { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) setContent(String(json?.data?.contentText ?? "No content."));
      } catch {
        if (!cancelled) setContent("Failed to load file.");
      }
    })();
    return () => { cancelled = true; };
  }, [fileId]);
  return (
    <div className="reference-editor-overlay">
      <div className="reference-editor-shell">
        <header className="reference-editor-header">
          <div><small>Stage Output</small><strong>{fileName}</strong></div>
          <button className="reference-round-button" onClick={onClose}><Minimize2 size={15} /></button>
        </header>
        <main className="reference-editor-body">
          <article className="reference-document-page">
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-body)" }}>{content}</pre>
          </article>
        </main>
      </div>
    </div>
  );
}

function FileControl({ label, fileName, source }: { label: string; fileName: string; source: string }) {
  return <button className="file-control reference-file-control"><span><small>{label}</small><strong>{fileName}</strong><em>{source}</em></span>{label === "Output file" ? <FileText size={16} /> : <span>Agent Output</span>}</button>;
}

function ByokSettings() {
  const [settingsTab, setSettingsTab] = useState("execution");
  const [executionMode, setExecutionMode] = useState("local");
  const [selectedCli, setSelectedCli] = useState("");
  const [cliProviders, setCliProviders] = useState<Array<{ id: string; name: string; command: string; version: string | null; installed: boolean; color: string; models: Array<{ id: string; label: string; provider: string }> }>>([]);
  const [apiProviders, setApiProviders] = useState<Array<{ id: string; name: string; configured: boolean }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchProviders(false);
  }, []);

  async function fetchProviders(refresh: boolean) {
    setLoading(true);
    try {
      const response = await fetch(`/api/cli-providers${refresh ? "?refresh=1" : ""}`);
      const json = await response.json();
      if (json.data) {
        setCliProviders(json.data.cliProviders ?? []);
        setApiProviders(json.data.apiProviders ?? []);
        const firstInstalled = (json.data.cliProviders ?? []).find((p: { installed: boolean }) => p.installed);
        if (firstInstalled && !selectedCli) setSelectedCli(firstInstalled.id);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  const installedCount = cliProviders.filter((a) => a.installed).length;

  return (
    <div className="byok-settings">
      <header className="byok-settings-header">
        <small>Settings</small>
        <h2>Execution &amp; model</h2>
        <p>Choose between a local code-agent CLI and the Anthropic API (BYOK). Your API key is stored only in this browser.</p>
      </header>
      <div className="byok-settings-body">
        <nav className="byok-settings-nav">
          <button className={settingsTab === "execution" ? "active" : ""} onClick={() => setSettingsTab("execution")}>
            <SlidersHorizontal size={16} />
            <span><strong>Configure execution mode</strong><small>Code agent</small></span>
          </button>
          <button className={settingsTab === "media" ? "active" : ""} onClick={() => setSettingsTab("media")}>
            <Monitor size={16} />
            <span><strong>Media providers</strong><small>Image / video / audio</small></span>
          </button>
          <button className={settingsTab === "language" ? "active" : ""} onClick={() => setSettingsTab("language")}>
            <Globe size={16} />
            <span><strong>Language</strong><small>Switch the interface language. Saved to browser.</small></span>
          </button>
          <button className={settingsTab === "appearance" ? "active" : ""} onClick={() => setSettingsTab("appearance")}>
            <Palette size={16} />
            <span><strong>Appearance</strong><small>Choose light, dark, or follow your system setting.</small></span>
          </button>
        </nav>
        <main className="byok-settings-content">
          {settingsTab === "execution" ? (
            <>
              <div className="byok-execution-tabs">
                <button className={executionMode === "local" ? "active" : ""} onClick={() => setExecutionMode("local")}>
                  <strong>Local CLI</strong>
                  <small>{installedCount} installed</small>
                </button>
                <button className={executionMode === "anthropic" ? "active" : ""} onClick={() => setExecutionMode("anthropic")}>
                  <strong>Anthropic API</strong>
                  <small>/v1/messages</small>
                </button>
                <button className={executionMode === "openai" ? "active" : ""} onClick={() => setExecutionMode("openai")}>
                  <strong>OpenAI API</strong>
                  <small>/v1/chat/completions</small>
                </button>
                <button className={executionMode === "openrouter" ? "active" : ""} onClick={() => setExecutionMode("openrouter")}>
                  <strong>OpenRouter</strong>
                  <small>/api/v1/chat/completions</small>
                </button>
              </div>
              {executionMode === "local" ? (
                <div className="byok-cli-section">
                  <div className="byok-cli-header">
                    <div>
                      <strong>Code agent</strong>
                      <p>Detected by scanning your PATH. Pick the CLI you want generations to flow through.</p>
                    </div>
                    <button className="btn-secondary byok-rescan" type="button" onClick={() => fetchProviders(true)}>
                      <RefreshCw size={14} /> Rescan
                    </button>
                  </div>
                  {loading ? <p className="form-note">Scanning PATH...</p> : (
                    <div className="byok-cli-grid">
                      {cliProviders.map((agent) => (
                        <button
                          key={agent.id}
                          type="button"
                          className={`byok-cli-card ${selectedCli === agent.id ? "selected" : ""} ${!agent.installed ? "disabled" : ""}`}
                          onClick={() => agent.installed && setSelectedCli(agent.id)}
                        >
                          <span className="byok-cli-icon" style={{ background: agent.color }}>{agent.name.charAt(0)}</span>
                          <span className="byok-cli-info">
                            <strong>{agent.name}</strong>
                            <small>{agent.version ?? "not installed"}</small>
                          </span>
                          {agent.installed ? <span className="byok-cli-dot" /> : null}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedCli && cliProviders.find((p) => p.id === selectedCli)?.models.length ? (
                    <div className="byok-cli-models">
                      <strong>Available models</strong>
                      <div className="byok-model-chips">
                        {cliProviders.find((p) => p.id === selectedCli)?.models.map((m) => (
                          <span key={m.id} className="byok-model-chip">{m.label}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="byok-api-section">
                  <div className="form-grid">
                    <label>API Key<input type="password" placeholder="Stored in browser only" /></label>
                    <label>Default Model<input placeholder="Read from configured provider models" /></label>
                    <label>Reasoning<select><option>Medium</option><option>High</option><option>Extra High</option></select></label>
                  </div>
                  {apiProviders.find((p) => p.id === (executionMode === "anthropic" ? "anthropic-api" : executionMode === "openai" ? "openai-api" : "openrouter"))?.configured ? (
                    <p className="form-note" style={{ color: "var(--accent)" }}>✓ API key configured in server environment</p>
                  ) : null}
                  <button className="btn-secondary">Test Connection</button>
                </div>
              )}
            </>
          ) : null}
          {settingsTab === "media" ? <p className="form-note">Configure image, video, and audio generation providers.</p> : null}
          {settingsTab === "language" ? <p className="form-note">Interface language is saved to your browser.</p> : null}
          {settingsTab === "appearance" ? <p className="form-note">Choose light, dark, or follow your system setting.</p> : null}
          <div className="byok-settings-footer">
            <button className="btn-ghost" type="button">Cancel</button>
            <button className="btn-primary" type="button">Save</button>
          </div>
        </main>
      </div>
    </div>
  );
}

function DevsScreen() {
  const [tab, setTab] = useState("style");
  const tabs = [["style", "Style Builder", Sparkles], ["agents", "Agents", Bot], ["settings", "Settings", SlidersHorizontal], ["byok", "BYOK Models", KeyRound]] as const;
  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <h1>Devs</h1>
          <p>Create developer-style outputs that competition agents can request from the vault.</p>
        </div>
      </header>
      <div className="dev-tabs">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            <Icon size={16} />{label}
          </button>
        ))}
      </div>
      {tab === "style" ? <StyleBuilderWorkspace /> : null}
      {tab === "agents" ? <DevsAgentsWorkspace /> : null}
      {tab === "settings" ? <Panel title="Workflow Guardrails">{["Require approval before next stage unlock", "Allow user-uploaded input override", "Strict citation checks", "Auto-create calendar reminders"].map((item) => <label className="toggle-row" key={item}><span>{item}</span><input type="checkbox" defaultChecked /></label>)}</Panel> : null}
      {tab === "byok" ? <ByokSettings /> : null}
    </section>
  );
}

type StyleSource = { id: string; fileName: string; mimeType: string; sizeBytes: number; createdAt: string; status: string };
type StyleProfile = { id: string; fileName: string; contentText: string; createdAt: string; status: string };
type StyleVersion = { id: string; versionNumber: number; changeSummary: string; createdAt: string };

function StyleBuilderWorkspace() {
  const [sources, setSources] = useState<StyleSource[]>([]);
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [versions, setVersions] = useState<StyleVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { models, selectedModel, setSelectedModel } = useModelOptions();
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(() => {
    if (typeof window === "undefined") return "medium";
    return (window.localStorage.getItem("esai-reasoning") as ReasoningEffort) ?? "medium";
  });
  const [activeRun, setActiveRun] = useState<{ runId: string; tokens: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/style-profile", { cache: "no-store" });
      const json = await res.json();
      setSources(json?.data?.sources ?? []);
      setProfile(json?.data?.profile ?? null);
      setVersions(json?.data?.versions ?? []);
    } catch {
      setSources([]);
      setProfile(null);
      setVersions([]);
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      const res = await fetch("/api/style-profile/upload", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Upload failed.");
      }
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/style-profile/sources/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Delete failed.");
      }
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUploadExistingProfile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/style-profile/upload-existing", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Upload failed.");
      }
      await reload();
      setAlertMessage("Style profile uploaded and saved successfully. Agents will use this on their next run.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleSaveToVault = () => {
    setAlertMessage("Style profile saved to vault. Agents will use this profile on their next run.");
  };

  const generate = async () => {
    setError(null);
    if (sources.length === 0) { setError("Upload at least one essay PDF first."); return; }
    if (!selectedModel) { setError("Pick a model first."); return; }
    const { provider, modelId } = parseModelPickerValue(selectedModel);

    try {
      const res = await fetch("/api/style-profile/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelProvider: provider, modelId, reasoningEffort: activeReasoningEffort }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Generate failed.");
      }
      const json = await res.json();
      setActiveRun({ runId: json?.data?.runId, tokens: "" });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Subscribe to the active run's events.
  useEffect(() => {
    if (!activeRun) return;
    const runId = activeRun.runId;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      const channel = supabase
        .channel(`style-run-${runId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "agent_run_events", filter: `run_id=eq.${runId}` },
          (payload: { new: { event_type: string; payload: Record<string, unknown> } }) => {
            if (disposed) return;
            handleEvent(payload.new.event_type, payload.new.payload);
          },
        )
        .subscribe();

      try {
        const res = await fetch(`/api/agent-runs/${runId}`, { cache: "no-store" });
        const json = await res.json();
        for (const e of json?.data?.events ?? []) {
          if (disposed) break;
          handleEvent(e.eventType, e.payload);
        }
      } catch { /* ignore */ }

      cleanup = () => {
        disposed = true;
        supabase.removeChannel(channel);
      };
    })();

    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun?.runId]);

  const handleEvent = (eventType: string, payload: Record<string, unknown>) => {
    setActiveRun((prev) => {
      if (!prev) return prev;
      if (eventType === "token") {
        const text = typeof payload.text === "string" ? payload.text : "";
        return { ...prev, tokens: prev.tokens + text };
      }
      if (eventType === "status" && payload.phase === "completed") {
        queueMicrotask(() => {
          reload();
          setActiveRun(null);
        });
      }
      if (eventType === "error") {
        setError(String(payload.message ?? payload.reason ?? "Run error."));
      }
      return prev;
    });
  };
  const reasoningEfforts = getReasoningEffortsForModel(models, selectedModel) as ReasoningEffort[];
  const activeReasoningEffort = getActiveReasoningEffort(models, selectedModel, reasoningEffort);
  const reasoningDisabled = reasoningEfforts.length === 0;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Style Profile Builder</h2>
          <p style={{ color: "var(--muted)", margin: "4px 0 0 0", fontSize: 13 }}>
            Upload five or more winning essay PDFs, pick a model, and let the builder generate your reusable style profile.
            Or upload an existing style profile directly.
          </p>
        </div>
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: 20, padding: "8px 0 16px 0" }}>
        {/* Section 1: Upload existing profile */}
        <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 10, padding: 16 }}>
          <strong style={{ display: "block", marginBottom: 8 }}>Upload existing style profile</strong>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
            Already have a <code>00_style_profile.md</code>? Upload it directly — no generation needed.
          </p>
          <label className="source-card" style={{ cursor: uploading ? "wait" : "pointer", display: "inline-flex" }}>
            <FileText size={20} /> {uploading ? "Uploading…" : "Choose .md or .txt file"}
            <input
              type="file"
              accept=".md,.txt,text/markdown,text/plain"
              style={{ display: "none" }}
              disabled={uploading}
              onChange={handleUploadExistingProfile}
            />
          </label>
          {profile ? (
            <div style={{ marginTop: 12, padding: 12, background: "var(--surface-alt, #f7f9fb)", borderRadius: 8, border: "1px solid var(--border, #e5e7eb)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong>{profile.fileName}</strong>
                <span className="comp-status-pill">{profile.status}</span>
              </div>
              <pre style={{ whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto", fontSize: 12, lineHeight: 1.5, color: "var(--text, inherit)", background: "transparent" }}>
                {profile.contentText.slice(0, 2000)}{profile.contentText.length > 2000 ? "\n…(truncated)" : ""}
              </pre>
            </div>
          ) : null}
        </div>

        {/* Section 2: Generate from essay PDFs */}
        <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 10, padding: 16 }}>
          <strong style={{ display: "block", marginBottom: 8 }}>Generate from essay PDFs</strong>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
            Upload 5+ winning essays, pick a model, and generate a style profile automatically.
          </p>
          <label className="source-card active" style={{ cursor: uploading ? "wait" : "pointer", display: "inline-flex" }}>
            <UploadCloud size={20} /> {uploading ? "Uploading…" : "Upload essay PDFs"}
            <input
              type="file"
              accept=".pdf,.docx,.md,.txt,application/pdf"
              multiple
              style={{ display: "none" }}
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>

          <div style={{ marginTop: 16 }}>
            <strong style={{ display: "block", marginBottom: 8 }}>Uploaded sources ({sources.length})</strong>
            {loading && !initialLoaded ? (
              <p style={{ color: "var(--muted)" }}>Loading…</p>
            ) : sources.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>No essays uploaded yet. Drop in 5+ winning essays for best results.</p>
            ) : (
              <div className="overview-file-list">
                {sources.map((s) => (
                  <div key={s.id} className="overview-file-row">
                    <span>{s.fileName}</span>
                    <small>{(s.sizeBytes / 1024).toFixed(1)} KB</small>
                    <button className="ghost-icon" title="Delete" onClick={() => handleDelete(s.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={models.length === 0 || activeRun !== null}
            >
              {models.length === 0 ? <option value="">Loading models…</option> : null}
              {models.map((m) => (
                <option key={buildModelPickerValue(m)} value={buildModelPickerValue(m)}>
                  {m.label} ({m.provider})
                </option>
              ))}
            </select>
            <select
              value={reasoningDisabled ? "" : activeReasoningEffort}
              onChange={(e) => setReasoningEffort(e.target.value as ReasoningEffort)}
              disabled={activeRun !== null || reasoningDisabled}
            >
              {reasoningDisabled ? <option value="">No thinking effort</option> : null}
              {reasoningEfforts.map((effort) => (
                <option key={effort} value={effort}>{REASONING_LABELS[effort]}</option>
              ))}
            </select>
            <button
              className="btn-primary"
              onClick={generate}
              disabled={activeRun !== null || sources.length === 0 || !selectedModel}
            >
              {activeRun ? "Running…" : profile ? "Regenerate Style Profile" : "Generate Style Profile"}
            </button>
          </div>

          {activeRun ? (
            <div className="reference-chat-bubble assistant streaming" style={{ marginTop: 16 }}>
              <span className="reference-chat-role">Style Builder · streaming</span>
              <p style={{ whiteSpace: "pre-wrap" }}>{activeRun.tokens || "…"}</p>
            </div>
          ) : null}
        </div>

        {error ? <p style={{ color: "#c52b2b" }}>{error}</p> : null}

        {/* Save to Vault button */}
        {profile ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button className="btn-primary" onClick={handleSaveToVault}>
              Save to Vault
            </button>
            <small style={{ color: "var(--muted)" }}>Saves the current style profile so agents can use it.</small>
          </div>
        ) : null}

        {versions.length > 0 ? (
          <div>
            <strong style={{ display: "block", marginBottom: 8 }}>Version history</strong>
            <div className="overview-file-list">
              {versions.map((v) => (
                <div key={v.id} className="overview-file-row">
                  <span>v{v.versionNumber}</span>
                  <small>{v.changeSummary || "—"}</small>
                  <small>{new Date(v.createdAt).toLocaleString()}</small>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {alertMessage ? <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} /> : null}
      </section>
    </section>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="panel"><div className="panel-header"><h2>{title}</h2>{action}</div>{children}</section>;
}

function AlertModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="small-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, textAlign: "center" }}>
        <div style={{ padding: "24px 24px 8px" }}>
          <Check size={32} style={{ color: "var(--accent, #10b981)", marginBottom: 12 }} />
          <p style={{ fontSize: 15, lineHeight: 1.5 }}>{message}</p>
        </div>
        <div className="modal-actions" style={{ justifyContent: "center" }}>
          <button className="btn-primary" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}

function ValidityChecker({ assistantOpen: _assistantOpen, onToggleAssistant: _onToggleAssistant }: { assistantOpen: boolean; onToggleAssistant: () => void }) {
  return (
    <section className="screen validity-screen">
      <header className="screen-header">
        <div>
          <h1>Validity Checker</h1>
          <p>Compare agent outputs against source journals to verify citations.</p>
        </div>
      </header>
      <div className="dashboard-empty">
        <div className="dashboard-empty-icon">
          <ShieldCheck size={36} />
        </div>
        <h2>Nothing to check yet</h2>
        <p>Run a writing or research stage first, then come back to validate citations against journal PDFs.</p>
      </div>
    </section>
  );
}

function FinalOutputs({ competitions }: { competitions: Competition[] }) {
  if (competitions.length === 0) {
    return (
      <section className="screen">
        <header className="screen-header">
          <div>
            <h1>Final Outputs</h1>
            <p>All final submission files generated across competitions.</p>
          </div>
        </header>
        <div className="dashboard-empty">
          <div className="dashboard-empty-icon">
            <FileCheck size={36} />
          </div>
          <h2>No final outputs yet</h2>
          <p>Approve a Supervisor review to move its output here for download and submission.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <h1>Final Outputs</h1>
          <p>All final submission files generated across competitions.</p>
        </div>
      </header>
      <div className="output-grid">
        {competitions.map((competition) => (
          <div className="output-card" key={competition.id}>
            <FileText size={24} />
            <div>
              <strong>{competition.title} — Final Submission</strong>
              <small>Approve a Supervisor review to enable download.</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AnalyticalBoard({ darkMode, onToggleTheme }: { darkMode: boolean; onToggleTheme: () => void }) {
  const [dashboard, setDashboard] = useState(false);
  if (dashboard) return <AnalyticalDashboard onBack={() => setDashboard(false)} />;
  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <h1>Account Settings</h1>
          <p>Appearance, notifications, and workspace controls.</p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header" style={{ marginBottom: 12 }}>
          <div>
            <h2>Appearance</h2>
            <p>Pick how the interface looks across every screen.</p>
          </div>
        </div>

        <div className="profile-setting-row">
          <div>
            <strong>Theme</strong>
            <small>Choose light or dark mode.</small>
          </div>
          <div className="theme-switch" role="group" aria-label="Theme">
            <button
              type="button"
              className={!darkMode ? "active" : ""}
              onClick={() => { if (darkMode) onToggleTheme(); }}
              aria-pressed={!darkMode}
            >
              <Sun size={14} /> Light
            </button>
            <button
              type="button"
              className={darkMode ? "active" : ""}
              onClick={() => { if (!darkMode) onToggleTheme(); }}
              aria-pressed={darkMode}
            >
              <Moon size={14} /> Dark
            </button>
          </div>
        </div>
      </section>

      <div className="analytics-grid">
        <Panel title="Process Notifications">
          <div className="list-stack">
            <div className="notification-row">
              <Bell size={17} />
              <span>No notifications yet.</span>
              <span className="status-chip ready">Empty</span>
            </div>
          </div>
        </Panel>
        <Panel title="Accent Color">
          <div className="accent-grid">
            {["Emerald", "Refined Blue", "Graphite", "Teal"].map((item) => (
              <button className="source-card" key={item}>
                <Palette size={18} />
                {item}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Analytical Dashboard</h2>
            <p>Competition outcomes and academic workflow signal.</p>
          </div>
          <button className="btn-primary" onClick={() => setDashboard(true)}>
            Open Dashboard <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </section>
  );
}

function AnalyticalDashboard({ onBack }: { onBack: () => void }) {
  const kpis = [
    ["Wins", "0", "No results logged"],
    ["Podium", "0", "No top 3 finishes"],
    ["Finalist", "0", "No final rounds"],
    ["Performance Score", "0", "Weighted index 0-100"],
  ];
  const months = [
    ["Jan", 0, false],
    ["Feb", 0, false],
    ["Mar", 0, false],
    ["Apr", 0, false],
    ["May", 0, false],
    ["Jun", 0, false],
    ["Jul", 0, false],
    ["Aug", 0, false],
    ["Sep", 0, false],
    ["Oct", 0, false],
    ["Nov", 0, false],
    ["Dec", 0, false],
  ] as const;
  const fields = [
    ["KTI", 0],
    ["Essay", 0],
    ["Prototype", 0],
    ["Presentation", 0],
  ] as const;
  const results: Array<[string, string, string, string]> = [];

  return (
    <section className="analytical-dashboard-screen">
      <button className="text-link analytical-back" onClick={onBack}><ArrowLeft size={14} />Back to board</button>
      <header className="analytical-header">
        <div>
          <h1>Analytical Dashboard</h1>
          <p>Competition outcomes and academic workflow signal.</p>
        </div>
        <span className="status-chip ready">Updated today</span>
      </header>

      <div className="analytical-kpi-grid">
        {kpis.map(([label, value, note]) => (
          <article className="analytical-kpi-card" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
            <span>{note}</span>
          </article>
        ))}
      </div>

      <div className="analytical-main-grid">
        <section className="analytical-card analytical-primary-chart">
          <div className="analytical-card-eyebrow">
            <small>Primary Chart</small>
            <span>12 months</span>
          </div>
          <h2>Wins Over Time</h2>
          <div className="monthly-chart">
            {months.map(([month, height, active]) => (
              <div className="month-column" key={month}>
                <span className={`month-bar ${active ? "active" : ""}`} style={{ height: `${height}%` }} />
                <small>{month}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="analytical-card analytical-outcome-card">
          <div className="analytical-card-eyebrow">
            <small>Secondary Chart</small>
            <span>2026</span>
          </div>
          <h2>Outcome Mix</h2>
          <div className="analytical-donut"><strong>0%</strong><small>Wins</small></div>
          <div className="outcome-legend">
            {[["Wins", "0%", "win"], ["Runner-up", "0%", "runner"], ["Finalist", "0%", "finalist"]].map(([label, value, tone]) => (
              <div key={label} className={`outcome-row ${tone}`}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="analytical-secondary-grid">
        <section className="analytical-card">
          <div className="analytical-card-eyebrow"><small>Breakdown</small></div>
          <h2>Strongest Fields</h2>
          <div className="field-list">
            {fields.map(([label, value]) => (
              <div className="field-row" key={label}>
                <div><strong>{label}</strong><span>{value}%</span></div>
                <div className="field-track"><span style={{ width: `${value}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className="analytical-card">
          <div className="analytical-card-eyebrow"><small>Guidance</small></div>
          <h2>Suggestions to Improve</h2>
          <div className="guidance-empty">
            <span />
            <strong>No urgent suggestion</strong>
            <p>Keep logging results to reveal stronger patterns.</p>
          </div>
        </section>
      </div>

      <section className="analytical-card analytical-log-card">
        <div className="analytical-log-header">
          <div>
            <div className="analytical-card-eyebrow"><small>Activity Log</small></div>
            <h2>Log Competition Results</h2>
          </div>
          <button className="btn-primary reference-small-button">Add Result</button>
        </div>
        <div className="result-list">
          {results.length === 0 ? <p>No competition results logged yet.</p> : results.map(([type, title, date, result]) => (
            <div className="result-row" key={title}>
              <span className="result-type">{type}</span>
              <div>
                <strong>{title}</strong>
                <small>{date}</small>
              </div>
              <select defaultValue={result} aria-label={`${title} result`}>
                <option>Winner</option>
                <option>Runner-up</option>
                <option>Finalist</option>
              </select>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function AssistantPanel({ context, onClose }: { context: string; onClose: () => void }) {
  const { models, selectedModel: model, setSelectedModel: setModel, modelsLoading } = useModelOptions();
  const [effort, setEffort] = useState<ReasoningEffort>("medium");
  const readiness = isModelSelectionReady(model);
  const reasoningEfforts = getReasoningEffortsForModel(models, model) as ReasoningEffort[];
  const activeEffort = getActiveReasoningEffort(models, model, effort);
  const reasoningDisabled = reasoningEfforts.length === 0;
  return <div className="assistant-panel"><div className="assistant-header"><div><strong>Context AI Assistant</strong><small>{context}</small></div><button className="ghost-icon" onClick={onClose}><X size={16} /></button></div><div className="assistant-body"><div className="assistant-bubble"><Bot size={18} />Saya membaca lokasi kerja aktif dan file yang dipilih. Pilih model sebelum generate.</div></div><div className="assistant-composer"><div className="composer-controls"><select value={model} onChange={(event) => setModel(event.target.value)} disabled={models.length === 0}><option value="">{modelsLoading ? "Loading models..." : "Select model"}</option>{models.map((item) => <option key={buildModelPickerValue(item)} value={buildModelPickerValue(item)}>{item.label} ({item.provider})</option>)}</select><select value={reasoningDisabled ? "" : activeEffort} onChange={(event) => setEffort(event.target.value as ReasoningEffort)} disabled={reasoningDisabled}>{reasoningDisabled ? <option value="">No thinking effort</option> : null}{reasoningEfforts.map((item) => <option key={item} value={item}>{REASONING_LABELS[item]}</option>)}</select><button>Tools</button></div>{!readiness.ready ? <p className="notice">{readiness.message}</p> : null}<div className="composer-row"><textarea placeholder="Ask for edits, citations, next steps..." /><button className="send-button" disabled={!readiness.ready} title={`Send with ${activeEffort}`}><Send size={16} /></button></div></div></div>;
}

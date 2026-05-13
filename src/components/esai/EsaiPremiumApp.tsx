"use client";

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
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
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
import { useEffect, useMemo, useState } from "react";

import { ApiError, fetchCompetitions, createCompetition, updateCompetition, deleteCompetition, replaceCompetitionAssets } from "@/lib/esai/api";
import { filterCalendarEvents, getEventsForDate, getUpcomingEvents } from "@/lib/esai/calendar";
import {
  seedCalendarEvents,
  seedFiles,
  seedOutputVersions,
} from "@/lib/esai/seed";
import { STAGES } from "@/lib/esai/stages";
import { createValidityUploadFile, getValidityPaneFiles, type ValidityPane } from "@/lib/esai/validity";
import { getStageState, isModelSelectionReady } from "@/lib/esai/workflow";
import type { CalendarCategory, CalendarEvent, Competition, CompetitionFile, StageId } from "@/types/esai";
import { DevsAgentsWorkspace } from "./DevsAgentsWorkspace";

type Screen = "dashboard" | "calendar" | "workbench" | "validity" | "outputs" | "devs" | "profile";

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

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    window.localStorage.setItem("esai-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchCompetitions();
        if (cancelled) return;
        setCompetitions(list);
        setSelectedCompetition(list[0] ?? null);
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
      setSelectedCompetition(competitions[0] ?? null);
    }
  };

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
                  setSelectedCompetition(competition);
                  setActiveScreen("workbench");
                }}
                onDelete={async (id) => {
                  await deleteCompetition(id);
                  setCompetitions((items) => items.filter((c) => c.id !== id));
                }}
                onEdit={(competition) => {
                  setSelectedCompetition(competition);
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
            setSelectedCompetition(competition);
            setShowWizard(false);
            setActiveScreen("workbench");
          }}
        />
      ) : null}
      {overviewOpen && selectedCompetition ? (
        <CompetitionOverviewModal
          competition={selectedCompetition}
          onAdd={() => setShowWizard(true)}
          onClose={() => setOverviewOpen(false)}
          onSelect={(competition) => {
            setSelectedCompetition(competition);
            setActiveScreen("workbench");
            setOverviewOpen(false);
          }}
          onUpdated={(updated) => {
            setCompetitions((items) => items.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
            setSelectedCompetition(updated);
          }}
          onDeleted={(id) => {
            setCompetitions((items) => items.filter((c) => c.id !== id));
            setSelectedCompetition(null);
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

  if (competitions.length === 0) {
    return (
      <section className="screen dashboard-screen">
        <header className="screen-header">
          <div>
            <h1>Dashboard</h1>
            <p>Track your active academic competitions.</p>
          </div>
          <button className="btn-primary" onClick={onAdd}>
            <Plus size={17} /> Add Competition
          </button>
        </header>
        <div className="dashboard-empty">
          <div className="dashboard-empty-icon">
            <Plus size={36} />
          </div>
          <h2>No competitions yet</h2>
          <p>Add your first competition to start the workflow.</p>
          <button className="btn-primary" onClick={onAdd}>
            <Plus size={17} /> Add Competition
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="screen dashboard-screen">
      <header className="screen-header">
        <div>
          <h1>Dashboard</h1>
          <p>Track your active academic competitions.</p>
        </div>
        <button className="btn-primary" onClick={onAdd}>
          <Plus size={17} /> Add Competition
        </button>
      </header>

      <div className="dashboard-grid">
        {competitions.map((competition) => (
          <article key={competition.id} className="competition-card">
            <div className="competition-card-poster" onClick={() => onSelect(competition)}>
              {competition.posterImageUrl ? (
                <img src={competition.posterImageUrl} alt={competition.title} loading="lazy" />
              ) : (
                <div className="competition-card-poster-placeholder" />
              )}
            </div>
            <div className="competition-card-body">
              <h3 onClick={() => onSelect(competition)}>{competition.title}</h3>
              <small>{competition.institution} - {competition.category}</small>
              <div className="competition-card-actions">
                <button className="btn-ghost" onClick={() => onEdit(competition)}>Edit</button>
                <button
                  className="btn-ghost danger"
                  onClick={() => setPendingDelete(competition)}
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
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
  onAdd,
  onClose,
  onSelect,
  onUpdated,
  onDeleted,
}: {
  competition: Competition;
  onAdd: () => void;
  onClose: () => void;
  onSelect: (competition: Competition) => void;
  onUpdated: (competition: Competition) => void;
  onDeleted: (id: string) => void;
}) {
  const [draft, setDraft] = useState({
    title: competition.title,
    category: competition.category,
    institution: competition.institution,
    deadline: competition.deadline,
    registrationLink: competition.registrationLink ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);

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
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.message ?? "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  const replaceFile = async (role: "poster" | "guidebook", file: File) => {
    const form = new FormData();
    form.set(role, file);
    try {
      const updated = await replaceCompetitionAssets(competition.id, form);
      onUpdated(updated);
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.message ?? "Replace failed.");
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="overview-modal">
        <div className="modal-header">
          <h2>Competition Overview</h2>
          <button className="ghost-icon" onClick={onClose}>
            <X size={18} />
          </button>
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
            <input value={draft.registrationLink} onChange={(e) => setDraft({ ...draft, registrationLink: e.target.value })} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <label className="btn-ghost" style={{ cursor: "pointer" }}>
            Replace poster
            <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceFile("poster", f); }} />
          </label>
          <label className="btn-ghost" style={{ cursor: "pointer" }}>
            Replace guidebook
            <input type="file" accept=".pdf,.docx,.md,.txt" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceFile("guidebook", f); }} />
          </label>
        </div>

        {error ? <p style={{ color: "#c52b2b" }}>{error}</p> : null}

        <div className="modal-actions">
          <button className="btn-ghost danger" onClick={() => setPendingDelete(true)}>Delete</button>
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

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
      </div>
    </div>
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
  const [error, setError] = useState<{ message: string; correlationId?: string } | null>(null);

  const posterOk = poster && /^image\/(png|jpeg|webp)$/.test(poster.type) && poster.size <= 5 * 1024 * 1024;
  const guidebookOk = guidebook && /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/markdown|text\/plain)$/.test(guidebook.type) && guidebook.size <= 20 * 1024 * 1024;
  const canFinish = Boolean(fields.title.trim() && posterOk && guidebookOk);

  const finish = async () => {
    if (!canFinish || submitting) return;
    setSubmitting(true);
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
      onFinish(competition);
    } catch (err) {
      const ae = err as ApiError;
      setError({ message: ae.message ?? "Failed to create competition.", correlationId: ae.correlationId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="wizard">
        <div className="modal-header">
          <h2>Setup Kompetisi Baru</h2>
          <button className="ghost-icon" onClick={onCancel}>
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
            <h3>Semua Siap</h3>
            <p>AI akan memetakan pipeline pengerjaan berdasarkan guidebook dan metadata Anda.</p>
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
            onClick={() => (step < 3 ? setStep(step + 1) : finish())}
            disabled={(step === 2 && !(posterOk && guidebookOk)) || (step === 3 && !canFinish) || submitting}
          >
            {step === 3 ? (submitting ? "Mengunggah…" : "Mulai Sekarang") : "Lanjut"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarScreen() {
  const [events, setEvents] = useState(seedCalendarEvents);
  const [view, setView] = useState<"month" | "week" | "day" | "list">("month");
  const [currentDate, setCurrentDate] = useState(new Date("2026-05-07T00:00:00.000Z"));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CalendarCategory | "All">("All");
  const [tag, setTag] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const filteredEvents = filterCalendarEvents(events, { query, category, tag });
  const upcoming = getUpcomingEvents(filteredEvents, currentDate, 5);
  const days = useMemo(() => Array.from({ length: 35 }, (_, index) => new Date(2026, 4, index + 1)), []);
  const addEvent = () => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() + 2);
    setEvents((items) => [...items, { id: `ev-${Date.now()}`, title: "Review reminder", description: "User-created review checkpoint.", startTime: start.toISOString(), endTime: new Date(start.getTime() + 3600000).toISOString(), category: "Review", color: "accent", tags: ["personal"], source: "user" }]);
    setModalOpen(false);
  };
  return (
    <section className="screen calendar-screen">
      <header className="screen-header"><div><h1>Calendar</h1><p>Deadlines, guidebook dates, agent tasks, review reminders, and submission milestones.</p></div><button className="btn-primary" onClick={() => setModalOpen(true)}><Plus size={17} />New Event</button></header>
      <div className="calendar-toolbar"><div className="segmented">{(["month", "week", "day", "list"] as const).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item}</button>)}</div><div className="date-nav"><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7))}><ChevronLeft size={16} /></button><button onClick={() => setCurrentDate(new Date("2026-05-07T00:00:00.000Z"))}>Today</button><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7))}><ChevronRight size={16} /></button></div><label className="search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events" /></label></div>
      <div className="filter-row"><select value={category} onChange={(event) => setCategory(event.target.value as CalendarCategory | "All")}>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={tag} onChange={(event) => setTag(event.target.value)}>{tags.map((item) => <option key={item}>{item}</option>)}</select><span className="filter-chip">{category}</span><span className="filter-chip">{tag}</span></div>
      <div className={`calendar-layout ${view}`}><div className="calendar-board">{view === "month" ? days.map((day) => { const dayEvents = getEventsForDate(filteredEvents, day); return <div key={day.toISOString()} className="calendar-cell"><strong>{day.getDate()}</strong>{dayEvents.slice(0, 2).map((event) => <span key={event.id} className={`event-chip ${event.color}`}>{event.title}</span>)}</div>; }) : filteredEvents.map((event) => <EventRow key={event.id} event={event} onDelete={() => setEvents((items) => items.filter((item) => item.id !== event.id))} />)}</div><aside className="upcoming-panel"><h2>Upcoming Events</h2>{upcoming.map((event) => <EventRow key={event.id} event={event} compact onDelete={() => setEvents((items) => items.filter((item) => item.id !== event.id))} />)}</aside></div>
      {modalOpen ? <div className="modal-backdrop"><div className="small-modal"><div className="modal-header"><h2>New Event</h2><button className="ghost-icon" onClick={() => setModalOpen(false)}><X size={18} /></button></div><p>Create a local event now. Supabase persistence is wired through /api/calendar-events when credentials are available.</p><div className="modal-actions"><button className="btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn-primary" onClick={addEvent}>Create</button></div></div></div> : null}
    </section>
  );
}

function EventRow({ event, compact = false, onDelete }: { event: CalendarEvent; compact?: boolean; onDelete: () => void }) {
  return <div className={`event-row ${compact ? "compact" : ""}`}><span className={`event-dot ${event.color}`} /><div><strong>{event.title}</strong><small>{new Date(event.startTime).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} - {event.category}</small></div><button className="ghost-icon" onClick={onDelete}><Trash2 size={14} /></button></div>;
}

function Workbench({ competition, assistantOpen, darkMode, onBack, onToggleAssistant, onToggleTheme }: { competition: Competition; assistantOpen: boolean; darkMode: boolean; onBack: () => void; onToggleAssistant: () => void; onToggleTheme: () => void }) {
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [currentStageId, setCurrentStageId] = useState<StageId>(competition.currentStageId);
  const [outputOpen, setOutputOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const approvedOutputNames = seedFiles.filter((file) => file.approved).map((file) => file.fileName);
  const currentStage = STAGES.find((stage) => stage.id === currentStageId) ?? STAGES[0];
  const currentStageIndex = STAGES.findIndex((stage) => stage.id === currentStage.id);
  const nextStage = STAGES[currentStageIndex + 1];
  const activeInputName = currentStage.input;

  return (
    <section className="reference-workbench">
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
            const state = getStageState(stage.id, competition.currentStageId, approvedOutputNames);
            const active = stage.id === currentStageId;

            return (
              <button
                key={stage.id}
                disabled={state.status === "locked"}
                className={`reference-stage-row ${state.status} ${active ? "selected" : ""}`}
                onClick={() => setCurrentStageId(stage.id)}
                title={stage.label}
              >
                <span className="reference-stage-dot">
                  {state.status === "completed" ? <Check size={10} /> : state.status === "locked" ? <Lock size={9} /> : null}
                </span>
                {!railCollapsed ? (
                  <span className="reference-stage-copy">
                    <strong>{stage.label}</strong>
                    <small>Needs: {stage.input}</small>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>

      <div className="reference-workbench-center">
        <div className="reference-stage-summary-strip">
          <FileControl label="Input file" fileName={activeInputName} source="Agent Output - Research output" />
          <FileControl label="Output file" fileName={currentStage.output} source="Produced by selected stage" />
        </div>

        <div className="reference-ready-line">
          <span><Bot size={18} /></span>
          <p><strong>Input gate:</strong> this stage can run after its connected source artifacts are approved.</p>
        </div>

        <section className="reference-agent-question">
          <div className="reference-choice-header">
            <span>Agent question</span>
            <small>from active run</small>
          </div>
          <div className="reference-choice-body">
            <h2>No active choice request.</h2>
            <p>When an agent emits `needs_user_choice`, the options will appear here and will be saved to the run history.</p>
          </div>
        </section>

        <section className="reference-handoff">
          <div>
            <small>Stage Handoff</small>
            <h2>Approve this stage output to unlock connected downstream inputs.</h2>
          </div>
          <div className="reference-handoff-actions">
            <button className="reference-text-button">Review</button>
            <button className="btn-primary reference-small-button"><Check size={14} /> Use MD</button>
          </div>
        </section>

        <button className="btn-primary reference-review-ai" onClick={onToggleAssistant}>
          <Sparkles size={16} /> Review with AI
        </button>

        <div className="reference-chat-composer">
          <textarea placeholder={`Message ${currentStage.label}...`} />
          <div className="reference-chat-controls">
            <select defaultValue="GPT-5.4"><option>GPT-5.4</option></select>
            <select defaultValue="Medium"><option>Medium</option><option>High</option></select>
            <button className="btn-secondary">Tools</button>
            <button className="send-button"><Send size={17} /></button>
          </div>
        </div>
      </div>

      <aside className="reference-current-file">
        <div className="reference-current-card">
          <div className="reference-current-head">
            <div>
              <small>Current File</small>
              <strong>{currentStage.output}</strong>
            </div>
            <span>Drafting</span>
          </div>
          <div className="reference-unlocks">
            <small>Unlocks Next</small>
            <p>{nextStage ? `${nextStage.label} can run after this file is approved.` : "All required stage outputs are ready for final review."}</p>
          </div>
          <div className="reference-skeleton">
            <span />
            <span />
            <span />
          </div>
          <button className="reference-fullscreen-button" onClick={() => setOutputOpen(true)}>
            <Maximize2 size={15} /> Full screen
          </button>
        </div>
      </aside>

      {assistantOpen ? (
        <aside className="workspace-assistant reference-assistant">
          <AssistantPanel context={`Workbench stage: ${currentStage.label}. Input: ${activeInputName}. Output: ${currentStage.output}.`} onClose={onToggleAssistant} />
        </aside>
      ) : null}
      {historyOpen ? <VersionHistory onClose={() => setHistoryOpen(false)} /> : null}
      {outputOpen ? <FullscreenEditor fileName={currentStage.output} onClose={() => setOutputOpen(false)} onAskAi={onToggleAssistant} onHistory={() => setHistoryOpen((value) => !value)} /> : null}
    </section>
  );
}

function FileControl({ label, fileName, source }: { label: string; fileName: string; source: string }) {
  return <button className="file-control reference-file-control"><span><small>{label}</small><strong>{fileName}</strong><em>{source}</em></span>{label === "Output file" ? <FileText size={16} /> : <span>Agent Output</span>}</button>;
}

function VersionHistory({ onClose }: { onClose: () => void }) {
  return <div className="floating-panel"><div className="modal-header"><h2>Version History</h2><button className="ghost-icon" onClick={onClose}><X size={16} /></button></div>{seedOutputVersions.map((version) => <div key={version.id} className="version-row"><strong>Version {version.versionNumber}</strong><small>{version.changeSummary}</small></div>)}</div>;
}

function FullscreenEditor({ fileName, onClose, onAskAi, onHistory }: { fileName: string; onClose: () => void; onAskAi: () => void; onHistory: () => void }) {
  return <div className="reference-editor-overlay"><div className="reference-editor-shell"><header className="reference-editor-header"><div><small>Editable Stage Output</small><strong>{fileName}</strong></div><div><button className="reference-text-button" onClick={onAskAi}>Ask AI</button><button className="reference-text-button" onClick={onHistory}>History</button><button className="btn-primary reference-small-button" onClick={onClose}>Save</button><button className="reference-round-button" onClick={onClose}><Minimize2 size={15} /></button></div></header><main className="reference-editor-body"><div className="reference-editor-toolbar"><button>B</button><button><em>I</em></button><button></button><button></button><button>H2</button><span>Competition Vault / {fileName}</span></div><article className="reference-document-page"><h1>Stage Output Draft</h1><p>This editable output file is connected to the Competition Vault. Users can revise paragraphs, request AI help, and save versions before approving the file for the next stage.</p><h2>Working Notes</h2><p><strong>Required input:</strong> linked stage context, guidebook rules, and previous approved output.</p><p><strong>Next step:</strong> clean the argument, verify dependencies, then save this as the next approved version.</p></article></main></div></div>;
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
                    <label>Default Model<input placeholder={executionMode === "anthropic" ? "claude-opus-4" : executionMode === "openrouter" ? "openrouter/auto" : "gpt-4.1"} /></label>
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
  const [styleSaved, setStyleSaved] = useState(false);
  const tabs = [["style", "Style Builder", Sparkles], ["agents", "Agents", Bot], ["settings", "Settings", SlidersHorizontal], ["byok", "BYOK Models", KeyRound]] as const;
  return <section className="screen"><header className="screen-header"><div><h1>Devs</h1><p>Create developer-style outputs that competition agents can request from the vault.</p></div></header><div className="dev-tabs">{tabs.map(([id, label, Icon]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={16} />{label}</button>)}</div>{tab === "style" ? <Panel title="Style Builder" action={<button className="btn-primary" onClick={() => setStyleSaved(true)}>{styleSaved ? "Saved" : "Save to Vault"}</button>}><div className="source-options"><button className="source-card active"><UploadCloud size={20} />Upload PDF for analysis</button><button className="source-card"><FileText size={20} />Upload style_profile.md</button></div><textarea className="document-textarea" defaultValue={"# 00_style_profile.md\n\nWrite in a direct, academic, evidence-first Indonesian competition style."} /></Panel> : null}{tab === "agents" ? <DevsAgentsWorkspace /> : null}{tab === "settings" ? <Panel title="Workflow Guardrails">{["Require approval before next stage unlock", "Allow user-uploaded input override", "Strict citation checks", "Auto-create calendar reminders"].map((item) => <label className="toggle-row" key={item}><span>{item}</span><input type="checkbox" defaultChecked /></label>)}</Panel> : null}{tab === "byok" ? <ByokSettings /> : null}</section>;
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="panel"><div className="panel-header"><h2>{title}</h2>{action}</div>{children}</section>;
}

function ValidityChecker({ assistantOpen, onToggleAssistant }: { assistantOpen: boolean; onToggleAssistant: () => void }) {
  const [files, setFiles] = useState(seedFiles);
  const outputFiles = getValidityPaneFiles(files, "output");
  const inputFiles = getValidityPaneFiles(files, "input");
  const [selectedOutputId, setSelectedOutputId] = useState(outputFiles[0]?.id ?? "");
  const [selectedInputId, setSelectedInputId] = useState(inputFiles[0]?.id ?? "");
  const [vaultPane, setVaultPane] = useState<ValidityPane | null>(null);
  const [claim, setClaim] = useState("");
  const selectedOutput = outputFiles.find((file) => file.id === selectedOutputId) ?? outputFiles[0];
  const selectedInput = inputFiles.find((file) => file.id === selectedInputId) ?? inputFiles[0];

  const uploadToPane = (pane: ValidityPane) => {
    const next = createValidityUploadFile(pane, files.length + 1);
    setFiles((items) => [...items, next]);
    if (pane === "output") setSelectedOutputId(next.id);
    if (pane === "input") setSelectedInputId(next.id);
  };

  return (
    <section className="screen validity-screen">
      <div className="validity-topbar">
        <ValidityFileStrip
          pane="output"
          title="Output"
          files={outputFiles}
          selectedId={selectedOutput?.id}
          onSelect={setSelectedOutputId}
          onOpenVault={() => setVaultPane("output")}
          onUpload={() => uploadToPane("output")}
        />
        <ValidityFileStrip
          pane="input"
          title="Input Journal"
          files={inputFiles}
          selectedId={selectedInput?.id}
          onSelect={setSelectedInputId}
          onOpenVault={() => setVaultPane("input")}
          onUpload={() => uploadToPane("input")}
        />
      </div>

      <div className="validity-workspace enhanced">
        <DocumentPane title="Output" file={selectedOutput} pane="output" />
        <DocumentPane title="Input Journal" file={selectedInput} pane="input" />
      </div>

      <div className="claim-box">
        <label>Selected claim<textarea value={claim} onChange={(event) => setClaim(event.target.value)} /></label>
        <button className="btn-primary" onClick={onToggleAssistant}><ShieldCheck size={16} />Check Citation</button>
      </div>

      {assistantOpen ? <div className="validity-bottom-ai"><AssistantPanel context={`Claim: ${claim}. Output: ${selectedOutput?.fileName}. Journal: ${selectedInput?.fileName}.`} onClose={onToggleAssistant} /></div> : null}

      {vaultPane ? (
        <ValidityVaultModal
          pane={vaultPane}
          files={vaultPane === "output" ? outputFiles : inputFiles}
          selectedId={vaultPane === "output" ? selectedOutput?.id : selectedInput?.id}
          onClose={() => setVaultPane(null)}
          onUpload={() => uploadToPane(vaultPane)}
          onSelect={(file) => {
            if (vaultPane === "output") setSelectedOutputId(file.id);
            if (vaultPane === "input") setSelectedInputId(file.id);
            setVaultPane(null);
          }}
        />
      ) : null}
    </section>
  );
}

function ValidityFileStrip({
  pane,
  title,
  files,
  selectedId,
  onSelect,
  onOpenVault,
  onUpload,
}: {
  pane: ValidityPane;
  title: string;
  files: CompetitionFile[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onOpenVault: () => void;
  onUpload: () => void;
}) {
  return (
    <section className="validity-strip">
      <div className="validity-strip-heading">
        <h1>{title}</h1>
        <button className="btn-secondary" onClick={onOpenVault}>Vault</button>
      </div>
      <div className="pdf-tab-row">
        {files.map((file) => (
          <button key={file.id} className={`pdf-tab ${selectedId === file.id ? "active" : ""}`} onClick={() => onSelect(file.id)}>
            {file.fileName}
          </button>
        ))}
        <button className="pdf-tab upload" onClick={onUpload}>{pane === "output" ? "+ Upload" : "+"}</button>
      </div>
    </section>
  );
}

function DocumentPane({ title, file, pane }: { title: string; file?: CompetitionFile; pane: ValidityPane }) {
  return (
    <section className="validity-pane">
      <article className="pdf-page">
        <small>{file?.fileName.toUpperCase()}</small>
        {pane === "output" ? (
          <>
            <h2>Adsorbent Material Basis</h2>
            <p>{file?.contentText ?? "Select or upload an output file to review its claims."}</p>
            <button className="highlighted-claim">No selected claim yet.</button>
            <p>Selected output text will appear here after upload or agent generation.</p>
            <p>Zeolite 13X contributes selective CO2 uptake under dry gas conditions.</p>
          </>
        ) : (
          <>
            <p>Paragraph 3 discusses chemically activated porous carbon derived from plastic waste and its relationship to surface area and CO2 uptake.</p>
            <p className="support-highlight">Highlight paragraph used as citation: activation improves pore development and adsorption capacity under the tested conditions.</p>
            <p>{file?.contentText ?? "Select or upload a journal PDF to compare evidence."}</p>
            <p className="risk-highlight">Evidence risks will appear here after parsing and comparison.</p>
            <div className="supported-box"><Check size={16} /><span><strong>Supported paragraph</strong><small>AI can save this paragraph as evidence.</small></span></div>
          </>
        )}
      </article>
      <span className="sr-only">{title}</span>
    </section>
  );
}

function ValidityVaultModal({
  pane,
  files,
  selectedId,
  onClose,
  onUpload,
  onSelect,
}: {
  pane: ValidityPane;
  files: CompetitionFile[];
  selectedId?: string;
  onClose: () => void;
  onUpload: () => void;
  onSelect: (file: CompetitionFile) => void;
}) {
  const title = pane === "output" ? "Output Vault" : "Input Journal Vault";
  const subtitle = pane === "output" ? "Output files for the left document pane." : "Journal PDF files for the right document pane.";
  const label = pane === "output" ? "OUTPUT FILES" : "INPUT JOURNAL PDFS";

  return (
    <div className="vault-overlay" onClick={onClose}>
      <section className="vault-dialog" onClick={(event) => event.stopPropagation()}>
        <header className="vault-header">
          <div>
            <small>Vault</small>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="btn-ghost" onClick={onUpload}>Upload</button>
        </header>
        <div className="vault-body">
          <small>{label}</small>
          <div className="vault-file-list">
            {files.map((file) => (
              <button key={file.id} className={`vault-file-row ${selectedId === file.id ? "active" : ""}`} onClick={() => onSelect(file)}>
                <span className="vault-thumb" />
                <span className="vault-file-main"><strong>{file.fileName}</strong><em>{file.sourceDetail}</em></span>
                <span>{file.fileSource === "agent_output" ? "Agent output" : "User input"}</span>
                <span>Ready</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function FinalOutputs({ competitions }: { competitions: Competition[] }) {
  return <section className="screen"><header className="screen-header"><div><h1>Final Outputs</h1><p>All final submission files generated across competitions.</p></div></header><div className="output-grid">{competitions.map((competition) => <div className="output-card" key={competition.id}><FileText size={24} /><div><strong>{competition.title} - Final Submission</strong><small>PDF - generated output route ready</small></div><button className="ghost-icon"><Download size={18} /></button></div>)}</div></section>;
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
  const [model, setModel] = useState("GPT-5.4");
  const [effort, setEffort] = useState("medium");
  const readiness = isModelSelectionReady(model);
  return <div className="assistant-panel"><div className="assistant-header"><div><strong>Context AI Assistant</strong><small>{context}</small></div><button className="ghost-icon" onClick={onClose}><X size={16} /></button></div><div className="assistant-body"><div className="assistant-bubble"><Bot size={18} />Saya membaca lokasi kerja aktif dan file yang dipilih. Pilih model sebelum generate.</div></div><div className="assistant-composer"><div className="composer-controls"><select value={model} onChange={(event) => setModel(event.target.value)}><option value="">Select model</option><option>GPT-5.4</option><option>gpt-5.5</option><option>openrouter/auto</option></select><select value={effort} onChange={(event) => setEffort(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="xhigh">Extra High</option></select><button>Tools</button></div>{!readiness.ready ? <p className="notice">{readiness.message}</p> : null}<div className="composer-row"><textarea placeholder="Ask for edits, citations, next steps..." /><button className="send-button" disabled={!readiness.ready} title={`Send with ${effort}`}><Send size={16} /></button></div></div></div>;
}

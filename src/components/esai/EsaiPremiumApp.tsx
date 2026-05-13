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
  KeyRound,
  LayoutDashboard,
  Lock,
  Maximize2,
  MessageCircle,
  Minimize2,
  Moon,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { filterCalendarEvents, getEventsForDate, getUpcomingEvents } from "@/lib/esai/calendar";
import { buildCompetitionOverview } from "@/lib/esai/competition-overview";
import {
  seedCalendarEvents,
  seedCompetitions,
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
  const [competitions, setCompetitions] = useState(seedCompetitions);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(seedCompetitions[0] ?? null);
  const [showWizard, setShowWizard] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    window.localStorage.setItem("esai-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

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
        darkMode={darkMode}
        onToggleAssistant={() => setAssistantOpen((value) => !value)}
        onToggleTheme={() => setDarkMode((value) => !value)}
        onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
        onOpenScreen={openScreen}
      />

      <div className={`content-shell ${sidebarCollapsed ? "collapsed" : ""}`}>
        <main className={`main-surface ${assistantOpen && activeScreen !== "workbench" && activeScreen !== "validity" ? "with-assistant" : ""}`}>
          {activeScreen === "dashboard" && (
            <DashboardScreen
              competitions={competitions}
              onAdd={() => setShowWizard(true)}
              onSelect={(competition) => {
                setSelectedCompetition(competition);
                setActiveScreen("workbench");
              }}
            />
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
        />
      ) : null}
    </div>
  );
}

function Sidebar(props: {
  activeScreen: Screen;
  collapsed: boolean;
  assistantOpen: boolean;
  darkMode: boolean;
  onToggleAssistant: () => void;
  onToggleTheme: () => void;
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
        <button className="sidebar-item" onClick={props.onToggleTheme}>
          {props.darkMode ? <Sun size={18} /> : <Moon size={18} />}
          {!props.collapsed ? <span>{props.darkMode ? "Light" : "Dark"}</span> : null}
        </button>
        <button className={`profile-button ${props.activeScreen === "profile" ? "active" : ""}`} onClick={() => props.onOpenScreen("profile")}>
          <span className="avatar">AS</span>
          {!props.collapsed ? <span><strong>User Account</strong><small>Analytical Board</small></span> : null}
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
}: {
  competitions: Competition[];
  onAdd: () => void;
  onSelect: (competition: Competition) => void;
}) {
  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <h1>Dashboard</h1>
          <p>Select a competition or create one. No demo competitions are loaded.</p>
        </div>
        <button className="btn-primary" onClick={onAdd}>
          <Plus size={17} />
          Add Competition
        </button>
      </header>

      {competitions.length === 0 ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>No competitions yet</h2>
              <p>Create a competition to attach guidebooks, choose a compartment, and build the agent pipeline.</p>
            </div>
            <button className="btn-secondary" onClick={onAdd}>
              <Plus size={16} />
              Create
            </button>
          </div>
        </section>
      ) : (
        <div className="output-grid">
          {competitions.map((competition) => (
            <button className="output-card" key={competition.id} onClick={() => onSelect(competition)}>
              <FileText size={24} />
              <div>
                <strong>{competition.title}</strong>
                <small>
                  {competition.category} - {competition.deadline}
                </small>
              </div>
              <ArrowRight size={18} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function CompetitionOverviewModal({ competition, onAdd, onClose, onSelect }: { competition: Competition; onAdd: () => void; onClose: () => void; onSelect: (competition: Competition) => void }) {
  const overview = buildCompetitionOverview(competition, seedFiles);

  return (
    <div className="reference-overview-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="reference-overview-screen" onClick={(event) => event.stopPropagation()}>
        <div className="reference-overview-inner">
        <header className="reference-overview-title">
          <div>
            <h1>{overview.title}</h1>
            <p>{overview.subtitle}</p>
          </div>
          <div className="reference-overview-actions">
            <button className="btn-primary reference-submit">Submit Final</button>
            <button className="ghost-icon" onClick={onClose} aria-label="Close overview"><X size={18} /></button>
          </div>
        </header>

        <section className="reference-card">
          <div className="reference-section-heading">
            <div>
              <h2>Info</h2>
              <p>Competition status, deadline, and registration access.</p>
            </div>
            <span className="reference-status">Active</span>
          </div>
          <div className="reference-info-grid">
            <div className="reference-info-tile">
              <small>Deadline</small>
              <strong>{overview.deadline}</strong>
              <span>Auto-synced into Calendar.</span>
            </div>
            <div className="reference-info-tile">
              <small>Progress</small>
              <strong className="accent">{overview.progress}%</strong>
              <div className="reference-progress"><span style={{ width: `${overview.progress}%` }} /></div>
            </div>
            <div className="reference-info-tile">
              <small>Link Registration</small>
              <a href={competition.registrationLink ?? "#"}>{overview.registrationDisplay}</a>
              <span>Pinned for every stage and output export.</span>
            </div>
          </div>
        </section>

        <section className="reference-card">
          <div className="reference-section-heading">
            <div>
              <h2>Asset Maker</h2>
              <p>Create registration assets without leaving the competition workspace.</p>
            </div>
            <button className="btn-primary reference-small-button">Generate Combined Photo</button>
          </div>
          <div className="reference-asset-grid">
            <div>
              <div className="reference-asset-preview">
                <div className="reference-twibbon-frame">
                  <span className="reference-photo-placeholder" />
                </div>
              </div>
              <div className="reference-preview-caption">
                <strong>Twibbon + Photo Preview</strong>
                <span>Drag photo to reposition</span>
              </div>
            </div>
            <div className="reference-asset-side">
              <div className="reference-panel">
                <small>Photo Controls</small>
                <label>
                  <span>Photo position</span>
                  <input type="range" defaultValue="58" />
                </label>
                <label>
                  <span>Scale</span>
                  <input type="range" defaultValue="44" />
                </label>
              </div>
              <div className="reference-panel">
                <small>Instagram Caption</small>
                <textarea placeholder="Write a caption after competition metadata is saved." />
              </div>
            </div>
          </div>
        </section>

        <section className="reference-card">
          <div className="reference-section-heading">
            <div>
              <h2>Files</h2>
              <p>Separate raw uploads from AI-generated stage outputs.</p>
            </div>
            <button className="reference-text-button" onClick={onAdd}>Add Files</button>
          </div>
          <div className="reference-files-grid">
            <div className="reference-file-group">
              <h3>User Uploaded Content</h3>
              <div className="reference-file-list">
                {overview.userUploadedFiles.map((file) => (
                  <div key={file.name} className="reference-file-row">
                    <strong>{file.name}</strong>
                    <span>{file.state}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="reference-file-group">
              <h3>Output of AI Agent</h3>
              <div className="reference-file-list">
                {overview.agentOutputFiles.map((file) => (
                  <button key={file.name} className="reference-file-row interactive" onClick={() => onSelect(competition)}>
                    <strong>{file.name}</strong>
                    <span>{file.state}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
        </div>
      </section>
    </div>
  );
}

function AddCompetitionWizard({ onCancel, onFinish }: { onCancel: () => void; onFinish: (competition: Competition) => void }) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(() => {
    const saved = getStoredValue("esai-add-competition-draft", "");
    return saved ? JSON.parse(saved) as { title: string; category: string; institution: string; deadline: string; registrationLink: string } : { title: "", category: "Sains & Teknologi", institution: "", deadline: "2026-09-01", registrationLink: "" };
  });
  useEffect(() => { window.localStorage.setItem("esai-add-competition-draft", JSON.stringify(draft)); }, [draft]);
  const finish = () => {
    window.localStorage.removeItem("esai-add-competition-draft");
    onFinish({ id: `comp-${Date.now()}`, title: draft.title.trim() || "Untitled Competition", category: draft.category, institution: draft.institution.trim() || "Institution", status: "Setup", progress: 0, deadline: draft.deadline, registrationLink: draft.registrationLink, currentStageId: "onboarding", posterTone: "new brief" });
  };
  return (
    <div className="modal-backdrop"><div className="wizard">
      <div className="modal-header"><h2>Setup Kompetisi Baru</h2><button className="ghost-icon" onClick={onCancel}><X size={18} /></button></div>
      <div className="step-track">{[1, 2, 3].map((item) => <span key={item} className={item <= step ? "active" : ""} />)}</div>
      {step === 1 ? <div className="form-grid"><label>Nama Kompetisi<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Competition name" /></label><label>Kategori<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option>Sains & Teknologi</option><option>Sosial & Humaniora</option><option>Inovasi Digital</option><option>KTI</option></select></label><label>Institusi<input value={draft.institution} onChange={(event) => setDraft({ ...draft, institution: event.target.value })} placeholder="Institution" /></label><label>Deadline<input type="date" value={draft.deadline} onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} /></label><label className="wide">Link pendaftaran<input value={draft.registrationLink} onChange={(event) => setDraft({ ...draft, registrationLink: event.target.value })} placeholder="https://..." /></label></div> : null}
      {step === 2 ? <div className="upload-zone"><UploadCloud size={30} /><strong>Upload Guidebook / Poster</strong><span>PDF, PNG, JPG, or WebP. Upload routes are Supabase-ready.</span></div> : null}
      {step === 3 ? <div className="success-pane"><Check size={34} /><h3>Semua Siap</h3><p>AI akan memetakan pipeline pengerjaan berdasarkan guidebook dan metadata Anda.</p></div> : null}
      <div className="modal-actions"><button className="btn-ghost" onClick={() => (step > 1 ? setStep(step - 1) : onCancel())}>{step === 1 ? "Batal" : "Kembali"}</button><button className="btn-primary" onClick={() => (step < 3 ? setStep(step + 1) : finish())}>{step === 3 ? "Mulai Sekarang" : "Lanjut"}</button></div>
    </div></div>
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

function DevsScreen() {
  const [tab, setTab] = useState("style");
  const [styleSaved, setStyleSaved] = useState(false);
  const tabs = [["style", "Style Builder", Sparkles], ["agents", "Agents", Bot], ["settings", "Settings", SlidersHorizontal], ["byok", "BYOK Models", KeyRound]] as const;
  return <section className="screen"><header className="screen-header"><div><h1>Devs</h1><p>Create developer-style outputs that competition agents can request from the vault.</p></div></header><div className="dev-tabs">{tabs.map(([id, label, Icon]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={16} />{label}</button>)}</div>{tab === "style" ? <Panel title="Style Builder" action={<button className="btn-primary" onClick={() => setStyleSaved(true)}>{styleSaved ? "Saved" : "Save to Vault"}</button>}><div className="source-options"><button className="source-card active"><UploadCloud size={20} />Upload PDF for analysis</button><button className="source-card"><FileText size={20} />Upload style_profile.md</button></div><textarea className="document-textarea" defaultValue={"# 00_style_profile.md\n\nWrite in a direct, academic, evidence-first Indonesian competition style."} /></Panel> : null}{tab === "agents" ? <DevsAgentsWorkspace /> : null}{tab === "settings" ? <Panel title="Workflow Guardrails">{["Require approval before next stage unlock", "Allow user-uploaded input override", "Strict citation checks", "Auto-create calendar reminders"].map((item) => <label className="toggle-row" key={item}><span>{item}</span><input type="checkbox" defaultChecked /></label>)}</Panel> : null}{tab === "byok" ? <Panel title="BYOK Models"><div className="form-grid"><label>Provider<select><option>OpenClaw CLI</option><option>Codex CLI</option><option>OpenRouter</option><option>OpenAI-compatible</option></select></label><label>API Key<input type="password" placeholder="Stored server-side only" /></label><label>Default Model<input placeholder="GPT-5.4" /></label><label>Reasoning<select><option>Medium</option><option>High</option><option>Extra High</option></select></label></div><button className="btn-secondary">Test Connection</button></Panel> : null}</section>;
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
  return <section className="screen"><header className="screen-header"><div><h1>Analytical Board</h1><p>Progress notifications, website look, accent controls, and analytics entry.</p></div><button className="btn-secondary" onClick={onToggleTheme}>{darkMode ? <Sun size={16} /> : <Moon size={16} />}Theme</button></header><div className="analytics-grid"><Panel title="Process Notifications"><div className="list-stack"><div className="notification-row"><Bell size={17} /><span>No notifications yet.</span><span className="status-chip ready">Empty</span></div></div></Panel><Panel title="Website Look"><div className="accent-grid">{["Emerald", "Refined Blue", "Graphite", "Teal"].map((item) => <button className="source-card" key={item}><Palette size={18} />{item}</button>)}</div></Panel></div><section className="panel"><div className="panel-header"><div><h2>Analytical Dashboard</h2><p>Competition outcomes and academic workflow signal.</p></div><button className="btn-primary" onClick={() => setDashboard(true)}>Open Dashboard <ArrowRight size={16} /></button></div></section></section>;
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

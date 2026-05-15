"use client";

import { CalendarDays, ExternalLink, FileText, Trash2, UploadCloud, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { deleteFile, fetchCompetitionFiles, getFileSignedUrl, replaceCompetitionAssets, updateCompetition, type ApiError } from "@/lib/esai/api";
import { STAGES } from "@/lib/esai/stages";
import type { Competition, CompetitionFile } from "@/types/esai";
import { FileDropZone } from "./FileDropZone";

type CompetitionOverviewProps = {
  competition: Competition | null;
  cachedFiles?: CompetitionFile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (competition: Competition) => void;
  onDeleted: (id: string) => void;
  onFilesLoaded: (competitionId: string, files: CompetitionFile[]) => void;
};

function displayDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function displayLink(value?: string) {
  if (!value) return "Belum diisi";
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return value.replace(/^https?:\/\//, "");
  }
}

export function CompetitionOverview({
  competition,
  cachedFiles,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
  onFilesLoaded,
}: CompetitionOverviewProps) {
  if (!competition) return null;

  return (
    <CompetitionOverviewContent
      key={competition.id}
      competition={competition}
      cachedFiles={cachedFiles}
      open={open}
      onOpenChange={onOpenChange}
      onUpdated={onUpdated}
      onDeleted={onDeleted}
      onFilesLoaded={onFilesLoaded}
    />
  );
}

function CompetitionOverviewContent({
  competition,
  cachedFiles,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
  onFilesLoaded,
}: Omit<CompetitionOverviewProps, "competition"> & { competition: Competition }) {
  const [draft, setDraft] = useState({
    title: competition.title,
    category: competition.category,
    institution: competition.institution,
    deadline: competition.deadline,
    registrationLink: competition.registrationLink ?? "",
  });
  const [files, setFiles] = useState<CompetitionFile[]>(() => cachedFiles ?? []);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [guidebook, setGuidebook] = useState<File | null>(null);
  const [viewingFile, setViewingFile] = useState<CompetitionFile | null>(null);

  useEffect(() => {
    if (!competition || cachedFiles) return;
    let active = true;
    async function loadFiles() {
      setLoadingFiles(true);
      try {
        const list = await fetchCompetitionFiles(competition.id);
        if (!active) return;
        setFiles(list);
        onFilesLoaded(competition.id, list);
      } catch (err) {
        const apiError = err as ApiError;
        if (active) setError(apiError.message ?? "Failed to load files.");
      } finally {
        if (active) setLoadingFiles(false);
      }
    }
    void loadFiles();
    return () => {
      active = false;
    };
  }, [cachedFiles, competition, onFilesLoaded]);

  const userFiles = files.filter((file) => file.fileSource === "user_upload");
  const agentFiles = files.filter((file) => file.fileSource === "agent_output" || file.fileSource === "devs");
  const stageLabel = STAGES.find((stage) => stage.id === competition.currentStageId)?.label ?? competition.currentStageId;

  const saveMetadata = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCompetition(competition.id, draft);
      onUpdated(updated);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message ?? "Failed to save competition.");
    } finally {
      setSaving(false);
    }
  };

  const replaceAssets = async () => {
    if (!poster && !guidebook) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      if (poster) form.set("poster", poster);
      if (guidebook) form.set("guidebook", guidebook);
      const updated = await replaceCompetitionAssets(competition.id, form);
      const list = await fetchCompetitionFiles(competition.id);
      setFiles(list);
      setPoster(null);
      setGuidebook(null);
      onFilesLoaded(competition.id, list);
      onUpdated(updated);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message ?? "Failed to replace files.");
    } finally {
      setSaving(false);
    }
  };

  const removeFile = async (file: CompetitionFile) => {
    setSaving(true);
    setError(null);
    try {
      await deleteFile(file.id);
      const next = files.filter((item) => item.id !== file.id);
      setFiles(next);
      onFilesLoaded(competition.id, next);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message ?? "Failed to delete file.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[20px] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{competition.title}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6">
            <section className="grid gap-4 rounded-[16px] bg-[var(--primary-soft)] p-5 md:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-2">
                <h2 className="text-2xl font-bold">{competition.title}</h2>
                <p className="m-0 text-sm leading-6 text-[var(--muted)]">{competition.category} - {competition.institution}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge>{competition.status || "Active"}</Badge>
                  <Badge variant="outline"><CalendarDays className="size-3" /> {displayDate(competition.deadline)}</Badge>
                  <Badge variant="outline">{stageLabel}</Badge>
                </div>
              </div>
              <div className="grid content-center gap-2">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Progress</span>
                  <span>{competition.progress ?? 0}%</span>
                </div>
                <Progress value={competition.progress ?? 0} />
                {competition.registrationLink ? (
                  <a href={competition.registrationLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]">
                    {displayLink(competition.registrationLink)}
                    <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <span className="text-sm text-[var(--muted)]">Link pendaftaran belum diisi</span>
                )}
              </div>
            </section>

            <section className="grid gap-4 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div>
                <h3 className="text-lg font-bold">Edit Detail</h3>
                <p className="m-0 text-sm text-[var(--muted)]">Metadata ini dipakai dashboard, calendar, dan prompt agent.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold">Title<Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
                <label className="grid gap-2 text-sm font-semibold">Category<Input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
                <label className="grid gap-2 text-sm font-semibold">Institution<Input value={draft.institution} onChange={(event) => setDraft({ ...draft, institution: event.target.value })} /></label>
                <label className="grid gap-2 text-sm font-semibold">Deadline<Input type="date" value={draft.deadline} onChange={(event) => setDraft({ ...draft, deadline: event.target.value })} /></label>
                <label className="grid gap-2 text-sm font-semibold sm:col-span-2">Link pendaftaran<Input value={draft.registrationLink} onChange={(event) => setDraft({ ...draft, registrationLink: event.target.value })} /></label>
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={saveMetadata} disabled={saving}>Save Changes</Button>
              </div>
            </section>

            <section className="grid gap-4 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div>
                <h3 className="text-lg font-bold">Replace Files</h3>
                <p className="m-0 text-sm text-[var(--muted)]">Poster dan guidebook baru akan mengganti asset aktif kompetisi.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FileDropZone label="Poster baru" description="PNG/JPG/WebP, max 5 MB." accept="image/png,image/jpeg,image/webp" file={poster} valid={!poster || poster.size <= 5 * 1024 * 1024} convertRasterToWebp onFile={setPoster} />
                <FileDropZone label="Guidebook baru" description="PDF/DOCX/MD/TXT, max 20 MB." accept=".pdf,.docx,.md,.txt" file={guidebook} valid={!guidebook || guidebook.size <= 20 * 1024 * 1024} onFile={setGuidebook} />
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="secondary" onClick={replaceAssets} disabled={saving || (!poster && !guidebook)}>
                  <UploadCloud className="size-4" />
                  Replace selected files
                </Button>
              </div>
            </section>

            <section className="grid gap-4 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div>
                <h3 className="text-lg font-bold">Files</h3>
                <p className="m-0 text-sm text-[var(--muted)]">User uploads and agent-generated output.</p>
              </div>
              <FileList title="User Uploaded Content" files={userFiles} loading={loadingFiles} onView={setViewingFile} onDelete={removeFile} />
              <FileList title="Output of AI Agent" files={agentFiles} loading={loadingFiles} onView={setViewingFile} onDelete={removeFile} />
            </section>

            {error ? <div className="rounded-[12px] border border-[var(--danger)]/30 bg-red-50 p-3 text-sm text-[var(--danger)]">{error}</div> : null}

            <section className="flex justify-between gap-3 rounded-[16px] border border-[var(--danger)]/25 bg-red-50 p-5">
              <div>
                <h3 className="text-base font-bold text-[var(--danger)]">Delete competition</h3>
                <p className="m-0 text-sm text-[var(--muted)]">Menghapus kompetisi dan file terkait dari workspace.</p>
              </div>
              <Button type="button" variant="destructive" onClick={() => onDeleted(competition.id)} disabled={saving}>
                <Trash2 className="size-4" />
                Delete
              </Button>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />
    </>
  );
}

function FileList({
  title,
  files,
  loading,
  onView,
  onDelete,
}: {
  title: string;
  files: CompetitionFile[];
  loading: boolean;
  onView: (file: CompetitionFile) => void;
  onDelete: (file: CompetitionFile) => void;
}) {
  return (
    <div className="grid gap-2">
      <h4 className="text-sm font-bold">{title}</h4>
      {loading ? <p className="text-sm text-[var(--muted)]">Loading files...</p> : null}
      {!loading && files.length === 0 ? <p className="text-sm text-[var(--muted)]">No files yet.</p> : null}
      <div className="grid gap-2">
        {files.map((file) => (
          <div key={file.id} className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] p-3">
            <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => onView(file)}>
              <FileText className="size-4 text-[var(--primary)]" />
              <span className="min-w-0">
                <strong className="block truncate text-sm">{file.fileName}</strong>
                <small className="text-[var(--muted)]">{file.fileRole} - {file.approved ? "Approved" : file.status ?? "Draft"}</small>
              </span>
            </button>
            <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${file.fileName}`} onClick={() => onDelete(file)}>
              <Trash2 className="size-4 text-[var(--danger)]" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileViewer({ file, onClose }: { file: CompetitionFile | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    let active = true;
    const currentFile = file;
    async function load() {
      setUrl(null);
      setContent("");
      setError(null);
      try {
        const result = await getFileSignedUrl(currentFile.id);
        if (!active) return;
        setUrl(result.url);
        if (result.url && /\.(md|txt|json|csv)$/i.test(currentFile.fileName)) {
          const text = await fetch(result.url).then((response) => response.text());
          if (active) setContent(text);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to open file.");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [file]);

  if (!file) return null;
  const isImage = /\.(png|jpe?g|webp|gif|svg)$/i.test(file.fileName);
  const isPdf = /\.pdf$/i.test(file.fileName);
  const isText = /\.(md|txt|json|csv)$/i.test(file.fileName);

  return (
    <Dialog open={Boolean(file)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[20px] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span className="truncate">{file.fileName}</span>
            <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Close file viewer"><X className="size-4" /></Button>
          </DialogTitle>
        </DialogHeader>
        {error ? <div className="rounded-[12px] border border-[var(--danger)]/30 bg-red-50 p-3 text-sm text-[var(--danger)]">{error}</div> : null}
        {!url && !error ? <p className="text-sm text-[var(--muted)]">Loading file...</p> : null}
        {url && isImage ? <img src={url} alt={file.fileName} className="max-h-[70vh] w-full rounded-[16px] object-contain" /> : null}
        {url && isPdf ? <iframe src={url} title={file.fileName} className="h-[70vh] w-full rounded-[16px] border border-[var(--border)]" /> : null}
        {url && isText ? <Textarea value={content} readOnly className="min-h-[60vh] font-mono text-xs" /> : null}
        {url && !isImage && !isPdf && !isText ? (
          <Button asChild><a href={url} target="_blank" rel="noreferrer">Open file</a></Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

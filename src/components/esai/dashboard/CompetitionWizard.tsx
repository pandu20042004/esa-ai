"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCompetition, type ApiError } from "@/lib/esai/api";
import { isCompetitionUploadComplete } from "@/lib/esai/competition-upload";
import type { Competition } from "@/types/esai";
import { FileDropZone } from "./FileDropZone";

type CompetitionWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinish: (competition: Competition) => void;
};

const guidebookPattern =
  /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/markdown|text\/plain)$/;

export function CompetitionWizard({ open, onOpenChange, onFinish }: CompetitionWizardProps) {
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
  const [error, setError] = useState<{ message: string; correlationId?: string } | null>(null);

  const posterOk = Boolean(poster && /^image\/(png|jpeg|webp)$/.test(poster.type) && poster.size <= 5 * 1024 * 1024);
  const guidebookOk = Boolean(guidebook && guidebookPattern.test(guidebook.type) && guidebook.size <= 20 * 1024 * 1024);
  const canUpload = Boolean(fields.title.trim() && posterOk && guidebookOk);

  const reset = () => {
    setStep(1);
    setFields({ title: "", category: "Sains & Teknologi", institution: "", deadline: "2026-09-01", registrationLink: "" });
    setPoster(null);
    setGuidebook(null);
    setCreatedCompetition(null);
    setError(null);
  };

  const createAndVerify = async () => {
    if (!canUpload || submitting || !poster || !guidebook) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("title", fields.title);
      formData.set("category", fields.category);
      formData.set("institution", fields.institution);
      formData.set("deadline", fields.deadline);
      formData.set("registrationLink", fields.registrationLink);
      formData.set("poster", poster);
      formData.set("guidebook", guidebook);
      const competition = await createCompetition(formData);
      if (!isCompetitionUploadComplete(competition)) {
        throw new Error("Guidebook upload was not confirmed. Please try again before opening the workflow pipeline.");
      }
      setCreatedCompetition(competition);
      setStep(3);
      toast.success("Kompetisi berhasil dibuat!");
    } catch (err) {
      const apiError = err as ApiError;
      setError({ message: apiError.message ?? "Failed to create competition.", correlationId: apiError.correlationId });
    } finally {
      setSubmitting(false);
    }
  };

  const finish = () => {
    if (!createdCompetition) return;
    onFinish(createdCompetition);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!submitting) onOpenChange(next);
      if (!next && !submitting) reset();
    }}>
      <DialogContent className="rounded-[20px] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Setup Kompetisi Baru</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((item) => (
              <span key={item} className={`h-2 rounded-full ${item <= step ? "bg-[var(--primary)]" : "bg-[var(--soft)]"}`} />
            ))}
          </div>

          {step === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Nama Kompetisi
                <Input value={fields.title} onChange={(event) => setFields({ ...fields, title: event.target.value })} placeholder="Competition name" />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Kategori
                <Select value={fields.category} onValueChange={(category) => setFields({ ...fields, category })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Sains & Teknologi", "Sosial & Humaniora", "Inovasi Digital", "KTI", "Business Plan", "Essay"].map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Institusi
                <Input value={fields.institution} onChange={(event) => setFields({ ...fields, institution: event.target.value })} placeholder="Institution" />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Deadline
                <Input type="date" value={fields.deadline} onChange={(event) => setFields({ ...fields, deadline: event.target.value })} />
              </label>
              <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                Link pendaftaran
                <Input value={fields.registrationLink} onChange={(event) => setFields({ ...fields, registrationLink: event.target.value })} placeholder="https://..." />
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FileDropZone
                label="Poster"
                description="PNG, JPG, atau WebP. Max 5 MB. PNG/JPG otomatis dikonversi ke WebP."
                accept="image/png,image/jpeg,image/webp"
                file={poster}
                valid={posterOk}
                disabled={submitting || Boolean(createdCompetition)}
                convertRasterToWebp
                onFile={setPoster}
              />
              <FileDropZone
                label="Guidebook"
                description="PDF, DOCX, MD, atau TXT. Max 20 MB."
                accept=".pdf,.docx,.md,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
                file={guidebook}
                valid={guidebookOk}
                disabled={submitting || Boolean(createdCompetition)}
                onFile={setGuidebook}
              />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid justify-items-center gap-3 rounded-[16px] bg-[var(--primary-soft)] p-8 text-center">
              <Check className="size-9 text-[var(--success)]" />
              <h3 className="text-xl font-bold">Upload confirmed</h3>
              <p className="m-0 max-w-md text-sm leading-6 text-[var(--muted)]">Guidebook sudah tersimpan dan siap dipakai agent.</p>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-[12px] border border-[var(--danger)]/30 bg-red-50 p-3 text-sm text-[var(--danger)]">
              <strong>Gagal:</strong> {error.message}
              {error.correlationId ? <div><small>Correlation ID: <code>{error.correlationId}</code></small></div> : null}
            </div>
          ) : null}

          <div className="flex justify-between gap-3">
            <Button type="button" variant="ghost" disabled={submitting} onClick={() => (step > 1 ? setStep(step - 1) : onOpenChange(false))}>
              <X className="size-4" />
              {step === 1 ? "Batal" : "Kembali"}
            </Button>
            <Button
              type="button"
              disabled={(step === 2 && (!canUpload || submitting || Boolean(createdCompetition))) || (step === 3 && !createdCompetition)}
              onClick={() => {
                if (step === 1) setStep(2);
                else if (step === 2) void createAndVerify();
                else finish();
              }}
            >
              {step === 2 ? (submitting ? "Uploading..." : "Upload and verify") : step === 3 ? "Selesai" : "Lanjut"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

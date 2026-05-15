"use client";

import { CalendarDays, CheckCircle2, ChevronRight, ClipboardCheck, FileText, Plus, Star, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteCompetition, fetchCompetitionFiles, type ApiError } from "@/lib/esai/api";
import type { Competition } from "@/types/esai";
import { EmptyState } from "../common/EmptyState";
import { useCompetitionsContext } from "../shell/CompetitionProvider";
import { PageTransition } from "../shell/PageTransition";
import { CompetitionGrid } from "../dashboard/CompetitionGrid";
import { CompetitionOverview } from "../dashboard/CompetitionOverview";
import { CompetitionWizard } from "../dashboard/CompetitionWizard";

export function DashboardRoute() {
  const {
    competitions,
    selectedCompetition,
    dataLoading,
    filesByCompetition,
    selectCompetition,
    upsertCompetition,
    removeCompetition,
    rememberCompetitionFiles,
  } = useCompetitionsContext();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [overviewCompetition, setOverviewCompetition] = useState<Competition | null>(null);
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    return () => window.clearTimeout(id);
  }, []);

  const averageProgress = competitions.length
    ? Math.round(competitions.reduce((sum, competition) => sum + (competition.progress ?? 0), 0) / competitions.length)
    : 0;
  const nearestCompetition = competitions
    .filter((competition) => competition.deadline)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0];
  const nearestDays = nearestCompetition
    ? Math.max(0, Math.ceil((new Date(nearestCompetition.deadline).getTime() - (currentTime ?? new Date(nearestCompetition.deadline).getTime())) / 86_400_000))
    : 0;

  const openCompetition = (competition: Competition) => {
    selectCompetition(competition);
    setOverviewCompetition(competition);
  };

  const handleDelete = async (competition: Competition) => {
    if (!window.confirm(`Delete ${competition.title}? This cannot be undone.`)) return;
    try {
      await deleteCompetition(competition.id);
      removeCompetition(competition.id);
      setOverviewCompetition(null);
      toast.success("Kompetisi dihapus.");
    } catch (err) {
      const apiError = err as ApiError;
      toast.error(apiError.message ?? "Failed to delete competition.");
    }
  };

  return (
    <PageTransition>
      <section className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-2 pt-2">
            <h1 className="text-3xl font-extrabold tracking-normal text-[var(--fg)] sm:text-4xl">Selamat pagi, Akmal! 👋</h1>
            <p className="m-0 max-w-2xl text-base leading-6 text-[var(--muted)]">Siap menaklukkan kompetisi hari ini?</p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Trophy} label="Kompetisi Aktif" value={String(competitions.length)} detail={competitions.length ? "2 mendekati deadline" : "Belum ada kompetisi"} tone="orange" />
          <MetricCard icon={ClipboardCheck} label="Progress Rata-rata" value={`${averageProgress}%`} detail="Naik 12% dari minggu lalu" tone="green" />
          <MetricCard icon={CalendarDays} label="Deadline Terdekat" value={nearestCompetition ? `${nearestDays} hari` : "-"} detail={nearestCompetition?.title ?? "Tambahkan kompetisi"} tone="red" />
          <MetricCard icon={Star} label="Pipeline Aktif" value="12" detail="Di 4 kompetisi berbeda" tone="purple" />
        </div>

        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold">Kompetisi Aktif</h2>
          <Button type="button" variant="secondary" onClick={() => setWizardOpen(true)}>
            Lihat semua
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {dataLoading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-80 rounded-[16px]" />)}
          </div>
        ) : competitions.length === 0 ? (
          <EmptyState
            title="Belum ada kompetisi"
            description="Mulai perjalanan akademikmu dengan menambahkan guidebook dan poster kompetisi pertama."
            actionLabel="Tambah Kompetisi"
            onAction={() => setWizardOpen(true)}
          />
        ) : (
          <CompetitionGrid
            competitions={competitions}
            selectedCompetition={selectedCompetition}
            onOpen={openCompetition}
            onEdit={openCompetition}
            onDelete={handleDelete}
          />
        )}

        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="flex min-h-14 items-center justify-center gap-3 rounded-[12px] border border-dashed border-[var(--primary-border)] bg-transparent text-sm font-bold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
        >
          <Plus className="size-4" />
          Tambah Kompetisi Baru
        </button>

        <Card className="relative overflow-hidden rounded-[16px] border-[var(--border)] bg-[var(--tip-bg)] p-6 shadow-[var(--soft-shadow)]">
          <div className="max-w-xl">
            <h2 className="text-lg font-extrabold">Terus konsisten, hasil luar biasa menantimu!</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Setiap langkah kecil hari ini adalah kemenangan di masa depan.</p>
            <Button className="mt-5" variant="outline">Lihat Tips</Button>
          </div>
          <Trophy className="absolute bottom-5 right-10 hidden size-20 text-[var(--primary)] opacity-80 sm:block" />
        </Card>
        </div>

        <DashboardSideRail competitions={competitions} />

        <CompetitionWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          onFinish={async (competition) => {
            upsertCompetition(competition);
            selectCompetition(competition);
            setOverviewCompetition(competition);
            await fetchCompetitionFiles(competition.id)
              .then((files) => rememberCompetitionFiles(competition.id, files))
              .catch(() => rememberCompetitionFiles(competition.id, []));
          }}
        />

        <CompetitionOverview
          competition={overviewCompetition}
          cachedFiles={overviewCompetition ? filesByCompetition[overviewCompetition.id] : undefined}
          open={Boolean(overviewCompetition)}
          onOpenChange={(open) => { if (!open) setOverviewCompetition(null); }}
          onUpdated={(competition) => {
            upsertCompetition(competition);
            selectCompetition(competition);
            setOverviewCompetition(competition);
          }}
          onDeleted={(id) => {
            const competition = competitions.find((item) => item.id === id);
            if (competition) void handleDelete(competition);
          }}
          onFilesLoaded={rememberCompetitionFiles}
        />
      </section>
    </PageTransition>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Trophy; label: string; value: string; detail: string; tone: "orange" | "green" | "red" | "purple" }) {
  const toneClass = {
    orange: "bg-orange-100 text-orange-600",
    green: "bg-emerald-100 text-emerald-600",
    red: "bg-rose-100 text-rose-600",
    purple: "bg-purple-100 text-purple-600",
  }[tone];

  return (
    <Card className="grid min-h-28 grid-cols-[48px_1fr] items-center gap-4 rounded-[16px] border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--soft-shadow)]">
      <div className={`grid size-11 place-items-center rounded-[12px] ${toneClass}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="m-0 text-xs font-medium text-[var(--muted)]">{label}</p>
        <strong className="mt-1 block text-2xl font-extrabold">{value}</strong>
        <span className="mt-2 block truncate text-xs font-medium text-[var(--primary)]">{detail}</span>
      </div>
    </Card>
  );
}

function DashboardSideRail({ competitions }: { competitions: Competition[] }) {
  const agenda = competitions.slice(0, 3);
  return (
    <aside className="grid content-start gap-5">
      <Card className="rounded-[16px] border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--soft-shadow)]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-extrabold">Kalender</h2>
          <button className="text-xs font-bold text-[var(--primary)]">Lihat kalender</button>
        </div>
        <strong className="text-sm">Mei 2024</strong>
        <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs text-[var(--muted)]">
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => <span key={day}>{day}</span>)}
          {Array.from({ length: 35 }).map((_, index) => {
            const day = index < 2 ? 29 + index : index - 1;
            const active = day === 20;
            const ring = day === 17;
            return <span key={index} className={`grid aspect-square place-items-center rounded-full text-[var(--fg)] ${active ? "bg-[var(--primary)] text-white" : ring ? "border border-[var(--primary)] text-[var(--primary)]" : ""}`}>{day}</span>;
          })}
        </div>
      </Card>
      <RailList title="Agenda Mendatang" items={agenda.map((competition) => ({ icon: CalendarDays, title: `Deadline ${competition.title}`, subtitle: competition.deadline || "Deadline belum diisi" }))} />
      <RailList title="Aktivitas Terbaru" items={[
        { icon: CheckCircle2, title: 'Pipeline "Pendahuluan" selesai', subtitle: "2 jam lalu" },
        { icon: FileText, title: 'Draft "Bab 1" diperbarui', subtitle: "5 jam lalu" },
        { icon: Star, title: "Validitas sumber: 92% (Baik)", subtitle: "1 hari lalu" },
      ]} />
    </aside>
  );
}

function RailList({ title, items }: { title: string; items: Array<{ icon: typeof CalendarDays; title: string; subtitle: string }> }) {
  return (
    <Card className="rounded-[16px] border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--soft-shadow)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-extrabold">{title}</h2>
        <button className="text-xs font-bold text-[var(--primary)]">Lihat semua</button>
      </div>
      <div className="grid gap-3">
        {items.length === 0 ? <p className="text-sm text-[var(--muted)]">Belum ada data.</p> : null}
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={`${item.title}-${index}`} className="grid grid-cols-[44px_1fr] gap-3 rounded-[12px] p-2 hover:bg-[var(--soft)]">
              <div className="grid size-11 place-items-center rounded-[12px] bg-[var(--primary-soft)] text-[var(--primary)]">
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <strong className="block truncate text-sm">{item.title}</strong>
                <span className="text-xs text-[var(--muted)]">{item.subtitle}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

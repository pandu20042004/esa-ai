"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
      <section className="grid gap-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-2">
            <h1 className="text-3xl font-extrabold tracking-normal sm:text-4xl">Dashboard</h1>
            <p className="m-0 max-w-2xl text-sm leading-6 text-[var(--muted)]">Lanjutkan progres kompetisi akademik Anda hari ini.</p>
          </div>
          <Button type="button" onClick={() => setWizardOpen(true)}>
            <Plus className="size-4" />
            Tambah Kompetisi
          </Button>
        </header>

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

"use client";

import { useRouter } from "next/navigation";

import { useCompetitionsContext } from "@/components/esai/shell/CompetitionProvider";
import { useTheme } from "@/components/esai/shell/ThemeProvider";
import { EmptyState } from "@/components/esai/common/EmptyState";
import { Workbench } from "@/legacy/esai/LegacyWorkbench";

export function WorkbenchView({ competitionId }: { competitionId: string }) {
  const router = useRouter();
  const { competitions, dataLoading, selectedCompetition } = useCompetitionsContext();
  const { darkMode, toggleTheme } = useTheme();
  const competition = competitions.find((item) => item.id === competitionId) ?? selectedCompetition;

  if (dataLoading) {
    return <div className="rounded-[16px] bg-[var(--surface)] p-8 text-sm text-[var(--muted)]">Loading workbench...</div>;
  }

  if (!competition) {
    return (
      <EmptyState
        title="Kompetisi tidak ditemukan"
        description="Pilih kompetisi dari dashboard untuk membuka workbench."
        actionLabel="Kembali ke Dashboard"
        href="/dashboard"
      />
    );
  }

  return (
    <div className="grid gap-5">
      <Workbench
        competition={competition}
        assistantOpen={false}
        darkMode={darkMode}
        onBack={() => router.push("/dashboard")}
        onToggleAssistant={() => undefined}
        onToggleTheme={toggleTheme}
      />
    </div>
  );
}

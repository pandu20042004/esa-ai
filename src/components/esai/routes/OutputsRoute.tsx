"use client";

import Link from "next/link";
import { FileCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/esai/common/EmptyState";
import { useCompetitionsContext } from "@/components/esai/shell/CompetitionProvider";
import { PageTransition } from "@/components/esai/shell/PageTransition";

export function OutputsRoute() {
  const { competitions, dataLoading } = useCompetitionsContext();
  const completed = competitions.filter((competition) => (competition.progress ?? 0) >= 100);

  return (
    <PageTransition>
      <section className="grid gap-7">
        <header className="grid gap-2">
          <h1 className="text-3xl font-extrabold tracking-normal sm:text-4xl">Outputs</h1>
          <p className="m-0 max-w-2xl text-sm leading-6 text-[var(--muted)]">Final documents, approved artifacts, and export-ready competition assets.</p>
        </header>

        {dataLoading ? <p className="text-sm text-[var(--muted)]">Loading outputs...</p> : null}
        {!dataLoading && completed.length === 0 ? (
          <EmptyState
            title="Output akan muncul setelah pipeline selesai"
            description="Jalankan stage agent sampai supervisor review untuk melihat output final."
            actionLabel="Buka Dashboard"
            href="/dashboard"
          />
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {completed.map((competition) => (
            <Card key={competition.id} className="grid gap-4 p-5">
              <FileCheck className="size-5 text-[var(--success)]" />
              <div>
                <h2 className="text-lg font-bold">{competition.title}</h2>
                <p className="m-0 text-sm text-[var(--muted)]">{competition.category} - {competition.institution}</p>
              </div>
              <Button asChild variant="secondary">
                <Link href={`/workbench/${competition.id}`}>Open Workbench</Link>
              </Button>
            </Card>
          ))}
        </div>
      </section>
    </PageTransition>
  );
}

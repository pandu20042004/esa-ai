"use client";

import { CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/esai/common/EmptyState";
import { PageTransition } from "@/components/esai/shell/PageTransition";

export function CalendarRoute() {
  return (
    <PageTransition>
      <section className="grid gap-7">
        <header className="grid gap-2">
          <h1 className="text-3xl font-extrabold tracking-normal sm:text-4xl">Calendar</h1>
          <p className="m-0 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Deadlines, guidebook dates, agent tasks, review reminders, and submission milestones.
          </p>
        </header>
        <EmptyState
          title="Belum ada jadwal"
          description="Buat kompetisi untuk generate timeline otomatis."
          actionLabel="Tambah Kompetisi"
          href="/dashboard"
        />
        <div className="sr-only"><CalendarDays /></div>
      </section>
    </PageTransition>
  );
}

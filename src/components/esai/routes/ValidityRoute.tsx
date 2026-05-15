"use client";

import { ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/esai/common/EmptyState";
import { PageTransition } from "@/components/esai/shell/PageTransition";

export function ValidityRoute() {
  return (
    <PageTransition>
      <section className="grid gap-7">
        <header className="grid gap-2">
          <h1 className="text-3xl font-extrabold tracking-normal sm:text-4xl">Validity</h1>
          <p className="m-0 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Compare agent outputs against source journals to verify citations.
          </p>
        </header>
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Checker siap dipakai setelah output tersedia</AlertTitle>
          <AlertDescription>Upload atau approve output agent terlebih dahulu, lalu validasi klaim dan referensi di sini.</AlertDescription>
        </Alert>
        <Card>
          <CardHeader>
            <CardTitle>Evidence Review</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="Belum ada output untuk dicek"
              description="Output agent dan jurnal pendukung akan muncul di sini saat pipeline berjalan."
              actionLabel="Buka Dashboard"
              href="/dashboard"
            />
          </CardContent>
        </Card>
      </section>
    </PageTransition>
  );
}

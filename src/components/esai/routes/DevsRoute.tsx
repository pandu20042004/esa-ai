"use client";

import { DevsAgentsWorkspace } from "@/components/esai/DevsAgentsWorkspace";
import { PageTransition } from "@/components/esai/shell/PageTransition";

export function DevsRoute() {
  return (
    <PageTransition>
      <section className="grid gap-7">
        <header className="grid gap-2">
          <h1 className="text-3xl font-extrabold tracking-normal sm:text-4xl">Devs</h1>
          <p className="m-0 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Edit, validate, and publish agent skills for the Essay compartment.
          </p>
        </header>
        <DevsAgentsWorkspace />
      </section>
    </PageTransition>
  );
}

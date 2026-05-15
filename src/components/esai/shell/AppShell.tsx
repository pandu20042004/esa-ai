"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

import { AppSidebar } from "./AppSidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] [background-image:radial-gradient(circle_at_40%_0%,var(--page-glow),transparent_38%),radial-gradient(circle_at_85%_20%,var(--page-warm),transparent_28%)]">
      <div className="flex min-h-screen flex-col md:flex-row">
        <AppSidebar />
        <main className="min-w-0 flex-1 px-5 py-7 sm:px-9 lg:px-12">{children}</main>
      </div>
      </div>
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  );
}

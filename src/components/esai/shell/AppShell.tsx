"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

import { AppSidebar } from "./AppSidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--fg)] md:flex-row">
        <AppSidebar />
        <main className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10">{children}</main>
      </div>
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  );
}

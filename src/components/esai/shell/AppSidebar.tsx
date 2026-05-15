"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ChevronRight, Code2, Feather, FileCheck, Grid2X2, Moon, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck, Sun, WandSparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCompetitionsContext } from "./CompetitionProvider";
import { useTheme } from "./ThemeProvider";

const groups = [
  {
    label: "MAIN",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Grid2X2 },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { href: "/workbench", label: "Workbench", icon: WandSparkles },
      { href: "/validity", label: "Validity", icon: ShieldCheck },
      { href: "/outputs", label: "Outputs", icon: FileCheck },
    ],
  },
  {
    label: "ADVANCED",
    items: [{ href: "/devs", label: "Devs", icon: Code2 }],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const { competitions, selectedCompetition, selectCompetition } = useCompetitionsContext();
  const { darkMode, toggleTheme } = useTheme();

  const resolveHref = (href: string) => {
    if (href !== "/workbench") return href;
    return selectedCompetition ? `/workbench/${selectedCompetition.id}` : "/dashboard";
  };

  const handleWorkbenchClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (selectedCompetition) return;
    event.preventDefault();
    toast.info("Pilih kompetisi dulu untuk membuka Workbench.");
    router.push("/dashboard");
  };

  const handleCompetitionSelect = (value: string) => {
    const competition = competitions.find((item) => item.id === value);
    if (!competition) return;
    selectCompetition(competition);
    router.push(`/workbench/${competition.id}`);
  };

  return (
    <aside
      className={cn(
        "sticky top-0 z-20 flex w-full shrink-0 flex-col border-b border-[var(--border)] bg-[var(--sidebar)] px-4 py-7 transition-[width] duration-200 md:h-screen md:border-b-0 md:border-r",
        collapsed ? "md:w-[88px]" : "md:w-[292px]",
      )}
    >
      <div className="mb-8 flex min-h-11 items-center gap-3">
        <div className="grid size-11 place-items-center text-[var(--primary)]">
          <Feather className="size-10 fill-[var(--primary)] stroke-[var(--primary)]" />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <strong className="block truncate font-[var(--font-display)] text-xl font-extrabold">Esai Premium</strong>
            <span className="block truncate text-xs font-medium text-[var(--muted)]">AI-Powered Essay Companion</span>
          </div>
        ) : null}
      </div>

      <Link
        href="/dashboard"
        className={cn(
          "mb-7 flex min-h-14 items-center gap-3 rounded-[12px] bg-[var(--nav-active)] px-4 text-sm font-bold text-[var(--primary)] shadow-sm",
          collapsed && "justify-center px-0",
        )}
      >
        <Grid2X2 className="size-5 fill-[var(--primary)]" />
        {!collapsed ? <span>AI Assistant</span> : null}
      </Link>

      <nav className="grid flex-1 content-start gap-6">
        {groups.map((group) => (
          <div key={group.label} className="grid gap-2">
            {!collapsed ? (
              <span className="px-3 text-[11px] font-bold tracking-[0.12em] text-[var(--muted)]">{group.label}</span>
            ) : null}
            <div className="grid gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const href = resolveHref(item.href);
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={href}
                    onClick={item.href === "/workbench" ? handleWorkbenchClick : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-12 items-center gap-4 rounded-[12px] px-4 text-base font-medium text-[var(--muted)] transition-colors hover:bg-[var(--nav-hover)] hover:text-[var(--fg)]",
                      collapsed && "justify-center px-0",
                      active && "bg-[var(--nav-active)] text-[var(--primary)]",
                    )}
                  >
                    {active ? <span className="absolute left-0 h-7 w-[3px] rounded-r-full bg-[var(--primary)]" /> : null}
                    <Icon className="size-5" />
                    {!collapsed ? <span>{item.label}</span> : null}
                  </Link>
                );
              })}
              {group.label === "TOOLS" && !collapsed ? (
                <div className="mx-2 mt-1 grid gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Workbench competition</span>
                  <select
                    value={selectedCompetition?.id ?? ""}
                    onChange={(event) => handleCompetitionSelect(event.target.value)}
                    className="h-10 min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--fg)] outline-none focus:border-[var(--primary-border)]"
                    aria-label="Select workbench competition"
                  >
                    <option value="">{competitions.length ? "Select competition" : "No competition yet"}</option>
                    {competitions.map((competition) => (
                      <option key={competition.id} value={competition.id}>{competition.title}</option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed ? (
        <div className="mb-5 rounded-[14px] border border-[var(--border)] bg-[var(--profile-card)] p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-full bg-[var(--primary-soft)] text-sm font-extrabold text-[var(--primary)]">A</div>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-sm">Akmal Rizky</strong>
              <span className="block truncate text-xs text-[var(--muted)]">Universitas Indonesia</span>
            </div>
            <ChevronRight className="size-4 text-[var(--primary)]" />
          </div>
          <span className="ml-14 mt-2 inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-[11px] font-bold text-[var(--primary)]">Pro Plan</span>
        </div>
      ) : null}

      <div className="grid gap-2 border-t border-[var(--border)] pt-4">
        <Link
          href="/settings"
          className={cn(
            "flex min-h-12 items-center gap-4 rounded-[12px] px-4 text-base font-medium text-[var(--muted)] hover:bg-[var(--nav-hover)] hover:text-[var(--fg)]",
            collapsed && "justify-center px-0",
            pathname === "/settings" && "bg-[var(--nav-active)] text-[var(--primary)]",
          )}
        >
          <Settings className="size-5" />
          {!collapsed ? <span>Settings</span> : null}
        </Link>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>
      </div>
    </aside>
  );
}

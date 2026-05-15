"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bot, CalendarDays, Code2, FileCheck, LayoutDashboard, Moon, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck, Sun, WandSparkles } from "lucide-react";
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
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
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
  const { selectedCompetition } = useCompetitionsContext();
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

  return (
    <aside
      className={cn(
        "sticky top-0 z-20 flex w-full shrink-0 flex-col border-b border-[var(--border)] bg-[var(--surface)] px-4 py-5 transition-[width] duration-200 md:h-screen md:border-b-0 md:border-r",
        collapsed ? "md:w-[84px]" : "md:w-[268px]",
      )}
    >
      <div className="mb-7 flex min-h-10 items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[12px] bg-[var(--primary)] text-sm font-extrabold text-white">
          EA
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <strong className="block truncate font-[var(--font-display)] text-lg font-extrabold">ESAI.ai</strong>
            <span className="block truncate text-xs font-medium text-[var(--muted)]">Academic companion</span>
          </div>
        ) : null}
      </div>

      <Link
        href="/dashboard"
        className={cn(
          "mb-6 flex min-h-12 items-center gap-3 rounded-[16px] border border-[var(--primary-border)] bg-[var(--primary-soft)] px-3 text-sm font-bold text-[var(--fg)]",
          collapsed && "justify-center px-0",
        )}
      >
        <Bot className="size-4 text-[var(--primary)]" />
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
                      "relative flex min-h-10 items-center gap-3 rounded-[12px] px-3 text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--soft)] hover:text-[var(--fg)]",
                      collapsed && "justify-center px-0",
                      active && "bg-[var(--primary-soft)] text-[var(--fg)]",
                    )}
                  >
                    {active ? <span className="absolute left-0 h-5 w-[3px] rounded-r-full bg-[var(--primary)]" /> : null}
                    <Icon className="size-4" />
                    {!collapsed ? <span>{item.label}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="grid gap-2 border-t border-[var(--border)] pt-4">
        <Link
          href="/settings"
          className={cn(
            "flex min-h-10 items-center gap-3 rounded-[12px] px-3 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--fg)]",
            collapsed && "justify-center px-0",
            pathname === "/settings" && "bg-[var(--primary-soft)] text-[var(--fg)]",
          )}
        >
          <Settings className="size-4" />
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

# Frontend Humanization Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild ESAI.ai frontend from the current monolithic admin-style interface into the approved warm, routed, humanistic design system while preserving existing Supabase, OpenClaw, file, agent, and competition workflows.

**Architecture:** Keep the existing backend/API layer intact. Add a new App Router shell under `src/app/(app)` with shared providers, route-level pages, shadcn-style UI primitives, and focused domain composites under `src/components/esai`. Migrate screens out of `EsaiPremiumApp.tsx` one route at a time, then delete the monolith only after all routes and tests pass.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, shadcn/ui component pattern, Radix primitives, Sonner toasts, Motion/Framer Motion client transitions, Vitest, Testing Library, Playwright/Lighthouse smoke checks.

---

## Current Baseline

- Backup already pushed before this plan: branch `phase-a-dashboard-auth-competitions`, commit `74f94cc`.
- Approved design spec: `docs/superpowers/specs/2026-05-15-frontend-humanization-design-system-design.md`.
- Current blockers to solve: `src/components/esai/EsaiPremiumApp.tsx` is a 3900+ line client monolith, `src/app/globals.css` is 100KB+, and `/` renders the monolith directly.
- Existing local artifacts intentionally remain untracked: `.temp/`, `guidebook.pdf`, `01_onboarding_map.md`, `output/01_onboarding_map.md`.

## File Structure Target

- Create: `components.json` - shadcn CLI configuration using New York style, CSS variables, lucide icons, `@/*` aliases, and `src/app/globals.css`.
- Create: `src/lib/utils.ts` - `cn()` helper for `clsx` plus `tailwind-merge`.
- Modify: `src/app/globals.css` - warm design tokens, Tailwind v4 theme variables, minimal base styles only.
- Create: `src/components/ui/*` - copied UI primitives: button, card, dialog, dropdown-menu, input, select, textarea, badge, progress, skeleton, tabs, tooltip, sheet, avatar, alert, separator.
- Create: `src/components/esai/shell/*` - `AppShell`, `AppSidebar`, `ThemeProvider`, `CompetitionProvider`, `PageTransition`, `RouteSkeleton`.
- Create: `src/components/esai/dashboard/*` - `CompetitionCard`, `CompetitionGrid`, `CompetitionWizard`, `CompetitionOverview`, `FileDropZone`.
- Create: `src/components/esai/workbench/*` - `WorkbenchView`, `PipelineRail`, `StageWorkspace`, `AssistantPanel`, `RunStatusBar`, `AgentChoiceCard`.
- Create: `src/components/esai/routes/*` - route-specific client containers for dashboard, calendar, workbench, validity, outputs, devs, settings.
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`, and route folders for `dashboard`, `calendar`, `workbench/[competitionId]`, `validity`, `outputs`, `devs`, `settings`.
- Modify: `src/app/page.tsx` - redirect to `/dashboard`.
- Keep then delete late: `src/components/esai/EsaiPremiumApp.tsx` after all pages are migrated.

---

### Task 1: Foundation Packages, Config, Tokens

**Files:**
- Create: `components.json`
- Create: `src/lib/utils.ts`
- Create: `src/lib/__tests__/utils.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Replace: `src/app/globals.css`

- [ ] **Step 1: Install design dependencies**

Run:

```powershell
npm install class-variance-authority clsx tailwind-merge tailwindcss-animate sonner framer-motion @radix-ui/react-avatar @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-progress @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-slot @radix-ui/react-tabs @radix-ui/react-tooltip
```

Expected: `package.json` and `package-lock.json` include the new dependencies. If `framer-motion` install warns that Motion now prefers `motion`, keep `framer-motion` for spec compliance unless build fails.

- [ ] **Step 2: Add shadcn config**

Write `components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 3: Add `cn()` utility with test**

Write `src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Write `src/lib/__tests__/utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges conditional classes and resolves Tailwind conflicts", () => {
    expect(cn("px-2", false && "hidden", "px-4", ["text-sm"])).toBe("px-4 text-sm");
  });
});
```

Run:

```powershell
npm test -- src/lib/__tests__/utils.test.ts
```

Expected: PASS.

- [ ] **Step 4: Replace global CSS with token layer**

Replace the top of `src/app/globals.css` with the approved warm token system and keep only base selectors. The final file should stay under 80 lines during this task; later cleanup brings it under 50.

```css
@import "tailwindcss";
@plugin "tailwindcss-animate";

:root {
  --font-display-fallback: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-body-fallback: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-code-fallback: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  --bg: oklch(98.5% 0.004 80);
  --surface: oklch(100% 0 0);
  --panel: oklch(96.5% 0.006 80);
  --soft: oklch(94% 0.01 80);
  --fg: oklch(18% 0.012 260);
  --muted: oklch(52% 0.01 260);
  --border: oklch(92% 0.004 80);
  --primary: oklch(78% 0.16 70);
  --primary-soft: oklch(78% 0.16 70 / 0.1);
  --primary-border: oklch(84% 0.12 70);
  --secondary: oklch(68% 0.14 25);
  --success: oklch(70% 0.16 155);
  --danger: oklch(62% 0.2 25);
  --radius: 16px;
}

:root[data-theme="dark"] {
  --bg: oklch(16% 0.008 260);
  --surface: oklch(21% 0.008 260);
  --panel: oklch(24% 0.01 260);
  --soft: oklch(28% 0.01 260);
  --fg: oklch(95% 0.004 80);
  --muted: oklch(68% 0.01 260);
  --border: oklch(30% 0.008 260);
  --primary: oklch(82% 0.14 72);
  --primary-soft: oklch(82% 0.14 72 / 0.15);
  --primary-border: oklch(64% 0.12 72);
  --secondary: oklch(74% 0.12 25);
  color-scheme: dark;
}

* { box-sizing: border-box; }
html, body { min-height: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-body), var(--font-body-fallback);
  letter-spacing: 0;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3 { font-family: var(--font-display), var(--font-display-fallback); }
button, input, select, textarea { font: inherit; }
```

Run:

```powershell
npm run lint
```

Expected: no lint errors. Visual breakage is acceptable at this task because routes still use old classes until migration.

- [ ] **Step 5: Commit foundation**

Run:

```powershell
git add package.json package-lock.json components.json src/lib/utils.ts src/lib/__tests__/utils.test.ts src/app/globals.css
git commit -m "feat(ui): add warm design foundation"
git push
```

Expected: commit pushed to `origin/phase-a-dashboard-auth-competitions`.

---

### Task 2: UI Primitives

**Files:**
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/ui/dropdown-menu.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/textarea.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/progress.tsx`
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/ui/tabs.tsx`
- Create: `src/components/ui/tooltip.tsx`
- Create: `src/components/ui/sheet.tsx`
- Create: `src/components/ui/avatar.tsx`
- Create: `src/components/ui/alert.tsx`
- Create: `src/components/ui/separator.tsx`
- Create: `src/components/ui/__tests__/button.test.tsx`

- [ ] **Step 1: Add shadcn primitives**

Run:

```powershell
npx shadcn@latest add button card dialog dropdown-menu input textarea badge progress skeleton tabs tooltip sheet avatar alert separator
```

Expected: files are created in `src/components/ui/` using `@/lib/utils`.

- [ ] **Step 2: Normalize primitive styles to warm tokens**

In every generated primitive, replace hard-coded `bg-primary`, `text-primary-foreground`, and border assumptions if they do not resolve under Tailwind v4. Use token-backed utilities like:

```tsx
"bg-[var(--primary)] text-white hover:bg-[color-mix(in_oklch,var(--primary)_88%,black)]"
```

For cards, use:

```tsx
"rounded-[16px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)]"
```

- [ ] **Step 3: Add button smoke test**

Write `src/components/ui/__tests__/button.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders as a command button", () => {
    render(<Button>Tambah Kompetisi</Button>);
    expect(screen.getByRole("button", { name: "Tambah Kompetisi" })).toBeInTheDocument();
  });
});
```

Run:

```powershell
npm test -- src/components/ui/__tests__/button.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit primitives**

Run:

```powershell
git add src/components/ui
git commit -m "feat(ui): add shared primitives"
git push
```

---

### Task 3: Routed App Shell and Providers

**Files:**
- Create: `src/components/esai/shell/ThemeProvider.tsx`
- Create: `src/components/esai/shell/CompetitionProvider.tsx`
- Create: `src/components/esai/shell/AppSidebar.tsx`
- Create: `src/components/esai/shell/AppShell.tsx`
- Create: `src/components/esai/shell/PageTransition.tsx`
- Create: `src/components/esai/shell/RouteSkeleton.tsx`
- Create: `src/components/esai/shell/__tests__/app-sidebar.test.tsx`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add theme provider**

Write `ThemeProvider.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ThemeValue = { darkMode: boolean; toggleTheme: () => void };
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("esai-theme");
    setDarkMode(stored === "dark");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    window.localStorage.setItem("esai-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const value = useMemo(() => ({ darkMode, toggleTheme: () => setDarkMode((v) => !v) }), [darkMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
```

- [ ] **Step 2: Add competition provider**

Move competition list loading from `EsaiPremiumApp` into `CompetitionProvider.tsx`. Preserve `fetchCompetitions`, `fetchFiles`, `selectInitialCompetition`, and localStorage key `esai-selected-competition-id`.

Required provider shape:

```ts
type CompetitionContextValue = {
  competitions: Competition[];
  selectedCompetition: Competition | null;
  dataLoading: boolean;
  filesByCompetition: Record<string, CompetitionFile[]>;
  selectCompetition: (competition: Competition) => void;
  upsertCompetition: (competition: Competition) => void;
  removeCompetition: (id: string) => void;
  rememberCompetitionFiles: (competitionId: string, files: CompetitionFile[]) => void;
  reloadCompetitions: () => Promise<void>;
};
```

- [ ] **Step 3: Add route-aware sidebar**

`AppSidebar.tsx` must use `next/link` and `usePathname`. Use grouped nav:

```ts
const groups = [
  { label: "MAIN", items: [{ href: "/dashboard", label: "Dashboard" }, { href: "/calendar", label: "Calendar" }] },
  { label: "TOOLS", items: [{ href: "/workbench", label: "Workbench" }, { href: "/validity", label: "Validity" }, { href: "/outputs", label: "Outputs" }] },
  { label: "ADVANCED", items: [{ href: "/devs", label: "Devs" }] },
];
```

If the user clicks `/workbench` with no selected competition, route to `/dashboard` and show a Sonner toast: `Pilih kompetisi dulu untuk membuka Workbench.`

- [ ] **Step 4: Add layout files**

`src/app/(app)/layout.tsx`:

```tsx
import { AppShell } from "@/components/esai/shell/AppShell";
import { CompetitionProvider } from "@/components/esai/shell/CompetitionProvider";
import { ThemeProvider } from "@/components/esai/shell/ThemeProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <CompetitionProvider>
        <AppShell>{children}</AppShell>
      </CompetitionProvider>
    </ThemeProvider>
  );
}
```

`src/app/(app)/page.tsx` and `src/app/page.tsx` both redirect:

```tsx
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/dashboard");
}
```

- [ ] **Step 5: Add sidebar test**

Write `app-sidebar.test.tsx` using `vi.mock("next/navigation")` and `vi.mock("next/link")`; assert grouped labels and active Dashboard state render.

Run:

```powershell
npm test -- src/components/esai/shell/__tests__/app-sidebar.test.tsx
npm run build
```

Expected: both pass.

- [ ] **Step 6: Commit shell**

Run:

```powershell
git add src/components/esai/shell src/app/page.tsx "src/app/(app)"
git commit -m "feat(app): add routed shell"
git push
```

---

### Task 4: Dashboard Route

**Files:**
- Create: `src/app/(app)/dashboard/page.tsx`
- Create: `src/app/(app)/dashboard/loading.tsx`
- Create: `src/components/esai/dashboard/CompetitionCard.tsx`
- Create: `src/components/esai/dashboard/CompetitionGrid.tsx`
- Create: `src/components/esai/dashboard/CompetitionWizard.tsx`
- Create: `src/components/esai/dashboard/CompetitionOverview.tsx`
- Create: `src/components/esai/dashboard/FileDropZone.tsx`
- Create: `src/components/esai/common/EmptyState.tsx`
- Create: `src/components/esai/common/CelebrationToast.tsx`
- Create: `src/components/esai/dashboard/__tests__/competition-card.test.tsx`

- [ ] **Step 1: Extract card behavior**

Move card display logic from old `DashboardScreen` into `CompetitionCard`. Preserve:

```ts
type CompetitionCardProps = {
  competition: Competition;
  selected: boolean;
  onOpen: (competition: Competition) => void;
  onEdit: (competition: Competition) => void;
  onDelete: (competition: Competition) => void;
};
```

Visual hierarchy must match spec: poster first, title second, progress visual, deadline badge, muted metadata, menu hidden until hover on desktop.

- [ ] **Step 2: Extract wizard with upload behavior**

Move `AddCompetitionWizard` behavior into `CompetitionWizard`. Preserve:
- `createCompetition(formData)`
- poster + guidebook validation through `isCompetitionUploadComplete`
- blocking upload modal
- registration link field
- poster preview and WebP conversion behavior if present in current monolith

On successful creation:

```ts
toast.success("Kompetisi berhasil dibuat!");
```

- [ ] **Step 3: Extract overview modal**

Move `CompetitionOverviewModal`, `FileRow`, `FileViewer`, `TextFileViewer`, and `AssetMakerSection` into dashboard files or `src/components/esai/files/*` if one file would exceed 400 lines.

Rule: no new file over 400 lines. If `CompetitionOverview.tsx` exceeds 400 lines, split:
- `src/components/esai/files/FileViewer.tsx`
- `src/components/esai/dashboard/AssetMakerSection.tsx`

- [ ] **Step 4: Add route page**

`src/app/(app)/dashboard/page.tsx` renders a client container that uses `useCompetitionsContext()` and shows skeletons while loading:

```tsx
import { DashboardRoute } from "@/components/esai/routes/DashboardRoute";

export default function DashboardPage() {
  return <DashboardRoute />;
}
```

- [ ] **Step 5: Test card**

Test deadline, title, progress, and action menu accessible names.

Run:

```powershell
npm test -- src/components/esai/dashboard/__tests__/competition-card.test.tsx
npm run build
```

- [ ] **Step 6: Commit dashboard**

Run:

```powershell
git add "src/app/(app)/dashboard" src/components/esai/dashboard src/components/esai/common
git commit -m "feat(dashboard): migrate competition dashboard"
git push
```

---

### Task 5: Workbench Route

**Files:**
- Create: `src/app/(app)/workbench/page.tsx`
- Create: `src/app/(app)/workbench/[competitionId]/page.tsx`
- Create: `src/app/(app)/workbench/[competitionId]/loading.tsx`
- Create: `src/components/esai/workbench/WorkbenchView.tsx`
- Create: `src/components/esai/workbench/PipelineRail.tsx`
- Create: `src/components/esai/workbench/StageWorkspace.tsx`
- Create: `src/components/esai/workbench/AssistantPanel.tsx`
- Create: `src/components/esai/workbench/RunStatusBar.tsx`
- Create: `src/components/esai/workbench/AgentChoiceCard.tsx`
- Create: `src/components/esai/workbench/__tests__/pipeline-rail.test.tsx`

- [ ] **Step 1: Route selected competition through URL**

`/workbench` should redirect:

```tsx
import { redirect } from "next/navigation";

export default function WorkbenchIndexPage() {
  redirect("/dashboard");
}
```

`/workbench/[competitionId]` passes `competitionId` into `WorkbenchRoute`.

- [ ] **Step 2: Extract pipeline rail**

Move stage marker rendering to `PipelineRail`. Required props:

```ts
type PipelineRailProps = {
  stages: StageStateEntry[];
  currentStageId: StageId;
  selectedStageId: StageId;
  onSelectStage: (stageId: StageId) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};
```

Completed marker: emerald + check icon. Current marker: amber ring. Future marker: muted dashed border.

- [ ] **Step 3: Extract run/chat logic without changing API**

Move existing Workbench state and calls intact:
- `/api/competitions/[id]/stage-state`
- `/api/agent-runs`
- `/api/agent-runs/[id]`
- `/api/agent-messages`
- `extractAgentChoiceFromMessage`
- `validateModelRequest`

Do not change backend route signatures in this task.

- [ ] **Step 4: Add route loading skeleton**

`loading.tsx` must render rail skeleton, work area skeleton, and assistant skeleton using `Skeleton`, not text.

- [ ] **Step 5: Test pipeline rail**

Test completed/current/locked stages and click selection.

Run:

```powershell
npm test -- src/components/esai/workbench/__tests__/pipeline-rail.test.tsx src/lib/esai/__tests__/workflow.test.ts
npm run build
```

- [ ] **Step 6: Commit workbench**

Run:

```powershell
git add "src/app/(app)/workbench" src/components/esai/workbench
git commit -m "feat(workbench): migrate routed pipeline workspace"
git push
```

---

### Task 6: Secondary Routes

**Files:**
- Create: `src/app/(app)/calendar/page.tsx`
- Create: `src/app/(app)/validity/page.tsx`
- Create: `src/app/(app)/outputs/page.tsx`
- Create: `src/app/(app)/devs/page.tsx`
- Create: `src/app/(app)/settings/page.tsx`
- Create: `src/components/esai/routes/CalendarRoute.tsx`
- Create: `src/components/esai/routes/ValidityRoute.tsx`
- Create: `src/components/esai/routes/OutputsRoute.tsx`
- Create: `src/components/esai/routes/DevsRoute.tsx`
- Create: `src/components/esai/routes/SettingsRoute.tsx`

- [ ] **Step 1: Calendar**

Move `CalendarScreen` to `CalendarRoute`. Keep Bahasa copy but use `EmptyState`:

```tsx
<EmptyState
  title="Belum ada jadwal"
  description="Buat kompetisi untuk generate timeline otomatis."
  actionLabel="Tambah Kompetisi"
  href="/dashboard"
/>
```

- [ ] **Step 2: Validity**

Move `ValidityChecker` to `ValidityRoute`. Keep checker placeholder and assistant affordance; use warm card styles and `Alert` for validation notices.

- [ ] **Step 3: Outputs**

Move `FinalOutputs` to `OutputsRoute`. Use `useCompetitionsContext()` instead of props.

- [ ] **Step 4: Devs**

Move `DevsScreen`, `StyleBuilderWorkspace`, and `ByokSettings` to `DevsRoute`. Keep `DevsAgentsWorkspace` import unchanged. If file exceeds 400 lines, split:
- `src/components/esai/devs/StyleBuilderWorkspace.tsx`
- `src/components/esai/devs/ByokSettings.tsx`
- `src/components/esai/devs/DevsTabs.tsx`

- [ ] **Step 5: Settings**

Move `AnalyticalBoard` and `AnalyticalDashboard` to `SettingsRoute` or `src/components/esai/settings/*`. Rename visible route label from Profile to Settings.

- [ ] **Step 6: Route smoke tests**

Run:

```powershell
npm test
npm run build
```

Expected: all existing tests still pass after import path updates.

- [ ] **Step 7: Commit secondary routes**

Run:

```powershell
git add "src/app/(app)/calendar" "src/app/(app)/validity" "src/app/(app)/outputs" "src/app/(app)/devs" "src/app/(app)/settings" src/components/esai/routes src/components/esai/devs src/components/esai/settings
git commit -m "feat(app): migrate secondary routes"
git push
```

---

### Task 7: Micro-Interactions and Human Feedback

**Files:**
- Create: `src/components/esai/common/PageMotion.tsx`
- Create: `src/components/esai/common/ConfettiBurst.tsx`
- Modify: `src/components/esai/shell/AppShell.tsx`
- Modify: dashboard/workbench/devs route components

- [ ] **Step 1: Add page transition wrapper**

Use a client component:

```tsx
"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function PageMotion({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Add global toaster**

In `AppShell`, render:

```tsx
import { Toaster } from "sonner";

<Toaster richColors position="top-right" />
```

- [ ] **Step 3: Add celebration triggers**

Use:

```ts
toast.success("Kompetisi berhasil dibuat!");
toast.success("Tahap selesai. Output siap ditinjau.");
toast.success("Agent aktif!");
```

Add confetti only for all-stages-complete and auto-dismiss after 3000ms.

- [ ] **Step 4: Verify reduced motion**

Add CSS:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

Run:

```powershell
npm run build
```

- [ ] **Step 5: Commit interactions**

Run:

```powershell
git add src/components/esai/common src/components/esai/shell src/app/globals.css
git commit -m "feat(ui): add human feedback interactions"
git push
```

---

### Task 8: Delete Monolith and Final QA

**Files:**
- Delete: `src/components/esai/EsaiPremiumApp.tsx`
- Modify: imports/tests that reference old monolith
- Modify: `src/app/globals.css` to final under-50-line target
- Create: `src/components/esai/__tests__/route-regression.test.tsx`

- [ ] **Step 1: Find remaining monolith references**

Run:

```powershell
Select-String -Path 'src\**\*.tsx','src\**\*.ts' -Pattern 'EsaiPremiumApp|activeScreen|setActiveScreen|profile"'
```

Expected: no production references to `EsaiPremiumApp`, no `activeScreen` state, no Profile route.

- [ ] **Step 2: Delete old monolith**

Run:

```powershell
git rm src/components/esai/EsaiPremiumApp.tsx
```

- [ ] **Step 3: Check file size targets**

Run:

```powershell
Get-ChildItem -Recurse src/components -Include *.tsx,*.ts | ForEach-Object {
  $lines = (Get-Content $_.FullName | Measure-Object -Line).Lines
  [PSCustomObject]@{ Lines = $lines; Path = $_.FullName }
} | Sort-Object Lines -Descending | Select-Object -First 20
```

Expected: no `src/components/*` file over 400 lines. If `DevsAgentsWorkspace.tsx` remains over 400 lines and was not touched by the visual migration, document it as existing technical debt; otherwise split it before final commit.

- [ ] **Step 4: Full verification**

Run:

```powershell
npm run lint
npm test
npm run build
```

Expected: all pass.

- [ ] **Step 5: Browser smoke test**

Start dev server:

```powershell
npm run dev
```

Open and test:
- `http://localhost:3000/dashboard`
- `http://localhost:3000/calendar`
- `http://localhost:3000/outputs`
- `http://localhost:3000/devs`
- `http://localhost:3000/settings`
- `http://localhost:3000/workbench/[real-competition-id]`

Verify:
- sidebar link active states
- browser back/forward
- dark/light mode
- skeletons appear on route loading
- competition create/edit/delete still works
- workbench run controls still call existing APIs
- mobile layout at 390px width

- [ ] **Step 6: Accessibility and bundle check**

Run Lighthouse in Chrome DevTools or Playwright if available. Target:
- Accessibility score >= 90
- no button without accessible name
- no color contrast errors on warm tokens

Run bundle check with Next build output. If client bundle grows by more than 50KB gzip from the pre-redesign build, inspect imports and move motion-heavy celebration code behind dynamic import.

- [ ] **Step 7: Commit final migration**

Run:

```powershell
git add src package.json package-lock.json components.json
git commit -m "feat(ui): complete humanized routed redesign"
git push
```

---

## Self-Review

- Spec coverage: warm palette, typography, spacing, radius, route decomposition, shadcn primitives, skeletons, transitions, celebration toasts, empty states, dashboard hierarchy, sidebar grouping, workbench rail, cleanup, and smoke testing are each mapped to tasks.
- Placeholder scan: no unfinished placeholder markers. Optional splits have explicit file names and triggers.
- Type consistency: route state moves from `Screen` to URL paths; `CompetitionContextValue`, `PipelineRailProps`, and `CompetitionCardProps` are defined before use.
- Scope check: backend/API changes are out of scope. Existing API calls are preserved.
- Risk: `DevsAgentsWorkspace.tsx` is already large and may remain above the 400-line target unless Task 6 touches enough of it to justify a split. Treat that as migration debt to resolve if final size gate is strict.

# Frontend Humanization — Full Design System Overhaul

**Date:** 2026-05-15
**Status:** Design approved
**Scope:** Complete frontend redesign — from cold admin-panel aesthetic to warm, humanistic design system. Covers all screens, component architecture, route decomposition, and micro-interactions.

---

## 1. Problem Statement

Current frontend has 5 core issues making it feel "kurang humanis":

1. **Cold visual tone** — green accent (`oklch(58% 0.16 160)`) is clinical. All elements use uniform 1px borders + 8-12px radius. Feels like enterprise admin panel, not a companion app for students.
2. **Typography too uniform** — Inter + Plus Jakarta Sans both geometric sans-serif. Weight jumps 900 vs normal with no middle layer. Spacing too tight (6-10px gaps).
3. **Minimal micro-interactions** — Only `translateY(-1px)` hover and `fadeIn` mount. No skeleton loading, no transitions between screens, no celebratory feedback.
4. **Information overload without hierarchy** — Dashboard cards show poster, title, institution, category, progress, deadline, stage, menu all at equal prominence. Sidebar has 7 items without grouping.
5. **Visual language mismatch with target user** — Target: Indonesian university students in academic competitions. Current tone: enterprise SaaS. Students need encouraging, clear next-action, celebratory feedback.

Additionally, `EsaiPremiumApp.tsx` is a 3900-line monolith with all screens in one file, no URL routing, no code splitting.

---

## 2. Design Token System

### 2.1 Color Palette — Warm Shift

| Token | Light | Dark | Rationale |
|-------|-------|------|-----------|
| `--primary` | amber-500 `oklch(78% 0.16 70)` | amber-400 | Warm, encouraging, non-corporate |
| `--primary-soft` | amber-500/10% | amber-400/15% | Backgrounds, hover states |
| `--secondary` | coral-500 `oklch(68% 0.14 25)` | coral-400 | Celebratory accents, badges |
| `--bg` | warm gray `oklch(98.5% 0.004 80)` | `oklch(16% 0.008 260)` | Slightly warm undertone |
| `--surface` | white | `oklch(21% 0.008 260)` | Cards, panels |
| `--muted` | `oklch(52% 0.01 260)` | `oklch(68% 0.01 260)` | Secondary text |
| `--border` | `oklch(92% 0.004 80)` | `oklch(30% 0.008 260)` | Subtle, warm-tinted |
| `--success` | emerald-500 | emerald-400 | Completion, progress |
| `--danger` | red-500 | red-400 | Delete, errors |

### 2.2 Typography Scale

| Role | Font | Size | Weight | Line-height |
|------|------|------|--------|-------------|
| Display (h1) | Plus Jakarta Sans | 32-40px | 800 | 1.1 |
| Heading (h2) | Plus Jakarta Sans | 22-26px | 700 | 1.2 |
| Subheading (h3) | Inter | 16-18px | 600 | 1.3 |
| Body | Inter | 14-15px | 400 | 1.6 |
| Caption | Inter | 12-13px | 500 | 1.4 |

Key change: max weight drops from 900/950 to 800. Less aggressive, more approachable.

### 2.3 Spacing

- Base unit: 4px
- Minimum gap between elements: 12px (up from 6px)
- Section spacing: 24-32px
- Card internal padding: 20-24px (up from 13-18px)
- Page padding: 32-40px

### 2.4 Border Radius

| Element | Radius |
|---------|--------|
| Buttons | 12px |
| Cards | 16px |
| Modals/Dialogs | 20px |
| Inputs | 10px |
| Badges/Pills | 999px |
| Avatar | 999px |

### 2.5 Shadows

Replace flat borders with subtle elevation:
- Card resting: `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)`
- Card hover: `0 10px 30px -10px rgba(0,0,0,0.1)`
- Modal: `0 20px 60px -20px rgba(0,0,0,0.2)`
- Floating panel: `0 12px 40px -12px rgba(0,0,0,0.15)`

---

## 3. Architecture — Route Decomposition

### 3.1 Current State

All screens in `EsaiPremiumApp.tsx` (3900 lines). Screen switching via `useState<Screen>`. No URL routing, no code splitting, no browser history.

### 3.2 New Route Structure

```
src/app/
├── (app)/                          ← authenticated layout group
│   ├── layout.tsx                  ← Sidebar + shell (shared)
│   ├── page.tsx                    ← redirects to /dashboard
│   ├── dashboard/
│   │   └── page.tsx                ← competition grid
│   ├── calendar/
│   │   └── page.tsx                ← calendar view
│   ├── workbench/
│   │   └── [competitionId]/
│   │       └── page.tsx            ← pipeline workbench
│   ├── validity/
│   │   └── page.tsx                ← validity checker
│   ├── outputs/
│   │   └── page.tsx                ← final outputs
│   ├── devs/
│   │   └── page.tsx                ← agent editor
│   └── settings/
│       └── page.tsx                ← user settings (was "profile")
├── login/
│   └── page.tsx
└── error-page/
    └── page.tsx
```

### 3.3 Shared Layout (`(app)/layout.tsx`)

Responsibilities:
- Render `<Sidebar />` (persistent across navigations)
- Auth check — redirect to `/login` if no session
- Provide `CompetitionContext` (list, selected, loading state)
- Provide `ThemeContext` (dark/light toggle)
- Wrap children in main content shell

### 3.4 State Management

- **Global (Context):** auth user, competition list, selected competition, theme
- **Per-screen:** local state only (form drafts, UI toggles)
- **No external state library needed** — app state is simple enough for React Context

### 3.5 Benefits

- URL-addressable screens (shareable links, browser back/forward)
- Automatic code splitting per route
- Each page file 200-400 lines max
- Sidebar renders once, no re-mount on navigate
- `[competitionId]` param eliminates global selected-competition state for workbench

---

## 4. Component Library — shadcn/ui Integration

### 4.1 Setup

- Initialize shadcn with `New York` style (rounder, warmer defaults)
- Tailwind CSS variables mode
- Override default theme with warm palette from Section 2
- Components: `src/components/ui/` (shadcn primitives)
- App composites: `src/components/esai/` (domain-specific)

### 4.2 shadcn Components to Install

| Component | Replaces |
|-----------|----------|
| `Button` | `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.ghost-icon` |
| `Card` | `.comp-card`, `.kpi-card`, `.analytical-card`, `.panel` |
| `Dialog` | `.modal-backdrop`, `.small-modal`, `.wizard` |
| `Sidebar` | Custom `.sidebar` |
| `Skeleton` | "Loading…" text |
| `Progress` | `.progress-track`, `.comp-card-progress-bar` |
| `Tabs` | `.segmented`, `.dev-tabs` |
| `Input`, `Select`, `Textarea` | Raw HTML elements with custom CSS |
| `Badge` | `.status-chip`, `.comp-status-pill`, `.filter-chip` |
| `DropdownMenu` | `.comp-card-menu-pop` |
| `Tooltip` | Inline `title` attributes |
| `Sheet` | Mobile sidebar overlay |
| `Avatar` | `.avatar` |
| `Calendar` | Custom calendar grid |
| `Toast` (Sonner) | `.form-note` notices |
| `Alert` | `.validation-alert` |
| `Separator` | Border-top dividers |

### 4.3 Custom App Composites

| Component | Purpose | Location |
|-----------|---------|----------|
| `CompetitionCard` | Dashboard card with poster, progress, metadata | `src/components/esai/CompetitionCard.tsx` |
| `PipelineRail` | Workbench left rail with stage stepper | `src/components/esai/PipelineRail.tsx` |
| `AssistantPanel` | AI chat sidebar panel | `src/components/esai/AssistantPanel.tsx` |
| `EmptyState` | Reusable empty state with illustration slot | `src/components/esai/EmptyState.tsx` |
| `CelebrationToast` | Confetti/checkmark for milestone completion | `src/components/esai/CelebrationToast.tsx` |
| `FileDropZone` | Upload area with preview and validation | `src/components/esai/FileDropZone.tsx` |
| `CompetitionWizard` | Multi-step competition creation dialog | `src/components/esai/CompetitionWizard.tsx` |
| `CompetitionOverview` | Detail/edit modal for a competition | `src/components/esai/CompetitionOverview.tsx` |

---

## 5. Micro-interactions & Feedback

### 5.1 Loading States

- `Skeleton` components for every card, list item, and panel
- Pulse animation (shadcn default)
- Sidebar remains interactive during content loading
- No text-only "Loading…" anywhere

### 5.2 Transitions

- **Page transitions:** `framer-motion` layout animations — fade + slight upward slide, 200ms ease-out
- **Card hover:** `scale(1.02)` + shadow elevation + border-color warm shift
- **Button press:** `scale(0.97)` with spring easing
- **Sidebar collapse:** smooth width transition (keep existing 180ms)
- **Modal enter/exit:** scale from 0.95 + fade, 250ms

### 5.3 Celebratory Moments

| Trigger | Feedback |
|---------|----------|
| Competition created | Confetti burst + toast "Kompetisi berhasil dibuat! 🎉" |
| Stage completed | Checkmark animation + progress bar fills with spring easing |
| All stages done | Brief full-screen celebration overlay (auto-dismiss 3s) |
| File uploaded | Success checkmark morph from upload icon |
| Agent published | Toast with sparkle "Agent aktif! ✨" |

### 5.4 Empty States

Every screen has an illustrated empty state:
- Simple SVG illustration (2-3 colors from palette: amber, coral, warm gray)
- Encouraging copy in Bahasa Indonesia
- Single clear CTA button
- Examples:
  - Dashboard empty: "Belum ada kompetisi. Mulai perjalanan akademikmu!" + "Tambah Kompetisi"
  - Calendar empty: "Belum ada jadwal. Buat kompetisi untuk generate timeline otomatis."
  - Outputs empty: "Output akan muncul setelah pipeline selesai."

---

## 6. Information Hierarchy Fixes

### 6.1 Dashboard Cards

Priority order (visual weight):
1. **Poster image** — hero area, 55-60% card height, rounded corners
2. **Title** — 18px, weight 700, single line truncate
3. **Progress bar** — visual only, percentage in tooltip
4. **Deadline badge** — amber/urgent if < 7 days, otherwise muted
5. **Meta** (institution, category, stage) — caption size, muted color
6. **Menu** — hidden until hover (desktop), always visible (mobile)

### 6.2 Sidebar Grouping

```
┌─────────────────┐
│ ESAI.ai (brand) │
├─────────────────┤
│ ✨ AI Assistant │  ← visually distinct, gradient border
├─────────────────┤
│ MAIN            │  ← group label, muted caption
│  Dashboard      │
│  Calendar       │
├─────────────────┤
│ TOOLS           │
│  Workbench      │
│  Validity       │
│  Outputs        │
├─────────────────┤
│ ADVANCED        │
│  Devs           │
├─────────────────┤
│ [avatar] User   │
│ Settings        │
│ Sign out        │
└─────────────────┘
```

Active item: filled background + left 3px accent bar.

### 6.3 Workbench Pipeline Rail

- Stage markers: 40px (up from 34px), numbered
- Completed: filled emerald + animated check
- Current: pulsing ring animation (amber)
- Future: muted, dashed border
- Connector line: gradient from emerald (completed) → amber (current) → muted (future)

---

## 7. Dependencies

### 7.1 Add

| Package | Purpose | Bundle impact |
|---------|---------|---------------|
| `tailwindcss-animate` | shadcn animation utilities | CSS only |
| `class-variance-authority` | Component variant system | ~2KB |
| `clsx` | Conditional classes | <1KB |
| `tailwind-merge` | Merge Tailwind classes safely | ~1KB |
| `framer-motion` | Page transitions, celebrations | ~30KB (tree-shakeable) |
| `sonner` | Toast notifications | ~5KB |
| `@radix-ui/*` | Accessible primitives (via shadcn) | ~2-5KB per component |

### 7.2 Keep

- `lucide-react` — shadcn uses it for icons
- `next`, `react`, `react-dom` — unchanged
- `tailwindcss` — already present
- All server-side deps (`sharp`, `pdf-parse`, `mammoth`, `zod`, `@supabase/*`)

### 7.3 Remove After Migration

- Entire custom CSS design system in `globals.css` (2500+ lines of custom classes)
- No packages removed — all current deps still needed for backend

---

## 8. Migration Strategy

Big-bang approach, but executed safely in parallel:

```
Step 1: Setup foundation
  - Install shadcn + dependencies
  - Configure warm token theme
  - Create `src/components/ui/` with core components
  - Create utility: cn() helper (clsx + tailwind-merge)

Step 2: Build new route structure (parallel to old code)
  - Create (app)/ layout group with new Sidebar
  - Create empty page shells for each route
  - Wire CompetitionContext + ThemeContext

Step 3: Port screens one by one
  - Dashboard (cards, empty state, wizard)
  - Calendar
  - Workbench (pipeline rail, stage view, assistant)
  - Validity checker
  - Outputs
  - Devs (agent editor)
  - Settings

Step 4: Wire navigation + transitions
  - framer-motion page transitions
  - Sidebar active state from pathname
  - Competition selection via URL params

Step 5: Add micro-interactions
  - Skeleton loading for all data screens
  - Celebration toasts
  - Empty state illustrations
  - Hover/press animations

Step 6: Cleanup
  - Delete EsaiPremiumApp.tsx monolith
  - Delete old globals.css custom classes
  - Remove unused imports/types
  - Verify dark mode across all screens

Step 7: Smoke test
  - All screens render correctly
  - Navigation works (URL, back/forward)
  - Dark/light mode
  - Mobile responsive
  - Accessibility audit (Lighthouse ≥ 90)
```

---

## 9. File Size Targets

| Category | Max lines |
|----------|-----------|
| Page component (`page.tsx`) | 100-300 |
| UI primitive (`src/components/ui/`) | 50-150 |
| App composite (`src/components/esai/`) | 150-400 |
| Shared layout | ~100 |
| `globals.css` after migration | < 50 (base resets + font imports only) |

---

## 10. Success Criteria

1. No file > 400 lines in `src/components/`
2. Every screen has its own URL — browser back/forward works
3. Skeleton loading on every data-fetching screen
4. Illustrated empty state with CTA on every screen
5. Color palette warm (amber/coral primary) — no cold green
6. Minimum 12px spacing between elements, card padding 20px+
7. Celebratory feedback on: create competition, complete stage, publish agent
8. Dark mode works with warm palette
9. Lighthouse accessibility score ≥ 90
10. `globals.css` < 50 lines after migration
11. Total new dependencies add < 50KB to client bundle (gzipped)
12. All existing functionality preserved — no feature regression

---

## 11. Out of Scope

- Backend changes (API routes, database, Supabase config)
- New features (only redesign existing screens)
- Mobile native app
- i18n system (copy stays hardcoded Bahasa Indonesia for now)
- Storybook (nice-to-have later, not blocking)
- E2E test suite (manual smoke test sufficient for this phase)

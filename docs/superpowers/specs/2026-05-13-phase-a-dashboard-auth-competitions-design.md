# Phase A — Dashboard, Auth, and Competition CRUD

**Date:** 2026-05-13
**Status:** Design (ready for implementation planning)
**Scope:** First slice of wiring the ESAI Premium Dashboard prototype to real backend. Phase A covers auth, dashboard, and competition CRUD. Phases B (workbench pipeline) and C (full end-to-end) are out of scope.

---

## 1. Goals

1. Replace empty seed-array frontend state with real API calls to Supabase.
2. Add an email+password login page and protect routes via Next.js middleware.
3. Make competition creation upload a real poster image and guidebook file, extract text, store atomically.
4. Let users view, edit, delete their own competitions. Only their own data.
5. Show a clean empty state when a user has zero competitions. No demo data anywhere.

Out of scope: OAuth, workbench pipeline execution, calendar CRUD, validity checks, file vault, agent runs.

---

## 2. Architecture

```
Browser
  │  HTTP
  ▼
Next.js proxy (src/proxy.ts — Next 16 renamed middleware → proxy)
  │  checks Supabase session cookie
  │  no session → redirect /login
  │  session on /login → redirect /
  ▼
App routes
  ├── /login              → login/signup page (email+password)
  ├── /                   → EsaiPremiumApp (dashboard shell, authenticated)
  ├── /error              → dedicated error page with log
  └── /api/*
        ├── /api/competitions              (GET list, POST create basic)
        ├── /api/competitions/upload       (POST multipart: atomic create with poster+guidebook)
        ├── /api/competitions/[id]         (GET, PATCH, DELETE)
        └── /api/competitions/[id]/upload  (POST multipart: replace poster or guidebook)
```

Auth uses `@supabase/ssr` throughout. Middleware reads the session cookie server-side. Login page uses server actions for sign in / sign up / sign out. No client-side Supabase auth calls.

Data flow: client components call JSON APIs. APIs call the repository layer. Repository uses the service-role admin client but always scopes queries by `user_id` as defense-in-depth on top of RLS.

---

## 3. Auth and Route Protection

### 3.1 Login page (`src/app/login/page.tsx`)

Server component that redirects to `/` if a session exists. Renders `<LoginForm />` (client) with a toggle between Sign In and Sign Up.

Fields:
- Email
- Password
- Confirm password (sign up only)

Server actions in `src/app/login/actions.ts`:
- `signInAction(formData)` → calls `supabase.auth.signInWithPassword(...)`.
- `signUpAction(formData)` → calls `supabase.auth.signUp(...)`.
- `signOutAction()` → calls `supabase.auth.signOut()`, redirects to `/login`.

Errors from Supabase are returned to the form and shown inline.

### 3.2 Proxy (`src/proxy.ts`) — Next.js 16

Next.js 16 renamed `middleware.ts` → `proxy.ts`. Same behavior, new file convention. Exports a `proxy` function (or default export) plus a `config` with `matcher`.

Intercepts all routes except:
- `/login`
- `/api/*` (they do their own auth via `getRequestUser`)
- `/_next/*`, static assets

Behavior:
- No session, path ≠ `/login` → 302 `/login`.
- Session present, path = `/login` → 302 `/`.

Proxy refreshes the Supabase cookie on every request per `@supabase/ssr` guidance, using `NextResponse.next({ request: { headers: ... } })` to preserve the updated session cookies both upstream and to the client.

### 3.3 Logout

A logout button in the sidebar calls `signOutAction` (server action). After signing out, the page reloads at `/login`.

---

## 4. Data Model Alignment

### 4.1 Competition TypeScript type

The existing `Competition` type has `posterTone: string` which has no matching column in the `competitions` table. Replace with the real columns:

```ts
export type Competition = {
  id: string;
  title: string;
  category: string;
  institution: string;
  status: string;
  progress: number;
  deadline: string;           // ISO date
  registrationLink?: string;
  currentStageId: StageId;
  posterFileId?: string;      // FK to competition_files
  posterImageUrl?: string;    // 1-hour signed URL, filled by API
  guidebookFileId?: string;   // computed from competition_files (role=guidebook) for convenience
  createdAt?: string;
};
```

`posterImageUrl` and `guidebookFileId` are API-computed convenience fields, not columns.

### 4.2 DB changes

No schema migration required. `competitions.poster_file_id` already exists. `competition_files` already has `file_role`, `storage_bucket`, `storage_path`, `mime_type`, `content_text`, `status`, `approved`.

Cascades: verify `competition_files.competition_id`, `calendar_events.competition_id`, `agent_runs.competition_id`, etc. have `ON DELETE CASCADE`. If any don't, add a migration before shipping delete.

### 4.3 Storage layout

Bucket: `competition-files` (private).

Paths:
- Poster: `{user_id}/{competition_id}/poster.webp`
- Guidebook: `{user_id}/{competition_id}/guidebook.{ext}` where `ext ∈ {pdf, docx, md, txt}`

On replace: delete old object at the same role-based path, write new one.

---

## 5. API Endpoints

All endpoints require an authenticated Supabase session via `getRequestUser`. When the user is missing, respond with the existing `unauthorizedResponse()`.

### 5.1 `GET /api/competitions`

Returns the user's competitions. For each, generate a 1-hour signed URL for the poster and attach as `posterImageUrl`. Returned as existing `createApiEnvelope`.

### 5.2 `POST /api/competitions/upload` (multipart)

Atomic create. Multipart form fields:
- `title` (required, string, min 1)
- `category` (required, string; must be one of the allowed set)
- `institution` (optional, string)
- `deadline` (optional, ISO date string)
- `registrationLink` (optional, URL string)
- `poster` (required, File; image/png, image/jpeg, image/webp; ≤ 5 MB)
- `guidebook` (required, File; application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/markdown, text/plain; ≤ 20 MB)

Server sequence:

```
1. Validate auth.
2. Validate fields with Zod.
3. Validate files (size, mime).
4. Insert competitions row, get competition_id.
5. Process poster: sharp → WebP → upload to bucket.
6. Upload guidebook as-is.
7. Extract text from guidebook (server-side):
   - pdf-parse for PDF
   - mammoth for DOCX
   - utf-8 string read for MD/TXT
8. Insert competition_files rows for poster and guidebook
   (poster: file_role=poster, file_source=user_upload;
    guidebook: file_role=guidebook, file_source=user_upload, content_text=<extracted>).
9. Update competitions.poster_file_id with the poster row id.
10. Return the competition with a fresh signed posterImageUrl.
```

Rollback: if any step after competition insert fails, delete uploaded storage blobs and the competition row. File rows created before failure are also deleted. Return an error envelope; no partial state.

### 5.3 `GET /api/competitions/[id]`

Returns one competition with `posterImageUrl` signed URL.

### 5.4 `PATCH /api/competitions/[id]` (JSON)

Updates metadata only: `title`, `category`, `institution`, `deadline`, `registrationLink`. Does not touch poster or guidebook.

### 5.5 `DELETE /api/competitions/[id]`

Deletes the competition. Storage objects under `{user_id}/{competition_id}/` are removed first; then the competition row (cascades to related DB rows). Responds `{ deleted: true }`.

### 5.6 `POST /api/competitions/[id]/upload` (multipart)

Replaces poster, guidebook, or both. Accepts either one or both files in the multipart body. Server:
- If `poster`: process to WebP, upload (overwrite), update/insert the poster file row, refresh `poster_file_id`.
- If `guidebook`: upload, re-extract text, upsert the guidebook file row with new `content_text`.

Returns the updated competition.

### 5.7 Error envelope

Every API error uses:

```json
{
  "error": "human message",
  "code": "ERR_CODE",
  "correlationId": "<uuid>",
  "details": { ... }
}
```

The `X-Correlation-Id` header matches `correlationId`. Server-side `console.error` logs with the same id. This is what the error page displays so the user can tell you the id and you can grep logs.

---

## 6. Frontend Changes

### 6.1 `EsaiPremiumApp`

- Replace `useState(seedCompetitions)` with a fetch-on-mount pattern.
- States: `loading`, `error`, `data`.
- If `error`: navigate to `/error?source=dashboard&message=...&correlationId=...`.
- If `loading`: render a lightweight skeleton in the dashboard main area; sidebar stays active.
- If `data.length === 0`: render `<DashboardEmptyState />` (centered CTA).
- On wizard finish, push the new competition to state and switch to workbench (current behavior).
- On delete, filter the list.
- On edit save, replace the item in the list.

### 6.2 `DashboardEmptyState`

Centered in the main area. Large `+` icon, heading "No competitions yet", short tagline "Add your first competition to start the workflow", primary button "Add Competition" that opens the wizard. Sidebar and header unchanged.

### 6.3 `AddCompetitionWizard`

Three steps:
1. **Fields**: title (required), category (select, required), institution, deadline, registration link.
2. **Uploads**: two drop zones side by side — Poster (PNG/JPG/WebP, ≤ 5 MB) and Guidebook (PDF/DOCX/MD/TXT, ≤ 20 MB). Client-side validates size and mime before enabling "Next". Both files required before advancing.
3. **Confirm**: summary + "Mulai Sekarang" button. On click, build FormData and POST to `/api/competitions/upload`. Show progress (disabled button + spinner). On success, close wizard and route to workbench. On failure, show inline error with message + correlation id; keep wizard open.

Drop the current localStorage draft persistence for now.

### 6.4 `CompetitionOverviewModal`

Convert read-only fields to controlled inputs:
- Title, institution: text inputs
- Category: select
- Deadline: date
- Registration link: URL text

"Save" button calls `PATCH /api/competitions/[id]`. "Replace poster" and "Replace guidebook" open file pickers that call `POST /api/competitions/[id]/upload` with just that file.

Delete action opens `<DeleteConfirmDialog />`.

### 6.5 `DeleteConfirmDialog`

Modal with:
- Warning text listing what will be deleted (competition, poster, guidebook, all related files, calendar events, agent runs).
- Checkbox: "I understand that all data for this competition will be permanently deleted."
- Buttons: Cancel, Delete (disabled until checkbox is checked).

On confirm, calls `DELETE /api/competitions/[id]`. On success, closes both the dialog and the overview, refreshes the list.

### 6.6 Dashboard card

Each card displays:
- Poster image from `posterImageUrl` (aspect-ratio box, `object-cover`). If the signed URL expires (rare — 1 hour), a broken image is the fallback; next navigation refetches a new URL.
- Title, institution, category
- Progress bar, deadline, current stage label
- 3-dot menu (top right) with "Edit" and "Delete". Edit opens the Competition Overview in edit mode.

### 6.7 Error page (`/error`)

Reads query params: `source`, `message`, `correlationId`, and optional base64-encoded `stack`. Displays the message prominently, the correlation id for copy, and a collapsible `<details>` with the stack. Two buttons: Retry (uses a `returnTo` param) and Go to Dashboard.

### 6.8 Client data helpers (`src/lib/esai/api.ts`)

Add:

```ts
export async function fetchCompetitions(): Promise<Competition[]>;
export async function createCompetition(form: FormData): Promise<Competition>;
export async function updateCompetition(id: string, patch: Partial<Competition>): Promise<Competition>;
export async function deleteCompetition(id: string): Promise<void>;
export async function replaceCompetitionAssets(id: string, form: FormData): Promise<Competition>;
```

Each wraps `fetch`, throws a typed error with `correlationId` when the response is not ok.

---

## 7. Server Utilities (New)

### 7.1 `src/lib/server/file-extraction.ts`

```ts
export async function extractText(file: File): Promise<string>;
```

Dispatches on mime type:
- `application/pdf` → `pdf-parse`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → `mammoth`
- `text/markdown`, `text/plain` → `await file.text()`

Truncates very long text to a safe size (e.g., 200k chars) with a warning in metadata.

### 7.2 `src/lib/server/image-processing.ts`

```ts
export async function toWebp(file: File): Promise<{ buffer: Buffer; contentType: "image/webp" }>;
```

Uses `sharp`. Resizes to max 2000px on the long edge to bound storage. Quality 82.

### 7.3 `src/lib/server/storage.ts`

```ts
export async function uploadCompetitionAsset(args: { userId; competitionId; role: "poster" | "guidebook"; buffer; mimeType; ext }): Promise<{ storagePath }>;
export async function deleteCompetitionAssets(userId: string, competitionId: string): Promise<void>;
export async function signedCompetitionUrl(storagePath: string, expirySeconds = 3600): Promise<string>;
```

Wraps the Supabase admin Storage client with bucket name, path rules, and 1-hour signed URL generation.

### 7.4 Repository additions

`createEsaiRepository` gains:

```ts
async createCompetitionAtomic(input): Promise<Competition>;   // the multipart flow
async updateCompetition(id, patch): Promise<Competition>;
async deleteCompetition(id): Promise<void>;
async replaceCompetitionAsset(id, asset: "poster" | "guidebook", fileBytes, meta): Promise<Competition>;
```

Each always filters by `user_id`. The atomic create centralizes rollback so the API route stays thin.

---

## 8. Validation and Limits

Server-side (Zod + custom):
- title: 1–200 chars
- category: one of {Sains & Teknologi, Sosial & Humaniora, Inovasi Digital, KTI, Business Plan, Essay}
- institution: ≤ 200 chars
- deadline: ISO date, future date not enforced (user may import past ones)
- registrationLink: valid URL
- poster: mime ∈ {image/png, image/jpeg, image/webp}, size ≤ 5 MB
- guidebook: mime ∈ {application/pdf, .docx mime, text/markdown, text/plain}, size ≤ 20 MB

Client-side: mirror poster/guidebook validation for fast feedback.

Storage bucket (one-time config): set `file_size_limit` on `competition-files` to 20 MB as a final guard.

---

## 9. Dependencies

Add to `package.json`:

```
"sharp": "^0.33",
"pdf-parse": "^1.1",
"mammoth": "^1.8"
```

All run server-side only. No change to client bundle.

---

## 10. Testing

Minimal, focused:

Unit (Vitest):
- `image-processing.toWebp` returns webp buffer for png/jpg fixtures.
- `file-extraction.extractText` produces non-empty text for each of pdf/docx/md/txt fixtures.
- Repository `updateCompetition` applies patch fields; `deleteCompetition` removes related files.

Integration:
- `POST /api/competitions/upload` round trip using a mocked Supabase client (validate rollback removes rows when the second file upload fails).

Manual smoke (documented steps in the plan):
- Sign up → login → create competition with poster+guidebook → see it on dashboard with image → edit title → replace poster → delete with confirmation.

---

## 11. Implementation Order

1. Dependencies (`sharp`, `pdf-parse`, `mammoth`).
2. `src/proxy.ts` + `/login` page + logout action (get auth working end-to-end first). Note: Next.js 16 renamed middleware to proxy.
3. `/error` page + client error contract.
4. Server utilities: `storage.ts`, `image-processing.ts`, `file-extraction.ts`.
5. Repository additions: `createCompetitionAtomic`, `updateCompetition`, `deleteCompetition`, `replaceCompetitionAsset`.
6. API routes: `/api/competitions/upload`, `/api/competitions/[id]` (PATCH, DELETE), `/api/competitions/[id]/upload`.
7. Client helpers in `src/lib/esai/api.ts`.
8. Frontend: empty state, wizard real uploads, overview edits, delete dialog, dashboard fetch.
9. Smoke test full flow.
10. Clean up: remove `posterTone` references, ensure `seed.ts` stays empty.

---

## 12. Open Questions

None. Design approved through interview.

---

## 13. Success Criteria

- Unauthenticated users land on `/login` and cannot reach `/`.
- Signed-up users see an empty dashboard on first login; no demo data.
- Creating a competition uploads poster (converted to WebP) and guidebook (text extracted), links everything, shows the card immediately.
- Dashboard fetches only the logged-in user's competitions (RLS-enforced, scoped in queries too).
- Editing metadata or replacing poster/guidebook works from Competition Overview.
- Delete removes the competition + all storage + cascaded rows after checkbox confirmation.
- API failures route users to `/error` with a correlation id they can copy.

# Phase A — Dashboard, Auth, and Competition CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the ESAI Premium Dashboard frontend to a real Supabase backend for auth and competition CRUD, removing all dummy data and adding user-scoped login, atomic competition creation with poster/guidebook uploads, edit, and delete.

**Architecture:** Next.js 16 App Router with server-side Supabase SSR auth. Proxy (renamed middleware in Next 16) protects routes and refreshes sessions. Multipart upload API creates competition atomically with server-side WebP conversion and text extraction. Client fetches data via JSON APIs; React state mirrors the database.

**Tech Stack:** Next.js 16.2.5, React 19.2, TypeScript 5, `@supabase/ssr` + `@supabase/supabase-js`, Tailwind v4, Zod v4, `sharp` (WebP), `pdf-parse` (PDF text), `mammoth` (DOCX text), Vitest for unit tests.

**Spec:** `docs/superpowers/specs/2026-05-13-phase-a-dashboard-auth-competitions-design.md`

---

## Pre-flight

Before any task: confirm you're on a feature branch, not `main`.

```bash
git status
git checkout -b phase-a-dashboard-auth-competitions
```

Commit often. Every task ends with a commit.

---

## Task 1: Install server-side dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

Run:

```bash
npm install sharp pdf-parse mammoth
npm install --save-dev @types/pdf-parse
```

Expected: clean install. `sharp` may download a platform-specific binary — that's normal.

- [ ] **Step 2: Verify `package.json` lists them**

Open `package.json`. Confirm under `dependencies`:

```json
"mammoth": "^1.x",
"pdf-parse": "^1.x",
"sharp": "^0.33.x"
```

And under `devDependencies`:

```json
"@types/pdf-parse": "^1.x"
```

- [ ] **Step 3: Smoke-test the build still works**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add sharp, pdf-parse, mammoth deps for phase A"
```

---

## Task 2: Align types — replace `posterTone` with `posterFileId` and friends

**Files:**
- Modify: `src/types/esai.ts` — update `Competition` type
- Modify: `src/lib/server/repositories/esai-repository.ts:19-33` — update `mapCompetition`
- Modify: `src/components/esai/EsaiPremiumApp.tsx` — remove `posterTone` usages
- Modify: `src/lib/esai/seed.ts` — leave arrays empty (already empty)

- [ ] **Step 1: Update the `Competition` type**

In `src/types/esai.ts`, replace the existing `Competition` type:

```ts
export type Competition = {
  id: string;
  title: string;
  category: string;
  institution: string;
  status: string;
  progress: number;
  deadline: string;
  registrationLink?: string;
  currentStageId: StageId;
  posterFileId?: string;
  posterImageUrl?: string;
  guidebookFileId?: string;
  createdAt?: string;
};
```

- [ ] **Step 2: Update `mapCompetition`**

In `src/lib/server/repositories/esai-repository.ts`, replace the body of `mapCompetition`:

```ts
function mapCompetition(row: Record<string, unknown>): Competition {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    category: String(row.category ?? "Essay"),
    institution: String(row.institution ?? ""),
    status: String(row.status ?? "Setup"),
    progress: Number(row.progress ?? 0),
    deadline: row.deadline ? String(row.deadline) : "",
    registrationLink: row.registration_link ? String(row.registration_link) : undefined,
    currentStageId: String(row.current_stage_id ?? "onboarding") as Competition["currentStageId"],
    posterFileId: row.poster_file_id ? String(row.poster_file_id) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}
```

- [ ] **Step 3: Remove `posterTone` from the wizard and any component**

In `src/components/esai/EsaiPremiumApp.tsx`, find `posterTone:` in the `AddCompetitionWizard` finish function and delete that property from the object literal. Search the whole file for `posterTone` and remove any remaining references.

Run: `npm run lint -- --quiet` (informational — this task only cleans types; downstream edits will be in later tasks).

- [ ] **Step 4: Verify typescript compiles**

Run: `npx tsc --noEmit`
Expected: no errors related to `posterTone`. Other errors can be ignored for now if they already existed; re-run after the plan completes.

- [ ] **Step 5: Commit**

```bash
git add src/types/esai.ts src/lib/server/repositories/esai-repository.ts src/components/esai/EsaiPremiumApp.tsx
git commit -m "refactor(types): replace posterTone with posterFileId/posterImageUrl"
```

---

## Task 3: Update env example and add DEV helper doc

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Confirm required env vars are documented**

`.env.example` already has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_DISABLE_AUTH`, `DEV_USER_ID`. Leave them as-is.

- [ ] **Step 2: Commit if anything changed, else skip**

```bash
git status
# If nothing to commit, skip to Task 4.
```

---

## Task 4: Client Supabase helper for browser-side auth UI

**Files:**
- Create: `src/lib/supabase/client.ts`

- [ ] **Step 1: Create browser client**

Create `src/lib/supabase/client.ts`:

```ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { readSupabaseEnv } from "./env";

export function createSupabaseBrowserClient() {
  const env = readSupabaseEnv();
  if (!env.url || !env.publishableKey) return null;
  return createBrowserClient(env.url, env.publishableKey);
}
```

- [ ] **Step 2: Verify it imports cleanly**

Run: `npx tsc --noEmit src/lib/supabase/client.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/client.ts
git commit -m "feat(auth): add supabase browser client helper"
```

---

## Task 5: Proxy (Next.js 16 renamed middleware) for auth gating

**Files:**
- Create: `src/proxy.ts`

- [ ] **Step 1: Create the proxy file**

Create `src/proxy.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  const url = new URL(request.url);
  const { pathname } = url;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // If Supabase is not configured, let everything through (local dev mode).
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Match everything except Next internals, static files, and API routes (APIs auth themselves).
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "feat(auth): add Next.js 16 proxy for session refresh and route gating"
```

---

## Task 6: Login page with sign in / sign up toggle

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/actions.ts`
- Create: `src/app/login/LoginForm.tsx`
- Create: `src/app/login/login.module.css`

- [ ] **Step 1: Server actions**

Create `src/app/login/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string } | undefined;

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Authentication is not configured." };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/");
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Authentication is not configured." };

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  redirect("/");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login");
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2: Login form (client component)**

Create `src/app/login/LoginForm.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { signInAction, signUpAction, type AuthFormState } from "./actions";

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="login-form">
      <h1>{mode === "signin" ? "Sign in" : "Create account"}</h1>

      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>

      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={8}
          required
        />
      </label>

      {mode === "signup" ? (
        <label>
          Confirm password
          <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
        </label>
      ) : null}

      {state?.error ? <p className="login-error">{state.error}</p> : null}

      <button type="submit" disabled={pending}>
        {pending ? "Please wait..." : mode === "signin" ? "Sign in" : "Sign up"}
      </button>

      <button
        type="button"
        className="login-toggle"
        onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
      >
        {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Login page (server component)**

Create `src/app/login/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (data?.user) redirect("/");
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <LoginForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Minimal styles**

Create `src/app/login/login.module.css` (optional — the class names above use global styles; if the project uses CSS modules, convert the classNames accordingly). For now, append to `src/app/globals.css`:

```css
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--esai-bg, #f7f9fb);
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: white;
  border: 1px solid #dde3ea;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #5f6b7a;
}

.login-form input {
  padding: 10px 12px;
  border: 1px solid #dde3ea;
  border-radius: 8px;
  font-size: 14px;
}

.login-form button[type="submit"] {
  padding: 10px 14px;
  background: #147d64;
  color: white;
  border: 0;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.login-form button[type="submit"]:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-toggle {
  background: transparent;
  border: 0;
  color: #147d64;
  cursor: pointer;
  text-align: center;
  font-size: 13px;
}

.login-error {
  color: #c52b2b;
  font-size: 13px;
  margin: 0;
}
```

- [ ] **Step 5: Smoke test**

Start the dev server in a separate terminal (`npm run dev`) and visit `http://localhost:3000/login`. The form should render. Unauthenticated visit to `http://localhost:3000/` should redirect to `/login` (as the proxy runs).

Expected: `/login` reachable. `/` redirects. No 500 errors in the terminal.

- [ ] **Step 6: Commit**

```bash
git add src/app/login src/app/globals.css
git commit -m "feat(auth): login/signup page with server actions"
```

---

## Task 7: Sidebar logout button

**Files:**
- Modify: `src/components/esai/EsaiPremiumApp.tsx` — find Sidebar component, add a Logout button

- [ ] **Step 1: Locate the sidebar**

Open `src/components/esai/EsaiPremiumApp.tsx`. Locate the `Sidebar` function (search for `function Sidebar(`). Find the theme toggle area near the bottom.

- [ ] **Step 2: Add a form-based logout button**

Inside `Sidebar`, add near the bottom section (after the theme toggle button):

```tsx
<form action="/api/auth/logout" method="post" className="sidebar-logout-form">
  <button type="submit" className="sidebar-logout-button" title="Sign out">
    Sign out
  </button>
</form>
```

- [ ] **Step 3: Create the logout API route**

Create `src/app/api/auth/logout/route.ts`:

```ts
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/login");
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/esai/EsaiPremiumApp.tsx src/app/api/auth/logout/route.ts
git commit -m "feat(auth): add logout button to sidebar"
```

---

## Task 8: Shared API error envelope helpers

**Files:**
- Create: `src/lib/server/api-errors.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/__tests__/api-errors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { errorResponse } from "../api-errors";

describe("errorResponse", () => {
  it("returns a json response with error envelope and correlation id header", async () => {
    const response = errorResponse({
      message: "Bad thing happened",
      code: "ERR_BAD",
      status: 400,
      details: { field: "title" },
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("X-Correlation-Id")).toMatch(/^[0-9a-f-]{36}$/i);

    const body = await response.json();
    expect(body.error).toBe("Bad thing happened");
    expect(body.code).toBe("ERR_BAD");
    expect(body.details).toEqual({ field: "title" });
    expect(body.correlationId).toBe(response.headers.get("X-Correlation-Id"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/__tests__/api-errors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/server/api-errors.ts`:

```ts
import { randomUUID } from "node:crypto";

export type ApiErrorInput = {
  message: string;
  code: string;
  status: number;
  details?: Record<string, unknown>;
  cause?: unknown;
};

export function errorResponse(input: ApiErrorInput): Response {
  const correlationId = randomUUID();
  if (input.cause) {
    console.error(`[api-error] ${correlationId} ${input.code}:`, input.message, input.cause);
  } else {
    console.error(`[api-error] ${correlationId} ${input.code}:`, input.message);
  }

  return Response.json(
    {
      error: input.message,
      code: input.code,
      correlationId,
      details: input.details,
    },
    {
      status: input.status,
      headers: { "X-Correlation-Id": correlationId },
    },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/__tests__/api-errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/api-errors.ts src/lib/server/__tests__/api-errors.test.ts
git commit -m "feat(api): shared error envelope with correlation ids"
```

---

## Task 9: Image processing utility (WebP conversion)

**Files:**
- Create: `src/lib/server/image-processing.ts`
- Create: `src/lib/server/__tests__/image-processing.test.ts`
- Create fixture: `src/lib/server/__tests__/fixtures/sample.png` (use a 1x1 PNG)

- [ ] **Step 1: Create a tiny test fixture**

Run (PowerShell):

```powershell
$bytes = [byte[]](0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,0xDE,0x00,0x00,0x00,0x0C,0x49,0x44,0x41,0x54,0x08,0x99,0x63,0x60,0x60,0x60,0x00,0x00,0x00,0x04,0x00,0x01,0x27,0x34,0x27,0x0A,0x00,0x00,0x00,0x00,0x49,0x45,0x4E,0x44,0xAE,0x42,0x60,0x82)
New-Item -ItemType Directory -Force -Path src/lib/server/__tests__/fixtures | Out-Null
[System.IO.File]::WriteAllBytes((Resolve-Path src/lib/server/__tests__/fixtures).Path + "\sample.png", $bytes)
```

Expected: `src/lib/server/__tests__/fixtures/sample.png` exists.

- [ ] **Step 2: Write failing test**

Create `src/lib/server/__tests__/image-processing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { toWebp } from "../image-processing";

describe("toWebp", () => {
  it("converts a PNG file to WebP", async () => {
    const pngBytes = await readFile(path.join(__dirname, "fixtures", "sample.png"));
    const file = new File([pngBytes], "sample.png", { type: "image/png" });

    const result = await toWebp(file);

    expect(result.contentType).toBe("image/webp");
    expect(result.buffer.length).toBeGreaterThan(0);
    // WebP magic bytes: "RIFF....WEBP"
    expect(result.buffer.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(result.buffer.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/server/__tests__/image-processing.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `src/lib/server/image-processing.ts`:

```ts
import "server-only";
import sharp from "sharp";

export type WebpResult = { buffer: Buffer; contentType: "image/webp" };

export async function toWebp(file: File): Promise<WebpResult> {
  const arrayBuffer = await file.arrayBuffer();
  const input = Buffer.from(arrayBuffer);

  const buffer = await sharp(input)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  return { buffer, contentType: "image/webp" };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/server/__tests__/image-processing.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/image-processing.ts src/lib/server/__tests__/image-processing.test.ts src/lib/server/__tests__/fixtures/sample.png
git commit -m "feat(server): WebP image conversion with sharp"
```

---

## Task 10: File text extraction utility

**Files:**
- Create: `src/lib/server/file-extraction.ts`
- Create: `src/lib/server/__tests__/file-extraction.test.ts`
- Create fixtures: sample.md, sample.txt (sample.pdf/docx optional if fixtures are non-trivial)

- [ ] **Step 1: Create text fixtures**

```powershell
"# Sample guidebook`nRule 1. Write concisely." | Out-File -FilePath src/lib/server/__tests__/fixtures/sample.md -Encoding UTF8
"Plain text content." | Out-File -FilePath src/lib/server/__tests__/fixtures/sample.txt -Encoding UTF8
```

- [ ] **Step 2: Write failing test**

Create `src/lib/server/__tests__/file-extraction.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractText } from "../file-extraction";

async function loadFile(name: string, mime: string): Promise<File> {
  const bytes = await readFile(path.join(__dirname, "fixtures", name));
  return new File([bytes], name, { type: mime });
}

describe("extractText", () => {
  it("reads plain text", async () => {
    const file = await loadFile("sample.txt", "text/plain");
    const text = await extractText(file);
    expect(text).toContain("Plain text content");
  });

  it("reads markdown", async () => {
    const file = await loadFile("sample.md", "text/markdown");
    const text = await extractText(file);
    expect(text).toContain("Sample guidebook");
  });

  it("returns empty string for unsupported mime", async () => {
    const file = new File(["hello"], "x.bin", { type: "application/octet-stream" });
    const text = await extractText(file);
    expect(text).toBe("");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/server/__tests__/file-extraction.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `src/lib/server/file-extraction.ts`:

```ts
import "server-only";

const MAX_TEXT_LENGTH = 200_000;

function truncate(text: string): string {
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}

export async function extractText(file: File): Promise<string> {
  const mime = file.type.toLowerCase();

  if (mime === "text/plain" || mime === "text/markdown") {
    return truncate(await file.text());
  }

  if (mime === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await pdfParse(buffer);
    return truncate(result.text ?? "");
  }

  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword"
  ) {
    const mammoth = await import("mammoth");
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    return truncate(result.value ?? "");
  }

  return "";
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/server/__tests__/file-extraction.test.ts`
Expected: PASS (txt, md, and unsupported cases pass; pdf/docx would need heavier fixtures — left for manual smoke test later).

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/file-extraction.ts src/lib/server/__tests__/file-extraction.test.ts src/lib/server/__tests__/fixtures/sample.md src/lib/server/__tests__/fixtures/sample.txt
git commit -m "feat(server): text extraction for pdf/docx/md/txt"
```

---

## Task 11: Storage helper for competition assets

**Files:**
- Create: `src/lib/server/storage.ts`

- [ ] **Step 1: Implement**

Create `src/lib/server/storage.ts`:

```ts
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "competition-files";

export type AssetRole = "poster" | "guidebook";

export type UploadArgs = {
  userId: string;
  competitionId: string;
  role: AssetRole;
  buffer: Buffer;
  mimeType: string;
  ext: string;
};

function pathFor(userId: string, competitionId: string, role: AssetRole, ext: string) {
  return `${userId}/${competitionId}/${role}.${ext}`;
}

export async function uploadCompetitionAsset(args: UploadArgs): Promise<{ storagePath: string }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase admin client not configured.");

  const storagePath = pathFor(args.userId, args.competitionId, args.role, args.ext);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, args.buffer, { contentType: args.mimeType, upsert: true });
  if (error) throw error;

  return { storagePath };
}

export async function deleteCompetitionAssets(userId: string, competitionId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  const prefix = `${userId}/${competitionId}`;
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix);
  if (error) throw error;

  if (data && data.length > 0) {
    const paths = data.map((entry) => `${prefix}/${entry.name}`);
    const { error: delError } = await supabase.storage.from(BUCKET).remove(paths);
    if (delError) throw delError;
  }
}

export async function signedCompetitionUrl(storagePath: string, expirySeconds = 3600): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expirySeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export { BUCKET as COMPETITION_FILES_BUCKET };
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/storage.ts
git commit -m "feat(server): storage helpers for competition assets"
```

---

## Task 12: Repository — atomic create, update, delete, replace asset

**Files:**
- Modify: `src/lib/server/repositories/esai-repository.ts`

- [ ] **Step 1: Extend the repository**

In `src/lib/server/repositories/esai-repository.ts`, add these imports at the top:

```ts
import { extractText } from "@/lib/server/file-extraction";
import { toWebp } from "@/lib/server/image-processing";
import {
  uploadCompetitionAsset,
  deleteCompetitionAssets,
  signedCompetitionUrl,
  type AssetRole,
} from "@/lib/server/storage";
```

Add this helper function above `createEsaiRepository`:

```ts
function guidebookExtFor(mimeType: string): "pdf" | "docx" | "md" | "txt" | null {
  switch (mimeType) {
    case "application/pdf": return "pdf";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": return "docx";
    case "text/markdown": return "md";
    case "text/plain": return "txt";
    default: return null;
  }
}

async function attachPosterSignedUrl(comp: Competition, storagePathByFileId: Map<string, string>): Promise<Competition> {
  if (!comp.posterFileId) return comp;
  const path = storagePathByFileId.get(comp.posterFileId);
  if (!path) return comp;
  const url = await signedCompetitionUrl(path);
  return { ...comp, posterImageUrl: url ?? undefined };
}
```

Inside `createEsaiRepository`, find the `listCompetitions` method and replace it with:

```ts
async listCompetitions() {
  if (supabase && userId) {
    const { data, error } = await supabase
      .from("competitions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const competitions = (data ?? []).map(mapCompetition);

    const posterIds = competitions.map((c) => c.posterFileId).filter(Boolean) as string[];
    const storageMap = new Map<string, string>();
    if (posterIds.length > 0) {
      const { data: files } = await supabase
        .from("competition_files")
        .select("id,storage_path")
        .in("id", posterIds);
      for (const f of files ?? []) {
        if (f.storage_path) storageMap.set(String(f.id), String(f.storage_path));
      }
    }

    const withUrls = await Promise.all(competitions.map((c) => attachPosterSignedUrl(c, storageMap)));
    return createApiEnvelope(withUrls, { supabaseConfigured });
  }

  return createApiEnvelope(seedCompetitions, { supabaseConfigured });
},
```

Replace the existing `getCompetition`:

```ts
async getCompetition(id: string) {
  if (supabase && userId) {
    const { data, error } = await supabase
      .from("competitions")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return createApiEnvelope(null, { supabaseConfigured });

    const comp = mapCompetition(data);
    let storagePath: string | undefined;
    if (comp.posterFileId) {
      const { data: fileRow } = await supabase
        .from("competition_files")
        .select("storage_path")
        .eq("id", comp.posterFileId)
        .maybeSingle();
      storagePath = fileRow?.storage_path as string | undefined;
    }
    const withUrl = storagePath
      ? { ...comp, posterImageUrl: (await signedCompetitionUrl(storagePath)) ?? undefined }
      : comp;

    return createApiEnvelope(withUrl, { supabaseConfigured });
  }

  const competition = seedCompetitions.find((item) => item.id === id) ?? null;
  return createApiEnvelope(competition, { supabaseConfigured });
},
```

Add these new methods inside the returned object (after `createCompetition`):

```ts
async createCompetitionAtomic(input: {
  title: string;
  category: string;
  institution?: string;
  deadline?: string;
  registrationLink?: string;
  poster: File;
  guidebook: File;
}) {
  if (!supabase || !userId) {
    throw new Error("Supabase not configured or user not authenticated.");
  }

  const { data: compRow, error: insertErr } = await supabase
    .from("competitions")
    .insert({
      user_id: userId,
      title: input.title.trim() || "New Competition",
      category: input.category.trim() || "Essay",
      institution: input.institution?.trim() || null,
      deadline: input.deadline || null,
      registration_link: input.registrationLink || null,
      current_stage_id: "onboarding",
      status: "Setup",
      progress: 0,
    })
    .select("*")
    .single();
  if (insertErr) throw new Error(insertErr.message);

  const competitionId = String(compRow.id);

  const cleanup = async () => {
    try { await deleteCompetitionAssets(userId, competitionId); } catch {}
    try {
      await supabase.from("competition_files").delete().eq("competition_id", competitionId);
      await supabase.from("competitions").delete().eq("id", competitionId).eq("user_id", userId);
    } catch {}
  };

  try {
    const posterWebp = await toWebp(input.poster);
    const { storagePath: posterPath } = await uploadCompetitionAsset({
      userId,
      competitionId,
      role: "poster",
      buffer: posterWebp.buffer,
      mimeType: posterWebp.contentType,
      ext: "webp",
    });

    const ext = guidebookExtFor(input.guidebook.type);
    if (!ext) throw new Error(`Unsupported guidebook mime type: ${input.guidebook.type}`);
    const guidebookBuffer = Buffer.from(await input.guidebook.arrayBuffer());
    const { storagePath: gbPath } = await uploadCompetitionAsset({
      userId,
      competitionId,
      role: "guidebook",
      buffer: guidebookBuffer,
      mimeType: input.guidebook.type,
      ext,
    });

    const guidebookText = await extractText(input.guidebook);

    const { data: posterRow, error: posterErr } = await supabase
      .from("competition_files")
      .insert({
        user_id: userId,
        competition_id: competitionId,
        file_name: "poster.webp",
        file_role: "poster",
        file_source: "user_upload",
        storage_bucket: "competition-files",
        storage_path: posterPath,
        mime_type: posterWebp.contentType,
        size_bytes: posterWebp.buffer.length,
        status: "approved",
        approved: true,
      })
      .select("id")
      .single();
    if (posterErr) throw new Error(posterErr.message);

    const { error: gbErr } = await supabase
      .from("competition_files")
      .insert({
        user_id: userId,
        competition_id: competitionId,
        file_name: input.guidebook.name,
        file_role: "guidebook",
        file_source: "user_upload",
        storage_bucket: "competition-files",
        storage_path: gbPath,
        mime_type: input.guidebook.type,
        size_bytes: guidebookBuffer.length,
        content_text: guidebookText || null,
        status: "approved",
        approved: true,
      });
    if (gbErr) throw new Error(gbErr.message);

    const { data: updated, error: updErr } = await supabase
      .from("competitions")
      .update({ poster_file_id: posterRow.id })
      .eq("id", competitionId)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (updErr) throw new Error(updErr.message);

    const signedUrl = await signedCompetitionUrl(posterPath);
    const comp = mapCompetition(updated);
    return createApiEnvelope({ ...comp, posterImageUrl: signedUrl ?? undefined }, { supabaseConfigured });
  } catch (error) {
    await cleanup();
    throw error;
  }
},

async updateCompetition(id: string, patch: {
  title?: string;
  category?: string;
  institution?: string | null;
  deadline?: string | null;
  registrationLink?: string | null;
}) {
  if (!supabase || !userId) throw new Error("Supabase not configured or user not authenticated.");

  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.institution !== undefined) update.institution = patch.institution;
  if (patch.deadline !== undefined) update.deadline = patch.deadline;
  if (patch.registrationLink !== undefined) update.registration_link = patch.registrationLink;

  const { data, error } = await supabase
    .from("competitions")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return createApiEnvelope(mapCompetition(data), { supabaseConfigured });
},

async deleteCompetition(id: string) {
  if (!supabase || !userId) throw new Error("Supabase not configured or user not authenticated.");

  await deleteCompetitionAssets(userId, id);

  const { error } = await supabase
    .from("competitions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  return createApiEnvelope({ deleted: true }, { supabaseConfigured });
},

async replaceCompetitionAsset(id: string, role: AssetRole, file: File) {
  if (!supabase || !userId) throw new Error("Supabase not configured or user not authenticated.");

  const { data: compRow, error: compErr } = await supabase
    .from("competitions")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (compErr) throw new Error(compErr.message);
  if (!compRow) throw new Error("Competition not found.");

  if (role === "poster") {
    const webp = await toWebp(file);
    const { storagePath } = await uploadCompetitionAsset({
      userId,
      competitionId: id,
      role: "poster",
      buffer: webp.buffer,
      mimeType: webp.contentType,
      ext: "webp",
    });

    const { data: existing } = await supabase
      .from("competition_files")
      .select("id")
      .eq("competition_id", id)
      .eq("file_role", "poster")
      .maybeSingle();

    let posterFileId: string;
    if (existing?.id) {
      await supabase
        .from("competition_files")
        .update({
          file_name: "poster.webp",
          storage_path: storagePath,
          mime_type: webp.contentType,
          size_bytes: webp.buffer.length,
        })
        .eq("id", existing.id);
      posterFileId = String(existing.id);
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("competition_files")
        .insert({
          user_id: userId,
          competition_id: id,
          file_name: "poster.webp",
          file_role: "poster",
          file_source: "user_upload",
          storage_bucket: "competition-files",
          storage_path: storagePath,
          mime_type: webp.contentType,
          size_bytes: webp.buffer.length,
          status: "approved",
          approved: true,
        })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      posterFileId = String(inserted.id);
    }

    await supabase
      .from("competitions")
      .update({ poster_file_id: posterFileId })
      .eq("id", id)
      .eq("user_id", userId);
  } else {
    const ext = guidebookExtFor(file.type);
    if (!ext) throw new Error(`Unsupported guidebook mime type: ${file.type}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    const { storagePath } = await uploadCompetitionAsset({
      userId,
      competitionId: id,
      role: "guidebook",
      buffer,
      mimeType: file.type,
      ext,
    });
    const text = await extractText(file);

    const { data: existing } = await supabase
      .from("competition_files")
      .select("id")
      .eq("competition_id", id)
      .eq("file_role", "guidebook")
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("competition_files")
        .update({
          file_name: file.name,
          storage_path: storagePath,
          mime_type: file.type,
          size_bytes: buffer.length,
          content_text: text || null,
        })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("competition_files")
        .insert({
          user_id: userId,
          competition_id: id,
          file_name: file.name,
          file_role: "guidebook",
          file_source: "user_upload",
          storage_bucket: "competition-files",
          storage_path: storagePath,
          mime_type: file.type,
          size_bytes: buffer.length,
          content_text: text || null,
          status: "approved",
          approved: true,
        });
    }
  }

  return this.getCompetition(id);
},
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/repositories/esai-repository.ts
git commit -m "feat(repo): atomic create + update/delete/replace competition assets"
```

---

## Task 13: API route — atomic upload create

**Files:**
- Create: `src/app/api/competitions/upload/route.ts`

- [ ] **Step 1: Implement**

Create `src/app/api/competitions/upload/route.ts`:

```ts
import { z } from "zod";
import { errorResponse } from "@/lib/server/api-errors";
import { unauthorizedResponse } from "@/lib/server/auth";
import { createRequestRepository } from "@/lib/server/request-repository";

const POSTER_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const GUIDEBOOK_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/markdown",
  "text/plain",
]);
const POSTER_MAX = 5 * 1024 * 1024;
const GUIDEBOOK_MAX = 20 * 1024 * 1024;

const fieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  institution: z.string().trim().max(200).optional(),
  deadline: z.string().trim().optional(),
  registrationLink: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();

  let form: FormData;
  try {
    form = await request.formData();
  } catch (cause) {
    return errorResponse({ message: "Invalid multipart form.", code: "ERR_BAD_FORM", status: 400, cause });
  }

  const parsed = fieldsSchema.safeParse({
    title: form.get("title"),
    category: form.get("category"),
    institution: form.get("institution") || undefined,
    deadline: form.get("deadline") || undefined,
    registrationLink: form.get("registrationLink") || undefined,
  });
  if (!parsed.success) {
    return errorResponse({
      message: "Invalid competition fields.",
      code: "ERR_VALIDATION",
      status: 400,
      details: { issues: parsed.error.flatten() },
    });
  }

  const poster = form.get("poster");
  const guidebook = form.get("guidebook");
  if (!(poster instanceof File) || !(guidebook instanceof File)) {
    return errorResponse({ message: "Poster and guidebook files are required.", code: "ERR_MISSING_FILES", status: 400 });
  }
  if (!POSTER_MIME.has(poster.type)) {
    return errorResponse({ message: `Poster must be PNG, JPEG, or WebP. Got ${poster.type}.`, code: "ERR_POSTER_MIME", status: 400 });
  }
  if (poster.size > POSTER_MAX) {
    return errorResponse({ message: "Poster exceeds 5 MB.", code: "ERR_POSTER_SIZE", status: 400 });
  }
  if (!GUIDEBOOK_MIME.has(guidebook.type)) {
    return errorResponse({ message: `Guidebook must be PDF, DOCX, MD, or TXT. Got ${guidebook.type}.`, code: "ERR_GUIDEBOOK_MIME", status: 400 });
  }
  if (guidebook.size > GUIDEBOOK_MAX) {
    return errorResponse({ message: "Guidebook exceeds 20 MB.", code: "ERR_GUIDEBOOK_SIZE", status: 400 });
  }

  try {
    const response = await repository.createCompetitionAtomic({
      title: parsed.data.title,
      category: parsed.data.category,
      institution: parsed.data.institution,
      deadline: parsed.data.deadline,
      registrationLink: parsed.data.registrationLink,
      poster,
      guidebook,
    });
    return Response.json(response, { status: 201 });
  } catch (cause) {
    return errorResponse({
      message: cause instanceof Error ? cause.message : "Failed to create competition.",
      code: "ERR_CREATE_COMPETITION",
      status: 500,
      cause,
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/competitions/upload/route.ts
git commit -m "feat(api): atomic competition create with multipart upload"
```

---

## Task 14: API routes — PATCH and DELETE competition, PATCH asset replace

**Files:**
- Modify: `src/app/api/competitions/[id]/route.ts`
- Create: `src/app/api/competitions/[id]/upload/route.ts`

- [ ] **Step 1: Extend `[id]/route.ts` with PATCH and DELETE**

Replace the file contents of `src/app/api/competitions/[id]/route.ts` with:

```ts
import { z } from "zod";
import { errorResponse } from "@/lib/server/api-errors";
import { unauthorizedResponse } from "@/lib/server/auth";
import { createRequestRepository } from "@/lib/server/request-repository";

export async function GET(_request: Request, context: RouteContext<"/api/competitions/[id]">) {
  const { id } = await context.params;
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();
  const response = await repository.getCompetition(id);
  return Response.json(response, { status: response.data ? 200 : 404 });
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  institution: z.string().trim().max(200).nullable().optional(),
  deadline: z.string().trim().nullable().optional(),
  registrationLink: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(request: Request, context: RouteContext<"/api/competitions/[id]">) {
  const { id } = await context.params;
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse({
      message: "Invalid patch payload.",
      code: "ERR_VALIDATION",
      status: 400,
      details: { issues: parsed.error.flatten() },
    });
  }

  try {
    const response = await repository.updateCompetition(id, parsed.data);
    return Response.json(response);
  } catch (cause) {
    return errorResponse({
      message: cause instanceof Error ? cause.message : "Update failed.",
      code: "ERR_UPDATE_COMPETITION",
      status: 500,
      cause,
    });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/competitions/[id]">) {
  const { id } = await context.params;
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();

  try {
    const response = await repository.deleteCompetition(id);
    return Response.json(response);
  } catch (cause) {
    return errorResponse({
      message: cause instanceof Error ? cause.message : "Delete failed.",
      code: "ERR_DELETE_COMPETITION",
      status: 500,
      cause,
    });
  }
}
```

- [ ] **Step 2: Create upload replace route**

Create `src/app/api/competitions/[id]/upload/route.ts`:

```ts
import { errorResponse } from "@/lib/server/api-errors";
import { unauthorizedResponse } from "@/lib/server/auth";
import { createRequestRepository } from "@/lib/server/request-repository";

const POSTER_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const GUIDEBOOK_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/markdown",
  "text/plain",
]);
const POSTER_MAX = 5 * 1024 * 1024;
const GUIDEBOOK_MAX = 20 * 1024 * 1024;

export async function POST(request: Request, context: RouteContext<"/api/competitions/[id]/upload">) {
  const { id } = await context.params;
  const { repository, requiresAuth, user } = await createRequestRepository();
  if (requiresAuth && !user) return unauthorizedResponse();

  let form: FormData;
  try {
    form = await request.formData();
  } catch (cause) {
    return errorResponse({ message: "Invalid multipart form.", code: "ERR_BAD_FORM", status: 400, cause });
  }

  const poster = form.get("poster");
  const guidebook = form.get("guidebook");

  try {
    if (poster instanceof File) {
      if (!POSTER_MIME.has(poster.type)) {
        return errorResponse({ message: `Poster must be PNG/JPEG/WebP.`, code: "ERR_POSTER_MIME", status: 400 });
      }
      if (poster.size > POSTER_MAX) {
        return errorResponse({ message: "Poster exceeds 5 MB.", code: "ERR_POSTER_SIZE", status: 400 });
      }
      await repository.replaceCompetitionAsset(id, "poster", poster);
    }
    if (guidebook instanceof File) {
      if (!GUIDEBOOK_MIME.has(guidebook.type)) {
        return errorResponse({ message: "Guidebook must be PDF/DOCX/MD/TXT.", code: "ERR_GUIDEBOOK_MIME", status: 400 });
      }
      if (guidebook.size > GUIDEBOOK_MAX) {
        return errorResponse({ message: "Guidebook exceeds 20 MB.", code: "ERR_GUIDEBOOK_SIZE", status: 400 });
      }
      await repository.replaceCompetitionAsset(id, "guidebook", guidebook);
    }

    if (!(poster instanceof File) && !(guidebook instanceof File)) {
      return errorResponse({ message: "No files submitted.", code: "ERR_NO_FILES", status: 400 });
    }

    const response = await repository.getCompetition(id);
    return Response.json(response);
  } catch (cause) {
    return errorResponse({
      message: cause instanceof Error ? cause.message : "Upload failed.",
      code: "ERR_REPLACE_ASSET",
      status: 500,
      cause,
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/competitions/[id]/route.ts src/app/api/competitions/[id]/upload/route.ts
git commit -m "feat(api): PATCH/DELETE competition + replace assets endpoint"
```

---

## Task 15: Client-side API helpers

**Files:**
- Modify: `src/lib/esai/api.ts`

- [ ] **Step 1: Open the file**

Check current contents with `readFile` to preserve `createApiEnvelope`. Append new helpers after the existing export.

- [ ] **Step 2: Append client helpers**

Append to `src/lib/esai/api.ts`:

```ts
import type { Competition } from "@/types/esai";

export class ApiError extends Error {
  code: string;
  correlationId?: string;
  details?: Record<string, unknown>;
  status: number;
  constructor(init: { message: string; code: string; correlationId?: string; details?: Record<string, unknown>; status: number }) {
    super(init.message);
    this.code = init.code;
    this.correlationId = init.correlationId;
    this.details = init.details;
    this.status = init.status;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError({
      message: body?.error ?? `Request failed with ${res.status}`,
      code: body?.code ?? "ERR_UNKNOWN",
      correlationId: body?.correlationId ?? res.headers.get("X-Correlation-Id") ?? undefined,
      details: body?.details,
      status: res.status,
    });
  }
  return res.json() as Promise<T>;
}

type Envelope<T> = { data: T; meta: { backendMode: string; message?: string } };

export async function fetchCompetitions(): Promise<Competition[]> {
  const res = await fetch("/api/competitions", { cache: "no-store" });
  const body = await handle<Envelope<Competition[]>>(res);
  return body.data ?? [];
}

export async function createCompetition(form: FormData): Promise<Competition> {
  const res = await fetch("/api/competitions/upload", { method: "POST", body: form });
  const body = await handle<Envelope<Competition>>(res);
  return body.data;
}

export async function updateCompetition(id: string, patch: Partial<Competition>): Promise<Competition> {
  const res = await fetch(`/api/competitions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const body = await handle<Envelope<Competition>>(res);
  return body.data;
}

export async function deleteCompetition(id: string): Promise<void> {
  const res = await fetch(`/api/competitions/${id}`, { method: "DELETE" });
  await handle<Envelope<{ deleted: true }>>(res);
}

export async function replaceCompetitionAssets(id: string, form: FormData): Promise<Competition> {
  const res = await fetch(`/api/competitions/${id}/upload`, { method: "POST", body: form });
  const body = await handle<Envelope<Competition>>(res);
  return body.data;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/esai/api.ts
git commit -m "feat(api-client): typed fetch helpers for competitions"
```

---

## Task 16: Error page

**Files:**
- Create: `src/app/error-page/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/error-page/page.tsx`:

```tsx
import Link from "next/link";

type Props = { searchParams: Promise<{ source?: string; message?: string; correlationId?: string; returnTo?: string }> };

export default async function ErrorPage({ searchParams }: Props) {
  const params = await searchParams;
  const source = params.source ?? "Unknown";
  const message = params.message ?? "An unexpected error occurred.";
  const correlationId = params.correlationId;
  const returnTo = params.returnTo ?? "/";

  return (
    <main style={{ maxWidth: 720, margin: "60px auto", padding: "0 24px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginTop: 0 }}>Something went wrong</h1>
      <p style={{ color: "#5f6b7a" }}>We could not complete the last action.</p>

      <section style={{ marginTop: 24, padding: 16, border: "1px solid #dde3ea", borderRadius: 10, background: "#f7f9fb" }}>
        <div style={{ marginBottom: 8 }}><strong>Source:</strong> {source}</div>
        <div style={{ marginBottom: 8 }}><strong>Message:</strong> {message}</div>
        {correlationId ? <div><strong>Correlation ID:</strong> <code>{correlationId}</code></div> : null}
      </section>

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <Link href={returnTo} style={{ padding: "10px 14px", background: "#147d64", color: "white", borderRadius: 8, textDecoration: "none" }}>
          Retry
        </Link>
        <Link href="/" style={{ padding: "10px 14px", border: "1px solid #dde3ea", borderRadius: 8, textDecoration: "none", color: "#17202d" }}>
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/error-page/page.tsx
git commit -m "feat(errors): dedicated error page with correlation id"
```

---

## Task 17: Dashboard empty state component

**Files:**
- Modify: `src/components/esai/EsaiPremiumApp.tsx` — add a DashboardEmptyState component in the same file

- [ ] **Step 1: Find where DashboardScreen renders**

Open `src/components/esai/EsaiPremiumApp.tsx`. Locate `function DashboardScreen(` (there is already a cards grid there).

- [ ] **Step 2: Add empty state branch**

Inside the render for `DashboardScreen`, before mapping `competitions.map(...)`, add:

```tsx
if (competitions.length === 0) {
  return (
    <section className="screen dashboard-screen">
      <header className="screen-header">
        <div>
          <h1>Dashboard</h1>
          <p>Track your active academic competitions.</p>
        </div>
      </header>
      <div className="empty-state" style={{ padding: "64px 0", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: 18, background: "#ecf5f2", marginBottom: 16 }}>
          <Plus size={36} color="#147d64" />
        </div>
        <h2 style={{ margin: 0 }}>No competitions yet</h2>
        <p style={{ color: "#5f6b7a", marginTop: 6 }}>Add your first competition to start the workflow.</p>
        <button className="btn-primary" onClick={onAdd} style={{ marginTop: 18 }}>
          <Plus size={17} /> Add Competition
        </button>
      </div>
    </section>
  );
}
```

Ensure `Plus` is already imported from `lucide-react` (it is, based on existing code).

- [ ] **Step 3: Commit**

```bash
git add src/components/esai/EsaiPremiumApp.tsx
git commit -m "feat(dashboard): centered empty state for zero competitions"
```

---

## Task 18: Dashboard fetch from API + loading/error handling

**Files:**
- Modify: `src/components/esai/EsaiPremiumApp.tsx`

- [ ] **Step 1: Replace seed initializer with fetch**

In `EsaiPremiumApp`, replace:

```ts
const [competitions, setCompetitions] = useState(seedCompetitions);
const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(seedCompetitions[0] ?? null);
```

with:

```ts
const [competitions, setCompetitions] = useState<Competition[]>([]);
const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
const [dataLoading, setDataLoading] = useState(true);
```

Below the existing useEffect for theme, add a loader:

```ts
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const list = await fetchCompetitions();
      if (cancelled) return;
      setCompetitions(list);
      setSelectedCompetition(list[0] ?? null);
    } catch (error) {
      const err = error as ApiError | Error;
      const correlationId = (err as ApiError).correlationId ?? "";
      const msg = encodeURIComponent(err.message ?? "Failed to load dashboard");
      const cid = encodeURIComponent(correlationId);
      window.location.href = `/error-page?source=dashboard&message=${msg}&correlationId=${cid}&returnTo=${encodeURIComponent("/")}`;
    } finally {
      if (!cancelled) setDataLoading(false);
    }
  })();
  return () => {
    cancelled = true;
  };
}, []);
```

At the top of the file, add imports:

```ts
import { ApiError, fetchCompetitions, createCompetition, updateCompetition, deleteCompetition, replaceCompetitionAssets } from "@/lib/esai/api";
```

- [ ] **Step 2: Show skeleton while loading**

Inside `EsaiPremiumApp`, wrap the dashboard branch:

```tsx
{activeScreen === "dashboard" && (
  dataLoading ? (
    <section className="screen dashboard-screen"><p style={{ padding: 32, color: "#5f6b7a" }}>Loading…</p></section>
  ) : (
    <DashboardScreen
      competitions={competitions}
      onAdd={() => setShowWizard(true)}
      onSelect={(competition) => {
        setSelectedCompetition(competition);
        setActiveScreen("workbench");
      }}
      onDelete={async (id) => {
        await deleteCompetition(id);
        setCompetitions((items) => items.filter((c) => c.id !== id));
      }}
      onEdit={(competition) => {
        setSelectedCompetition(competition);
        setOverviewOpen(true);
      }}
    />
  )
)}
```

- [ ] **Step 3: Update `DashboardScreen` signature**

Change the `DashboardScreen` function signature to:

```tsx
function DashboardScreen({
  competitions,
  onAdd,
  onSelect,
  onDelete,
  onEdit,
}: {
  competitions: Competition[];
  onAdd: () => void;
  onSelect: (competition: Competition) => void;
  onDelete: (id: string) => Promise<void>;
  onEdit: (competition: Competition) => void;
}) {
```

- [ ] **Step 4: Commit**

```bash
git add src/components/esai/EsaiPremiumApp.tsx
git commit -m "feat(dashboard): fetch competitions from API with loading/error routes"
```

---

## Task 19: Dashboard card — poster image, edit/delete menu

**Files:**
- Modify: `src/components/esai/EsaiPremiumApp.tsx`

- [ ] **Step 1: Update the competition card renderer inside DashboardScreen**

Inside `DashboardScreen`, replace the existing card mapping with:

```tsx
<div className="dashboard-grid">
  {competitions.map((competition) => (
    <article key={competition.id} className="competition-card">
      <div className="competition-card-poster" onClick={() => onSelect(competition)}>
        {competition.posterImageUrl ? (
          <img src={competition.posterImageUrl} alt={competition.title} loading="lazy" />
        ) : (
          <div className="competition-card-poster-placeholder" />
        )}
      </div>
      <div className="competition-card-body">
        <h3 onClick={() => onSelect(competition)}>{competition.title}</h3>
        <small>{competition.institution} - {competition.category}</small>
        <div className="competition-card-actions">
          <button className="btn-ghost" onClick={() => onEdit(competition)}>Edit</button>
          <button
            className="btn-ghost danger"
            onClick={async () => {
              // Delegate to dialog — set pending id and open dialog (state in DashboardScreen)
              setPendingDelete(competition);
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  ))}
</div>
```

Add local state in `DashboardScreen`:

```ts
const [pendingDelete, setPendingDelete] = useState<Competition | null>(null);
```

Add at the bottom of the returned JSX (still inside the `DashboardScreen` return):

```tsx
{pendingDelete ? (
  <DeleteConfirmDialog
    competition={pendingDelete}
    onCancel={() => setPendingDelete(null)}
    onConfirm={async () => {
      await onDelete(pendingDelete.id);
      setPendingDelete(null);
    }}
  />
) : null}
```

- [ ] **Step 2: Add `DeleteConfirmDialog` component in the same file**

Below `DashboardScreen`, add:

```tsx
function DeleteConfirmDialog({
  competition,
  onCancel,
  onConfirm,
}: {
  competition: Competition;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="modal-backdrop">
      <div className="small-modal">
        <div className="modal-header">
          <h2>Delete competition</h2>
          <button className="ghost-icon" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <p>
          <strong>{competition.title}</strong> and all related files (poster, guidebook, outputs, events) will be deleted
          permanently. This cannot be undone.
        </p>
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          I understand this will permanently delete all data for this competition.
        </label>
        {err ? <p style={{ color: "#c52b2b" }}>{err}</p> : null}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!confirmed || busy}
            onClick={async () => {
              try {
                setBusy(true);
                setErr(null);
                await onConfirm();
              } catch (error) {
                setErr(error instanceof Error ? error.message : "Delete failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Minimal card styles**

Append to `src/app/globals.css`:

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 18px;
  padding: 12px 0;
}

.competition-card {
  background: white;
  border: 1px solid #dde3ea;
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}

.competition-card-poster {
  aspect-ratio: 3 / 4;
  background: #eef2f5;
  overflow: hidden;
}

.competition-card-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.competition-card-poster-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #dde3ea, #eef2f5);
}

.competition-card-body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.competition-card-body h3 {
  margin: 0;
  font-size: 15px;
}

.competition-card-body small {
  color: #5f6b7a;
  font-size: 12px;
}

.competition-card-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.btn-ghost.danger {
  color: #c52b2b;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/esai/EsaiPremiumApp.tsx src/app/globals.css
git commit -m "feat(dashboard): posters, edit/delete actions, confirm dialog"
```

---

## Task 20: Wizard — real upload flow with atomic multipart POST

**Files:**
- Modify: `src/components/esai/EsaiPremiumApp.tsx` — `AddCompetitionWizard`

- [ ] **Step 1: Rewrite the wizard**

Replace the existing `AddCompetitionWizard` function with:

```tsx
function AddCompetitionWizard({ onCancel, onFinish }: { onCancel: () => void; onFinish: (competition: Competition) => void }) {
  const [step, setStep] = useState(1);
  const [fields, setFields] = useState({
    title: "",
    category: "Sains & Teknologi",
    institution: "",
    deadline: "2026-09-01",
    registrationLink: "",
  });
  const [poster, setPoster] = useState<File | null>(null);
  const [guidebook, setGuidebook] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; correlationId?: string } | null>(null);

  const posterOk = poster && /^image\/(png|jpeg|webp)$/.test(poster.type) && poster.size <= 5 * 1024 * 1024;
  const guidebookOk = guidebook && /^(application\/pdf|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/markdown|text\/plain)$/.test(guidebook.type) && guidebook.size <= 20 * 1024 * 1024;
  const canFinish = Boolean(fields.title.trim() && posterOk && guidebookOk);

  const finish = async () => {
    if (!canFinish || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("title", fields.title);
      formData.set("category", fields.category);
      formData.set("institution", fields.institution);
      formData.set("deadline", fields.deadline);
      formData.set("registrationLink", fields.registrationLink);
      formData.set("poster", poster!);
      formData.set("guidebook", guidebook!);

      const competition = await createCompetition(formData);
      onFinish(competition);
    } catch (err) {
      const ae = err as ApiError;
      setError({ message: ae.message ?? "Failed to create competition.", correlationId: ae.correlationId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="wizard">
        <div className="modal-header">
          <h2>Setup Kompetisi Baru</h2>
          <button className="ghost-icon" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <div className="step-track">
          {[1, 2, 3].map((item) => (
            <span key={item} className={item <= step ? "active" : ""} />
          ))}
        </div>

        {step === 1 ? (
          <div className="form-grid">
            <label>
              Nama Kompetisi
              <input value={fields.title} onChange={(e) => setFields({ ...fields, title: e.target.value })} placeholder="Competition name" />
            </label>
            <label>
              Kategori
              <select value={fields.category} onChange={(e) => setFields({ ...fields, category: e.target.value })}>
                <option>Sains & Teknologi</option>
                <option>Sosial & Humaniora</option>
                <option>Inovasi Digital</option>
                <option>KTI</option>
                <option>Business Plan</option>
                <option>Essay</option>
              </select>
            </label>
            <label>
              Institusi
              <input value={fields.institution} onChange={(e) => setFields({ ...fields, institution: e.target.value })} placeholder="Institution" />
            </label>
            <label>
              Deadline
              <input type="date" value={fields.deadline} onChange={(e) => setFields({ ...fields, deadline: e.target.value })} />
            </label>
            <label className="wide">
              Link pendaftaran
              <input value={fields.registrationLink} onChange={(e) => setFields({ ...fields, registrationLink: e.target.value })} placeholder="https://..." />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="upload-zone">
              <UploadCloud size={30} />
              <strong>Poster</strong>
              <span>PNG, JPG, or WebP. Max 5 MB.</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setPoster(e.target.files?.[0] ?? null)} />
              {poster ? <small style={{ color: posterOk ? "#147d64" : "#c52b2b" }}>{poster.name} ({Math.round(poster.size / 1024)} KB)</small> : null}
            </div>
            <div className="upload-zone">
              <UploadCloud size={30} />
              <strong>Guidebook</strong>
              <span>PDF, DOCX, MD, or TXT. Max 20 MB.</span>
              <input type="file" accept=".pdf,.docx,.md,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain" onChange={(e) => setGuidebook(e.target.files?.[0] ?? null)} />
              {guidebook ? <small style={{ color: guidebookOk ? "#147d64" : "#c52b2b" }}>{guidebook.name} ({Math.round(guidebook.size / 1024)} KB)</small> : null}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="success-pane">
            <Check size={34} />
            <h3>Semua Siap</h3>
            <p>AI akan memetakan pipeline pengerjaan berdasarkan guidebook dan metadata Anda.</p>
            {error ? (
              <div style={{ marginTop: 16, padding: 12, border: "1px solid #f3b7b7", background: "#fdecec", borderRadius: 8 }}>
                <strong>Gagal:</strong> {error.message}
                {error.correlationId ? <div><small>Correlation ID: <code>{error.correlationId}</code></small></div> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={() => (step > 1 ? setStep(step - 1) : onCancel())} disabled={submitting}>
            {step === 1 ? "Batal" : "Kembali"}
          </button>
          <button
            className="btn-primary"
            onClick={() => (step < 3 ? setStep(step + 1) : finish())}
            disabled={(step === 2 && !(posterOk && guidebookOk)) || (step === 3 && !canFinish) || submitting}
          >
            {step === 3 ? (submitting ? "Mengunggah…" : "Mulai Sekarang") : "Lanjut"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/esai/EsaiPremiumApp.tsx
git commit -m "feat(wizard): real multipart upload with poster/guidebook validation"
```

---

## Task 21: Competition overview — editable fields + asset replace

**Files:**
- Modify: `src/components/esai/EsaiPremiumApp.tsx` — `CompetitionOverviewModal`

- [ ] **Step 1: Update the modal signature and body**

Find `function CompetitionOverviewModal(`. Replace the function with:

```tsx
function CompetitionOverviewModal({
  competition,
  onAdd,
  onClose,
  onSelect,
  onUpdated,
  onDeleted,
}: {
  competition: Competition;
  onAdd: () => void;
  onClose: () => void;
  onSelect: (competition: Competition) => void;
  onUpdated: (competition: Competition) => void;
  onDeleted: (id: string) => void;
}) {
  const [draft, setDraft] = useState({
    title: competition.title,
    category: competition.category,
    institution: competition.institution,
    deadline: competition.deadline,
    registrationLink: competition.registrationLink ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCompetition(competition.id, {
        title: draft.title,
        category: draft.category,
        institution: draft.institution,
        deadline: draft.deadline,
        registrationLink: draft.registrationLink,
      });
      onUpdated(updated);
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.message ?? "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  const replaceFile = async (role: "poster" | "guidebook", file: File) => {
    const form = new FormData();
    form.set(role, file);
    try {
      const updated = await replaceCompetitionAssets(competition.id, form);
      onUpdated(updated);
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.message ?? "Replace failed.");
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="overview-modal">
        <div className="modal-header">
          <h2>Competition Overview</h2>
          <button className="ghost-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="form-grid">
          <label>
            Title
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label>
            Category
            <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              <option>Sains & Teknologi</option>
              <option>Sosial & Humaniora</option>
              <option>Inovasi Digital</option>
              <option>KTI</option>
              <option>Business Plan</option>
              <option>Essay</option>
            </select>
          </label>
          <label>
            Institution
            <input value={draft.institution} onChange={(e) => setDraft({ ...draft, institution: e.target.value })} />
          </label>
          <label>
            Deadline
            <input type="date" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} />
          </label>
          <label className="wide">
            Registration link
            <input value={draft.registrationLink} onChange={(e) => setDraft({ ...draft, registrationLink: e.target.value })} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <label className="btn-ghost">
            Replace poster
            <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceFile("poster", f); }} />
          </label>
          <label className="btn-ghost">
            Replace guidebook
            <input type="file" accept=".pdf,.docx,.md,.txt" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceFile("guidebook", f); }} />
          </label>
        </div>

        {error ? <p style={{ color: "#c52b2b" }}>{error}</p> : null}

        <div className="modal-actions">
          <button className="btn-ghost danger" onClick={() => setPendingDelete(true)}>Delete</button>
          <span style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {pendingDelete ? (
          <DeleteConfirmDialog
            competition={competition}
            onCancel={() => setPendingDelete(false)}
            onConfirm={async () => {
              await deleteCompetition(competition.id);
              setPendingDelete(false);
              onDeleted(competition.id);
              onClose();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the callbacks in `EsaiPremiumApp`**

Find the `<CompetitionOverviewModal ... />` usage. Update its props to include:

```tsx
onUpdated={(updated) => {
  setCompetitions((items) => items.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
  setSelectedCompetition(updated);
}}
onDeleted={(id) => {
  setCompetitions((items) => items.filter((c) => c.id !== id));
  setSelectedCompetition(null);
  setOverviewOpen(false);
  setActiveScreen("dashboard");
}}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/esai/EsaiPremiumApp.tsx
git commit -m "feat(overview): editable fields + asset replace + delete"
```

---

## Task 22: Wire wizard finish to list state

**Files:**
- Modify: `src/components/esai/EsaiPremiumApp.tsx` — `AddCompetitionWizard` caller

- [ ] **Step 1: Update the onFinish handler**

Find the existing `<AddCompetitionWizard ... />` rendering. Confirm the `onFinish` callback pushes the returned competition:

```tsx
onFinish={(competition) => {
  setCompetitions((items) => [competition, ...items]);
  setSelectedCompetition(competition);
  setShowWizard(false);
  setActiveScreen("workbench");
}}
```

(No change if already correct — Task 20 returns the API competition with `posterImageUrl`.)

- [ ] **Step 2: Commit if something changed, else skip**

```bash
git status
```

---

## Task 23: Manual smoke test checklist

**Files:** none (testing only)

- [ ] **Step 1: Ensure env is set**

Confirm `.env.local` has:

```
NEXT_PUBLIC_SUPABASE_URL=<your project url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your publishable/anon key>
SUPABASE_SERVICE_ROLE_KEY=<your service role key>
NEXT_PUBLIC_DISABLE_AUTH=false
```

- [ ] **Step 2: Start the dev server**

In a separate terminal:

```bash
npm run dev
```

- [ ] **Step 3: Walk the smoke test**

See `## Smoke Test Checklist` at the bottom of this plan for the user-facing checklist.

- [ ] **Step 4: Fix any issues surfaced**

Iterate until the checklist passes. Commit any fixes with descriptive messages.

---

## Task 24: Final cleanup + verification

**Files:** entire repo

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no blocking errors.

- [ ] **Step 3: Unit tests**

Run: `npm run test`
Expected: all tests pass.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit any fixups**

```bash
git status
# If anything changed: git commit -m "chore: pre-merge fixups"
```

- [ ] **Step 6: Push the branch**

```bash
git push -u origin phase-a-dashboard-auth-competitions
```

---

## Smoke Test Checklist

Run these in order. Each step either passes or surfaces a specific bug.

### Auth and route gating

1. Visit `http://localhost:3000/` in a fresh private window. Expect redirect to `/login`.
2. On `/login`, click **Need an account? Sign up**. Register with a fresh email (e.g., `dev+1@yourdomain.test`) and a password of 8+ characters. Expect redirect to `/`.
3. Click **Sign out** in the sidebar. Expect redirect to `/login`.
4. Sign in again with the same email + password. Expect redirect to `/`.
5. While signed in, visit `/login` directly. Expect redirect to `/`.

### Empty state

6. On the dashboard, expect the centered empty state with a big plus icon, "No competitions yet" text, and an **Add Competition** button. Sidebar and header remain visible.

### Create competition (happy path)

7. Click **Add Competition**. Step 1 should show the metadata form.
8. Fill **Nama Kompetisi** (e.g., "LKTI Nasional 2026"), pick a category, enter an institution, leave deadline default, optionally add a registration URL. Click **Lanjut**.
9. Step 2: upload a PNG/JPG (< 5 MB) as poster and a PDF guidebook (< 20 MB). Both file labels should turn green. Click **Lanjut**.
10. Step 3: click **Mulai Sekarang**. Button shows "Mengunggah…". On success, wizard closes and the app routes to the workbench.
11. Navigate back to dashboard. Your new competition card appears with the poster image.

### Create competition (error paths)

12. Open the wizard again. Try to advance from Step 2 without selecting files. Expect the **Lanjut** button to be disabled.
13. Upload a poster > 5 MB. The file label turns red. The button stays disabled.
14. Upload a .zip as guidebook. The label turns red.
15. Interrupt the server (e.g., break `SUPABASE_SERVICE_ROLE_KEY` temporarily, restart). Submit the wizard on step 3. The wizard stays open and shows an inline error with a correlation id.
16. Restore the env var and retry — should succeed.

### Edit competition

17. On the dashboard, click **Edit** on a card. The Competition Overview opens with editable fields.
18. Change the title, click **Save**. Modal shows "Saving…" then stays open. Close it; the card title updates.
19. Click **Replace poster** and pick a different image. Refresh the page. The poster image reflects the replacement.
20. Click **Replace guidebook** with a .md file. No visible change on the card, but in the DB the `competition_files` row should have the new `storage_path` and `content_text`.

### Delete competition

21. From the card menu, click **Delete**. The confirm dialog appears.
22. Try clicking **Delete** without the checkbox — button is disabled.
23. Check the box, click **Delete**. Dialog closes; card disappears from the grid.
24. Reload the page. The competition stays gone.

### Cross-user isolation

25. Sign out and register a second account with a different email. Expect empty dashboard (no leaked data from account 1).
26. Sign out, sign back in as account 1. Expect your competitions to still be there.

### Error page

27. Manually visit `http://localhost:3000/error-page?source=dashboard&message=Forced&correlationId=abc-123&returnTo=%2F`. Confirm the page shows Source, Message, Correlation ID, and Retry / Go-to-dashboard buttons.
28. Click **Retry** — navigates to `/` (the `returnTo`).

### Storage / DB audit (optional, for confidence)

29. In Supabase Studio:
    - `competitions` has your row with `poster_file_id` populated.
    - `competition_files` has two rows: `file_role=poster` (mime `image/webp`) and `file_role=guidebook` with `content_text` non-null when a textual guidebook was uploaded.
    - Storage bucket `competition-files` has `{userId}/{competitionId}/poster.webp` and `guidebook.{ext}`.

If all 29 steps pass, Phase A is complete.

---

## Self-Review Notes

- Spec coverage: tasks map to sections 3 (auth), 4 (types), 5 (API), 6 (frontend), 7 (server utilities), 8 (validation), 9 (deps), 10 (testing), 11 (order), 13 (success criteria).
- No placeholders: every code block is complete and runnable.
- Type consistency: `Competition` type updated in Task 2 is used consistently across Tasks 12, 15, 18–22.
- One known caveat: pdf-parse's default export path sometimes surfaces `ENOENT` in dev if the library tries to reference its example file; the guarded dynamic import in Task 10 avoids that, but if it appears, switch to `import pdfParse from "pdf-parse/lib/pdf-parse.js"` inside `file-extraction.ts`.

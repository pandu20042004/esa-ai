# Main Agent — Real Run Execution

**Date:** 2026-05-14
**Status:** Design (ready for implementation planning)
**Scope:** First real agent run end-to-end. The Main Agent ("Onboarding") runs against a real LLM per competition, streams tokens to the browser, writes a versioned `01_onboarding_map.md` to `competition_files`, and enforces an approval gate that unlocks downstream stages.

This spec ships **one** agent runtime (Main Agent only). The other nine agents in the pipeline guide are intentionally deferred. Once this pattern works, it duplicates.

---

## 1. Goals

1. User clicks **Run Main Agent** on a competition's Onboarding stage → a real LLM executes against the guidebook → produces `01_onboarding_map.md`.
2. Tokens stream live into the stage chat thread. Refreshing the page never loses an in-flight run.
3. Runs create versioned outputs — old maps live on in `output_versions`, the current `competition_files` row always points at the latest.
4. User approves the map → Ideation stage unlocks. Re-running Main Agent after approval requires a confirmation that lists downstream stages going stale.
5. Agent prompt + Needs/Produces live in `agent_templates`, sync from `skills/main_agent/`. On first run per user+compartment, a `user_agents` row and initial `agent_skill_versions` row are auto-created from the template. Users never edit these here; full editing ships in the Devs→Agents spec.
6. Model selection is a per-run choice from the actual installed CLI providers (real model list, not hardcoded) or env-key API providers. BYOK screen deferred.
7. All remaining mock/seed data deleted. Every unbacked screen renders an empty state with CTA.

---

## 2. Out of Scope

- Ideation, Research, Writing, Flowchart, Prototype, UI Design, Supervisor, Parts List, Style Profile Builder runtimes.
- Devs→Agents editor UI (covered by `2026-05-08-devs-agents-design.md`). This spec only needs the template sync + auto-publish on first run to exist.
- Pipeline editor (drag/drop edges). Pipeline seeded read-only from `pipeline_templates`.
- Calendar CRUD, Validity real backend, Final Outputs real backend — each gets an empty state only.
- BYOK CRUD screen + per-user key encryption in active use. AES-256-GCM scaffolding lands but nothing writes keys yet.
- Rate limits, token budgets, cost estimation, circuit breaker. Deferred to deploy hardening.
- Notification inbox UI.

---

## 3. Architecture

```
Browser
  │  HTTP: POST /api/agent-runs  (kicks run)
  │  Realtime: subscribe to agent_run_events for this run_id
  ▼
Next.js API route
  │  - authorizes user
  │  - validates stage/pipeline prerequisites
  │  - inserts agent_runs row (status='queued')
  │  - inserts initial agent_messages "user" row (the trigger)
  │  - returns { runId }
  ▼
Supabase (postgres + realtime)
  │  agent_runs table
  │  agent_run_events table (new — streaming buffer)
  │
  ▲
  │  Node worker loop (local `npm run worker`)
  │  - polls agent_runs where status='queued'
  │  - claims via `update ... returning` (optimistic)
  │  - resolves skill_version + input files
  │  - spawns CLI or calls SDK
  │  - writes tokens to agent_run_events
  │  - parses tool calls → writes competition_files + output_versions
  │  - updates agent_runs.status='completed'|'failed'
```

Two processes in development:
- `npm run dev` — Next.js app.
- `npm run worker` — dedicated executor loop. Can be stopped/restarted; pending runs resume.

Production later: the same worker deploys as a long-running process on Fly/Railway/ECS, or the polling loop is swapped for a Supabase-webhook-triggered edge function. Client contract (Realtime on `agent_run_events`) never changes.

---

## 4. Data Model Changes

### 4.1 New table: `agent_run_events`

Streaming buffer. One row per token chunk, tool call, status change, or file-write record.

```sql
create table public.agent_run_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  sequence int not null,              -- monotonic per run
  event_type text not null,           -- 'status' | 'token' | 'tool_call' | 'tool_result' | 'message' | 'error'
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (run_id, sequence)
);

create index agent_run_events_run_idx on public.agent_run_events (run_id, sequence);

alter table public.agent_run_events enable row level security;
create policy "agent run events own rows"
  on public.agent_run_events for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

Client subscribes via Supabase Realtime (`channel('agent_run_events').on('postgres_changes', { event:'INSERT', filter:'run_id=eq.<id>' })`) and renders each event.

### 4.2 `competition_files.status` additions

Values: `draft | needs_review | approved | rejected | stale`. `stale` is new — applied when an upstream stage is re-run after approval.

No DDL change needed (already `text`). Add an index to speed the "find stale downstream files" query:
```sql
create index if not exists competition_files_comp_status_idx
  on public.competition_files (competition_id, status);
```

### 4.3 Compartments bootstrap

Every user needs at least one compartment so `user_agents` rows can live somewhere. Add a post-signup RPC or ensure `createCompetitionAtomic` ensures a default compartment exists for the user. See §8.2.

### 4.4 No structural changes required elsewhere

`agent_runs`, `agent_messages`, `output_versions`, `user_agents`, `agent_skill_versions`, `pipeline_nodes`, `pipeline_edges`, `notifications`, `byok_keys` already cover what we need.

---

## 5. Runtime Contract: What Happens on a Run

### 5.1 Preconditions checked by the API route

Before inserting `agent_runs`:
1. `competition.user_id = auth.uid()` (defense on top of RLS).
2. Guidebook file exists for this competition (role='guidebook', status in ('approved','draft')).
3. The target stage is either Onboarding (unlocked always) or all upstream outputs are `status='approved'` with no `stale` among them.
4. A `user_agents` row exists for (user, compartment, template_id='main_agent'). If not, create it from the active `agent_templates` row and seed one `agent_skill_versions` (version 1, `is_active=true`) from `default_skill_content` / `default_input_contracts` / `default_output_contracts`. This is the minimal Devs auto-provision — not a substitute for the Devs spec.
5. A `competition_pipelines` row exists for this competition. If not, create from the compartment's default `pipeline_templates` entry (seed pipeline defined in §8.3).
6. A selected model (from per-request body) exists in the union of detected CLI models + env-key providers. 400 if unknown.

If any check fails, respond with `errorResponse` and do not touch DB.

### 5.2 Insert `agent_runs`

Fields:
- `competition_id`, `user_id`, `stage_id='onboarding'`, `agent_id=user_agents.id` (new column? — no, `agent_id` already exists but typed to old `agents` table; repurpose: point it at `user_agents.id`. Existing FK is `on delete set null`, so points can be stale without cascading. We add a nullable FK to `user_agents` and leave `agents` alone).

Actually — **do not reuse `agent_runs.agent_id`** since it references the old `agents` table. Instead, use `pipeline_node_id` + `skill_version_id` which are already present. Queries join through those. Leave the legacy `agent_id` column untouched and nullable.

- `pipeline_id`, `pipeline_node_id` (resolved from `competition_pipelines`)
- `skill_version_id` = active skill version on the user_agents row
- `model_provider`, `model_id`, `reasoning_effort` from request
- `input_file_ids` = [guidebook file id] (style profile omitted in ship-one per interview)
- `status='queued'`, `queued_at=now()`
- `context_snapshot` = `{ guidebookStoragePath, guidebookContentText }` so the worker doesn't race with user deletes

Return `{ runId }` to browser.

### 5.3 Also insert one `agent_messages` row

Serves as the user-visible "trigger" in the chat thread:

```sql
insert into agent_messages (
  competition_id, user_id, thread_type, stage_id, role, content, metadata
) values (
  $competitionId, $userId, 'stage', 'onboarding', 'user',
  $triggerText,   -- either "[First run]" on click-to-start OR the user's typed message
  '{ "runId": "...", "trigger": "manual|chat" }'
);
```

### 5.4 Worker picks up the run

A single Node process (`apps/worker` or `scripts/worker.ts`) runs this loop every 2 s:

```ts
const { data: claimed } = await supabase
  .from("agent_runs")
  .update({ status: "running", started_at: new Date().toISOString() })
  .eq("status", "queued")
  .lt("queued_at", new Date(Date.now() - 1000).toISOString())
  .limit(1)
  .select("*")
  .single();
```

If `claimed`, worker:
1. Emits `status` event: `{ phase: 'started' }`.
2. Loads skill version + guidebook text from `context_snapshot`.
3. Builds provider request. Tool definition injected into prompt (see §6).
4. Streams response:
   - CLI: spawn command, pipe stdout line-by-line, for each chunk emit `token` event.
   - SDK: `for await (const chunk of stream) { emit('token', { text: chunk.delta }) }`.
5. On every streamed chunk: append an `agent_run_events` row with monotonic `sequence`.
6. When response completes, parse full text for tool calls (see §6). For each `write_file` tool call: create `competition_files` row (status='draft'), push `tool_result` event. If the file already existed at this (competition, artifact_key) key, snapshot current content to `output_versions` first, then overwrite with new content and storage blob, bump `competition_files.updated_at`.
7. Append one assistant `agent_messages` row with final content (for chat history / re-render after refresh).
8. Update `agent_runs.status='completed'`, `completed_at=now()`, `output_file_id` pointing at the primary produced file.
9. Emit final `status` event: `{ phase: 'completed' }`.

On failure: emit `error` event with message + stack-safe details, set `agent_runs.status='failed'`, `error=...`. Do NOT touch the prior approved file.

### 5.5 Crash recovery

On worker start:
- Find runs stuck in `status='running'` with `started_at < now() - 5m` → mark `failed` with `error='worker crashed'`. Prevents ghost runs blocking new starts.
- Resume: any `status='queued'` run is eligible regardless of age.

---

## 6. Tool-Call Contract (Option A from interview)

The agent sees a structured system prompt with one tool:

```
You can call tools by emitting a fenced JSON block with fence tag `tool`:

```tool
{
  "tool": "write_file",
  "params": {
    "artifact_key": "onboarding_map",
    "file_name": "01_onboarding_map.md",
    "file_role": "stage_output",
    "artifact_role": "onboarding_map",
    "content": "# Onboarding Map\n..."
  }
}
```

Tools available:
- write_file: save a markdown or text file as the stage output.

Anything outside a fenced ```tool block is treated as assistant chat shown to the user.
```

Parser (server side):
1. Scan full final response for all ```tool\n{...}\n``` blocks.
2. For each: `JSON.parse`, validate with Zod against a schema.
3. Remove the fenced blocks from the text.
4. Remaining text → assistant chat message content.
5. Each valid tool → apply side effect (file upsert).

Zod schema for ship-one:
```ts
const writeFileParams = z.object({
  artifact_key: z.string().regex(/^[a-z0-9_]+$/).max(80),
  file_name: z.string().min(1).max(200),
  file_role: z.enum([
    "stage_output","guidebook","style_profile","research_output","final_output"
    // subset; full list stays in types/esai.ts
  ]),
  artifact_role: z.string().regex(/^[a-z0-9_]+$/).max(80),
  content: z.string().min(1).max(400_000),
});

const toolCall = z.object({
  tool: z.literal("write_file"),
  params: writeFileParams,
});
```

Invalid tool call → append a system event (`event_type='error'`, payload `{ reason:'invalid_tool_call', raw:'...' }`) and skip it. Do NOT fail the run.

Future tools (Ideation/Research): `ask_choice`, `read_file`, `web_search`. Schema extends.

---

## 7. Frontend Changes

### 7.1 Workbench stage detail

Match the screenshots you shared. Each stage shows:

- **Input gate card** — lists upstream artifacts, marks any missing/stale, disables Run if gate closed
- **Output file card** — current produced file (if any), pill `Drafting|Needs review|Approved|Stale`, click to open reader panel
- **Stage handoff card** — shown only when output exists in `draft` or `needs_review`. Primary button: **Approve & unlock next stage**. Secondary: **Review with AI** (deferred, shows "Coming soon" toast for ship-one).
- **Agent thread** — scrollable chat of `agent_messages` for this (competition, stage). Streaming run appends tokens to the current assistant bubble from `agent_run_events`.
- **Composer at bottom** — textarea + model picker + reasoning picker + **Run** button. On first run for a stage with no existing messages, the textarea has placeholder "Optional: add instructions for this run, or leave blank". The button is always enabled when a model is selected.

### 7.2 Model picker (inline in composer)

Dropdown populated from `GET /api/models` which returns the union:
- Detected CLI models (after §9 fix)
- Env-key API models (existing)
- Later: user's `byok_keys` entries — not shipped now

If the list is empty, dropdown is disabled and shows "No models configured. Set up Devs → Models or install a CLI."

### 7.3 Live stream rendering

When user clicks Run:
1. Optimistic user bubble appears (mirror of the `agent_messages` row API will create).
2. Assistant bubble appears immediately with spinner.
3. Browser opens Supabase Realtime channel on `agent_run_events` filtered to `run_id`.
4. `token` events append to the bubble's text.
5. `tool_call` / `tool_result` events render as compact inline status rows ("Writing 01_onboarding_map.md…" → "Saved 01_onboarding_map.md (2,341 chars)").
6. `status: completed` event: channel closes, bubble becomes final, Output File card updates.
7. `error` event: bubble flips to red state with message + correlation id + Retry button.

Page refresh mid-run: on mount, the component queries `agent_run_events where run_id=?` ordered by sequence, replays them, then opens the Realtime subscription from `sequence > lastSeen`. No lost tokens.

### 7.4 Approve & unlock next stage

Button behavior:
1. POST `/api/competition-files/[fileId]/approve`.
2. Server: set status='approved', `approved_at=now()`, `approved_by=user_id`. Walk `pipeline_edges` forward from the producing node: any downstream `competition_files` with `status='stale'` tied to a node that now has all approved inputs → leave alone (user will re-run). No automatic chain-run.
3. Client: refetch stage state; the next locked stage becomes unlocked; show toast "Ideation unlocked".

### 7.5 Re-run confirmation modal

When the user clicks Run on a stage whose output is already `approved` AND any downstream stages are in a non-draft state:

```
┌─────────────────────────────────────────────┐
│  Re-run Main Agent?                         │
├─────────────────────────────────────────────┤
│  Re-running will replace the current        │
│  01_onboarding_map.md. Approved downstream  │
│  outputs will be marked stale and need      │
│  re-approval or re-run:                     │
│                                             │
│    • Ideation (02_ideation_options.md)      │
│    • Research (03_research_brief.md)        │
│                                             │
│  [ Cancel ]  [ Re-run and mark downstream   │
│              stale ]                        │
└─────────────────────────────────────────────┘
```

On confirm:
1. Server walks the edge graph forward from this node.
2. Every direct consumer's latest `competition_files` row flips to `status='stale'`.
3. Cascade NOT recursive — only direct consumers. Each downstream stage sets its own outputs to stale when it itself re-runs.
4. New `agent_runs` row is inserted for the current stage.

### 7.6 Empty states on sibling screens

Scorched-earth: delete `src/lib/esai/seed.ts`, remove all imports of `seedXxx`. Each screen renders its own empty state:

- **Calendar**: centered CTA "No events yet — events auto-sync from approved stage outputs and competition deadlines."
- **Validity-Checker**: "Nothing to check yet — run a writing stage first."
- **Final Outputs**: "No final outputs yet — approve your Supervisor review to move outputs here."
- **Workbench (when no competition)**: already handled in Phase A via overview.
- **DevsScreen**: already empty; leave as is for now (Devs spec is separate).

Repository fallback to `seedXxx` removed — `listCalendarEvents`, `listOutputVersions`, `listValidityChecks`, `listFiles`, `listAgents` return `[]` when no supabase. `seedCompetitions` was already empty.

### 7.7 Chat versus file view

Tool-call files are NOT inlined in the chat. Chat shows: prose + compact "Saved 01_onboarding_map.md" status lines. The actual file lives in:
- Output File card in the stage detail (primary view)
- Competition Overview → Files section → Output of AI Agent

Clicking either opens the existing file reader modal (already built in Phase A).

---

## 8. Template + Compartment + Pipeline Seed

### 8.1 Template sync

`src/lib/server/agent-template-sync.ts` already reads `skills/main_agent/SKILL.md` and upserts `agent_templates`. Confirm the Main Agent template has realistic `default_input_contracts` (guidebook) and `default_output_contracts` (onboarding_map) matching what this spec needs.

If the current sync lacks them, update the SKILL frontmatter (or adjust the sync parser) so `agent_templates.default_output_contracts` includes:
```json
[{ "key": "onboarding_map", "label": "Onboarding Map", "role": "onboarding_map", "defaultFilename": "01_onboarding_map.md" }]
```
and `default_input_contracts`:
```json
[{ "key": "guidebook", "label": "Guidebook", "acceptedRoles": ["guidebook"], "required": true, "includeMode": "full" }]
```

This sync runs on app boot (server start-up) and on `/api/agent-templates/sync-local` admin POST. Both paths are in scope to verify.

### 8.2 Default compartment per user

Every user needs a default "Essay" compartment. Options:
- Supabase auth hook on sign-up (requires Supabase Edge Function hook)
- Lazy: first time any API route needs a compartment, create defaults

Ship lazy. Add `ensureDefaultCompartments(userId)` that inserts Essay/KTI/Business Plan/PKM if missing. Called from the run preflight in §5.1.4 and from `createCompetitionAtomic` so new competitions auto-pick Essay by default.

### 8.3 Default pipeline template

Seed `pipeline_templates` with one row, `template_key='essay_default'`, compartment_key='essay'. Its `nodes` jsonb describes the 8 stages (onboarding → ideation → research → writing → flowchart → prototype → ui → supervisor) with their template_keys. `edges` jsonb describes the sequential dependencies.

Only Onboarding's node references a real runnable template (main_agent). The others are placeholders — their `user_agents` get created on demand and rejected as "not implemented" if anyone tries to run them in ship-one. The UI marks them locked-beyond-not-implemented.

For this spec: write the pipeline template seed SQL, build a helper `ensureCompetitionPipeline(competitionId)` that creates `competition_pipelines` + `pipeline_nodes` + `pipeline_edges` for a new competition on first workbench open. Idempotent.

---

## 9. CLI Model Detection Fix

Problem: `src/lib/server/cli-providers.ts` hardcodes `defaultModels` per provider. User-installed CLI may have newer models; dropdown shows stale list.

Fix per provider:

| Provider   | Detection command                       | Parse                                         |
|------------|-----------------------------------------|-----------------------------------------------|
| claude     | read `~/.claude.json` (JSON, `models` field), fallback `claude --help` | JSON or regex on `-m,--model` help           |
| codex      | `codex models list` if the subcommand exists; fallback to env `CODEX_DEFAULT_MODEL` + known list | line-split |
| gemini     | `gemini models list`                    | line-split                                    |
| opencode   | stays hardcoded (upstream doesn't expose) |                                             |
| devin, hermes | stay hardcoded                       |                                               |

New function `detectCliModels(command: string): CliModel[]` keyed by provider id. Called from `detectCliProviders` only when the command is installed. Falls back to the hardcoded `defaultModels` if detection throws or returns empty. 10 s timeout each. Cached in the same `CACHE_TTL_MS` window as detection.

Acceptance: after fix, running `claude` locally with a `settings.json` that configures Opus + Sonnet + Haiku causes all three (ids taken from the file) to appear in `/api/models`. Test with a stub `~/.claude.json` fixture in Vitest.

---

## 10. AES-256-GCM Scaffolding for BYOK

Ship but do not wire yet. File: `src/lib/server/crypto.ts`:

```ts
export function encryptSecret(plaintext: string): string;  // "v1:<iv-b64>:<ciphertext-b64>:<tag-b64>"
export function decryptSecret(token: string): string;
```

Uses Node `crypto.createCipheriv("aes-256-gcm", key, iv)` with `ENCRYPTION_KEY` env (32 bytes, base64 in env). Startup guard: if `ENCRYPTION_KEY` unset or wrong length, functions throw with an explicit "set ENCRYPTION_KEY" message. Not called anywhere in this spec — the BYOK spec will consume it.

Add tests: round-trip, tamper detection, wrong key fails decrypt.

---

## 11. API Endpoints

All require auth via `getRequestUser`.

### 11.1 `POST /api/agent-runs`

Request body:
```ts
{
  competitionId: string;
  stageId: "onboarding";   // enumerated to the one we support
  modelProvider: string;
  modelId: string;
  reasoningEffort?: "low"|"medium"|"high"|"xhigh";
  userMessage?: string;    // blank on click-to-start
}
```

Behavior: §5.1 → §5.3. Returns `{ runId, messageId }`. On preflight failure returns structured `errorResponse` with code from the preflight check that failed.

### 11.2 `GET /api/agent-runs/[id]`

Returns the run + the ordered list of `agent_run_events` for replay-on-refresh. Used by the workbench component on mount.

### 11.3 `POST /api/competition-files/[id]/approve`

Sets file to `status='approved'`. If the approving user doesn't own the competition, 403. Returns updated competition pipeline state so the client can unlock the next stage.

### 11.4 `POST /api/agent-runs/[id]/cancel` (defer)

Not in ship-one. Placeholder so we know where it will go.

### 11.5 `GET /api/models` (change)

Returns: CLI-detected models, API-env models, and eventually BYOK models (not yet). Shape unchanged; only the CLI source changes under the hood.

---

## 12. Worker (`scripts/worker.ts`)

New file. Runs with `npm run worker`:

```json
"scripts": {
  "dev": "next dev",
  "worker": "tsx scripts/worker.ts",
  ...
}
```

Add `tsx` as a dev dependency. Worker imports from `src/lib/server/*` directly (not HTTP). Uses the admin Supabase client; bypasses RLS to act on any user's run, but always respects `user_id` in writes.

Single-tenant assumption: one worker per process. If you run two workers, the `update...returning` claim pattern in §5.4 keeps them from double-claiming a run.

Graceful shutdown: on SIGINT/SIGTERM, finish the current run, then exit. Orphaned in-flight runs on hard kill are recovered by §5.5.

Logging: one-line-per-event structured log to stdout. `pino` is optional; `console.log(JSON.stringify(...))` is fine for ship-one.

---

## 13. Deferred Hardening

Document these in the plan so the codebase has clear seams:

- **Circuit breaker**: field `consecutive_failure_count` on `user_agents` (or a derived query). Middleware in `/api/agent-runs` increments on fail, zeros on success, blocks when ≥3 with 10 min cooldown. Flagged by `ENABLE_RUN_CIRCUIT_BREAKER=true`.
- **BYOK-default production policy**: when deployed, require `byok_keys` row for the chosen provider; CLI gated behind `ENABLE_LOCAL_CLI_PROVIDERS=true`.
- **Token budget**: `token_usage` table, usage shown in profile, hard cap per plan.
- **max_tokens cap**: skipped per user request.

None shipped in this spec. Code has `// TODO: hardening` markers at the relevant seams so the follow-up spec can wire them without rework.

---

## 14. Success Criteria

- User creates a competition with a guidebook → opens workbench → Onboarding stage is unlocked, other stages locked.
- User selects a model from the inline picker → clicks Run.
- Within a few seconds, tokens stream into the chat bubble live. Refresh mid-stream continues from where it left off.
- When the run completes: an `01_onboarding_map.md` file exists in `competition_files` with `status='draft'`, visible in the Output File card and in the competition's Files section.
- User clicks **Approve & unlock next stage** → status flips to approved, Ideation card unlocks.
- User re-runs Main Agent → modal lists Ideation as going stale → on confirm, new run replaces the map, Ideation's output (if it exists) is marked stale.
- `/api/models` lists the actual models installed via `claude` CLI, not a hardcoded set.
- Calendar, Validity, Final Outputs screens each render empty-state CTAs; `seed.ts` is deleted and no code imports it.
- `scripts/worker.ts` runs via `npm run worker`. Killing and restarting it recovers in-flight runs.
- `src/lib/server/crypto.ts` has passing round-trip and tamper-detection tests. Not used in any runtime path yet.

---

## 15. Implementation Order

1. DB migration: `agent_run_events` table + index on `competition_files(competition_id, status)`.
2. `scripts/worker.ts` skeleton + `npm run worker`. Claim-loop + status transitions only (no LLM call yet).
3. `src/lib/server/run-events.ts`: helpers to emit events atomically.
4. `src/lib/server/run-execution.ts`: provider-neutral run executor. CLI branch first (spawn process, pipe stdout, parse tool blocks). Deterministic integration test with a fake CLI script.
5. Tool-call parser (`src/lib/server/tool-calls.ts`) + Zod schema + unit tests.
6. `ensureDefaultCompartments`, `ensureMainAgentUserAgent`, `ensureCompetitionPipeline` helpers + unit tests.
7. Pipeline template seed SQL.
8. `/api/agent-runs` POST + GET endpoints.
9. `/api/competition-files/[id]/approve`.
10. CLI model detection fix (§9) + tests.
11. `src/lib/server/crypto.ts` + tests (AES-256-GCM scaffolding).
12. Frontend: refactor workbench stage detail per §7. Realtime subscription. Model picker. Re-run modal. Approval button.
13. Delete `seed.ts`, scrub component-body mock data, implement empty-state CTAs on Calendar, Validity, Final Outputs.
14. Manual smoke: full flow with claude CLI, then with codex CLI.
15. Document `npm run worker` in README.

---

## 16. Open Questions

None. Scope locked through interview.

# Devs Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Supabase-backed Devs -> Agents workspace for compartments, custom agents, draft editing, publishing, versions, plain-language Needs/Produces editing, and assistant-applied draft changes.

**Architecture:** Add focused server helpers for Devs Agents, expose ownership-checked API routes, then replace only the Agents tab inside the existing Devs screen with a dedicated client component. Keep runtime and Workflow Pipeline untouched.

**Tech Stack:** Next.js App Router, React 19, Supabase service-role server routes, Vitest, Testing Library, TypeScript, CSS in `src/app/globals.css`.

---

## File Structure

- Create `src/lib/esai/agent-contracts.ts`: controlled output labels, safe key generation, contract normalization, publish validation, UI-friendly readiness labels.
- Create `src/lib/esai/__tests__/agent-contracts.test.ts`: pure unit tests for labels, keys, validation, and readiness.
- Create `src/lib/server/devs-agents-repository.ts`: Supabase CRUD for compartments, user agents, drafts, publish, versions, revert, and assistant draft application.
- Create `src/lib/server/__tests__/devs-agents-repository.test.ts`: pure tests for row mapping and publish payload builders; no live Supabase dependency.
- Modify `src/types/esai.ts`: add Devs Agent types used by API and UI.
- Modify `supabase/migrations/202605080001_agent_backend_integration.sql`: add draft/archive columns to `user_agents`.
- Create `src/app/api/compartments/route.ts`: list/create compartments.
- Create `src/app/api/compartments/[id]/route.ts`: rename/archive compartments.
- Modify `src/app/api/agents/route.ts`: replace mock POST, add compartment filter support.
- Create `src/app/api/agents/[id]/route.ts`: get/update/archive one agent.
- Create `src/app/api/agents/[id]/draft/route.ts`: auto-save draft.
- Create `src/app/api/agents/[id]/publish/route.ts`: publish draft as active version.
- Create `src/app/api/agents/[id]/revert/route.ts`: revert to previous version or built-in template.
- Create `src/app/api/agents/[id]/versions/route.ts`: list version history.
- Create `src/app/api/agent-draft-assistant/route.ts`: assistant proposal endpoint, initially provider-aware with clear model-required response if no model is configured.
- Create `src/components/esai/DevsAgentsWorkspace.tsx`: compartments, agent list, prompt editor, Needs/Produces, versions, template, assistant tabs.
- Create `src/components/esai/__tests__/devs-agents-workspace.test.tsx`: client behavior tests with mocked `fetch`.
- Modify `src/components/esai/EsaiPremiumApp.tsx`: replace embedded Agents tab markup with `DevsAgentsWorkspace`.
- Modify `src/app/globals.css`: styles for the three-area Devs Agents workspace.

---

## Task 1: Contract Utilities

**Files:**
- Create: `src/lib/esai/agent-contracts.ts`
- Create: `src/lib/esai/__tests__/agent-contracts.test.ts`
- Modify: `src/types/esai.ts`

- [ ] **Step 1: Add Devs Agent types**

Add these types to `src/types/esai.ts` after the existing artifact contract types:

```ts
export type DevsAgentKind = "template_copy" | "custom";
export type DevsAgentState = "draft" | "published" | "not_pipeline_ready";

export type DevsNeed = {
  key: string;
  label: string;
  acceptedRoles: string[];
  required: boolean;
  includeMode: ArtifactIncludeMode;
};

export type DevsProduces = {
  key: string;
  label: string;
  role: string;
  defaultFilename?: string;
};

export type DevsCompartment = {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  archived: boolean;
  sortOrder: number;
};

export type DevsAgentVersion = {
  id: string;
  versionNumber: number;
  changeSummary: string;
  isActive: boolean;
  createdAt: string;
};

export type DevsAgent = {
  id: string;
  compartmentId: string;
  templateId?: string;
  templateKey?: string;
  templateSourcePath?: string;
  templateContentHash?: string;
  kind: DevsAgentKind;
  state: DevsAgentState;
  name: string;
  description: string;
  enabled: boolean;
  archived: boolean;
  activeSkillVersionId?: string;
  publishedSkillContent: string;
  draftSkillContent: string;
  draftNeeds: DevsNeed[];
  draftProduces: DevsProduces[];
  publishedNeeds: DevsNeed[];
  publishedProduces: DevsProduces[];
  draftUpdatedAt?: string;
};

export type DevsAgentValidation = {
  blocking: string[];
  warnings: string[];
  pipelineReady: boolean;
};
```

- [ ] **Step 2: Write failing contract tests**

Create `src/lib/esai/__tests__/agent-contracts.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  CONTROLLED_OUTPUT_LABELS,
  createSafeContractKey,
  getOutputLabelName,
  validateAgentDraft,
} from "@/lib/esai/agent-contracts";

describe("agent contract utilities", () => {
  it("generates stable safe keys from labels", () => {
    expect(createSafeContractKey("Research Brief")).toBe("research_brief");
    expect(createSafeContractKey("  Draft Essay!!! ")).toBe("draft_essay");
    expect(createSafeContractKey("")).toBe("untitled");
  });

  it("uses friendly names for controlled output labels", () => {
    expect(CONTROLLED_OUTPUT_LABELS).toContain("research_output");
    expect(getOutputLabelName("research_output")).toBe("Research output");
    expect(getOutputLabelName("literature_scan")).toBe("literature_scan");
  });

  it("blocks publishing an empty prompt", () => {
    const result = validateAgentDraft({
      prompt: " ",
      needs: [],
      produces: [{ key: "draft", label: "Draft", role: "draft_output" }],
      existingRolesInCompartment: ["research_output"],
    });

    expect(result.blocking).toContain("Prompt is empty.");
    expect(result.pipelineReady).toBe(false);
  });

  it("blocks missing produces output", () => {
    const result = validateAgentDraft({
      prompt: "Write the essay.",
      needs: [],
      produces: [],
      existingRolesInCompartment: [],
    });

    expect(result.blocking).toContain("Add at least one Produces item before publishing.");
  });

  it("warns for custom labels that do not connect to existing labels", () => {
    const result = validateAgentDraft({
      prompt: "Scan sources.",
      needs: [],
      produces: [{ key: "scan", label: "Scan", role: "literature_scan" }],
      existingRolesInCompartment: ["research_output"],
    });

    expect(result.warnings).toContain("No other agent currently uses output label literature_scan.");
    expect(result.blocking).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```powershell
npm.cmd test -- --run src/lib/esai/__tests__/agent-contracts.test.ts
```

Expected: fail because `src/lib/esai/agent-contracts.ts` does not exist.

- [ ] **Step 4: Implement contract utilities**

Create `src/lib/esai/agent-contracts.ts`:

```ts
import type { DevsAgentValidation, DevsNeed, DevsProduces } from "@/types/esai";

export const CONTROLLED_OUTPUT_LABELS = [
  "guidebook",
  "style_profile",
  "ideation_output",
  "research_output",
  "draft_output",
  "flowchart_output",
  "parts_list_output",
  "prototype_output",
  "ui_mockup_output",
  "supervisor_review",
  "final_output",
  "citation_evidence",
] as const;

export function createSafeContractKey(label: string) {
  const safe = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  return safe || "untitled";
}

export function isSafeContractKey(key: string) {
  return /^[a-z0-9_]+$/.test(key);
}

export function getOutputLabelName(role: string) {
  return role.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function findDuplicates(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }

  return [...duplicates];
}

export function validateAgentDraft(input: {
  prompt: string;
  needs: DevsNeed[];
  produces: DevsProduces[];
  existingRolesInCompartment: string[];
}): DevsAgentValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const needKeys = input.needs.map((need) => need.key);
  const produceKeys = input.produces.map((produce) => produce.key);

  if (!input.prompt.trim()) blocking.push("Prompt is empty.");
  if (input.produces.length === 0) blocking.push("Add at least one Produces item before publishing.");

  for (const key of findDuplicates(needKeys)) blocking.push(`Duplicate Needs key: ${key}.`);
  for (const key of findDuplicates(produceKeys)) blocking.push(`Duplicate Produces key: ${key}.`);

  for (const need of input.needs) {
    if (!isSafeContractKey(need.key)) blocking.push(`Needs key ${need.key} uses unsafe characters.`);
    if (need.required && need.acceptedRoles.length === 0) {
      blocking.push(`${need.label || need.key} accepts no output labels yet.`);
    }
  }

  for (const produce of input.produces) {
    if (!isSafeContractKey(produce.key)) blocking.push(`Produces key ${produce.key} uses unsafe characters.`);
    if (!produce.role.trim()) blocking.push(`${produce.label || produce.key} has no output label.`);
    if (
      produce.role.trim() &&
      !CONTROLLED_OUTPUT_LABELS.includes(produce.role as (typeof CONTROLLED_OUTPUT_LABELS)[number]) &&
      !input.existingRolesInCompartment.includes(produce.role)
    ) {
      warnings.push(`No other agent currently uses output label ${produce.role}.`);
    }
  }

  return {
    blocking,
    warnings,
    pipelineReady: blocking.length === 0,
  };
}
```

- [ ] **Step 5: Run tests**

Run:

```powershell
npm.cmd test -- --run src/lib/esai/__tests__/agent-contracts.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/types/esai.ts src/lib/esai/agent-contracts.ts src/lib/esai/__tests__/agent-contracts.test.ts
git commit -m "feat: add devs agent contract utilities"
```

---

## Task 2: Database Draft Columns

**Files:**
- Modify: `supabase/migrations/202605080001_agent_backend_integration.sql`

- [ ] **Step 1: Add draft/archive columns to migration**

In the `create table if not exists public.user_agents` block, add:

```sql
  draft_skill_content text,
  draft_input_contracts jsonb not null default '[]'::jsonb,
  draft_output_contracts jsonb not null default '[]'::jsonb,
  draft_updated_at timestamptz,
  archived boolean not null default false,
```

After the existing `alter table public.competition_files` block, add:

```sql
alter table public.user_agents
  add column if not exists draft_skill_content text,
  add column if not exists draft_input_contracts jsonb not null default '[]'::jsonb,
  add column if not exists draft_output_contracts jsonb not null default '[]'::jsonb,
  add column if not exists draft_updated_at timestamptz,
  add column if not exists archived boolean not null default false;
```

- [ ] **Step 2: Run lint**

Run:

```powershell
npm.cmd run lint
```

Expected: pass.

- [ ] **Step 3: Commit**

Run:

```powershell
git add supabase/migrations/202605080001_agent_backend_integration.sql
git commit -m "feat: add agent draft columns"
```

---

## Task 3: Devs Agents Repository

**Files:**
- Create: `src/lib/server/devs-agents-repository.ts`
- Create: `src/lib/server/__tests__/devs-agents-repository.test.ts`

- [ ] **Step 1: Write row mapping tests**

Create `src/lib/server/__tests__/devs-agents-repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  buildPublishVersionRow,
  mapCompartmentRow,
  mapUserAgentRow,
  nextVersionNumber,
} from "@/lib/server/devs-agents-repository";

describe("devs agents repository helpers", () => {
  it("maps compartment rows to UI shape", () => {
    expect(
      mapCompartmentRow({
        id: "c1",
        name: "Essay",
        slug: "essay",
        is_default: true,
        archived: false,
        sort_order: 0,
      }),
    ).toEqual({
      id: "c1",
      name: "Essay",
      slug: "essay",
      isDefault: true,
      archived: false,
      sortOrder: 0,
    });
  });

  it("maps user agent rows and template metadata", () => {
    const agent = mapUserAgentRow({
      id: "a1",
      compartment_id: "c1",
      template_id: "t1",
      name: "Research Agent",
      description: "Research",
      enabled: true,
      archived: false,
      is_custom: false,
      active_skill_version_id: "v1",
      draft_skill_content: "# Draft",
      draft_input_contracts: [{ key: "idea", label: "Idea", acceptedRoles: ["ideation_output"], required: true, includeMode: "full" }],
      draft_output_contracts: [{ key: "research", label: "Research", role: "research_output" }],
      agent_templates: {
        template_key: "research-agent",
        source_path: "skills/research-agent/SKILL.md",
        content_hash: "hash",
        default_skill_content: "# Template",
      },
      agent_skill_versions: {
        id: "v1",
        skill_content: "# Published",
        input_contracts: [],
        output_contracts: [],
      },
    });

    expect(agent.kind).toBe("template_copy");
    expect(agent.templateKey).toBe("research-agent");
    expect(agent.draftSkillContent).toBe("# Draft");
    expect(agent.publishedSkillContent).toBe("# Published");
  });

  it("chooses the next version number", () => {
    expect(nextVersionNumber([])).toBe(1);
    expect(nextVersionNumber([{ version_number: 1 }, { version_number: 4 }])).toBe(5);
  });

  it("builds publish version rows", () => {
    expect(
      buildPublishVersionRow({
        userId: "u1",
        userAgentId: "a1",
        templateId: "t1",
        versionNumber: 2,
        skillContent: "# Agent",
        inputContracts: [],
        outputContracts: [{ key: "draft", label: "Draft", role: "draft_output" }],
        changeSummary: "Updated prompt",
      }),
    ).toMatchObject({
      user_id: "u1",
      user_agent_id: "a1",
      template_id: "t1",
      version_number: 2,
      skill_content: "# Agent",
      change_summary: "Updated prompt",
      is_active: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm.cmd test -- --run src/lib/server/__tests__/devs-agents-repository.test.ts
```

Expected: fail because repository file does not exist.

- [ ] **Step 3: Implement repository helpers and methods**

Create `src/lib/server/devs-agents-repository.ts` with:

```ts
import "server-only";

import { createSafeContractKey, validateAgentDraft } from "@/lib/esai/agent-contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DevsAgent, DevsAgentVersion, DevsCompartment, DevsNeed, DevsProduces } from "@/types/esai";

type Row = Record<string, unknown>;

export function mapCompartmentRow(row: Row): DevsCompartment {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    isDefault: Boolean(row.is_default),
    archived: Boolean(row.archived),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function asNeeds(value: unknown): DevsNeed[] {
  return Array.isArray(value) ? (value as DevsNeed[]) : [];
}

function asProduces(value: unknown): DevsProduces[] {
  return Array.isArray(value) ? (value as DevsProduces[]) : [];
}

export function mapUserAgentRow(row: Row): DevsAgent {
  const template = row.agent_templates as Row | null | undefined;
  const activeVersion = row.agent_skill_versions as Row | null | undefined;
  const isCustom = Boolean(row.is_custom) || !row.template_id;
  const draftSkillContent = String(row.draft_skill_content ?? activeVersion?.skill_content ?? template?.default_skill_content ?? "");
  const publishedSkillContent = String(activeVersion?.skill_content ?? template?.default_skill_content ?? "");
  const draftProduces = asProduces(row.draft_output_contracts ?? activeVersion?.output_contracts);
  const publishedProduces = asProduces(activeVersion?.output_contracts);
  const hasDraft = Boolean(row.draft_updated_at);

  return {
    id: String(row.id),
    compartmentId: String(row.compartment_id),
    templateId: row.template_id ? String(row.template_id) : undefined,
    templateKey: template?.template_key ? String(template.template_key) : undefined,
    templateSourcePath: template?.source_path ? String(template.source_path) : undefined,
    templateContentHash: template?.content_hash ? String(template.content_hash) : undefined,
    kind: isCustom ? "custom" : "template_copy",
    state: hasDraft ? "draft" : publishedProduces.length > 0 ? "published" : "not_pipeline_ready",
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    enabled: Boolean(row.enabled ?? true),
    archived: Boolean(row.archived),
    activeSkillVersionId: row.active_skill_version_id ? String(row.active_skill_version_id) : undefined,
    publishedSkillContent,
    draftSkillContent,
    draftNeeds: asNeeds(row.draft_input_contracts ?? activeVersion?.input_contracts),
    draftProduces,
    publishedNeeds: asNeeds(activeVersion?.input_contracts),
    publishedProduces,
    draftUpdatedAt: row.draft_updated_at ? String(row.draft_updated_at) : undefined,
  };
}

export function mapVersionRow(row: Row): DevsAgentVersion {
  return {
    id: String(row.id),
    versionNumber: Number(row.version_number ?? 1),
    changeSummary: String(row.change_summary ?? ""),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export function nextVersionNumber(rows: Array<{ version_number?: number }>) {
  return Math.max(0, ...rows.map((row) => Number(row.version_number ?? 0))) + 1;
}

export function buildPublishVersionRow(input: {
  userId: string;
  userAgentId: string;
  templateId?: string | null;
  versionNumber: number;
  skillContent: string;
  inputContracts: DevsNeed[];
  outputContracts: DevsProduces[];
  changeSummary: string;
}) {
  return {
    user_id: input.userId,
    user_agent_id: input.userAgentId,
    template_id: input.templateId ?? null,
    version_number: input.versionNumber,
    skill_content: input.skillContent,
    input_contracts: input.inputContracts,
    output_contracts: input.outputContracts,
    change_summary: input.changeSummary,
    is_active: true,
  };
}

export function createDevsAgentsRepository(userId: string) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase admin client unavailable.");

  return {
    async listCompartments() {
      const { data, error } = await supabase
        .from("compartments")
        .select("*")
        .eq("user_id", userId)
        .eq("archived", false)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapCompartmentRow);
    },

    async createCompartment(name: string) {
      const safeName = name.trim();
      if (!safeName) throw new Error("Compartment name is required.");
      const slug = createSafeContractKey(safeName).replace(/_/g, "-");
      const { data, error } = await supabase
        .from("compartments")
        .insert({ user_id: userId, name: safeName, slug, is_default: false, sort_order: 50 })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return mapCompartmentRow(data);
    },

    async listAgents(compartmentId?: string | null) {
      let query = supabase
        .from("user_agents")
        .select("*, agent_templates(template_key, source_path, content_hash, default_skill_content), agent_skill_versions!user_agents_active_skill_version_id_fkey(id, skill_content, input_contracts, output_contracts)")
        .eq("user_id", userId)
        .eq("archived", false)
        .order("sort_order", { ascending: true });
      if (compartmentId) query = query.eq("compartment_id", compartmentId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapUserAgentRow);
    },

    async getAgent(agentId: string) {
      const { data, error } = await supabase
        .from("user_agents")
        .select("*, agent_templates(template_key, source_path, content_hash, default_skill_content), agent_skill_versions!user_agents_active_skill_version_id_fkey(id, skill_content, input_contracts, output_contracts)")
        .eq("user_id", userId)
        .eq("id", agentId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapUserAgentRow(data) : null;
    },
  };
}
```

Additional repository methods are added in Tasks 4 and 5 to keep review small.

- [ ] **Step 4: Run tests**

Run:

```powershell
npm.cmd test -- --run src/lib/server/__tests__/devs-agents-repository.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/lib/server/devs-agents-repository.ts src/lib/server/__tests__/devs-agents-repository.test.ts
git commit -m "feat: add devs agents repository helpers"
```

---

## Task 4: Compartments and Agents API

**Files:**
- Create: `src/app/api/compartments/route.ts`
- Create: `src/app/api/compartments/[id]/route.ts`
- Modify: `src/app/api/agents/route.ts`
- Create: `src/app/api/agents/[id]/route.ts`
- Modify: `src/lib/server/devs-agents-repository.ts`

- [ ] **Step 1: Add repository methods for create/update/archive agents**

Append methods inside `createDevsAgentsRepository`:

```ts
async createAgent(input: { compartmentId: string; name: string; description?: string }) {
  const name = input.name.trim();
  if (!name) throw new Error("Agent name is required.");
  const { data, error } = await supabase
    .from("user_agents")
    .insert({
      user_id: userId,
      compartment_id: input.compartmentId,
      name,
      description: input.description?.trim() ?? "",
      is_custom: true,
      enabled: true,
      archived: false,
      draft_skill_content: "",
      draft_input_contracts: [],
      draft_output_contracts: [],
      draft_updated_at: new Date().toISOString(),
    })
    .select("*, agent_templates(template_key, source_path, content_hash, default_skill_content), agent_skill_versions!user_agents_active_skill_version_id_fkey(id, skill_content, input_contracts, output_contracts)")
    .single();
  if (error) throw new Error(error.message);
  return mapUserAgentRow(data);
},

async archiveAgent(agentId: string) {
  const { error } = await supabase.from("user_agents").update({ archived: true }).eq("user_id", userId).eq("id", agentId);
  if (error) throw new Error(error.message);
},

async updateCompartment(id: string, input: { name?: string; archived?: boolean }) {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.archived !== undefined) patch.archived = input.archived;
  const { data, error } = await supabase
    .from("compartments")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", id)
    .eq("is_default", false)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapCompartmentRow(data) : null;
},
```

- [ ] **Step 2: Create shared route helper**

In each route, use this pattern:

```ts
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

async function getRepository() {
  const user = await getRequestUser();
  if (!user) return { user: null, repository: null };
  return { user, repository: createDevsAgentsRepository(user.id) };
}
```

- [ ] **Step 3: Implement `GET/POST /api/compartments`**

Create `src/app/api/compartments/route.ts`:

```ts
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();
  const repository = createDevsAgentsRepository(user.id);
  return Response.json({ data: await repository.listCompartments(), meta: { backendMode: "supabase" } });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();
  const body = await request.json().catch(() => ({}));
  const repository = createDevsAgentsRepository(user.id);
  const compartment = await repository.createCompartment(String(body.name ?? ""));
  return Response.json({ data: compartment, meta: { backendMode: "supabase" } }, { status: 201 });
}
```

- [ ] **Step 4: Implement `PATCH /api/compartments/[id]`**

Create `src/app/api/compartments/[id]/route.ts`:

```ts
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const repository = createDevsAgentsRepository(user.id);
  const compartment = await repository.updateCompartment(id, {
    name: typeof body.name === "string" ? body.name : undefined,
    archived: typeof body.archived === "boolean" ? body.archived : undefined,
  });
  if (!compartment) return Response.json({ error: "Compartment not found or cannot be changed." }, { status: 404 });
  return Response.json({ data: compartment, meta: { backendMode: "supabase" } });
}
```

- [ ] **Step 5: Replace `/api/agents` mock POST**

Modify `src/app/api/agents/route.ts`:

```ts
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

export async function GET(request: Request) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();
  const { searchParams } = new URL(request.url);
  const repository = createDevsAgentsRepository(user.id);
  const data = await repository.listAgents(searchParams.get("compartmentId"));
  return Response.json({ data, meta: { backendMode: "supabase" } });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();
  const body = await request.json().catch(() => ({}));
  const repository = createDevsAgentsRepository(user.id);
  const agent = await repository.createAgent({
    compartmentId: String(body.compartmentId ?? ""),
    name: String(body.name ?? ""),
    description: typeof body.description === "string" ? body.description : "",
  });
  return Response.json({ data: agent, meta: { backendMode: "supabase" } }, { status: 201 });
}
```

- [ ] **Step 6: Implement `/api/agents/[id]`**

Create `src/app/api/agents/[id]/route.ts`:

```ts
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();
  const { id } = await context.params;
  const repository = createDevsAgentsRepository(user.id);
  const agent = await repository.getAgent(id);
  if (!agent) return Response.json({ error: "Agent not found." }, { status: 404 });
  return Response.json({ data: agent, meta: { backendMode: "supabase" } });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const repository = createDevsAgentsRepository(user.id);
  if (body.archived === true) await repository.archiveAgent(id);
  const agent = await repository.getAgent(id);
  return Response.json({ data: agent, meta: { backendMode: "supabase" } });
}
```

- [ ] **Step 7: Run verification**

Run:

```powershell
npm.cmd test -- --run src/lib/server/__tests__/devs-agents-repository.test.ts
npm.cmd run lint
```

Expected: pass.

- [ ] **Step 8: Commit**

Run:

```powershell
git add src/app/api/compartments src/app/api/agents src/lib/server/devs-agents-repository.ts
git commit -m "feat: add devs agents api"
```

---

## Task 5: Draft, Publish, Versions, Revert API

**Files:**
- Modify: `src/lib/server/devs-agents-repository.ts`
- Create: `src/app/api/agents/[id]/draft/route.ts`
- Create: `src/app/api/agents/[id]/publish/route.ts`
- Create: `src/app/api/agents/[id]/revert/route.ts`
- Create: `src/app/api/agents/[id]/versions/route.ts`

- [ ] **Step 1: Add repository methods**

Add methods inside `createDevsAgentsRepository`:

```ts
async saveDraft(agentId: string, input: { skillContent: string; needs: DevsNeed[]; produces: DevsProduces[] }) {
  const { data, error } = await supabase
    .from("user_agents")
    .update({
      draft_skill_content: input.skillContent,
      draft_input_contracts: input.needs,
      draft_output_contracts: input.produces,
      draft_updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", agentId)
    .select("*, agent_templates(template_key, source_path, content_hash, default_skill_content), agent_skill_versions!user_agents_active_skill_version_id_fkey(id, skill_content, input_contracts, output_contracts)")
    .single();
  if (error) throw new Error(error.message);
  return mapUserAgentRow(data);
},

async listVersions(agentId: string) {
  const { data, error } = await supabase
    .from("agent_skill_versions")
    .select("*")
    .eq("user_id", userId)
    .eq("user_agent_id", agentId)
    .order("version_number", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapVersionRow);
},

async publishDraft(agentId: string, changeSummary?: string) {
  const agent = await this.getAgent(agentId);
  if (!agent) throw new Error("Agent not found.");
  const existingRoles = (await this.listAgents(agent.compartmentId)).flatMap((item) => [
    ...item.publishedProduces.map((produce) => produce.role),
    ...item.draftProduces.map((produce) => produce.role),
  ]);
  const validation = validateAgentDraft({
    prompt: agent.draftSkillContent,
    needs: agent.draftNeeds,
    produces: agent.draftProduces,
    existingRolesInCompartment: existingRoles,
  });
  if (validation.blocking.length > 0) {
    const error = new Error(validation.blocking.join(" "));
    error.name = "ValidationError";
    throw error;
  }
  const versionRows = await this.listVersions(agentId);
  const versionNumber = Math.max(0, ...versionRows.map((row) => row.versionNumber)) + 1;
  await supabase.from("agent_skill_versions").update({ is_active: false }).eq("user_id", userId).eq("user_agent_id", agentId);
  const { data: version, error: insertError } = await supabase
    .from("agent_skill_versions")
    .insert(buildPublishVersionRow({
      userId,
      userAgentId: agentId,
      templateId: agent.templateId,
      versionNumber,
      skillContent: agent.draftSkillContent,
      inputContracts: agent.draftNeeds,
      outputContracts: agent.draftProduces,
      changeSummary: changeSummary?.trim() || `Published version ${versionNumber}`,
    }))
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);
  const { error: updateError } = await supabase.from("user_agents").update({ active_skill_version_id: version.id, draft_updated_at: null }).eq("user_id", userId).eq("id", agentId);
  if (updateError) throw new Error(updateError.message);
  return this.getAgent(agentId);
},
```

Use normal function methods, not arrow properties, so `this.getAgent` resolves inside the object.

- [ ] **Step 2: Implement draft route**

Create `src/app/api/agents/[id]/draft/route.ts`:

```ts
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const repository = createDevsAgentsRepository(user.id);
  const agent = await repository.saveDraft(id, {
    skillContent: String(body.skillContent ?? ""),
    needs: Array.isArray(body.needs) ? body.needs : [],
    produces: Array.isArray(body.produces) ? body.produces : [],
  });
  return Response.json({ data: agent, meta: { backendMode: "supabase" } });
}
```

- [ ] **Step 3: Implement versions route**

Create `src/app/api/agents/[id]/versions/route.ts`:

```ts
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();
  const { id } = await context.params;
  const repository = createDevsAgentsRepository(user.id);
  return Response.json({ data: await repository.listVersions(id), meta: { backendMode: "supabase" } });
}
```

- [ ] **Step 4: Implement publish route**

Create `src/app/api/agents/[id]/publish/route.ts`:

```ts
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const repository = createDevsAgentsRepository(user.id);
  try {
    const agent = await repository.publishDraft(id, typeof body.changeSummary === "string" ? body.changeSummary : undefined);
    return Response.json({ data: agent, meta: { backendMode: "supabase" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not publish agent.";
    const status = error instanceof Error && error.name === "ValidationError" ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
```

- [ ] **Step 5: Implement revert route**

Add repository revert method:

```ts
async copyVersionToDraft(agentId: string, input: { versionId?: string; useTemplate?: boolean }) {
  const agent = await this.getAgent(agentId);
  if (!agent) throw new Error("Agent not found.");
  if (input.useTemplate) {
    const { data, error } = await supabase.from("agent_templates").select("*").eq("id", agent.templateId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Built-in template not found.");
    return this.saveDraft(agentId, { skillContent: String(data.default_skill_content ?? ""), needs: [], produces: [] });
  }
  const { data, error } = await supabase
    .from("agent_skill_versions")
    .select("*")
    .eq("user_id", userId)
    .eq("user_agent_id", agentId)
    .eq("id", input.versionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Version not found.");
  return this.saveDraft(agentId, {
    skillContent: String(data.skill_content ?? ""),
    needs: asNeeds(data.input_contracts),
    produces: asProduces(data.output_contracts),
  });
},
```

Create `src/app/api/agents/[id]/revert/route.ts`:

```ts
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createDevsAgentsRepository } from "@/lib/server/devs-agents-repository";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const repository = createDevsAgentsRepository(user.id);
  const agent = await repository.copyVersionToDraft(id, {
    versionId: typeof body.versionId === "string" ? body.versionId : undefined,
    useTemplate: body.source === "template",
  });
  return Response.json({ data: agent, meta: { backendMode: "supabase" } });
}
```

- [ ] **Step 6: Run verification and commit**

Run:

```powershell
npm.cmd test -- --run src/lib/server/__tests__/devs-agents-repository.test.ts
npm.cmd run lint
git add src/lib/server/devs-agents-repository.ts src/app/api/agents
git commit -m "feat: add agent draft publishing api"
```

---

## Task 6: Assistant API Stub With Apply Contract

**Files:**
- Create: `src/app/api/agent-draft-assistant/route.ts`

- [ ] **Step 1: Implement safe assistant response contract**

Create `src/app/api/agent-draft-assistant/route.ts`:

```ts
import { CONTROLLED_OUTPUT_LABELS, createSafeContractKey } from "@/lib/esai/agent-contracts";
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();
  const body = await request.json().catch(() => ({}));
  const prompt = String(body.message ?? "").trim();
  const agentName = String(body.agentName ?? "Custom agent").trim();

  if (!prompt) {
    return Response.json({ error: "Describe what this agent should do first." }, { status: 400 });
  }

  if (!process.env.ENABLE_LOCAL_CLI_PROVIDERS && !process.env.OPENAI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    return Response.json(
      {
        error: "Choose a model first.",
        message: "The Assistant needs a configured model before it can suggest prompt and output labels.",
      },
      { status: 409 },
    );
  }

  const key = createSafeContractKey(agentName);
  return Response.json({
    data: {
      explanation: "Draft suggestion prepared. Review it before applying.",
      draftSkillContent: `# ${agentName}\n\n${prompt}\n\nReturn a clear result and label the produced output for downstream agents.`,
      needs: [],
      produces: [
        {
          key: `${key}_output`,
          label: `${agentName} output`,
          role: CONTROLLED_OUTPUT_LABELS.includes("final_output") ? "final_output" : "custom_output",
          defaultFilename: `${key}_output.md`,
        },
      ],
    },
    meta: { backendMode: "supabase", appliesToDraftOnly: true },
  });
}
```

This endpoint intentionally returns a conservative structured proposal. Wiring a real model call can replace the body generation without changing the Apply flow.

- [ ] **Step 2: Run lint**

Run:

```powershell
npm.cmd run lint
```

Expected: pass.

- [ ] **Step 3: Commit**

Run:

```powershell
git add src/app/api/agent-draft-assistant/route.ts
git commit -m "feat: add devs assistant proposal api"
```

---

## Task 7: Devs Agents Workspace UI

**Files:**
- Create: `src/components/esai/DevsAgentsWorkspace.tsx`
- Create: `src/components/esai/__tests__/devs-agents-workspace.test.tsx`
- Modify: `src/components/esai/EsaiPremiumApp.tsx`

- [ ] **Step 1: Write component tests with mocked fetch**

Create `src/components/esai/__tests__/devs-agents-workspace.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DevsAgentsWorkspace } from "@/components/esai/DevsAgentsWorkspace";

const compartments = [{ id: "c1", name: "Essay", slug: "essay", isDefault: true, archived: false, sortOrder: 0 }];
const agents = [{
  id: "a1",
  compartmentId: "c1",
  kind: "template_copy",
  state: "published",
  name: "Research Agent",
  description: "Research",
  enabled: true,
  archived: false,
  publishedSkillContent: "# Research",
  draftSkillContent: "# Research",
  draftNeeds: [],
  draftProduces: [{ key: "research_brief", label: "Research brief", role: "research_output" }],
  publishedNeeds: [],
  publishedProduces: [{ key: "research_brief", label: "Research brief", role: "research_output" }],
}];

describe("DevsAgentsWorkspace", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads compartments and agents", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/compartments")) return Response.json({ data: compartments });
      if (url.includes("/api/agents")) return Response.json({ data: agents });
      return Response.json({ data: [] });
    });

    render(<DevsAgentsWorkspace />);

    expect(await screen.findByText("Research Agent")).toBeInTheDocument();
    expect(screen.getByText("Template copy")).toBeInTheDocument();
    expect(screen.getByDisplayValue("# Research")).toBeInTheDocument();
  });

  it("creates a custom agent", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/compartments")) return Response.json({ data: compartments });
      if (url.includes("/api/agents") && init?.method === "POST") return Response.json({ data: { ...agents[0], id: "a2", name: "Citation Agent", kind: "custom" } }, { status: 201 });
      if (url.includes("/api/agents")) return Response.json({ data: agents });
      return Response.json({ data: [] });
    });

    render(<DevsAgentsWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: /New Agent/i }));
    fireEvent.change(screen.getByPlaceholderText("Agent name"), { target: { value: "Citation Agent" } });
    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agents", expect.objectContaining({ method: "POST" })));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm.cmd test -- --run src/components/esai/__tests__/devs-agents-workspace.test.tsx
```

Expected: fail because component does not exist.

- [ ] **Step 3: Implement `DevsAgentsWorkspace`**

Create `src/components/esai/DevsAgentsWorkspace.tsx`:

```tsx
"use client";

import { Bot, History, Plus, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getOutputLabelName, validateAgentDraft } from "@/lib/esai/agent-contracts";
import type { DevsAgent, DevsCompartment, DevsNeed, DevsProduces } from "@/types/esai";

type Tab = "assistant" | "contracts" | "versions" | "template";

async function readData<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  const json = await response.json();
  return json.data ?? [];
}

export function DevsAgentsWorkspace() {
  const [compartments, setCompartments] = useState<DevsCompartment[]>([]);
  const [agents, setAgents] = useState<DevsAgent[]>([]);
  const [selectedCompartmentId, setSelectedCompartmentId] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [tab, setTab] = useState<Tab>("assistant");
  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null;

  useEffect(() => {
    void readData<DevsCompartment>("/api/compartments").then((items) => {
      setCompartments(items);
      setSelectedCompartmentId((current) => current || items[0]?.id || "");
    });
  }, []);

  useEffect(() => {
    if (!selectedCompartmentId) return;
    void readData<DevsAgent>(`/api/agents?compartmentId=${selectedCompartmentId}`).then((items) => {
      setAgents(items);
      setSelectedAgentId((current) => (items.some((agent) => agent.id === current) ? current : items[0]?.id || ""));
    });
  }, [selectedCompartmentId]);

  const validation = useMemo(() => {
    if (!selectedAgent) return null;
    return validateAgentDraft({
      prompt: selectedAgent.draftSkillContent,
      needs: selectedAgent.draftNeeds,
      produces: selectedAgent.draftProduces,
      existingRolesInCompartment: agents.flatMap((agent) => agent.draftProduces.map((produce) => produce.role)),
    });
  }, [agents, selectedAgent]);

  async function createAgent() {
    const response = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compartmentId: selectedCompartmentId, name: newAgentName }),
    });
    const json = await response.json();
    if (json.data) {
      setAgents((items) => [json.data, ...items]);
      setSelectedAgentId(json.data.id);
      setNewAgentName("");
      setNewAgentOpen(false);
    }
  }

  async function saveDraft(patch: Partial<Pick<DevsAgent, "draftSkillContent" | "draftNeeds" | "draftProduces">>) {
    if (!selectedAgent) return;
    const next = { ...selectedAgent, ...patch };
    setAgents((items) => items.map((agent) => (agent.id === next.id ? next : agent)));
    await fetch(`/api/agents/${selectedAgent.id}/draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skillContent: next.draftSkillContent,
        needs: next.draftNeeds,
        produces: next.draftProduces,
      }),
    });
  }

  return (
    <section className="devs-agents">
      <div className="devs-agent-toolbar">
        <select value={selectedCompartmentId} onChange={(event) => setSelectedCompartmentId(event.target.value)}>
          {compartments.map((compartment) => <option key={compartment.id} value={compartment.id}>{compartment.name}</option>)}
        </select>
        <button className="btn-secondary" type="button"><Plus size={15} /> Compartment</button>
        <button className="btn-primary" type="button" onClick={() => setNewAgentOpen(true)}><Plus size={15} /> New Agent</button>
      </div>

      {newAgentOpen ? (
        <div className="agent-create-row">
          <input placeholder="Agent name" value={newAgentName} onChange={(event) => setNewAgentName(event.target.value)} />
          <button className="btn-primary" onClick={createAgent}>Create agent</button>
        </div>
      ) : null}

      <div className="devs-agent-grid">
        <aside className="devs-agent-list">
          {agents.map((agent) => (
            <button key={agent.id} className={agent.id === selectedAgent?.id ? "active" : ""} onClick={() => setSelectedAgentId(agent.id)}>
              <Bot size={17} />
              <span><strong>{agent.name}</strong><small>{agent.description || "No description yet"}</small></span>
              <em>{agent.kind === "template_copy" ? "Template copy" : "Custom"}</em>
            </button>
          ))}
        </aside>

        <main className="devs-agent-editor">
          {selectedAgent ? (
            <>
              <header>
                <div><h2>{selectedAgent.name}</h2><p>{selectedAgent.kind === "template_copy" ? "Template copy" : "Custom agent"}</p></div>
                <button className="btn-primary">Publish version</button>
              </header>
              <textarea value={selectedAgent.draftSkillContent} onChange={(event) => void saveDraft({ draftSkillContent: event.target.value })} />
              {validation?.blocking.map((item) => <p className="form-warning" key={item}>{item}</p>)}
              {validation?.warnings.map((item) => <p className="form-note" key={item}>{item}</p>)}
            </>
          ) : <p>No agent selected.</p>}
        </main>

        <aside className="devs-agent-side">
          <div className="side-tabs">
            <button className={tab === "assistant" ? "active" : ""} onClick={() => setTab("assistant")}><Sparkles size={14} />Assistant</button>
            <button className={tab === "contracts" ? "active" : ""} onClick={() => setTab("contracts")}>Needs / Produces</button>
            <button className={tab === "versions" ? "active" : ""} onClick={() => setTab("versions")}><History size={14} />Versions</button>
            <button className={tab === "template" ? "active" : ""} onClick={() => setTab("template")}><RotateCcw size={14} />Template</button>
          </div>
          {selectedAgent && tab === "contracts" ? <ContractsPanel agent={selectedAgent} onSave={saveDraft} /> : null}
          {selectedAgent && tab === "assistant" ? <AssistantDraftPanel agent={selectedAgent} onApply={saveDraft} /> : null}
          {selectedAgent && tab === "versions" ? <p className="form-note">Version history loads after publish.</p> : null}
          {selectedAgent && tab === "template" ? <p className="form-note">{selectedAgent.templateSourcePath || "This is a custom agent."}</p> : null}
        </aside>
      </div>
    </section>
  );
}

function ContractsPanel({ agent, onSave }: { agent: DevsAgent; onSave: (patch: Partial<Pick<DevsAgent, "draftNeeds" | "draftProduces">>) => Promise<void> }) {
  function addProduce() {
    const next: DevsProduces = { key: "new_output", label: "New output", role: "final_output", defaultFilename: "new_output.md" };
    void onSave({ draftProduces: [...agent.draftProduces, next] });
  }

  return (
    <div className="contracts-panel">
      <h3>Needs</h3>
      {agent.draftNeeds.map((need: DevsNeed) => <p key={need.key}>{need.label}: accepts {need.acceptedRoles.map(getOutputLabelName).join(", ")}</p>)}
      <h3>Produces</h3>
      {agent.draftProduces.map((produce) => <p key={produce.key}>{produce.label}: {getOutputLabelName(produce.role)}</p>)}
      <button className="btn-secondary" onClick={addProduce}>Add Produces</button>
    </div>
  );
}

function AssistantDraftPanel({ agent, onApply }: { agent: DevsAgent; onApply: (patch: Partial<Pick<DevsAgent, "draftSkillContent" | "draftNeeds" | "draftProduces">>) => Promise<void> }) {
  const [message, setMessage] = useState("");
  const [proposal, setProposal] = useState<null | { draftSkillContent: string; needs: DevsNeed[]; produces: DevsProduces[]; explanation: string }>(null);

  async function askAssistant() {
    const response = await fetch("/api/agent-draft-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName: agent.name, message }),
    });
    const json = await response.json();
    if (json.data) setProposal(json.data);
  }

  return (
    <div className="assistant-draft-panel">
      <textarea placeholder="Describe what this agent should do" value={message} onChange={(event) => setMessage(event.target.value)} />
      <button className="btn-secondary" onClick={askAssistant}>Suggest draft</button>
      {proposal ? (
        <div className="assistant-proposal">
          <p>{proposal.explanation}</p>
          <button className="btn-primary" onClick={() => void onApply(proposal)}>Apply to draft</button>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Replace Agents tab in `EsaiPremiumApp.tsx`**

Import the new component:

```tsx
import { DevsAgentsWorkspace } from "@/components/esai/DevsAgentsWorkspace";
```

In `DevsScreen`, remove `agentName` and `customAgents` state. Replace the old `tab === "agents"` panel with:

```tsx
{tab === "agents" ? <DevsAgentsWorkspace /> : null}
```

- [ ] **Step 5: Run component test**

Run:

```powershell
npm.cmd test -- --run src/components/esai/__tests__/devs-agents-workspace.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/components/esai/DevsAgentsWorkspace.tsx src/components/esai/__tests__/devs-agents-workspace.test.tsx src/components/esai/EsaiPremiumApp.tsx
git commit -m "feat: add devs agents workspace"
```

---

## Task 8: Versions, Publish, Revert UI Wiring

**Files:**
- Modify: `src/components/esai/DevsAgentsWorkspace.tsx`
- Modify: `src/components/esai/__tests__/devs-agents-workspace.test.tsx`

- [ ] **Step 1: Add publish test**

Append test:

```tsx
it("publishes the selected agent", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes("/api/compartments")) return Response.json({ data: compartments });
    if (url.includes("/api/agents/a1/publish")) return Response.json({ data: { ...agents[0], state: "published" } });
    if (url.includes("/api/agents")) return Response.json({ data: agents });
    return Response.json({ data: [] });
  });

  render(<DevsAgentsWorkspace />);
  fireEvent.click(await screen.findByRole("button", { name: /Publish version/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/agents/a1/publish", expect.objectContaining({ method: "POST" })));
});
```

- [ ] **Step 2: Implement publish handler**

In `DevsAgentsWorkspace`, add:

```tsx
async function publishAgent() {
  if (!selectedAgent) return;
  const response = await fetch(`/api/agents/${selectedAgent.id}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ changeSummary: "Published from Devs editor" }),
  });
  const json = await response.json();
  if (json.data) setAgents((items) => items.map((agent) => (agent.id === json.data.id ? json.data : agent)));
}
```

Change button:

```tsx
<button className="btn-primary" onClick={publishAgent}>Publish version</button>
```

- [ ] **Step 3: Implement versions panel loading**

Add state:

```tsx
const [versions, setVersions] = useState<DevsAgentVersion[]>([]);
```

Import `DevsAgentVersion`.

Load when `tab === "versions"`:

```tsx
useEffect(() => {
  if (!selectedAgentId || tab !== "versions") return;
  void readData<DevsAgentVersion>(`/api/agents/${selectedAgentId}/versions`).then(setVersions);
}, [selectedAgentId, tab]);
```

Render:

```tsx
{selectedAgent && tab === "versions" ? (
  <div className="versions-list">
    {versions.map((version) => (
      <button key={version.id} className={version.isActive ? "active" : ""}>
        Version {version.versionNumber}
        <small>{version.changeSummary || "No summary"}</small>
      </button>
    ))}
  </div>
) : null}
```

- [ ] **Step 4: Run verification and commit**

Run:

```powershell
npm.cmd test -- --run src/components/esai/__tests__/devs-agents-workspace.test.tsx
npm.cmd run lint
git add src/components/esai/DevsAgentsWorkspace.tsx src/components/esai/__tests__/devs-agents-workspace.test.tsx
git commit -m "feat: wire agent publish and versions"
```

---

## Task 9: Styling and Full Verification

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add focused Devs Agents styles**

Append:

```css
.devs-agents {
  display: grid;
  gap: 16px;
}

.devs-agent-toolbar,
.agent-create-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.devs-agent-toolbar select,
.agent-create-row input {
  min-height: 42px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 12px;
  background: var(--surface);
  color: var(--text);
}

.devs-agent-grid {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(420px, 1fr) minmax(280px, 340px);
  gap: 14px;
  min-height: 560px;
}

.devs-agent-list,
.devs-agent-editor,
.devs-agent-side {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  padding: 14px;
}

.devs-agent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.devs-agent-list button {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 10px;
  background: transparent;
  color: var(--text);
}

.devs-agent-list button.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.devs-agent-list em {
  grid-column: 2;
  color: var(--muted);
  font-style: normal;
  font-size: 12px;
}

.devs-agent-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.devs-agent-editor header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.devs-agent-editor textarea,
.assistant-draft-panel textarea {
  width: 100%;
  min-height: 360px;
  resize: vertical;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: var(--canvas);
  color: var(--text);
  font: inherit;
}

.side-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.side-tabs button {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--canvas);
  color: var(--text);
}

.side-tabs button.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.form-warning {
  color: var(--danger);
  font-size: 13px;
}

.form-note {
  color: var(--muted);
  font-size: 13px;
}
```

- [ ] **Step 2: Run all checks**

Run:

```powershell
npm.cmd run lint
npm.cmd test -- --run
npm.cmd run build
```

Expected:

- lint passes
- all Vitest files pass
- Next build succeeds

- [ ] **Step 3: Browser smoke check**

With the local dev server running, open:

```text
http://localhost:3000
```

Manual checks:

- Devs opens.
- Agents tab shows compartments and synced Essay agents.
- `Research Agent` or another synced agent can be selected.
- Prompt editor shows draft/published content.
- `+ New Agent` creates a custom agent.
- Produces panel shows output labels, not file type wording.
- Publish button calls the publish endpoint.

- [ ] **Step 4: Final commit**

Run:

```powershell
git add src/app/globals.css
git commit -m "style: polish devs agents workspace"
```

---

## Self-Review

Spec coverage:

- Supabase-backed compartments: Tasks 3, 4, 7.
- Supabase-backed user agents: Tasks 3, 4, 7.
- Draft auto-save: Tasks 2, 5, 7.
- Publish/version history: Tasks 5, 8.
- Revert: Task 5, expandable in Task 8 UI after versions render.
- Structured Needs/Produces: Tasks 1, 7.
- Plain language labels: Tasks 1, 7, 9.
- Custom agents: Tasks 4, 7.
- Template private copies: Tasks 3, 5.
- AI Assistant applies to draft only: Tasks 6, 7.
- Workflow Pipeline excluded: no tasks implement pipeline graph or runtime execution.

No placeholder terms are used as implementation instructions. Deferred pipeline work is explicitly outside this plan.

Type consistency:

- UI types live in `src/types/esai.ts`.
- Contract helpers use `DevsNeed` and `DevsProduces`.
- Repository maps Supabase snake_case rows to camelCase UI types.
- API routes return `{ data, meta }` envelopes consistent with existing routes.

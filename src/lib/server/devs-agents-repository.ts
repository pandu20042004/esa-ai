import "server-only";

import { createSafeContractKey } from "@/lib/esai/agent-contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  DevsAgent,
  DevsAgentVersion,
  DevsCompartment,
  DevsNeed,
  DevsProduces,
} from "@/types/esai";

type Row = Record<string, unknown>;

type PublishVersionInput = {
  userId: string;
  userAgentId: string;
  templateId?: string | null;
  versionNumber: number;
  skillContent: string;
  inputContracts: DevsNeed[];
  outputContracts: DevsProduces[];
  changeSummary?: string | null;
  revertedFromVersionId?: string | null;
};

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

export function mapUserAgentRow(row: Row): DevsAgent {
  const template = firstNestedRow(row.agent_templates);
  const activeVersion = firstNestedRow(row.agent_skill_versions);
  const draftUpdatedAt = asOptionalString(row.draft_updated_at);
  const hasDraft = Boolean(draftUpdatedAt);
  const publishedNeeds = asNeeds(activeVersion?.input_contracts);
  const publishedProduces = asProduces(activeVersion?.output_contracts);
  const draftNeeds = hasDraft
    ? asNeedsWithFallback(row.draft_input_contracts, activeVersion?.input_contracts)
    : publishedNeeds;
  const draftProduces = hasDraft
    ? asProducesWithFallback(row.draft_output_contracts, activeVersion?.output_contracts)
    : publishedProduces;
  const publishedSkillContent =
    asOptionalString(activeVersion?.skill_content) ??
    asOptionalString(template?.default_skill_content) ??
    "";
  const draftSkillContent = hasDraft
    ? asOptionalString(row.draft_skill_content) ?? publishedSkillContent
    : publishedSkillContent;

  return {
    id: String(row.id),
    compartmentId: String(row.compartment_id ?? ""),
    templateId: asOptionalString(row.template_id),
    templateKey: asOptionalString(template?.template_key),
    templateSourcePath: asOptionalString(template?.source_path),
    templateContentHash: asOptionalString(template?.content_hash),
    kind: row.template_id && !row.is_custom ? "template_copy" : "custom",
    state: draftUpdatedAt
      ? "draft"
      : publishedProduces.length > 0
        ? "published"
        : "not_pipeline_ready",
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    enabled: Boolean(row.enabled ?? true),
    archived: Boolean(row.archived),
    activeSkillVersionId: asOptionalString(row.active_skill_version_id),
    publishedSkillContent,
    draftSkillContent,
    draftNeeds,
    draftProduces,
    publishedNeeds,
    publishedProduces,
    draftUpdatedAt,
  };
}

export function mapVersionRow(row: Row): DevsAgentVersion {
  return {
    id: String(row.id),
    versionNumber: Number(row.version_number ?? 0),
    changeSummary: String(row.change_summary ?? ""),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at ?? ""),
  };
}

export function nextVersionNumber(rows: Row[]): number {
  if (rows.length === 0) return 1;
  return Math.max(...rows.map((row) => Number(row.version_number ?? 0))) + 1;
}

export function buildPublishVersionRow(input: PublishVersionInput) {
  return {
    user_id: input.userId,
    user_agent_id: input.userAgentId,
    template_id: input.templateId ?? null,
    version_number: input.versionNumber,
    skill_content: input.skillContent,
    input_contracts: input.inputContracts,
    output_contracts: input.outputContracts,
    change_summary: input.changeSummary ?? null,
    is_active: true,
    reverted_from_version_id: input.revertedFromVersionId ?? null,
  };
}

export function createDevsAgentsRepository(userId: string) {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("Supabase admin client is not configured.");
  }

  return {
    async listCompartments(): Promise<DevsCompartment[]> {
      const { data, error } = await supabase
        .from("compartments")
        .select("*")
        .eq("user_id", userId)
        .eq("archived", false)
        .order("sort_order", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => mapCompartmentRow(row as Row));
    },

    async createCompartment(name: string): Promise<DevsCompartment> {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Compartment name is required.");

      const { data, error } = await supabase
        .from("compartments")
        .insert({
          user_id: userId,
          name: trimmedName,
          slug: createSafeContractKey(trimmedName),
          archived: false,
        })
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return mapCompartmentRow(data as Row);
    },

    async updateCompartment(
      id: string,
      input: { name?: string; archived?: boolean },
    ): Promise<DevsCompartment | null> {
      const patch: Record<string, unknown> = {};

      if (input.name !== undefined) {
        const trimmedName = input.name.trim();
        if (!trimmedName) throw new Error("Compartment name is required.");
        patch.name = trimmedName;
        patch.slug = createSafeContractKey(trimmedName);
      }

      if (typeof input.archived === "boolean") {
        patch.archived = input.archived;
      }

      if (Object.keys(patch).length === 0) {
        const { data, error } = await supabase
          .from("compartments")
          .select("*")
          .eq("user_id", userId)
          .eq("id", id)
          .eq("is_default", false)
          .maybeSingle();

        if (error) throw new Error(error.message);
        return data ? mapCompartmentRow(data as Row) : null;
      }

      const { data, error } = await supabase
        .from("compartments")
        .update(patch)
        .eq("user_id", userId)
        .eq("id", id)
        .eq("is_default", false)
        .select("*")
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data ? mapCompartmentRow(data as Row) : null;
    },

    async listAgents(compartmentId?: string | null): Promise<DevsAgent[]> {
      let query = supabase
        .from("user_agents")
        .select(agentSelect)
        .eq("user_id", userId)
        .eq("archived", false);

      if (compartmentId) {
        query = query.eq("compartment_id", compartmentId);
      }

      const { data, error } = await query.order("sort_order", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => mapUserAgentRow(row as Row));
    },

    async getAgent(agentId: string): Promise<DevsAgent | null> {
      const { data, error } = await supabase
        .from("user_agents")
        .select(agentSelect)
        .eq("user_id", userId)
        .eq("id", agentId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data ? mapUserAgentRow(data as Row) : null;
    },

    async createAgent(input: {
      compartmentId: string;
      name: string;
      description?: string;
    }): Promise<DevsAgent> {
      const compartmentId = input.compartmentId.trim();
      const name = input.name.trim();

      if (!compartmentId) throw new Error("Compartment is required.");
      if (!name) throw new Error("Agent name is required.");

      const { data: compartment, error: compartmentError } = await supabase
        .from("compartments")
        .select("id")
        .eq("user_id", userId)
        .eq("id", compartmentId)
        .eq("archived", false)
        .maybeSingle();

      if (compartmentError) throw new Error(compartmentError.message);
      if (!compartment) throw new Error("Compartment not found.");

      const { data, error } = await supabase
        .from("user_agents")
        .insert({
          user_id: userId,
          compartment_id: compartmentId,
          name,
          description: input.description ?? "",
          is_custom: true,
          enabled: true,
          archived: false,
          draft_skill_content: "",
          draft_input_contracts: [],
          draft_output_contracts: [],
          draft_updated_at: new Date().toISOString(),
        })
        .select(agentSelect)
        .single();

      if (error) throw new Error(error.message);
      return mapUserAgentRow(data as Row);
    },

    async archiveAgent(agentId: string): Promise<void> {
      const { error } = await supabase
        .from("user_agents")
        .update({ archived: true })
        .eq("user_id", userId)
        .eq("id", agentId);

      if (error) throw new Error(error.message);
    },
  };
}

const agentSelect = `
  *,
  agent_templates(template_key, source_path, content_hash, default_skill_content),
  agent_skill_versions!user_agents_active_skill_version_id_fkey(
    id,
    skill_content,
    input_contracts,
    output_contracts
  )
`;

function firstNestedRow(value: unknown): Row | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return isRow(first) ? first : null;
  }

  return isRow(value) ? value : null;
}

function isRow(value: unknown): value is Row {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asNeeds(value: unknown): DevsNeed[] {
  return Array.isArray(value) ? (value as DevsNeed[]) : [];
}

function asProduces(value: unknown): DevsProduces[] {
  return Array.isArray(value) ? (value as DevsProduces[]) : [];
}

function asNeedsWithFallback(value: unknown, fallback: unknown): DevsNeed[] {
  return Array.isArray(value) ? (value as DevsNeed[]) : asNeeds(fallback);
}

function asProducesWithFallback(value: unknown, fallback: unknown): DevsProduces[] {
  return Array.isArray(value) ? (value as DevsProduces[]) : asProduces(fallback);
}

function asOptionalString(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}

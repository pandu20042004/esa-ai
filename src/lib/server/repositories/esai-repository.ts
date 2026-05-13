import {
  seedAgents,
  seedCalendarEvents,
  seedCompetitions,
  seedFiles,
  seedOutputVersions,
  seedValidityChecks,
} from "@/lib/esai/seed";
import { createApiEnvelope } from "@/lib/esai/api";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AgentDefinition, CalendarEvent, Competition, CompetitionFile, OutputVersion, ValidityCheck } from "@/types/esai";

type RepositoryOptions = {
  supabaseConfigured?: boolean;
  userId?: string | null;
};

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

function mapFile(row: Record<string, unknown>): CompetitionFile {
  return {
    id: String(row.id),
    competitionId: String(row.competition_id ?? ""),
    fileName: String(row.file_name ?? ""),
    fileRole: String(row.file_role ?? "stage_input") as CompetitionFile["fileRole"],
    fileSource: String(row.file_source ?? "user_upload") as CompetitionFile["fileSource"],
    sourceDetail: String(row.source_detail ?? row.file_source ?? ""),
    stageId: row.stage_id ? (String(row.stage_id) as CompetitionFile["stageId"]) : undefined,
    artifactKey: row.artifact_key ? String(row.artifact_key) : undefined,
    artifactRole: row.artifact_role ? String(row.artifact_role) : undefined,
    producerNodeId: row.producer_node_id ? String(row.producer_node_id) : undefined,
    producerAgentId: row.producer_agent_id ? String(row.producer_agent_id) : undefined,
    status: row.status ? (String(row.status) as CompetitionFile["status"]) : undefined,
    contentText: row.content_text ? String(row.content_text) : undefined,
    summaryText: row.summary_text ? String(row.summary_text) : undefined,
    approved: Boolean(row.approved) || row.status === "approved",
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapAgent(row: Record<string, unknown>): AgentDefinition {
  return {
    id: String(row.id),
    stageId: String(row.stage_key ?? "onboarding") as AgentDefinition["stageId"],
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    requiredInputRole: JSON.stringify(row.input_contracts ?? []),
    producedOutputRole: JSON.stringify(row.output_contracts ?? []),
    enabled: Boolean(row.enabled ?? true),
    isCustom: Boolean(row.is_custom),
  };
}

function mapCalendarEvent(row: Record<string, unknown>): CalendarEvent {
  return {
    id: String(row.id),
    competitionId: row.competition_id ? String(row.competition_id) : undefined,
    stageId: row.stage_id ? (String(row.stage_id) as CalendarEvent["stageId"]) : undefined,
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    startTime: String(row.start_time ?? new Date().toISOString()),
    endTime: String(row.end_time ?? row.start_time ?? new Date().toISOString()),
    category: String(row.category ?? "Personal") as CalendarEvent["category"],
    color: String(row.color ?? "accent") as CalendarEvent["color"],
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    source: String(row.source ?? "user") as CalendarEvent["source"],
  };
}

export function createEsaiRepository(options: RepositoryOptions = {}) {
  const supabaseConfigured = options.supabaseConfigured ?? isSupabaseAdminConfigured();
  const supabase = supabaseConfigured ? createSupabaseAdminClient() : null;
  const userId = options.userId ?? null;

  return {
    async listCompetitions() {
      if (supabase && userId) {
        const { data, error } = await supabase
          .from("competitions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) throw new Error(error.message);
        return createApiEnvelope((data ?? []).map(mapCompetition), { supabaseConfigured });
      }

      return createApiEnvelope(seedCompetitions, { supabaseConfigured });
    },

    async getCompetition(id: string) {
      if (supabase && userId) {
        const { data, error } = await supabase
          .from("competitions")
          .select("*")
          .eq("user_id", userId)
          .eq("id", id)
          .maybeSingle();

        if (error) throw new Error(error.message);
        return createApiEnvelope(data ? mapCompetition(data) : null, { supabaseConfigured });
      }

      const competition = seedCompetitions.find((item) => item.id === id) ?? null;
      return createApiEnvelope(competition, { supabaseConfigured });
    },

    async createCompetition(input: Partial<Competition>) {
      if (supabase && userId) {
        const { data, error } = await supabase
          .from("competitions")
          .insert({
            user_id: userId,
            title: input.title?.trim() || "New Competition",
            category: input.category?.trim() || "Essay",
            institution: input.institution?.trim() || null,
            deadline: input.deadline || null,
            registration_link: input.registrationLink || null,
            current_stage_id: "onboarding",
            status: "Setup",
            progress: 0,
          })
          .select("*")
          .single();

        if (error) throw new Error(error.message);
        return createApiEnvelope(mapCompetition(data), { supabaseConfigured });
      }

      const competition: Competition = {
        id: `comp-${Date.now()}`,
        title: input.title?.trim() || "New Competition",
        category: input.category?.trim() || "Essay",
        institution: input.institution?.trim() || "Institution",
        status: "Setup",
        progress: 0,
        deadline: input.deadline || new Date().toISOString().slice(0, 10),
        registrationLink: input.registrationLink,
        currentStageId: "onboarding",
      };

      return createApiEnvelope(competition, { supabaseConfigured });
    },

    async listFiles() {
      if (supabase && userId) {
        const { data, error } = await supabase
          .from("competition_files")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) throw new Error(error.message);
        return createApiEnvelope((data ?? []).map(mapFile), { supabaseConfigured });
      }

      return createApiEnvelope(seedFiles, { supabaseConfigured });
    },

    async getFile(id: string) {
      if (supabase && userId) {
        const { data, error } = await supabase
          .from("competition_files")
          .select("*")
          .eq("user_id", userId)
          .eq("id", id)
          .maybeSingle();

        if (error) throw new Error(error.message);
        return createApiEnvelope(data ? mapFile(data) : null, { supabaseConfigured });
      }

      return createApiEnvelope(seedFiles.find((file) => file.id === id) ?? null, { supabaseConfigured });
    },

    async listAgents() {
      if (supabase && userId) {
        const { data, error } = await supabase
          .from("user_agents")
          .select("*")
          .eq("user_id", userId)
          .eq("enabled", true)
          .order("sort_order", { ascending: true });

        if (error) throw new Error(error.message);
        return createApiEnvelope((data ?? []).map(mapAgent), { supabaseConfigured });
      }

      return createApiEnvelope(seedAgents, { supabaseConfigured });
    },

    async listCalendarEvents() {
      if (supabase && userId) {
        const { data, error } = await supabase
          .from("calendar_events")
          .select("*")
          .eq("user_id", userId)
          .order("start_time", { ascending: true });

        if (error) throw new Error(error.message);
        return createApiEnvelope((data ?? []).map(mapCalendarEvent), { supabaseConfigured });
      }

      return createApiEnvelope(seedCalendarEvents, { supabaseConfigured });
    },

    async createCalendarEvent(input: Partial<CalendarEvent>) {
      if (supabase && userId) {
        const { data, error } = await supabase
          .from("calendar_events")
          .insert({
            user_id: userId,
            competition_id: input.competitionId ?? null,
            stage_id: input.stageId ?? null,
            title: input.title?.trim() || "New event",
            description: input.description?.trim() || null,
            start_time: input.startTime || new Date().toISOString(),
            end_time: input.endTime || null,
            category: input.category || "Personal",
            color: input.color || "accent",
            tags: input.tags || ["personal"],
            source: input.source || "user",
          })
          .select("*")
          .single();

        if (error) throw new Error(error.message);
        return createApiEnvelope(mapCalendarEvent(data), { supabaseConfigured });
      }

      const now = new Date();
      const event: CalendarEvent = {
        id: `ev-${Date.now()}`,
        title: input.title?.trim() || "New event",
        description: input.description?.trim() || "User-created calendar event.",
        startTime: input.startTime || now.toISOString(),
        endTime: input.endTime || new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        category: input.category || "Personal",
        color: input.color || "accent",
        tags: input.tags || ["personal"],
        source: input.source || "user",
        competitionId: input.competitionId,
        stageId: input.stageId,
      };

      return createApiEnvelope(event, { supabaseConfigured });
    },

    async listOutputVersions() {
      if (supabase && userId) {
        const { data, error } = await supabase
          .from("output_versions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) throw new Error(error.message);
        return createApiEnvelope((data ?? []) as OutputVersion[], { supabaseConfigured });
      }

      return createApiEnvelope(seedOutputVersions, { supabaseConfigured });
    },

    async listValidityChecks() {
      if (supabase && userId) {
        const { data, error } = await supabase
          .from("validity_checks")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) throw new Error(error.message);
        return createApiEnvelope((data ?? []) as ValidityCheck[], { supabaseConfigured });
      }

      return createApiEnvelope(seedValidityChecks, { supabaseConfigured });
    },

    async listModels() {
      const { getAllAvailableModels } = await import("@/lib/server/cli-providers");
      const models = getAllAvailableModels();
      return createApiEnvelope(
        models.map((m) => ({ provider: m.provider, id: m.id, label: m.label })),
        { supabaseConfigured },
      );
    },
  };
}

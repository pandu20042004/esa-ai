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
import { extractText } from "@/lib/server/file-extraction";
import { toWebp } from "@/lib/server/image-processing";
import {
  uploadCompetitionAsset,
  deleteCompetitionAssets,
  signedCompetitionUrl,
  type AssetRole,
} from "@/lib/server/storage";

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
  const storagePath = storagePathByFileId.get(comp.posterFileId);
  if (!storagePath) return comp;
  const url = await signedCompetitionUrl(storagePath);
  return { ...comp, posterImageUrl: url ?? undefined };
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

    async listCompetitionFiles(competitionId: string) {
      if (supabase && userId) {
        const { data, error } = await supabase
          .from("competition_files")
          .select("*")
          .eq("user_id", userId)
          .eq("competition_id", competitionId)
          .order("created_at", { ascending: false });

        if (error) throw new Error(error.message);
        return createApiEnvelope((data ?? []).map(mapFile), { supabaseConfigured });
      }

      return createApiEnvelope([] as CompetitionFile[], { supabaseConfigured });
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

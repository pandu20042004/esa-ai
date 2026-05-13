import { z } from "zod";

import { errorResponse } from "@/lib/server/api-errors";
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  fromStageKey: z.string().trim().min(1),
});

/**
 * Direct-consumer stale cascade.
 * When a stage re-runs, the outputs produced by stages that *directly* consume
 * this stage's output are marked `status='stale'`. Non-recursive; each
 * downstream re-run handles its own cascade.
 */
export async function POST(request: Request, context: RouteContext<"/api/competitions/[id]/mark-stale">) {
  const { id } = await context.params;
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const supabase = createSupabaseAdminClient();
  if (!supabase) return errorResponse({ message: "Supabase admin not configured.", code: "ERR_NO_ADMIN", status: 500 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse({ message: "fromStageKey required.", code: "ERR_VALIDATION", status: 400 });
  }

  const { data: pipeline } = await supabase
    .from("competition_pipelines")
    .select("id")
    .eq("competition_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!pipeline) return Response.json({ data: { stale: [] } });

  const { data: fromNode } = await supabase
    .from("pipeline_nodes")
    .select("id")
    .eq("pipeline_id", pipeline.id)
    .eq("node_key", parsed.data.fromStageKey)
    .maybeSingle();
  if (!fromNode) return Response.json({ data: { stale: [] } });

  // Find direct consumer nodes.
  const { data: edges } = await supabase
    .from("pipeline_edges")
    .select("to_node_id")
    .eq("pipeline_id", pipeline.id)
    .eq("from_node_id", fromNode.id);

  const directConsumerNodeIds = Array.from(new Set((edges ?? []).map((e) => String(e.to_node_id))));
  if (directConsumerNodeIds.length === 0) return Response.json({ data: { stale: [] } });

  // Flip statuses.
  const { data: staled, error } = await supabase
    .from("competition_files")
    .update({ status: "stale", approved: false })
    .eq("user_id", user.id)
    .eq("competition_id", id)
    .in("producer_node_id", directConsumerNodeIds)
    .neq("status", "stale")
    .select("id, file_name, producer_node_id");
  if (error) return errorResponse({ message: error.message, code: "ERR_STALE_UPDATE", status: 500 });

  return Response.json({ data: { stale: staled ?? [] } });
}

import { errorResponse } from "@/lib/server/api-errors";
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Returns the current state of each pipeline stage for a competition:
 *   {
 *     stages: [
 *       { nodeKey: "onboarding", label: "...", status: "unlocked" | "locked" | "in_progress",
 *         outputFile: { id, fileName, status } | null,
 *         downstreamStageKeys: string[]
 *       }, ...
 *     ]
 *   }
 *
 * Used by the workbench to render locks, stale banners, and the re-run cascade modal.
 */
export async function GET(_request: Request, context: RouteContext<"/api/competitions/[id]/stage-state">) {
  const { id } = await context.params;
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  const supabase = createSupabaseAdminClient();
  if (!supabase) return errorResponse({ message: "Supabase admin not configured.", code: "ERR_NO_ADMIN", status: 500 });

  const { data: comp, error: cErr } = await supabase
    .from("competitions")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (cErr) return errorResponse({ message: cErr.message, code: "ERR_COMP_LOOKUP", status: 500 });
  if (!comp) return errorResponse({ message: "Competition not found.", code: "ERR_NOT_FOUND", status: 404 });

  const { data: pipeline } = await supabase
    .from("competition_pipelines")
    .select("id")
    .eq("competition_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!pipeline) return Response.json({ data: { stages: [] } });

  const { data: nodes, error: nErr } = await supabase
    .from("pipeline_nodes")
    .select("id, node_key, label, position_index")
    .eq("pipeline_id", pipeline.id)
    .order("position_index", { ascending: true });
  if (nErr) return errorResponse({ message: nErr.message, code: "ERR_NODES", status: 500 });

  const { data: edges } = await supabase
    .from("pipeline_edges")
    .select("from_node_id, to_node_id")
    .eq("pipeline_id", pipeline.id);

  const { data: files } = await supabase
    .from("competition_files")
    .select("id, file_name, status, producer_node_id, stage_id")
    .eq("competition_id", id)
    .eq("user_id", user.id);

  const nodeList = nodes ?? [];
  const fileByNode = new Map<string, { id: string; fileName: string; status: string }>();
  for (const f of files ?? []) {
    const producer = f.producer_node_id ? String(f.producer_node_id) : null;
    if (!producer) continue;
    const prev = fileByNode.get(producer);
    // keep most recent by id (uuid-ish lexical ok; otherwise by presence of approved)
    if (!prev || (f.status === "approved" && prev.status !== "approved")) {
      fileByNode.set(producer, { id: String(f.id), fileName: String(f.file_name), status: String(f.status ?? "draft") });
    }
  }

  const downstreamByNode = new Map<string, Set<string>>();
  for (const edge of edges ?? []) {
    if (!edge.from_node_id) continue;
    const set = downstreamByNode.get(String(edge.from_node_id)) ?? new Set();
    set.add(String(edge.to_node_id));
    downstreamByNode.set(String(edge.from_node_id), set);
  }

  // Compute stage status.
  const nodeIdToKey = new Map(nodeList.map((n) => [String(n.id), String(n.node_key)]));
  const stages = nodeList.map((node) => {
    const nodeId = String(node.id);
    const nodeKey = String(node.node_key);
    const output = fileByNode.get(nodeId) ?? null;

    // Stage unlocked if all predecessor edges point to approved outputs OR the node has no predecessors.
    let unlocked = true;
    for (const edge of edges ?? []) {
      if (String(edge.to_node_id) !== nodeId) continue;
      const predecessorId = edge.from_node_id ? String(edge.from_node_id) : null;
      if (!predecessorId) continue;
      const predFile = fileByNode.get(predecessorId);
      if (!predFile || predFile.status !== "approved") {
        unlocked = false;
        break;
      }
    }

    const downstreamNodeKeys = Array.from(downstreamByNode.get(nodeId) ?? []).map(
      (childId) => nodeIdToKey.get(childId) ?? childId,
    );

    return {
      nodeId,
      nodeKey,
      label: String(node.label ?? nodeKey),
      positionIndex: Number(node.position_index ?? 0),
      unlocked,
      outputFile: output,
      downstreamStageKeys: downstreamNodeKeys,
    };
  });

  return Response.json({ data: { pipelineId: String(pipeline.id), stages } });
}

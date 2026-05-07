import type {
  ArtifactContractEdge,
  ArtifactFile,
  ArtifactPipelineNode,
  NodeReadiness,
  ResolvedInputSource,
} from "@/types/esai";

function findEdgeForInput(node: ArtifactPipelineNode, edges: ArtifactContractEdge[], inputKey: string) {
  return edges.find((edge) => edge.toNodeId === node.id && edge.toInputKey === inputKey);
}

function findSourceFile(edge: ArtifactContractEdge, files: ArtifactFile[]) {
  if (edge.sourceFileId) {
    return files.find((file) => file.id === edge.sourceFileId) ?? null;
  }

  return (
    files.find(
      (file) =>
        file.producerNodeId === edge.fromNodeId &&
        file.artifactKey === edge.fromOutputKey,
    ) ?? null
  );
}

export function resolveNodeInputSources(
  node: ArtifactPipelineNode,
  edges: ArtifactContractEdge[],
  files: ArtifactFile[],
): ResolvedInputSource[] {
  return node.inputContracts.flatMap((input) => {
    const edge = findEdgeForInput(node, edges, input.key);
    if (!edge) return [];

    const sourceFile = findSourceFile(edge, files);
    if (!sourceFile) return [];

    return [
      {
        inputKey: input.key,
        sourceFileId: sourceFile.id,
        includeMode: input.includeMode,
      },
    ];
  });
}

export function validateNodeReadiness(
  node: ArtifactPipelineNode,
  edges: ArtifactContractEdge[],
  files: ArtifactFile[],
): NodeReadiness {
  const missingInputs: string[] = [];
  const unapprovedInputs: string[] = [];
  const incompatibleInputs: string[] = [];

  for (const input of node.inputContracts) {
    const edge = findEdgeForInput(node, edges, input.key);

    if (!edge) {
      if (input.required) missingInputs.push(input.key);
      continue;
    }

    const sourceFile = findSourceFile(edge, files);

    if (!sourceFile) {
      if (input.required) missingInputs.push(input.key);
      continue;
    }

    if (sourceFile.status !== "approved") {
      unapprovedInputs.push(input.key);
    }

    if (
      !edge.allowAnyFile &&
      sourceFile.artifactRole &&
      !input.acceptedRoles.includes(sourceFile.artifactRole)
    ) {
      incompatibleInputs.push(input.key);
    }
  }

  return {
    ready:
      missingInputs.length === 0 &&
      unapprovedInputs.length === 0 &&
      incompatibleInputs.length === 0,
    missingInputs,
    unapprovedInputs,
    incompatibleInputs,
  };
}

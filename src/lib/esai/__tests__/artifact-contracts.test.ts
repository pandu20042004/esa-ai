import { describe, expect, it } from "vitest";

import {
  resolveNodeInputSources,
  validateNodeReadiness,
} from "@/lib/esai/artifact-contracts";
import type {
  ArtifactContractEdge,
  ArtifactFile,
  ArtifactPipelineNode,
} from "@/types/esai";

const researchNode: ArtifactPipelineNode = {
  id: "node-research",
  inputContracts: [
    {
      key: "chosen_angle",
      acceptedRoles: ["ideation_output"],
      required: true,
      includeMode: "full",
    },
  ],
  outputContracts: [],
};

const edge: ArtifactContractEdge = {
  fromNodeId: "node-ideation",
  fromOutputKey: "ideation_options",
  toNodeId: "node-research",
  toInputKey: "chosen_angle",
  sourceType: "agent_output",
  required: true,
};

describe("artifact contract pipeline", () => {
  it("blocks a node until its connected source artifact is approved", () => {
    const files: ArtifactFile[] = [
      {
        id: "file-ideation",
        artifactKey: "ideation_options",
        artifactRole: "ideation_output",
        producerNodeId: "node-ideation",
        status: "draft",
      },
    ];

    expect(validateNodeReadiness(researchNode, [edge], files)).toEqual({
      ready: false,
      missingInputs: [],
      unapprovedInputs: ["chosen_angle"],
      incompatibleInputs: [],
    });
  });

  it("resolves connected sources by artifact key instead of filename", () => {
    const renamedFile: ArtifactFile = {
      id: "file-renamed",
      artifactKey: "ideation_options",
      artifactRole: "ideation_output",
      fileName: "my custom idea name.md",
      producerNodeId: "node-ideation",
      status: "approved",
    };

    expect(resolveNodeInputSources(researchNode, [edge], [renamedFile])).toEqual([
      {
        inputKey: "chosen_angle",
        sourceFileId: "file-renamed",
        includeMode: "full",
      },
    ]);

    expect(validateNodeReadiness(researchNode, [edge], [renamedFile]).ready).toBe(true);
  });
});

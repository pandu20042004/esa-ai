import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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
        id: "compartment-1",
        name: "Essay",
        slug: "essay",
        is_default: true,
        archived: false,
        sort_order: 20,
      }),
    ).toEqual({
      id: "compartment-1",
      name: "Essay",
      slug: "essay",
      isDefault: true,
      archived: false,
      sortOrder: 20,
    });
  });

  it("maps template-copy user agent rows with template and active version content", () => {
    expect(
      mapUserAgentRow({
        id: "agent-1",
        compartment_id: "compartment-1",
        template_id: "template-1",
        name: "Research Agent",
        description: "Researches evidence.",
        is_custom: false,
        enabled: true,
        archived: false,
        active_skill_version_id: "version-1",
        draft_skill_content: "draft skill",
        draft_input_contracts: [
          {
            key: "guidebook",
            label: "Guidebook",
            acceptedRoles: ["guidebook"],
            required: true,
            includeMode: "full",
          },
        ],
        draft_output_contracts: [
          {
            key: "research",
            label: "Research",
            role: "research_output",
          },
        ],
        draft_updated_at: "2026-05-08T01:00:00.000Z",
        agent_templates: {
          template_key: "research-agent",
          source_path: "skills/research-agent/SKILL.md",
          content_hash: "hash-1",
          default_skill_content: "template skill",
        },
        agent_skill_versions: [
          {
            id: "version-1",
            skill_content: "published skill",
            input_contracts: [
              {
                key: "style",
                label: "Style",
                acceptedRoles: ["style_profile"],
                required: false,
                includeMode: "summary",
              },
            ],
            output_contracts: [
              {
                key: "published_research",
                label: "Published research",
                role: "research_output",
              },
            ],
          },
        ],
      }),
    ).toMatchObject({
      id: "agent-1",
      compartmentId: "compartment-1",
      templateId: "template-1",
      kind: "template_copy",
      state: "draft",
      name: "Research Agent",
      description: "Researches evidence.",
      enabled: true,
      archived: false,
      activeSkillVersionId: "version-1",
      templateKey: "research-agent",
      templateSourcePath: "skills/research-agent/SKILL.md",
      templateContentHash: "hash-1",
      draftSkillContent: "draft skill",
      publishedSkillContent: "published skill",
      draftNeeds: [
        {
          key: "guidebook",
          label: "Guidebook",
          acceptedRoles: ["guidebook"],
          required: true,
          includeMode: "full",
        },
      ],
      draftProduces: [
        {
          key: "research",
          label: "Research",
          role: "research_output",
        },
      ],
      publishedNeeds: [
        {
          key: "style",
          label: "Style",
          acceptedRoles: ["style_profile"],
          required: false,
          includeMode: "summary",
        },
      ],
      publishedProduces: [
        {
          key: "published_research",
          label: "Published research",
          role: "research_output",
        },
      ],
      draftUpdatedAt: "2026-05-08T01:00:00.000Z",
    });
  });

  it("mirrors published contracts into draft shape when no draft exists", () => {
    const publishedNeeds = [
      {
        key: "guidebook",
        label: "Guidebook",
        acceptedRoles: ["guidebook"],
        required: true,
        includeMode: "full",
      },
    ];
    const publishedProduces = [
      {
        key: "research",
        label: "Research",
        role: "research_output",
      },
    ];

    const agent = mapUserAgentRow({
      id: "agent-2",
      compartment_id: "compartment-1",
      template_id: "template-1",
      name: "Published Agent",
      is_custom: false,
      active_skill_version_id: "version-2",
      draft_skill_content: null,
      draft_input_contracts: [],
      draft_output_contracts: [],
      draft_updated_at: null,
      agent_templates: {
        template_key: "published-agent",
        source_path: "skills/published-agent/SKILL.md",
        content_hash: "hash-2",
        default_skill_content: "template skill",
      },
      agent_skill_versions: {
        id: "version-2",
        skill_content: "published skill",
        input_contracts: publishedNeeds,
        output_contracts: publishedProduces,
      },
    });

    expect(agent.state).toBe("published");
    expect(agent.draftNeeds).toEqual(publishedNeeds);
    expect(agent.draftProduces).toEqual(publishedProduces);
  });

  it("returns the next publish version number", () => {
    expect(nextVersionNumber([])).toBe(1);
    expect(nextVersionNumber([{ version_number: 1 }, { version_number: 4 }])).toBe(5);
  });

  it("builds active publish version insert rows", () => {
    expect(
      buildPublishVersionRow({
        userId: "user-1",
        userAgentId: "agent-1",
        templateId: "template-1",
        versionNumber: 3,
        skillContent: "skill body",
        inputContracts: [
          {
            key: "guidebook",
            label: "Guidebook",
            acceptedRoles: ["guidebook"],
            required: true,
            includeMode: "full",
          },
        ],
        outputContracts: [
          {
            key: "draft",
            label: "Draft",
            role: "draft_output",
            defaultFilename: "draft.md",
          },
        ],
        changeSummary: "Publish draft edits.",
      }),
    ).toEqual({
      user_id: "user-1",
      user_agent_id: "agent-1",
      template_id: "template-1",
      version_number: 3,
      skill_content: "skill body",
      input_contracts: [
        {
          key: "guidebook",
          label: "Guidebook",
          acceptedRoles: ["guidebook"],
          required: true,
          includeMode: "full",
        },
      ],
      output_contracts: [
        {
          key: "draft",
          label: "Draft",
          role: "draft_output",
          defaultFilename: "draft.md",
        },
      ],
      change_summary: "Publish draft edits.",
      is_active: true,
      reverted_from_version_id: null,
    });
  });
});

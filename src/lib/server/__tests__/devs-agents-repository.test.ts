import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createDevsAgentsRepository,
  mapCompartmentRow,
  mapUserAgentRow,
  nextVersionNumber,
  parseNeeds,
  parseProduces,
} from "@/lib/server/devs-agents-repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

describe("devs agents repository helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("coerces contract defaults for valid needs and produces", () => {
    expect(parseNeeds([{ key: "guidebook" }])).toEqual([
      {
        key: "guidebook",
        label: "",
        acceptedRoles: [],
        required: false,
        includeMode: "full",
      },
    ]);

    expect(parseProduces([{ key: "draft", defaultFilename: "draft.md" }])).toEqual([
      {
        key: "draft",
        label: "",
        role: "",
        defaultFilename: "draft.md",
      },
    ]);
  });

  it("rejects malformed contract arrays", () => {
    expect(() => parseNeeds([{ key: "" }])).toThrow("Invalid input contracts.");
    expect(() => parseProduces([{ key: "draft", role: 123 }])).toThrow(
      "Invalid output contracts.",
    );
    expect(() => parseNeeds({ key: "guidebook" })).toThrow("Invalid input contracts.");
  });

  it("publishes with the expected locked-draft RPC arguments", async () => {
    const draftUpdatedAt = "2026-05-08T01:00:00.000Z";
    const draftRow = {
      id: "agent-1",
      compartment_id: "compartment-1",
      template_id: "template-1",
      name: "Draft Agent",
      description: "",
      is_custom: false,
      enabled: true,
      archived: false,
      draft_skill_content: "draft skill",
      draft_input_contracts: [],
      draft_output_contracts: [
        {
          key: "draft",
          label: "Draft",
          role: "draft_output",
        },
      ],
      draft_updated_at: draftUpdatedAt,
      agent_templates: null,
      agent_skill_versions: null,
    };
    const publishedRow = {
      ...draftRow,
      active_skill_version_id: "version-1",
      draft_updated_at: null,
      agent_skill_versions: {
        id: "version-1",
        skill_content: "draft skill",
        input_contracts: [],
        output_contracts: draftRow.draft_output_contracts,
      },
    };
    const getDraftBuilder = createMaybeSingleBuilder(draftRow);
    const listBuilder = createOrderBuilder([draftRow]);
    const getPublishedBuilder = createMaybeSingleBuilder(publishedRow);
    const rpc = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce(getDraftBuilder)
        .mockReturnValueOnce(listBuilder)
        .mockReturnValueOnce(getPublishedBuilder),
      rpc,
    } as never);

    await createDevsAgentsRepository("user-1").publishDraft("agent-1", "  Publish edits.  ");

    expect(rpc).toHaveBeenCalledWith("publish_agent_skill_version", {
      p_user_id: "user-1",
      p_user_agent_id: "agent-1",
      p_expected_draft_updated_at: draftUpdatedAt,
      p_change_summary: "Publish edits.",
    });
  });

  it("rejects publishing when no draft exists", async () => {
    const publishedRow = {
      id: "agent-1",
      compartment_id: "compartment-1",
      template_id: "template-1",
      name: "Published Agent",
      description: "",
      is_custom: false,
      enabled: true,
      archived: false,
      active_skill_version_id: "version-1",
      draft_skill_content: null,
      draft_input_contracts: [],
      draft_output_contracts: [],
      draft_updated_at: null,
      agent_templates: null,
      agent_skill_versions: {
        id: "version-1",
        skill_content: "published skill",
        input_contracts: [],
        output_contracts: [
          {
            key: "draft",
            label: "Draft",
            role: "draft_output",
          },
        ],
      },
    };
    const rpc = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce(createMaybeSingleBuilder(publishedRow))
        .mockReturnValueOnce(createOrderBuilder([publishedRow]))
        .mockReturnValueOnce(createMaybeSingleBuilder(publishedRow)),
      rpc,
    } as never);

    await expect(createDevsAgentsRepository("user-1").publishDraft("agent-1")).rejects.toThrow(
      "No draft to publish.",
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});

function createMaybeSingleBuilder(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

function createOrderBuilder(data: unknown[]) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

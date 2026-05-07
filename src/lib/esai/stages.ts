import type { StageDefinition } from "@/types/esai";

export const STAGES: StageDefinition[] = [
  {
    id: "onboarding",
    label: "Main Agent Onboarding",
    input: "00_style_profile.md + guidebook",
    output: "01_onboarding_map.md",
    rule: "Style profile and guidebook are required before rules, rubric, deadline, and scope can be mapped.",
    index: 0,
  },
  {
    id: "ideation",
    label: "Ideation",
    input: "01_onboarding_map.md",
    output: "02_ideation_options.md",
    rule: "Runs after onboarding confirms the competition rules and writing style context.",
    index: 1,
  },
  {
    id: "research",
    label: "Research",
    input: "02_ideation_options.md",
    output: "03_research_brief.md",
    rule: "Research follows the chosen idea angle instead of broad random topics.",
    index: 2,
  },
  {
    id: "writing",
    label: "Writing",
    input: "03_research_brief.md + optional essay draft",
    output: "04_draft_essay.md",
    rule: "Turns verified research and any uploaded essay draft into a structured revision.",
    index: 3,
  },
  {
    id: "flowchart",
    label: "Flowchart",
    input: "04_draft_essay.md",
    output: "05_flowchart.png",
    rule: "Extracts the concept flow only after the draft argument is stable.",
    index: 4,
  },
  {
    id: "prototype",
    label: "Prototype",
    input: "05_flowchart.png",
    output: "06_prototype_spec.html",
    rule: "Builds the physical or digital prototype from the approved concept flow.",
    index: 5,
  },
  {
    id: "ui",
    label: "UI Design",
    input: "06_prototype_spec.html",
    output: "07_ui_mockup.html",
    rule: "Creates visual screens only after prototype behavior is defined.",
    index: 6,
  },
  {
    id: "supervisor",
    label: "Supervisor",
    input: "04_draft_essay.md + outputs",
    output: "08_supervisor_review.md",
    rule: "Final judge-style review that can see all previous stage outputs.",
    index: 7,
  },
];

export const stageById = new Map(STAGES.map((stage) => [stage.id, stage]));


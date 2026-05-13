export type StageId =
  | "onboarding"
  | "ideation"
  | "research"
  | "writing"
  | "flowchart"
  | "prototype"
  | "ui"
  | "supervisor";

export type StageStatus = "completed" | "active" | "locked";

export type FileSource = "user_upload" | "agent_output" | "devs" | "system_template";
export type ArtifactStatus = "draft" | "needs_review" | "approved" | "rejected";
export type ArtifactIncludeMode = "full" | "summary" | "metadata";

export type FileRole =
  | "guidebook"
  | "poster"
  | "twibbon"
  | "user_photo"
  | "style_profile"
  | "stage_input"
  | "stage_output"
  | "research_output"
  | "final_output"
  | "journal_pdf"
  | "citation_evidence"
  | "registration_link";

export type CalendarCategory = "Deadline" | "Stage" | "Asset" | "Review" | "Personal";

export type ReasoningEffort = "low" | "medium" | "high" | "xhigh";

export type StageDefinition = {
  id: StageId;
  label: string;
  input: string;
  output: string;
  rule: string;
  index: number;
};

export type Competition = {
  id: string;
  title: string;
  category: string;
  institution: string;
  status: string;
  progress: number;
  deadline: string;           // ISO date
  registrationLink?: string;
  currentStageId: StageId;
  posterFileId?: string;      // FK to competition_files
  posterImageUrl?: string;    // 1-hour signed URL, filled by API
  guidebookFileId?: string;   // computed from competition_files (role=guidebook) for convenience
  twibbonFileId?: string;
  userPhotoFileId?: string;
  combinedAssetFileId?: string;
  twibbonImageUrl?: string;
  userPhotoImageUrl?: string;
  combinedAssetImageUrl?: string;
  instagramCaption?: string;
  createdAt?: string;
};

export type CompetitionFile = {
  id: string;
  competitionId: string;
  fileName: string;
  fileRole: FileRole;
  fileSource: FileSource;
  sourceDetail: string;
  stageId?: StageId;
  artifactKey?: string;
  artifactRole?: string;
  producerNodeId?: string;
  producerAgentId?: string;
  status?: ArtifactStatus;
  contentText?: string;
  summaryText?: string;
  approved: boolean;
  createdAt: string;
};

export type ArtifactInputContract = {
  key: string;
  label?: string;
  acceptedRoles: string[];
  required: boolean;
  includeMode: ArtifactIncludeMode;
};

export type ArtifactOutputContract = {
  key: string;
  label?: string;
  role: string;
  defaultFilename?: string;
};

export type ArtifactPipelineNode = {
  id: string;
  inputContracts: ArtifactInputContract[];
  outputContracts: ArtifactOutputContract[];
};

export type ArtifactContractEdge = {
  fromNodeId?: string;
  fromOutputKey?: string;
  toNodeId: string;
  toInputKey: string;
  sourceType: FileSource;
  sourceFileId?: string;
  required: boolean;
  allowAnyFile?: boolean;
};

export type ArtifactFile = {
  id: string;
  artifactKey?: string;
  artifactRole?: string;
  fileName?: string;
  producerNodeId?: string;
  status: ArtifactStatus;
};

export type ResolvedInputSource = {
  inputKey: string;
  sourceFileId: string;
  includeMode: ArtifactIncludeMode;
};

export type NodeReadiness = {
  ready: boolean;
  missingInputs: string[];
  unapprovedInputs: string[];
  incompatibleInputs: string[];
};

export type DevsAgentKind = "template_copy" | "custom";
export type DevsAgentState = "draft" | "published" | "not_pipeline_ready";

export type DevsNeed = {
  key: string;
  label: string;
  acceptedRoles: string[];
  required: boolean;
  includeMode: ArtifactIncludeMode;
};

export type DevsProduces = {
  key: string;
  label: string;
  role: string;
  defaultFilename?: string;
};

export type DevsCompartment = {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  archived: boolean;
  sortOrder: number;
};

export type DevsAgentVersion = {
  id: string;
  versionNumber: number;
  changeSummary: string;
  isActive: boolean;
  createdAt: string;
};

export type DevsAgent = {
  id: string;
  compartmentId: string;
  templateId?: string;
  templateKey?: string;
  templateSourcePath?: string;
  templateContentHash?: string;
  kind: DevsAgentKind;
  state: DevsAgentState;
  name: string;
  description: string;
  enabled: boolean;
  archived: boolean;
  activeSkillVersionId?: string;
  publishedSkillContent: string;
  draftSkillContent: string;
  draftNeeds: DevsNeed[];
  draftProduces: DevsProduces[];
  publishedNeeds: DevsNeed[];
  publishedProduces: DevsProduces[];
  draftUpdatedAt?: string;
};

export type DevsAgentValidation = {
  blocking: string[];
  warnings: string[];
  pipelineReady: boolean;
};

export type AgentDefinition = {
  id: string;
  stageId: StageId;
  name: string;
  description: string;
  requiredInputRole: string;
  producedOutputRole: string;
  enabled: boolean;
  isCustom: boolean;
};

export type AgentRun = {
  id: string;
  competitionId: string;
  agentId: string;
  stageId: StageId;
  status: "idle" | "needs_choice" | "running" | "completed" | "failed";
  modelId?: string;
  reasoningEffort?: ReasoningEffort;
  inputFileIds: string[];
  outputFileId?: string;
  needsUserChoice?: AgentChoicePrompt;
  selectedChoice?: AgentChoiceOption;
};

export type AgentChoiceOption = {
  key: "A" | "B" | "C";
  label: string;
  detail: string;
  result: string;
};

export type AgentChoicePrompt = {
  question: string;
  options: AgentChoiceOption[];
};

export type CalendarEvent = {
  id: string;
  competitionId?: string;
  stageId?: StageId;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  category: CalendarCategory;
  color: "accent" | "neutral" | "warn" | "danger";
  tags: string[];
  source: "competition_deadline" | "guidebook" | "user" | "agent" | "review";
};

export type OutputVersion = {
  id: string;
  fileId: string;
  versionNumber: number;
  contentText: string;
  changeSummary: string;
  createdAt: string;
};

export type ValidityCheck = {
  id: string;
  competitionId: string;
  outputFileId: string;
  journalFileId: string;
  selectedClaim: string;
  verdict: "supported" | "partially_supported" | "risk";
  evidenceText?: string;
  riskReason?: string;
};

export type BackendMode = "supabase" | "mock";

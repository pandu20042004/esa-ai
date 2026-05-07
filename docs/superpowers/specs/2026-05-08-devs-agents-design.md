# Devs Agents Design

Date: 2026-05-08
App root: `D:\Esa.Ai\web`
Status: approved design for the Devs -> Agents slice

## Goal

Replace the current small Custom Agents box in Devs -> Agents with a Supabase-backed agent management workspace. This slice covers agent configuration only. Workflow Pipeline, pipeline execution, background jobs, and runtime ordering are deferred to separate future specs.

The feature must be usable by non-technical users. Users can customize template agents, create custom agents, save drafts, publish versions, manage Needs/Produces metadata, and use an AI assistant to help configure agents.

## Scope

In scope:

- Devs -> Agents tab only.
- Supabase-backed compartments.
- Supabase-backed user agent list.
- Agent prompt draft editor.
- Draft auto-save to Supabase.
- Publish version flow.
- Version history and revert behavior.
- Structured Needs/Produces editor.
- Custom agent creation.
- Template-agent private copies.
- AI Assistant tab that can propose and apply draft changes after user approval.
- Plain-language validation and readiness warnings.

Out of scope:

- Workflow Pipeline UI.
- Pipeline drag/reorder.
- Pipeline edge mapping.
- Agent runtime execution.
- Background worker execution.
- Notifications.
- File upload purpose modal.

Those are intentionally deferred because they depend on stable agent configuration first.

## User Model

There are two agent sources:

- Global template: the built-in baseline synced from `web/skills` into `agent_templates`.
- User agent: a private copy stored in `user_agents`, owned by one user and one compartment.

Users never edit the global template directly. When they edit a template agent, they edit their private user copy. Runtime must use the active published `agent_skill_versions` row for that user agent, not the original global template.

Global templates are used only for:

- first sync/copy
- revert to built-in template
- comparison view

## Layout

The existing Devs page keeps its current tab structure:

- Style Builder
- Agents
- Settings
- BYOK Models

Only the Agents tab changes.

The Agents tab becomes a three-area workspace:

- Top bar: compartment selector, `+ Compartment`, `+ New Agent`
- Left panel: agents in the selected compartment
- Center panel: main prompt editor
- Right panel: tabs for Assistant, Needs / Produces, Versions, and Template

The current single-line "Custom Agents" form is removed.

## Compartments

The top bar shows the selected compartment. Default compartments are:

- Essay
- KTI
- Business Plan
- PKM

Users can create custom compartments from this tab. Users can rename and archive custom compartments.

Default compartments can be archived/hidden, but not renamed. This keeps template loading predictable.

Empty compartments show:

- `Load template agents`
- `+ New custom agent`

For this slice, loading templates can copy available template agents into the selected compartment. Full pipeline template loading belongs to the future Workflow Pipeline spec.

## Agent List

The left panel lists user agents in the selected compartment.

Each row shows:

- agent name
- short description
- type badge: `Template copy` or `Custom`
- state badge: `Draft`, `Published`, or `Not pipeline-ready`

Template copies and custom agents are mixed in the same list. Supabase and infrastructure skills are hidden. Style profile remains in Style Builder, not Agents.

Available row actions:

- select
- duplicate as custom agent
- archive from compartment

Deleting the global template is impossible because users only see private copies.

## Prompt Editor

The center panel is the main editor for the agent prompt/skill content.

Rules:

- Draft changes auto-save to Supabase.
- Runtime continues using the active published version.
- Draft does not affect runtime until published.
- The editor supports template copies and custom agents.
- Custom agents can be saved with only name and compartment.
- Custom agents require prompt content and at least one Produces item before publish.

Draft fields live on `user_agents`:

- `draft_skill_content`
- `draft_input_contracts`
- `draft_output_contracts`
- `draft_updated_at`

Publishing creates a new `agent_skill_versions` row and sets `user_agents.active_skill_version_id`.

## Plain-Language Contracts

The UI must avoid technical contract language by default.

Use these labels:

- `Needs`
- `Accepts outputs labeled`
- `Use full file / summary / details only`
- `Produces`
- `Output label`
- `Suggested filename`

Do not use these labels in the primary UI:

- input contract
- output contract
- artifactRole
- acceptedRoles
- JSON

Technical fields can appear in an advanced expandable section.

### Needs

A Need describes what the agent requires before it can run.

Fields:

- key: stable internal key, advanced field
- label: friendly name
- accepts outputs labeled: one or more artifact roles
- required: whether the need blocks execution
- include mode: full file, summary, or details only

Example:

- Needs: Research brief
- Accepts outputs labeled: Research output
- Use: Full file

Advanced view:

- key: `research_brief`
- accepted role: `research_output`
- include mode: `full`

### Produces

A Produces item describes what the agent creates.

Fields:

- key: stable internal key, advanced field
- label: friendly name
- output label: artifact role assigned to produced result
- suggested filename: display/export suggestion only

Example:

- Produces: Essay draft
- Output label: Draft output
- Suggested filename: `03_essay_draft.md`

Advanced view:

- key: `draft_essay`
- role: `draft_output`

Filenames never determine output labels. Users may name a file `research_output.md`, but the app must still use the stored output label/role, not the filename.

## Controlled Output Labels

The app should prefer a controlled list so future pipeline connections can match outputs reliably:

- `guidebook`
- `style_profile`
- `ideation_output`
- `research_output`
- `draft_output`
- `flowchart_output`
- `parts_list_output`
- `prototype_output`
- `ui_mockup_output`
- `supervisor_review`
- `final_output`
- `citation_evidence`

Custom labels are allowed. If a custom label is not produced or accepted by any other agent in the compartment, the UI warns in plain language:

`No other agent currently uses this output label. This agent can be saved, but it may not connect automatically in a future pipeline.`

Custom labels connect by matching:

- one agent Produces an output label
- another agent Needs that same label in Accepts outputs labeled

## Validation

Validation runs while editing and before publish.

Publishing is blocked when:

- prompt is empty
- no Produces item exists
- duplicate Need keys exist
- duplicate Produces keys exist
- a Produces item has no output label
- a required Need has no accepted output labels
- a key has unsafe characters

Safe key format:

`lowercase_letters_numbers_underscore`

Examples:

- `research_brief`
- `draft_essay`
- `guidebook`

Warnings, not hard blocks:

- custom output label does not connect to any known or existing label
- edited contracts may affect active pipelines
- agent is published but not pipeline-ready

Pipeline-specific blocking is deferred until Workflow Pipeline work, but the Devs UI should already show plain warnings if it can detect obvious issues.

Citation-related labels stay strict. `citation_evidence` and research-like labels should not be silently downgraded or treated as generic attachments.

## Publish Flow

User edits prompt and Needs/Produces in draft.

When user clicks `Publish version`, the app opens a modal showing:

- optional change summary
- validation errors
- warnings
- plain-language summary of what will change

If there are no blocking errors, publishing:

- creates version `N+1`
- stores prompt and Needs/Produces on `agent_skill_versions`
- marks the new version active
- updates `user_agents.active_skill_version_id`
- keeps version history

Runtime immediately uses the new active version after publish.

## Version History

The Versions tab shows:

- version number
- created time
- change summary
- active marker

Revert behavior:

- Revert does not delete history.
- Reverting to an old version creates a new version copied from the selected version.
- Reverting to built-in template creates a new version copied from `agent_templates.default_skill_content`.
- If the user does not enter a change summary, the app generates one, such as `Reverted to version 2` or `Reverted to built-in template`.

## Template Tab

The Template tab appears for template copies.

It shows:

- built-in template name
- source path
- current template hash
- read-only built-in content preview
- action: revert to built-in template

For custom agents, this tab can show:

- `This is a custom agent. It is not linked to a built-in template.`

## AI Assistant Tab

The Assistant tab helps non-technical users configure agents.

User can describe the agent in normal language, for example:

- `This agent checks citation validity before final submission.`
- `This agent needs research brief and produces essay draft.`

Assistant can suggest:

- prompt structure
- Needs
- Produces
- output labels
- pipeline-readiness fixes
- plain-language explanation of warnings

Rules:

- Assistant uses the same model/provider selection path as agent chat.
- If no model is selected/configured, the panel says: `Choose a model first.`
- Local CLI providers work only when `ENABLE_LOCAL_CLI_PROVIDERS=true`.
- Assistant never publishes.
- Assistant can modify draft only after user clicks `Apply`.
- Before applying, the UI shows a preview/diff and plain-language explanation.
- Applied changes update draft fields only.

The Assistant should prefer controlled output labels. It may propose a custom label if needed and must explain that the label must be accepted by another agent or chosen during upload to connect in a future pipeline.

## API Design

Use Supabase-backed API routes for this slice.

Recommended endpoints:

- `GET /api/agents?compartmentId=...`
- `POST /api/agents`
- `GET /api/agents/[id]`
- `PATCH /api/agents/[id]/draft`
- `POST /api/agents/[id]/publish`
- `POST /api/agents/[id]/revert`
- `GET /api/agents/[id]/versions`
- `GET /api/compartments`
- `POST /api/compartments`
- `PATCH /api/compartments/[id]`
- `POST /api/agent-draft-assistant`

The existing `/api/agents` mock POST must be replaced with real Supabase persistence.

All routes validate ownership server-side through the current request user.

## Database Changes

Add draft fields to `user_agents`:

- `draft_skill_content text`
- `draft_input_contracts jsonb not null default '[]'::jsonb`
- `draft_output_contracts jsonb not null default '[]'::jsonb`
- `draft_updated_at timestamptz`
- `archived boolean not null default false`

If implementation finds an existing `archived` column, reuse it rather than adding another state column.

No schema changes are needed for published versions because `agent_skill_versions` already stores:

- `skill_content`
- `input_contracts`
- `output_contracts`
- `version_number`
- `change_summary`
- `is_active`

## Error Handling

Use plain-language errors.

Examples:

- `Agent name is required.`
- `Add at least one Produces item before publishing.`
- `Research brief accepts no output labels yet. Add one so the app knows what can feed it.`
- `This key is used by advanced workflow settings. Rename carefully.`
- `Choose a model before using the Assistant.`

Raw database errors should not be shown directly to users.

## Testing

Add focused tests for:

- contract validation
- safe key generation
- publish version creation
- revert creates a new version
- custom agent can be saved as draft with only name and compartment
- publish blocks empty prompt
- publish blocks missing Produces
- Supabase route helpers map database rows into UI-friendly labels

Manual verification:

- synced Essay agents appear in Devs -> Agents
- default compartments appear
- custom compartment can be created
- custom agent can be saved as draft
- template copy can be edited as draft
- publish creates active version
- revert creates another active version
- Assistant blocks when no model is selected

## Acceptance Criteria

- Devs -> Agents no longer uses dummy/local-only agent state.
- The current user sees only their own compartments and agents.
- Essay compartment shows the synced Essay agents.
- Supabase/infrastructure skills are hidden.
- Style profile remains outside Agents.
- User can create a custom agent in a compartment.
- User can auto-save prompt and Needs/Produces draft to Supabase.
- User can publish an agent version.
- Runtime-facing data points to the user's active published version.
- User can view version history.
- User can revert to a previous version or built-in template without deleting history.
- Users see plain-language Needs/Produces UI, with technical details hidden by default.
- AI Assistant can propose changes and apply them to draft only after user clicks Apply.
- No Workflow Pipeline behavior is implemented in this slice.

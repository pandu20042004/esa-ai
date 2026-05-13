# Esa.Ai Devs Agents User Guide

This guide explains how to test and use the Devs Agents editor.

## What This Feature Does

Devs Agents lets you customize the AI agents used by a competition workflow. A user can create a compartment, add agents to that compartment, edit each agent prompt, define what the agent needs, define what the agent produces, save drafts, publish versions, and restore older versions.

The important idea is simple:

- An agent prompt tells the AI what to do.
- Needs tells the app what previous output this agent requires.
- Produces tells the app what output label this agent will create.
- The filename is only a suggested file name. The workflow connection uses labels, not filenames.

## Basic Workflow

1. Open the app.
2. Go to Devs.
3. Open the Agents tab.
4. Pick a compartment, or create a new one.
5. Create or select an agent.
6. Write the agent prompt.
7. Open Needs / Produces.
8. Add at least one Produces item.
9. Publish the version.
10. Check Versions when you want to restore an older published version into draft.

## Compartment

A compartment is a group of agents. For example, you can have:

- Essay
- KTI
- Business Plan
- Test Compartment

When a user loads a compartment later in the workflow, only the agents inside that compartment should be available.

How to test:

1. Click Compartment.
2. Type a name such as Test Compartment.
3. Click Create compartment.
4. Confirm the dropdown changes to the new compartment.
5. Confirm the agent list is empty until you create an agent.

## Creating A Custom Agent

1. Click New Agent.
2. Type an agent name, for example Test Writer.
3. Click Create agent.
4. The agent appears in the left list.
5. The main prompt editor opens.

Minimum draft data:

- Agent name
- Compartment

Minimum publish data:

- Non-empty prompt
- At least one Produces item

## Prompt Editor

The big text box is the prompt editor. This is where the user writes what the agent should do.

Example:

```text
You are a writing agent. Use the research brief to draft a clear Indonesian essay.
Keep citations strict and do not invent sources.
```

The editor auto-saves as draft. The app should not publish automatically.

How to test:

1. Type quickly in the prompt box.
2. Confirm typing stays responsive.
3. Wait a moment.
4. Confirm the draft saved notice appears.
5. Refresh the page.
6. Confirm the prompt is still there.

## Needs

Needs means: what this agent must receive before it can run.

Example:

If a Writing Agent needs research first, add a Need like:

- Need name: Research brief
- Accepts outputs labeled: Research output
- Required before this agent can run: checked
- Include as: Summary or Full file

Use Summary when the agent only needs the key points. Use Full file when the agent must read the complete document.

## Produces

Produces means: what this agent creates.

Example:

For a Writing Agent:

- Output name: Essay draft
- Output label: Draft output
- Suggested filename: essay_draft.md

The output label is the important workflow connector. The filename can change later and the pipeline should still work.

## How Agents Connect

Agents connect by output labels.

Example:

1. Research Agent produces Research output.
2. Writing Agent has a Need that accepts Research output.
3. The app can connect Research Agent to Writing Agent.

The user can rename files freely. The connection still works because it uses the output label, not the file name.

## Publishing

Publishing makes the current draft the active version.

Click Publish version only after:

- Prompt is filled.
- Produces has at least one item.
- Needs are correct if the agent depends on previous output.

If the app shows a red warning, fix that first.

## Versions

Every publish creates a new version. Older versions stay in history.

To restore:

1. Open Versions.
2. Find a previous version.
3. Click Copy to draft.
4. Review the draft.
5. Publish only if you want it active again.

Copy to draft does not delete history.

## Template Restore

Built-in template agents can be customized. If the user wants to go back to the original built-in version:

1. Select a template-copy agent.
2. Open Template.
3. Click Copy built-in template to draft.
4. Review the draft.
5. Publish if it should become active.

Custom agents do not have a built-in template to restore.

## Common Warnings

Prompt is empty.

Fix: write the agent prompt.

Add at least one Produces item before publishing.

Fix: open Needs / Produces and add an output.

New input accepts no output labels yet.

Fix: either choose at least one accepted output label or remove that Need.

Duplicate key.

Fix: use a different Stable key. Usually the app creates safe keys automatically.

## Recommended First Test

1. Create Test Compartment.
2. Create Test Researcher.
3. Add prompt: Create a concise research brief.
4. Add Produces: Research brief, Research output, research_brief.md.
5. Publish.
6. Create Test Writer.
7. Add prompt: Write an essay draft from the research brief.
8. Add Needs: Research brief, accepts Research output.
9. Add Produces: Essay draft, Draft output, essay_draft.md.
10. Publish.

This creates a simple two-agent chain:

Researcher produces Research output. Writer accepts Research output and produces Draft output.


# Main Agent — Reference

Detailed specifications for the Main Agent skill.

---

## 1. The two modes

### Interactive mode (default)

- Every checkpoint in every downstream skill behaves normally
- User answers each question in real time
- Main Agent's role: routing + progress tracking
- No session state file written
- No email sent
- No flags injected (flags are a Full Automation feature)

Use cases: first time using a skill, learning what it does, high-stakes competitions where you want to review every choice, mid-day work when you're at the keyboard.

### Full Automation mode

- Every checkpoint auto-decided with best judgment per section 4
- Main Agent runs the requested pipeline start to finish
- Session state file written continuously
- Flags injected into output files using highlighting (section 3)
- Consolidated `00_automation_log_*.md` produced at end
- Email sent on completion or hard block

Use cases: overnight runs, time-pressed deadlines, second/third competitions of the same week where you trust the suite, low-stakes practice runs.

### Mode is per-session, not per-skill

Once Full Automation is on, every skill in the requested pipeline runs in auto mode for that session. The user does not toggle per-skill within a session — that adds confusion. To run one skill manually after others have run automatically, the user starts a new Interactive-mode session.

---

## 2. Hard floors that bypass even Full Automation

These four behaviors are absolute. Full Automation does not relax them.

### Floor 1 — Citation fabrication is forbidden

If a downstream skill (typically Writing Agent) would normally stop and ask "I want to cite this claim but have no Claim ID — what do you want?", the auto-mode behavior is:
- Insert `[MISSING_CITATION: brief description of the claim]` inline at the claim location
- Add a 🔴 flag to that section
- Continue drafting

The skill never invents a DOI, never makes up an author, never silently drops the claim. The flag forces the user to resolve every missing citation before submission.

### Floor 2 — Disqualifying-severity issues are surfaced

Any of the following are flagged 🔴 and listed prominently in the automation log:
- Word count violates guidebook (under minimum or over maximum)
- A required section per the guidebook is missing
- Plagiarism risk detected (verbatim long passages from a source)
- Format violation that would disqualify the entry

Auto-mode does not "fix" disqualifying issues by aggressive editing — it surfaces them so the user can choose how to address them.

### Floor 3 — Hard blockers stop the pipeline

If a skill genuinely cannot proceed (Tier 1 in section 5), Full Automation stops, saves session state, and emails the user with resume instructions. It does not skip the blocked skill and continue downstream.

### Floor 4 — Auto-decided severities default to the most cautious tier on uncertainty

If the Main Agent is unsure whether a decision is 🟢 / 🟡 / 🔴, it defaults to 🔴. False positives (over-flagging) are recoverable; false negatives (under-flagging) hide problems.

---

## 3. Flag system — inline markers + text highlighting

### Severity tiers

- 🔴 **Must review** — decision was uncertain, alternatives close, or something unusual occurred
- 🟡 **Should review** — defensible decision but non-obvious; user might prefer differently
- 🟢 **FYI only** — obvious default, listed for transparency only

### Inline flag format (in markdown output files)

Place the flag marker immediately above or beside the affected content. The format includes a marker, the decision summary, alternatives considered, and the rationale.

```markdown
<!-- 🔴 AUTO-FLAG [F-0042]
DECISION: Descended from A-quality to B-quality sources for SC3 (rural learning network outcomes).
ALTERNATIVES TRIED: 5 academic queries on Indonesian rural digital literacy 2023–2026 returned no peer-reviewed results matching the specific claim.
WHY: Continued the workflow rather than stop; B-quality SMERU report is credible.
REVIEW IF: You have access to the BPS 2025 microdata or know an Indonesian academic study not indexed in standard search.
LOCATION: 02_research_main.md, SC3 evidence section
-->
```

The HTML comment is invisible in rendered markdown but visible in editors. The `[F-####]` ID is sequential across the session and matches an entry in `00_automation_log.md`.

### Text highlighting in markdown

When the flag refers to a specific passage in the file (a sentence, a paragraph, a citation, an image slot), wrap the affected text with a highlight marker:

```markdown
<mark data-flag="F-0042" data-severity="must-review">The community-led learning programs in rural Java showed substantial improvement in literacy outcomes.</mark><!-- 🔴 F-0042 -->
```

The `<mark>` tag renders as highlighted text in any markdown viewer that supports HTML (most do, including GitHub, VS Code preview, Typora, Obsidian). The `data-severity` attribute can be styled with CSS for color coding:
- `must-review` → red/pink highlight
- `should-review` → yellow highlight
- `fyi-only` → light gray (or omitted)

The trailing `<!-- 🔴 F-0042 -->` comment makes the flag findable by text search even in rendered views that strip HTML.

### Flag in PDF/DOCX export

When the user exports the marked-up draft to PDF or DOCX:
- The `<mark>` tag converts to highlighted text in most markdown-to-PDF/DOCX tools
- The HTML comments are stripped from the rendered output
- The trailing `<!-- 🔴 F-#### -->` comments remain in the source but not in the rendered PDF

For users who export to PDF for submission: instruct them to **strip flagged sections before exporting** by removing both the `<mark>` wrapper and the comment block. The Main Agent can produce a "clean" copy of the draft on request — see section 9.

### What gets flagged (categorization)

| Decision type | Severity | Reason |
|---|---|---|
| Output language defaulted to file language | 🟢 | Obvious |
| Source count target = default (35–40) | 🟢 | Obvious default |
| Style profile path defaulted to most recent version | 🟢 | Obvious |
| Mid-rubric angle chosen (slot 2 or 3) when slots are tied | 🟡 | Defensible, but user might prefer different slot |
| Counterargument hunting included | 🟢 | Recommended default |
| Word count target = midpoint | 🟢 | Safe default |
| Source quality descended A → B for any sub-claim | 🔴 | Affects evidence rigor |
| Source quality descended B → C | 🔴 | Critical |
| `[MISSING_CITATION]` inserted | 🔴 | Always flag |
| Style profile not found, proceeded without | 🔴 | Affects voice |
| Parts list not generated, proceeded with descriptive prototype | 🟡 | Reduces accuracy |
| Slot type changed by Flowchart Agent (e.g., flowchart → pie) | 🟡 | User had specified original |
| `[ABSTRACT ONLY]` source used for a major claim | 🟡 | Limits depth |
| Visual fidelity defaulted to primitives | 🟢 | Recommended |
| Design system defaulted to clean/minimal | 🟢 | Safe default |
| Predicted score below "submittable" threshold | 🔴 | Recommend revise before submission |
| Disqualifying issue detected | 🔴 | Always |

When a decision doesn't fit clearly into a tier, default to one tier higher (more cautious) — see hard floor 4.

---

## 4. Auto-decision rules per checkpoint type

When the Main Agent encounters a downstream skill's checkpoint, it applies these rules.

### Folder paths and file paths
- Default to the path provided in upfront questions
- If multiple competitions exist and ambiguous → 🔴 flag, ask user (this is a hard block in Full Automation; can't auto-resolve safely)

### Output language
- Match the language of `01_ideation.md` if present, else the user's prompt language
- Severity: 🟢

### Style profile selection
- Use the highest-numbered `00_style_profile_v*.md` file
- If none exists → proceed without, flag 🔴
- Severity: 🟢 if found, 🔴 if not

### Source count targets
- Default 35–40 for Research Agent
- Severity: 🟢

### Slot/angle selection (Ideation)
- If guidebook explicitly weights one criterion above 35% → match that slot (originality-heavy → contrarian; impact-heavy → Indonesian-context-specific)
- Otherwise: pick angle with highest combined "guidebook fit + style profile fit"
- Severity: 🟡 (user might prefer differently)

### Sub-claim decomposition
- Default decomposition produced by Research Agent — no override
- Severity: 🟢

### Source quality descent
- Try A-quality first per A-first descent rule
- Descend only if exhausted on a sub-claim
- Each descent is logged
- Severity: 🔴 for every A→B or B→C descent

### Counterargument scope
- Default include
- Severity: 🟢

### Word count target
- Midpoint of guidebook range
- Severity: 🟢

### Citation gatekeeping mode
- Force Batch mode in Full Automation
- This is what enables continued drafting through missing-citation events
- Severity: 🟢

### Image slot type for generic `diagram` slots
- Flowchart Agent picks the optimal Mermaid type
- If choice is contested (multiple types fit equally) → 🟡 flag
- Severity: 🟢 if obvious, 🟡 if contested

### Visual fidelity tier (Prototype)
- Default primitives
- If parts list provides enough geometric detail for custom geometry → use custom
- Severity: 🟢 for primitives, 🟡 for any escalation

### Design system (UI Design)
- Match guidebook tone: government → institutional, startup → modern SaaS, environmental → environmental, research → academic
- If ambiguous → clean/minimal
- Severity: 🟡 (consequential design choice)

### Severity level (Supervisor)
- Balanced
- Severity: 🟢

### Number of judges (Supervisor)
- Auto-derive from rubric clusters
- Severity: 🟢

### Placement thresholds (Supervisor)
- Default 70%/60%/50% unless guidebook specifies
- Severity: 🟢

### Backup overwrite (when modifying draft)
- Always create new versioned backup, never overwrite
- Severity: 🟢

### Final save
- Save automatically when the skill's quality checks pass
- Severity: 🟢

---

## 5. Tiered blocker handling

### Tier 1 — Hard blockers

The pipeline cannot proceed. Stop, save state, email user.

- Competition folder path doesn't exist or isn't writable
- Guidebook PDF unreadable (OCR returns <40% intelligible text on every page)
- Required upstream artifact missing for a skill that cannot run without it (e.g., no `01_ideation.md` when Research Agent is asked to run)
- Claude API error mid-session (network failure, rate limit hit)
- Disk full or write permission denied

Email the user with:
- Skill where it stopped
- Specific reason
- One-line resume command

### Tier 2 — Soft blockers

Proceed with best judgment, flag 🔴.

- A-quality source not found for a sub-claim → use B
- Parts list has component without Indonesian supplier → use international, flag shipping risk
- Word count near ceiling but more content needed → tighten existing prose, flag if cuts feel forced
- Research saturated below target (28 instead of 35) → continue with fewer sources

### Tier 3 — Missing optional inputs

Skip the missing input, document the gap, continue.

- No style profile → Writing Agent proceeds with approximate voice matching, flag 🔴
- No parts list → Prototype Agent uses descriptive brief only, flag 🟡
- No judge review → Writing Agent skips revision-mode integration, flag 🟡 only if user asked for revision

### Tier 4 — Skill-to-skill dependency thinness

Continue, flag prominently.

- Research evidence is genuinely thin → essay hedges, flag 🔴 on every hedged claim
- Source quality is mostly C with little A/B → essay hedges, flag 🔴 in coverage map
- Predicted judge score below "submittable" threshold → flag 🔴, recommend revision before submission

---

## 6. Consolidated automation log format

Saved at end of pipeline: `{competition_folder}/00_automation_log_{YYYYMMDD}.md`

```markdown
# Automation Log — {Competition Name}
Pipeline ran: {YYYY-MM-DD HH:MM} to {YYYY-MM-DD HH:MM}
Mode: Full Automation
Skills executed: Ideation, Research, Parts List, Writing, Flowchart, Prototype, UI Design, Supervisor
Outcome: ✅ Completed with flags / 🛑 Hard blocked at {skill}

---

## Executive summary

{2-3 sentences: what ran, what was produced, top-level outcome}

Flag counts:
- 🔴 Must review: {N}
- 🟡 Should review: {N}
- 🟢 FYI only: {N}

Predicted judge score (if Supervisor ran): {X}/{max} — {placement bracket}

---

## 🔴 Must-review flags ({N})

For each flag in this section:

### F-#### — {Brief title}
- **Where**: {file path, section, paragraph or claim ID}
- **Decision made**: {what was auto-decided}
- **Why**: {reasoning}
- **Alternatives considered**: {what was rejected}
- **Action needed from you**: {specific review step the user should take}

[Repeat for each 🔴 flag]

---

## 🟡 Should-review flags ({N})

[Same structure as above, briefer]

---

## 🟢 FYI flags ({N})

[Compact list: F-####, 1-line decision, file location]

---

## Decisions log (chronological)

| Time | Skill | Flag | Decision |
|---|---|---|---|
| 02:14 | Ideation | F-0001 🟡 | Chose contrarian slot 3 (rubric weights originality 30%) |
| 02:18 | Ideation | F-0002 🟢 | Output language: Indonesian (matches user prompt) |
| 02:31 | Research | F-0003 🔴 | A-quality exhausted for SC3, descended to B (SMERU report 2024) |
| ... | ... | ... | ... |

---

## Files produced

{checklist of artifacts created or updated, with paths}

---

## Recommended next actions

{user-specific next steps based on flags and outcomes}
```

---

## 7. Gmail notification template

Sent via Gmail MCP tool. Two scenarios:

### Success email (pipeline completed, with flags)

**Subject**: `[Essay Suite] {Competition} pipeline complete — {N} flags to review`

**Body**:

```
Hi,

The Full Automation pipeline for {Competition Name} finished successfully.

Summary:
• Skills run: {list}
• Files produced: {count}
• Predicted judge score: {X}/{max} — {placement bracket}
• Recommendation: {submit / light revision / significant revision}

Flags requiring your review:
🔴 Must review: {N}
🟡 Should review: {N}
🟢 FYI only: {N}

Top 3 must-reviews:
1. {F-#### title — 1-line summary}
2. {F-#### title — 1-line summary}
3. {F-#### title — 1-line summary}

Full automation log: {competition_folder}/00_automation_log_{date}.md
Latest draft: {competition_folder}/03_essay_draft_v{N}.md

To produce a clean (flag-stripped) copy of the draft for submission:
Trigger the Main Agent and say: "produce clean copy of {Competition} draft"

— Essay Competition Suite
```

### Hard-block email

**Subject**: `[Essay Suite] {Competition} pipeline blocked at {Skill} — resume command included`

**Body**:

```
Hi,

The Full Automation pipeline for {Competition Name} stopped before completing.

Where it stopped: {Skill name}
Why: {1-2 line reason}

Skills completed before block:
{list with checkmarks}

Skills not yet run:
{list}

To fix and resume:
1. {Specific fix step — e.g., "Re-upload guidebook as text-based PDF"}
2. Trigger the Main Agent and say: "resume {Competition} automation"

The pipeline will pick up from {Skill} and continue through the rest. Already-completed skills won't be re-run.

Session state file: {competition_folder}/00_automation_session_{date}_{time}.md

— Essay Competition Suite
```

### Implementation notes

- Use the Gmail MCP tool (already connected per user's setup)
- If Gmail MCP is unavailable in the session (tool not loaded), fall back to displaying the email content in chat with instructions for the user to email it to themselves
- Sender: whatever Gmail account the MCP authenticates as
- Subject line stays in English regardless of session language (better mobile readability when waking up)

---

## 8. Session state file format

Saved at: `{competition_folder}/00_automation_session_{YYYYMMDD}_{HHMMSS}.md`

```markdown
# Automation Session — {Competition Name}
Started: {YYYY-MM-DD HH:MM}
Ended: {YYYY-MM-DD HH:MM}
Mode: Full Automation
Email notification: {address}
Status: ✅ Completed / 🛑 Hard blocked / ⏸️ Paused

---

## Skills pipeline

| Skill | Status | Started | Ended | Output | Flags |
|---|---|---|---|---|---|
| Ideation | ✅ Done | 02:14 | 02:21 | 01_ideation.md | 1🟡 1🟢 |
| Research | ✅ Done | 02:21 | 03:48 | 02_research_*.md | 1🔴 3🟡 4🟢 |
| Parts List | ✅ Done | 03:48 | 04:31 | 02_research_parts_list.md | 1🔴 |
| Writing | ✅ Done | 04:31 | 05:52 | 03_essay_*.md | 2🔴 4🟡 8🟢 |
| Flowchart | 🛑 Hard block | 05:52 | 05:54 | (none) | (block) |
| Prototype | ⬜ Not run | - | - | - | - |
| UI Design | ⬜ Not run | - | - | - | - |
| Supervisor | ⬜ Not run | - | - | - | - |

---

## Block reason (if applicable)

Skill: Flowchart Agent
What happened: Mermaid CLI not installed; fallback to mermaid.live attempted but skill needs PNG previews to verify diagrams; user has not enabled the headless browser fallback in environment.
Fix required: Install mermaid CLI (`npm install -g @mermaid-js/mermaid-cli`) or accept text-only Mermaid output.
Resume command: After fix, trigger Main Agent and say "resume {Competition} automation"

---

## Pipeline configuration used

- Skills requested: full pipeline
- Email: {address}
- Style profile: {path}
- Output language: Indonesian
- Slot strategy: AI-decided (contrarian-weighted per guidebook)
- Severity defaults: balanced
- Word count target: midpoint

---

## Resume protocol (machine-readable)

```yaml
resume_from_skill: flowchart-agent
already_completed: [ideation, research, parts-list, writing]
remaining: [flowchart, prototype, ui-design, supervisor]
config:
  mode: full-automation
  email: {address}
  competition_folder: {absolute path}
```
```

The YAML block at the end is for the Main Agent to parse on resume — it lets resume be deterministic without re-asking the user for context.

---

## 9. Clean-copy production

When the user wants to export the draft for submission, they need a version without flags, highlights, or auto-flag comments.

The Main Agent supports a "produce clean copy" sub-command:

Trigger phrase: *"produce clean copy of {Competition} draft"*

Behavior:
1. Read `03_essay_draft_v{latest}.md`
2. Strip all `<mark data-flag=...>...</mark>` wrappers (keep the inner text)
3. Strip all `<!-- 🔴/🟡/🟢 AUTO-FLAG ... -->` HTML comment blocks
4. Strip trailing `<!-- 🔴 F-#### -->` comments
5. Save as `03_essay_draft_v{latest}_clean.md`
6. Optionally export to DOCX or PDF if user requests

Refuse to produce a clean copy if any 🔴 flag remains unresolved AND the user hasn't explicitly acknowledged. Surface the flags first; then proceed if user confirms.

---

## 10. Status check protocol (no skill triggered)

When the user asks "what's the status" without intent to run anything, the Main Agent:

1. Inspects the folder per Step 1
2. Identifies the next logical skill per the routing decision tree
3. Reports:
   - Completed stages with key outputs
   - Pending stages
   - Recommended next action
   - Any session-state files present (indicates prior automation)
4. Does not trigger anything

---

## 11. Quality checks before pipeline completion

Before sending the success email and finalizing:

- [ ] All requested skills ran (or hard-blocker is documented)
- [ ] Every flag in output files has a corresponding entry in `00_automation_log.md`
- [ ] Every 🔴 flag points to a specific location and review action
- [ ] Hard floors held (no fabricated citations, disqualifying issues surfaced)
- [ ] Session state file written with all skill statuses
- [ ] If draft was produced, word count was logged
- [ ] If Supervisor ran, predicted score is in the email summary
- [ ] Clean-copy command is available (referenced in email)
- [ ] Gmail MCP tool was successfully called (or fallback was applied)

---

## 12. Common failure modes to avoid

- **Skipping pre-flight checks**: triggering Research Agent in auto mode when `01_ideation.md` doesn't exist → produces nonsense; always pre-flight check
- **Auto-deciding past safety floors**: never lower hard floors. Citation gatekeeping is non-negotiable in any mode.
- **Silent skill skipping**: if a skill is skipped because of missing input, log it loudly. Don't just continue and pretend the skill ran.
- **Over-flagging trivial decisions**: marking everything 🔴 dilutes the value of the flag system. Use the categorization in section 3 honestly.
- **Under-flagging consequential decisions**: marking source-quality descents 🟢 because "it's still cited" — those are 🔴 by rule.
- **Continuing past hard blockers**: stop is stop. Don't try to fake-continue with degraded output past Tier 1 issues.
- **Email failures going silent**: if Gmail MCP fails, surface the email content in chat so the user still sees the summary.
- **Resume without verifying the blocker is fixed**: re-running Flowchart Agent when the original block reason hasn't been addressed → blocks again. Verify first.
- **Fabricating session state**: if the Main Agent loses track of what ran, re-inspect the folder rather than guessing. Folder state is authoritative.
- **Routing to specialized skill ahead of dependencies**: triggering Prototype Design Agent when no draft exists → upstream check should catch this.
- **Producing clean copy with unresolved 🔴 flags**: refuse, surface flags, ask user to confirm.
- **Mode persistence across sessions**: Full Automation does not persist; each new conversation starts in Interactive unless explicitly requested. Prevents accidental overnight runs.

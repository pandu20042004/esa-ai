# Writing Agent — Reference

This file holds the detailed specifications for the Writing Agent skill. It is loaded before drafting begins and guides every step from outline through final save.

---

## 1. Dual-link citation format

Citations in the draft use a **dual-link system** designed to survive PDF/DOCX export while preserving an audit path back to the Citation Table.

### The two links

1. **Primary link (inline citation)**: points to an anchor inside the same draft file, specifically to an entry in the draft's `## References` section. This preserves clickability when the draft is exported to PDF or DOCX because the destination is in the same document.

2. **Audit link (in references section)**: each reference entry in the draft's `## References` section contains a back-link to the corresponding Claim ID card in `02_research_sources.md`. This lets the user trace any citation back to its verbatim passage during editing, while being irrelevant to the final submission.

### Inline citation syntax

```
...sentence with a claim ([Author et al., Year](#ref-authoryear))<!-- C7 -->
```

**Components:**
- `[Author et al., Year]` — visible reference text in the guidebook's citation style (APA shown)
- `(#ref-authoryear)` — anchor link to the reference entry in the same document; lowercase, no spaces, uses author surname + year
- `<!-- C7 -->` — HTML comment, invisible in rendered output, preserves the Claim ID for audit tools

### Reference entry syntax (in the draft's `## References` section)

```markdown
<a id="ref-authoryear"></a>
**Author, A., et al. (Year).** Full title of work. *Journal Name*, Volume(Issue), Pages. https://doi.org/10.xxxx/xxxx
&nbsp;&nbsp;&nbsp;→ [Full Citation Card](02_research_sources.md#c7) (Claim ID C7)
```

**Components:**
- `<a id="ref-authoryear"></a>` — the anchor that the inline link targets
- Full APA reference (or guidebook-specified style)
- Back-link to the Citation Table card for audit

### Anchor ID convention

Use lowercase, surname-year, dash-separated: `ref-suharyanto2026`, `ref-wijayasantoso2024`. For 3+ authors, use first surname + "etal" + year: `ref-putraetal2025`.

If two sources share the same first author and year, disambiguate with a letter: `ref-putra2024a`, `ref-putra2024b`.

### Multiple citations in one sentence

```
...claim with two sources ([Author A, 2024](#ref-a2024); [Author B, 2025](#ref-b2025))<!-- C7, C12 -->
```

### Counterargument citations

Same mechanic, but the Claim ID starts with `CC` in the comment:

```
...some scholars disagree ([Suryadi, 2023](#ref-suryadi2023))<!-- CC1 -->
```

The anchor itself does not include "cc" — the in-draft reference section lists all sources uniformly; the Claim ID comment is what marks it as counterargument.

### Citation style variation

APA shown above. If the guidebook specifies Chicago, numeric, or Indonesian academic style, adjust the visible reference text accordingly — anchor link and HTML comment logic remain the same.

### Rules

- Every empirical, factual, or quantitative claim must have a citation
- Never use a Claim ID not present in `02_research_sources.md`
- Never invent citation metadata — if the Citation Table says "Author: Wijaya, Year: 2024," use exactly that
- If the same Claim ID supports multiple sentences, cite it at each sentence that uses it — do not assume the reader remembers
- Every inline citation must have a matching anchor entry in the draft's `## References` section

---

## 2. Image slot marker schema

Image slots are machine-readable markers embedded in the draft. Downstream skills (Flowchart Agent, Prototype Design Agent, Web Design Agent, App Design Agent) scan for these markers and fill them with generated visuals.

### Marker format

```markdown
<!-- IMAGE_SLOT_START -->
![PLACEHOLDER: Figure [N] — [Brief caption]](TBD)
<!--
SLOT_ID: slot_[N]
SLOT_TYPE: [diagram | flowchart | sequence | gantt | timeline | pie | quadrant | mindmap | journey | sankey | xychart | state | er | class | requirement | block | prototype | web_mockup | app_mockup | product_mockup | ui_screen | infographic | photo]
PURPOSE: [1-sentence — what this visual does for the argument]
DESCRIPTION: [2–4 sentences — what it should show, what elements must be present, what it must NOT show]
TARGET_SKILL: [flowchart-agent | prototype-design-agent | ui-design-agent]
SECTION: [which essay section this belongs to — e.g., "Body §3 — The hidden network"]
CLAIM_IDS: [Claim IDs this visual supports or illustrates, comma-separated]
PROSE_ALLOWANCE: [approximate word count the surrounding prose reserves for this visual's context — typically 50–150 words]
-->
<!-- IMAGE_SLOT_END -->
```

### SLOT_TYPE options and their TARGET_SKILL

The Flowchart Agent handles all Mermaid-based diagrams. Use the specific type if you know what fits best; use `diagram` (generic) to let the Flowchart Agent analyze the description and pick the optimal type.

| SLOT_TYPE | TARGET_SKILL | Use case |
|---|---|---|
| `diagram` (generic) | `flowchart-agent` | Let the Flowchart Agent pick the optimal Mermaid type based on the description |
| `flowchart` | `flowchart-agent` | Process diagrams, decision trees, causal chains, system flows |
| `sequence` | `flowchart-agent` | Interactions between actors/systems over time |
| `gantt` | `flowchart-agent` | Project timelines with explicit durations, implementation roadmaps |
| `timeline` | `flowchart-agent` | Chronological events without durations (historical, policy milestones) |
| `pie` | `flowchart-agent` | Proportion breakdown, category shares |
| `quadrant` | `flowchart-agent` | 2x2 matrix categorization, strategy mapping |
| `mindmap` | `flowchart-agent` | Hierarchical concept breakdown, topic decomposition |
| `journey` | `flowchart-agent` | Stakeholder or user experience over a process |
| `sankey` | `flowchart-agent` | Flow/magnitude between categories (e.g., resource allocation) |
| `xychart` | `flowchart-agent` | Line/bar charts from data |
| `state` | `flowchart-agent` | State transitions, policy/system lifecycle |
| `er` | `flowchart-agent` | Entity-relationship diagrams, data models |
| `class` | `flowchart-agent` | System architecture, conceptual relationships |
| `requirement` | `flowchart-agent` | Formal requirement mapping |
| `block` | `flowchart-agent` | Block/architecture diagrams |
| `prototype` | `prototype-design-agent` | 3D illustrations of physical or conceptual solutions proposed in the essay (three.js standalone HTML with exploded-view toggle) |
| `web_mockup` | `ui-design-agent` | Desktop web platform or dashboard UIs the essay proposes (device-framed SVG default, multi-screen interactive HTML, optional 3D MacBook) |
| `app_mockup` | `ui-design-agent` | Mobile app UIs the essay proposes (iPhone-framed SVG default, multi-screen interactive HTML, optional 3D iPhone) |
| `product_mockup` | `ui-design-agent` | Combined desktop + mobile product view on a neutral canvas — single figure showing both platforms at once |
| `ui_screen` | `ui-design-agent` | Standalone 1920×1080 PNG UI asset for external use (e.g., as a screen texture applied to a 3D device by the Prototype Design Agent) |
| `infographic` | `ui-design-agent` | Static data visuals — handled by UI Design Agent using its design system for cross-artifact consistency |
| `photo` | (none — user-supplied) | Marker for a photo the user will add manually; no skill fills these |

### Placement rules

- Image slots are **planned during the outline step**, not inserted ad hoc while drafting
- Every slot must have a clear PURPOSE tied to the argument — do not add decorative visuals
- Prose around each slot must set up the visual and (if needed) reference back to it
- The `TBD` placeholder stays until the target skill fills it with a real filename

### After design skills run

Each design skill generates its artifact(s) and modifies the draft by replacing:

```
![PLACEHOLDER: ...](TBD)
```

with:

```
![Figure 1 — Community learning network](04_diagrams/slot_1_flowchart.png)
```

The marker comments stay intact so the slot is still auditable. The target skill also creates a backup of the draft before modifying (see Flowchart Agent and design agents for backup protocol).

---

## 3. Outline file template — `03_essay_outline.md`

```markdown
# Essay Outline — [Competition Name]
Generated: [YYYY-MM-DD] | Competition folder: [absolute path]
Word target: [N] words (guidebook range: [min]–[max]; target position: lower/mid/upper)
Output language: [ID/EN/mixed] | Citation style: [APA/Chicago/numeric/other]
Style profile used: [path or "none"]
Draft version to produce: v[N]
Gatekeeping mode: Strict / Batch

---

## Section plan

### [Section 1 — e.g., Abstract / Ringkasan]
- **Purpose**: [...]
- **Word allocation**: [N] words
- **Sub-claims covered**: [SC1, SC2]
- **Anchor Claim IDs**: [C1, C4]
- **Counterargument placement**: [none / brief / full]
- **Image slots**: [none / slot_1 type=flowchart]
- **Style notes**: [any deliberate style profile deviation]

### [Section 2 — e.g., Introduction / Pendahuluan]
[same structure]

### [Section 3 — e.g., Body / Pembahasan Part 1]
[same structure]

[etc. through every section required by the guidebook]

### [Final section — e.g., Conclusion / Simpulan]
[same structure]

---

## Image slot plan

List every image slot planned across the essay, for the downstream skills' easy reference.

| SLOT_ID | TYPE | SECTION | TARGET_SKILL | PURPOSE |
|---|---|---|---|---|
| slot_1 | flowchart | Body §3 | flowchart-agent | [...] |
| slot_2 | gantt | Body §4 | flowchart-agent | [...] |
| slot_3 | app_mockup | Body §5 | app-design-agent | [...] |
| ... | ... | ... | ... | ... |

---

## Claim ID coverage map

Shows which Claim IDs from `02_research_sources.md` will be used in which sections.

| Claim ID | Section | Sub-claim | Usage |
|---|---|---|---|
| C1 | Introduction | SC1 | Opening statistic |
| C4 | Body §2 | SC2 | Main evidence |
| CC1 | Body §4 | [COUNTER] | Steelman of opposing view |
| ... | ... | ... | ... |

**Claim IDs available but not used**: [list]
**Reason for non-use**: [brief note — e.g., "redundant with C7," "weaker quality than C12 for same sub-claim"]

---

## Gaps to hedge

From `02_research_main.md` evidence gaps list, which gaps appear in this outline and how each will be handled:

- [Gap 1] → hedge in Section N as "this remains an open question" / reframe as "area for future research" / omit from essay
- [Gap 2] → [...]

---

## Style profile deviations planned

If any sections deliberately deviate from the style profile, list here with reasoning:

- Section [N]: [deviation] — [reason]

If no deviations planned: write "None planned."

---

## Checkpoints ahead
1. Outline review (this file) — awaiting user approval
2. Intro review — after introduction is drafted
3. Midpoint review — after first body section is drafted
4. Full draft review — after complete draft is assembled
```

---

## 4. Standalone references file template — `03_essay_references.md`

This file is for the user's records — it is NOT part of the submission. The submission uses the `## References` section embedded at the end of the draft.

```markdown
# References (Editor Record) — [Competition Name]
Generated: [YYYY-MM-DD] | Citation style: [APA/Chicago/numeric/other]
Linked to: `02_research_sources.md` (Citation Table) and `03_essay_draft_v[N].md`

This file tracks citations used in the draft and their mapping to Claim IDs. The submission's references live in the draft file itself.

---

## Reference list (alphabetical)

### [Author, A. (Year)]
- **Full reference (APA)**: [Author, A. (Year). Title. Journal, Volume(Issue), Pages. DOI]
- **In-draft anchor**: `#ref-authoryear`
- **Used in draft for Claim IDs**: [C1, C3]
- **Citation card**: [→ C1](02_research_sources.md#c1)
- **Source type**: [Academic / Government data / etc.]
- **Quality label**: [A/B/C/D]
- **Access note**: [OPEN ACCESS / ABSTRACT ONLY / etc.]

### [Next author, alphabetical]
[same structure]

[... through every source cited in the draft]

---

## Sources in Citation Table not cited in this draft

List every Claim ID from `02_research_sources.md` that was available but not used in the draft, with reason. This is useful if the user wants to reconsider inclusion in a later revision.

- C7 — reason: [redundant with C4; same finding, weaker evidence]
- C15 — reason: [covers a sub-claim that the essay ultimately deprioritized]
- ...

---

## Citation style notes

[Any guidebook-specific citation formatting oddities — e.g., "guidebook requires 'et al.' after 3 authors, not 2"]
```

---

## 5. Draft file template — `03_essay_draft_v{N}.md`

```markdown
# [Essay title] — Draft v[N]
Competition: [name] | Generated: [YYYY-MM-DD] | Competition folder: [absolute path]
Word count: [actual] (target: [N]; guidebook range: [min]–[max])
Output language: [ID/EN/mixed] | Citation style: [APA/Chicago/other]
Style profile: [path or "none"]
Version: [N] | Previous version: [path to v{N-1} if any]
Gatekeeping mode: Strict / Batch

Citation count: [N] ([M] supporting, [K] counterargument)
Image slots planned: [N] ([breakdown by type])
Missing citations (Batch mode only): [N] markers — see end-of-file summary

---

## [Essay structure follows guidebook — below is just the prose]

[Abstract / Ringkasan — if required]

[Introduction — includes inline citations like ([Author, Year](#ref-authoryear))<!-- C1 --> and image slot markers where planned]

[Body sections — with citations, counterargument integration, image slots]

[Conclusion]

---

## References

<!-- This section is part of the submission. Internal anchors allow citations above to link here. Audit links go out to 02_research_sources.md. -->

<a id="ref-authoryear"></a>
**Author, A., et al. (Year).** Full title of work. *Journal Name*, Volume(Issue), Pages. https://doi.org/10.xxxx/xxxx
&nbsp;&nbsp;&nbsp;→ [Full Citation Card](02_research_sources.md#c1) (Claim ID C1)

<a id="ref-nextauthor"></a>
**Next Author (Year).** [...]
&nbsp;&nbsp;&nbsp;→ [Full Citation Card](02_research_sources.md#c3) (Claim ID C3)

[... every cited source in alphabetical order]

---

<!-- ========== END OF ESSAY SUBMISSION ========== -->

## Draft metadata (not part of submission)

### Claim IDs used
[C1, C3, C7, C12, CC1, CC3, ...] — total [N]

### Claim IDs available but unused
[C5, C9, C15, ...] — see `03_essay_references.md` for reasons

### Image slots in this draft

| SLOT_ID | TYPE | TARGET_SKILL | STATUS |
|---|---|---|---|
| slot_1 | flowchart | flowchart-agent | Awaiting generation |
| slot_2 | gantt | flowchart-agent | Awaiting generation |
| slot_3 | app_mockup | app-design-agent | Awaiting generation |

### Style profile deviations
[List any, with reason, or "None"]

### Gaps hedged in this version
[List gaps from research file that were hedged in prose, and how]

### Missing-citation markers (Batch mode only)

If gatekeeping mode was Batch, list every `[MISSING_CITATION: ...]` marker inserted, with context:

| Location (section, paragraph) | Claim description | Proposed resolution at checkpoint |
|---|---|---|
| Body §2, ¶3 | Rural literacy dropout rate | Skip / reformulate / run Research Agent |
| ... | ... | ... |

If Strict mode was used: "Not applicable."

### Revision notes (if v2+)
[What changed from the previous version; for v1 write "Initial draft"]
```

---

## 6. Quality checks before saving

Run each item before finalizing. If any fails, fix before saving.

### Citation integrity
- [ ] Every factual/empirical claim has a clickable citation (or a `[MISSING_CITATION: ...]` marker in Batch mode, to be resolved at Checkpoint #4)
- [ ] Every cited Claim ID exists in `02_research_sources.md`
- [ ] No fabricated authors, years, DOIs, or titles
- [ ] Counterargument citations use CC prefix in comments and are contextualized as opposing views
- [ ] `[ABSTRACT ONLY]` sources are not used for claims requiring deep elaboration
- [ ] No claim marked by Research Agent as "gap" is asserted as supported
- [ ] Every inline citation anchor (e.g., `#ref-authoryear`) has a matching `<a id="..."></a>` in the draft's References section

### Structure
- [ ] All guidebook-required sections are present
- [ ] Word count falls within guidebook range (counting essay prose and References; excluding the `## Draft metadata` block at end)
- [ ] Section word allocations approximately match the outline (within ±15%)
- [ ] Outline, draft, and references files have matching metadata headers

### Style profile adherence (if used)
- [ ] Opening signature pattern matches profile
- [ ] Closing signature pattern matches profile
- [ ] Sentence-rhythm targets roughly met (check by sampling)
- [ ] Vocabulary fingerprint present (recurring words/phrases from profile appear naturally)
- [ ] Register matches profile's specification
- [ ] Any deliberate deviation is documented in metadata

### Image slots
- [ ] Every slot has all marker fields populated
- [ ] Every SLOT_ID is unique within the draft
- [ ] Every TARGET_SKILL is valid
- [ ] Prose around each slot sets up the visual's purpose

### References file
- [ ] Every in-draft reference entry also appears in `03_essay_references.md`
- [ ] Every reference entry in the draft has a working back-link to its Citation Table card
- [ ] Alphabetical order (or numeric for numeric citation styles)

### Batch mode resolution (if applicable)
- [ ] Every `[MISSING_CITATION: ...]` marker has been shown to the user at Checkpoint #4
- [ ] Every marker has a resolution decision (skip/reformulate/pause for research)
- [ ] After resolution, no unresolved markers remain in the final saved version

### Versioning
- [ ] Version number matches any existing files (v1 if first, v{N+1} if iterating)
- [ ] Previous version preserved, not overwritten
- [ ] Revision notes populated in metadata

---

## 7. Revision and versioning protocol

### Fresh draft
If no `03_essay_draft_v*.md` exists in the folder, save as `03_essay_draft_v1.md`.

### Iteration — create new version (default)
Save as `03_essay_draft_v{N+1}.md`. Preserve previous versions.

Example flow:
- User approves v1 draft
- User requests revision ("tighten section 3, make intro more contrarian")
- Writing Agent produces v2, saving as `03_essay_draft_v2.md`
- v1 remains untouched — user can diff or roll back

In the v2 metadata header, populate the "Revision notes" field with what changed from v1.

### Iteration — revise in place
Only used if user explicitly chooses this mode. Edit the existing latest version file, annotating changes with HTML comments:

```
<!-- REVISION YYYY-MM-DD: reworded opening for sharper thesis -->
```

Use this mode sparingly — versioning is the default because it preserves rollback ability.

### Iteration — archive and start fresh
If user chooses this option, rename all `03_essay_draft_v*.md` files to `03_essay_draft_archive_{YYYYMMDD}_v{N}.md` and start a new `v1`.

---

## 8. Style profile application policy — heavy guidance

The style profile is a guide, not a cage. Follow these principles:

1. **Apply directives by default**: opening patterns, closing patterns, sentence rhythm ranges, vocabulary fingerprint, register, formatting habits.

2. **Deviate when the argument demands it**: if a section's argument needs a complex subordinate-clause sentence, write it even if the profile says "30–40% short sentences." Document the deviation.

3. **Do not mechanically measure**: the goal is voice, not a statistics match. "Heavy guidance" means the profile shapes the prose, not that the prose passes an arithmetic check.

4. **Preserve voice markers**: first-person use, rhetorical questions, analogy source domains — these are the profile's most identifying signals. Do not drop them for convenience.

5. **Preserve Indonesian-specific devices verbatim**: if the profile lists recurring Indonesian phrases or rhetorical constructions, use them when the opportunity arises, in Indonesian.

6. **Flag deviations**: any deliberate departure from the profile goes in the outline (planned) or the draft metadata (executed).

---

## 9. Word budget mechanics

Word count adherence matters for guidebook compliance. Budget mechanics:

### Basic allocation
- Total word target = user's chosen position (lower/mid/upper third of guidebook range)
- Divide across required sections based on the guidebook's weighting hints (if any) or standard conventions (intro ~10–15%, body ~70–80%, conclusion ~10%)

### Image slot allowance
Each image slot reserves prose around it. Typical allowances:
- Flowchart / sequence / gantt / app mockup / prototype: 80–150 words of setup + reference
- Infographic: 40–80 words
- Photo: 20–40 words

Include these in the section word allocations so you don't overshoot.

### What counts toward the word count
- Essay prose from the first required section (abstract/intro) through the conclusion: **counts**
- The `## References` section: **counts** if the guidebook says references count; otherwise exclude. The guidebook summary from ideation should have specified; if ambiguous, ask the user.
- The `## Draft metadata` block at the end of the file: **does not count** — it's not part of the submission

Report actual word count in the draft metadata header, with a note on what's included.

---

## 10. Batch mode protocol

If the user chose **Batch mode** in upfront question 7:

1. **During drafting**: when a claim is needed without a supporting Claim ID, insert a marker inline at the claim's position:
   ```
   [MISSING_CITATION: rural digital literacy dropout rate in Central Java 2024]
   ```
   Then continue drafting.

2. **Internal tracking**: record each marker's location (section, approximate paragraph), claim description, and any speculation about which Claim ID might fit if reformulated.

3. **At Checkpoint #4** (full draft review):
   - Present the consolidated list of every marker in a table
   - For each, present three resolution options:
     - (a) Skip the claim — reword the sentence to not need a citation
     - (b) Reformulate the claim to fit an existing Claim ID the user names
     - (c) Pause drafting — user runs Research Agent to add the needed source, then resumes
   - Wait for user decisions on every marker

4. **After resolution**:
   - Apply each decision to the draft
   - Re-run the quality checks
   - Save the finalized version

**The final saved draft must contain zero `[MISSING_CITATION: ...]` markers.** If any remain unresolved, the draft is not submission-ready and the skill must flag this clearly in the metadata header.

If the user insists on saving with unresolved markers (e.g., to commit progress), save as `03_essay_draft_v{N}_incomplete.md` with a warning banner in the metadata header and ask the user to explicitly acknowledge.

---

## 11. Common failure modes to avoid

- **Fabricated citations**: citing a Claim ID that doesn't exist, or using real authors with a wrong year
- **Asserting gaps as supported**: treating the Research Agent's "Evidence gaps" list as minor; each gap must be hedged or reframed
- **Voice drift**: writing in a neutral AI tone instead of the user's profile
- **Outline skipping**: producing prose before the outline is approved
- **Counterargument flattening**: citing a CC source as if it supported the thesis
- **Image slot handwaving**: inserting a slot without filling PURPOSE, DESCRIPTION, or TARGET_SKILL
- **Over-citation**: citing every sentence, including stylistic or transitional ones that don't need sourcing
- **Under-citation**: writing a block of empirical prose with only one citation at the end, when each claim needs its own
- **Silent word-count miss**: saving a draft that undershoots or overshoots the guidebook range without flagging
- **Broken anchor links**: using anchor IDs that don't match the reference section (`#ref-Author2024` instead of `#ref-author2024` — lowercase only)
- **Orphan references**: reference entries in the `## References` section with no matching inline citation, or inline citations with no matching reference entry
- **Batch mode drift**: silently dropping a missing-citation marker rather than surfacing it at Checkpoint #4
- **Skipping the midpoint checkpoint**: proceeding past the first body section without user approval to save time — defeats the purpose of the hybrid flow

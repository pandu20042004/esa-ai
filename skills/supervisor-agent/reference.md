# Supervisor Agent — Reference

Detailed specifications for the Supervisor Agent skill.

---

## 1. Severity × score-impact hybrid grading

Every issue a judge raises gets two labels: severity (how urgent) and score impact (how much the issue costs on the rubric).

### Severity levels

| Label | Meaning |
|---|---|
| `minor` | Polishing; doesn't affect substance. A reader notices but doesn't mark down. |
| `moderate` | Real issue a judge will register. Costs a small amount of score. |
| `critical` | Fundamental problem. Costs meaningful score or risks judge dismissal. |
| `disqualifying` | Violates guidebook rules (plagiarism, format noncompliance, missing required section, word count way off). Draft cannot be submitted as-is. |

### Score impact format

Express impact as expected point change on a specific rubric criterion, written as `[-N pts on Criterion X]` where N is the estimated deduction and X is the criterion name from the guidebook.

Examples:
- `[-3 pts on Originality (25%)]`
- `[-5 pts on Kualitas Gagasan]`
- `[-10 pts on Originality; risk of immediate dismissal]`

When impact is hard to pin (e.g., a clarity issue affects multiple criteria slightly), write `[-2 pts distributed across criteria]`.

### Combined label in critique

Every issue in the per-judge and consensus sections carries both labels:

> **[CRITICAL] [-5 pts on Data Quality]** The methodology section claims a 64% improvement but the cited source (C7) reports 23% improvement. Judges who cross-check citations will flag this as a data-integrity failure.

---

## 2. Judge persona construction

### Path A — Named judges in guidebook + web research enabled

For each named judge:

**Research steps:**
1. Web-search the judge's name + their institutional affiliation (if stated)
2. Look for: role/title, institution, field of expertise, recent publications or public talks, known positions on relevant topics
3. Cap at 3–5 search queries per judge
4. If a judge has limited public profile, note this and fall back to rubric-cluster inference

**Persona construction from research:**
- Field/role → which rubric criterion cluster they'll emphasize
- Recent work → what specific angles they're likely to notice
- Known positions → what they'll agree or disagree with in the thesis
- Public writing style → how they phrase critique (used only to inform focus, NOT tone — tone stays consistent per Rule in §3)

**Output per persona:**

```markdown
### Judge 1 — Dr. [Name]
- **Role**: [from research]
- **Institution**: [from research]
- **Field emphasis**: [from research]
- **Rubric ownership**: [which criteria this judge will score most directly]
- **Likely concerns**: [what this judge will probe based on background]
- **Source confidence**: [solid / moderate / limited — based on research depth]
```

### Path B — No named judges (composite from rubric)

Identify criterion clusters with >10% rubric weight. For each:

**Map cluster → archetype:**

| Cluster | Archetype |
|---|---|
| Idea / originality / innovation | "Senior reviewer from an academic or innovation-focused institution who has read many competition entries and recognizes novelty vs. convention" |
| Feasibility / practicality / implementation | "Policy practitioner or operator who asks 'would this actually work in the field?'" |
| Data / evidence / rigor | "Empirical researcher who cross-checks citations and examines methodology" |
| Writing / communication / structure | "Communications specialist or senior academic editor focused on argument clarity and flow" |
| Impact / relevance / social contribution | "Program evaluator or development worker focused on who benefits and by how much" |
| Format / compliance | "Competition administrator focused on guidebook adherence — typically one judge owns this" |

**Output per persona:**

```markdown
### Judge 1 — [Archetype title, e.g., "Empirical Research Reviewer"]
- **Background**: [Composite from archetype + any user-provided info]
- **Rubric ownership**: [which criteria this judge will score most directly]
- **Likely concerns**: [what this judge will probe based on archetype]
- **Source confidence**: inferred from rubric (not a named individual)
```

### Incorporating user-provided background info

If the user provided info in upfront question 6 (e.g., "hosted by Kemendikbud, likely government researchers"), incorporate into:
- Archetype selection (bias toward the provided background)
- Likely concerns (pull from the provided context)

State explicitly that user input informed the persona so the user can verify it was used correctly.

---

## 3. Tone consistency rule

**All judges speak with the same measured, specific, professional critique voice.** Judges differ in *what* they focus on, not *how* they talk.

### Allowed tone characteristics

- Specific (references exact locations, cites specific claims)
- Honest (names issues without hedging)
- Constructive (every critique comes with a suggested fix)
- Professional (no colloquialism, no cruelty, no flattery)
- Measured (acknowledges what works before flagging what doesn't)

### Prohibited tone patterns

- Cruel or dismissive ("This is a mess," "Clearly the author doesn't understand...")
- Saccharine or cheerleading ("Great job!", "I love this angle")
- Vague ("Feels off," "Could be stronger," "Needs more depth")
- Hedging to soften blow ("This might perhaps be a small issue...")
- Persona-voice drift (Judge 1 speaks like a harsh academic, Judge 3 like an encouraging mentor)

### Severity level affects content, not tone

The user selects severity level (harsh / balanced / gentle). This affects *what gets raised*, not *how it's phrased*:

- **Harsh**: raise every issue of moderate severity or above, including contested ones. No softening.
- **Balanced** (default): raise all critical issues, most moderate issues, skip most minor issues. Acknowledge positives alongside negatives.
- **Gentle**: raise only critical issues and top 3 moderate issues. Lead with positives. Still specific, not vague.

Tone of language is measured across all three levels. Only content selection differs.

---

## 4. Per-judge critique template

Each judge's critique follows this exact structure:

```markdown
### Judge [N] — [Name or archetype]

[Persona block: role, institution, field emphasis, rubric ownership, likely concerns — from section 2]

#### What works

1. **[Specific strength]** — [Section/paragraph reference]. [Why this works from this judge's perspective.]
2. **[Strength]** — [...]
3. **[Strength]** — [...]

#### What fails

1. **[SEVERITY] [SCORE IMPACT]** [Issue description — specific, references location]. 
   - **Where**: [Section name, paragraph number, or Claim ID]
   - **Suggested fix**: [Concrete action the Writing Agent could take]

2. **[SEVERITY] [SCORE IMPACT]** [Issue]
   - **Where**: [...]
   - **Suggested fix**: [...]

[3–5 issues total]

#### Per-criterion scoring (criteria this judge owns)

| Criterion | Weight | Score (this judge) | Reasoning |
|---|---|---|---|
| [Criterion name from guidebook] | [weight%] | [score]/[max] | [1-sentence reasoning] |

#### Overall verdict (from this judge's perspective)

[One sentence capturing this judge's headline view of the draft — positive, mixed, or critical.]
```

### Rules for filling the template

- **"What works" must be specific.** "Strong opening" is rejected. "The Sungai Code framing in paragraph 2 grounds the argument in a concrete local context that judges will recognize" is acceptable.
- **Every "what fails" issue must cite a location.** Section names work; paragraph numbers are better; Claim IDs are best when critiquing cited claims.
- **Every fix suggestion must be actionable.** "Make it more rigorous" is rejected. "Replace the qualitative claim in §3 ¶4 with the quantitative finding from C12 (64% rate in the BPS 2025 data)" is acceptable.
- **Score reasoning is one sentence.** Don't re-litigate the critique in the scoring note; just the headline reason.

---

## 5. Consensus and contested synthesis

After per-judge critiques, synthesize:

### Consensus section

Issues raised by 2+ judges. Listed in priority order (number of judges agreeing × max severity across judges). Format:

```markdown
### Consensus issue 1 — [Issue label]
**[SEVERITY] [SCORE IMPACT]** — Flagged by Judge 1, Judge 3
- [Judge 1's framing]
- [Judge 3's framing]
- **Consolidated fix**: [Single action that addresses both judges' concerns]
```

### Contested section

Issues where judges disagree or only one judge raises them. Present without resolution:

```markdown
### Contested issue 1 — [Issue label]
- **Judge 1 says**: [Their view — e.g., "Methodology is adequate for an essay"]
- **Judge 3 says**: [Their view — e.g., "Methodology lacks quantitative validation"]
- **What this means**: [1 sentence on why this contested issue matters — different real-world panels may score this differently, so how to handle depends on risk tolerance]
- **If you want to address it**: [Optional fix suggestion]
```

### Uncontested positives section

Elements all judges agreed are working. Short bullet list. Anchors the revision — the Writing Agent should not touch these.

```markdown
### Uncontested positives (do not touch in revision)
- [Positive element from section X, paragraph Y]
- [Positive element]
```

---

## 6. Score prediction methodology

Aggregate per-judge scores into a total predicted score.

### Per-criterion aggregation

For each rubric criterion:
1. Identify which judges scored it (from each judge's "Per-criterion scoring" table)
2. If multiple judges scored it: weighted average where each judge's weight is their "ownership" of that criterion (1.0 if primary owner, 0.5 if secondary owner, not counted if not owning)
3. If only one judge scored it: that judge's score stands
4. Compute the criterion's contribution: `score × rubric_weight`

### Total score

Sum of all criterion contributions. Express as `{total}/{max_total}`.

### Confidence level

Based on score spread across judges who owned each criterion:
- **High**: all owning judges within 5 points of each other
- **Medium**: spread of 5–10 points
- **Low**: spread >10 points — genuine disagreement; the real panel could score very differently

### Placement bracket

Use the thresholds from upfront question 7. Default thresholds:

| Score as % of max | Bracket |
|---|---|
| ≥ 70% | Competitive (top 30%) — may place |
| 60–69% | Submittable (top 50%) — competitive but unlikely to place |
| 50–59% | Borderline — revise before submission |
| < 50% | Needs significant revision |

User thresholds override these defaults.

### Output format

```markdown
## Score prediction

### Per-criterion
| Criterion | Weight | Predicted score | Reasoning |
|---|---|---|---|
| Originality | 25% | 18/25 | Thesis is distinctive but framing borrows heavily from a 2024 policy brief. |
| Data Quality | 20% | 15/20 | Citations are solid but one quantitative claim (§3 ¶4) has a weak source. |
| ... | ... | ... | ... |

### Total
**Predicted score: 68/100** — placement bracket: **Submittable** (top 50%)

### Confidence: Medium
Judges agreed within 5 points on Originality and Feasibility; disagreed by 12 points on Data Quality (see contested issue 2). The real panel's Data Quality scoring is the main uncertainty.
```

---

## 7. Go/no-go recommendation logic

Based on predicted score + critical issues + user's thresholds:

### Decision tree

```
IF any issue is severity=disqualifying:
    → "DO NOT SUBMIT. Disqualifying issues present."
    → List the disqualifying issues verbatim

ELIF predicted_score < (submittable threshold) OR (≥3 critical issues):
    → "Significant revision needed before submission."
    → List the top 3 reasons

ELIF predicted_score < (competitive threshold) OR (1–2 critical issues present):
    → "Light revision recommended."
    → Top 3 fixes with expected score impact

ELSE (score ≥ competitive threshold AND no critical issues):
    → "Submittable as-is, though minor polish available."
    → Note top 2–3 optional improvements
```

### Output format

```markdown
## Recommendation

**Submit as-is** / **Light revision recommended** / **Significant revision needed** / **DO NOT SUBMIT**

### Top 3 reasons

1. [Reason 1 — specific]
2. [Reason 2 — specific]
3. [Reason 3 — specific]

### Expected impact of revision

If the top 5 fixes are applied, predicted score moves from {current} to {projected} — {new placement bracket}.
```

The projected-score-after-revision is a sum of current score + the score_impact values for the top 5 prioritized fixes.

---

## 8. Prioritized fix list (for Writing Agent hand-off)

The fix list is the Writing Agent's input when iterating. It must be structured so the Writing Agent can parse it programmatically.

### Format

```markdown
## Prioritized fix list

<!-- This section is the input for the Writing Agent in revision mode. Each fix has a stable ID, a location, a suggested action, and an expected score impact. -->

### Fix 1 [FIX_ID: F1]
- **Priority**: 1
- **Severity**: critical
- **Score impact**: -5 pts on Data Quality
- **Issue**: Methodology claim in §3 ¶4 conflicts with cited source C7 (64% vs. actual 23%)
- **Location**: Section "Pembahasan Part 1", paragraph 4, sentence beginning "Penelitian menunjukkan peningkatan..."
- **Suggested fix**: Either find a source supporting 64% (re-run Research Agent for this claim) or revise the claim to match C7's actual 23% finding. Recommend the latter — 23% is still meaningful and aligns with your cited source.
- **Flagged by**: Judge 1, Judge 3
- **Expected score recovery**: +5 pts

### Fix 2 [FIX_ID: F2]
[Same structure]

[Up to ~10 for quick pass, ~20 for deep pass]
```

### Rules

- FIX_IDs are sequential (F1, F2, ...)
- Every fix must have a location and a suggested action — no vague entries
- Score impact notation matches the severity × impact system from section 1
- Expected score recovery is an estimate; labeled as such
- The fix list is the final section of the review file so it's easy for the Writing Agent to find

---

## 9. Output file structure

One file per review. Template:

```markdown
# Judge Panel Review — Draft v[N]
Generated: [YYYY-MM-DD] | Competition: [name] | Competition folder: [absolute path]
Draft reviewed: 03_essay_draft_v[N].md
Pass depth: [quick / deep]
Judges simulated: [N] ([list of names or archetypes])
Severity level: [harsh / balanced / gentle]
Output language: [ID/EN/mixed]

Review version: v[N] (matches draft version)
Previous reviews on this essay: [list of paths if any]

---

## Executive summary

**Predicted score**: [score]/[max] — **[placement bracket]**
**Recommendation**: [submit / light revision / significant revision / DO NOT SUBMIT]
**Confidence**: [high / medium / low]

[2–3 sentence narrative summary of the review]

---

## Judge panel

[List of personas with role/background/rubric ownership for each]

---

## Per-judge critique

[Section 4's template, repeated per judge]

---

## Consensus & contested synthesis

### Consensus issues
[Section 5 consensus format]

### Contested issues
[Section 5 contested format]

### Uncontested positives
[Section 5 positives format]

---

## Score prediction

[Section 6 full format]

---

## Recommendation

[Section 7 full format]

---

## Prioritized fix list

[Section 8 full format — the Writing Agent's input]

---

## Metadata

- Pass depth used: [quick/deep]
- Web searches run: [N] (if deep pass with named judges)
- Review run time: [timestamp]
- Risk factors noted: [any known panel biases the skill flagged as risks rather than roleplayed]
```

---

## 10. Versioning protocol

Review version matches the draft version reviewed:

- Reviewing `03_essay_draft_v1.md` → save as `07_judge_review_v1.md`
- Reviewing `03_essay_draft_v2.md` → save as `07_judge_review_v2.md`

If the user re-runs the skill on the same draft version:
- Ask: *"A review already exists for v{N}. Overwrite it, or save as `07_judge_review_v{N}_rerun_YYYYMMDD.md`?"*
- Default to asking; do not overwrite silently

This lets the user compare reviews across draft revisions (diff v1 review vs. v2 review to see whether score and issues improved).

---

## 11. Writing Agent hand-off protocol

The Writing Agent's revision mode reads the review file when iterating.

### What the Writing Agent reads

- The `## Prioritized fix list` section (parseable by FIX_ID)
- The `## Uncontested positives` list (elements NOT to touch in revision)
- The `## Score prediction` section (for targeting the specific criteria that need improvement)

### What the Writing Agent should NOT do

- Apply every fix uncritically — the user decides which fixes to apply at the revision checkpoint
- Touch uncontested positives
- Re-run score prediction on its own output (that's this skill's job on the next invocation)

### Feedback loop

After revision:
1. Writing Agent produces `03_essay_draft_v{N+1}.md`
2. User runs Supervisor Agent on v{N+1}
3. Supervisor produces `07_judge_review_v{N+1}.md`
4. Compare v{N} review to v{N+1} review — score delta shows whether revisions worked

If v{N+1} score is lower than v{N}, something went wrong in revision — surface this clearly: *"Score dropped from {X} to {Y} between v{N} and v{N+1}. Possible causes: new issues introduced, uncontested positives damaged."*

---

## 12. Quick vs. deep pass specifications

### Quick pass (~5 minutes)

- Read draft in full once
- No web research on judges (use composite personas even if judges named)
- 2–3 judges simulated (not the auto-derived count if it's 4–5)
- Per-judge critique: 1–2 "what works," 2–3 "what fails"
- Simplified score prediction (rough estimate, confidence marked as "low" regardless of agreement)
- Fix list: top 10 only
- Skip contested/consensus synthesis if only 2 judges

Output file has a `Pass depth: quick` header and explicit note that this is a sanity check, not a pre-submission review.

### Deep pass (~20–30 minutes)

- Full protocol as described in Steps 1–12
- Web research on named judges if any and user allowed
- Auto-derived judge count (2–5)
- Full per-judge critique (2–3 positives, 3–5 issues each)
- Full score prediction with confidence
- Full consensus/contested synthesis
- Fix list: top 20 or fewer if natural cap
- All sections of the output template populated

Output file has `Pass depth: deep` header.

---

## 13. Quality checks before saving

Run each. Fix any failure before saving.

### Draft and guidebook loading
- [ ] Draft was loaded in full
- [ ] Guidebook rubric extracted from `01_ideation.md`
- [ ] Chosen angle noted for thesis consistency check

### Judge personas
- [ ] Persona count matches user's choice or auto-derivation
- [ ] Each persona has rubric ownership mapped
- [ ] Named judges had web research run (if deep pass + user enabled)
- [ ] User confirmed personas before critique began

### Per-judge critique
- [ ] Every positive references a specific location (no "strong opening" without where)
- [ ] Every issue has SEVERITY × SCORE IMPACT labels
- [ ] Every issue cites a location (section/paragraph/Claim ID)
- [ ] Every issue has a suggested fix (no issues without actions)
- [ ] Per-criterion scoring populated for every criterion each judge owns
- [ ] Tone is consistent across judges (different focus, same measured voice)

### Consensus and contested
- [ ] Every consensus issue shows which judges flagged it
- [ ] Every contested issue shows the actual disagreement, not a false equivalence
- [ ] Uncontested positives list is populated

### Score prediction
- [ ] Per-criterion aggregation follows the weighted-ownership rule
- [ ] Total score computed correctly from per-criterion contributions
- [ ] Placement bracket uses user's thresholds (or defaults if user didn't specify)
- [ ] Confidence level stated with reasoning

### Recommendation
- [ ] Decision follows the tree in section 7
- [ ] Top 3 reasons are specific, not generic
- [ ] Projected-score-after-revision computed from top 5 fix score impacts

### Fix list
- [ ] Fix IDs are sequential (F1, F2, ...)
- [ ] Every fix has location + suggested action + expected score recovery
- [ ] Fix list is ordered by priority (score impact → judge count → severity)
- [ ] Cap respected (~10 for quick, ~20 for deep)

### Scope
- [ ] No comparison to other submissions
- [ ] No probability-of-winning claims
- [ ] No direct edits to the draft
- [ ] Any flagged judge biases are noted as risks, not roleplayed

### File
- [ ] Filename matches draft version (`07_judge_review_v{N}.md`)
- [ ] If previous review existed for this version, user was asked about overwrite
- [ ] Metadata header is complete

---

## 14. Common failure modes to avoid

- **Vague platitudes**: "strong argument," "could be clearer," "needs more depth." Every observation must be specific with a location.
- **Persona tone drift**: one judge starts sounding harsh, another sounds encouraging. Tone must be consistent; only focus differs.
- **Fabricated judge backgrounds**: inventing details when web research yields nothing. Report limited info honestly.
- **Score anchoring to the draft's apparent quality**: the skill should score against the rubric, not against "how good does this feel." A polished essay can still fail on originality; a rough essay can still excel on data rigor.
- **Ignoring disqualifying issues**: word count way over, missing required section, citations not matching source — these are disqualifying and must lead the review.
- **Cheerleading mode**: "great work overall" in the executive summary is not useful. If it's great, say why with specifics. If it's not, say what's not working.
- **Skipping the contested section**: every panel has disagreement. If the synthesis shows zero contested issues, the judges were probably too similar — check that personas genuinely differ in perspective.
- **Score inflation for user comfort**: predicting a score that's nicer than the analysis supports. Predicted score must follow from the per-criterion reasoning.
- **Rubric criterion invention**: scoring on criteria the guidebook doesn't use. Use only the criteria the actual rubric names.
- **Bias simulation**: pretending to be a biased judge. The skill's job is to flag bias as a risk factor, not enact it.
- **Fix list too long**: if there are 50 issues, the user will freeze. Cap at 20 for deep pass; the top 20 by score impact are what matter.
- **Fix list too short**: if there are only 2 fixes on a v1 draft, the skill probably didn't engage seriously. Expect 8–15 fixes for most v1 drafts.
- **Reviewing non-essay artifacts**: this skill is essay-only in its current scope. Refuse to review business plans or case solutions; suggest waiting for Business Agent/Consulting Agent to ship their own supervisor equivalents.

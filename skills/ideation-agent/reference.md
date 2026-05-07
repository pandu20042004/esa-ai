# Ideation Agent — Reference

This file holds the detailed specifications for the Ideation Agent skill. It is loaded during Step 1 of the workflow and guides Steps 2–8.

---

## 1. Guidebook extraction checklist

When reading the competition guidebook (Step 2), extract every item below. If any item is missing from the guidebook, say so explicitly — do not fabricate.

### Theme
- Official theme (exact wording, verbatim)
- Sub-themes or tracks (verbatim list)
- Any required framing or perspective ("from a youth perspective," "Indonesia-centric," etc.)

### Rubric
- Every scoring criterion with its weight/percentage
- Verbatim quotes of what each criterion means to the judges (e.g., "originality — the idea should not have been widely published elsewhere")
- Any disqualifying criteria (plagiarism rules, AI-use disclosures, scope limits)

### Format
- Word count or page count (min/max)
- Required sections (abstract, introduction, methodology, etc.)
- Citation style (APA, Chicago, informal, unspecified)
- Language requirement (Indonesian only / English only / either)
- Font, spacing, margin requirements (note, but do not belabor)

### Submission
- Deadline
- Submission channel
- File format requirements
- Any abstract/summary that must accompany the essay

### Judging signals
- Names or affiliations of judges if listed. This can inform angle choice — a judging panel of government policy researchers will reward different angles than a panel of entrepreneurs.
- Prior winners or examples referenced in the guidebook
- Stated preferences ("we favor practical implementation over theoretical analysis")

### Judging-signals fallback (when panel is not named)

If no judging panel is listed in the guidebook, do not guess at specific judges. Instead, infer the **judging center of gravity** using this procedure:

1. Identify the rubric criterion with the highest weight/percentage. This is the de facto center of gravity — often something like "kedalaman gagasan" (depth of idea), "originalitas," or "kualitas gagasan" (quality of the idea).
2. Read any explicit guidebook language about what judges value (e.g., "kami mengutamakan solusi yang dapat diterapkan" / "we prioritize implementable solutions").
3. Combine (1) and (2) into a 1-paragraph inferred judge profile.
4. In the guidebook summary output, label this paragraph with `**Judging signals (INFERRED, no panel named)**` so the user knows it is an assumption, not a fact.

If the highest-weighted criterion is "explanation of ideas" or equivalent, weight the angle strategy toward angles that can be explained clearly and deeply, not just proposed.

---

## 2. Web-search strategy for trend scanning

Run searches across three lanes. Keep queries tight (3–6 words). Vary queries — repeating the same query yields no new results.

### Lane 1 — News (last 3–6 months)
- Query the theme + "2026" or "2025" + "Indonesia"
- Query the theme + current events that may have reframed the discourse
- Query for policy shifts, viral moments, or public debates around the theme
- Target: 3–5 current discourse signals

### Lane 2 — Academic (2024–2026)
- Query the theme + "research 2025" or "study 2025"
- Look for emerging frameworks, meta-analyses, or provocative papers
- Prefer open-access sources the user could realistically cite
- Target: 2–3 academic framings

### Lane 3 — Indonesian context
- Query the theme + "Indonesia" + specific institutions (BPS, BRIN, Kemenkes, Kemendikbud, etc., depending on relevance)
- Query Indonesian-language equivalents of the theme
- Look for local case studies, regional specifics, Indonesian NGO or academic work
- Target: 2–3 Indonesia-grounded angles

### Rules
- Do not use the same search query twice
- Do not exceed 10–12 total searches at this ideation stage (deep research is the Research Agent's job)
- Favor original sources over aggregators
- Note conflicting information rather than picking a side
- If a source is paywalled, note the title and don't pretend to have read the content

---

## 3. Angle structure specification

Each of the 5 angles must contain these 6 fields:

### Field 1 — Angle title
One line. Sharp. Ideally 6–12 words. A working title, not a marketing hook.

Bad: *"Essay about education"*
Better: *"Why Indonesia's vocational schools are winning where universities are losing"*

### Field 2 — Core thesis
1–2 sentences stating the argument the essay would make. Must be a claim, not a topic.

Bad: *"This essay explores digital literacy in rural areas."*
Better: *"Rural digital literacy in Indonesia is not failing because of infrastructure gaps but because top-down training ignores existing community learning networks."*

### Field 3 — Why timely
Specific trend, event, policy, or data point that makes this angle current **now**. Cite the trend brief from Step 4. Vague timeliness ("AI is growing") is unacceptable — point to concrete recent signals.

### Field 4 — Guidebook fit
Name which specific rubric criteria this angle serves, quoting the guidebook's language where possible. Example: *"Originality (25%): this angle inverts the default 'infrastructure-first' framing most entries will take, directly hitting the judges' stated preference for 'fresh perspectives on familiar problems.'"*

### Field 5 — Risks
2–4 concrete weaknesses. Examples of real risks:
- Angle is a cliché in this competition's recent winners
- Data availability is thin for Indonesian context
- Angle requires primary research user cannot do in time
- Angle risks misreading of judging panel's known leanings
- Thesis is provocative but hard to close with actionable implication

Do not invent soft risks to look balanced. If an angle has no real risks, say "no significant risks identified" and explain why.

### Field 6 — Style profile fit
Only populate if a style profile was loaded. Three possible values:
- **Natural fit**: the angle plays to patterns already in the user's voice (e.g., Indonesian-data-driven openings, problem-solution arcs)
- **Requires stretch**: the angle is viable but pushes into territory less practiced in the user's past work
- **Against your voice**: the angle would require writing in a register or structure the user's past work avoids

Include one-line reasoning for each verdict.

---

## 4. Slot strategy — default and custom

### Default mix (used if user does not customize)

| Slot | Purpose |
|---|---|
| 1 | Safe, high-rubric-fit: hits the guidebook's stated preferences head-on |
| 2 | Distinctive: takes a familiar theme from an unusual entry point |
| 3 | Contrarian: inverts the default framing most entries will use |
| 4 | Indonesian-context-specific: leverages a local case, data set, or institution others won't use |
| 5 | Wildcard: the angle that wouldn't survive a committee but might win a bold judge |

### Custom mix

If the user specifies a custom mix in the upfront questions (e.g., "3 contrarian + 2 safe," "all Indonesian-specific"), honor it — but if the requested mix produces clustering (e.g., "5 safe"), warn the user once before proceeding.

### "You decide" option

If the user says "you decide," pick the mix based on guidebook signals:
- **Rigid rubric + conservative judging panel** → heavy on safe/high-rubric-fit (e.g., 2 safe / 1 distinctive / 1 Indonesian-specific / 1 wildcard)
- **Rubric explicitly rewards originality** → heavy on contrarian/wildcard (e.g., 1 safe / 1 distinctive / 2 contrarian / 1 wildcard)
- **Indonesia-centric theme** → heavy on Indonesian-context-specific (e.g., 1 safe / 1 distinctive / 2 Indonesian-specific / 1 contrarian)
- **Ambiguous** → use the default mix

Whichever mix is used, label each angle with its slot in the output file so the user sees the logic.

---

## 5. Quality checks before saving

Before Step 8 (Save), verify each item. If any fails, fix before saving.

- [ ] Guidebook summary exists at top of file and was confirmed by user
- [ ] If OCR was used, the OCR text has been verified by the user
- [ ] All 5 angles have all 6 fields populated
- [ ] Angles do not cluster unintentionally — each serves its intended slot purpose
- [ ] Slot labels are present on every angle
- [ ] Timeliness claims cite specific trends from the Step 4 brief, not generic handwaving
- [ ] Guidebook-fit fields quote actual guidebook language where possible
- [ ] Risks are concrete, not padding
- [ ] Style-profile-fit is populated if profile was loaded; omitted if not
- [ ] Chosen angle is clearly marked at the top under `## CHOSEN ANGLE`
- [ ] Output language matches what the user requested
- [ ] Competition folder path is written into the file's metadata
- [ ] If in iteration mode, previous rounds are preserved per section 7 below

---

## 6. Output file template (fresh ideation mode)

```markdown
# Ideation — [Competition Name]
Generated: [YYYY-MM-DD] | Competition folder: [absolute path] | Output language: [ID/EN/mixed]
Style profile: [path or "not used"]
Slot strategy: [default / custom spec / "AI-chosen based on guidebook"]

---

## CHOSEN ANGLE

### [Title of chosen angle]
**Slot**: [slot name]
**Core thesis**: [1–2 sentences]
**Why timely**: [specific trend/event]
**Guidebook fit**: [rubric alignment]
**Risks**: [concrete weaknesses]
**Style profile fit**: [verdict + reasoning, or "not evaluated"]

---

## Guidebook summary

### Theme
[Verbatim theme + sub-themes]

### Rubric
[Criteria with weights, verbatim]

### Format
[Length, structure, citation, language requirements]

### Submission
[Deadline, channel, format]

### Judging signals
[Panel info if listed, OR inferred center-of-gravity paragraph labeled "INFERRED"]

---

## Trend brief

### Current discourse (last 3–6 months)
- [Bullet]

### Academic framings (2024–2026)
- [Bullet]

### Indonesian context
- [Bullet]

---

## All 5 angles considered

### Angle 1 — [Slot label]
**Title**: [...]
**Core thesis**: [...]
**Why timely**: [...]
**Guidebook fit**: [...]
**Risks**: [...]
**Style profile fit**: [...]

### Angle 2 — [Slot label]
[same structure]

### Angle 3 — [Slot label]
[same structure]

### Angle 4 — [Slot label]
[same structure]

### Angle 5 — [Slot label]
[same structure]

---

## Next step
Trigger the Research Agent to deep-research the chosen angle. It will read this file and begin.
```

---

## 7. Iteration mode — file structure

If the user is in **iteration mode** (existing `01_ideation.md` found in Step 1), handle the file based on which iteration path they chose:

### Path (a) — Add more angles

Preserve the original file and add a new round:

```markdown
# Ideation — [Competition Name]
[Same metadata header]
Rounds: 2 (latest: YYYY-MM-DD)

---

## CHOSEN ANGLE
[Updated if user picks from new round. Otherwise leave previous choice.]

---

## Guidebook summary
[Unchanged from round 1]

---

## Trend brief
[Unchanged from round 1 — unless 2+ weeks have passed, in which case re-scan and label as "Updated YYYY-MM-DD"]

---

## All angles considered

### Round 1 (generated YYYY-MM-DD)
#### Angle 1 — [Slot]
[full 6-field content]
#### Angle 2 — [Slot]
[full 6-field content]
[... through Angle 5]

### Round 2 (generated YYYY-MM-DD)
#### Angle 6 — [Slot]
[full 6-field content]
#### Angle 7 — [Slot]
[full 6-field content]
[... through Angle 10]

---

## Next step
[Same as before]
```

**Anti-duplication rule**: before generating round 2 angles, read round 1 angles carefully. Do not regenerate the same thesis with different wording. If a round 2 angle overlaps substantively with a round 1 angle, flag it and replace with a genuinely new angle.

### Path (b) — Refine specific existing angles

Edit the specific angle(s) in place. Annotate each change with an HTML comment so the user can see what changed:

```markdown
#### Angle 2 — [Slot] <!-- refined YYYY-MM-DD -->
**Title**: [new title]
**Core thesis**: [new thesis]
[... updated fields]
```

Preserve all other angles unchanged. If the refined angle is the user's new choice, update `## CHOSEN ANGLE` at the top.

### Path (c) — Start fresh

Rename the old file to `01_ideation_archive_{YYYYMMDD}.md` in the competition folder. Create a new `01_ideation.md` using the fresh ideation mode template in section 6. Do not import anything from the archived file.

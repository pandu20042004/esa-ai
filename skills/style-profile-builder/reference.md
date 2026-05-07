# Style Profile Builder — Reference

This file holds the detailed specifications for the Style Profile Builder skill. It is loaded during Step 2 of the workflow and guides Steps 3–9.

---

## 1. The 8 style dimensions

For each dimension, extract concrete patterns. Where possible, express findings as numbers, ratios, or named categories — not vague prose.

### Dimension 1 — Structural patterns
- **Opening type**: statistic / anecdote / provocation / quote / scenario / public-data statement / historical reference. Identify which type dominates.
- **Essay arc**: problem-solution / chronological / compare-contrast / dialectical / thesis-evidence-implication / funnel (broad-to-narrow).
- **Closing type**: call to action / reframe / prediction / synthesis / return-to-opening / rhetorical question.

### Dimension 2 — Sentence rhythm
- Average sentence length in words
- Shortest-to-longest range within typical paragraphs
- Ratio of short punchy sentences (<10 words) to long analytical sentences (>25 words)
- Use of sentence fragments or one-word sentences for emphasis (yes/no, frequency)

### Dimension 3 — Vocabulary fingerprint
- Recurring words/phrases the user favors (produce a list)
- Register: formal academic / semi-formal / accessible-expert / hybrid
- Indonesian-specific rhetorical devices, idioms, culturally-loaded terms (preserve verbatim in Indonesian)
- Technical jargon density (high / medium / low) and whether jargon is defined on first use

### Dimension 4 — Argument moves
- How evidence is introduced — capture 5+ verbatim phrasings ("Data BPS menunjukkan...", "A 2024 study found...", etc.)
- How counterarguments are handled: steelman / dismiss / concede-then-redirect / ignore
- Transition phrases between sections (list verbatim examples)

### Dimension 5 — Voice markers
- First-person use: none / sparing / frequent, and where (intro only? throughout?)
- Rhetorical questions: frequency, typical placement (opening / mid-argument / closing)
- Analogies and metaphors: frequency, source domains (nature / technology / daily life / sports / history / economics)

### Dimension 6 — Formatting habits
- Subheading style: numbered / descriptive / question-form / bold-only / none
- Average paragraph length in sentences
- Use of lists, blockquotes, emphasis (bold/italic)

### Dimension 7 — Citation style
- Inline / footnote / endnote / parenthetical
- Indonesian sources vs international — ratio and how each is framed
- Data-point density per 1,000 words (approximate)
- Citation formatting consistency (APA / Chicago / informal / mixed)

### Dimension 8 — Opening & closing signatures
- Recurring phrases or moves to *start* essays (list verbatim)
- Recurring phrases or moves to *end* essays (list verbatim)
- Any signature rhetorical flourishes unique to the user

---

## 2. Scientific essay (KTI) section

Most of the user's winning essays are scientific (KTI-style). Produce a dedicated profile section covering:

- How data and statistics are presented and contextualized (pure-data drops vs narrative framing)
- How methodology or problem-solution structure is laid out (explicit sections vs woven in prose)
- Ratio and framing of Indonesian academic sources vs international sources
- Technical-to-accessible language balance: does the user assume a peer-level reader, a policy-maker reader, or a general-educated reader?
- Use of diagrams, tables, or figures and how they are referenced in prose

---

## 3. Verbatim example categories

Collect the following from across the source PDFs. Label every snippet with a **clean, human-readable source label** (e.g., "KTI Lingkungan 2023 — UGM"), not the raw filename.

| Category | Quantity | Purpose |
|---|---|---|
| Opening paragraphs | 3–5 | Calibrates how to start |
| Closing paragraphs | 3–5 | Calibrates how to end |
| Argument introductions | 3–5 | How claims are set up |
| Evidence integrations | 3–5 | How data/citations weave into prose |
| Section transitions | 3–5 | How movement between ideas happens |

Total target: 15–25 verbatim snippets. Preserve all Indonesian text exactly as written — no translation, no paraphrasing.

---

## 4. Language policy — hybrid

The profile file uses **English scaffolding + Indonesian verbatim content**.

**Rules:**

1. **Section headers, directives, meta-rules, analytic labels**: English.
2. **Word lists, rhetorical phrase patterns, verbatim examples, Indonesian-specific devices**: Indonesian, untouched.
3. **When an Indonesian pattern needs explanation**, the surrounding instruction is English but the pattern itself stays Indonesian.

**Rationale (do not include this in the output file, just follow it):**
- English directives are parsed more reliably by downstream AI skills.
- Indonesian style elements lose precision when translated.
- Mixing is optimal, not a compromise.

**Example of correctly formatted directive:**

> **Opening signature pattern**: Open with a public-data statement using the construction: "Data [lembaga resmi] [tahun] menunjukkan [statistik mengejutkan]." Verbatim example from [KTI Lingkungan 2023 — UGM]: "*Data BPS 2023 menunjukkan bahwa 64 persen pemuda Indonesia masih belum...*"

The directive is English. The template syntax is Indonesian. The example is verbatim Indonesian.

---

## 5. Output file template

The saved profile must follow this structure exactly:

```markdown
# Style Profile — [User's name or collection label]
Generated: [YYYY-MM-DD] | Based on: [N] essays | Version: [N]

## How to use this file
[One paragraph, English, instructing the Writing Agent how to apply these rules. State: "Load this file before drafting. Apply every rule below unless a specific competition guidebook overrides it."]

## 1. Structural Rules
[English directives with numeric targets where relevant]

## 2. Sentence Rhythm Rules
[English directives with numeric targets]

## 3. Vocabulary Rules
[English directives; Indonesian word/phrase lists verbatim]

## 4. Argument Move Rules
[English directives; Indonesian example phrases verbatim]

## 5. Voice Marker Rules
[English directives]

## 6. Formatting Rules
[English directives]

## 7. Citation Rules
[English directives]

## 8. Opening & Closing Signatures
[English directives + Indonesian example phrases verbatim]

## 9. Scientific Essay (KTI) Rules
[English directives specific to scientific-essay structure]

## 10. Voice Calibration — Verbatim Examples
### Opening samples
[3–5 verbatim openings, each labeled with clean source label]

### Closing samples
[3–5 verbatim closings, each labeled with clean source label]

### Argument introduction samples
[3–5 verbatim argument openers]

### Evidence integration samples
[3–5 verbatim passages showing how data is woven in]

### Section transition samples
[3–5 verbatim transitions]

## 11. Source essays analyzed
[Bulleted list using clean labels, each followed by a brief 1-line description — competition name, year, topic]
```

---

## 6. Quality checks before saving

Before Step 10 (Save), verify each item. If any fails, fix before saving.

- [ ] Every rule is phrased as a directive, not a description
- [ ] Every verbatim example is labeled with a clean source label (not a raw filename)
- [ ] Indonesian phrases appear untouched where relevant
- [ ] English is used for all scaffolding and meta-rules
- [ ] Numeric targets are included wherever possible (not "short sentences sometimes" but "30–40% of sentences under 10 words")
- [ ] The Scientific Essay section is present and specific
- [ ] The "How to use this file" section is written for an AI reader, not a human reader
- [ ] All 11 sections of the output template are populated
- [ ] Verbatim snippet count falls within 15–25 total

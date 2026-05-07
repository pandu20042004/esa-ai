# Research Agent — Reference

This file holds the detailed specifications for the Research Agent skill. It is loaded before any research begins and guides the entire workflow.

---

## 1. The Citation Table — core anti-hallucination mechanism

The Citation Table is the skill's central artifact. It is the gatekeeper: the Writing Agent is only allowed to cite claims that have a row in this table. No row, no citation.

### Schema (data fields)

Every entry in the Citation Table has these fields:

| Field | Description |
|---|---|
| `Claim ID` | Unique identifier: `C1`, `C2`, ... `C40`. Counterarguments use `CC1`, `CC2`, etc. |
| `Sub-claim` | Which sub-claim (SC1, SC2, ...) from the thesis decomposition this supports. Counterarguments use `[COUNTER]` instead of a sub-claim. |
| `Claim (1 sentence)` | The specific claim being made, in one sentence, in the output language. |
| `Claim type` | `quantitative` (involves a specific number/statistic/measured finding) or `general` (trend, argument, framework). Determines verification mode. |
| `Supporting verbatim passage` | The exact text from the source that supports the claim. Untranslated. Use ellipses (...) for omitted middle text but keep both ends verbatim. |
| `Passage location` | Page number, section, or paragraph indicator if available. |
| `Source title` | Full title of the source, verbatim. |
| `Author(s)` | Author(s) as listed in the source. |
| `Year` | Publication year. |
| `DOI` | Required for academic papers. Format: `10.xxxx/xxxx`. |
| `URL` | Stable URL. Required if DOI absent or for non-academic sources. |
| `Source type` | Academic / Government data / Institutional report / News / Expert commentary |
| `Quality label` | A / B / C / D per the hierarchy in section 3 |
| `Access note` | Empty, or `[ABSTRACT ONLY]`, or `[USER-PROVIDED PDF]`, or `[OPEN ACCESS]` |

### Hybrid format (see section 7 for full templates)

The Citation Table is rendered in two complementary formats in the output file:

1. **Compact overview table** at the top — one row per citation, narrow columns for fast scanning (Claim ID, Sub-claim, 1-line claim, Source short-label, Quality, Type, Access note).
2. **Full cards** below — one card per citation, containing all 14 fields above including the full verbatim passage.

Both views are mandatory. The overview lets the Writing Agent (and the user) see the full evidence map at a glance; the cards enable verification.

---

## 2. Web-search strategy

Run searches in lanes, matched to each sub-claim.

### General rules
- Keep queries tight (3–6 words)
- Vary queries — repeating the same query returns no new results
- Do not exceed 3 searches per sub-claim per lane without a productive result
- If a search lane is saturated (returning duplicates), move on
- Record every search query run (internally) to avoid duplication

### Lane 1 — Academic (always try first; see A-first descent rule in section 3)
- Query the sub-claim + author names of known researchers in the field
- Query sub-claim keywords + "study" / "research" / "evidence" / "meta-analysis"
- Query Indonesian academic databases: "Sinta Ristekbrin," "Garuda Kemdikbud," "journal [discipline] Indonesia"
- Google Scholar queries for DOI-bearing papers
- Prefer 2020–2026 unless a foundational older paper is essential

### Lane 2 — Government data
- Indonesian institutions: BPS (statistics), BRIN (research), Kemenkes (health), Kemendikbud (education), BAPPENAS (planning), Kemenkop UKM, Kominfo, etc. — match to the thesis
- Query "[institution name] + [topic] + data" or "[institution] + statistik + [topic]"
- International when relevant: World Bank Indonesia, WHO Indonesia, UN data Indonesia

### Lane 3 — Institutional reports
- Think tanks (CIPS, SMERU, CSIS Indonesia)
- International NGOs (UNICEF Indonesia, Save the Children, etc.)
- Development banks (World Bank, ADB)

### Lane 4 — News
- Kompas, Tempo, Jakarta Post, Antara, Detik, CNN Indonesia, Reuters Indonesia
- Use news for recency signals, public discourse, policy announcements — rarely as primary evidence

### Lane 5 — Expert commentary
- Op-eds from credentialed experts
- Think tank blogs from named researchers
- Use sparingly; label as C or D quality

### Counterargument lane (if scope includes)
- Invert the sub-claim: search for evidence that contradicts or qualifies it
- Query "[thesis keyword] + critique" / "[thesis keyword] + limitations" / "[thesis keyword] + failed"
- Seek genuine opposition, not strawmen
- Apply the A-first descent rule

---

## 3. Source quality hierarchy and the A-first descent rule

Every source gets a letter grade.

| Label | Type | Criteria |
|---|---|---|
| **A** | Highest-quality | Peer-reviewed academic papers with DOI; official government primary data; major international body reports (World Bank, WHO) with full methodology |
| **B** | High-quality | Institutional reports with named methodology; Indonesian government ministry publications; credible think tanks; pre-print papers from established researchers |
| **C** | Acceptable | Mainstream news (Kompas, Tempo, Jakarta Post, Reuters); expert op-eds from credentialed sources; well-documented NGO reports |
| **D** | Supplementary only | Blog posts, commentary without clear sourcing, social media expert threads. Use only for context, never as primary evidence for a quantitative claim. |

### A-first descent rule (no fixed mix)

**There is no target quality mix.** The goal is the highest possible quality for each sub-claim. Procedure:

1. For every sub-claim, start searching in Lane 1 (Academic, A-quality candidates).
2. Exhaust reasonable A-quality search attempts before descending to B-quality sources.
3. Only descend to B when A is demonstrably unavailable for that specific sub-claim — for example, after multiple varied academic queries return nothing relevant, or when the claim is necessarily about a non-academic subject (e.g., a current policy announcement that only exists in news).
4. Same rule for B → C, and C → D.
5. **If 100% A-quality is achievable across all sub-claims, pursue it.** Do not stop at B because B was found first.
6. Record each descent decision. If a sub-claim ends up supported only by B or C sources, note in the coverage map *why* A was not found ("no peer-reviewed Indonesian study on this topic in 2020–2026").

D-label sources are for context only — never primary evidence for a quantitative claim.

### Implication for counterarguments

Counterarguments follow the same A-first rule. A weak-source counterargument is a weak rebuttal opportunity — the Writing Agent needs real opposition to steelman.

---

## 4. Verification modes — strict vs. moderate

This is how the skill decides whether a verbatim passage actually supports a claim.

### Strict mode — for quantitative claims

A quantitative claim is one that involves a specific number, statistic, percentage, rate, or measured finding.

**Strict rule**: the verbatim passage must contain the specific number or measurement being cited.

Example:
- Claim: *"Rural digital literacy programs improved test scores by 34%."*
- Acceptable passage: *"The intervention produced a 34% increase in test scores compared to control."*
- Unacceptable passage: *"The intervention produced significant increases in test scores."*

If the passage does not contain the number, reject the citation. Either find a passage that does, or reformulate the claim to match what the passage actually says.

### Moderate mode — for general claims

A general claim is a trend, argument, framework, or interpretive statement without a specific number.

**Moderate rule**: the passage must clearly support the claim's direction and substance, even if the wording differs.

Example:
- Claim: *"Top-down digital literacy programs have been criticized for ignoring local context."*
- Acceptable passage: *"Programs designed without community input frequently fail to engage local learners and sustain participation."*
- Unacceptable passage: *"Digital literacy is important for Indonesia's future."* (topical relevance only, not support)

### Classification rule

Auto-classify each claim as `quantitative` or `general` when adding to the Citation Table. If unclear, default to `quantitative` (stricter).

---

## 5. Access and paywall handling

### Open-access full text
Read and cite freely. Label: `[OPEN ACCESS]`.

### Paywalled, abstract accessible
The abstract is readable and serves as the available text. Options:

1. **If the claim is supported by the abstract**: accept. Label: `[ABSTRACT ONLY]`. The Writing Agent will know this claim cannot be deeply expanded without the full text.

2. **If the claim appears to be supported by the full text but not the abstract**: do not fabricate. Flag to the user: *"Strong candidate — paper title, authors, DOI — but full-text not accessible. Can you provide the PDF?"* If user provides PDF, treat as `[USER-PROVIDED PDF]` and verify against the full text.

3. **If abstract is clearly unhelpful**: reject the source and record in Rejected Candidates with reason "abstract did not support any sub-claim."

### No access at all (paywall + no abstract)
Reject. Record in Rejected Candidates with reason "no accessible text for verification."

### DOI validation

Before accepting any academic paper:
- Check that the DOI resolves (if possible)
- If the DOI format is malformed or the paper is suspicious, flag and seek an alternate source

Never fabricate a DOI. If a paper has no DOI and is not an academic paper, that's fine; if it claims to be an academic paper with no DOI, reject.

---

## 6. Output file template — `02_research_main.md`

```markdown
# Research Brief — [Competition Name]
Generated: [YYYY-MM-DD] | Competition folder: [absolute path] | Output language: [ID/EN/mixed]
Source count: [N] (A: [x] / B: [x] / C: [x] / D: [x])
Counterarguments: [N]
Rejected candidates: [N]
Citation Table: see `02_research_sources.md`

---

## Chosen angle recap
**Thesis**: [verbatim from 01_ideation.md]
**Slot**: [slot label]

---

## Sub-claims decomposition

### SC1 — [sub-claim label]
**Claim**: [1–2 sentences]
**Evidence strength**: Strong / Moderate / Thin
**Supporting Claim IDs**: C1, C3, C7, C12
**Quality of supporting evidence**: [e.g., "4 A-label, 0 B-label" or "1 A, 2 B — A-quality was exhausted for this sub-claim because..."]
**Key finding**: [1–2 sentence synthesis of what the evidence collectively shows — organized summary, not interpretation in skill's voice]

### SC2 — [sub-claim label]
[same structure]

### SC3 — [sub-claim label]
[same structure]

[etc. through all sub-claims]

---

## Counterarguments

### Opposing claim 1 — [label]
**Counter-claim**: [1–2 sentences]
**Supporting Claim IDs**: CC1, CC3
**Strongest challenge to thesis**: [which sub-claim it most threatens]

### Opposing claim 2 — [label]
[same structure]

---

## Evidence gaps

Claims the angle needs but research could not verify:
- [Gap 1 — what is missing, which sub-claim it affects]
- [Gap 2 — ...]
- [Gap 3 — ...]

---

## Coverage map

| Sub-claim | Evidence strength | Quality breakdown | Notes |
|---|---|---|---|
| SC1 | Strong | 4A, 2B | Well-supported |
| SC2 | Moderate | 1A, 3B | Indonesian A-quality thin, B-quality Indonesian reports fill the gap |
| SC3 | Thin | 0A, 1B, 2C | No Indonesian academic studies found; relying on news and one think tank report |
| ... | ... | ... | ... |

---

## Sources overview

Brief one-line description of each source, organized by quality label. Full details in `02_research_sources.md`.

### A-label sources
- [Author, Year — title — what it provides]
- ...

### B-label sources
- ...

### C-label sources
- ...

### D-label sources (if any)
- ...

---

## Next step
Trigger the Writing Agent. It will read this file, `02_research_sources.md`, the style profile, and the guidebook, then draft the essay using only verified citations.
```

---

## 7. Output file template — `02_research_sources.md` (hybrid format)

```markdown
# Citation Table — [Competition Name]
Generated: [YYYY-MM-DD] | Source count: [N]

This file is the **gatekeeper**. The Writing Agent may only cite claims listed here. Every card has a verified verbatim passage from the named source. To crosscheck any card, open the DOI/URL and locate the passage.

If a needed claim is not in this table, the Writing Agent must flag it to the user, not fabricate a citation.

---

## Compact overview table

| ID | Sub-claim | Claim (1 line) | Source (short) | Year | Quality | Type | Access |
|---|---|---|---|---|---|---|---|
| C1 | SC1 | Rural literacy gap is 34% | Wijaya & Santoso | 2024 | A | quantitative | [OPEN ACCESS] |
| C2 | SC1 | Rural programs lag urban by 2 years | BPS Statistik Pendidikan | 2025 | A | quantitative | [OPEN ACCESS] |
| C3 | SC2 | Programs use top-down model | Kemendikbud Report | 2024 | B | general | [OPEN ACCESS] |
| ... | ... | ... | ... | ... | ... | ... | ... |
| CC1 | [COUNTER] | Top-down scales faster in rollout year | Suryadi | 2023 | A | quantitative | [ABSTRACT ONLY] |

---

## Full citation cards — Supporting evidence

### C1
- **Sub-claim**: SC1
- **Claim**: [One sentence stating the claim this source supports]
- **Claim type**: quantitative / general
- **Verbatim passage**: 
  > [Exact quoted text from the source, untranslated. Use ellipses (...) for omissions but preserve both ends verbatim.]
- **Passage location**: [page, section, or paragraph]
- **Source**: [Full title]
- **Author(s)**: [Names]
- **Year**: [YYYY]
- **DOI**: [10.xxxx/xxxx or "none"]
- **URL**: [stable URL]
- **Source type**: Academic / Government data / Institutional report / News / Expert commentary
- **Quality label**: A / B / C / D
- **Access note**: [OPEN ACCESS] / [ABSTRACT ONLY] / [USER-PROVIDED PDF] / [blank]

### C2
[same structure]

### C3
[same structure]

[... through all supporting citations]

---

## Full citation cards — Counterargument evidence

### CC1
- **Tag**: [COUNTER]
- **Counter-claim**: [One sentence — the opposing view]
- **Which sub-claim it challenges**: SC3
- **Claim type**: quantitative / general
- **Verbatim passage**: 
  > [Exact quoted text]
- **Passage location**: [...]
- **Source**: [...]
- **Author(s)**: [...]
- **Year**: [...]
- **DOI**: [...]
- **URL**: [...]
- **Source type**: [...]
- **Quality label**: [...]
- **Access note**: [...]

### CC2
[same structure]

[... through all counterargument citations]

---

## Rejected candidates

Sources considered but rejected. Every rejected source is recorded here with the exact reason so the user can audit the decision.

Use these reason categories:

- **[VERIFICATION FAILED]** — verbatim passage did not actually support the specific claim
- **[QUANTITATIVE MISMATCH]** — passage discussed the topic but did not contain the specific number/statistic needed
- **[NO DOI]** — claimed to be academic paper but no DOI found; academic papers require DOI
- **[DOI INVALID]** — DOI did not resolve or appeared fabricated
- **[NO ACCESS]** — paywalled with no abstract or other text available
- **[ABSTRACT INSUFFICIENT]** — only abstract available, and abstract did not support any sub-claim
- **[SOURCE QUALITY BELOW D]** — unverifiable blog post, anonymous source, or circular citation
- **[IRRELEVANT]** — topical match only, not substantive support for any sub-claim
- **[DUPLICATE]** — same finding already cited from a better source

Format:

- **[Source title]** — [Author, Year] — Reason: [category + 1-sentence explanation]
- **[Source title]** — [Author, Year] — Reason: [...]
- ...
```

---

## 8. Quality checks before saving

Run each item before Step 13. If any fails, fix before saving.

- [ ] `01_ideation.md` was read and chosen angle extracted
- [ ] Preflight PDFs (if any) were processed before web search
- [ ] Sub-claims were decomposed and confirmed by user
- [ ] Source count meets target (or user approved stopping early)
- [ ] Source count is at or above the 15-minimum floor
- [ ] A-first descent rule was applied: sub-claims not 100% A-quality have an explanation for why A was exhausted
- [ ] Every row in the Citation Table has all required fields populated
- [ ] Every verbatim passage was verified as actually appearing in the cited source
- [ ] Every quantitative claim has a passage containing the specific number
- [ ] Every general claim has a passage directly supporting the claim's direction
- [ ] Every academic paper has a DOI (or was rejected)
- [ ] Non-academic sources have stable URLs
- [ ] `[ABSTRACT ONLY]` sources are labeled correctly
- [ ] `[USER-PROVIDED PDF]` sources are labeled correctly
- [ ] Counterargument section is populated (unless user skipped it)
- [ ] Counterargument citations follow the same verification rules as supporting citations
- [ ] Evidence gaps are explicitly listed
- [ ] Coverage map shows strength and quality breakdown per sub-claim
- [ ] Rejected candidates are recorded with reason categories
- [ ] Output language matches user's request
- [ ] Both files have matching metadata headers
- [ ] `02_research_main.md` references Claim IDs correctly — every ID cited in main.md exists in sources.md
- [ ] Compact overview table in sources.md matches the full cards below (no orphan IDs)

---

## 9. Common failure modes to avoid

- **Padding to hit source count**: adding weak sources just to reach the target. Refuse — report saturation honestly.
- **Cherry-picking**: only collecting supporting evidence and ignoring counterevidence. Always run counterargument lane if in scope.
- **Passage stretching**: accepting a passage that "sort of" supports the claim. Apply strict/moderate modes honestly.
- **Settling at B before exhausting A**: the A-first descent rule is not negotiable. Never accept B when more A-quality searches are productive.
- **Vague Claim IDs**: reusing IDs or skipping numbers. Keep IDs sequential.
- **Translation creep**: translating Indonesian verbatim passages "for clarity." Do not translate — preserve source language exactly.
- **Invented DOIs**: fabricating a DOI because the source "probably has one." If no DOI found, mark "none" and reject if the source type is academic.
- **Silent rejection**: dropping a source without recording it in Rejected Candidates. Every rejection must be logged with a reason category.
- **Prescribing to the Writing Agent**: telling the Writing Agent which citation to use where. That is the Writing Agent's decision. Your job is to provide a verified, organized dossier.
- **Overwriting prior research**: if the user re-runs the Research Agent on the same competition, ask whether to extend or replace, same as the Ideation Agent's iteration handling.

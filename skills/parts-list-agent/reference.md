# Parts List Agent — Reference

This file holds the detailed specifications for the Parts List Agent skill.

---

## 1. Parts list schema

Each component entry has the following fields:

| Field | Description |
|---|---|
| `Component ID` | Unique identifier: `P1`, `P2`, ... `P40`. Sequential across the entire list, not per subsystem. |
| `Subsystem` | Which logical subsystem the component belongs to (optical / processing / interface / communication / power / housing / etc.) |
| `Component name` | Specific product name and model number when applicable (e.g., "ESP32-DevKitC-32UE," not just "microcontroller") |
| `Specification summary` | 1–2 lines of key specs (voltage, current, range, resolution, etc.) |
| `Quantity` | Number needed per prototype |
| `Primary supplier` | Supplier name |
| `Primary supplier URL` | Direct product URL that must resolve |
| `Primary unit price` | Numeric value + currency (IDR / USD) |
| `Total (primary)` | unit price × quantity |
| `Dimensions` | L × W × H (or D × L for cylindrical). Essential for Prototype Design Agent integration. |
| `Weight` | If available; otherwise blank |
| `Alternative supplier(s)` | Name + URL |
| `Alternative unit price` | Numeric + currency |
| `Datasheet URL` | If applicable |
| `Notes` | Stock/compliance/compatibility flags, or blank |

---

## 2. Sourcing-verification rules

Every component entry must pass these checks before being added to the list.

### Required verifications

1. **URL resolves** — the supplier URL must return a product page, not a 404 or a homepage redirect. Verify before recording.
2. **Price visible** — the price must be visible on the page at the time of research. If the page says "Contact for pricing" or "Out of stock," note this in the `Notes` field and seek an alternative.
3. **Product matches spec** — the listed product must actually meet the functional requirement from Step 3 of the workflow. Do not accept a similar-but-different component.
4. **Dimensions obtainable** — dimensions must come from the product listing, a linked datasheet, or careful measurement from product images (last resort, noted in `Notes`).
5. **Currency explicit** — price field must state the currency explicitly. No ambiguous numbers.

### Rejection categories

Use these explicit reasons when a candidate fails:

- **[URL_INVALID]** — link did not resolve to a product page
- **[PRICE_MISSING]** — no price visible on the page
- **[SPEC_MISMATCH]** — product doesn't meet the required specification
- **[OUT_OF_STOCK]** — listing shows unavailable with no restock date
- **[DIMENSIONS_UNAVAILABLE]** — no dimensions findable from any source
- **[COMPLIANCE_RISK]** — component requires certification the user may not have (regulated radio power, medical-grade, etc.)
- **[SHIPPING_PROHIBITIVE]** — international-only with shipping cost exceeding component price
- **[SUPPLIER_UNRELIABLE]** — marketplace seller has very poor ratings or recent complaints

Record rejections in a "Rejected candidates" section at the bottom of the parts list file so the user sees what was filtered out.

### Never do

- Fabricate URLs, prices, or dimensions to fill gaps
- Use a price from a prior year's snapshot if the current page doesn't show it
- Accept "typical price" estimates from forum threads as primary pricing
- Guess dimensions from "similar products"

---

## 3. Indonesian-first marketplace strategy

### Lane 1 — Indonesian consumer marketplaces

Priority order:
1. **Tokopedia** — widest selection, best for DIY electronics
2. **Shopee** — competitive pricing, broad SKU range
3. **Bukalapak** — good for bulk and industrial components
4. **Blibli** — for consumer electronics

Query in Indonesian first (`sensor fluoresensi UV`, `mikrokontroler ESP32`), then English if Indonesian results are thin.

### Lane 2 — Indonesian electronics distributors

For specialty electronics components:
- **Digiware** — hobbyist and maker electronics
- **Kawah Elektrika** — components and modules
- **Famosa Studio** — IoT and development boards
- **Andalan Elektro** — general electronics
- **SILINO / GSM Distributor** — communications modules
- **Mouser Indonesia, Digikey local** — industrial components (if accessible)

### Lane 3 — International fallback

Use only when Indonesian sourcing is unavailable or when an international supplier is objectively better (e.g., direct manufacturer):
- **LCSC** — Chinese distributor, strong for ICs and specialty components
- **Digikey / Mouser** — industrial-grade, manufacturer-authorized
- **AliExpress** — cheapest but slow and variable quality; flag stock/quality risk
- **Adafruit / SparkFun** — hobbyist modules with good documentation

When using international sourcing:
- Add shipping estimate to the price
- Note customs/import fee risk in `Notes`
- Add Indonesian alternative in `Alternative supplier` if any exists, even if lower spec

### Search query patterns

- Component type + spec: `"UV LED 365nm"`, `"bateria Li-Po 3000mAh"`
- Brand + model: `"ESP32-DevKitC"`, `"HC-SR04 ultrasonic"`
- Indonesian synonyms: `"resistor SMD"` vs `"resistor pasif"`, `"layar OLED"` vs `"modul display OLED"`

---

## 4. Alternatives protocol

Every primary component entry must have **at least one alternative**. Alternatives serve:
- Stock-out recovery
- Price comparison
- Quality fallback
- Different-specification variants the user can choose between

### Alternative types

1. **Same-supplier substitute**: same marketplace, different seller or listing of the same part number
2. **Different supplier, same part**: Tokopedia → Shopee for the same component
3. **Equivalent part, different brand**: e.g., generic ESP32 vs. Espressif-branded
4. **Functional equivalent, different approach**: e.g., HC-SR04 (ultrasonic) vs. VL53L1X (time-of-flight laser) for distance sensing

For each alternative, record supplier name, URL, unit price. Apply the same verification rules as primary.

### When only one viable source exists

Rare specialty components (obscure datasheet-spec'd parts, patented items) may have only one supplier. Mark as `[SOLE_SOURCE]` in `Notes` and flag in the checkpoint so the user knows the supply risk.

---

## 5. Output file template

```markdown
# Parts List — [Device Name] — [Competition Name]
Generated: [YYYY-MM-DD] | Competition folder: [absolute path]
Output language: [ID/EN/mixed]
Fidelity target: [proof-of-concept / pilot-ready / research-grade]
Budget constraint: [if specified, e.g., "Rp 3,000,000"; else "None specified"]

Total components: [N]
Grand total (primary suppliers): [amount, currency]
Grand total (alternatives scenario): [amount, currency]
Budget status: [under / over / not checked]

This file is consumed by the Prototype Design Agent. The component names, dimensions, and subsystem grouping drive the 3D model's accuracy.

---

## Subsystem summary

| Subsystem | Component count | Subtotal (primary) |
|---|---|---|
| Optical | 4 | Rp 450,000 |
| Processing | 5 | Rp 380,000 |
| Interface | 3 | Rp 250,000 |
| Communication | 2 | Rp 210,000 |
| Power | 4 | Rp 180,000 |
| Housing | 6 | Rp 320,000 |
| **Total** | **24** | **Rp 1,790,000** |

---

## Device functional requirements (derived from essay)

Brief summary of what the prototype must do, derived from `02_research_main.md` and the chosen angle. This anchors the component selection to the essay's actual claims.

- Function 1: [...]
- Function 2: [...]
- ...

---

## Component table

### Subsystem: Optical

#### P1 — UV LED 365nm
- **Specification**: 365nm wavelength, 10mW output, 3.4V forward voltage, 5mm through-hole
- **Quantity**: 2
- **Primary supplier**: Tokopedia — Toko Elektronik XYZ
- **Primary URL**: https://www.tokopedia.com/...
- **Primary unit price**: Rp 18,500 (IDR)
- **Total (primary)**: Rp 37,000
- **Dimensions**: 5mm diameter × 8.7mm length (excluding leads)
- **Weight**: <1g per unit
- **Alternative supplier**: Shopee — Electronic Indonesia Store
- **Alternative URL**: https://shopee.co.id/...
- **Alternative unit price**: Rp 22,000 (IDR)
- **Datasheet URL**: [if manufacturer datasheet available]
- **Notes**: [blank, or stock status / flags]

#### P2 — Optical bandpass filter
- [same structure]

[... through every optical component]

### Subsystem: Processing

#### P5 — ESP32-DevKitC-32UE
[same structure]

[... through every subsystem]

---

## Budget analysis (if budget was specified)

- **Budget**: Rp 3,000,000
- **Grand total (primary)**: Rp 1,790,000
- **Headroom**: Rp 1,210,000 (40.3% under budget)
- **Cost-dominant components**: P5 (microcontroller) Rp 185,000; P9 (display) Rp 150,000; P14 (battery) Rp 95,000
- **Potential savings via alternatives**: Rp 220,000 if all alternatives chosen → total Rp 1,570,000

---

## Sole-source and risk flags

List components with supply, compliance, or stock risks:

- **P12 — [component name]**: `[SOLE_SOURCE]` — only one verified supplier. Risk: stock-out blocks build.
- **P18 — [component name]**: `[COMPLIANCE_RISK]` — requires Postel certification for 868MHz operation in Indonesia.
- **P7 — [component name]**: `[INTERNATIONAL_ONLY]` — no Indonesian stock found; 2–4 week shipping from LCSC expected.

If none: write "None flagged."

---

## Rejected candidates (for transparency)

Every component candidate that was researched but rejected, with reason code:

- **[Component/supplier]** — [URL if any] — Reason: [URL_INVALID / PRICE_MISSING / SPEC_MISMATCH / OUT_OF_STOCK / DIMENSIONS_UNAVAILABLE / COMPLIANCE_RISK / SHIPPING_PROHIBITIVE / SUPPLIER_UNRELIABLE]
- ...

---

## Integration notes

- **For Prototype Design Agent**: Component names and dimensions drive the 3D model. Subsystem grouping can inform the exploded view (components in the same subsystem explode together).
- **For essay inclusion**: If the essay's format allows a "components and budget" table, this list can be summarized into a shorter table (component name + quantity + price) for embedding.
- **Refresh cadence**: Prices age quickly. Re-run this skill periodically if the essay timeline spans months.

---

## Next step
If the device will be visualized in 3D, trigger the Prototype Design Agent. It will read this file (component names and dimensions) to build a physically accurate model.
```

---

## 6. Iteration mode protocol

If `02_research_parts_list.md` already exists when this skill runs:

### Mode 1 — Extend

Preserve existing entries (keep their Component IDs). Add new components with sequential IDs picking up from the highest existing number. Update Grand Total and Subsystem Summary accordingly. Add a header note:

```
Version: 2 (extended YYYY-MM-DD — added N new components)
```

### Mode 2 — Replace

Archive old file as `02_research_parts_list_archive_{YYYYMMDD}.md`. Create new parts list from scratch.

### Mode 3 — Refresh prices only

User doesn't want to add components, just update prices on existing entries. Re-verify every primary and alternative URL. Update prices. Flag any entry whose URL no longer resolves or whose price has shifted by >20% (common signal that the product was relisted).

Ask the user which mode if multiple could apply.

---

## 7. Quality checks before saving

Run each item before saving. Fix any failure.

### Completeness
- [ ] Every component required by the device's subsystems has an entry
- [ ] Every component entry has all required fields populated
- [ ] No component entry has a blank URL, price, or dimensions (unless explicitly marked `[DIMENSIONS_UNAVAILABLE]` with reason)

### Verification
- [ ] Every primary URL resolves to a product page
- [ ] Every alternative URL resolves
- [ ] Every price has explicit currency
- [ ] Every component has at least one alternative (or `[SOLE_SOURCE]` flag)
- [ ] Dimensions are present and sufficient for 3D modeling

### Sourcing strategy
- [ ] Indonesian suppliers were tried first
- [ ] International fallbacks are flagged with shipping caveats
- [ ] Compliance risks are flagged (radio, medical, high-voltage, etc.)

### Integration with essay
- [ ] Subsystem decomposition matches the device described in research files
- [ ] Functional requirements are derived from the essay's stated device purpose
- [ ] Any component claim the essay makes about specifications can be verified from this list

### Budget
- [ ] Grand total is computed correctly
- [ ] Budget comparison is shown if budget was specified
- [ ] Alternative-scenario total is computed

### Transparency
- [ ] Rejected candidates are recorded with reason codes
- [ ] Sole-source and compliance flags are clearly listed
- [ ] No silent drops — every considered component is either included or in the rejected section

### File
- [ ] Saved to `{competition_folder}/02_research_parts_list.md`
- [ ] Metadata header matches the competition's research language
- [ ] Previous version archived if in replace mode

---

## 8. Integration with other skills

### Reads from
- `01_ideation.md` (device scope from chosen angle)
- `02_research_main.md` (sub-claims about device function)
- `02_research_sources.md` (existing sources may have components already named)
- `03_essay_draft_v{N}.md` if present (explicit component mentions in drafted prose)

### Feeds into
- **Prototype Design Agent**: reads `02_research_parts_list.md` to build physically accurate 3D model. Component names become mesh names. Dimensions become scale values. Subsystem grouping drives exploded-view separation.
- **Writing Agent (revision mode)**: if a components table is included in the essay, the Writing Agent reads this file to build it.

### Does not modify
- Any upstream artifacts (read-only)
- The essay draft (Writing Agent's job)

---

## 9. Common failure modes to avoid

- **Fabricated URLs**: inventing a Tokopedia link that doesn't resolve. Every URL is verified.
- **Stale prices**: using a price from a cached snapshot rather than the live page. Always verify current price.
- **Spec drift**: accepting a component whose specs don't meet the functional requirement because "it's close enough." Refuse; spec matters.
- **Missing dimensions**: component entry with blank dimensions makes the 3D model inaccurate. Always capture dimensions.
- **International-only laziness**: defaulting to LCSC/AliExpress without trying Indonesian marketplaces first.
- **Silent rejection**: dropping a candidate without recording it. Every rejection goes in the Rejected Candidates section.
- **Compliance blindness**: sourcing a transmitter module without noting that Indonesia's Postel requires certification for certain bands.
- **No alternatives**: every component needs at least one alternative or a `[SOLE_SOURCE]` flag.
- **Budget ignoring**: computing totals without comparing to the user's stated budget.
- **Pretending the essay specifies a device when it doesn't**: if the essay is about policy or software, this skill doesn't apply. Refuse rather than invent a device.
- **Scope creep**: adding "nice-to-have" components the essay doesn't require, inflating the budget.

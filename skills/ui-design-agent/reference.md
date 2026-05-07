# UI Design Agent — Reference

Detailed specifications for the UI Design Agent skill.

---

## 1. Session design systems

Six design systems are offered. One is applied across the entire session.

### Clean / minimal

- **Palette**: `#0F172A` (deep ink), `#475569` (slate text), `#E2E8F0` (light border), `#FFFFFF` (canvas), `#3B82F6` (accent blue), `#F8FAFC` (cool background)
- **Typography**: Heading `system-ui, -apple-system, sans-serif` 600 weight; Body same family 400 weight
- **Components**: thin borders (1px), generous whitespace (24–32px padding), subtle shadows only (`0 1px 2px rgba(0,0,0,0.05)`), square-ish corners (4–6px radius)
- **Good for**: policy-adjacent, restrained institutional, academic-but-modern

### Institutional

- **Palette**: `#1E3A5F` (deep blue), `#64748B` (steel), `#E5E7EB` (neutral), `#FFFFFF`, `#B91C1C` (accent red for alerts only), `#F3F4F6`
- **Typography**: Heading `Georgia, 'Times New Roman', serif`; Body `system-ui, sans-serif`
- **Components**: structured layouts with clear hierarchy, gridded tables, formal headers, minimal animation
- **Good for**: government, ministry-facing, formal reports

### Modern SaaS

- **Palette**: `#6366F1` (indigo primary), `#8B5CF6` (purple accent), `#EC4899` (pink highlight), `#F9FAFB`, `#111827` (deep text), `#10B981` (success green)
- **Typography**: Heading `system-ui, sans-serif` 700 weight tracking-tight; Body same 400 weight
- **Components**: gradient backgrounds, rounded cards (12–16px radius), soft shadows (`0 10px 15px rgba(0,0,0,0.1)`), vibrant accents, subtle illustrations
- **Good for**: startup/entrepreneurship, consumer product pitch, innovation competitions

### Environmental / earthy

- **Palette**: `#2D5016` (forest), `#6B8E23` (olive), `#D4A373` (sand), `#FAEDCD` (cream), `#3A3A3A` (charcoal text), `#7D8471` (sage)
- **Typography**: Heading `system-ui, sans-serif` 600 weight; Body same 400 weight
- **Components**: organic shapes (rounded irregularly), natural textures suggested via color gradients, generous vertical spacing, simple icons
- **Good for**: environmental essays, community projects, conservation, sustainability

### Academic / research

- **Palette**: `#111827` (near-black), `#374151` (dark gray), `#9CA3AF` (mid gray), `#E5E7EB` (light), `#FFFFFF`, `#DC2626` (data red for key findings)
- **Typography**: Heading `'Source Serif', Georgia, serif` (fallback to system); Body `'Source Sans', system-ui, sans-serif`
- **Components**: data-dense tables, high-contrast charts, minimal decoration, small but consistent spacing (12–16px), monospace for numbers in tables
- **Good for**: research-heavy scientific essays, policy analyses, academic submissions

### Custom

User provides:
- 3–6 hex colors with semantic roles (primary, accent, background, text, etc.)
- Typography pair (heading family + body family, using system-available fonts only)
- Optional: corner radius preference (sharp / rounded / very rounded), shadow intensity (none / subtle / prominent)

The skill validates the palette (warns about low-contrast pairs, accessibility issues) before accepting.

---

## 2. Mockup brief template

Save to `{competition_folder}/06_uidesign/{SLOT_ID}_{SLOT_TYPE}_brief.md`.

```markdown
# Mockup Brief — {SLOT_ID} ({SLOT_TYPE})
Generated: [YYYY-MM-DD] | Competition folder: [absolute path]
Session design system: [name + palette swatches]
Output language: [ID/EN/mixed]
3D device generation: [yes/no]
Linked Claim IDs: [C1, C4, ...]

---

## Product
- **Name**: [from essay context — e.g., "PELITA Dashboard"]
- **Purpose**: [one line]
- **Primary user**: [from essay]
- **Platform**: [web / mobile / both]

## Screens

### Screen 1 — [name, e.g., "Dashboard utama"]
- **Purpose**: [what user does here]
- **Layout type**: [sidebar-left / top-nav / full-page / modal / list-detail]
- **Components**:
  - Header: [logo, nav items, user avatar]
  - Main content: [chart type, data source, KPI cards, data table]
  - Secondary: [filters, notifications]
- **Thematic data populating this screen** (every field filled with essay-relevant values):
  - KPI 1: "Mikroplastik terdeteksi hari ini" — value: "142 partikel/L"
  - Chart: time series showing last 7 days of readings at Sungai Code stations
  - Table rows: "Stasiun Kleringan," "Stasiun Gondolayu," "Stasiun Pogung," etc.
- **Links to**: [Screen 2, Screen 3]

### Screen 2 — [name]
[same structure]

[etc. — target 3–5 screens per slot]

## Navigation map

```
Dashboard (S1) ─┬─► Detail Stasiun (S2)
                ├─► Riwayat (S3)
                └─► Pengaturan (S4)
```

## Device frame choice

- Web: MacBook (default — framing a browser window inside a laptop silhouette)
- Mobile: iPhone 14 shape (default)
- Product: both, side-by-side
- ui_screen: no frame, 1920×1080 canvas

## Labels for device-framed SVG (Style B)

| Screen | Label text | Position |
|---|---|---|
| Dashboard | "Ringkasan pemantauan — 4 stasiun, 24 jam terakhir" | Bottom-right |
| Detail stasiun | "Profil stasiun + riwayat 30 hari" | Below device |

## Relation to essay claims

- Screen 1 → Claim ID C4: essay claims real-time monitoring; dashboard visually proves the interface supports this
- Screen 2 → Claim ID C7: essay claims historical trend analysis; detail view shows the trend chart
```

---

## 3. Three output styles (the 2D layer)

### Style A — Pure UI SVG

A full-width, full-height render of the UI screen without any surrounding device frame. The entire canvas is the app content.

- Desktop dimensions: `1440 × 900` viewBox
- Mobile dimensions: `390 × 844` viewBox
- Rendered as hand-crafted SVG per the brief's screen specifications
- Uses session palette and typography
- All component shapes (cards, buttons, charts, tables) drawn as SVG primitives

Use case: the supplementary file you open to examine UI details up close. Also useful if the user wants to include a screenshot-style image in the essay without the device frame.

### Style B — Device-framed SVG (default essay embed)

The same UI, shown inside a flat 2D representation of the target device (MacBook silhouette for desktop, iPhone silhouette for mobile). This is what goes into the essay by default.

- MacBook frame: laptop outline with screen bezel, keyboard hint, neutral background panel
- iPhone frame: phone outline with top notch, home indicator, neutral background panel
- UI content rendered at correct aspect ratio inside the screen area
- Optional labels with leader lines pointing to specific UI elements (per brief)

See section 4 for device frame specifications.

### Style C — 3D device HTML (opt-in)

A three.js scene with a 3D model of the device (MacBook or iPhone). The UI is rendered to an offscreen canvas and applied as a texture to the device's screen.

- Reuses Prototype Design Agent's three.js r160 template structure
- Orbit controls, feature detection, fallback UI
- UI texture is drawn procedurally from the same component specs (no external image needed)
- No explode-toggle button (doesn't apply to UI mockups)

See section 7 for the 3D device template.

---

## 4. Flat device frame specifications

### MacBook frame (for `web_mockup` Style B)

```
Overall viewBox: 1600 × 1000 (adds ~160px of padding around the UI)

Laptop silhouette:
- Screen bezel: ~8px matte black border around the UI area
- Screen area: 1440 × 900 (where the Style A UI renders inside)
- Hinge: short rectangle between screen and keyboard
- Keyboard base: trapezoid beneath the screen, slightly wider at bottom
  (suggests the laptop is viewed slightly from above)
- Keyboard details: subtle keys hinted via shadow gradients; no individual key labels

Color: matte dark gray (#1a1a1a) for the frame; UI renders inside as-is.

Background panel: subtle neutral (#f5f5f5 or matching session palette's background-adjacent color)
```

### iPhone frame (for `app_mockup` Style B)

```
Overall viewBox: 550 × 1100 (adds padding around the phone)

Phone silhouette:
- Body: rounded rectangle with ~40px corner radius
- Screen area: 390 × 844 (where Style A UI renders inside)
- Dynamic Island: black pill-shaped notch at top center (~120 × 32)
- Home indicator: thin black bar at bottom center (~140 × 4)
- Side buttons: small rectangles on left (volume) and right (power) edges
- Frame thickness: ~12px around the screen

Color: matte black (#0f0f0f) for the body; UI renders inside as-is.

Background panel: subtle neutral matching session palette.
```

### Combined frame (for `product_mockup` Style B)

```
Overall viewBox: 2000 × 1100 (wider to fit both devices)

Layout:
- MacBook on left, slightly offset down and right (gives visual weight)
- iPhone on right, smaller (scaled to ~60% of its standalone size so the two feel proportional)
- Both devices on a shared neutral background

Optionally add a thin base/shadow under each device for grounding.

Labels: "Web" under the MacBook, "Mobile" under the iPhone (or in chosen output language: "Versi Web" / "Versi Mobile")
```

### Rules for all device frames

- **The device silhouette is static and simple** — no photorealism, no light reflections on the screen. This is a product mockup, not a marketing render.
- **The UI content inside the screen area matches the Style A SVG exactly** (same components, same data, same palette).
- **Labels placed outside the device** with leader lines pointing to UI elements, never overlapping the device frame.
- **Neutral background** — don't compete with the UI content for attention.

---

## 5. Thematic data derivation

Lorem ipsum is never acceptable. Every string, number, and name in the mockup derives from the essay's context.

### What "thematic" means

Derive data from:
- The chosen angle's thesis (from `01_ideation.md`)
- The research's sub-claims and sources (from `02_research_main.md`)
- The parts list if applicable (from `02_research_parts_list.md`)
- The essay draft's actual prose (from `03_essay_draft_v{N}.md`)

### Examples of thematic derivation

**Essay about PELITA microplastic detection in Sungai Code, Yogyakarta:**
- KPI labels: "Partikel terdeteksi," "Tingkat kontaminasi," "Stasiun aktif"
- Dashboard place names: "Stasiun Kleringan," "Stasiun Gondolayu" (real places along Sungai Code)
- Chart data: ranges realistic for actual microplastic monitoring (dozens to hundreds of particles per liter)
- User avatar name: plausible Indonesian researcher name consistent with the essay's stakeholder frame (e.g., "Fajar Pambudi" if the essay names this person, or "Peneliti BRIN" if generic)

**Essay about rural digital literacy:**
- Dashboard names: village names from the essay's region
- User roles: "Fasilitator desa," "Koordinator pelatihan"
- Metric labels: "Peserta aktif minggu ini," "Module selesai," "Tingkat partisipasi"

### Rules

1. **Names and places** — use real ones mentioned in the essay, or plausible Indonesian ones appropriate to the region/context if the essay doesn't name specific examples.
2. **Numbers** — use realistic ranges. If the essay cites "64% of youth," don't show a dashboard with "97% success rate" (contradicts the essay).
3. **Time references** — use dates/times that make sense for the product's use context (e.g., dashboard "last updated 2 minutes ago" for real-time monitoring; "last synced at 06:00" for daily batch).
4. **Consistency across screens** — if Screen 1 shows "142 partikel/L" at Stasiun Kleringan, Screen 2's detail view of Stasiun Kleringan must show the same value, not contradict it.
5. **Consistency across slots** — same product name, same key user names, same core data values across every mockup in the session.

### When essay context is thin

If the essay doesn't provide enough context to derive specific data (e.g., early in the drafting process), ask the user before inventing. *"The essay doesn't name specific monitoring stations. Shall I use plausible names from the Sungai Code area, or do you have specific names you want to appear?"*

---

## 6. Interactive HTML template (Tailwind CDN)

Single self-contained HTML with multi-screen navigation via JavaScript.

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>{Product Name} — {SLOT_TYPE} Mockup</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* Custom session palette and typography overrides */
    :root {
      --color-primary: {hex};
      --color-accent: {hex};
      --color-bg: {hex};
      --color-text: {hex};
      /* ... per session design system */
    }
    body { font-family: system-ui, sans-serif; background: var(--color-bg); color: var(--color-text); }
    .screen { display: none; min-height: 900px; }
    .screen.active { display: block; }
    [data-viewport="desktop"] { width: 1440px; margin: 0 auto; }
    [data-viewport="mobile"] { width: 390px; min-height: 844px; margin: 0 auto; border-radius: 40px; overflow: hidden; }
  </style>
</head>
<body>
  <!-- Viewport container (desktop: 1440px fixed; mobile: 390px centered; product: both side-by-side) -->

  <!-- For web_mockup -->
  <div data-viewport="desktop">
    <!-- Screen 1 -->
    <div class="screen active" data-screen="dashboard">
      [Screen 1 content per brief, using Tailwind classes]
    </div>

    <!-- Screen 2 -->
    <div class="screen" data-screen="detail">
      [Screen 2 content]
    </div>

    <!-- More screens -->
  </div>

  <!-- For app_mockup: same pattern but with data-viewport="mobile" -->

  <!-- For product_mockup: two containers side-by-side -->

  <script>
    // Navigation logic
    function showScreen(name) {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.querySelector(`[data-screen="${name}"]`).classList.add('active');
    }
    // Wire up all buttons/links with data-navigate attribute
    document.querySelectorAll('[data-navigate]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        showScreen(el.dataset.navigate);
      });
    });
  </script>
</body>
</html>
```

### Tailwind usage rules

- Use Tailwind utility classes for all styling; don't write custom CSS beyond the session palette variables and viewport container sizing
- Components follow session design system: `rounded-lg` for modern SaaS, `rounded` or no radius for institutional, `rounded-2xl` for environmental, etc.
- Use `shadow-sm` / `shadow-md` / `shadow-lg` per session intensity preference
- Color classes should use the session palette — since Tailwind's default palette may not match, use arbitrary values like `bg-[#2D5016]` with session hex codes
- Responsive classes are *not* needed — mockups are fixed-viewport

### Multi-screen navigation rules

- Every button/link that would navigate in a real app has `data-navigate="screenname"` attribute
- The JS wires these to the `showScreen()` function
- Default screen is the one marked `class="screen active"` on load
- No real URL routing, no browser history, no form submission — it's a mockup

### Mobile viewport handling (for `app_mockup`)

- Container fixed at 390px wide (iPhone 14 screen width)
- `border-radius: 40px; overflow: hidden;` gives it a phone-shape preview in the browser
- No device frame around it in the HTML (the HTML is UI-only; frames are Style B/C artifacts)

### Product mockup HTML layout

- Two `<div>` containers side-by-side: desktop (1440px) on left, mobile (390px) on right
- Each has its own screen-navigation system (they don't share state — each is independently navigable)
- Cap the browser viewport at minimum `1900px` to fit both comfortably

---

## 7. 3D device mockup template (Style C, opt-in)

Reuses the three.js r160 structure from Prototype Design Agent. Key differences:

### Device geometry

Build a simple MacBook or iPhone model using primitives:

**MacBook:**
```javascript
// Base (keyboard deck)
const base = new THREE.Mesh(
  new THREE.BoxGeometry(6, 0.15, 4),
  new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
);
base.position.y = 0;

// Screen (raised, hinged back slightly)
const screenFrame = new THREE.Mesh(
  new THREE.BoxGeometry(6, 4.2, 0.15),
  new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
);
screenFrame.position.set(0, 2, -1.95);
screenFrame.rotation.x = -0.15; // slight tilt back

// Screen surface (the display)
const screenSurface = new THREE.Mesh(
  new THREE.PlaneGeometry(5.6, 3.8),
  new THREE.MeshBasicMaterial({ map: uiTexture })
);
screenSurface.position.set(0, 2, -1.87);
screenSurface.rotation.x = -0.15;
```

**iPhone:**
```javascript
// Body
const body = new THREE.Mesh(
  new THREE.BoxGeometry(1.8, 3.8, 0.3),
  new THREE.MeshStandardMaterial({ color: 0x0f0f0f, metalness: 0.7, roughness: 0.3 })
);
body.geometry = new THREE.BoxGeometry(1.8, 3.8, 0.3);
// (optional: round corners by slightly displacing vertices or use a rounded-box helper)

// Screen surface
const screenSurface = new THREE.Mesh(
  new THREE.PlaneGeometry(1.7, 3.7),
  new THREE.MeshBasicMaterial({ map: uiTexture })
);
screenSurface.position.z = 0.16;
```

### UI as texture

The UI is rendered to an offscreen `<canvas>` using the same thematic data and session design system as Style A. Then a `THREE.CanvasTexture` wraps it and applies to the screen plane.

```javascript
// Create offscreen canvas for UI
const uiCanvas = document.createElement('canvas');
uiCanvas.width = 1920;
uiCanvas.height = 1080; // or mobile aspect 390×844 × 2 for retina
const ctx = uiCanvas.getContext('2d');

// Draw the UI procedurally using the brief's specifications
// (same component logic as Style A, but using canvas 2D API)
drawDashboard(ctx, {
  palette: sessionPalette,
  typography: sessionTypography,
  data: thematicData
});

const uiTexture = new THREE.CanvasTexture(uiCanvas);
uiTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
```

### Controls

- Orbit controls with damping (same as Prototype Agent)
- No explode button (doesn't apply to UI mockups)
- Optional: a small overlay button "Click screen for interactive HTML" that opens the Style A/B/HTML interactive version

### Lighting

- Standard ambient + directional setup (reuses Prototype Agent pattern)
- Keep the screen plane using `MeshBasicMaterial` so it self-illuminates (doesn't darken under shadows, which would make UI hard to read)

---

## 8. Draft modification protocol

### Slot detection

Image slots with `TARGET_SKILL: ui-design-agent`. SLOT_TYPE can be `web_mockup`, `app_mockup`, `product_mockup`, or `ui_screen`.

### Versioned backup

Same protocol as Flowchart and Prototype Agents:
- `{draft_stem}.backup_v{N}.md` convention
- On conflict, ask overwrite vs new version (default: new)

### Placeholder replacement

For `web_mockup`, `app_mockup`, `product_mockup`:

```
![Figure N — [caption]](06_uidesign/{SLOT_ID}_{SLOT_TYPE}_framed.svg)
<!-- Pure UI SVG: 06_uidesign/{SLOT_ID}_{SLOT_TYPE}_ui.svg | Interactive HTML: 06_uidesign/{SLOT_ID}_{SLOT_TYPE}.html | 3D (if generated): 06_uidesign/{SLOT_ID}_{SLOT_TYPE}_3d.html -->
```

For `ui_screen`:

```
![Figure N — [caption]](06_uidesign/{SLOT_ID}_ui_screen.png)
<!-- This PNG is a UI screen asset at 1920×1080, suitable for use as a screen texture by the Prototype Design Agent. -->
```

### Metadata table update

```
| slot_5 | web_mockup | ui-design-agent | Filled 2026-04-22 — framed SVG + pure UI SVG + interactive HTML |
| slot_8 | ui_screen | ui-design-agent | Filled 2026-04-22 — PNG 1920×1080 for 3D device use |
```

---

## 9. Cross-slot consistency enforcement

Before finalizing, verify every artifact across every slot shares:

- **Palette**: same hex codes across every SVG, every HTML, every canvas
- **Typography**: same font families and weight conventions
- **Component patterns**:
  - Button style (same corner radius, same padding, same weight)
  - Card style (same shadow, same border, same padding)
  - Input style (same border, same focus behavior visual)
  - Chart style (same axis styling, same color conventions)
- **Thematic data**: same product name, same user names, same locations, same sample values (if "Stasiun Kleringan shows 142 particles/L" in slot 3, it shows 142 in slot 7 too)
- **Navigation visual language**: same icon set style, same hover/active states across HTML

If any drift detected, regenerate the drifting artifact to match. This is not optional — cross-slot consistency is what makes the mockup set feel like a real product team's output.

---

## 10. File naming and folder structure

```
{competition_folder}/
└── 06_uidesign/
    ├── {SLOT_ID}_{SLOT_TYPE}_brief.md
    ├── {SLOT_ID}_{SLOT_TYPE}_ui.svg        (Style A)
    ├── {SLOT_ID}_{SLOT_TYPE}_framed.svg    (Style B — the essay embed)
    ├── {SLOT_ID}_{SLOT_TYPE}.html          (interactive multi-screen)
    ├── {SLOT_ID}_{SLOT_TYPE}_3d.html       (Style C — only if opted in)
    └── [for ui_screen slots]
    ├── {SLOT_ID}_ui_screen.png             (only artifact for ui_screen)
    └── {SLOT_ID}_ui_screen_brief.md
```

For standalone mode: same naming with user-chosen base name replacing SLOT_ID.

---

## 11. Iteration loop protocol

### Classify the request

1. **Brief-level** (screens, data, navigation): update brief → re-approve → regenerate
2. **Style-level** (spacing, color, component look): update brief's style notes → regenerate
3. **Artifact-specific** (only the HTML has a bug, only the SVG has a label issue): fix that artifact
4. **Session design system change**: major — warn that this propagates to every artifact in the session; offer to regenerate all or only some

### Limits

- Soft cap: 5 rounds per slot. Past 5, ask whether to revise brief or continue.
- Hard cap: 10 rounds. Past 10, stop; recommend fresh brief or different slot type.

### Never do

- Change design system mid-session without warning
- Regenerate with different data than the brief specifies
- Silently drift from session palette or typography

---

## 12. Quality checks before saving

### Brief
- [ ] Brief produced before code/SVG
- [ ] Brief approved
- [ ] Brief file saved

### Style A — Pure UI SVG
- [ ] Correct viewBox for slot type (1440×900 desktop, 390×844 mobile)
- [ ] Session palette only
- [ ] Thematic data, no placeholders
- [ ] Components follow session design system conventions
- [ ] Labels in chosen output language

### Style B — Device-framed SVG
- [ ] Correct device silhouette (MacBook for web, iPhone for mobile, both for product)
- [ ] UI content inside screen area matches Style A exactly
- [ ] Labels with leader lines outside the device frame
- [ ] Neutral background not competing with UI
- [ ] No photorealism on device frame — flat silhouette

### Interactive HTML
- [ ] Tailwind CDN loaded
- [ ] Session palette applied via CSS variables or arbitrary Tailwind values
- [ ] Multi-screen navigation functional
- [ ] Every navigable element has `data-navigate`
- [ ] Default screen marked `active`
- [ ] Viewport sized correctly (1440 desktop, 390 mobile, both for product)
- [ ] Thematic data present across all screens
- [ ] No placeholder text anywhere

### Style C — 3D device HTML (if generated)
- [ ] three.js r160 pinned via importmap CDN
- [ ] WebGL feature detection with fallback
- [ ] Orbit controls with damping
- [ ] Device model built from primitives
- [ ] UI rendered to offscreen canvas and applied as texture
- [ ] Texture data matches Style A content
- [ ] Screen material is `MeshBasicMaterial` (self-illuminating)
- [ ] No explode button (not applicable here)

### ui_screen PNG (for ui_screen slots)
- [ ] Dimensions exactly 1920×1080
- [ ] Format PNG (lossless for texture use)
- [ ] Session palette and thematic data applied
- [ ] No device frame (pure UI surface)

### Cross-slot consistency
- [ ] All slots in this session share the same palette
- [ ] All slots share the same typography
- [ ] All slots share the same component patterns
- [ ] Thematic data is consistent across slots (same names, same values)

### Draft integration (slot-driven)
- [ ] Versioned backup created
- [ ] Placeholder replaced with Style B SVG path (or PNG for ui_screen)
- [ ] Supplementary files referenced in draft comment
- [ ] Slot comment markers preserved
- [ ] Metadata table STATUS updated
- [ ] No other parts of draft modified

### File output
- [ ] All artifacts saved to `06_uidesign/`
- [ ] Naming convention followed
- [ ] Brief saved alongside artifacts

---

## 13. Common failure modes to avoid

- **Lorem ipsum sneaking in**: any placeholder text = failure. Derive from essay context.
- **Design system drift**: one slot in modern SaaS, next slot accidentally using institutional. Fix by re-running with cross-slot consistency check.
- **Tailwind class soup**: using 15 Tailwind classes per element when 3 would work. Keep it clean.
- **Responsive over-engineering**: mockups are fixed-viewport; no `md:` or `lg:` classes needed.
- **Device frame over-detailing**: photorealistic laptops with screen reflections and key-by-key rendering. Keep it flat.
- **Interactive HTML not actually interactive**: buttons that don't navigate, links that don't work. Every stated navigation must function.
- **Single-screen HTML**: shipping a mockup HTML with only one screen when the brief had 4. The navigation is the point.
- **Thematic data contradicting the essay**: dashboard says "87% success rate" when the essay cites "64% baseline failure rate." Align the data.
- **3D device UI texture baked wrong size**: texture rendered at 512×512 applied to a plane sized for 1920×1080 — looks blurry. Match the canvas resolution to the plane's visual prominence.
- **`ui_screen` with a device frame**: ui_screen is meant to be a texture; any device frame defeats the purpose. Keep it pure.
- **Cross-session incoherence**: user runs the skill twice in the same folder with different design systems — second-run mockups clash with first-run. Warn when this is detected.
- **Standalone mode modifying the draft**: never modify a draft in standalone mode.
- **Product mockup where one side is empty**: the desktop version is polished but the mobile version is just a placeholder. Both sides must be equally complete.
- **External font loading**: web fonts from Google Fonts break offline. Use system-ui and similar always.
- **Silent design system acceptance**: user picks "Custom" with a clashing palette; skill should warn before accepting.

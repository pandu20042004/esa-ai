# Prototype Design Agent — Reference

This file holds the detailed specifications for the Prototype Design Agent skill.

---

## 1. Structured scene brief template

Save to `{competition_folder}/05_prototypes/{SLOT_ID}_prototype_brief.md`.

```markdown
# Prototype Scene Brief — {SLOT_ID}
Generated: [YYYY-MM-DD] | Competition folder: [absolute path]
Visual fidelity tier: [primitives / custom geometry / textured]
three.js version: [r160 / other + reason]
Output language: [ID/EN/mixed]
Exploded view: [normal only / exploded only / both]
Parts list source: [path to 02_research_parts_list.md if used; else "descriptive only"]
Linked Claim IDs: [C1, C4, ...]

---

## Device overview
- **Name**: [from parts list or user-provided]
- **Function**: [One-line purpose]
- **Form factor**: [handheld / desktop / wall-mounted / wearable / floor-standing / ...]
- **Approximate dimensions**: [overall, from parts list's housing specs or user estimate]
- **Intended user**: [who operates it]
- **Environment of use**: [where it lives]

## Component list

Populate from parts list if available (column "Component ID" matches `P1`, `P2`, etc. from `02_research_parts_list.md`). For components not in parts list (e.g., enclosure subassemblies), generate entries as needed.

### Component — [Name from parts list, e.g., "ESP32-DevKitC-32UE"]
- **Parts list ID**: P5 (if applicable; else blank)
- **Shape**: [box / sphere / cylinder / custom geometry description]
- **Dimensions (from parts list or brief)**: [e.g., "55mm × 28mm × 13mm"]
- **Relative scale in scene**: [explain how this maps to the scene's coordinate system]
- **Material**: [solid color / metallic / translucent / matte]
- **Color (from palette)**: [hex or palette role]
- **Position**: [relative to other components]
- **Subsystem group** (for exploded view): [optical / processing / interface / communication / power / housing]
- **Labeled in normal-view SVG?**: yes/no — if yes, label text
- **Labeled in exploded-view SVG?**: yes/no — if yes, label text (typically more detailed than normal view)
- **Clickable in HTML?**: yes/no — if yes, info panel text

### Component — [Next name]
[same structure]

---

## Labels plans

### Normal-view SVG labels

| # | Component | Label text | Leader line direction |
|---|---|---|---|
| 1 | Sensor array | "Array sensor UV (4 LED)" | Top-right |
| 2 | Display | "Layar OLED 2,4 inci" | Left |
| 3 | Housing | "Enclosure cetak 3D (PETG)" | Bottom-right |

### Exploded-view SVG labels

| # | Component | Label text | Position relative to exploded part |
|---|---|---|---|
| 1 | Sensor array | "Array sensor UV — 4× 365nm LED, filter optik bandpass" | Right of component |
| 2 | PCB | "PCB kontrol — ESP32-DevKitC + driver LED" | Right of component |
| [etc.] | | | |

---

## Interaction plan (HTML)

| Component | Info panel title | Info panel body |
|---|---|---|
| Sensor array | "Array Sensor UV" | "4 LED UV 365nm mengeksitasi carbon dots pada sampel air. Filter bandpass memblokir panjang gelombang di luar pita emisi target." |
| PCB | "PCB Kontrol" | "ESP32-DevKitC-32UE mengontrol timing LED, membaca fotodioda, dan mentransmisikan data via Wi-Fi." |

---

## Exploded-view grouping

For the exploded-view SVG and the HTML's explode-toggle animation, components move apart along subsystem-based separation vectors.

| Subsystem group | Components | Separation direction | Separation distance (relative) |
|---|---|---|---|
| Housing lid | [list] | +Y (upward) | 3.0 units |
| Optical assembly | [list] | +X (rightward) | 2.5 units |
| PCB | [list] | -Y (downward) | 1.5 units |
| Power / battery | [list] | -X (leftward) | 2.0 units |
| Housing base | [list] | 0 (stays in place) | 0 |

When the HTML's Explode button is toggled on, each group animates to its separation offset over ~1 second with easing.

---

## Camera framing

### Normal-view SVG
- **Angle**: three-quarter (default)
- **Distance**: medium
- **Focal emphasis**: [component most important to argument]

### Exploded-view SVG
- **Angle**: three-quarter (same as normal, so the two reads continuously)
- **Distance**: wider (to accommodate separated components)
- **Focal emphasis**: subsystem relationships

---

## Color palette

| Role | Hex | Usage |
|---|---|---|
| Primary housing | `#2B3A55` | Main body |
| Accent / highlight | `#CE7777` | Activation indicators |
| Sensor / active area | `#82CD47` | Optical/sensor surfaces |
| Neutral / surface | `#E9E5D6` | Background / base plane |
| Deep contrast | `#1A1A2E` | Text, outlines, deep recesses |

Keep palette tight: 3–6 colors.

---

## Relation to essay claims

For each component tied to a Claim ID:

- Component [name] → Claim ID C{N}: [how the component demonstrates the claim]

Example:
- Sensor array → Claim ID C7: essay claims ratiometric fluorescence improves accuracy; the 4-LED array with bandpass filter visually represents this approach.

---

## Fidelity-tier-specific notes

### If `primitives`
Map each component to a three.js primitive:
- Housing base → `BoxGeometry(width, depth, height)`
- Sensor dome → `SphereGeometry(radius, 32, 16)`
- LEDs → `CylinderGeometry(top, bottom, height, 32)`
- Display → `BoxGeometry(w, h, 0.5)` with screen-color face

### If `custom geometry`
Specify which custom helpers:
- `LatheGeometry` for [bottle, cylindrical sensor]
- `ExtrudeGeometry` for [device face with logo cutout]
- `ShapeGeometry` for [2D silhouette overlay]

### If `textured`
Specify procedural patterns per component:
- Sensor grille → horizontal stripe pattern via `CanvasTexture` (160×20 canvas, alternating fill)
- Buttons → radial gradient via `CanvasTexture`
- Warn: if texture attempts don't land, fall back to primitives for that component.
```

---

## 2. three.js version policy

### Default pin: r160

Stable release from late 2023. Extensively documented across tutorials. Stable `OrbitControls`, `Raycaster`, materials, and importmap support. This is the default.

### CDN imports

```html
<script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
    }
  }
</script>
```

### Upgrade-on-need policy

If the prototype needs features only in newer versions:
- **r165+**: for advanced node-based materials (avoid unless essential)
- **r169+**: for WebGPU renderer path (overkill for this skill's needs)
- **Specific add-ons**: e.g., `TransformControls`, `PMREMGenerator`, `ThreeMFLoader` — check availability in r160 first

Before upgrading, state to the user:

> *"This prototype would benefit from three.js r{N} because [reason — e.g., r162 adds cleaner TransformControls behavior]. Upgrading from r160 to r{N}. Proceed, or stay on r160 (accepting that [tradeoff])?"*

Never silently upgrade. Never upgrade by more than necessary.

### Downgrade

Never downgrade from r160. Older versions lack importmap support and modern API patterns.

---

## 3. Visual fidelity tiers — with user-facing explanations

The upfront question presents these tiers in plain language. Here are the technical and plain-language versions in sync:

### Primitives — plain language

> "Shapes built from basic geometric forms only — cubes, spheres, cylinders, cones, toruses. Clean and abstract. Fast to generate and always looks professional. Best when 'clean and clear' matters more than 'looks exactly like the real thing.' Recommended default."

### Primitives — technical

Use only `BoxGeometry`, `SphereGeometry`, `CylinderGeometry`, `ConeGeometry`, `TorusGeometry`, `PlaneGeometry`, `RingGeometry`. Compose via `THREE.Group`. Materials: `MeshStandardMaterial` with solid colors only.

### Custom geometry — plain language

> "Shapes built using three.js helpers that create more specific forms — lathe geometry for rotationally symmetric parts (like bottles or cylindrical sensors), extrude geometry for flat profiles pushed into 3D (like device faces with cutouts). Medium realism, medium risk. Best when the device has specific silhouettes that primitives can't capture."

### Custom geometry — technical

Add: `LatheGeometry`, `ExtrudeGeometry`, `ShapeGeometry`. Optionally `TubeGeometry` for curved paths. Comment each custom-geometry block with shape rationale.

### Textured — plain language

> "Shapes with procedural color patterns drawn on their surfaces (stripes, grids, gradients) in addition to solid colors. Highest realism attempt, highest risk of looking amateurish if the textures don't land. Best for devices where a surface pattern is visually essential (perforated panels, mesh filters). Recommendation: use sparingly — a bad texture looks worse than a clean primitive."

### Textured — technical

Use `CanvasTexture` generated in-code (no external files). Draw patterns on an offscreen 256×256 or 512×512 canvas. Apply via `MeshStandardMaterial({ map: canvasTexture })`. Keep the rest of the model simple to prevent visual clutter.

### Heuristic

Default to `primitives`. A clean primitives-based prototype looks professional. A bad textured prototype looks amateur. Realism is not the goal; clarity is.

---

## 4. HTML file structure

Single self-contained HTML. Template below. Note the new exploded-view mechanics (explode button, group transforms, animation).

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>{Device Name} — Interactive Prototype</title>
  <style>
    body { margin: 0; overflow: hidden; font-family: system-ui, sans-serif; background: #1a1a2e; color: #e9e5d6; }
    #info-panel {
      position: absolute; top: 20px; right: 20px; width: 300px;
      background: rgba(26,26,46,0.92); border: 1px solid #ce7777;
      border-radius: 8px; padding: 20px; display: none;
      backdrop-filter: blur(8px);
    }
    #info-panel h3 { margin-top: 0; color: #ce7777; }
    #info-panel p { line-height: 1.5; }
    #info-panel button {
      background: #ce7777; color: #1a1a2e; border: none;
      padding: 6px 12px; border-radius: 4px; cursor: pointer;
      font-weight: bold;
    }
    #instructions {
      position: absolute; bottom: 20px; left: 20px;
      background: rgba(26,26,46,0.82); padding: 12px 16px;
      border-radius: 6px; font-size: 13px; max-width: 320px;
    }
    #explode-btn {
      position: absolute; top: 20px; left: 20px;
      background: #ce7777; color: #1a1a2e; border: none;
      padding: 10px 18px; border-radius: 6px; cursor: pointer;
      font-weight: bold; font-size: 14px;
    }
    #fallback { padding: 40px; text-align: center; display: none; }
    #fallback.active { display: block; }
  </style>
</head>
<body>
  <button id="explode-btn">Tampilkan pandangan meledak (Explode)</button>

  <div id="instructions">
    <strong>{Device Name}</strong><br>
    • Seret untuk memutar kamera<br>
    • Gulir untuk memperbesar<br>
    • Klik komponen untuk detail<br>
    • Tekan tombol Explode untuk memisahkan komponen
  </div>

  <div id="info-panel">
    <h3 id="info-title"></h3>
    <p id="info-body"></p>
    <button onclick="document.getElementById('info-panel').style.display='none'">Tutup</button>
  </div>

  <div id="fallback">
    <h2>Tidak dapat memuat prototype</h2>
    <p>Browser ini tidak mendukung WebGL atau three.js gagal dimuat dari CDN.</p>
    <p>Coba browser modern (Chrome, Firefox, Safari, Edge) atau buka file saat terhubung internet.</p>
  </div>

  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
      }
    }
  </script>

  <script type="module">
    // --- Feature detection
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) throw new Error('WebGL not supported');
    } catch (e) {
      document.getElementById('fallback').classList.add('active');
      document.getElementById('instructions').style.display = 'none';
      document.getElementById('explode-btn').style.display = 'none';
      throw e;
    }

    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

    // --- Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(4, 3, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // --- Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // --- Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    // --- Subsystem groups (for exploded view)
    const groups = {
      housingLid: new THREE.Group(),
      optical: new THREE.Group(),
      pcb: new THREE.Group(),
      power: new THREE.Group(),
      housingBase: new THREE.Group(),
      // [add more per brief]
    };
    Object.values(groups).forEach(g => scene.add(g));

    // Each group's separation offset (for exploded view)
    const separationOffsets = {
      housingLid: new THREE.Vector3(0, 3.0, 0),
      optical: new THREE.Vector3(2.5, 0, 0),
      pcb: new THREE.Vector3(0, -1.5, 0),
      power: new THREE.Vector3(-2.0, 0, 0),
      housingBase: new THREE.Vector3(0, 0, 0),
    };
    // Cache original positions
    const originalPositions = {};
    Object.entries(groups).forEach(([name, g]) => {
      originalPositions[name] = g.position.clone();
    });

    // --- Components (populated from brief)
    const clickableObjects = [];
    const originalMaterials = new Map();

    // [Prototype-specific geometry goes here — one block per component from the brief]
    // Example:
    // {
    //   const geom = new THREE.BoxGeometry(2, 1, 1);
    //   const mat = new THREE.MeshStandardMaterial({ color: 0x2b3a55 });
    //   const mesh = new THREE.Mesh(geom, mat);
    //   mesh.position.set(0, 0, 0);
    //   mesh.userData = { id: 'housing', label: 'Housing utama', info: 'Enclosure cetak 3D PETG' };
    //   groups.housingBase.add(mesh);
    //   clickableObjects.push(mesh);
    // }

    // --- Click handler
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    renderer.domElement.addEventListener('click', (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickableObjects, true);

      // Reset previous highlight
      originalMaterials.forEach((origMat, mesh) => { mesh.material = origMat; });
      originalMaterials.clear();

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        originalMaterials.set(hit, hit.material);
        hit.material = hit.material.clone();
        hit.material.emissive = new THREE.Color(0xce7777);
        hit.material.emissiveIntensity = 0.3;
        document.getElementById('info-title').textContent = hit.userData.label || 'Komponen';
        document.getElementById('info-body').textContent = hit.userData.info || '';
        document.getElementById('info-panel').style.display = 'block';
      } else {
        document.getElementById('info-panel').style.display = 'none';
      }
    });

    // --- Exploded view toggle
    let exploded = false;
    let animProgress = 0; // 0 = assembled, 1 = fully exploded
    let animTarget = 0;
    const animSpeed = 0.05; // per frame; reaches target in ~20 frames (~0.33s at 60fps)

    document.getElementById('explode-btn').addEventListener('click', () => {
      exploded = !exploded;
      animTarget = exploded ? 1 : 0;
      document.getElementById('explode-btn').textContent = exploded
        ? 'Kembali ke pandangan normal (Assemble)'
        : 'Tampilkan pandangan meledak (Explode)';
    });

    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function updateExplodeAnimation() {
      if (animProgress !== animTarget) {
        if (animProgress < animTarget) animProgress = Math.min(animProgress + animSpeed, animTarget);
        else animProgress = Math.max(animProgress - animSpeed, animTarget);
        const eased = easeInOutCubic(animProgress);
        Object.entries(groups).forEach(([name, g]) => {
          const orig = originalPositions[name];
          const offset = separationOffsets[name];
          g.position.set(
            orig.x + offset.x * eased,
            orig.y + offset.y * eased,
            orig.z + offset.z * eased
          );
        });
      }
    }

    // --- Resize
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // --- Animation loop
    function animate() {
      requestAnimationFrame(animate);
      updateExplodeAnimation();
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
  </script>
</body>
</html>
```

### Rules for generation

1. **Every component in the brief appears as a named block.** Components added to the appropriate subsystem group.
2. **Every clickable component has `userData.id`, `.label`, `.info`.**
3. **Palette colors come only from the brief.**
4. **All visible UI strings in chosen output language** (button text, instructions, info panel close button, fallback message).
5. **Separation offsets reflect the brief's exploded-view grouping** — if brief says housing lid separates up by 3.0 units, that's the vector.
6. **Easing function applied to explode animation** for smooth feel.
7. **Do not add features outside minimal-interactive spec** (no physics, no post-processing, no additional animations beyond orbit damping and explode).
8. **Fidelity tier applied consistently** across all components.

---

## 5. Static SVG generation protocol

The normal-view SVG is the **embedded essay artifact**. Same principles as before: hand-crafted SVG markup, painter's algorithm, self-contained.

### Normal view

- Default camera: three-quarter (30° rotation + 20° tilt)
- Components rendered back-to-front
- Labels in margin areas with leader lines
- ViewBox typically 1200×900

### Exploded view

- Same camera angle as normal view (so the two read continuously)
- Wider viewBox (e.g., 1600×1200) to accommodate separated components
- Components rendered at their exploded positions (apply separation offsets from brief)
- Dashed assembly lines connecting exploded components back to their origin positions (thin gray `stroke-dasharray="4 4"`)
- Label text can be longer/more descriptive since there's more space

### Exploded-view SVG template

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" width="1600" height="1200">
  <defs>
    <!-- Gradients for depth cues, same as normal view -->
  </defs>

  <rect width="1600" height="1200" fill="#f5f3ea"/>

  <!-- Assembly lines first (back layer) -->
  <g id="assembly-lines" stroke="#8a8578" stroke-width="1" stroke-dasharray="4 4" fill="none">
    <!-- From component's exploded position back toward assembled center -->
    <line x1="..." y1="..." x2="..." y2="..."/>
  </g>

  <!-- Separated subsystem groups -->
  <g id="housing-lid" transform="translate(0, -200)">
    <!-- shapes making up this subsystem -->
  </g>
  <g id="optical-assembly" transform="translate(250, 0)">
    <!-- shapes -->
  </g>
  <g id="pcb" transform="translate(0, 120)">
    <!-- shapes -->
  </g>
  <g id="housing-base">
    <!-- shapes at origin -->
  </g>

  <!-- Labels with leader lines (front layer) -->
  <g id="labels" font-family="system-ui, sans-serif" font-size="16" fill="#1a1a2e">
    <line x1="..." y1="..." x2="..." y2="..." stroke="#1a1a2e" stroke-width="1.5"/>
    <text x="..." y="...">Layar OLED 2,4 inci — tampilan data real-time</text>
  </g>
</svg>
```

### Rules for exploded SVG

- Assembly lines in thin dashed style, in the background
- Groups positioned at their exploded offsets (same as HTML's separation offsets but in 2D projection)
- Labels placed near their separated components (not crowded at the margins)
- Larger label font is acceptable (18–20px vs normal view's 16–18px) since there's more space

---

## 6. Indonesian language rendering

Indonesian text in SVG: `font-family: system-ui, sans-serif` handles all Indonesian Latin characters cleanly (no exotic diacritics needed). Confirmed working in all major browsers and in most PDF exporters.

Indonesian text in HTML: same default font family. No special handling needed.

If the user specifies a brand font or custom typography, flag it — custom fonts require either web font loading (breaks offline) or system font fallback. Recommend system font for the SVG (which is in the submission) and optionally a web font for the HTML (which is interactive-only, internet likely available).

---

## 7. Draft modification protocol

Same versioned-backup protocol as Flowchart Agent.

### Slot detection

`SLOT_TYPE: prototype` + `TARGET_SKILL: prototype-design-agent`.

### Versioned backup

- `{draft_stem}.backup_v{N}.md` convention
- On conflict, ask: overwrite latest or create new version (default: new)

### Placeholder replacement

**Before:**
```
![PLACEHOLDER: Figure N — [caption]](TBD)
```

**After (default, normal view primary):**
```
![Figure N — [caption]](05_prototypes/{SLOT_ID}_prototype.svg)
<!-- Exploded view: 05_prototypes/{SLOT_ID}_prototype_exploded.svg | Interactive 3D: 05_prototypes/{SLOT_ID}_prototype.html -->
```

**After (exploded view primary, if user chose exploded-only):**
```
![Figure N — [caption] — tampilan meledak](05_prototypes/{SLOT_ID}_prototype_exploded.svg)
<!-- Normal view: 05_prototypes/{SLOT_ID}_prototype.svg (not generated per user choice) | Interactive 3D: 05_prototypes/{SLOT_ID}_prototype.html -->
```

### Metadata table update

```
| slot_3 | prototype | prototype-design-agent | Filled 2026-04-22 — normal+exploded SVG + HTML with toggle |
```

---

## 8. Iteration loop protocol

### Classify the request

1. **Brief-level refinement** (components, colors, labels) → update brief first, re-approve, regenerate
2. **Code-level refinement** (bug, label position, animation timing) → edit code; brief stays
3. **Both artifacts equally affected** → propagate to HTML + both SVGs
4. **One artifact only** → fix that artifact

### Limits

- Soft cap: 5 rounds per prototype. Past 5, ask: *"Want to revise the brief, or continue iterating?"*
- Hard cap: 10 rounds. Past 10, stop; recommend fresh brief.

### Never do

- Regenerate from scratch silently
- Change fidelity tier mid-iteration without asking
- Add components not in brief

---

## 9. Parts List integration protocol

When `02_research_parts_list.md` is available:

### Read these fields from parts list

- Component ID (P1, P2, ...)
- Component name
- Dimensions
- Subsystem grouping

### Map to brief

For each component in parts list that's relevant to the prototype:
- Use exact name as component name in brief
- Use dimensions to set scale in scene (normalize to scene's unit scale)
- Use subsystem to assign to exploded-view group

### When to not use a parts list component

- The component is electrical-only with no visible form factor (e.g., surface-mount resistor buried on PCB). Fold into PCB component in scene.
- The component is redundant for visualization (e.g., one of 8 identical screws). Use 1–2 representative screws.

### When brief needs components not in parts list

- Enclosure details (internal ribs, mounting posts, cable channels) rarely appear in parts list. Generate from spec.
- External accessories (straps, stands, covers) if described in essay.

Flag in brief which components came from parts list vs. were added.

### Dimensions syncing

If parts list says `55mm × 28mm × 13mm`, convert to scene units (pick a scale — e.g., 10mm = 1 unit, so this becomes `5.5 × 2.8 × 1.3`). Apply consistently across all parts list components so proportions stay real.

---

## 10. Quality checks before saving

Run each. Fix failures before finalizing.

### Scene brief
- [ ] Brief produced before code
- [ ] Brief approved by user
- [ ] Brief file saved
- [ ] If parts list exists, brief components synced (correct names and dimensions)

### HTML
- [ ] three.js version pinned per policy (r160 default, or upgraded with stated reason)
- [ ] Self-contained (only three.js CDN)
- [ ] WebGL feature detection with fallback
- [ ] Orbit controls with damping
- [ ] All components from brief rendered
- [ ] Clickable components have `userData.id/.label/.info`
- [ ] Info panel works
- [ ] Info panel text in chosen output language
- [ ] Instructions overlay in chosen output language
- [ ] Explode button present
- [ ] Explode button text in chosen output language
- [ ] Subsystem groups match brief's exploded-view grouping
- [ ] Separation offsets match brief
- [ ] Easing applied to explode animation
- [ ] Palette matches brief
- [ ] No features outside minimal-interactive spec
- [ ] Resize handler present
- [ ] Opens successfully in Chrome, Firefox, Safari

### Normal-view SVG
- [ ] Visually matches HTML (same components, palette, approximately same camera)
- [ ] Labels + leader lines per normal-view labels plan
- [ ] Label text in chosen output language
- [ ] No external resources

### Exploded-view SVG (if generated)
- [ ] Components at separated positions matching brief's offsets
- [ ] Assembly lines connecting separated components to origin (dashed)
- [ ] Labels per exploded-view labels plan
- [ ] Label text in chosen output language
- [ ] Camera angle matches normal view (continuity)
- [ ] Wider viewBox accommodates separation

### Consistency across three artifacts
- [ ] Same device is represented (components, proportions, colors)
- [ ] Same subsystem groupings across HTML explode and SVG exploded
- [ ] Label text in normal-view SVG matches `userData.label` in HTML for dual-use components
- [ ] Parts list integration (if used) applied consistently across all three

### Draft integration (slot-driven only)
- [ ] Versioned backup created, user consulted on conflicts
- [ ] Placeholder replaced with appropriate SVG path (normal or exploded per user choice)
- [ ] Supplementary files (other SVG, HTML) referenced in draft comment
- [ ] Slot comment markers preserved
- [ ] Metadata table STATUS updated
- [ ] No other parts of draft modified

### File output
- [ ] Brief `.md` saved
- [ ] HTML `.html` saved
- [ ] Normal-view SVG saved (unless user chose exploded-only)
- [ ] Exploded-view SVG saved (unless user chose normal-only)
- [ ] All files in `{competition_folder}/05_prototypes/`
- [ ] Filenames use `{SLOT_ID}_prototype` / `{SLOT_ID}_prototype_exploded` convention

---

## 11. Common failure modes to avoid

- **Skipping the brief**: writing code before brief approval — massive iteration cost
- **Brief-code drift**: code has components the brief lacks or vice versa
- **HTML-SVG drift**: interactive and static artifacts show different objects
- **Parts list abandonment**: parts list exists but the skill ignored it, producing a prototype with invented dimensions
- **Parts list over-insertion**: including every parts list entry as a visible component, when some should be hidden (resistors, small ICs) or consolidated
- **Silent palette expansion**: adding colors beyond brief palette
- **Mixed unit scales**: positions at mixed magnitudes causing camera framing issues
- **Over-engineering**: physics, animation timelines, shaders beyond minimal-interactive
- **Under-engineering**: no click-highlight or no explode button — HTML loses its purpose
- **CDN version drift**: unpinned or `@latest` version
- **External resources**: images, fonts, scripts beyond three.js CDN
- **Standalone mode modifying draft**: no draft modification in standalone
- **Embedding HTML in draft**: must embed SVG; HTML is supplementary
- **Labels overlapping in SVG**: labels go in margins with leader lines
- **Realism drift in textured tier**: amateur-looking textures; fall back to primitives for those components
- **Component grouping errors in exploded view**: sensor ends up grouped with power in exploded view because of careless grouping — must match brief
- **Separation offsets producing clipping**: components exploded into each other or past the camera frame — test in preview before committing
- **Fallback UI missing**: WebGL detection failure shows blank page
- **Indonesian label issues**: if using a custom font without fallback, Indonesian characters may render as squares. Always use `system-ui, sans-serif` as base.
- **Parts list dimensions ignored during scaling**: failing to normalize the scene scale so a 55mm board and a 3000mAh battery look proportional to each other

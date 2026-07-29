# Tiny Fangs Desktop Art-Direction Bible

- **Status:** Reference-locked specification; independent critique pending
- **Canonical frame:** 1672 × 941 CSS pixels, DPR 1, sRGB
- **Scope:** Desktop presentation only
- **References:** Immutable supplied images listed below
- **Plan:** `thoughts/shared/plans/PLAN-tiny-fangs-aaa-presentation.md`, Phase 2
- **Living ledger:** `thoughts/shared/GOALS-tiny-fangs-aaa.md`, Task 19

This document turns the supplied still images into measurable production targets. It does not
approve its own art direction, lock a camera, authorize a literal copy of reference artwork, or
define the deferred mobile port.

## 1. Authority, Vocabulary, and Measurement Method

### 1.1 Immutable authorities

| ID | Role | Repository path (canonical) |
|---|---|---|
| R1 | Card chassis, material, frame-family, card-back, and close-up staging | `docs/exec-50304c60-4218-4f0b-b73f-27b218d4b941.png` |
| R2 | Field silhouette, camera, layout, environment, light, and board staging | `docs/exec-cb613d03-7a77-4266-bd6b-e0d83428f067.png` |

The originally supplied attachment copies (machine-local `~/.codex/attachments/…/image-1.png`
and `image-2.png`) are byte-identical to these repository paths; the repository copies are the
canonical, portable authorities.

Both sources are 1672 × 941 pixels. Their protected repository copies are byte-identical:

- R1/card SHA-256: `4ecb53d517d40edc5a7b4907e6991c6b8dcce40cc34e6a21c14b709ed2228056`
- R2/board SHA-256: `5229e89ad2888ef9f3245d6ecd77605ec56a3cc29a6e378c4c7474659e4b79e7`

### 1.2 Evidence labels

- **M — measured:** traced or sampled directly from R1 or R2 at original resolution.
- **L — locked:** a production constraint that can be implemented before camera selection.
- **B — bake-off:** deliberately unresolved until the orthographic versus low-FOV blind review.
- **I — interpretation:** a production reading of a still image; it must be tested, not presented
  as recovered camera or material metadata.

### 1.3 Reproduction method

Measurements use the top-left image origin, integer pixel coordinates, and half-open rectangles
`(left, top, right, bottom)`. Normalized values divide x/width by 1672 and y/height by 941.
Both immutable PNGs decode as `RGB` but contain no embedded ICC profile and no PNG `sRGB`, `gAMA`,
or `cHRM` color-space declaration. They are therefore untagged RGB, not self-declaring sRGB.
Before any point sample, median, CIEDE2000, or luminance calculation, the measurement pipeline
assigns the IEC 61966-2-1 sRGB profile explicitly, without altering the stored channel values.
Color-region values are per-channel medians after that assignment; point values are exact decoded
channel samples. Relative luminance uses the WCAG sRGB transfer function. Bounding boxes were
traced to the visible object edge; soft glows and shadows are reported separately.

Every metric packet records `decoder`, `decoderVersion`, `inputSha256`, `embeddedProfile`,
`assignedProfile`, and `conversionIntent`. This revision's measurements used
`Pillow 11.3.0`, `embeddedProfile: null`, `assignedProfile: IEC 61966-2-1 sRGB`, and
`conversionIntent: relative-colorimetric`. A production or reference capture must either embed
an IEC 61966-2-1 sRGB ICC profile or declare `colorSpace: IEC 61966-2-1 sRGB` in its signed
capture manifest. A missing declaration, a mismatched profile, or measurements made before the
explicit assignment invalidate the color evidence.

The following command reproduces image identity and dimensions:

```sh
shasum -a 256 \
  docs/exec-50304c60-4218-4f0b-b73f-27b218d4b941.png \
  docs/exec-cb613d03-7a77-4266-bd6b-e0d83428f067.png

python3 - <<'PY'
from PIL import Image

for path in (
    "docs/exec-50304c60-4218-4f0b-b73f-27b218d4b941.png",
    "docs/exec-cb613d03-7a77-4266-bd6b-e0d83428f067.png",
):
    image = Image.open(path)
    print(path, image.size, image.mode, image.info)
PY
```

Soft painted edges create a ±3 px tracing uncertainty on cards/slots and ±8 px on foliage,
shadow, or glow envelopes. This uncertainty is not permission for DOM/Three misalignment; that
separate implementation tolerance is 2 CSS px at the canonical frame.

## 2. Canonical Desktop Composition

### 2.1 Measured R2 landmarks

These are measurements of the reference, not a claim about its game rules.

| R2 landmark | Center px | Visible size px | Center normalized | Size normalized | Confidence |
|---|---:|---:|---:|---:|---|
| Opponent deck stack | 365, 267 | 130 × 176 | 0.2183, 0.2837 | 0.0778 × 0.1870 | ±4 px |
| Opponent left empty slot | 657, 264 | 140 × 178 | 0.3929, 0.2806 | 0.0837 × 0.1892 | ±4 px |
| Opponent center small card | 834, 267 | 116 × 188 | 0.4988, 0.2837 | 0.0694 × 0.1998 | ±8 px envelope |
| Opponent large active card | 1065, 252 | 180 × 228 | 0.6370, 0.2678 | 0.1077 × 0.2423 | ±8 px envelope |
| Opponent right utility card | 1278, 270 | 108 × 132 | 0.7644, 0.2869 | 0.0646 × 0.1403 | ±4 px |
| Player deck stack | 344, 577 | 150 × 188 | 0.2057, 0.6132 | 0.0897 × 0.1998 | ±5 px |
| Player large active card | 520, 573 | 176 × 238 | 0.3110, 0.6089 | 0.1053 × 0.2529 | ±4 px |
| Player left empty slot | 729, 570 | 135 × 185 | 0.4360, 0.6057 | 0.0807 × 0.1966 | ±4 px |
| Player center small card | 913, 567 | 126 × 182 | 0.5461, 0.6026 | 0.0754 × 0.1934 | ±3 px |
| Player right empty slot | 1091, 565 | 130 × 185 | 0.6525, 0.6004 | 0.0778 × 0.1966 | ±4 px |
| Player right utility card | 1305, 580 | 103 × 159 | 0.7805, 0.6164 | 0.0616 × 0.1690 | ±8 px |
| Four-card hand envelope | 840, 797 | 624 × 228 | 0.5024, 0.8470 | 0.3732 × 0.2423 | ±7 px |
| Divider luminous band | 814, 414 | 1283 × 8 | 0.4868, 0.4400 | 0.7673 × 0.0085 | ±8 px ends |
| Divider center diamond | 836, 414 | see below | 0.5000, 0.4400 | see below | threshold-stated |

Two measurement classes coexist in this table and must not be conflated. The §3.1.1 quadrilateral
traces are the crisp-face authority: they trace the visible card *face* only. The rows marked
"±8 px envelope" are painted-envelope measurements that additionally include visible stack side
thickness, resting shadow contact, and soft painted edges — which is why the opponent active
envelope height (228) exceeds its `R2-Q3` face height (≈211) and the opponent center small
envelope (188) exceeds its `R2-Q2` face height (≈173). Wherever a face measurement and an
envelope measurement disagree, the quadrilateral is authoritative for projected card geometry and
the envelope is authoritative only for allocation/clearance math. The player right utility card
is additionally rotated and partially occluded, and independent re-traces of its painted edges
disagree by more than ±4 px; it carries the same envelope class. The §2.1 divider-clearance
derivation below deliberately uses envelope edges, because clearance protects against the whole
painted mass, not only the card face.

The divider luminous band is a defined measurement, not a soft-edge eyeball. A column qualifies
when both hold for its peak pixel in rows 405–425: (a) the peak's WCAG relative luminance exceeds
the median of the adjacent grass rows (380–395 and 435–450) by more than 0.10, and (b) the peak
row lies within 409–419 — the row-consistency gate that excludes bright flowers, rocks, and
sunlit grass whose maxima sit elsewhere in the search window. Contiguous qualifying runs of at
least 16 px participate; the band is grown from the longest participating run intersecting the
central third of the frame (x 558–1114), bridging inter-run gaps of at most 130 px caused by
occluding props or cards — the constant is set just above R2's own largest occluder gap (121 px)
while staying far below any board-scale distance, so one occluding prop bridges but two separate
luminous features never merge. Executed on R2 this yields x ≈ 173–1455 (span 1283 px, 76.7% of
frame width, band center x ≈ 814) with no participating run excluded, including the bridged
121 px occlusion at x 362–482 where a dim prop interrupts the line; the same warm gold hue and
row continue on both sides. Endpoint uncertainty is ±8 px because the ends fade. Earlier span claims made without
the row-consistency and run-participation gates are superseded.

The center diamond is defined by its vertical-thickness profile, which is robust against both the
divider line and the surrounding grass: for each column in x 760–920, measure the vertical extent
of luminance > 0.55 within rows 395–439; the baseline is the median extent of the plain line
sampled at x 600–760 and 920–1080 (10 px on R2); the diamond is the connected column range whose
extent is at least baseline + 4 px, where a gap is a run of consecutive non-qualifying columns
and gaps of at most 2 such columns are joined. Executed on R2 this yields x 818–859 — core width
42 px, maximum core height 44 px. Production tolerance applies to this core only;
glow beyond it is a rendering consequence, not an independent target, and no separate glow
threshold is specified because the meadow's own median luminance (≈ 0.44) makes low-threshold
glow extents unmeasurable against grass.

Measured vertical bands:

- opponent play: y = 139–367 px, or 0.148–0.390;
- divider center: y = 414 px, or 0.440;
- player play: y = 453–691 px, or 0.481–0.734;
- hand: y = 683–911 px, or 0.726–0.968; envelope center y = 797 px, or 0.8470.

Divider clearance is derived from the luminous band's vertical envelope, rows 410–418 inclusive
(row ranges in this section are inclusive at both ends, unlike the half-open rectangle
convention; the 9-row band brackets the 8 px core centered on y = 414): the opponent active card's envelope bottom sits at y = 366
(252 + 228/2), giving a 44 px gap to the band top, and the player play band begins at y = 453,
giving a 35 px gap from the band bottom. The production target keeps at least 32 px of clear
divider breathing room after glows and selection rings.

### 2.2 Locked Tiny Fangs normalized anchor map

This table adapts the reference's composition to Tiny Fangs' required deck, active, two bench,
Set, grave, hand, HUD, action, and log surfaces. Centers and screen envelopes are locked
two-dimensional composition targets. An envelope is an axis-aligned allocation box, not the
projected card silhouette and not a substitute for its four projected corners. World-space values,
projection, and the per-anchor golden quadrilaterals remain bake-off decisions.

| Surface | Center px | Screen envelope px | Center normalized | Envelope normalized | Layer and behavior |
|---|---:|---:|---:|---:|---|
| Opponent deck | 361, 264 | 144 × 180 | 0.2159, 0.2806 | 0.0861 × 0.1913 | Board; visible stack thickness |
| Opponent bench A | 655, 264 | 136 × 180 | 0.3917, 0.2806 | 0.0813 × 0.1913 | Board; slot or card |
| Opponent bench B | 833, 264 | 126 × 180 | 0.4982, 0.2806 | 0.0754 × 0.1913 | Board; slot or card |
| Opponent active | 1065, 252 | 180 × 228 | 0.6370, 0.2678 | 0.1077 × 0.2423 | Board focal card |
| Opponent Set | 1278, 270 | 108 × 154 | 0.7644, 0.2869 | 0.0646 × 0.1637 | Opaque back until rules reveal |
| Opponent grave | 1420, 270 | 84 × 146 | 0.8493, 0.2869 | 0.0502 × 0.1552 | Collapsed physical stack |
| Player deck | 344, 576 | 150 × 188 | 0.2057, 0.6121 | 0.0897 × 0.1998 | Board; visible stack thickness |
| Player active | 520, 572 | 176 × 238 | 0.3110, 0.6079 | 0.1053 × 0.2529 | Board focal card |
| Player bench A | 729, 570 | 136 × 184 | 0.4360, 0.6057 | 0.0813 × 0.1955 | Board; slot or card |
| Player bench B | 912, 568 | 128 × 184 | 0.5455, 0.6036 | 0.0766 × 0.1955 | Board; slot or card |
| Player Set | 1092, 568 | 130 × 184 | 0.6531, 0.6036 | 0.0778 × 0.1955 | Board; card or slot |
| Player grave | 1306, 580 | 104 × 160 | 0.7811, 0.6164 | 0.0622 × 0.1700 | Inspectable physical stack |
| Hand fan envelope | 840, 797 | 624 × 228 | 0.5024, 0.8470 | 0.3732 × 0.2423 | DOM foreground; 1–7 cards |
| Opponent HUD ribbon | 836, 52 | 520 × 56 | 0.5000, 0.0553 | 0.3110 × 0.0595 | Bounds (576,24,1096,80); transparent/diegetic; no black bar |
| Player HUD rail | 117, 792 | 180 × 148 | 0.0700, 0.8417 | 0.1077 × 0.1573 | Edge tokens; may compact, not vanish |
| Action rail | 1580, 750 | 136 × 260 | 0.9450, 0.7970 | 0.0813 × 0.2763 | Exact x bounds 1512–1648; six actions |
| Collapsed log rail | 1580, 400 | 136 × 300 | 0.9450, 0.4251 | 0.0813 × 0.3188 | Exact x bounds 1512–1648; live region |

Anchor rules:

1. **L:** The card/slot center must be within 3 px of this table in the canonical deterministic
   fixture. Before camera selection, envelope-center and envelope-bound measurements are the only
   per-anchor gates.
2. **L:** Focal active cards create the reference diagonal: player active near lower-left and
   opponent active far upper-right.
3. **L:** Hand card centers distribute symmetrically around x = 840 px. At four cards, initial
   target centers are x = 612, 764, 916, and 1068 px with rotations between −5° and +5°.
4. **L:** Rails use translucent paper, carved tokens, or edge-mounted objects. A contiguous
   near-black rectangle wider than 60 px or taller than 180 px fails.
5. **L:** No hover, selection, particle, or status treatment may change a semantic hit target's
   resting anchor.
6. **L:** Mobile and portrait anchors are intentionally absent. They are not to be inferred by
   squeezing this desktop map.
7. **B:** After the camera winner is locked, record four ordered screen-space corners
   `[topLeft, topRight, bottomRight, bottomLeft]` for every card/slot anchor in a versioned golden
   quadrilateral file. DOM card corners, Three decals, and contact-shadow proxies are then judged
   against those same corners at ≤2 CSS px; no width/height ratio is inferred from an axis-aligned
   envelope.
8. **L:** Every semantic HUD or rail bound begins at y ≥24 px. The opponent HUD is exactly
   `(576,24,1096,80)` at the canonical frame; focus, hover, tooltip, and status paint must remain
   inside the viewport semantic safe rectangle rather than clipping above it.

### 2.3 Desktop rails, action grid, and separation

- **L:** Both right rails use x = 1512–1648 px. Their right edge leaves the required 24 px viewport
  inset. Focus, selection, hover, and hold-progress paint is clipped or inset to this fixed bound.
- **L:** The collapsed log occupies y = 250–550 px; the action rail occupies y = 620–880 px.
  Their 70 px resting separation may not be consumed by expansion or focus paint.
- **L:** Opponent grave resting envelope ends at x = 1462 px, leaving 50 px to the log rail.
  Grave selection paint may extend at most 8 px right; a maximum log state may extend left only to
  x = 1482 px. The remaining maximum-state separation is exactly 12 px.
- **L:** Every other rail-to-card/hand pair has ≥24 px separation at rest and ≥12 px after its
  documented maximum hover, focus, selection, or expansion state.
- **L:** The action rail contains an exact 2 × 3 grid. The six 48 × 48 px target rectangles are:
  - Summon `(1526,666,1574,714)` and Cast `(1586,666,1634,714)`;
  - Set `(1526,726,1574,774)` and Attack `(1586,726,1634,774)`;
  - Retreat `(1526,786,1574,834)` and End Turn `(1586,786,1634,834)`.
- **L:** Horizontal and vertical target gaps are 12 px. Each fixed focus-ring rectangle extends
  exactly 2 px outside its target, yielding a 52 × 52 px focus bound and an 8 px clear gap between
  neighboring focus bounds. Exact focus bounds are Summon `(1524,664,1576,716)`, Cast
  `(1584,664,1636,716)`, Set `(1524,724,1576,776)`, Attack `(1584,724,1636,776)`, Retreat
  `(1524,784,1576,836)`, and End Turn `(1584,784,1636,836)`. Focus rings do not change layout or
  the rail envelope.
- **L:** The six actions and keyboard cues remain present in DOM order
  Summon, Cast, Set, Attack, Retreat, End Turn. Visual placement is row-major in the order above.

### 2.4 Quiet zone and safe areas

- **L:** Board-card safe rectangle: x = 234–1464 px (0.1400–0.8756), y = 75–917 px
  (0.0797–0.9745). It contains every card envelope and the hand, whose bottom is y = 911 px.
- **L:** Viewport semantic safe rectangle: x = 24–1648 px, y = 24–917 px. Rails and their fixed
  focus rings remain inside it.
- **L:** Central low-detail zone: x = 250–1420 px (0.150–0.849), y = 115–760 px
  (0.122–0.808). Within it, environment contrast at card edges stays below 0.12 local relative
  luminance delta across a 12 px ring.
- **L:** The environment frame occupies 10–15% at the left, right, and top. At the bottom it may
  occupy 8–12% behind the hand but may not cover card text or hit targets.
- **L:** The card/action safe inset is 24 px from the viewport edge. Environmental meshes may
  cross the viewport edge; semantic UI may not.
- **L:** At non-canonical desktop aspect ratios, retain the normalized playable rectangle and add
  or crop environment outside it. Do not non-uniformly scale cards.

### 2.5 Player-active versus hand intersection rule

The locked axis-aligned envelopes intentionally overlap: player active is
`(432,453,608,691)` and the hand is `(528,683,1152,911)`, producing an 80 × 8 px envelope
intersection `(528,683,608,691)`. Envelopes reserve composition space; they are not semantic hit
polygons and do not authorize visible or interactive overlap.

At camera lock:

1. Generate the winning-camera player-active quadrilateral and all four resting hand-card
   quadrilaterals from the versioned fixture.
2. Compute Euclidean edge-to-edge distance for every active/hand polygon pair and for their
   semantic hit polygons.
3. Require ≥4 CSS px of visible background between the active silhouette and every hand
   silhouette, and ≥4 CSS px between their semantic hit polygons. A z-index, pointer-event
   priority, transparent overlap, or occluding particle does not satisfy either measurement.
4. Store the minimum pair, closest points, signed distance, and a 4 px gap-mask overlay in the
   camera evidence.

If either distance fails, corrections occur in this fixed order:

1. tune only the candidate's declared pitch/FOV/frustum/aim parameters while retaining every
   §2.2 center within 3 px;
2. tune hand-card rotation within −5° to +5° and uniform hand-card scale down by at most 3%,
   retaining the fixed four centers, the 0.660 local chassis, and the hand envelope;
3. reject that camera candidate.

Active-card anchor, hand anchor, and the four fixed hand centers may not move as an implicit
overlap fix. If both candidates fail after permitted tuning, the camera bake-off is blocked and a
versioned art-bible anchor revision must be independently critiqued before any coordinate changes.

## 3. Camera: Two Calibrated Hypotheses

R2 is a painted still and does not expose recoverable camera metadata. Projection type, exact
pitch, FOV, camera distance, and world scale therefore remain **B**.

### 3.1 Measured cues

- The divider is level within 1 px across its visible span (1283 px under the §2.1 band method).
- Slot and card side edges are nearly parallel but show measurable 2.0–4.9° nominal side
  convergence across the six independent traces below.
- Comparable near/far slot heights differ by approximately 5–15%, depending on which pair is
  used. Category-specific card sizing prevents treating this as a pure perspective measurement.
- Player active versus opponent active height is 238/228 = 1.044; player right utility versus
  opponent right utility is 159/132 = 1.205. The spread proves staged hierarchy but does not prove
  how much comes from projection.
- Large foreground perimeter props occupy more pixels and are softer than top-edge props.
- No horizon line is visible. The implied vanishing region is above the frame near horizontal
  center.

#### 3.1.1 Immutable independent R2 quadrilateral targets

These source traces are measured directly from immutable R2 hash
`5229e89ad2888ef9f3245d6ecd77605ec56a3cc29a6e378c4c7474659e4b79e7`; they are not generated
by either camera candidate. Coordinates are ordered `[TL,TR,BR,BL]` at original 1672 × 941
resolution. Uncertainty is per coordinate and reflects the painted edge, glow, and slot line.

| Source ID | R2 object / Tiny Fangs comparison anchor | Immutable TL/TR/BR/BL px | Uncertainty |
|---|---|---|---:|
| `R2-Q1` | opponent left empty slot / opponent bench A | [(602,175),(726,176),(719,350),(589,349)] | ±4 px |
| `R2-Q2` | opponent center small card / opponent bench B | [(777,179),(887,180),(893,352),(773,352)] | ±3 px |
| `R2-Q3` | opponent large active card / opponent active | [(985,141),(1143,143),(1153,353),(977,351)] | ±4 px |
| `R2-Q4` | player large active card / player active | [(448,456),(606,458),(595,692),(428,690)] | ±4 px |
| `R2-Q5` | player center small card / player bench B | [(862,479),(974,481),(978,658),(852,657)] | ±3 px |
| `R2-Q6` | player right empty slot / player Set | [(1030,476),(1150,477),(1158,657),(1024,655)] | ±4 px |

Derived geometry uses Euclidean edge lengths. Top/bottom angles are degrees clockwise from screen
+x; left/right lean is degrees from screen +y; convergence is `abs(leftLean-rightLean)`;
foreshortening is `mean(left,right)/mean(top,bottom)`.

| ID | top° / bottom° | top:bottom | left:right | convergence° | foreshortening |
|---|---:|---:|---:|---:|---:|
| `R2-Q1` | 0.46 / 0.44 | 0.954 | 1.002 | 1.97 | 1.372 |
| `R2-Q2` | 0.52 / 0.00 | 0.917 | 1.005 | 3.32 | 1.501 |
| `R2-Q3` | 0.73 / 0.65 | 0.898 | 1.000 | 4.91 | 1.259 |
| `R2-Q4` | 0.73 / 0.69 | 0.946 | 1.003 | 2.19 | 1.443 |
| `R2-Q5` | 1.02 / 0.45 | 0.889 | 1.007 | 4.51 | 1.493 |
| `R2-Q6` | 0.48 / 0.86 | 0.895 | 0.994 | 4.46 | 1.414 |

The nominal independent intervals are: top angle 0.46–1.02°, bottom angle 0.00–0.86°,
top:bottom 0.889–0.954, left:right 0.994–1.007, convergence 1.97–4.91°, and foreshortening
1.259–1.501. The metric report also propagates each trace's stated coordinate uncertainty by
evaluating all coordinate-bound extrema; it may not silently treat nominal values as exact.

Each O/P camera report projects the six corresponding candidate planes and records, per source ID:
eight signed coordinate residuals, four Euclidean corner residuals, RMS/max corner residual,
top/bottom angle residuals, opposite-edge-ratio residuals, convergence residual, and
foreshortening residual. The aggregate report includes mean/RMS/max values and the count outside
the propagated R2 uncertainty envelope. Camera critics see this report before voting. Candidate
quads generated after the winner is chosen are downstream registration truth for DOM/Three only;
they may not replace, revise, or score themselves against these independent R2 targets.

### 3.2 Candidate O — calibrated orthographic

| Parameter | Initial hypothesis | Calibration target |
|---|---:|---|
| Projection | Orthographic | Minimize residuals against all six immutable §3.1.1 targets |
| Off-vertical pitch | 25.5° initial; test 22–30° | Slot vertical foreshortening and visible card thickness |
| Yaw / roll | 0° / 0° | Divider level within 1 px |
| Frustum | Fit the 1672:941 board rectangle | Envelope centers within 3 px |
| Projection near/far size ratio | 1.000 ± 0.010 | Hierarchy supplied by authored card sizes only |
| Vanishing point | None | Report resulting convergence residual; do not substitute generated quads |

Orthographic succeeds only if authored prop scale and depth layers reproduce R2's foreground
weight without making the play surface read as an elevation diagram.

### 3.3 Candidate P — calibrated low-FOV perspective

| Parameter | Initial hypothesis | Calibration target |
|---|---:|---|
| Vertical FOV | Test 22°, 26°, and 30° | Lowest FOV that still yields readable depth |
| Off-vertical pitch | Test 22–30° | Minimize §3.1.1 foreshortening and corner residuals without a visible horizon |
| Yaw / roll | 0° / 0° | Divider level within 1 px |
| Aim point | x = 0.500, y = 0.465 screen target | Preserve divider and active diagonal |
| Near/far equal-object scale ratio | 1.05–1.12 | Compare same-size gray cards, not reference categories |
| Implied vanishing region | x = 0.50 ± 0.03; y < −0.20 | Convergence remains barely visible |

Perspective fails if near cards exceed far equivalents by 12%, if the divider bows or slopes by
more than 1 px, or if DOM text planes visibly separate from Three shadows/decals.

### 3.4 Blind bake-off

Both grayboxes use identical screen targets, card silhouettes, environment density, lighting,
fixture state, DPR, and color pipeline. Each produces:

1. a populated 1672 × 941 frame;
2. an environment-only aligned mask from that populated frame;
3. 2× crops for opponent row, divider, player row, hand, all four corners, and active-card
   contact shadows;
4. a fiducial overlay reporting DOM/Three corner error;
5. candidate-specific four-corner golden quadrilaterals for every card/slot anchor;
6. a §3.1.1 residual report against the six immutable R2 source quadrilaterals;
7. a sealed mapping commitment: the SHA-256 of the externally stored O/P mapping file. The
   mapping file itself never enters the packet or any surface a critic verifies; the
   coordinator stores it separately and reveals it only after both critics submit scores, at
   which point the revealed file must hash to the committed value.

Fresh critics score the anonymized candidates against R2 before reveal. The winning projection
must be preferred unanimously and satisfy the camera-graybox-only gate in §13.4. That gate does
not score final card illustration, typography, interface completion, audio, motion, or holistic
wow, and it does not require two consecutive integrated-art revisions. The full seven-category,
wow, and two-revision gate in §13.5–§13.6 applies only to integrated final-art artifacts. A split
decision, tie, or camera chosen for implementation convenience is a failure.

### 3.5 Camera-dependent properties that remain open

- projection type;
- exact pitch, FOV/frustum, height/distance, aim point, and world unit scale;
- final near/far equal-object scale ratio;
- camera-induced card/slot corner geometry within the locked screen envelopes;
- prop parallax and occlusion envelope;
- whether edge-only depth of field improves the board; gameplay cards and text must remain sharp;
- final exposure needed after the winning projection's lit geometry is present.

## 4. Field and Environment System

### 4.1 Silhouette and density

- **L:** The center is an uninterrupted meadow plane with no hard rectangular tabletop edge.
- **L:** The environment forms an irregular frame rather than a uniform hedge. At least 70% of
  pixels in the central low-detail zone remain grass, slot line, shadow, or card.
- **L:** No perimeter prop intrudes more than 42 px into a resting card screen envelope.
- **L:** The divider luminous band is centered at y = 414 ± 3 px and, measured by the exact §2.1
  method (prominence >0.10, peak-row 409–419, runs ≥16 px, central-third seed, gaps ≤130 px
  bridged), spans 68–80% of frame width with endpoint tolerance ±8 px. Its bright core —
  measured as the per-column vertical extent of luminance > 0.55, the same operator as the
  diamond method — is 6–12 px thick (R2 measures 10 px), with an **I**-labeled soft halo of
  roughly 10–30 px where prominence over adjacent grass exceeds 0.10 beyond the core. The band
  may be visibly interrupted by an occluding prop or card without failing, provided the
  interruption bridges under the stated rule.
- **L:** The center diamond's bright core, measured by the §2.1 vertical-thickness-profile
  method, is 33–45 px wide × 38–50 px tall and is centered on the divider's line axis
  (y = 414 ± 2 px) at the frame's horizontal center (x = 836 ± 3 px). Glow beyond the core is
  unconstrained up to the §6.1 emission rules.
- **L:** Slot marks use 1–2 px low-contrast lines at canonical size. Their line luminance is
  1.15–1.35× the immediately surrounding grass, except the divider.

### 4.2 Depth layers

| Layer | Screen envelope | Required content | Focus and motion |
|---|---|---|---|
| D0 distant/top edge | y = 0–0.18 | sun haze, river entry, distant stone, low fence, small flowers | lowest contrast; no independent parallax |
| D1 side frame | x < 0.15 or x > 0.85 | trees, shrubs, medium rocks, flower clusters | middle contrast; ≤2 px ambient parallax |
| D2 play surface | x = 0.14–0.86, y = 0.12–0.81 | grass, slots, divider, seeded small accents | sharp; interaction targets stationary |
| D3 board objects | card/stack anchors | cards, backs, decals, contact shadows | sharp; state-driven motion only |
| D4 foreground corners | y > 0.79 and outer 18% | larger canopy/rocks/flowers, river exit | 0.5–1.5 px equivalent softness; no card overlap |
| D5 interface | HUD/action/log/overlays | readable DOM controls | sharp; independent of scene depth |

### 4.3 Prop placement target

Positions are envelopes, not literal asset copies.

- **River:** enter from x = 0–225 px, y = 0–95 px; exit at x = 1580–1672 px,
  y = 860–941 px. Visible water is limited to the outer 8% and may not form a line behind card
  text.
- **Fence:** primary run at x = 105–290 px, y = 82–175 px, angled 8–18° relative to screen
  horizontal. Optional short echo at right-middle may occupy x = 1590–1672 px, y = 400–515 px.
- **Trees:** canopy masses in top-right, bottom-left, and extreme right-middle; no canopy center
  may enter x = 0.15–0.85 and y = 0.18–0.74.
- **Rocks:** clustered at left-middle, right-middle, and both foreground corners. Use 3–7 facets
  visible per silhouette; avoid sphere primitives and evenly spaced pebble rings.
- **Flowers:** 65–85% of visible blooms sit in the outer 15%; central blooms occur as isolated
  2–5-flower incidents with at least 90 px between clusters.
- **Grass:** low-frequency painted variation spans 90–240 px; high-frequency blade/noise detail
  stays below 3% luminance RMS in the central zone.

No river, fence, tree, rock, or flower layout is accepted from a random distribution alone.
Seeded scattering may fill within authored masks after the primary silhouettes are placed.

## 5. Sampled Palette and Contrast Intent

All coordinates below are exact source pixels unless a rectangle and median are stated.

| Role | Source sample | sRGB / hex | Production use | Contrast intent |
|---|---|---|---|---|
| Sun core | R2 (118, 21) | 237, 198, 116 / `#EDC674` | key-light ceiling and haze | never used as body text |
| Upper meadow | R2 (899, 84) | 194, 171, 77 / `#C2AB4D` | sunlit center field | dark ink reaches 5.6:1 using back navy |
| Lower meadow | R2 (824, 650) | 179, 167, 79 / `#B3A74F` | near-field base | regional Y50 is 7.6%; target 7–10% below upper field |
| Cool foliage | R2 (20, 659) | 51, 75, 66 / `#334B42` | deep perimeter frame | divider gold exceeds 6.6:1 |
| Sunlit foliage | R2 (1571, 338) | 145, 135, 81 / `#918751` | light-facing canopy planes | bridges field and cool frame |
| Divider core | R2 (818, 413) | 245, 215, 131 / `#F5D783` | divider/rune emissive core | use on dark foliage/navy, not paper |
| Creature amber | R1 (328, 417) | 180, 112, 21 / `#B47015` | creature family midtone | dark/light bevel pair required |
| Cast teal | R1 (693, 527) | 39, 122, 121 / `#277A79` | Cast Verse family midtone | distinct from grass by hue, not glow |
| Set plum | R1 (1086, 594) | 106, 90, 102 / `#6A5A66` | Set Verse family midtone | neutral enough for concealed play |
| Card-back navy | R1 (1438, 508) | 55, 47, 63 / `#372F3F` | shared hidden-information back | sampled parchment contrast is 7.01:1 |
| Parchment | R1 (537, 702) | 220, 186, 150 / `#DCBA96` | rules and label ground | sampled ink contrast is 8.0:1 |
| Ink | R1 (387, 670) | 59, 35, 23 / `#3B2317` | primary text and line art | 8.0:1 against sampled parchment |
| Filigree highlight | R1 (1451, 431) | 238, 195, 78 / `#EEC34E` | ≤2 px back/frame accents | not a fill larger than 8% of a card |
| Ivory lip median | R1 rect (375,326,565,337) | 222, 187, 145 / `#DEBB91` | outer card edge | distinct from paper by bevel/value |

Reference-region relative-luminance ranges:

| R2 region | Rectangle | Y10 / Y50 / Y90 |
|---|---|---:|
| Quiet upper meadow | (690,70,950,135) | 0.361 / 0.409 / 0.462 |
| Quiet center meadow | (680,370,980,402) | 0.280 / 0.441 / 0.489 |
| Quiet lower meadow | (680,650,840,685) | 0.340 / 0.378 / 0.418 |
| Deep left foliage | (20,550,130,720) | 0.048 / 0.074 / 0.121 |
| Divider glow | (700,408,970,419) | 0.490 / 0.652 / 0.780 |

Palette rules:

1. **L:** A reference-comparison capture assigns or embeds IEC 61966-2-1 sRGB before comparison
   and does not apply a global LUT that moves any table role by more than CIEDE2000 8 from its
   target.
2. **L:** Final field calibration targets CIEDE2000 ≤5 for the three meadow/foliage medians in
   aligned, unoccluded crops.
3. **L:** The perimeter-to-center luminance ratio uses R2's deep foliage median
   0.074 / upper meadow median 0.409 = 0.181 as its center target; acceptable range is 0.14–0.25.
4. **L:** Readable body text must meet 4.5:1; large text and non-text controls meet 3:1. The
   sampled ink/parchment pair is the preferred high-contrast card combination.
5. **L:** Family color never carries type alone. Frame geometry, icon, label, and accessible name
   also identify creature, Cast Verse, and Set Verse.

## 6. Lighting, Shadows, Atmosphere, and Focus

### 6.1 Direction and value

- **M/I:** Light enters from upper-left. Long environmental shadows travel down-right, primarily
  at a screen angle of 55–75° clockwise from +x.
- **L:** Shadow metrics are computed from renderer-exported masks, never from eyeballing the
  composite. Every production capture that a shadow tolerance applies to must also export, from
  the same frame and camera: a per-object cast-shadow mask, a card/object footprint mask, and an
  environment ID mask. **Contact-shadow centroid** is the centroid of the cast-shadow mask pixels
  within 24 px of the owning card's silhouette, excluding the card footprint, reported as signed
  x/y offset from the silhouette centroid. **Key direction** is the principal axis (PCA first
  component) of each of the two largest single-object umbra masks, reported clockwise from
  screen +x; both must fall in the tolerance band. **Quiet-zone share** classifies every pixel in
  the central low-detail zone by the ID mask as grass, slot line, shadow, or card. Because R2
  cannot export masks, its comparison values are **I**-labeled results of the same formulas
  applied to manually traced dark-region masks, and carry ±8 px envelope uncertainty.
- **L (authored):** Single resting card contact-shadow centroids offset 4–10 px right and
  8–16 px down at canonical size. This band is authored from the locked key-light direction, not
  traced from the references — neither image demonstrates an isolated flat resting card cleanly
  enough to measure one. Contact umbra is 2–6 px; penumbra is 10–26 px. Shadow opacity must not
  lower adjacent body-text contrast below 4.5:1.
- **L:** Stacks, decks, and elevated showcase cards cast longer directional shadows than resting
  single cards: R2's traced stack-shadow centroids measure roughly +25 to +95 px x and +60 to
  +80 px y. Their production tolerance is centroid x +20 to +100 px, y +50 to +90 px, direction
  within the key-direction band. The single-card tolerance never applies to a stack, and a
  challenger may not be failed against the single-card row for reproducing R2's measured stack
  behavior.
- **L:** One shadow-casting warm key establishes direction. Fill is broad and 1.5–2.5 stops below
  key on upward-facing card/terrain planes. No second hard shadow direction is allowed.
- **L:** Bright card-edge highlights occupy ≤8% of the card perimeter and do not clip more than
  0.5% of card pixels per aligned crop.
- **L:** Divider, mana wisps, and named magical effects may emit. Grass and frame materials do not
  bloom globally.

### 6.2 Atmosphere and focus

- **L:** Atmospheric haze increases toward the top 18% and reduces local contrast there by
  10–25% relative to center-field props of the same palette.
- **L:** Gameplay cards, slots, HUD, controls, and text remain free of depth-of-field blur.
- **B:** A 0.5–1.5 px equivalent blur/softness may be used only on outer foreground props if the
  camera bake-off shows a reference-fidelity improvement.
- **L:** Foreground perimeter saturation is 5–15% below central card art; sunlit top-field
  saturation is 0–10% above lower meadow. Saturation changes do not modify card-family colors.
- **L:** Ambient motes occupy fewer than 0.08% of pixels in any settled capture and no mote crosses
  a text bounding box in the deterministic frame.

## 7. Card Chassis and Material Specification

### 7.1 Measured R1 geometry

| R1 object | Traced bounds px | Width/height | Notes |
|---|---:|---:|---|
| Creature card | x 274–616, y 326–829 | 342/503 = 0.680 | slight perspective/edge tilt |
| Cast card | x 666–999, y 327–826 | 333/499 = 0.667 | least occluded calibration card |
| Set card | x 1041–1370, y 330–838 | 329/508 = 0.648 | slight rotation/perspective |
| Cast art aperture | x 711–968, y 344–611 | 257/267 | 77.2% chassis width, 53.5% height |
| Cast rules panel | x 712–969, y 631–787 | 257/156 | 77.2% chassis width, 31.3% height |
| Cast cost medallion | x 697–763, y 338–410 | 66/72 | 19.8% chassis width, overlaps frame |
| Visible card back | x 1316–1506, y 370–796 | 190/426 | partially occluded; ratio not canonical |

The three unobscured front widths/heights yield ratios 0.648–0.680. **L:** Tiny Fangs' card-local,
unprojected chassis uses nominal width/height 0.660 and an acceptable authored range of
0.645–0.670. This test runs on source geometry before camera transforms. A projected board card
is a camera-dependent quadrilateral and is not rejected by measuring its axis-aligned
width/height. After camera selection, projected cards pass only by matching their per-anchor
four-corner golden quadrilateral within 2 CSS px.

### 7.2 Frame hierarchy

Percentages are relative to unprojected card width. The left/right physical-edge-to-aperture
inset is cumulative and must be 10.5–12.5% per side: 35–42 px at 333 px card width. This leaves a
75–79% aperture and removes any ambiguity about additive bevel widths.

| Layer, outside to inside | Increment per side | Cumulative inset | Function |
|---|---:|---:|---|
| Physical corner radius | not an inset; 5.5–7.0% radius | 0% | cardboard silhouette, not a pill |
| Ivory card-stock lip | 3.0–4.0% | 3.0–4.0% | visible thickness and warm edge |
| Dark separation keyline | 0.8–1.0% | 3.8–5.0% | prevents field/frame merging |
| Family-color rail, total | 6.0–6.5% | 9.8–11.5% | creature/Cast/Set identity |
| Art/rules inner keyline | 0.7–1.0% | **10.5–12.5%** | crisp panel containment |

The family-color rail contains, rather than adds after, a 1.0–1.8% upper-left highlight bevel and
a 1.2–2.2% lower-right recessed bevel. The remaining rail width is its family-color midtone.
Neither bevel changes the cumulative 10.5–12.5% inset.

- **L:** Every front uses all seven readable layers at detail-view scale. At board scale, at least
  the lip, separation keyline, family rail, and inner panel edge remain visible.
- **L:** Corner radii are concentric to within 1 px in a 333 px-wide golden-sample capture.
- **L:** No generic uniform 1 px border may substitute for the hierarchy.

### 7.3 Panel anatomy

- **L:** Art aperture width: 75–79% of chassis; height: 50–55%.
- **L:** Art begins 3–6% below the top edge and ends 55–59% down the chassis.
- **L:** Rules panel width: 75–79%; height: 27–32%; top begins at 60–64%.
- **L:** Family seal straddles the art/rules join at 55–64% of card height.
- **L:** Cost medallion width: 17–21%, top-left; numeral optical center within 1.5% of card width.
- **L:** Creature attack and health medallions each occupy 18–23% of card width at the lower
  corners. Their silhouette differs—attack is edged/weapon-derived, health is rounded/heart-derived.
- **L:** Cast and Set cards replace creature stats with a centered footer seal; empty stat circles
  are forbidden.

### 7.4 Exact 333 × 505 safe rectangles and family deltas

The title treatment is original Tiny Fangs geometry; R1 supplies material hierarchy but does not
provide readable title construction. All rectangles below are half-open card-local
`(left, top, right, bottom)` coordinates in a 333 × 505 unprojected chassis.

| Surface | Creature | Cast Verse | Set Verse | Card back |
|---|---|---|---|---|
| Cost | (8,8,76,76) | (8,8,76,76) | (8,8,76,76) | N/A; no face data |
| Title/nameplate outer | (42,228,292,288) | (42,228,292,288) | (42,228,292,288) | N/A |
| Title text | (52,233,282,283) | (52,233,282,283) | (52,233,282,283) | N/A |
| Type/subtitle | (82,204,292,226) | (82,204,292,226) | (82,204,292,226) | N/A |
| Art focal-safe | (42,78,292,202) | (42,78,292,202) | (42,78,292,202) | (24,24,309,481) |
| Family seal | (145,290,188,327) | (145,290,188,327) | (145,290,188,327) | N/A; back sigil is art |
| Rules text | (42,329,292,435) | (42,329,292,455) | (42,329,292,455) | N/A |
| Footer | (84,457,249,495) | (42,457,292,495) | (42,457,292,495) | N/A |
| Attack | (8,437,78,501) | N/A | N/A | N/A |
| Health | (255,437,325,501) | N/A | N/A | N/A |
| Status stack | (295,84,325,220) | reserved, same rectangle | reserved, same rectangle | N/A |
| Inspect glyph, visual only | (281,10,325,54) | (281,10,325,54) | owner-visible: (281,10,325,54) | opponent/public: N/A |

The physical art aperture remains 75–79% wide and 50–55% high; `art focal-safe` is the smaller
unobscured subject/crop rectangle below cost/inspect and above type/title. Physical panel art may
continue beneath overlays, but focal features, text, stats, status icons, and semantic controls
must remain inside their own safe rectangles.

Family deltas are fixed:

- Creature enables attack and health, ends its rules-safe rectangle at y = 435 to clear both stats,
  uses the narrower centered footer, and names a creature subtype in `type/subtitle`.
- Cast Verse omits attack/health, uses the full footer, and labels the type exactly `Cast Verse`.
- Set Verse omits attack/health, uses the full footer, and labels the type exactly `Set Verse`;
  its decorative inspect glyph is owner-only.
- Card back renders no cost, title, type, rules, footer, stats, status, or public inspect control.
  Its original Tiny Fangs sigil stays inside its art-safe rectangle.

Safe rectangles do not overlap, with one deliberate exemption: a rectangle defined as the text
box inside a container rectangle (the title-text box inside the nameplate outer, and any other
explicitly nested pair this section declares) is nested by design and is excluded from the
pairwise non-overlap check; the check applies between sibling content rectangles only. The
minimum gap between adjacent non-N/A sibling rectangles is 2 px; footer-to-creature-stat
horizontal separation is 6 px. Decorative bevel, foil, and aperture art may cross a
safe-rectangle boundary only behind an opaque text/control ground that preserves contrast and
does not change the semantic hit rectangle.

Safe rectangles are authored at the 333 × 505 chassis. When a specimen renders at another size,
each rectangle scales per axis by the linear factors (renderWidth / 333, renderHeight / 505) —
for the §13.2 fronts, 330/333 and 500/505 — with results rounded half-up to 0.1 px. The slightly
non-uniform scale is intentional and follows the chassis, not a uniform fit.

The title/nameplate outer rectangle is exactly 250 × 60 px. Title text uses 22 px, fixed 24.5 px
line height, 10 px horizontal padding, 5 px vertical padding, at most two lines, word-boundary
wrapping, and no font-size compression. Its 230 × 50 px text box fits exactly two lines. Before a
font is licensed, every candidate must render these catalog fixtures at 333 × 505:

- `callOfTheWild` — “Call of the Wild,” longest display name at 16 characters;
- `predatorsMark` — “Predator's Mark,” punctuation and 15 characters;
- `bladewhisker` — “Bladewhisker,” longest unbroken name at 12 characters.

All three require zero clipping, zero ellipsis, no character-scale distortion, and at least 2 px
clearance from the text box on every side. Failure rejects the font/nameplate candidate rather
than shrinking below 22 px.

### 7.5 Board-scale inspect semantics

The 44 × 44 card-local inspect glyph in §7.4 is decorative only: `aria-hidden="true"`,
`pointer-events: none`, and never the semantic target. At board scale, the visible card silhouette
itself is the inspect control for a hand card, player active/bench/Set, either public active/bench,
and a player grave top card. Enter, Space, pointer click, and supported long press open the same
detail view. Opponent Set/back and any private card identity are not focusable, labeled, or
inspectable until a rule-authorized reveal.

For each inspectable card, the winning-camera golden packet stores:

- `visibleQuad`: ordered projected card corners after camera lock;
- `hitPolygon`: the whole visible silhouette, clipped only by genuine visual occlusion;
- `focusRingPolygon`: a 2 px high-contrast ring painted 3 px outside the visible silhouette;
- `hitAabbCssPx`, `minNeighborDistanceCssPx`, `occludedPercent`, accessible name, ownership, and
  privacy classification.

The semantic target's axis-aligned CSS bounds must be at least 44 × 44 px independently of
card-local scale. If a visible grave/deck-top silhouette is smaller, expand its hit polygon to a
fixed 44 × 44 px polygon centered on the visible silhouette, provided the expansion retains ≥4 px
from every other semantic polygon and does not expose a private opponent card. If that expansion
cannot fit, route inspection through a separate fixed ≥44 × 44 px grave/detail control; never
overlap neighboring targets or shrink the target.

Resting and focused states require ≥4 CSS px between semantic polygons, zero focus-ring clipping
at the viewport or rails, and zero occlusion of title, cost, rules, stats, status, or action text.
The ring must reach 3:1 contrast against every sampled segment of its immediate background.
Keyboard focus order follows DOM/gameplay reading order, and closing detail returns focus to the
exact card/control that opened it. The deterministic integrated packet includes the ordered
polygons, collision distances, privacy assertion, a focus-visible full frame, and an aligned
focus crop; a generic card-local icon screenshot is not accessibility evidence.

### 7.6 Surface constraints

- **L:** Card stock reads matte. Paper luminance grain is 1–3% RMS at 1× and loses no glyph stroke
  at 100% zoom.
- **L:** Frame roughness varies at low frequency; specular highlights remain under 12% of the
  frame area and follow the upper-left key.
- **L:** Edge wear is confined to ≤8% of perimeter length, ≤2.5% of card width inward, and never
  intersects name, cost, rules, or stat numerals.
- **L:** Bevels derive from geometry/normal response or authored directional texture, not a
  uniform dark CSS box shadow.
- **L:** Foil is optional and restricted to seals, filigree, or rarity marks covering ≤6% of the
  face. No full-face rainbow sweep, holographic noise, or persistent animated glare.
- **L:** The card back uses the shared navy ground, fine gold line work 1–2 px at 333 px width,
  a centered original Tiny Fangs sigil, and rotational asymmetry subtle enough not to reveal card
  identity.

## 8. Typography and Readability

No font family is locked until licensing and self-hosting are verified. Typography is specified
by measurable behavior, not an assumed brand-name font.

### 8.1 Required type characteristics

- Display/name face: compact serif or humanist display face, moderate stroke contrast, open
  counters at 16 px, no hairline thinner than 1.25 device pixels at DPR 1.
- Rules/UI face: text face with x-height ≥0.50 em, distinguishable `I/l/1` and `O/0`, tabular
  numerals available, and stable Latin punctuation.
- Numerals: weight 650–800 equivalent, tabular for timers/resources, no outline-only rendering.
- Letterspacing: card names −0.01 to +0.02 em; small labels +0.04 to +0.10 em; body 0–0.02 em.

### 8.2 Canonical desktop minimums

| Surface | Minimum CSS px | Line height | Additional gate |
|---|---:|---:|---|
| Detail card name | 22 | 1.10–1.20 | two lines maximum |
| Detail subtitle/type | 13 | 1.20–1.30 | contrast ≥4.5:1 |
| Detail rules/flavor | 16 | 1.35–1.50 | 45–70 characters per line |
| Board active-card name | 14 | 1.15–1.25 | locked, not self-amending: the longest catalog name must render unclipped and un-ellipsized at ≥14 px inside the board-active nameplate (≈132 × 32 px on the 176 px active), proven by re-running all three §7.4 nameplate fixtures at that scale; if the chosen face cannot satisfy this, the face or nameplate geometry must change — the minimum does not |
| Board/hand compact name | 12 | 1.15–1.25 | full name available on inspect/focus |
| Cost/stat numeral | 18 | 1.0 | 1 px minimum interior stroke |
| Status/charm label | 12 | 1.20 | icon plus text/accessible name |
| HUD resource/timer | 14 | 1.20 | tabular numerals |
| Action label | 14 | 1.20 | keyboard cue ≥12 px |
| Log line | 12 | 1.35 | live-region semantics retained |
| Modal/overlay body | 16 | 1.45 | max line width 68 characters |

Board-scale rules text may collapse to a short effect summary, but the complete rule must be
available in the detail view on mouse, keyboard, and programmatic focus. Glyph-like illegibility
from R1 is visual reference material, not a Tiny Fangs readability target.

## 9. Family Language and Original Tiny Fangs Identity

### 9.1 Shared construction

All families share the 0.660 chassis, ivory lip, seven-layer frame hierarchy, panel proportions,
cost position, paper grain, directional wear, and Tiny Fangs back. This common construction makes
the collection read as one manufactured game.

### 9.2 Family differences

| Family | Frame | Geometry | Seal and art treatment |
|---|---|---|---|
| Creature | antique amber around `#B47015` | more angular lower corners; two stat sockets | tooth/leaf shield seal; subject occupies 55–75% of art aperture |
| Cast Verse | aged teal around `#277A79` | flowing inner corners and a central footer | open radiating fang/rune seal; visible motion or event in art |
| Set Verse | muted plum around `#6A5A66` | inward-notched corners and closed footer seal | closed crescent/trap seal; latent, watchful composition |
| Card back | navy around `#372F3F` | shared front silhouette; no family cue | original Tiny Fangs sigil, paired-fang constellation, restrained gold filigree |

### 9.3 Pack identity

Creature art uses the catalog's five pack themes as original Tiny Fangs visual subfamilies:

- Shadow: cool dusk values, soft lost edges, asymmetrical negative space;
- Fang: warm ember/steel accents, forward diagonals, sharper silhouettes;
- Venom: botanical and wet-surface motifs, restrained acid-green accents;
- Swarm: repeated small forms, nest/den motifs, grouped silhouettes;
- Shell: stone/metal/keratin planes, broad stable bases, lower visual center of gravity.

Pack accents may occupy 8–18% of art pixels and 0–6% of the frame. They never replace the three
primary card-type families.

### 9.4 Originality boundary

Match the references' visual language through:

- warm low-poly meadow framing;
- painted faceted forms;
- physical card thickness;
- nested antique frame construction;
- upper-left light and soft down-right shadows;
- quiet center and staged scale hierarchy.

Do not copy:

- any pictured creature, tree, grave, wisp, leaf, rune, card-back constellation, border filigree,
  fence profile, or exact prop arrangement;
- the references' unreadable pseudo-writing;
- the exact center diamond or family emblems;
- a reference illustration with a color swap or silhouette trace.

Every Tiny Fangs face must depict its own catalog identity and rules-readable action, with source,
focal point, crop, and provenance recorded by the later asset manifest.

### 9.5 Interface material grammar and token inventory

The interface surfaces are geometrically locked in §2.2–§2.3; this section supplies the visual
grammar those pixels render with, and it is the documented token inventory the §13.6 S-category
gate scores against.

**Rail and panel ground.** Every rail, log strip, and HUD cluster renders on one shared ground
material: parchment from the §5 card-paper roles (`#DCBA96` parchment / `#DEBB91` ivory lip),
82–92% opacity
over the field, with a 1–2 px darkened paper edge (ink role at 25–40% alpha) instead of a hard UI
border. No flat dark panels, no glassmorphism blur, no pure-white or pure-black grounds.

**Token construction.** Life, mana, deck, grave, turn, and timer tokens use the §7.2 frame
hierarchy at token scale: an outer edge, a recessed family-color rail, and an inner parchment
face, with the same cumulative-inset proportions scaled per §7.4's per-axis rule. Life uses the
heart glyph on creature-gold; mana on cast-teal; deck/grave on ink-on-parchment counts; turn and
timer share one tabular-numeral plate. Exactly these six token types exist — a new token type is
a bible revision, not an implementation freedom.

**Action iconography.** The six action controls each carry one constructed glyph built from the
same 2 px-stroke geometric language (no third-party icon set): Summon a rising card outline,
Cast a spark over an open book shape, Set a face-down card outline, Attack crossed fangs,
Retreat a return arrow over a slot, End Turn an hourglass. Glyph plus §8.2 label always render
together; a glyph is never the only affordance. Disabled, hover, selected/targeting, focus, and
hold states use the §13.1 action-sheet semantics with family-color accents, never desaturation
below the §12 contrast rows.

**Hand-card scale.** The nominal resting hand card is 150 × 227 px (the 0.660 chassis at the
§2.2 hand envelope's four-across spacing), scaled per §7.4; hover/selection lift may scale it up
to 1.12× before the drag proxy takes over. The §2.2 hand envelope is an allocation gate on the
unrotated card layout boxes; rotated card corners and lift/hover extents may exceed it by at
most 12 px per side, and the §12 hand row measures the allocation boxes, not rendered rotated
extents.

**Log and journal.** The collapsible log uses the same parchment ground, ink text at §8.2 log
minimums, and one gold divider rule between turns; no zebra striping, no terminal-style
monospace-on-black.

## 10. Locked Now Versus Bake-Off Decisions

| Property | Status | Reason |
|---|---|---|
| 1672 × 941, DPR 1, sRGB critic frame | **L** | exact source frame |
| Two-dimensional anchor centers and screen envelopes in §2.2 | **L** | rules-adapted composition target |
| Outer 10–15% frame and central quiet zone | **L** | measured reference composition |
| Divider y, span, and center mark envelope | **L** | measured R2 landmark |
| Base palette, contrast, and luminance envelopes | **L** | sampled source evidence |
| Upper-left key and down-right shadow family | **L** | consistent visible cue |
| 0.660 nominal, 0.645–0.670 card-local unprojected ratio | **L** | measured R1 range |
| Card frame/panel hierarchy and family differences | **L** | measured plus readability adaptation |
| 333 × 505 family safe rectangles and longest-name fixtures | **L** | exact non-overlap/readability contract |
| Four-card showcase specimens, corners, z-order, shadows, and crops | **L** | deterministic card-comparison contract |
| Typography behavior and minimum sizes | **L** | desktop readability requirement |
| Original Tiny Fangs creature/rune/prop content | **L** | product identity and copying boundary |
| Projection: orthographic or low-FOV perspective | **B** | still image is inconclusive |
| Exact camera pitch/FOV/frustum/distance/aim | **B** | must be calibrated in same-frame grayboxes |
| Final near/far scale ratio | **B** | category sizing contaminates reference measurement |
| World-space anchor coordinates | **B** | depend on winning projection |
| Per-anchor four-corner golden quadrilaterals | **B** | generated and locked only for the winning camera |
| Prop parallax and foreground softness | **B** | camera-dependent fidelity choice |
| Final exposure and optional edge DOF | **B** | evaluate only after populated camera match |

No **B** item may be silently locked by the first implementer. The blinded decision record must
identify both candidates and preserve both capture sets.

## 11. Do / Do Not / Automatic Rejection

### Do

- Use the exact canonical frame and deterministic populated fixture for every reference comparison.
- Keep the field brighter and less detailed under card silhouettes than at the perimeter.
- Preserve physical thickness, contact, and nested bevel hierarchy at all card scales.
- Use original Tiny Fangs subjects and motifs while matching the references' material grammar.
- Keep six actions, HUD values, Set privacy, log, and card inspection readable over the meadow.
- Evaluate full frame and aligned crops; a strong hero crop cannot hide a weak board.

### Do not

- Do not use a flat green gradient, repeating grass tile, or full-frame noise as the field.
- Do not use dark full-height desktop sidebars.
- Do not distribute trees, rocks, or flowers uniformly or symmetrically.
- Do not use hard black toon outlines, plastic specular response, or neon global bloom.
- Do not render cards as flat rectangles with one border and a generic drop shadow.
- Do not put paragraph text below 16 px in detail view or hide complete rules from keyboard users.
- Do not use family color as the sole card-type or status signal.
- Do not use camera motion, particles, or ambience to move interaction targets.
- Do not design mobile by compressing this desktop map; the mobile port is deferred.

### Automatic rejection examples

1. **“Green table with forest wallpaper.”** Center and frame have equal texture density; reject if
   central non-grass prop occupancy exceeds 30% or perimeter/center luminance ratio exceeds 0.35.
2. **“Dashboard over a meadow.”** Opaque side rail dominates the field; reject any contiguous
   near-black rail wider than 60 px or taller than 180 px.
3. **“Trading-card template.”** Single border, one rounded rectangle, generic icons; reject if
   fewer than four frame layers remain visible at board scale.
4. **“Miniature reference copy.”** Literal wisp/tree/grave/back symbol or traced prop map; reject
   on any direct motif reuse, regardless of polish.
5. **“Cinematic but unplayable.”** Blur, glare, foliage, or particles obscure controls/cards;
   reject if text misses contrast minimum, hit targets move, or any card edge is occluded >42 px.
6. **“Forced perspective.”** Near row visibly balloons; reject equal-object near/far ratio >1.12.
7. **“Flat orthographic diagram.”** No foreground weight or contact depth; reject Candidate O if
   it fails the `D >= 8.5` or `Lc >= 8.0` camera-graybox gate in §13.4.
8. **“Orange wash.”** Uniform warm grade destroys teal/plum family separation; reject if Cast and
   Set frame medians are CIEDE2000 <12 apart.

## 12. Objective Acceptance Tolerances

Every row in this table is machine-evaluable. Rows whose method is not stated inline bind to
these definitions:

- **Environment frame occupancy:** per edge band (each side's outer 10–15% strip), the share of
  pixels the §6.1 renderer ID mask classifies as environment prop/foliage rather than grass,
  slot, card, or shadow; R2 comparison uses the same formula on a manually traced ID mask,
  I-labeled.
- **Saturation offsets (§6.2):** mean HSV saturation over the named §6.1 ID-mask regions
  (foreground perimeter props, central card art, sunlit top field, lower meadow), compared as
  percentage-point deltas of mean S.
- **Haze contrast reduction (§6.2):** RMS luminance contrast in 32 × 32 px windows, ratio of
  top-18% windows to center-field windows holding same-palette props, per the §6.1 mask regions.
- **Grass micro-detail (§4):** RMS of the luminance high-pass residual after a 8 px Gaussian
  blur subtraction, over ID-mask grass pixels only.
- **Highlight perimeter share (§6.1):** fraction of card-silhouette boundary pixels (from the
  footprint mask) whose adjacent 2 px outward band exceeds luminance 0.75.

| Artifact | Measurement | Pass tolerance |
|---|---|---:|
| Canonical capture | viewport / DPR / profile | exactly 1672 × 941 / 1 / sRGB |
| Anchor map | DOM card/slot center and screen envelope vs §2.2 | center ≤3 px; envelope bounds ≤3 px before camera lock |
| Projected registration | DOM/decal/shadow corners vs winning-camera golden quadrilateral | ≤2 CSS px at every ordered corner |
| Divider | center y / level / diamond center-x / band span at §2.1 prominence definition | 414 ±3 px / ≤1 px slope / 836 ±3 px / 68–80% width, ends ±8 px |
| Environment frame | occupied side/top band | 10–15% per measured side |
| Quiet zone | grass/slot/shadow/card share via §6.1 ID-mask classification | ≥70% |
| Prop intrusion | prop overlap into resting card screen envelope | ≤42 px depth; zero text overlap |
| Card chassis | card-local unprojected width/height | nominal 0.660; acceptable 0.645–0.670 |
| Card anatomy | cumulative side inset / aperture width | 10.5–12.5% / 75–79% |
| Corner construction | concentric radius error | ≤1 px at 333 px width |
| Hand | center / screen envelope / four centers | (840,797) / 624 × 228 / x 612, 764, 916, 1068 |
| Right rails | x bounds / viewport inset | 1512–1648 / exactly 24 px right |
| Rail separation | resting / documented maximum state | ≥24 px / ≥12 px |
| Action grid | six targets / target size / target gap | 6 / 48 × 48 px / 12 px |
| Action focus | fixed bound / focus-bound gap | 52 × 52 px / 8 px |
| Equal-card depth scale | Candidate O / Candidate P | 1.00 ±0.01 / 1.05–1.12 |
| Palette | aligned region medians: for the three meadow/foliage targets, the per-channel median of the §5 quiet-upper-meadow rectangle, lower-meadow rectangle, and deep-left-foliage rectangle; for each of the four card-family base roles, the per-channel median of the 5 × 5 px window centered on its §5 sample coordinate | CIEDE2000 ≤8 graybox; ≤5 final, computed against the same-region reference medians |
| Perimeter/center value | median luminance ratio | 0.14–0.25 |
| Key direction | PCA first axis of the two largest single-object umbra masks (§6.1 method) | 55–75° down-right, both masks |
| Card contact (single resting card) | §6.1 mask-centroid offset / penumbra | x +4–10, y +8–16 px / 10–26 px |
| Stack/deck/showcase shadow | §6.1 mask-centroid offset / direction | x +20–100, y +50–90 px / within key band |
| Cast vs Set family separation | CIEDE2000 between aligned family base-role medians | ≥12 |
| Active/hand gap | visible silhouette / semantic hit polygons | ≥4 CSS px / ≥4 CSS px |
| Opponent HUD | center / bounds / semantic top | (836,52) / (576,24,1096,80) / y ≥24 px |
| Inspect target | CSS AABB / neighboring semantic gap / focus contrast | ≥44 × 44 px / ≥4 px / ≥3:1 |
| Text contrast | body / large or non-text | ≥4.5:1 / ≥3:1 |
| Type | §8.2 size and clipping | no value below minimum; zero clipped catalog names |
| Color management | reference decode / captures | assign IEC 61966-2-1 sRGB before metrics / embed or manifest-declare sRGB |
| Determinism | repeated settled screenshots and fixture identity | SSIM ≥0.995; identical geometry; same version/hash |
| Overlay evidence | §13.1.1 variants / focus / privacy | 4/4 captured; containment/return pass; zero pre-reveal identity matches |
| Static fallback | §13.1.2 actions / WebGL contexts / journey | 6/6 dispatch-equivalent; exactly 0 contexts; full journey pass |
| Settled desktop performance | §13.9 rev 2 `desktop-minimum` at tier `desktop-high`: median p95 / worst-run p95 / draw calls / triangles | ≤16.7 ms / ≤20.0 ms / ≤100 / ≤300k |
| Camera critic gate | §13.4 `singleCameraCriticPass` | both true; unanimous O/P; one reviewed revision; no wow gate |
| Integrated final-art gate | §13.5–§13.6 `singleCriticPass` | both true; challenger preferred; wow ≥9; two clean revisions |
| Provenance | §13.8 record/signature/backlink verification | no pending value, missing signature, hash mismatch, or unresolved motif |

## 13. Deterministic Fixture, Crop, and Critic Contract

### 13.1 Versioned populated fixture manifest

The camera bake-off and field/card critic packets require one populated state, not an informal
manually arranged board. Its manifest schema is `tiny-fangs.critic-fixture.v1`; its fixture ID is
`desktop-reference-populated`; its first revision is integer `1`.

The state must be implemented through the canonical deterministic fixture contract rooted at
`src/presentation/testing/fixture-registry.js`, stable-serialized through
`src/presentation/testing/stable-serialization.js`, and activated through the existing
`?visualQa=1&fixture=` route. The current `dense-board-statuses` fixture is the authoritative
starting state, but it does not yet supply the required four-card hand, deterministic log,
specified HUD, and action-state sheet. It therefore cannot be relabeled as this critic fixture
without an explicit registry revision.

Required manifest content:

| Manifest block | Exact revision-1 content |
|---|---|
| Frame | 1672 × 941 CSS px, DPR 1, sRGB; quality tier exactly `desktop-high`; ambient scene time frozen at t = 0 of the ambient timeline; deterministic seed exactly `414243`; particle emitters at their seeded t = 0 pool state with zero elapsed emission |
| Turn HUD | Turn 6; player turn; first-turn false; attacked false; retreated false; timer `00:42` |
| Player HUD | life 3; mana 3/4; deck count 11; grave count 1 |
| Opponent HUD | life 2; mana 2/3; deck count 10; hand count 5; grave count 1 |
| Player active | `shellkin`, ATK 10, HP 20/20, `poison`; player `unbreakable = true` |
| Player bench A | `pebbleback`, ATK 20, HP 30/30, `fortified = true` |
| Player bench B | `ironhide`, ATK 20, HP 50/50 |
| Player Set | `brace`; owner-inspectable, resting face-down presentation |
| Player grave | `bulwark` |
| Four-card hand, left to right | `coilshell`, `regenerate`, `spikeShield`, `titanback` |
| Opponent active | `hexweaver`, ATK 20, HP 40/40, `trapped` |
| Opponent bench A/B | `thornling` 10/40; `leechling` 15/20 |
| Opponent Set | authoritative card `soulTrap`; public projection exactly `{"faceDown":true}` |
| Opponent grave | `sundewqueen` |
| Resting actions | Summon enabled; Cast enabled; Set disabled/occupied; Attack enabled/primary; Retreat enabled; End Turn enabled with hold progress 0 |
| Log, oldest to newest | `Turn 6 — Your turn`; `Opponent set a Verse face-down.`; `Shellkin is poisoned.`; `Pebbleback is fortified.` |

The opponent Set's ID, UID, name, cost, rules, art URL, and any identity-bearing string must be
absent from public state, DOM, aria text, QA metadata, logs, resource requests, and debug exports.
The log line above is intentionally identity-free.

The action-detail packet uses a deterministic test-only state sheet without changing rules:

| Action | Presented state | Required semantic state |
|---|---|---|
| Summon | available-idle | enabled, not focused |
| Cast | pointer-hover | enabled; synthetic hover only |
| Set | disabled-occupied | native disabled; reason `occupied`; uses the same disabled material token as unaffordable while retaining the distinct accessible reason |
| Attack | selected-targeting | enabled; `aria-pressed` or equivalent state |
| Retreat | keyboard-focus | actual focus; fixed 52 × 52 focus bound |
| End Turn | hold-progress-50 | enabled; deterministic 50% visual progress, action not dispatched |

Hash requirements:

1. The capture runner writes canonical sorted UTF-8 JSON for the fixture manifest.
2. `authoritativeStateSha256` hashes the canonical privacy-aware stable serialization.
3. `manifestSha256` hashes the manifest with only its own `manifestSha256` field omitted, per the
   single §13.7.2 rule; nested digests remain present.
4. `presentationStateSha256` hashes the deterministic action sheet, camera ID, time, seed, quality,
   font, and loaded-asset revision.
5. Each screenshot and crop records its own SHA-256 and the three hashes above.
6. No hash is supplied in this bible because revision 1 is not yet implemented and captured.
   `PENDING_CAPTURE_RUNNER` is a required invalid sentinel until real output exists; a packet with
   that sentinel cannot enter critique.
7. A fixture/manifest change increments `fixtureRevision`, generates new hashes, invalidates
   earlier screenshot comparisons, and is recorded in the blind mapping.
8. The implementing registry revision must pin every value `authoritativeStateSha256` consumes,
   including the complete ordered deck lists and grave contents of both players and the complete
   opponent hand — the tables above pin counts and named surface cards; the registry pins the
   rest, and an unpinned list is a P0-invalid fixture, not an implementation freedom.
9. **Reachability annotation.** The shared engine counts `state.turn` per round, not per player
   turn, and grows `maxMana` by one at each handoff; under sequential legal play this fixture's
   combination of turn number, mana, deck, and hand counts is **not reachable**, and no claim of
   reachability is made. It is an authored deterministic critic state injected through the
   fixture registry, exactly like every other fixture in `fixture-registry.js`. What is required
   is state validity — counts sum, card identities exist, statuses are legal, privacy projection
   holds — which validation enforces; play-path reachability is explicitly not required, and this
   item is the explicit annotation of that fact. A fixture lacking either reachability or this
   annotation is P0 invalid. The same annotation covers the §13.1.2 reset base.

#### 13.1.1 Deterministic integrated-overlay evidence

The named fixture `desktop-integrated-overlay`, schema `tiny-fangs.integrated-overlay.v1`,
revision `1`, starts from the exact `desktop-reference-populated` revision-1 state above. It is a
four-variant capture sequence, never four simultaneous dialogs:

| Variant ID | Exact open surface | Initial keyboard focus | Privacy state |
|---|---|---|---|
| `detail-player-active` | detail for player `shellkin`, showing 10 ATK, 20/20 HP, poison, subtype, cost, and complete rules | detail close control | opponent Set remains exact `{"faceDown":true}` |
| `grave-player` | player grave containing `bulwark`, top card inspectable | grave close control | opponent Set remains exact `{"faceDown":true}` |
| `rules-turn-flow` | rules at the turn-flow section | rules close control | opponent Set remains exact `{"faceDown":true}` |
| `authorized-set-reveal` | opponent `soulTrap` reveal after player summons `coilshell`, its defined trigger | reveal continue control | exact event-0/1/2 exception below |

Each variant freezes camera, seed, time, particle state, quality tier, fonts, loaded assets, and
the same exact HUD/log/board state. For the first three variants, only the named overlay state
differs. `authorized-set-reveal` is explicitly exempt from that rule only for the exact event
timeline and allowlisted deltas below; it may not use the exemption for unrelated layout or state
changes. The board behind a modal is `inert` and accessibility-hidden; Tab and Shift+Tab cycle
only within the open surface, Escape closes it, and focus returns to the exact originating
card/control.

The reveal variant derives from `desktop-reference-populated` with one exact precondition:
player bench B is empty and `ironhide` is the top card of the player deck, making deck count 12;
everything else is unchanged. Its ordered snapshots are:

| Event | Authoritative and public projected state | Allowed board/log delta | Focus and evidence |
|---|---|---|---|
| `event0-hidden-pre` | authoritative opponent Set is `soulTrap`; public opponent Set is exactly `{"faceDown":true}`; `coilshell` remains in player hand; mana 3/4 | only the declared bench-B/deck precondition; overlay closed; no new log line | focus origin `action-summon`; capture `overlay-full`; zero `soulTrap`/alias matches in public state, DOM, accessibility, requests, logs, QA/debug, or network |
| `event1-overlay-reveal` | Summon has placed `coilshell` at bench B with 45/45 HP; player mana 1/4; authoritative Set remains `soulTrap`; public Set is rule-authorized revealed `{"faceDown":false,"id":"soulTrap"}` | remove `coilshell` from hand; add bench-B card; mana −2; append exactly `Coilshell was summoned.` and `Opponent's Set Verse revealed: Soul Trap.`; open reveal overlay | focus `reveal-continue`, return origin `action-summon`; captures `overlay-full`, `overlay-panel`, `overlay-focus`; identity allowed only in revealed projection, overlay, and the second new log line |
| `event2-public-post` | `coilshell` is 25/45 HP; opponent Set is null; `soulTrap` is public top opponent grave card | player bench-B HP −20; move `soulTrap` Set → grave; append exactly `Soul Trap dealt 20 damage to Coilshell.`; close overlay; no other state delta | focus returned to `action-summon`; capture `overlay-full`; identity allowed only in public grave, authorized log lines, and inspectable public card metadata |

An event's "authoritative state" is the deterministic event-boundary reconstruction: the state
the canonical privacy-aware stable serializer produces when the recorded event stream is applied
up to and including that event's index — not a mid-`executeAction` engine snapshot, which the
engine deliberately never externalizes. The capture runner derives each boundary state by replay
through `stable-serialization.js`; no engine instrumentation API is required or permitted.

Every event writes `authoritativeStateSha256`, `publicStateSha256`,
`presentationStateSha256`, `accessibilityTreeSha256`, `privacyScanSha256`, `screenshotSha256`,
per-crop hashes, focused element ID, focus-origin/return ID, and an exact ordered state-delta hash.
The event-0 scan covers identity-bearing aliases `soulTrap`, `Soul Trap`, its UID, rules, art URL,
and asset/preload keys; it must return zero matches. Events 1 and 2 use an allowlist keyed to the
table above and fail on identity in any other field or surface. Any missing snapshot/hash,
out-of-order event, non-allowlisted board/log delta, early identity match, or focus mismatch is P0.

The overlay manifest includes exact variant ID, originating target ID, focus order, focus-return
ID, visible strings, authoritative/public state hashes, privacy scan results, capture/crop IDs,
color declaration, and asset/font/provenance revisions. It is RFC 8785 canonicalized; the root
manifest and every variant carry `manifestSha256`, `authoritativeStateSha256`,
`publicStateSha256`, `accessibilityTreeSha256`, `screenshotSha256`, and per-crop SHA-256 values.
Revision 1 is not implemented, so `PENDING_CAPTURE_RUNNER` remains an invalid sentinel rather
than an invented completion claim.

#### 13.1.2 Deterministic no-WebGL/static-fallback evidence

The named fixture `desktop-static-fallback`, schema `tiny-fangs.static-fallback.v1`, revision `1`,
forces `{webgl:false, reason:"context-create-failed", qualityTier:"static"}` before presentation
boot. No WebGL context may be created. It uses a color-managed static meadow, the same DOM card,
HUD, log, overlay, action, and focus system, and the same authoritative game dispatcher as the
enhanced path. The static field may simplify depth and motion, but it must retain the §2 anchors,
§5 palette, §7 card hierarchy, six actions, hidden-information contract, and playable interaction.

The reset base for six independent action cases is exact: player turn 6, first-turn false,
mana 4/4, life 3, `shellkin` active at 10/20 HP with poison, `pebbleback` bench A,
bench B empty, Set empty, and hand in order `titanback`, `regenerate`, `brace`; opponent has
`hexweaver` active at 40/40 HP and a Set projected only as `{"faceDown":true}`. Each case resets
to that state before dispatch:

| Case | Input and expected authoritative result |
|---|---|
| `summon` | choose `titanback`, Summon, bench B; mana becomes 0/4 and bench B is `titanback` |
| `cast` | choose `regenerate`, Cast on active; mana becomes 2/4, active becomes 20/20 with poison removed, and `regenerate` enters grave |
| `set` | choose `brace`, Set; mana becomes 3/4 and owner Set becomes `brace` face-down while opponent projection remains opaque |
| `attack` | choose Attack then `hexweaver`; opponent active becomes 30/40 HP and `hasAttacked` is true |
| `retreat` | choose Retreat then `pebbleback`; `pebbleback` becomes active, `shellkin` becomes bench A, and `hasRetreated` is true |
| `end-turn` | complete the existing hold gesture or keyboard equivalent; authoritative turn owner changes and the next-turn readiness transition completes |

The runner additionally proves that every visible action target is ≥48 × 48 px, every inspect
target follows §7.5, actual keyboard focus is visible at ≥3:1, modal containment/return works, the
identity-free log live region updates, and pointer/keyboard paths produce equal authoritative
results. A scripted journey from mode selection through a legal match result/restart must pass in
static mode; isolated button clicks alone are not “playable.”

The fallback manifest records the exact capability object, proof that context-creation count is
zero, fixture/action-case revisions, pre/post authoritative and public-state hashes, dispatched
action/result, privacy scans, accessibility-tree hash, focus polygons, interaction-report hash,
screenshot/crop hashes, static-background asset/provenance hashes, and sRGB declaration. It uses
RFC 8785 canonical JSON and the same omit-hash-field procedure as §13.1.
`PENDING_CAPTURE_RUNNER` is invalid until the implemented runner emits real values.

### 13.2 Versioned canonical four-card showcase manifest

The card comparison is also deterministic. Its schema is `tiny-fangs.card-showcase.v1`, showcase
ID is `desktop-four-family`, and first revision is integer `1`. Coordinates are in the canonical
1672 × 941 showcase frame. Corner order is always signed screen-space
`[topLeft, topRight, bottomRight, bottomLeft]`; positive rotation is clockwise.

| Specimen | presentationFaceId | Render side | Center | Size | Rotation | z | Ordered corner quadrilateral TL/TR/BR/BL | Contact-shadow envelope | Required containing crop |
|---|---|---|---:|---:|---:|---:|---|---|---|
| Creature | `duskfang` | face | 445,578 | 330 × 500 | −1.5° | 3 | [(273.5,332.4),(603.4,323.8),(616.5,823.6),(286.6,832.2)] | (259,319,641,865) | `card-creature-frame` |
| Cast Verse | `manaSurge` | face | 833,577 | 330 × 500 | 0.0° | 4 | [(668.0,327.0),(998.0,327.0),(998.0,827.0),(668.0,827.0)] | (654,323,1022,859) | `card-cast-frame` |
| Set Verse | `phantomWall` | face | 1206,584 | 330 × 500 | +1.5° | 6 | [(1047.6,329.8),(1377.5,338.4),(1364.4,838.2),(1034.5,829.6)] | (1020,325,1402,870) | `card-set-frame` |
| Card back | `soulTrap` | back only | 1405,575 | 300 × 455 | +6.0° | 2 | [(1279.6,333.1),(1578.0,364.4),(1530.4,816.9),(1232.0,785.6)] | (1218,329,1602,849) | `card-back` |

The three front specimen ratios are exactly 0.660. The back is 0.65934 and uses the same
unprojected chassis family at a smaller showcase scale. The Set front remains above its partially
occluded back by z-order; no *visible* back pixels may cross the Set's title, rules, or stat-safe
content in the rendered composite — the raw back polygon may pass beneath them.
Every ordered corner and full contact-shadow envelope must lie inside its named §13.3 crop with at
least 8 px clearance.

These are existing original Tiny Fangs faces selected to expose creature, Cast, Set, and hidden
back systems. The showcase may not substitute an R1 creature, wisp, grave, tree, rune,
constellation, or traced illustration. `soulTrap` is named only inside this art-production
manifest; gameplay opponent-back captures remain exact opaque presence and never disclose it.

Showcase hashing:

1. Serialize the manifest as RFC 8785 JSON Canonicalization Scheme UTF-8 bytes.
2. Include schema, ID, integer revision, every face ID, render side, one-decimal corner coordinate,
   center, size, signed rotation, z-order, shadow envelope, crop ID, asset revision, font revision,
   color profile, and provenance-record SHA-256.
3. Omit only `manifestSha256` while hashing, then write lowercase
   `sha256:<64 hexadecimal characters>`.
4. The capture runner recomputes the hash before every screenshot and rejects a mismatch.
5. Revision 1 has not yet been rendered, so this bible records no completed hash.
   `PENDING_CAPTURE_RUNNER` is invalid evidence and must be replaced by the runner's real value.
6. Any geometry, specimen, asset, font, provenance, or crop change increments `showcaseRevision`
   and invalidates all prior card screenshots and blind mappings.

### 13.3 Exact critic crop rectangles

Rectangles are half-open `(left, top, right, bottom)` coordinates in the 1672 × 941 source frame.
For reference-comparable rows, reference and challenger use the same rectangle. The explicitly
Tiny-Fangs-only action sheet uses the challenger alone. Detail crops are resized exactly 2× with
the same color-managed Lanczos implementation; full-frame/full-composition crops remain 1×. No
crop-local grade, sharpen, blur, or exposure correction is allowed.

| Crop ID | Rectangle | Native size | Critic output | Comparison |
|---|---:|---:|---:|---|
| `field-full` | (0,0,1672,941) | 1672 × 941 | 1672 × 941 | R2 ↔ populated board |
| `field-opponent` | (232,112,1464,384) | 1232 × 272 | 2464 × 544 | R2 ↔ board |
| `field-divider` | (232,370,1464,458) | 1232 × 88 | 2464 × 176 | R2 ↔ board |
| `field-player` | (232,440,1464,712) | 1232 × 272 | 2464 × 544 | R2 ↔ board |
| `field-hand` | (480,670,1200,925) | 720 × 255 | 1440 × 510 | R2 ↔ board |
| `field-corner-tl` | (0,0,320,240) | 320 × 240 | 640 × 480 | R2 ↔ board |
| `field-corner-tr` | (1352,0,1672,240) | 320 × 240 | 640 × 480 | R2 ↔ board |
| `field-corner-bl` | (0,701,320,941) | 320 × 240 | 640 × 480 | R2 ↔ board |
| `field-corner-br` | (1352,701,1672,941) | 320 × 240 | 640 × 480 | R2 ↔ board |
| `field-card-contact` | (400,430,640,730) | 240 × 300 | 480 × 600 | R2 ↔ board |
| `cards-full` | (220,280,1620,890) | 1400 × 610 | 1400 × 610 | R1 ↔ four-card showcase |
| `card-creature-frame` | (240,300,650,875) | 410 × 575 | 820 × 1150 | R1 ↔ showcase |
| `card-cast-frame` | (635,300,1040,875) | 405 × 575 | 810 × 1150 | R1 ↔ showcase |
| `card-set-frame` | (1000,300,1415,885) | 415 × 585 | 830 × 1170 | R1 ↔ showcase |
| `card-back` | (1195,300,1620,870) | 425 × 570 | 850 × 1140 | R1 ↔ showcase |
| `card-art` | (688,328,992,628) | 304 × 300 | 608 × 600 | R1 ↔ showcase |
| `card-title` | (688,548,992,640) | 304 × 92 | 608 × 184 | R1 join ↔ Tiny Fangs nameplate |
| `card-rules` | (688,612,992,808) | 304 × 196 | 608 × 392 | R1 ↔ showcase |
| `card-stats` | (272,700,616,828) | 344 × 128 | 688 × 256 | R1 ↔ showcase |
| `card-contact` | (248,776,1400,866) | 1152 × 90 | 2304 × 180 | R1 ↔ showcase |
| `action-state-strip` | (1500,646,1660,850) | 160 × 204 | 320 × 408 | Tiny Fangs state sheet only |
| `overlay-full` | (0,0,1672,941) | 1672 × 941 | 1672 × 941 | Tiny Fangs overlay fixture |
| `overlay-panel` | (360,100,1312,840) | 952 × 740 | 1904 × 1480 | Tiny Fangs overlay fixture |
| `overlay-focus` | (1120,110,1280,270) | 160 × 160 | 320 × 320 | Tiny Fangs modal focus |
| `fallback-full` | (0,0,1672,941) | 1672 × 941 | 1672 × 941 | Tiny Fangs static fallback |
| `fallback-board` | (232,112,1464,712) | 1232 × 600 | 2464 × 1200 | Tiny Fangs static fallback |
| `fallback-action-focus` | (1490,610,1660,890) | 170 × 280 | 340 × 560 | Tiny Fangs fallback actions |
| `fallback-card-focus` | (400,430,640,730) | 240 × 300 | 480 × 600 | Tiny Fangs fallback inspect |

The four-card challenger is composed from the exact §13.2 manifest before crops are taken. Each
specimen quadrilateral and contact-shadow envelope must satisfy its named crop-containment gate.
The `card-title` comparison judges material integration at the art/rules join; R1 has no readable
title and is not used as a text-layout target.

**Declared rule-driven divergences.** Tiny Fangs' game rules force some content differences from
R2 inside reference-comparable crops, and a critic must score material/composition language, not
punish these declared substitutions as fidelity failures. The divergence list ships in the packet
metric report and currently contains: the anchor R2 stages as a face-up leaf-art card is a
face-down navy card back in Tiny Fangs when it maps to a Set position; the opponent grave shows a
card stack where R2 shows open grass (`field-opponent`, `field-full`); the player grave shows a
card stack where R2 stages the rotated face-up leaf utility card (`field-player`, `field-full`);
the opponent hand-count strip and HUD tokens exist only in the challenger; and log/action rails
have no R2 counterpart. Each divergence entry names the crop IDs it touches. Anything not on the list is fully comparable, and adding an entry requires a fixture
revision, not a mid-review annotation.

### 13.4 Camera-graybox scoring and lock gate

The O/P graybox is a camera decision, not an integrated final-art review. Critics see identical
gray card geometry, simple family labels, slot/decal fiducials, contact shadows, divider,
terrain-value blocks, and perimeter massing. They do not score final illustration, nameplate
craft, typography polish, HUD completeness, action styling, overlays, static-fallback art, motion,
audio, or holistic wow.

Each camera critic scores five categories from 0.0 to 10.0 in 0.1 increments:

| Symbol | Camera-graybox category | Weight | Gate anchor |
|---|---|---:|---|
| Cc | Composition, camera, scale, and hierarchy | 40 | ≥9.0: anchors, rows, divider, active diagonal, hand, crop, and near/far hierarchy match R2 without distortion |
| D | Reference and depth cues | 25 | ≥8.5: foreground/background weight, prop parallax, foreshortening, and quiet-center depth read coherently |
| Lc | Relevant lighting and shadow cues | 15 | ≥8.0: upper-left key, down-right contacts, divider value, and center/perimeter separation are sufficient to judge depth |
| G | Geometry and registration | 15 | ≥9.0: centers/envelopes, candidate quadrilaterals, 4 px active/hand gap, divider, and DOM/Three fiducials pass |
| Q | Determinism and blind-protocol validity | 5 | exactly 10.0: hashes, fixture, seed/time, crop set, the sealed mapping commitment row verified per §13.7.1 (the mapping file itself is never seen), SSIM, and critic inputs are complete and identical |

Weights total 100:

```text
Tcamera = (40Cc + 25D + 15Lc + 15G + 5Q) / 10
```

For one camera critic:

```text
singleCameraCriticPass =
  (Tcamera >= 90.0)
  AND (Cc >= 9.0)
  AND (D >= 8.5)
  AND (Lc >= 8.0)
  AND (G >= 9.0)
  AND (Q = 10.0)
  AND (openP0Count = 0)
  AND (openP1Count = 0)
  AND cameraGeometryDeterminismPass
```

`cameraGeometryDeterminismPass` is not a judgment call; it is the conjunction of exactly these
machine checks, each already defined elsewhere in this document:

1. §12 Canonical capture row: viewport/DPR/profile exact;
2. §12 Anchor map row: every §2.2 center and envelope within tolerance;
3. §12 Projected registration row: every golden-quadrilateral corner ≤2 CSS px;
4. §12 Divider row, §12 Environment frame row, and §12 Active/hand gap row;
5. §12 Equal-card depth scale row for the candidate under review;
6. the §3.1.1 residual report exists, covers all six immutable R2 targets, and no residual count
   outside the propagated uncertainty envelope is concealed or missing (the residuals inform the
   critic's `Cc`/`D` scores; the report's completeness, not its magnitudes, is the boolean here);
7. §12 Determinism row: same-build rerun SSIM ≥0.995 outside declared masks, identical geometry,
   same fixture/version hashes;
8. §13.7.1 index verification for the camera packet, including the sealed O/P commitment row.

Camera lock requires `singleCameraCriticPass` from both fresh camera critics, unanimous blinded
preference for the same O/P candidate, and a signed decision record. A tie, abstention, split,
pending hash, or mandatory geometry/determinism failure is false. One valid reviewed camera
revision may lock the projection; the two-consecutive-revision and `W >= 9.0` requirements belong
only to integrated final art. A graybox may look intentionally provisional and still pass if it
meets this camera gate. P0–P3 meanings remain the shared definitions in §13.5.

### 13.5 Integrated final-art weights, total, wow, and severity

Each critic scores every category from 0.0 to 10.0 in 0.1 increments. No category is N/A for the
integrated desktop populated-board/card packet. These weights and the wow score do not apply to
the camera-graybox gate.

For the desktop integrated-stills packet this explicit seven-category weight vector supersedes
the plan rubric's proportional N/A redistribution: motion is unobservable in stills by
construction, so its weight is assigned here once (S and A each carry 10) rather than
recomputed per critic. The plan records the same supersession so exactly one weight vector
governs this packet. Motion/effects artifacts keep the plan's motion rubric unchanged.

| Symbol | Category | Weight |
|---|---|---:|
| F | Reference fidelity and emotional tone | 20 |
| C | Composition, camera, scale, and hierarchy | 15 |
| K | Card craft, illustration, and graphic system | 20 |
| L | Lighting, materials, shadows, and environment | 15 |
| R | Readability and gameplay-state clarity | 10 |
| S | Desktop system coherence | 10 |
| A | Accessibility, fallback, determinism, and performance quality | 10 |

Weights total 100. The weighted total is:

```text
T = (20F + 15C + 20K + 15L + 10R + 10S + 10A) / 10
```

`T` ranges from 0 to 100. A failed mandatory measurement caps its linked category at 8.9 even if
the critic's aesthetic judgment is higher.

The critic also records a separate holistic wow score `W` from 0.0 to 10.0:

- `W = 10`: reference-caliber craft plus a distinct Tiny Fangs identity; no visible weak crop;
- `W = 9`: immediate premium impact at full frame and 2× crops, no provisional/generic subsystem,
  and the critic can name at least three specific strengths without qualification;
- `W = 8`: polished overall but one obvious weak subsystem or repeated generic treatment;
- `W ≤ 7`: multiple visible gaps, inconsistent system, or an unfinished/graybox read.

Severity definitions:

| Severity | Definition | Examples | Gate effect |
|---|---|---|---|
| P0 | Invalid, unsafe, or non-reviewable artifact | wrong/reference hash, privacy leak, corrupted or mislabeled A/B, gameplay inaccessible | immediate fail; discard packet |
| P1 | Release-blocking contradiction or clearly visible system failure | mandatory metric fail, camera not blinded, missing action/state, unreadable text, copied motif | current revision fails |
| P2 | Localized quality defect visible at full frame or required 2× crop without breaking play | uneven wear, weak corner prop, one inconsistent icon/material | does not directly falsify the single-critic formula; must be dispositioned, and the second pass may introduce none |
| P3 | Minor polish issue visible only under close inspection and outside mandatory metrics | subpixel optical nudge, isolated non-systemic texture seam | log; does not alone fail |

For one critic, one revision passes only when:

```text
singleCriticPass =
  (T >= 93.0)
  AND (min(F,C,K,L,R,S,A) >= 9.0)
  AND (W >= 9.0)
  AND (openP0Count = 0)
  AND (openP1Count = 0)
  AND mandatoryMeasurementsPass
```

`mandatoryMeasurementsPass` is the conjunction of every §12 row applicable to the artifact under
review — excluding §12's two summary gate rows (camera critic gate and integrated final-art
gate), which reference this section and §13.4 and are outcomes, not inputs — evaluated by the
capture runner and attached to the packet as the metric report: capture
exactness, anchor/registration geometry, divider, environment frame, quiet zone, prop intrusion,
chassis/anatomy/corner rows, hand and rail geometry, action grid/focus, palette and family
separation, perimeter/center value, key direction and both shadow rows via the §6.1 mask methods,
opponent HUD, inspect targets, text contrast and §8.2 type rows, color management, determinism,
the active/hand visible-silhouette and semantic-gap row, the equal-card depth-scale row for the
locked camera, overlay and fallback evidence rows, the §13.9 performance row, and §13.8
provenance verification. A row that cannot be evaluated is a failed row, not a skipped one. Each failed row also caps its
linked category at 8.9 as stated above.

An integrated final-art revision passes only when `singleCriticPass` is true for both fresh
final-art critics, both choose the challenger in every applicable primary reference A/B, and,
across the full set of reference-comparable full-frame and aligned-crop comparisons in the
packet, the challenger wins at least 75% from each critic — the plan's crop-win floor, restated
here so a critic executing from this document alone runs the complete gate. Final art closes only
after two consecutive passing revisions; the second may introduce no new P1 or P2. A split, tie,
abstention, or missing score is false, never rounded into a pass. Camera selection is governed
separately and only by §13.4.

### 13.6 Integrated final-art nine-out-of-ten category anchors

A critic may award 9.0 or higher only when the category's full anchor is true.

| Category | 9.0 anchor | Attached measurements | Mandatory fail |
|---|---|---|---|
| F | Warm storybook field and tactile cards read in the first full-frame view; sampled palette/value gates pass; no literal reference motif is reused | ΔE00, perimeter/center luminance, quiet-zone occupancy, signed §13.8 motif/provenance index | base ΔE00 >8, ratio outside 0.14–0.25, unsigned/unresolved provenance, or copied motif |
| C | Active diagonal, divider, row/hand hierarchy, envelopes, and winning-camera depth match R2 in full frame and all row crops | center/envelope error, divider, equal-card ratio, golden quadrilateral corners | center/envelope >3 px, projected corner >2 px, divider >3 px, candidate ratio fail |
| K | Creature/Cast/Set/back form one manufactured family while remaining immediately distinct; title, art, rules, stats, and back survive every 2× crop | local chassis ratio, cumulative inset, aperture, frame layers, nameplate bounds | local ratio/inset fail, <4 board-scale layers, copied art, clipped safe bound |
| L | One upper-left key, coherent down-right shadows, matte stock, readable contact, layered environment, and restrained emissive effects persist across all corner/contact crops | shadow vector, contact offset/penumbra, highlight area, luminance ranges | second hard shadow, global clipping/bloom, or text/target obscured |
| R | Cards, four statuses, HUD, exact log, hidden Set, and all six resting/action-sheet states are understandable without color alone | size/contrast, clipping, action semantics, fixture/privacy assertions | privacy leak, missing state/action, contrast/size fail |
| S | Board, cards, HUD, rails, log, all §13.1.1 overlays, and §13.1.2 static fallback share the documented paper/bevel/palette grammar; no legacy black panel remains | token inventory, rail geometry/separation, every overlay/fallback §13.3 crop | missing variant/crop, unrelated material system, rail bound/separation fail, opaque legacy sidebar |
| A | Six targets and focus states are keyboard-readable, §7.5 inspect geometry passes, fallback remains playable, hashes/SSIM are deterministic, DOM/Three registration passes, and §13.9 performance passes | action/inspect polygons, focus contrast, fallback journey/report, hashes, SSIM, golden-corner error, performance report | play blocked without WebGL, target <44 px, focus invisible, privacy leak, pending/mismatched hash, SSIM/drift/performance fail |

Passing measurements do not force a score of 9; the critic may score lower for visible quality.
Failing any mandatory cell prevents a 9 regardless of subjective preference.

Motion is not inferred from the supplied stills. Later motion review uses the plan's dedicated
motion/effects rubric and deterministic 60 fps sequences. Mobile/responsive scoring is deferred;
it is outside this desktop artifact rather than N/A inside the later mobile release.

### 13.7 Blind packet assembly

The camera-graybox packet contains `field-full`, `field-opponent`, `field-divider`,
`field-player`, `field-hand`, four field corners, `field-card-contact`, candidate fiducials,
candidate quadrilaterals, the active/hand gap overlay, hashes, and the sealed O/P mapping
commitment defined in §3.4 — never the mapping itself. It excludes card-art/title/rules/stats,
action-state, interface, fallback, and final-material scoring. Camera critics submit `Cc`, `D`,
`Lc`, `G`, `Q`, preference, and P0–P3 findings; they do not submit `W` or the seven final-art
categories.

The integrated-art packet includes every crop in §13.3; the §13.1 populated, overlay, and fallback
fixture manifests; their fixture/presentation/accessibility/interaction/privacy/screenshot/crop
hashes; the §7.5 inspect/focus polygons and collision report; the winning-camera golden
quadrilateral file; the signed §13.8 motif/provenance index; the signed §13.9 performance report;
the explicit sRGB decode/capture records; a metric report without product labels; and a sealed
commitment (SHA-256) to the externally stored random A/B mapping — never the mapping itself.
Images are equal size and carry the same embedded or manifest-declared IEC 61966-2-1 sRGB
profile, filenames are stripped, and critics submit scores, preference, wow, and P0–P3 findings
before the coordinator reveals the mapping file, which must hash to the committed value.

If a required crop/hash/metric is absent, if the mapping leaks, or if either critic sees a different
fixture revision, the packet is P0 invalid rather than merely incomplete.

The seal protects label and mapping integrity, not candidate anonymity: a camera critic may
infer which candidate is orthographic from the residual report's convergence values, and an
integrated critic can recognize which image is the publicly known reference. What the protocol
guarantees is that no one can tell the critic which side the orchestrator expects it to prefer,
and that the mapping cannot be altered after scores are submitted. This matches the plan's
blinded-label framing.

#### 13.7.1 Canonical packet index

The prose above lists what a packet contains but never says who decides that the list is
complete, and the surrounding sections each define their own “omit only this field while
hashing” procedure. Completeness and hashing are therefore stated once, here, and every packet
carries a machine-checkable index rather than relying on a reader to notice an absence.

Every blind packet ships one index file, schema `tiny-fangs.critic-packet-index.v1`, integer
revision `1`, with `packetId`, `packetKind` (`camera-graybox` or `integrated-art`), build/fixture
revisions, and one row per required artifact:

| Field | Meaning |
|---|---|
| `artifactId` | Stable ID, unique within the packet |
| `role` | The exact §13.1–§13.9 requirement it satisfies |
| `path` | Packet-relative path, filename stripped of product labels |
| `sha256` | Lowercase `sha256:<64 hex>` of the file bytes |
| `required` | Boolean; `false` only for artifacts this section marks optional |
| `status` | `present`, `sealed-external`, `unsupported`, or `not-applicable`, with a reason string for the latter three |

`sealed-external` exists exactly for blind mappings: the row's `sha256` is the commitment to a
file stored outside the packet, `path` is empty, and a critic verifies only that the commitment
row exists — never the file. Any blind-mapping row with a status other than `sealed-external`,
or any mapping file physically present in the packet, is itself the §13.7 mapping leak and P0
invalid.

The index enumerates the packet's own required-artifact set from `packetKind`, and that
enumeration and the §13.7 prose list are the same set by definition — a divergence between them
is P0. For `camera-graybox` the set is: every §3.4 output including the sealed O/P commitment
row, every §13.7 camera crop, the §2.5 active/hand gap-mask overlay, the fiducial overlay, the
candidate quadrilaterals, and the §3.1.1 residual report. For `integrated-art` the set is: every
§13.3 crop, every §13.1/§13.1.1/§13.1.2 fixture manifest and its hashes, the §13.2 showcase
manifest, the §7.5 inspect/focus and collision report, the winning camera's golden quadrilateral
file, the §13.8 provenance index, every §13.9 tier report, the metric report, the sRGB
decode/capture records, and the sealed A/B commitment row.

The index also records the §13.8.1 signer-registry revision the runner verified signatures
against, and carries its own digest in `indexSha256` under the §13.7.2 rule.

The packet is P0 invalid if any `required` row is missing, if any listed file's recomputed digest
differs from its `sha256`, if the packet contains a file absent from the index, if two rows share
an `artifactId`, or if a `required` row carries `status: unsupported` or `not-applicable` without
a reason. A critic who cannot verify the index rejects the packet rather than scoring it.

#### 13.7.2 Single hash-omission rule

One rule governs every hash in this document. Serialize as RFC 8785 JSON Canonicalization Scheme
UTF-8 bytes. Omit **only** the object's own digest field while hashing — never a nested object's
digest, never a sibling field, never a field merely because it is late-bound. Write the result
lowercase as `sha256:<64 hexadecimal characters>`.

The own-digest field is `manifestSha256` for §13.1, §13.1.1, §13.1.2, and §13.2; `reportSha256`
for §13.9; `recordSha256` for a §13.8 asset record; and `indexSha256` for §13.7.1. A §13.8
signature block additionally omits `signatures` while computing its signing subject, which is a
signing input and not this digest rule.

Nested digests are inputs to their parent's hash and are always present when the parent is
hashed. An object whose nested digest is still a pending sentinel cannot be hashed, and its
parent is P0 invalid rather than hashed around the gap.

### 13.8 Signed motif and provenance attestation

Every visible authored asset in an integrated card, field, HUD, or interface packet requires one
versioned provenance record. The four §13.2 specimens must each have their own record keyed by
`presentationFaceId` and render side. A composite screenshot also carries an index of every asset
record/hash it contains.

Each record uses schema `tiny-fangs.asset-provenance.v1` and includes:

| Block | Required fields |
|---|---|
| Identity | `assetId`, `assetRevision`, `presentationFaceId` or scene/UI role, source-file SHA-256, exported-file SHA-256 |
| Creator | legal/team identity, creator ID, employer/contract relationship, creation date, creation location, contact/record owner |
| Origin | `creationMethod` (`original-manual`, `original-procedural`, `licensed-source`, or disclosed assisted generation), source URIs/files and hashes, tool/model/version, prompt/input hash when applicable |
| Rights | rights owner, license ID/text hash, permitted uses, territory, term, sublicensing/redistribution terms, attribution, third-party content, restrictions |
| Reference use | R1/R2 hashes, purpose limited to visual-language comparison, reference crops viewed, and explicit statement that no reference asset is a source layer |
| Motif review | every checklist row below with `distinct`, `similar-escalated`, or `not-applicable`, evidence note, and reviewer decision |

The required motif comparison rows are:

1. creature/object identity and species;
2. silhouette, pose, and focal composition;
3. wisp, grave, tree, leaf, fence, rock, flower, and river forms;
4. rune, seal, center-divider mark, and family emblem;
5. border corners, filigree path, bevel ornament, and panel cut;
6. card-back sigil, constellation, moon/star placement, and rotational cues;
7. environment prop map, cluster spacing, and corner silhouette;
8. pseudo-writing, glyph strings, stat sockets, and icon shapes;
9. palette/material similarities that are intentionally retained under §9.4;
10. any other similarity a creator or reviewer noticed.

`similar-escalated` requires a replacement or a written rights/art-direction decision before the
asset enters a blind packet. Silence, unchecked rows, or “inspired by reference” without
asset-level comparison is not evidence.

The creator signs this exact attestation:

> I attest that the identified Tiny Fangs asset and its disclosed source inputs are accurately
> recorded, that I did not trace or copy a supplied-reference motif, and that the listed rights
> permit the intended production use.

An independent provenance reviewer signs:

> I independently compared this asset and its source record against R1 and R2 using every motif
> checklist row. The recorded distinctions, escalations, rights, and production decision are
> complete to the best of my review.

Both signatures are detached Ed25519 signatures over RFC 8785 canonical JSON with the `signatures`
field omitted. Each signature block records `signerId`, UTC `signedAt`, public-key fingerprint,
subject SHA-256, signature scheme, and base64 signature. The creator and reviewer signer IDs and
key fingerprints must differ.

#### 13.8.1 Trusted signer registry

A cryptographically valid signature from an unknown key proves nothing. Signature verification is
therefore anchored to one committed registry file, `thoughts/shared/tiny-fangs-signers.json`,
schema `tiny-fangs.signer-registry.v1`, integer revision starting at `1`. The registry does not
yet exist because no production art has been signed; creating it is a prerequisite for the first
signed record, and a signature that cannot be resolved against a committed registry revision is
invalid.

Each registry entry records:

| Field | Meaning |
|---|---|
| `signerId` | Stable unique ID used in signature blocks |
| `displayIdentity` | Legal/team identity matching the record's Creator block |
| `publicKey` | Ed25519 public key, base64 |
| `fingerprint` | Lowercase SHA-256 of the raw public key bytes |
| `roles` | Any of `creator`, `provenance-reviewer` |
| `validFrom` / `validUntil` | UTC interval; `validUntil` null while active |
| `status` | `active`, `retired`, or `revoked` |
| `statusChangedAt` / `statusReason` | Required whenever `status` is not `active` |

Registry changes are ordinary reviewed commits; the registry file's own history is its audit log.
An entry is never deleted or rewritten — status transitions append a new registry revision. The
creator and reviewer of one record must resolve to different registry entries with the required
roles, and self-signing both attestations is invalid regardless of key validity.

#### 13.8.2 Verification-time validity and revocation

A signature is valid only if all of the following hold at verification time:

- the `signerId` and fingerprint resolve to exactly one registry entry;
- the entry's `roles` include the role the signature claims;
- `signedAt` lies inside the entry's `validFrom`/`validUntil` interval;
- the entry's status at `signedAt` was `active`.

**Retirement** (`retired`) is a routine key rotation: signatures made while the key was active
remain valid; new signatures with that key are invalid. **Revocation** (`revoked`) means the key
or its holder can no longer be trusted: every signature made with that key on or after the
recorded compromise time — or all of them, when no compromise time can be established — becomes
invalid, and each affected record must be re-reviewed and re-signed by currently active signers
before its asset can re-enter any packet. Assets already inside a frozen blind packet whose
signatures are invalidated make that packet P0 invalid.

The capture runner performs this registry resolution as part of its existing signature/hash
verification and records the registry revision it verified against in the packet index. A packet
verified against a registry revision that later revokes a relied-upon key is re-verified before
any further critic use.

The later asset manifest carries the same record through:

```text
rights.owner
rights.licenseId
rights.licenseTextSha256
rights.permittedUses
rights.restrictions
provenance.recordSha256
provenance.creatorAttestationSha256
provenance.reviewerAttestationSha256
provenance.motifChecklistSha256
```

The capture runner verifies both signatures, record hashes, asset hashes, and manifest backlinks.
No signed records exist yet because no new production art was created in this task.
`PENDING_PROVENANCE` is an invalid sentinel: any integrated-art critic packet containing it is P0
invalid, and the affected asset cannot ship.

### 13.9 Settled-frame desktop performance evidence

Performance evidence uses schema `tiny-fangs.performance-report.v1`, report ID
`desktop-settled`, integer revision `2`. It runs only against the integrated final-art build
and `desktop-reference-populated`; it is not a camera-graybox aesthetic gate and must never be
used to reject unfinished camera graybox art.

Revision 2 replaces revision 1's single unnamed development machine and its four
method-free budget lines. A number is a budget only when this section names the tier it binds,
the instrument that produces it, and the window it is measured over.

#### 13.9.1 Named hardware tiers

Revision 1 bound every threshold to one development Mac at quality tier `desktop-high`. That is
not portable: a pass on fast hardware proves nothing about the configurations the project
actually commits to supporting, and no second party can reproduce the result. Performance is
therefore reported per named tier, and only one tier grants a pass.

| Tier ID | Role | Authority |
|---|---|---|
| `desktop-minimum` | The lowest desktop configuration the project commits to supporting | **The acceptance gate.** A desktop performance pass requires this tier |
| `desktop-reference` | The named development machine of the plan's reproducible performance protocol | Records headroom and detects regressions. It can never substitute for `desktop-minimum` |
| `desktop-throttled-ci` | Pinned Playwright Chromium at 1672 × 941, DPR 1, fixed 4× CPU slowdown | Portable regression detection between runs. It reports deltas and never grants a pass |

`desktop-minimum` must be named before the gate runs, exactly as the plan requires for
`mobile-reference`: CPU model, GPU model and WebGL renderer string, RAM, OS build, browser build,
power state, and availability. If it is defined synthetically rather than as physical hardware,
the report must state the exact throttle parameters and label the tier `synthetic`, and a
physical confirmation run remains explicitly owed. Naming the device is a Phase 13 and release
obligation; it does not block Phases 0–3.

Each tier records UTC timestamp; git/build/fixture/asset/font/camera hashes; OS name/build; CPU
model and logical/physical core counts; GPU model and WebGL renderer string; RAM; display
resolution/refresh rate; browser name/version; Three revision; viewport 1672 × 941; DPR 1;
quality tier; power source/mode; and thermal state when exposed. Missing machine, browser, or
quality metadata is invalid rather than “representative.”

A run on `desktop-reference` alone is recorded as EVIDENCE PENDING, never as a performance pass.
This mirrors the plan's rule that emulation cannot satisfy a real-device gate.

This section deliberately supersedes two details of the plan's reproducible performance protocol
for the desktop gate, and the plan carries a matching amendment so only one rulebook exists:
desktop pass authority moves from the `desktop-reference` profile to the named `desktop-minimum`
tier, and the measured fixture is `desktop-reference-populated` (the critic fixture) rather than
`board-dense`. `board-dense` remains a useful stress fixture for regression traces, but the gate
measures the state critics actually score. The plan's mobile protocol is untouched.

#### 13.9.2 Frame and renderer method

After `window.__TINY_FANGS_VISUAL_READY__` is true, run a 10-second visible-tab warm-up, then sample
every `requestAnimationFrame` timestamp for 30 continuous seconds. Run three traces without
navigation or hidden-tab intervals. Report sample count, duration, frame-interval p50/p95/max,
long-task count/max, draw calls, visible triangles, textures, geometries, transferred bytes,
estimated GPU texture allocation, and decoded image/asset CPU memory. Draw calls/triangles/textures
come from `renderer.info`; GPU texture memory is an explicitly labeled estimate from dimensions,
format, mip levels, and cube/array layers. Unsupported memory APIs are recorded as
`unsupported` with browser/version, never as zero.

#### 13.9.3 Load and interaction method

Revision 1 asserted an interaction-long-task threshold and three payload thresholds without
naming an instrument, a measurement window, a cache state, or which interactions were covered.
They were therefore unmeasurable as written. Each now has an exact method, and any budget whose
method cannot run is recorded `unsupported` with browser/version rather than assumed to pass.

| Budget | Instrument | Window and conditions |
|---|---|---|
| Interaction long task | `PerformanceObserver` on `longtask` plus Event Timing `event` entries; report the worst `duration` and worst input-to-next-paint per interaction | The named interaction set below, driven by the deterministic runner, 5 repetitions each, on a settled frame after readiness |
| Initial compressed app shell | Sum of Resource Timing `encodedBodySize` for the document and every script, stylesheet, and font blocking first interactive | Cold cache, `Cache-Control` bypassed, from `navigationStart` to first interactive |
| First-playable visual payload | Sum of Resource Timing `encodedBodySize` for every resource requested in the window | Cold cache, from `navigationStart` to first playable, defined below |
| Additional streamed assets for one match | Sum of Resource Timing `encodedBodySize` for every resource requested in the window | Warm from first playable, through the deterministic one-match script, for the two selected decks and the current environment only |

**First playable** is the exact moment both conditions hold: `window.__TINY_FANGS_VISUAL_READY__`
is `true`, and all six gameplay actions are dispatchable through the ordinary input path. The
runner records the timestamp and the condition that settled last. “Additional streamed assets for
one match” never means the whole catalog, matching the plan's protocol.

The named interaction set is exactly: Summon, Cast, Set, Attack, Retreat, End Turn, card inspect
open and close, graveyard open and close, Rules open and close, and hand-card hover. Each is
driven through the real pointer and keyboard paths, not by calling handlers directly. The budget
applies to the maximum across the whole set; a per-interaction table is also reported so a single
slow surface is attributable.

Transferred-byte budgets are recorded in compressed bytes, matching the plan's payload table.

#### 13.9.4 Pass rule

A desktop performance pass requires a `desktop-minimum` report satisfying all of:

- the run's quality tier is exactly `desktop-high` — the tier the §13.1 frame freezes and critics
  score; a report at any reduced tier is context, never a pass;
- median of the three p95 frame intervals ≤16.7 ms and worst-run p95 ≤20.0 ms;
- every run draw calls ≤100 and visible triangles ≤300,000;
- estimated GPU texture allocation ≤160 MB and decoded image/asset CPU memory ≤256 MB when
  obtainable;
- maximum interaction long task <50 ms across the named interaction set, measured per §13.9.3;
- initial compressed app shell ≤500 KB, first-playable visual payload ≤8 MB, and additional
  streamed assets for one match ≤20 MB, each measured per §13.9.3;
- zero forced synchronous layouts attributable to presentation code: each 30-second trace is
  captured as a Chromium performance trace, and no `Layout`/`UpdateLayoutTree` event whose call
  stack enters `src/presentation/` occurs inside a script task (the DevTools “forced reflow”
  attribution). An environment that cannot produce stack-attributed traces records this budget
  `unsupported` with browser/version — it does not silently pass;
- no hidden-tab sampling, no pending/missing report hash, and no difference in authoritative
  state or settled screenshot hashes across the three runs.

`desktop-reference` and `desktop-throttled-ci` reports are included for regression context and
are scored against the same thresholds, but neither can convert a missing or failing
`desktop-minimum` result into a pass.

Each trace stores raw samples and `traceSha256`. The RFC 8785 canonical report omits only
`reportSha256` while hashing, then records lowercase `sha256:<64 hex>`, per-tier and per-run
pass/fail, aggregate pass/fail, and a reason for every failed threshold. The integrated packet
includes every tier report, all trace hashes, and a screenshot/capture-manifest backlink.
`PENDING_PERFORMANCE` is P0-invalid evidence; no performance pass is claimed until the runner
emits real values on the named `desktop-minimum` tier.

## 14. Production Use

This bible is the entry gate for:

1. the Phase 2 populated orthographic and low-FOV graybox bake-off;
2. the creature/Cast/Set/card-back golden samples;
3. the complete face and asset manifest;
4. the Phase 3 canonical board-layout and DOM/Three registration contract;
5. later independent field, card, and general visual-director critic loops.

The implementation plan remains authoritative for sequencing, functional preservation, privacy,
performance, critic count, and release gates. The living ledger remains authoritative for current
and accomplished status. This document supplies visual measurements only and cannot mark its own
Phase 2 checkbox complete.

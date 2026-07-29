# Task 50 — Field Revision 2: Resolved Props, Card Physicality, Ground Texture — All §12 Rows Green

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## What changed (the full r1 critic worklist)

1. **Resolved shaded environment props** (`meadow-props.js`, `meadow-scene.js`): trees, shrubs, rocks, fence, and trunks now use `MeshLambertMaterial` with `flatShading` under one expressed warm key light (DirectionalLight `0xfff0d2` @ 0.85 from (-700, 950, -420)) + ambient `0xd8dccc` @ 0.55, giving every prop lit/shadow faces with value separation instead of flat unlit clumps. Corner vignette softened (blur 34px, alpha 0.62).
2. **Card physicality** (`board-page.js`): every board card gets an edge-thickness slab (3.2 px / 4.4 px offset); deck and grave anchors render 3-layer stacked piles; contact shadows are tighter (pad 16) and warmer (`rgba(26,16,8,…)`) with a warm light-spill layer on the key side.
3. **Ground micro-texture** (`meadow-scene.js`): 2,600 seeded grass-blade strokes across the painted terrain.
4. **Divider light bleeds into the grass**: a 0.28-alpha wash plus 60 seeded flecks — both windowed away from the diamond's measurement column.
5. **Empty-slot affordance**: slot interiors get a `rgba(240,224,180,0.10)` fill; the slot-line factor was recalibrated (1.115 → 1.13) under the new lighting.

## Calibration loop (fix evidence, not gates)

The r2 changes initially broke five measured rows; each was fixed at the authoring layer with the harness re-measured after every step:

| Row | Broken | Final | Fix |
|---|---|---|---|
| deep-left palette ΔE00 | 13.84 | **4.91** | Lambert shading darkens the calibrated shrub region; fixed color raised 0x39534a → 0x82b39d over three measured steps |
| perimeter/center ratio | 0.045 | **0.153** | same region drives the perimeter median; co-recovered with the deep-left fix |
| slot marks min | 1.127 | **1.154** | line factor 1.115 → 1.13 |
| diamond width | 49 px | **38 px** | divider bleed wash + flecks excluded from a ±100/110 px window around x=836 |
| frame extent top | 0.0985 | **0.1017** | two shrubs added to the top band |

## Determinism regression found and fixed

`populated board renders deterministically across loads` failed ~50% of parallel suite runs. Trace-artifact diff isolated 255 differing pixels (max Δ13) in bbox (542, 821)–(1152, 940) — exactly the hand row: Chromium re-rasters the scaled(0.42)+rotated hand-card subtrees at a compositor-chosen raster scale that varies under GPU contention. Fix: `will-change: transform` on `.hand-card-aaa` pins each card to its own compositing layer at first paint (board.html). Board page also awaits template-art `Image.decode()` before flipping `__TF_BOARD_READY__`. Six consecutive full parallel suite runs green after the fix (previously ~1-in-2 failure).

## Evidence

- Visual suites: **27/27 × 6 consecutive parallel runs** (meadow-field 7, populated-board 2, card-chassis 7, classic/topology remainder).
- Units: **601/601**.
- Deterministic capture: two loads byte-identical; `board-run1.png` sha256 `2137f2b832962718e365cd46a41b2929d3d7ffd0fa289a3e37ecbdc3ec72d379`.
- §12 rows measured live: ΔE 0.41 / 0.29 / 4.91 (≤5), perimeter ratio 0.153 (0.14–0.25), slots 1.154–1.311 (1.15–1.35), diamond 38×40 @ x 835.5, frame extents 0.100–0.102, quiet zone 0.0003, intrusion 0.
- Blind r2 set assembled by the new reusable `scripts/make_blind_field.py` (same ten camera-packet rows as r1); fresh sealed mapping committed at `sha256:7703b478a93774424d0bf4dae4b71884c0bf6d480d48927507cf2c69b539ff14` before any critic sees the set.

## Next

Two NEW fresh critics score the resealed A/B set blind; mapping unsealed only after both verdicts. Challenger must win for the Phase 7 exit gate.

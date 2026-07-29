# Task 52 — Field Revision 3: Cast Shadows, Species Albedo, 1x-Readable Terrain — All §12 Rows Green

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## What changed (the full task-51 worklist, visually verified at 1x this time)

1. **Real cast shadows under one sun** (`meadow-scene.js`): every tree, shrub, rock, and fence post now casts a soft grounded shadow painted into the terrain texture, offset down-right consistent with the warm key (light from upper-left). Positions come from newly-exported authored anchor constants (`TREE_ANCHORS`, `SHRUB_ANCHORS`, `ROCK_ANCHORS`, `FENCE_RUN` in `meadow-props.js`); a separate seeded rng (`0x51ade7`) keeps the shared scene stream untouched. Trees get a contact ellipse plus a longer soft tail.
2. **Foliage albedo out of near-black** (`meadow-props.js`): three-tone species palette — `FOLIAGE 0x4d7350`, `CANOPY_LIT 0x74a05e`, `SUNLIT_FOLIAGE 0x918751` — with single-draw tone picks (rng stream shape preserved), lighter trunk/rock tones, key light raised to 1.0 with ambient 0.5 for real facet contrast.
3. **Terrain readable at 1x** (`meadow-scene.js`): 3,200 grass strokes at raised width/alpha/length; 120 painted flower speckles (cream/gold/lavender with darker cores) excluded from measured rects, the divider window, and slot footprints; broad mow-band variation parallel to the divider; golden-hour grade (warm wash from the sun corner, faint cool settle lower-right).
4. **True card-stock extrusion** (`board-page.js`): even stepped 3-slab edge on every card (4 slabs with alternating tints for deck/grave stacks); board contact shadows became **directional** (tight core offset down-right + soft tail + warm spill on the sun side, replacing the r2 centered halo); hand cards get the same stock treatment plus a directional ground shadow.
5. **Stream banks** (`meadow-props.js`): mud outer band + sand inner edge + softened water + dashed sheen with sparkle highlights, replacing the hard cyan ribbon.
6. **Divider-terrain interaction**: the grass-bleed is now painted in seeded irregular segments (organic falloff), still windowed away from the diamond's measurement column.

## Regression caught by eye, fixed

Making all hand-card children absolutely positioned collapsed the wrapper to 0×0, breaking `transform-origin` — hand cards rendered near full-scale over the player row. Fixed with explicit 333×505 wrapper dimensions in `board.html`. This was caught by looking at the render, not by any gate — the §12 rows were all green while the layout was broken, which is exactly why the r3 protocol includes a visual pass before sealing.

## Calibration loop

| Row | After first r3 paint | Final | Fix |
|---|---|---|---|
| deep-left ΔE00 | 10.38 (overshot bright) | **2.10** | fixed color 0x9cc9b2 → 0x7a9d8b → 0x6fa598 (hue-corrected against rendered median) |
| perimeter/center ratio | 0.313 (above 0.25 ceiling) | **0.201** | edge-band alpha 0.62 → 0.72 under the brighter foliage |
| frame extents L/R | 0.0975 / 0.0997 | **0.101 / 0.105** | three inner shrubs added |

Final §12 rows: ΔE 0.39 / 0.32 / 2.10, ratio 0.201, slots 1.177–1.330, diamond 38×40 @ 835.5, extents 0.101–0.103, quiet 0.0003, intrusion 0.

## Evidence

- Visual suites: **27/27 × 3 consecutive parallel runs**; units **601/601**.
- Deterministic capture byte-identical; `board-run1.png` sha256 `0144a3eeb4e1f765c9cc11e223af0d7eb029cd9e6c3f744113d7ed5541b48f41`.
- Blind r3 set assembled via `scripts/make_blind_field.py field-r3`; fresh sealed mapping commitment `sha256:7ebf0dba1b082d1d909f86aa3ea413c6c3392d152dd673f4539664857be355fe` written before any critic sees the set.

## Next

Two NEW fresh critics score the r3 set blind; unseal after both verdicts; challenger must win for the Phase 7 exit gate.

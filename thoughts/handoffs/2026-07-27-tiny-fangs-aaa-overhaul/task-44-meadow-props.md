# Task 44 — Phase 7 Chunk 2: Perimeter Props and the §12 Environment Rows

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`
**Scope:** The §4.3 perimeter prop system — low-poly trees, shrub masses, rocks, fence run, river corners, flowers, grass tufts — authored against screen-space envelopes with seeded scatter, plus the three §12 environment rows measured live from a props-only §6.1-style ID mask.

## What was built

1. **`src/presentation/scene/meadow-props.js`.** Authored low-poly silhouettes in the baked §5 palette (seeded jitter, MeshBasicMaterial matching the NoToneMapping pipeline): stacked-cone trees at the §4.3 canopy positions (top-right, bottom-left, extreme right-middle), faceted dodecahedron rocks (left/right-middle, foreground corners), the angled fence run in its (105–290, 82–175) envelope, river ribbons at the two corner envelopes with water inside the outer band, shrub masses forming the irregular frame per side, and flowers with the 65–85%-outer rule plus two isolated central incidents.
2. **Props-only ID mask** (`?mode=prop-mask`; also built offscreen by the harness): props alone on white, powering three new measurements — per-side inward frame extent (documented reading of the §12 environment-frame row), central-zone prop occupancy (§4.1 quiet zone), and prop intrusion against the camera-lock golden quadrilaterals' AABBs.
3. **Calibration loop findings, fixed at root:** bright flowers near the divider detection window extended the measured band past 80% — the flower mask now excludes rows 365–465 (authored mask, not a measurement change); shrubs inside the measured deep-left rectangle shifted its median (ΔE 8.43) — that region's shrubs are calibrated to R2's foliage median (ΔE back to 1.41, best yet).

## Measured (all green, chunk-1 rows unchanged)

| Row | Measured | Tolerance |
|---|---|---|
| Frame extent L/R/T/B | 10.5 / 10.9 / 10.9 / 11.2% | 10–15% per side |
| Quiet-zone prop share | 0.03% | ≤30% (grass ≥70%) |
| Prop intrusion | 0 px | ≤42 px |
| Divider span / center / core | 76.3% / 413.5 / 10 px | unchanged, green |
| Diamond | 38×40 at 835.5 | unchanged, green |
| Palette ΔE00 | 0 / 0 / 1.41 | ≤5 |
| Perimeter/center ratio | 0.184 | 0.14–0.25 |

## Evidence

- Meadow spec now **5 gates** (new environment-rows gate), visual project **23/23** (17 classic hashes byte-identical), units **601/601**. Render: `task-44-meadow-props.png`.

## Next

Zone decals/slot marks, seeded ambient motion, static AVIF/WebP fallback, canopy silhouette polish under the top-down pitch, then the populated-board blind comparison vs R2.

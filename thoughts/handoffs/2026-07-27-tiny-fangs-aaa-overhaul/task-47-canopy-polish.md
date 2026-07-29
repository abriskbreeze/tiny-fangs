# Task 47 — Phase 7 Chunk 5: Canopy Silhouette Polish

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## What changed

- Trees and shrubs replace single stacked cones (which flatten into hexagons under the locked 24.5° pitch) with **clustered flattened icosahedron lobes** — 4–6 seeded lobes per canopy with per-lobe §5 color jitter — producing soft, organic, irregular silhouettes from the camera's actual viewpoint.
- The silhouette change shifted three measured rows slightly under band (right/top frame extents, deep-left ΔE); re-densified with a handful of authored shrub anchors, landing frame extents at 10.3–11.1%, deep-left ΔE 3.43, all else unchanged.

## Measured (all green)

Frame extents L/R/T/B 11.1/10.3/10.5/10.5% · quiet zone 0.03% · intrusion 0 px · slot band 1.157–1.247 · divider 76.3%/413.5/core 10 · diamond 38×40 · palette ΔE 0/0/3.43 · perimeter ratio 0.225 · motion gates green.

## Evidence

- Meadow spec **7/7**; visual project **25/25** (17 classic hashes byte-identical); units **601/601**. Render: `task-47-canopy.png` — the field now carries the full §4 composition: irregular foliage frame, twelve engraved slot footprints with rune diamonds, luminous divider and center diamond, fence run, river glimpses, seeded blooms.

## Next

The Phase 7 exit: populated-board harness (DOM card system homography-composited at the golden quadrilaterals over the live meadow, midgame fixture), deterministic capture, then the blind comparison against R2 with two fresh critics.

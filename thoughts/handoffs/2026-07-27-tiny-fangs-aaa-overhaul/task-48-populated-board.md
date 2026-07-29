# Task 48 — Phase 7: The Populated Board Harness

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`
**Scope:** The populated midgame board: live meadow scene under real DOM card faces homography-mapped onto the camera-lock golden quadrilaterals, with hand row and contact shadows. The blind comparison vs R2 is the next step; no comparison verdict is claimed.

## What was built

1. **`board.html` + `src/presentation/scene/board-page.js`.** The settled meadow (t=0, seeded, NoToneMapping) renders under a DOM layer where all twelve golden anchors receive real chassis cards via the Phase 3 `applyQuadTransform` homography (measured forward-projection error 0.0000 px): both actives, benches, face-down sets and decks as backs, grave top-cards, and one authored empty bench slot showing its engraved footprint. A four-card fanned hand sits in the §12 hand envelope, and per-card radial contact shadows seat everything on the ground.
2. **Fixed during the loop:** the hand row initially rendered off-frame — the placement math offset by *scaled* dimensions while `transform-origin: 50% 100%` pins the *untransformed* bottom edge; corrected to unscaled-chassis offsets.
3. **Template apertures wired into the card system:** faces without golden-sample art now load their Phase 6 faction template thumbnail from the canonical manifest path (`data-art-tier="template-placeholder"`), so every board card shows real (placeholder-tier) art — the game renders no broken/missing art, completing that Phase 6 exit clause visually.
4. **Layout note (honest):** this is a representative midgame arrangement for the field comparison capture; deterministic gameplay-fixture wiring into the real shell belongs to Phase 8.

## Evidence

- New spec gates: 11 anchors + 4 hand cards placed, **max corner registration error 0.0000 ≤ 2 px** (§12 projected-registration row), deterministic across loads including template image settling.
- Visual project **27/27** (17 classic hashes byte-identical); units **601/601**. Render: `task-48-populated-board.png`.

## Next

The Phase 7 exit gate: blind field comparison — `field-full` (and row crops) cut identically from R2 and this capture, sealed mapping, two fresh critics; the challenger must win.

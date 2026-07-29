# Task 53 — Phase 7 Exit Gate: Third Blind Field Comparison — CHALLENGER LOSES, FIRST CROP WIN

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## Verdict — `gatePass: false` (challenger drew label B; commitment verified)

| | Critic 1 | Critic 2 |
|---|---|---|
| Challenger crop wins | **1/10 (field-hand)** | **1/10 (field-hand)** |
| Overall | reference | reference |

Progress across revisions: r1 0/10 + 0/10 → r2 0/10 + 0/10 → **r3 1/10 + 1/10, same crop, both critics**. The hand fan won outright on typography, fan geometry, and readability — both critics called our card text layer "genuinely excellent" and the thing the reference should graft in.

## Root-cause analysis of the headline complaint

Both critics again said "nothing casts a shadow — props float." The r3 painted shadows EXIST in the texture — but under the locked near-top-down camera (FOV 30, pitch 24.5) a tree's canopy (~85 px screen radius) fully occludes a shadow offset by only ~29 px. **The canopies hide their own shadows.** Same failure class as r2's invisible grass strokes: authored ≠ visible. Golden-hour shadows under this camera need offsets larger than the canopy radius (roughly 0.8–1.5× canopy diameter) to read.

Other converged challenger items (deduplicated):

1. **Long visible cast shadows** — big down-right offsets past the canopy silhouette, stronger alpha, elongated; fence posts and rocks too.
2. **Ground cover density** — critics still read the field as "flat mustard with faint stripes": more/denser strokes, clover patches, petals, larger value variation; soften the mow-bands (they read as banding artifact, not mowing).
3. **Organic water** — the plane-strip stream still reads as "angular UI panels"; paint the stream INTO the terrain texture (curved path, blended banks, foam, depth gradient) instead of rectangles.
4. **Card physicality at render scale** — the 3–4.6 px stock slabs shrink to ~1.5 px after homography (invisible); scale-aware extrusion, darker tighter contact core, stacked-paper depth for decks.
5. *(Noted, BLOCKED as taste/authority)* — "teal sleeves clash": the cast-family hex #277A79 is the accepted art bible §7 palette; changing it is a bible amendment, not a field fix. Recorded, not acted on.
6. *(Noted, camera-lock constraint)* — the opp.grave card at the right edge renders small/tight; its golden quad is part of the locked camera record.

## Evidence

`tests/visual/field-packet/field-critic-1-r3.json`, `field-critic-2-r3.json`, `field-verdict-r3.json`; commitment `7ebf0dba…` verified True at unseal; challenger capture `0144a3ee…`.

## Next

Implement field r4 = items 1–4 with the standing pre-seal visual pass (this time verifying shadows/water/cover READ at 1x, not merely exist), keep §12 green by authoring-layer recalibration, reseal, two new fresh critics.

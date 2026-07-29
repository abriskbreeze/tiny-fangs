# Task 49 — Phase 7 Exit Gate: First Blind Field Comparison — CHALLENGER LOSES (Revision 1)

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## Verdict — `gatePass: false` (challenger drew label A)

| | Critic 1 | Critic 2 |
|---|---|---|
| Challenger crop wins | 0/10 | 0/10 (1 tie: divider) |
| Overall | reference | reference |

Sealed protocol ran cleanly: deterministic capture (byte-identical runs), commitment sealed before review, both fresh critics scored blind, mapping unsealed after both outputs.

## Both critics' converged read

- **"B is a place; A is a mockup."** The reference's edges are a *resolved* meadow — shaded trees, rocks, flowers, fence, sparkling river under one golden-hour light — while our lobed-icosahedron masses read as "abstract dark-teal polygon clumps / unfinished masking," especially in every corner crop. The measured §12 rows (frame extents, palette medians) are green, but geometry that satisfies occupancy is not yet *scenery*.
- **Card grounding decides it:** the reference's cards have edge thickness, visible deck-stack physicality, and warm contact shadows with light spill; ours "float on a flat olive fill" with thin shadows.
- **Credits banked:** our card-face design system was called "production-ready and the most readable of the two," and our divider tied one critic's crop (precise but "pure UI" vs the reference's organic seam).

## Field revision-2 worklist (both critics, deduplicated)

1. Resolved environment props with shading/silhouette logic (lit/shadow faces per prop, species-readable trees, rock facets with value separation) replacing flat abstract clumps; soften the corner vignette.
2. Card physicality: edge thickness on every board card, stacked-pile rendering for decks/graves, tighter warmer contact shadows with light spill.
3. Ground micro-texture (real grass variation, not flat fill) and one consistent light direction expressed in prop shading.
4. Divider: integrate the light into the grass (bleed/scorch) rather than a strip on top.
5. Empty-slot affordance strengthening.

## Evidence

- `tests/visual/field-packet/field-critic-1-r1.json`, `field-critic-2-r1.json`, `field-verdict-r1.json`; sealed commitment verified; capture `5c94313c…`.

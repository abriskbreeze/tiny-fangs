# Task 51 — Phase 7 Exit Gate: Second Blind Field Comparison — CHALLENGER LOSES (Revision 2)

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## Verdict — `gatePass: false` (challenger drew label A again, fresh random seal)

| | Critic 1 | Critic 2 |
|---|---|---|
| Challenger crop wins | 0/10 | 0/10 |
| Ties | 0 | 0 |
| Overall | reference | reference |

Protocol clean: fresh deterministic capture (byte-identical, `2137f2b8…`), new sealed mapping committed (`7703b478…`) before either critic saw the set, two NEW context-clean critics, commitment verified at unseal.

## Why r2 lost — verified against the capture, not just the prose

I checked the challenger crops myself after unsealing. The critics are right: the r2 changes exist but are **an order of magnitude too subtle at capture scale**. The Lambert facets ARE there (visible value separation on the corner masses) but the canopy albedo is still near-black; the 2,600 grass blades are invisible at 1x; the edge slabs read as a "misregistered teal under-border" on one side rather than card stock; contact shadows read as a faint uniform halo, not a directional grounded shadow. Nothing casts a real shadow on the ground. The measured §12 rows all being green while losing 0/10 twice is the art bible's own warning made flesh: occupancy and palette medians are necessary, not sufficient — "geometry that satisfies occupancy is not yet scenery."

## Banked credits (both critics)

- Card face design: fully readable, "production-ready"; the reference's rules text is illegible pseudo-glyphs — its only clear loss.
- Both critics judged the reference's flaws (bloom blowout top-left, mushy canopy, divider kink, upscale smear) as *finishing* problems vs our *foundational* ones.

## Field revision-3 worklist (both critics, deduplicated, in attack order)

1. **Real cast shadows, one sun.** Every prop, the fence, and every card gets a directional grounded shadow consistent with the key light (Three.js shadow mapping or authored shadow painting on the terrain texture). The current DOM card shadow must become directional, not a centered halo.
2. **Prop material identity.** Brighten foliage albedo far out of near-black into a lit mid-green family; strong lit/shadow face contrast; species-readable trees vs shrubs vs stone; varied silhouettes. The corner masses must read as *things*.
3. **Terrain that reads at 1x.** High-contrast grass tufts/strokes, flowers, mow-band/path value variation. The current blades are sub-visible; scale stroke size/contrast up until they survive the full-field view.
4. **Card stock extrusion done right.** Visible even thickness (not a one-sided offset); fix the hand-card "teal under-border misregistration"; deck stacks keep their multi-layer read.
5. **Stream rework** (corners tl/br): banks, soft edges, highlights, lighting-consistent water — currently "masking-tape ribbon."
6. **Golden-hour grade + divider integration.** A warm atmospheric grade tying cards/ground/props; divider seam interacting with resolved terrain (irregular falloff, scorched/blessed grass), not a uniform glow line on flat fill.

## Evidence

- `tests/visual/field-packet/field-critic-1-r2.json`, `field-critic-2-r2.json`, `field-verdict-r2.json`; commitment verified `True` at unseal; challenger capture `2137f2b8…`, reference `5229e89a…`.

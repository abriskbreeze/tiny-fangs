# Task 54 — Field Revision 4: Shadows That Read, Organic Water, Scale-Aware Card Stock — All §12 Rows Green

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## What changed (the full task-53 worklist)

1. **Shadows offset past the canopy silhouette** (`meadow-scene.js`): tree shadows now step out in three ellipses to +110s px screen offset (r3's +12s was fully occluded by ~35s-radius canopies under the near-top-down camera); side/bottom shrubs and rocks get two-step long shadows; fence posts get double shadows. The distant top band keeps modest reach so the measured upper rect stays grass-dominated.
2. **Ground cover that reads at 1x**: 4,200 strokes at higher alpha/width/length, 30 clover patches (8–16 dots each), 190 flower speckles, stronger low-frequency blotches; mow-bands widened (step 128) and softened ~35% (r3's read as banding artifact).
3. **Organic painted water** replacing the plane-strip river (`paintStream` in the terrain painter): quadratic screen-space paths with blurred mud bank, sand edge, depth layer, water, sheen line, and 26 seeded foam flecks per stream; the plane-based `riverRibbon` is deleted from `meadow-props.js`.
4. **Scale-aware card stock** (`board-page.js`): extrusion offsets are authored in final screen px and divided by the render scale (quad width / 333 for board cards, HAND_SCALE for hand cards) — r3's fixed 3–4.6 px slabs collapsed to ~1.5 px after homography. Stacks step to 13/18 screen px.

## Detector forensics (fix evidence, not gates)

The diamond row broke (width 65 @ 822) with the diamond rendering *correctly*. Root cause chain, found by reading `meadow-page.js`'s detector rather than guessing: column "thickness" is a **gap-inclusive span** over y 380–450, and the r4 grass strokes point ~77° upward — strokes rooted at y 451–465 poke bright pixels into the window, stretching column spans past the 1.6×-median diamond test far left of center. Fix: the stroke exclusion band now covers the detection window **plus the stroke reach** (378–466). Two earlier guesses (halo shrink, outer-diamond retone) were measured no-ops or overcorrections and were reverted — the final divider texture is byte-identical to r3's.

Other §12 recalibrations after the stream reshuffle: sand hue moved off the warm-gold field-detector axis (the banks were terminating edge scans and shrinking extents); blotches and motes excluded from the divider window; slot factor 1.13 → 1.145; three bottom-band shrubs (outside the hand-column exclusion) for the bottom extent; deep-left recalibrated in two steps to ΔE 1.05 with the G/B channels matched (0x6cc6ba); edge-band alpha settled at 0.66 for ratio 0.187.

Final rows: ΔE 0.41 / 0.61 / 1.05, ratio 0.187, diamond 37×39 @ 836, slots 1.172–1.340, extents 0.102–0.109, quiet 0.0003, intrusion 0.

## Pre-seal visual pass (standing protocol)

Verified at 1x on the capture: deck stacks read as stacked paper; card extrusion visible on every card; stream is curved with banks and foam; clover/flowers/strokes read as ground cover; prop shadows visibly fall down-right into the field; fence posts grounded; hand fan has stock edges and a directional ground shadow.

## Evidence

- Visual suites 27/27 × 3 consecutive parallel runs; units 601/601.
- Deterministic capture byte-identical; `board-run1.png` sha256 `1d3be22d5bcabdb7ffe52e7502f5ab647def5581d0dba302a26d341282ef9e5b`.
- Blind r4 set sealed via `scripts/make_blind_field.py field-r4`; commitment `sha256:7a967fd1d1c3724a48e48842bca1c59b37d24e155be6c9ea7f13025591a224ed` written before any critic sees the set.

## Next

Two NEW fresh critics score the r4 set blind; unseal after both verdicts; challenger must win the Phase 7 exit gate.

# Task 42 — Phase 7 Chunk 1: Meadow Terrain, Divider, and Diamond Under the Locked Camera

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`
**Scope:** First Phase 7 chunk: terrain + divider + center diamond rendered under the locked camera with every applicable §12 field row measured live and green. Props, foliage silhouettes, ambient motion, and the fallback come in later chunks; the blind board-vs-R2 comparison waits for the populated board.

## What was built

1. **`src/presentation/scene/meadow-scene.js`.** Deterministic meadow under `createCameraCandidate('P')` (the locked FOV 30 / pitch 24.5 / distance 1950). Colors are BAKED into a seeded canvas texture (`mulberry32`, fixed seed): §5 lower/upper meadow base with a sunlit wash, seeded low-frequency blotches (kept out of the measured quiet rectangles), a cool foliage frame, and ≈1.6% RMS micro grain. The divider is a transparent luminous strip placed by ground raycast so its projected core lands exactly on the §4.1 geometry, with the center diamond at frame center.
2. **Screen-anchored painting — the load-bearing design.** The first metric pass proved texture-space painting misses screen-space targets (deep-left foliage rendered as meadow at ΔE 39): every feature is now placed by projecting screen positions onto the ground plane and mapping into texture UV, so the §12 regions measure what was authored. Second real defect caught: canvas gradients fading to `rgba(0,0,0,0)` darken midtones — all fades now go to zero-alpha of their own color.
3. **Tone-mapping decision (documented in code).** A flat-quad bisect proved `NeutralToneMapping` itself distorts the §5 roles (`#B3A74F` → 172,159,55; blue crushed ~30%) while `NoToneMapping` is exact identity. The meadow renderer uses **NoToneMapping**: the baked cel pipeline authors final colors directly, §5 rule 1's LUT constraint is satisfied trivially, and the spike's Neutral choice applied to its compositing test, not a lock.
4. **`meadow.html` + `meadow-page.js` harness.** Computes the §12 rows in-page with the same operators applied to the render and to R2: §2.1-style band detection (0.55 luminance core, central-third seeding, ≤130 px gap bridging, least-squares slope), diamond vertical-thickness profile, region medians with a full CIEDE2000 implementation, and the perimeter/center luminance ratio.
5. **`tests/visual/meadow-field.visual.spec.js` (4 gates, green).**

## Measured results (all inside §12/§4.1 tolerances)

| Row | Measured | Tolerance |
|---|---|---|
| Divider center y | 413.47 | 414 ± 3 |
| Slope | 0.006 px | ≤ 1 px |
| Band span | 76.3% | 68–80% |
| Core thickness | 10 px | 6–12 (R2 measures 10) |
| Diamond center x | 835.5 | 836 ± 3 |
| Diamond core | 38 × 40 px | 33–45 × 38–50 |
| quiet-upper-meadow ΔE00 | 0.0 | ≤ 5 final |
| lower-meadow ΔE00 | 0.0 | ≤ 5 final |
| deep-left-foliage ΔE00 | 3.63 | ≤ 5 final |
| Perimeter/center ratio | 0.225 | 0.14–0.25 |
| Determinism | two loads byte-identical | required |

## Evidence

- Visual project **22/22** (4 new meadow gates; chassis, classic 17 hashes, composite, graybox all unchanged); units **601/601**. Render: `task-42-meadow-chunk1.png`.
- Honest visual state: the foliage frame currently reads as abstract blurred bands — the §4.2/§4.3 D0/D1 prop silhouettes (trees, rocks, fence, river, flowers) arrive in the next chunk and give the frame its organic shapes.

## Next chunks

Perimeter props per the §4.3 envelopes (authored silhouettes + seeded scatter within masks), zone decals/slot marks, instanced foliage, environment-frame occupancy + quiet-zone + prop-intrusion rows, seeded ambient motion, static AVIF/WebP fallback, then the populated-board blind comparison against R2.

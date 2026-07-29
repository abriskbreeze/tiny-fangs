# Task 46 — Phase 7 Chunk 4: Seeded Ambient Motion and the Static Fallback

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## What was built

1. **Seeded ambient motion, pure function of time.** Canopy sway (per-cone seeded phase/amplitude), 40 drifting dust motes over the play surface, 8 pulsing fireflies near the foliage corners, and river-sheen shimmer — all deterministic in `timeMs`, so `renderAt(t)` reproduces any frame byte-for-byte. The static harness renders the settled `t = 0` frame (all prior gates untouched); `?mode=live` runs the animation loop.
2. **Reduced-motion equivalence:** the live loop honors `prefers-reduced-motion` and holds the settled frame — same information, no ambient movement. Gated in the spec via Playwright media emulation.
3. **New motion gate:** same-time renders byte-identical (`t=0` twice), different times genuinely differ (`t=0` vs `t=800`), reduced-motion live mode stays still across 400 ms.
4. **Static fallback backdrop, real content:** the settled scene re-rendered at 3840×2160 through a resize hook and written to the manifest's `environment/meadow-backdrop` slot (205 KB WebP against an 8 MB budget), replacing the gradient placeholder with the true field image. Draft validation unchanged at 0 errors.

## Evidence

- Meadow spec **7 gates** green; visual project **25/25** (17 classic hashes byte-identical); units **601/601**.

## Next

Canopy silhouette polish, then the populated-board capture and its blind comparison against R2 — the Phase 7 exit gate.

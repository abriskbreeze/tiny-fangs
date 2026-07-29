# Task 39 — Phase 2: Golden-Sample Revision 2 (Critic r1 Corrections)

**Date:** 2026-07-28
**Branch:** `feat/cel-shaded-field`
**Scope:** Implements the full Task 38 correction list. The revision-2 blind re-run with two new fresh critics is the next step; no gate pass is claimed.

## Corrections applied (mapping to the r1 findings)

1. **Lit staging ground (anchor L failure).** The showcase stages on a warm sunlit meadow tabletop — §5 meadow/foliage roles, upper-left key wash, foliage vignette corners, subtle grass micro-texture — replacing the void. Contact shadows now visibly seat the cards.
2. **Misregistration seams.** The art aperture carries an authored 1.5 px ink keyline (every art/frame junction is a deliberate line, not a raw layer edge); the nameplate gained an opaque ink surround ring killing the art sliver at its corners.
3. **Card back density.** Framing border pair with corner breaks, asymmetric corner filigree hooks, a three-ring set with radial tick marks, compass points, a moth-star, and the twin fangs — all 1–2 px gold line work within §7.6 limits.
4. **Material depth.** Paper grain lifted to survive 2× (≈5% amplitude), added directional press-grain to the panel, and 1 px emboss highlight/shade lines on the family rail.
5. **Wolf anatomy refined** — cleaner muzzle/ear/chest/tail silhouette, moonward rim light consolidated.
6. **Footer-on-rail contrast — root-cause geometry fix.** The new `footer-contrast-on-ground` metric row measured 2.27–2.9:1 and exposed the real defect: the uniform 38.5 px bottom frame inset put the §7.4 footer rectangle (457–495) on the saturated rail. §7.2 binds the 10.5–12.5% cumulative inset to left/right only, and §5 requires parchment as the label ground — so the bottom frame collapses to lip + keylines (7 px cumulative), the parchment panel reaches y 498, and stat medallions overlap the bottom edge by design (echoing R1's cost-medallion overlap). Row now passes at ≥4.5:1. Side insets unchanged at 11.56%.
7. **Metric coverage extensions (strengthened, not weakened):** `shadow-visibility-in-context` (luminance delta between the in-envelope shadow band and unshadowed ground in the composed capture, ≥0.03 per specimen) and `footer-contrast-on-ground` (per-family footer ground sample) — both green after the fixes above.

## Evidence

- Metric report: **11/11 rows PASS** (9 original + 2 extensions).
- Packet rebuilt deterministically; new `captureSha256 bb455972…`; all rows present, blind mapping to be resealed for the r2 critic run.
- Units **596/596**, visual **18/18** (7 chassis gates green under the new bottom-frame geometry; 17 classic hashes byte-identical), desktop E2E **59/59**. Classic untouched.
- Render: `task-39-showcase-r2.png`.

## Next

Reseal a fresh A/B mapping over the r2 capture and run two NEW fresh critics (§13.5 requires fresh critics per revision). If they pass, the gate still needs a second consecutive clean revision and user taste acceptance (future BLOCKED entry).

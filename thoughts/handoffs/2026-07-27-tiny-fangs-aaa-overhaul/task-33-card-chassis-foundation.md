# Task 33 — Phase 2: Card Chassis Foundation and Showcase Harness

**Date:** 2026-07-28
**Branch:** `feat/cel-shaded-field`
**Scope:** The structural foundation for the four golden samples: the §7 card chassis rendered as real DOM with objective geometry gates, the §13.2 showcase harness, and candidate typography. Aperture art, craft polish, and the two-fresh-critic blind gate are the next iterations — no golden-sample acceptance is claimed here.

## What changed

1. **`src/presentation/cards/chassis-geometry.js` (new).** The bible's §7.4 exact half-open safe rectangles for all four families, the §7.2 inset ranges, nameplate contract, the three catalog nameplate fixtures, and §5 palette roles — plus rectangle math helpers. One deliberate interpretation is documented in the tests: §7.3's prose says the family seal "straddles the art/rules join at 55–64%", while §7.4's exact rectangle bottom lands at 64.75%; the exact table governs and the straddle *point* (seal center, 61.1%) is what must sit in the band.
2. **`tests/presentation/chassis-geometry.test.js` (16 contracts).** Re-derives the bible's own §7 requirements against the authored geometry: chassis ratio, bounds, the full §7.4 pairwise sibling non-overlap check with the declared nested-title exemption and the 2 px minimum gap, the 6 px footer-to-stat separations, aperture/cost/stat proportions, family deltas, and the nameplate box math (two 24.5 px lines in the 230 × 50 box).
3. **`src/presentation/cards/card-face.js` + `cards.css` (new).** Fail-closed view-model normalization and a DOM builder placing every §7.4 rectangle at authored coordinates inside the §7.2 seven-layer frame hierarchy (21 px corner radius; lip 3.45% / keyline 0.9% / family rail 6.3% with contained bevels / inner keyline 0.9% — cumulative 11.56% per side). §5 palette (creature amber, cast teal, set plum, back navy, parchment/ink, filigree), paper grain, family-specific stat silhouettes (edged attack, rounded health), and the navy back with gold line work and a centered sigil. Loaded only by the showcase surface — the classic shell never imports it.
4. **`showcase.html` + `src/presentation/cards/showcase-page.js` (new, dev/QA-only).** `?mode=chassis` lays the four specimens plus the three §7.4 nameplate fixture cards flat for measurement; default mode places duskfang / manaSurge / phantomWall / the card back at the §13.2 `desktop-four-family` revision-1 centers, sizes, rotations, and z-order (Set front above the partially occluded back, as the manifest requires). Not part of the production build.
5. **`tests/visual/card-chassis.visual.spec.js` (7 browser gates).** Measures the real rendered DOM: exact 333 × 505 chassis, §7.2 per-side aperture insets within 10.5–12.5%, §7.3 aperture proportions, every §7.4 content rectangle within 1 px of authored coordinates, the three nameplate fixtures rendering unclipped at locked 22 px in the loaded Alegreya face with ≥2 px horizontal clearance and ≤2 lines, the card back rendering zero face data with its sigil inside art-safe, and all four showcase centers within 1 px of the manifest.
6. **Candidate typography, self-hosted.** Alegreya variable (wght 400–900, normal+italic, latin/latin-ext, SIL OFL 1.1 with bundled license) as the display/rules face; JetBrains Mono (already hosted) for numerals/labels (tabular, unambiguous glyphs). This satisfies §8.1's measurable characteristics and passes the §7.4 font fixtures — but **family choice is a user taste decision and is recorded BLOCKED-for-ratification in the ledger**, with the objective gates already green so work continues on the candidate.

## Candidate render

`task-33-showcase-candidate-r1.png` — the §13.2 composition with placeholder aperture art (`data-art-pending`). Known craft gaps queued for the pre-critic polish pass: footer/flavor contrast too low, family seal too plain, aperture art is a placeholder gradient, back sigil/ring composition needs real line work. None of these affect the geometry gates above.

## Evidence

- Units **596/596** (16 new geometry contracts); visual **18/18** (7 new chassis gates + all 17 classic hashes still byte-identical); desktop E2E **59/59**; build clean with an unchanged production bundle (classic untouched — `cards.css` is showcase-only).

## Next

1. Author the four aperture art pieces + back sigil line work (original, §5 palette, §7.6 constraints), polish craft, then assemble the §13.7 blind packet and run the two fresh critics against the §13.5 gates.
2. Ledger BLOCKED question for the user: ratify or veto the Alegreya + JetBrains Mono pairing.

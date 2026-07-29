# Task 34 — Phase 2: Golden-Sample Aperture Art and Craft Polish

**Date:** 2026-07-28
**Branch:** `feat/cel-shaded-field`
**Scope:** Original aperture art for the three front specimens, the card-back sigil line work, and the craft corrections identified in Task 33. Candidates only — the §13 blind critic gate and user taste acceptance have not run and are not claimed.

## What changed

1. **`src/presentation/cards/art/golden-sample-art.js` (new).** Four hand-authored cel-style SVG scenes, no traced or reference-derived geometry, all colors drawn from the §5 sampled palette:
   - **duskfang** — howling twilight wolf seated on the meadow ridge, moon behind the howl line, amber rim light, single ember eye; focal subject inside the §7.4 art focal-safe band (a first composition had the wolf below the band, half-occluded by the nameplate — recomposed).
   - **manaSurge** — stone spring erupting a teal-and-gold mana column with orbiting droplets and a lit pool.
   - **phantomWall** — spectral battlemented rampart with coursed masonry fading upward, wisps, and a wan moon tucked behind the parapet.
   - **backSigil** — original twin-fang mark in fine gold line work (1–2 px at chassis scale) with paired rings and deliberately asymmetric compass filigree on the shared navy ground (§7.6).
2. **`card-face.js`.** Face models carry `faceId`; apertures with authored art render it, others keep the marked placeholder; the back renders the sigil SVG.
3. **Craft corrections from the Task 33 gap list.** Footer/flavor lifted to ~full ink (§5 rule 4 contrast); the family seal gained a stamped twin-fang mark echoing the back sigil; type labels (`TWILIGHT WOLF` / `CAST VERSE` / `SET VERSE`) now sit on an opaque parchment chip — §7.4 requires an opaque text ground where overlays cross aperture art, and the labels were previously near-illegible over dark scenes.

## Candidate renders

`task-34-showcase-candidate-r4-full.png` (full §13.2 composition) and `task-34-showcase-candidate-r4.png` (creature crop). Intermediate rejected passes r2/r3 retained for the revision trail.

## Evidence

- Units **596/596**; visual **18/18** (all 7 chassis geometry gates still green with real art in the apertures — art stays inside its rectangles; 17 classic hashes byte-identical); desktop E2E **59/59**. Classic untouched.

## Next

Assemble the §13.7 blind packet (crops per §13.3, canonical index, hash rules) and run the first two fresh critics against the §13.5 gates. Expect rejection-and-revise cycles; golden-sample user acceptance remains a future BLOCKED entry.

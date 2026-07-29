# Task 61 — Phase 9c: 3D Coin, Reveals, Results, Graveyard, Rules — Phase 9 Acceptance Met

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## What landed

- **3D coin** (`doCoinFlip` in `main.js`): in aaa mode the SAME overlay lifecycle hosts a CSS-3D gold coin (radial-gold faces, preserve-3d, quarter-turn per frame, landing snapped to the flipped result face) instead of the ASCII `<pre>`. Every frame delay is untouched — the E2E asserts the overlay is visible at 1779 ms and gone at exactly 1780 ms, with the winner-choice modal following as in classic. Classic mode keeps ASCII byte-identically; `playMPCoinFlip` stays classic (multiplayer polish is Phase 12 scope).
- **Reveals**: `.trigger-box` (trigger/cast/set reveal surface) in the parchment material; key-dismissal contract asserted via the real `showCastReveal` flow.
- **Result screen**: `#result` in the material (gold title, medallion Play Again); driven by the `victory` fixture in aaa mode.
- **Graveyard browser**: the grave count chips become buttons opening the classic `showGraveyard` flow (hold-to-zoom `onpointerdown` handlers preserved on entries); focus ring + hover affordances.
- **Rules overlay**: classic rules links live inside the hidden classic shells, so the AAA HUD gains a quiet `Rules` corner link opening `#rulesModal`, restyled as a scrollable parchment book.

## Phase 9 acceptance review

Every overlay state now belongs to the board's visual world: setup/lobby/deck-select (9a), generic/response modals + card detail (9a), selectors with diegetic targeting + ownership cues + timer (9b), coin/reveals/results/graveyard/rules (9c). Dismissal timing, backdrop behavior, key handling, disabled options, and ownership cues are E2E-asserted on the unchanged classic DOM flows; no modal traps focus or permits an invalid action (same handlers throughout). Residue explicitly deferred to its planned phase: multiplayer lobby state flows and the Skitter-response sweep re-run in aaa mode belong to Phase 12 parity; motion polish for reveals/coin belongs to Phase 10.

## Evidence

- New `aaa-overlays` E2E **5/5**; full E2E **86/86**; visual **27/27** (classic hashes intact); units **601/601**; build clean.

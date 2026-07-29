# Task 60 — Phase 9b: Selectors with Diegetic Targeting, Selected States, Timer Chip

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## What landed

**Diegetic target selection** (the headline): when a creature selector opens (e.g. Shadow's Soul Siphon, board/any), every legal target on the AAA board gets a gold `aaa-card--targetable` halo AND becomes directly clickable — the click routes through the SAME selector option action (`creatureSelectorAction`), so resolution stays exactly-once by construction. In targeting mode the modal scrim passes pointer events through and the selector panel docks to the right edge, keeping the board visible; the panel remains the list/keyboard path. Highlights and the pick hook clear in `closeModal` (single choke point) and on resolution.

The E2E caught the design flaw that motivated the dock: the full-screen scrim physically blocked board clicks — "diegetic targeting" was impossible until the scrim yielded. Presentation-only change, gated to targeting mode, classic untouched.

**Ownership cues** asserted in-material: `selector-yours` options render with the gold border, `selector-enemy` with plum (the 9a material variants).

**Selected hand state**: `state.selectedCard` flows into the shell (`update(G, { selectedCard })`) and renders as a gold-lift halo on the fanned card.

**Timer surface**: `#aaa-timer` chip under the turn token; the classic `updateTimer` mirrors the same clock string into it each tick (single clock authority).

## Evidence

- New `aaa-selectors` E2E **3/3**: (1) Soul Siphon selector — ownership cue colors, highlight count == legal targets, diegetic board-click pick, modal closed + highlights cleared + drain landed exactly once; (2) optional-trigger fixture in aaa mode — stage mounted, Escape inert, first option resolves once, no re-resolution path; (3) timer chip advances with the fake clock and equals the classic `#d-time` string.
- Full E2E **81/81**, visual **27/27** (classic hashes intact), units **601/601**, build clean.

## Next (Phase 9c)

Coin flip as a 3D coin preserving result timing; trigger/cast/set reveals; results screens; graveyard browser; rules overlay — all in the AAA material with dismissal-timing/backdrop/key contracts asserted.

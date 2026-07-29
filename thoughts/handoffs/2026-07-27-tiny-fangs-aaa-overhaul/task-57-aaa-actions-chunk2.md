# Task 57 — Phase 8 Chunk 2: All Six Actions Verified End-to-End in the AAA Shell

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## What landed

`tests/e2e/aaa-actions.spec.js` (5/5) completes the six-action coverage the chunk 1 handoff left open. Every flow drives the game exclusively through the AAA rail against the live rival AI under the deterministic fake clock, and asserts both the engine state AND its AAA-board mirror:

1. **Set** — waits for an affordable set verse, places it via the rail modal, asserts `me.setVerse` present, the verse gone from hand, and exactly one **opaque face-down back** on the me.set quad (no title text — the §7.4 own-set surface stays identity-free on the board).
2. **Cast** — resolves through the engine including any follow-up target-selection modal (settled generically), asserts the verse leaves the hand and the grave count chip mirrors the projected grave.
3. **Retreat** — builds an active+bench shape with defensive summons, retreats through the bench-choice modal, asserts the active uid swapped and the new active's name is on the me.active quad chassis.
4. **Attack** — reaches an attack-legal turn (post-first-turn, active present), attacks from the rail, asserts damage landed (rival hearts or creature/grave delta) and the hearts rail mirrors any LP change.
5. **Hand edge case** — lets the hand grow to 7+ by drawing, asserts the fan count tracks the projected hand exactly and every fanned card's bounding box stays inside the 1672-px frame.

Test-hardening lesson recorded: passively passing turns **loses to the rival AI** before board shapes form (first run: `winner: 1` mid-test). The adaptive loops now summon whenever possible (`summonIfPossible`) while advancing — the tests play the game to test the game.

## Evidence

- New `aaa-actions` E2E **5/5**; combined with chunk 1's `aaa-shell` 3/3, all six actions have full-flow AAA evidence.
- Full E2E **70/70** (classic input/responsive, multiplayer, overlays, solo-setup all green).
- Visual **27/27** (classic hashes + §12 rows + chassis intact). Units **601/601**. Build clean.

## Remaining for Phase 8 (chunk 3)

Card-click detail interactions on board cards (inspect/detail surface in the AAA world); ownership cues polish; contrast, touch-size (≥40px targets — action rail buttons are 40px min-height, verify all interactive surfaces), and keyboard-focus checks per the acceptance list; §12 rows measured on the live shell composition (with cards from a real game rather than the harness layout).

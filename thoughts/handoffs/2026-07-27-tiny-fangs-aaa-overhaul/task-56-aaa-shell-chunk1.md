# Task 56 — Phase 8 Chunk 1: The AAA Shell Runs the Real Game

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## What landed

The `aaa` presentation flag now mounts a live game shell, not a harness:

- **`src/presentation/aaa-shell.js`** — mounts the meadow scene (locked camera, all §12-calibrated terrain) behind the real solo game inside `#aaa-stage`; renders every zone of the projected client state onto the camera-lock golden quads with the shared card chassis (active/bench/set/deck/grave for both sides, face-down privacy for the rival Set — opaque presence only); variable-size hand fan (spacing/tilt scale with count); quiet edge rails: LP hearts, mana pips, rival hand count, turn token, deck/grave count chips, status charms (psn/trp/frt), a log rail mirroring the shell log, and a six-action rail (Summon/Attack/Cast/Set/Retreat/End Turn).
- **Action authority unchanged**: every rail button and hand-card click delegates to the SAME `doSummon/doCast/doSet/doAttack/doRetreat/endTurn` functions the classic buttons call — modals, validation, and `shared/engine.js` dispatch are untouched. Affordability mirrors `updateButtons()` (single source of truth) by reading the classic buttons' disabled states after each render.
- **`src/presentation/dom/board-card-mount.js`** — the Phase 7 harness card mount (scale-aware stock, directional shadows, homography) extracted to a shared module; `board-page.js` now consumes it (visual gates re-verified green after the dedupe).
- **`src/presentation/scene/golden-quads.js`** — camera-lock quads transcribed to a runtime module (provenance-commented; never regenerated from a live camera).
- **`index.html`** — one hidden `#aaa-stage` div; classic markup untouched. **`src/presentation/aaa-shell.css`** — all styling gated under `[data-presentation="aaa"]`; classic mode loads no visible change (classic visual hashes verified).
- **`src/main.js`** — `renderAaaShell()` at the end of `render()`: creates the shell lazily in aaa mode, updates it from the same projected state, mirrors affordances. Scene failure downgrades to classic (never blocks gameplay).

## Evidence

- **New E2E (`tests/e2e/aaa-shell.spec.js`, 3/3)**: deterministic solo start in aaa mode (stubbed random + fake clock through coin flip/first-turn choice), then: (1) meadow canvas + quad cards + hand fan + every information surface present, classic shells hidden, first-turn attack disabled via the mirrored affordance; (2) **summon through the AAA rail** → classic modal → engine dispatch → creature standing on the me.active quad with its name on the chassis; (3) **end turn** → rival AI turn on the fake clock → control returns, turn ≥ 2.
- Full E2E 65/65 (classic input/responsive regressions + multiplayer + overlays all green — classic behavior unchanged).
- Visual 27/27 (classic hashes + §12 meadow + board + chassis). Units 601/601. Build clean.

## Remaining for Phase 8 (next chunks)

Cast/Set/Retreat/Attack full-flow E2E in the AAA shell (targeting modals, set placement, retreat bench choice); card-click interactions on board cards (detail/inspect); hand edge cases beyond fan math (8+ cards, zero cards visual); ownership cues polish; contrast/touch-size/keyboard-focus checks per the acceptance list; §12 rows measured on the live shell composition.

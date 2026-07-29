# Task 29 — Phase 4 Keyed Rendering: Active and Bench Zones Wired

**Date:** 2026-07-28
**Branch:** `feat/cel-shaded-field`
**Scope:** Second zone-by-zone wiring step: all four active containers (`m-my-active`, `m-opp-active`, `d-my-active`, `d-opp-active`) and all four bench containers (`m-my-bench`, `m-opp-bench`, `d-my-bench`, `d-opp-bench`) now render through the uid-keyed reconciler. Classic pixels are unchanged.

## What changed

1. **`src/main.js`.** Active zones reconcile a single-slot view-model: the creature's uid with `renderActiveCard` markup when occupied, or a stable synthetic `__empty__` uid with the byte-identical empty-slot markup when vacant. Bench zones reconcile exactly the two slots `renderBench` composed: card uid + `renderMiniCard` markup when filled, `__empty-<slot>__` + `<div class="card-empty"></div>` when not. Markup strings are unchanged; the only DOM delta is `data-uid`, which nothing styles or selects.
2. **Engine-side uid root-cause fix (predicted by the Task 28 handoff).** All five remaining `Math.random()`-only uid generation sites now carry the same monotonic serial suffix as `src/state.js`: `shared/engine.js` `uid()`, both token-spawn sites in `shared/effects.js`, `createCreature`/`createVerse` in `src/game.js`, and the client Antling spawn in `src/abilities.js` (now reusing the `state.js` generator). Engine-created cards (Antling, tokens) reach the keyed bench zones, and the reconciler fails closed on duplicates — uniqueness is now guaranteed even under stubbed `Math.random`. No test or fixture asserts uid format; authored `visual-*` fixture uids are untouched.

## Deliberate semantics

- **Per-zone identity only for now.** A card retreating from active to bench crosses two keyed views, so it is removed/created rather than adopted. Cross-zone DOM adoption for FLIP travel belongs to the Phase 10 motion director; the Phase 4 gate is rendering parity.
- **Patch short-circuit vs. old rebuilds.** The old `innerHTML` rebuild incidentally wiped runtime-added animation classes on every render; the keyed patch skips nodes whose rendered html is unchanged, so an animation class removed only by re-render would now linger. All current Anim classes are removed by the animation code itself (verified: anim/effects only add/remove their own overlay elements and self-cleaned classes), and every gate below is green. Watch this seam when the Phase 10 motion wrappers land.

## Evidence

- Units: **573/573**.
- Desktop/solo E2E: **59/59**.
- Visual project: **11/11**, classic-capture manifest test asserts all **17 classic screenshot records (pngHash included) equal the committed baseline** — byte-identical.
- Multiplayer project: **8/8** (opponent active/bench render through the same keyed path).
- Server-process suite: **17/17** (server consumes the changed `shared/engine.js`/`shared/effects.js`).
- Isolated production build passed; `tldr diagnostics` 0 errors / 0 warnings on all five changed source files.

## Next zone step

- Remaining: set-verse slots (single-slot `outerHTML` replacement with fixed ids — needs a decision between a keyed single-node adapter and deferral to Phase 8 recomposition), log, and the textContent-only zones (deck/grave/stats counters) which may only need audit + explicit exemption since they render no card nodes; then the actions row; then desktop/mobile DOM-tree unification after full parity.

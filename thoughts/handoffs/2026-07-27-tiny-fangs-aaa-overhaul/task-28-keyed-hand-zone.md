# Task 28 — Phase 4 Keyed Rendering: Hand Zones Wired

**Date:** 2026-07-28
**Branch:** `feat/cel-shaded-field`
**Scope:** First zone-by-zone wiring step of the Phase 4 keyed-board migration: both hand containers (`m-hand`, `d-hand`) now render through the uid-keyed reconciler instead of destructive `innerHTML` rebuilds. Classic pixels are unchanged.

## What changed

1. **`src/presentation/dom/html-keyed-view.js` (new).** `createHtmlKeyedView(container, { parseHtml })` adapts the Phase 4 reconciler (`createKeyedListView`) to zones whose markup is produced as template strings by `src/render.js`. `create` parses the rendered string once; `patch` syncs attributes and inner content in place (never touching reconciler-owned `data-uid`), so a card keeps one DOM node across re-renders. Unchanged html short-circuits without parsing. The parser is injectable for unit testing in the node environment; the browser default uses a `<template>` element.
2. **`src/main.js`.** `keyedZoneView(containerId)` lazily creates (and rebinds if a container node is ever replaced) one html-keyed view per zone container. The two hand render lines now reconcile `{ uid, html: renderHandCard(...) }` view-models. Markup is byte-for-byte the same `renderHandCard` output; the only DOM delta is the `data-uid` attribute, which no CSS or test selects for styling.
3. **`src/state.js` — root-cause fix surfaced by the fail-closed reconciler.** `uid()` derived identity purely from `Math.random()`. The classic-responsive E2E stubs `Math.random = () => 0.1` for determinism, so every solo card received the *same* uid; the old innerHTML path silently tolerated that, the keyed path correctly refused to render (duplicate-uid fail-closed) and exposed the latent defect. `uid()` now appends a monotonic serial (`<random>-<serial36>`), guaranteeing uniqueness even under stubbed randomness. No format assumptions exist anywhere (verified: no slicing/parsing of uids; fixture uids are hand-authored `visual-*` strings and unaffected).
4. **`tests/presentation/html-keyed-view.test.js` (new, 8 contracts).** Ordering, no-op patch short-circuit, in-place attribute/content patch with preserved identity, stale-attribute removal that spares `data-uid`, identity across reorder+change, re-parse after remove/recreate, clear() cache reset, fail-closed empty parse.
5. **`tests/e2e/desktop-overlay-results.spec.js` — pre-existing flake fixed in the test only.** The solo deck-out journey picked "the first creature in hand∪deck" from a genuinely shuffled deck; multi-event attackers (Cindermaw's Frenzy double attack, Pulsefin's extra ability trigger) have playback longer than the test's fixed 2 500 ms fake-clock budget, so the result overlay hadn't opened yet. Proven pre-existing at HEAD `5e36698` (fails ~1/5 isolated, creature-correlated 7/7 in instrumented runs; every Cindermaw run failed, every Emberfang run passed). The test now deterministically selects Emberfang (always present in the Fang deck, single attack + lpDamage playback). No assertion was weakened — the playback-gating and victory assertions are intact. Same pattern as the Task 25 test-only determinism fixes.

## Evidence

- Units: **573/573** (36 files; +8 new adapter contracts).
- Desktop/solo E2E: **59/59** including the previously flaky deck-out journey at **8/8 consecutive** runs after the determinism fix.
- Visual project: **11/11**, including the classic-capture manifest test that asserts every one of the **17 classic screenshot records — pngHash included — equal to the committed baseline** (byte-identical).
- Multiplayer project: **8/8** (hand rendering is shared with the multiplayer client path).
- Isolated production build passed; `tldr diagnostics` clean on changed source files.
- Bisection evidence: pure-HEAD worktree run proved the deck-out flake predates this change (1/5 isolated failures at HEAD with zero page/console errors; stall located in pre-render event playback with `winner` still null).

## Notes for the next zone step

- Remaining zones to wire: active, bench, set, deck/grave/stats (textContent zones), log, actions — then the desktop/mobile DOM-tree unification only after full parity.
- `shared/engine.js` and `shared/effects.js` still generate uids from bare `Math.random()` (`toString(36)` slices). Engine-created cards (e.g., Antling) will hit the same duplicate-uid fail-closed path once **bench/active** zones go keyed under stubbed-randomness tests. Apply the same monotonic-suffix root-cause fix there *in that step*, and re-verify the 17 classic hashes (engine uids are runtime-only; fixture uids are authored constants, so hashes should be unaffected).
- Set-verse zones use `outerHTML` replacement with fixed element ids (`m-my-set` etc.) — they are single-slot, not lists; decide between a keyed single-node adapter or leaving them for the Phase 8 recomposition.

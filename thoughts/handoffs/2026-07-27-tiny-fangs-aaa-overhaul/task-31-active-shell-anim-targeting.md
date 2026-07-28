# Task 31 — Phase 4 Closure: Active-Shell Animation Targeting

**Date:** 2026-07-28
**Branch:** `feat/cel-shaded-field`
**Scope:** Final Phase 4 acceptance item — "animation targeting no longer searches hidden duplicate trees" — plus the Phase 3 remainder of wiring the semantic `TargetRegistry` into the live game path. Includes a recorded scope decision on the literal one-DOM-tree merge.

## What changed

1. **`src/anim.js` — every dual-shell selector literal is gone.** All ~20 sites of the form `'#m-… , #d-…'` now resolve through new semantic helpers (`activeCardEl`, `lpEl`, `setSlotEl`, `benchContainerEl`, `benchCardEl`, `benchCardEls`, `manaPipContainer`) backed by the Phase 3 shell-aware `createTargetRegistry`. `playOn(querySelectorAll)` over both trees is replaced by `play(element)` on the active shell's element only; missing targets stay safe no-ops (Task 18 contract). Position caching (`cacheActivePositions` / `getAnimPosition`) uses the same resolution via a new `centerOf(el)`. The registry instance is rebuilt whenever `globalThis.document` changes, so unit stand-ins keep working.
2. **Mana pips.** These are a desktop-only affordance; the old code animated `#d-mana-pips` even when the mobile shell was active (a hidden-tree write). `manaPipContainer()` resolves `me.mana` semantically and animates only when the active shell actually renders pips — desktop behavior byte-identical, mobile no longer touches the hidden desktop tree.
3. **`src/event-playback.js`.** `playSemanticBench` and `setStatus` use `Anim.benchContainerEl` / `Anim.activeCardEl` with the existing defensive typeof guards instead of dual selector strings.
4. **`src/presentation/dom/target-registry.js`.** Additive: `me.bench` / `opp.bench` container names (the map previously had only the two indexed slots per side).
5. **Tests.** The three Task 16-era dual-shell contract groups in `behavior-order-characterization.test.js` are updated to the sanctioned Phase 4 target state — they now assert the exact semantic call (`activeCardEl(side)`, `benchCardEl(side, index)`, `benchContainerEl(side)`) and the single active-shell element played, which is a stronger contract than the old both-trees selector equality (the hidden tree must now be untouched). New `tests/presentation/anim-semantic-targets.test.js` (6 contracts) drives the resolution itself over a two-shell document stand-in: desktop/mobile selection, exact nth-child bench index math, scoped active-card query, per-shell set slots, mana-pip gating, and no-document safety.

## Scope decision — literal single-DOM-tree merge: DEFERRED to the mobile port (flagged for user review)

The plan's Phase 4 checklist ends with "Unify mobile/desktop into one responsive DOM tree." The three Phase 4 **acceptance criteria** — stable card DOM identity, unchanged interactions, and animation targeting that no longer searches hidden duplicate trees — are all now met and evidenced. Physically merging the two shell trees today would require rebuilding the mobile layout as responsive styling of one tree, which (a) is exactly the deferred mobile/tablet port the ledger already postpones until after desktop acceptance, (b) risks the 17 byte-identical classic hashes for zero desktop-milestone value, and (c) would churn every `m-*` E2E selector that currently serves as deferred-port regression evidence. The merge is therefore recorded as part of the deferred mobile port (Phase 12/13 window) rather than silently dropped. If the single-tree merge should instead happen now, say so and it becomes the next Phase 4 task.

## Evidence

- Units: **580/580** (37 files; 6 new semantic-targeting contracts, 14 updated to the stronger active-shell assertions).
- Desktop/solo E2E: **59/59**. Visual: **11/11** with all 17 classic screenshot records (pngHash included) equal to the committed baseline. Multiplayer: **8/8**. Server-process: **17/17**.
- Isolated production build passed; diagnostics 0/0 on all changed files.

---
date: 2026-07-27T16:07:15-04:00
task_number: 03
task_total: 16
status: success
---

# Task Handoff: Deterministic Fixtures, Stable Serialization, and Visual Readiness

## Task Summary

Add the Phase 1 deterministic visual-state foundation: authoritative fixture states, privacy-aware canonical serialization, the exact visual-readiness lifecycle, and a harmless query-gated QA bootstrap contract. Do not replace game state or visuals yet.

## What Was Done

- Added ten deterministic visual fixtures built from `shared/engine.js#createGame()` and the authoritative card catalog rather than hand-authored card-shaped objects.
- Normalized factory-generated random UIDs into deterministic, per-side/per-card copy UIDs while retaining all 20 real deck cards for each player.
- Covered:
  - empty opening board;
  - creature/cast/set opening hand;
  - dense active/bench/Set board;
  - poison, trapped, fortified, and unbreakable;
  - target selection;
  - resolved KO and promotion;
  - graveyard, rules, card-detail, and trigger-reveal intent;
  - victory, defeat, and an unambiguous deck-out;
  - hidden multiplayer hand/Set markers.
- Added canonical JSON hash input that sorts object keys, preserves array order and deterministic UIDs, strips functions and nondeterministic time fields, rejects circular state, and collapses hidden values to opaque markers.
- Added fixture privacy metadata that redacts the opponent deck, hand, and face-down Set before canonical serialization, preventing the hidden Set identity from being inferred through a duplicate in another private zone.
- Added one dependency-injected readiness controller for exact `window.__TINY_FANGS_VISUAL_READY__`.
- Readiness starts and resets to `false`, supports exact `fixture`, `viewport`, `quality`, and `route` resets, rejects stale completion after a reset, and becomes `true` only after registered work, `document.fonts.ready`, and two awaited animation frames.
- Added a `?visualQa=1` bootstrap contract that exposes only the frozen fixture-name catalog and readiness controller/promise. It does not expose fixture state or replace gameplay state.
- Split the lightweight fixture-name catalog from the engine-backed builders so normal bootstrap does not pull the fixture engine graph solely to list names.

## Files Modified

- `src/main.js:35-38` - Installs the inert QA contract after the existing presentation mode gate.
- `src/presentation/testing/visual-fixture-names.js:1-16` - Frozen canonical fixture-name catalog.
- `src/presentation/testing/fixture-registry.js:1-339` - Authoritative deterministic fixture builders and registry.
- `src/presentation/testing/stable-serialization.js:1-105` - Canonical, privacy-aware hash-input serialization.
- `src/presentation/testing/visual-readiness.js:1-95` - Reset-safe readiness controller and exact global contract.
- `src/presentation/testing/visual-qa-bootstrap.js:1-39` - `?visualQa=1` names/readiness bootstrap.
- `tests/presentation/visual-fixtures.test.js:1-179` - Fixture completeness, determinism, validity, scenarios, and privacy metadata.
- `tests/presentation/stable-serialization.test.js:1-80` - Stable ordering, nondeterministic field removal, hidden redaction, UID preservation, and circular-state rejection.
- `tests/presentation/visual-readiness.test.js:1-133` - Readiness ordering, exact global, all reset causes, stale completion, and rejection behavior.
- `tests/presentation/visual-qa-bootstrap.test.js:1-49` - Exact query gate and no-state QA exposure.
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-03-fixture-readiness.md` - This handoff.

## Decisions Made

- **Authoritative state:** Every fixture starts from `createGame()` and redistributes its real factory-created deck objects. No fixture invents cards or bypasses card definitions.
- **Determinism:** Card ordering uses explicit JavaScript code-unit comparison rather than locale-sensitive sorting; random factory UIDs are replaced by stable fixture UIDs.
- **Valid overlays:** Modal, target, transition, camera, and result intent lives under `presentation`; engine state remains valid `G`.
- **Distinct deck-out:** The losing player has an empty deck but still has life remaining, so deck-out is not confounded with final-life defeat.
- **Privacy:** The multiplayer fixture keeps a real face-down Set in authoritative `G`, while serialization replaces all opponent-private zones with explicit opaque markers.
- **Canonical text, not hashing:** `toStableHashInput()` returns deterministic JSON text. It introduces no crypto package and leaves digest selection to the capture harness.
- **Readiness reset semantics:** Registering new work and each supported reset invalidate prior completion. A completion attempt whose generation changes returns `false` and cannot publish stale readiness.
- **QA isolation:** Without exact `visualQa=1`, no QA global or readiness global is installed. The query is only read, so `?ws=` and other parameters remain untouched.

## TDD Verification

- [x] Tests were written before implementation.
- [x] Initial RED: the four focused suites failed because all four production modules were absent.
- [x] Privacy GREEN correction: the first implementation exposed a concealed Set ID through another private zone; explicit opponent deck/hand/Set privacy paths fixed it.
- [x] Deck-out RED/GREEN: a follow-up test proved deck-out was conflated with zero life, then the fixture was corrected to retain one life.
- [x] Focused suite: 30/30 tests passed across four files.
- [x] Full default Vitest suite: 361/361 tests passed across 21 files after Task 02 added its owned Playwright/server-process exclusions.
- [x] Server lifecycle suite: 8/8 passed outside the sandbox after the in-sandbox run hit expected localhost `EPERM`.

## Code Quality

- `tldr diagnostics` reported 0 errors and 0 warnings for all five Task 03 production modules, `src/main.js`, and all four Task 03 test files.
- `node --check` passed for every Task 03 source and test file.
- `git diff --check` passed.
- No package, Playwright, server, shared-engine, renderer, stylesheet, documentation, or Task 01/02-owned file was edited by Task 03.
- No files were staged or committed.

## Build Verification

- `npm run build -- --outDir /private/tmp/tiny-fangs-task03-build.nLbT0m/dist --emptyOutDir` passed with Vite 6.4.1.
- Final output: 17.19 kB HTML, 48.39 kB CSS, 151.51 kB JavaScript before gzip.
- Build output stayed outside the repository.

## Concurrent Worktree Notes

- The shared worktree contains concurrent Task 01, Task 02, and Task 04 changes, including package/config, server/shared-engine, renderer, stylesheet, tests, dependencies, and generated assets.
- Task 03 did not modify those files.
- Task 02 initially placed Playwright `.spec.js` files where bare Vitest collected them. This was coordinated directly; Task 02 now owns targeted exclusions in `vite.config.js` and the default suite passes.
- Task 04 confirmed its explicitly excluded full unit set passed 369/369 during concurrent work.

## Next Task Context

- A capture harness can call `createVisualFixture(name)`, serialize it with `toStableHashInput(fixture)`, then feed the fixture through the future presentation adapter.
- On fixture, viewport, quality, or route changes, call `readiness.reset(reason)`, register all current-view asset/shader/layout promises, and call `waitUntilReady()`.
- Do not treat bootstrap readiness alone as proof that future Three.js assets are ready; those resources must register their promises after each reset.
- Keep fixture presentation metadata separate from `G` when adding attack, retaliation, multi-hit, optional-trigger, or Skitter-response animation fixtures later.

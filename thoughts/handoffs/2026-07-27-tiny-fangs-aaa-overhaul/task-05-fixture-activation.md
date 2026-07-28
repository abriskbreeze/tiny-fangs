---
date: 2026-07-27T16:27:49-04:00
task_number: 05
task_total: 16
status: success
---

# Task Handoff: Safe Fixture Activation and Capture-Harness Seam

## Task Summary

Make registered deterministic fixtures safely activatable in the existing classic client renderer through exact `visualQa=1` gating, without changing normal/solo/multiplayer launches, adding another rules loop, or exposing opponent-private fixture state. Add a browser-independent capture manifest record for later Playwright screenshot work.

## What Was Done

- Added a pure authoritative-fixture-to-client adapter that reuses the existing `sharedToClientState()` bridge.
- Deep-cloned fixture `G`, produced the exact current classic client shell, translated engine winner indices to `You`/`Rival`, and marked the state as a non-multiplayer visual fixture.
- Projected opponent deck and hand to counts/empty arrays and opponent Set to exact opaque presence before fixture state reaches the client renderer.
- Added a query-gated activation controller that:
  - dynamically imports registered fixture builders only when activation is requested;
  - prepares and validates the complete fixture/client/hash result before mutating runtime state;
  - replaces state only through existing `clearGame()` and `setGame()`;
  - resets readiness for both fixture and route changes;
  - hides the existing setup route, clears stale overlays, calls the existing `render()`, then waits for fonts and two frames through the Task 03 readiness controller;
  - returns deterministic `{ fixture, ready }` results.
- Extended `window.__TINY_FANGS_VISUAL_QA__` with:
  - `activateFixture(name)`;
  - `currentFixture`, whose exact metadata is `{ name, stableHashInput }`;
  - `activationError`;
  - a live `ready` promise getter.
- Added automatic startup activation for `?visualQa=1&fixture=<registered-name>`.
- Added safe invalid-query handling: no game replacement, no render, readiness stays false, and the error is exposed without an unhandled rejection.
- Added a browser-independent capture manifest helper recording viewport, DPR, presentation mode, fixture name, canonical fixture hash input, a fixture-hash placeholder, and a browser placeholder.

## Files Modified

- `src/main.js:38-45,693-702` - Injects the existing state setters/renderer and the minimal classic route cleanup into the QA bootstrap.
- `src/presentation/testing/fixture-client-adapter.js:1-53` - Pure authoritative-to-client conversion with opponent privacy projection.
- `src/presentation/testing/fixture-activation.js:1-94` - Gated, transactional-before-mutation activation controller and privacy-safe metadata.
- `src/presentation/testing/capture-manifest.js:1-55` - Browser-independent manifest record helper and placeholders.
- `src/presentation/testing/visual-qa-bootstrap.js:1-74` - Manual/automatic activation and live QA metadata/readiness/error contract.
- `tests/presentation/fixture-client-adapter.test.js:1-95` - Exact client shell, privacy, cloning, winner mapping, and malformed-state coverage.
- `tests/presentation/fixture-activation.test.js:1-146` - Runtime call order, privacy, invalid-name safety, gating, idempotence, and connection validation.
- `tests/presentation/capture-manifest.test.js:1-62` - Deterministic record, provenance completion, freezing, and input validation.
- `tests/presentation/visual-qa-bootstrap.test.js:1-122` - Disabled isolation, public contract, automatic activation, and invalid-query safety.
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-05-fixture-activation.md` - This handoff.

## Decisions Made

- **Existing bridge:** The fixture adapter calls `sharedToClientState()` rather than creating a parallel rules or state conversion path.
- **Privacy before render:** The client receives no opponent hand/deck identities and only `{ faceDown: true }` for an occupied opponent Set.
- **Privacy-safe hash input:** QA metadata canonicalizes all opponent-private zones to opaque markers, including fixtures that did not previously declare multiplayer privacy metadata.
- **Mutation boundary:** Fixture loading, adaptation, and canonicalization all complete before readiness reset or state mutation. Invalid names therefore leave the current game and ready state untouched.
- **Existing state lifecycle:** Valid activation calls `clearGame()` before `setGame()`, which also disposes current timers and selected-card state.
- **Lazy fixture graph:** The registry is a dynamic QA-only chunk. Normal startup retains the light name/readiness bootstrap and never loads fixture builders.
- **Readiness order:** `fixture` reset → clear/set state → `route` reset → show route → existing render → registered work/fonts/two frames.
- **Capture provenance:** SHA-256 and browser identification remain explicit `pending` placeholders until the Playwright runner supplies environment-specific values; the canonical fixture input is retained for that runner.
- **Overlay scope:** Task 05 activates deterministic board state. Task 03 overlay intent metadata remains available for later dedicated overlay fixture playback; this task does not invent a second overlay/router system.

## TDD Verification

- [x] Tests were written before production changes.
- [x] RED observed: three suites failed on missing modules; the existing bootstrap suite failed on absent activation/current-fixture behavior.
- [x] GREEN focused suite: 25/25 tests passed across the four Task 05 files.
- [x] All presentation tests: 64/64 passed across 9 files.
- [x] Full default Vitest suite: 383/383 passed across 24 files.
- [x] Server-process suite: 9/9 passed outside the sandbox; the first sandboxed run failed only on expected localhost `EPERM`.
- [x] Refactoring retained GREEN.

## Browser Smoke

Headless Chromium loaded:

`http://127.0.0.1:4175/?visualQa=1&fixture=dense-board-statuses&presentation=classic`

Verified:

- exact Shellkin and Hexweaver active cards rendered;
- readiness became `true`;
- repeated activation retained identical canonical metadata and identical desktop DOM;
- invalid activation returned the expected error and preserved the prior board;
- the hidden multiplayer Set rendered face-down while `phantomWall`, its UID, and display name were absent from public metadata;
- `currentFixture` contained exactly `name` and `stableHashInput`;
- no console errors occurred.

A separate launch with `fixture=dense-board-statuses` but without exact `visualQa=1` exposed neither QA nor readiness globals and left setup visible.

## Code Quality

- `tldr diagnostics` reported 0 errors and 0 warnings for all Task 05 production/test files and `src/main.js`.
- `node --check` passed for every Task 05 JavaScript source and test file.
- `git diff --check` passed.
- No package/lock, server, shared-engine, Playwright, renderer, stylesheet, documentation, or Task 02/04-owned file was edited.
- No files were staged or committed.

## Build Verification

- `npm run build -- --outDir /private/tmp/tiny-fangs-task05-build.pvDlx7/dist --emptyOutDir` passed with Vite 6.4.1.
- Vite emitted fixture builders as a separate lazy `fixture-registry` chunk: 4.49 kB raw / 1.72 kB gzip.
- Main output: 157.91 kB raw / 44.86 kB gzip.
- Build output stayed outside the repository.

## Patterns/Learnings for Next Tasks

- Use `window.__TINY_FANGS_VISUAL_QA__.activateFixture(name)` and wait for exact `window.__TINY_FANGS_VISUAL_READY__ === true`.
- Read `currentFixture.stableHashInput`, calculate the pinned SHA-256 in the capture runner, then call `createCaptureManifestRecord()` with that digest and the actual browser identifier.
- Keep route/quality/viewport resources registered through the existing readiness controller after their corresponding reset.
- Do not reach into module-private `state` from Playwright; the public QA contract intentionally exposes only fixture identity/hash input.
- Apply Task 03 presentation overlay metadata through existing modal/result functions in a later focused task rather than expanding the activation controller into a second router.

## Concurrent Worktree Notes

- The shared worktree still contains concurrent Task 01/02/04 and visual prototype changes.
- Task 05 did not modify or revert those changes.

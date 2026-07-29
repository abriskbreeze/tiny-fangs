---
date: 2026-07-27T17:42:30-04:00
task_number: 20
status: success
---

# Task Handoff: Authoritative Desktop Timer Lifecycle

## Task Summary

Replaced the split solo/multiplayer clock behavior with one authoritative root
timer lifecycle. Solo and multiplayer now start, read, stop, and reset the same
`state.startTime` / `state.timerInt` owner. Authoritative multiplayer state
replacement cannot reset elapsed time or create another interval.

The classic desktop lane at 1672×941 directly proves 0:00 → 1:01, identical
desktop/mobile-shell timer text from one source, one interval across state
replacement and repeated starts, terminal freeze, and clear/unmount disposal.
Injected multiplayer contracts cover result, reload action, opponent departure,
unexpected disconnect, Back, mode change, repeat connection, and no nested timer
metadata in `G`.

This task made no visual, render, stylesheet, card, engine, fixture, server,
package, workflow, matrix, or goal-ledger changes. Task 09 and Task 14 input
behavior was preserved.

## What Was Done

- Added a narrow root lifecycle API:
  - `readGameElapsedSeconds(now)`
  - `startGameTimer(onTick)`
  - `stopGameTimer()`
  - `resetGameTimer()`
- Made `clearGame()` delegate timer disposal/reset to the same owner.
- Made timer stop idempotent with an explicit `null` handle check.
- Made each new start stop the old owner before creating one interval.
- Ran the first tick immediately, so mounted output begins at `0:00`.
- Routed solo start, read, and terminal result through the root API.
- Injected the same root lifecycle into `createMpClient`.
- Removed multiplayer's nested `G.startTime`.
- Kept multiplayer state replacement timer-neutral.
- Stops multiplayer timing on:
  - game over;
  - opponent departure;
  - unexpected socket close.
- Clears the complete owner before:
  - Return to Menu reload actions;
  - Back;
  - mode change.
- Added controlled socket replacement. The previous socket's four assigned
  handlers are detached before close, so repeated connection/mode routes retain
  one current socket-adjacent listener set.
- Updated the obsolete split-timer characterization to assert the corrected
  root-owner contract.
- Added dedicated root/MP unit tests and mounted desktop fake-clock tests.

## Files Modified

- `src/state.js:30-60`
  - Adds the authoritative lifecycle API and routes `clearGame()` through reset.
- `src/main.js:2-12,65-90,742,776-780,1955-1958`
  - Injects the owner into MP, uses it for solo start/read/result, and keeps both
    displayed timer fields on the same elapsed-seconds source.
- `src/mp-client.js:34-76,131-140,208-220,386-396,418-463`
  - Uses the injected root owner; disposes on every scoped MP terminal/exit
    route; replaces sockets without stale assigned handlers.
- `tests/presentation/game-timer-lifecycle.test.js:1-335`
  - Dedicated root-owner and injected MP lifecycle contracts.
- `tests/e2e/timer-lifecycle.spec.js:1-160`
  - Mounted 1672×941 classic desktop timer ownership/result/clear contracts.
- `tests/presentation/behavior-order-characterization.test.js:603-635`
  - Replaces the now-obsolete known-gap expectation with the corrected contract.
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-20-timer-lifecycle.md`
  - This handoff.

## Decisions Made

- **Root state is the only clock authority.** `G` remains replaceable gameplay
  state. Timer metadata is neither written to `G` nor copied into server
  projections/fixtures.
- **Stop and reset are different.** Terminal result/disconnect calls stop,
  leaving the final elapsed source available. Clear/unmount/back/mode/reload
  actions reset the source.
- **State replacement is timer-neutral.** `setGame()` and MP
  `processUpdate()` touch only `G`.
- **Immediate presentation tick.** Starting writes both outputs as `0:00`
  immediately, then updates once per second.
- **No second runtime.** MP receives the mounted main lifecycle through its
  existing dependency bag.
- **Socket replacement is controlled.** Explicit exits detach the assigned
  socket callbacks before close; unexpected close retains its callback long
  enough to stop the timer and expose disconnect status.
- **Desktop scope only.** The mounted test uses the required 1672×941 viewport.
  It asserts both legacy shell outputs share one source, but it does not claim a
  mobile presentation port or mobile viewport acceptance.
- **No visual critic needed for this lane.** There were no visual changes; the
  result is functional lifecycle infrastructure for the later AAA presenter.

## TDD Evidence

### RED

The dedicated contract was written before production changes:

```text
npx vitest run tests/presentation/game-timer-lifecycle.test.js
6 tests failed
```

Authoritative failures:

- root cases: `startGameTimer is not a function`;
- multiplayer cases: expected injected start/stop/clear lifecycle calls once,
  received zero.

The first Playwright RED attempts also exposed two test-harness defects
(`pauseAt` raced into the past and the card discriminator was `cardType`, not
`type`). Those harness defects were corrected without production changes before
browser GREEN was accepted.

### Focused GREEN

```text
npx vitest run tests/presentation/game-timer-lifecycle.test.js
1 file passed
6 tests passed
```

```text
npx vitest run \
  tests/presentation/game-timer-lifecycle.test.js \
  tests/presentation/behavior-order-characterization.test.js \
  tests/presentation/stable-serialization.test.js \
  tests/presentation/mp-endpoint.test.js \
  tests/presentation/mp-error-surface.test.js
5 files passed
35 tests passed
```

The stable-serialization suite confirms timer metadata is still absent from
fixture/projection hashes.

### Mounted Browser GREEN

```text
npx playwright test tests/e2e/timer-lifecycle.spec.js --project=e2e
2 passed
```

Direct evidence includes:

- exact 1672×941 viewport;
- initial `0:00` in both timer nodes;
- exact fake-clock `1:01` after 61 seconds;
- one active interval;
- no `startTime` / `timerInt` on `G`;
- root owner preserved across `setGame()` replacement;
- a second start replaces rather than accumulates the interval;
- solo result stops and freezes the display;
- `clearGame()` disposes and resets the mounted owner.

### Affected Solo/MP Browser GREEN

```text
npx playwright test \
  tests/e2e/timer-lifecycle.spec.js \
  tests/e2e/multiplayer/lifecycle-authority.spec.js
6 passed
```

The existing real WebSocket suite remained green for Back/re-entry, room
cleanup, disconnect, closed-client isolation, and authoritative game actions.

## Full Verification

```text
npm test -- --run
33 files passed
544 tests passed
```

```text
npx vite build --outDir /private/tmp/tiny-fangs-task20-build-20260727
33 modules transformed
built in 313ms
```

- `tldr diagnostics` on all six changed source/test files: 0 errors, 0 warnings.
- `node --check` on all six changed source/test files: passed.
- Targeted `git diff --check`: passed.
- No files were staged or committed.

The browser run required the approved execution path because the managed
sandbox rejected the Vite loopback bind with `EPERM`.

## Behavior-Matrix Disposition

The parent owns the shared matrix and should apply the final edits after
concurrent lanes settle.

- **STA-12 — recommend `covered` for the scoped desktop contract.**
  The mounted fake-clock browser test proves one root owner, 0:00 → 1:01, both
  shell outputs, repeated start without accumulation, result stop, and clear.
  Mobile viewport acceptance remains explicitly deferred.
- **STA-13 — rewrite and keep `covered`.**
  The old known gap no longer exists. Suggested row summary:
  “Multiplayer starts the mounted root timer once; authoritative state
  replacement preserves elapsed time and never nests timer state under `G`.”
- **STA-14 — recommend `covered` for the scoped desktop lifecycle seam.**
  Root/injected tests cover result, reload action, Back, mode change,
  disconnect, opponent departure, clear/unmount, repeated starts, one interval,
  and one current assigned socket-listener set. Mobile viewport expansion
  remains deferred.
- **STA-10 — remain `missing` overall.**
  The Return to Menu action is directly proven to clear before calling reload,
  and repeated starts are clean, but no test follows an actual navigation
  through reload into a newly mounted page.
- **STA-11 — remain `missing` overall.**
  MP Back is clean, but the matrix row also includes the legacy solo
  `toggleMenu` placeholder and a complete solo menu route that still does not
  exist.

## Protected Concurrent Work

- Task 09 deck-preview and `pointercancel` bindings were not edited.
- Task 14 drag, hold, keyboard, and End Turn input regions were not edited.
- Task 11 Back cleanup semantics were retained:
  `gameMode`, room, host, deck, lobby fields, room code, waiting copy, and
  socket closure still reset. Task 20 only added lifecycle disposal and
  centralized the already-required socket close.
- No Task 17 responsive or Task 19 art-bible files were touched.

## Remaining Limitation

The owner is cleared synchronously before existing reload actions, but this task
does not intercept real browser navigation and assert the fresh post-reload
mount. That broader full restart journey remains STA-10 work. The timer itself
is not persisted, so a page reload naturally destroys the JavaScript realm; the
missing evidence is the full product route, not a surviving interval defect.

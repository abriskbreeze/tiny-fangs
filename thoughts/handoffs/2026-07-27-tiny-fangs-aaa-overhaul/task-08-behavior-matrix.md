---
date: 2026-07-27T16:35:38-04:00
task_number: 08
task_total: 16
status: success
---

# Task Handoff: Authoritative Behavior Matrix and Event-Order Characterization

## Task Summary

Inventoried the complete current solo, multiplayer, input, overlay, action, result, timer, debug, privacy, and responsive surface before the presentation replacement. Added a durable 103-contract matrix that distinguishes direct coverage from missing/manual evidence and added six focused Vitest characterizations for the two required ordering contracts plus four known presentation gaps.

No production, package, configuration, workflow, protected visual, reference-documentation, Task 05, Task 07, or goal-ledger file was edited.

## Files Added

- `tests/presentation/behavior-order-characterization.test.js`
- `thoughts/shared/tiny-fangs-behavior-matrix.md`
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-08-behavior-matrix.md`

## Behavior Matrix

`thoughts/shared/tiny-fangs-behavior-matrix.md` contains 103 individually statused contracts:

- 23 `covered`
- 79 `missing`
- 1 `manual-pending`

Each row records:

- the exact current journey or contract;
- its authoritative production source;
- direct existing automated evidence;
- the next direct test target;
- required viewport and input variants;
- privacy implications;
- status.

The matrix explicitly covers:

- all five decks and both Random choices;
- Pup and Hunter AI;
- Heads/Tails and first/second selection;
- Summon, Cast, Set, Attack, Retreat, and End Turn;
- affordability, active/bench/Set capacities, first-turn and per-turn restrictions;
- poison, trapped, fortified, unbreakable, KO, promotion, LP win, deck-out, and Last Breath;
- click/select, 15 px drag threshold, 400 ms inspection holds, 500 ms End Turn hold, and cancellation;
- `S/C/T/A/R/E`, `Escape`, and `Ctrl+0–9`;
- deck-preview `pointercancel`;
- graveyard, rules, card detail, target selectors, optional triggers, Skitter, reveals, results, restart, and menu;
- endpoint precedence, create/join/wait/ready/back, errors, disconnect, cleanup, and action authority;
- hidden hand/deck/Set projection and all browser/debug/asset surfaces;
- solo and multiplayer state/event ordering;
- timer ownership/disposal and debug output;
- responsive shell boundaries, viewport matrix, accessibility, classic/static fallback, reduced motion, and physical-device evidence.

Indirect evidence is called out but not credited. For example:

- random-deck tests reimplement random selection instead of invoking the real selection path;
- engine tests do not count as browser input coverage;
- visual fixture intent does not count as a live overlay or result journey;
- accessibility snapshots used for privacy do not count as keyboard/screen-reader usability coverage.

## Focused Characterization Tests

`tests/presentation/behavior-order-characterization.test.js` directly proves:

1. Solo action order is:
   - execute authoritative action;
   - cache old positions;
   - play the complete pre-render event partition against old state;
   - replace and render authoritative state;
   - play the complete post-render partition against new state.
2. Multiplayer updates are FIFO:
   - cache old positions;
   - replace state;
   - render;
   - await that update's events;
   - render log;
   - only then begin the next queued update.
3. The current player-status selector incorrectly combines mobile player with desktop opponent.
4. `shared/effects.js` emits `benchDamage` and `benchKo`, while event playback treats both as unknown.
5. `gameOver` playback resolves without a result/log/animation side effect.
6. Multiplayer writes `startTime` under `state.G`, while the mounted timer reads root `state.startTime`.

The four gap tests freeze observed behavior and do not authorize or contain fixes.

## Characterization-First Evidence

This task added no production implementation. The focused tests were written against existing injected seams and run before any non-test artifact was added:

- pre-edit relevant baseline: 82/82 passed across endpoint, engine, effects, and server-projection suites;
- first focused characterization run: 6/6 passed.

A failing-feature RED phase is not applicable to the four deliberately unfixed gaps: the durable tests assert the current defect as the characterization baseline. Any later authorized fix must invert the relevant expectation.

## Verification Evidence

- Focused characterization:
  - `npm test -- --run tests/presentation/behavior-order-characterization.test.js`
  - 6/6 passed.
- Full Vitest suite:
  - `npm test -- --run`
  - 389/389 passed across 25 files.
- Isolated production build:
  - `npm run build -- --outDir /private/tmp/tiny-fangs-task08-build.Xxo9TJ --emptyOutDir`
  - passed under Vite 6.4.1; 33 modules transformed.
- Diagnostics:
  - `tldr diagnostics` reported zero errors and zero warnings for the new test, matrix, and handoff.
- Syntax and whitespace:
  - `node --check` passed for the new test;
  - `git diff --check`/no-index checks passed for all Task 08 files.

Playwright journeys already present in the workspace were inventoried as existing evidence. Task 08 did not modify them or claim a fresh browser run.

## Exact Missing Seams

- `src/main.js` is a side-effectful entry module; input, preview, timer, result, and overlay functions are not independently importable. Their next direct evidence should be Playwright until a narrow lifecycle/input coordinator exists.
- Deck preview and generated grave-card hold bindings omit `pointercancel`.
- Timer creation/reading has no shared owner API, and no production route calls `clearGame()`.
- Event playback has no result-presenter dependency and no semantic target registry for bench events.
- Solo dispatch and multiplayer queue processing already expose sufficient injected seams; no production refactor was needed for their ordering tests.

## Next Work

Use the matrix as the Phase 1 regression backlog. Preserve the two ordering tests unchanged through the presentation migration. Treat selector, bench, `gameOver`, and timer rows as characterized defects requiring separately authorized minimal fixes, not as passing parity behavior.

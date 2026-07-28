---
date: 2026-07-27T17:02:53-04:00
task_number: 13
task_total: 16
status: success
---

# Task Handoff: Shared-Engine Exact-Once Corrections

## Task Summary

Corrected only the two exact-once shared-engine defects isolated by Task 10:

1. `executeAction(endTurn)` no longer appends a second identical deck-out `gameOver` after `endTurn` already emitted the terminal result.
2. Last Breath now emits its public `triggerVerse` exactly once while preserving life-loss negation, the once-per-game flag, Set-to-grave consumption, non-terminal state after the save, and terminal behavior on the later lethal attack.

The two Task 10 `it.fails` sentinels were converted to ordinary `it` tests before production changed. Their expected RED was captured, then the smallest root-cause changes made both tests GREEN.

## Files Changed

- `shared/engine.js`
- `tests/engine-turn-status-contracts.test.js`

## File Added

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-13-engine-exact-once.md`

No browser, server, client, renderer, stylesheet, index, package, config, workflow, behavior-matrix, goal-ledger, Task 09/11/12, or documentation-reference file changed.

## TDD Evidence

### RED preparation

Converted:

```js
it.fails('emits that terminal result exactly once through executeAction', ...)
it.fails('prevents only the first lethal life loss and reveals exactly once', ...)
```

to ordinary `it(...)` tests without changing their assertions.

### Confirmed RED

```text
npm test -- --run tests/engine-turn-status-contracts.test.js

Test Files  1 failed (1)
Tests       2 failed | 7 passed (9)
```

#### Deck-out received array

```js
[
  { type: 'manaGain', side: 'p2' },
  { type: 'gameOver', winner: 'p1', reason: 'Deck out' },
  { type: 'turnStart', yourTurn: false },
  { type: 'gameOver', winner: 'p1', reason: 'Deck out' },
]
```

Desired exact array:

```js
[
  { type: 'manaGain', side: 'p2' },
  { type: 'gameOver', winner: 'p1', reason: 'Deck out' },
  { type: 'turnStart', yourTurn: false },
]
```

#### Last Breath received array

```js
[
  { type: 'attack', side: 'p1', damage: 20, direct: true },
  { type: 'triggerVerse', side: 'p2', verse: 'Last Breath' },
  { type: 'triggerVerse', side: 'p2', verse: 'Last Breath' },
]
```

Desired exact array:

```js
[
  { type: 'attack', side: 'p1', damage: 20, direct: true },
  { type: 'triggerVerse', side: 'p2', verse: 'Last Breath' },
]
```

Both failures were assertion failures for the intended duplicates, not setup, syntax, or unrelated failures.

### Minimal GREEN implementation

#### Deck-out

`executeAction` now detects a deck-out terminal result already present in the action's emitted events and skips only the duplicate dispatcher append:

```js
const alreadyEmittedDeckOut = result.events.some(
  event => event.type === 'gameOver' && event.reason === 'Deck out'
);
```

The existing deck-out state/winner logic remains unchanged for other actions. LP terminal checks and reasons were not refactored.

#### Last Breath

Removed only the Last Breath branch-local:

```js
events.push({ type: 'triggerVerse', side: ownerSide, verse: 'Last Breath' });
```

`executeTrigger` already emits the authoritative generic reveal before dispatching to the card-specific branch. The branch still:

- validates the owner side;
- checks last-life damage;
- negates the loss;
- sets `usedLastBreath`;
- returns through the existing trigger-consumption/grave path.

### Focused GREEN

```text
npm test -- --run tests/engine-turn-status-contracts.test.js

Test Files  1 passed (1)
Tests       9 passed (9)
```

The Last Breath integration also continues to assert that the later lethal direct attack emits exactly:

```js
[
  { type: 'attack', side: 'p1', damage: 20, direct: true },
  { type: 'lpDamage', side: 'p2', amount: 1 },
  { type: 'gameOver', winner: 'p1', reason: 'LP depleted' },
]
```

This preserves the distinct LP-depletion reason and one terminal event.

## Regression Verification

### Engine/effect gate

```text
npm test -- --run \
  tests/engine.test.js \
  tests/engine-action-contracts.test.js \
  tests/engine-turn-status-contracts.test.js \
  tests/effects.test.js \
  tests/triggers.test.js \
  tests/ability-effects.test.js \
  tests/server/game-engine.test.js

Test Files  7 passed (7)
Tests       195 passed (195)
```

This includes the existing exact LP-terminal arrays in `engine-action-contracts.test.js`.

### Full shared unit gate

Task 12 reported stable GREEN before the final shared run. After the Task 13 fixes:

```text
npm test -- --run

Test Files  29 passed (29)
Tests       462 passed (462)
```

No concurrent failure remained to classify.

### Isolated production build

```text
npm run build -- --outDir /tmp/tiny-fangs-task13-build.vQtV7l

✓ 33 modules transformed.
✓ built in 297ms
```

### Static and diff checks

- `tldr diagnostics shared/engine.js`: 0 errors, 0 warnings.
- `tldr diagnostics tests/engine-turn-status-contracts.test.js`: 0 errors, 0 warnings.
- `node --check shared/engine.js`: passed.
- `node --check tests/engine-turn-status-contracts.test.js`: passed.
- `git diff --check`: passed.
- No `it.fails` sentinel remains in the Task 10 turn/status contract file.

## Scope and Ownership Notes

- `shared/engine.js` already contained unrelated in-flight face-registry, Set-privacy, and Antling-identity changes. Task 13 preserved them. Its production delta is limited to the Last Breath duplicate-event deletion and the already-emitted deck-out guard.
- No trigger matching, consumption, grave movement, winner ownership, or terminal architecture was refactored.
- No existing dirty workspace work was reverted, overwritten, staged, or committed.

## Remaining Presentation Gaps

These shared-engine fixes close only exact-once rule/event behavior.

- STA-07 still needs the solo and multiplayer deck-out result presentation journeys across required viewports.
- STA-08 still needs browser and multiplayer reveal/result-suppression coverage proving Last Breath appears once and only after the authorized trigger.
- Event playback, animation timing, result overlays, accessibility announcements, and post-terminal input locking remain owned by their browser/presentation tasks.

Root should update the behavior matrix and goal ledger using this handoff; Task 13 intentionally did not edit either.

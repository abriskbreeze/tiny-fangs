---
date: 2026-07-27T17:11:25-04:00
task_number: 16
task_total: 16
status: success
---

# Task Handoff: Event-Playback Status and Bench Targets

## Task Summary

Fixed only the two event-playback target defects characterized by Task 08:

1. Player poison/trapped events now target the player active card in both mobile and desktop shells.
2. Real `benchDamage` and `benchKo` events now have deterministic playback handlers for both player perspectives.

The characterized tests were inverted/extended to desired behavior before production changed. The focused run failed for the exact selector inversion and missing handlers, then passed after the minimal `src/event-playback.js` correction.

No event producer, engine ordering, result ownership, timer ownership, Three scene, styles, renderer, target registry, or client/server route changed.

## Files Changed

- `src/event-playback.js`
- `tests/presentation/behavior-order-characterization.test.js`

## File Added

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-16-event-playback-targets.md`

No index, main, multiplayer client, server, shared engine/effects producer, fixture registry, package/config/workflow, render/styles, documentation-reference, behavior-matrix, goal-ledger, or Task 14/15 file changed.

## TDD Evidence

### Desired tests written first

The Task 08 characterization expectations were replaced with direct desired contracts for:

- poison and trapped;
- absolute `p1`/`p2` sides;
- semantic `me`/`opp` sides;
- mobile and desktop active selectors;
- real generated bench event shapes;
- awaited playback order;
- exact indexed mobile/desktop bench selectors;
- player and opponent bench targets;
- index-less semantic fallback and missing-element safety.

### Focused RED

```text
npm test -- --run tests/presentation/behavior-order-characterization.test.js

Test Files  1 failed (1)
Tests       11 failed | 8 passed (19)
```

The failures were exact and feature-specific:

- four `p1`/`me` poison/trapped cases received:

```text
#m-my-active .card-active, #d-opp-active .card-active
```

instead of:

```text
#m-my-active .card-active, #d-my-active .card-active
```

- generated `benchDamage` and `benchKo` events had no matching handlers;
- four exact indexed me/opp selector cases and two index-less fallback cases failed because the handlers were `undefined`.

The four `p2`/`opp` active-status cases and all unrelated ordering/gameOver/timer characterizations remained green.

## Exact Producer Shapes

The tests invoke the real `shared/effects.js` functions rather than constructing a parallel rule model.

`Effects.aoeAll` emits:

```js
[
  {
    type: 'benchDamage',
    animKey: 'me',
    benchIndex: 0,
    amount: 5,
  },
  {
    type: 'benchDamage',
    animKey: 'opp',
    benchIndex: 0,
    amount: 5,
  },
]
```

`Effects.banish` emits:

```js
[
  {
    type: 'benchKo',
    animKey: 'me',
    benchIndex: 0,
  },
]
```

Current producers do not emit a bench-card UID. `benchIndex` is therefore the exact identity-bearing target available to this playback layer.

## Minimal GREEN Implementation

### Active status

The player selector is now:

```text
#m-my-active .card-active, #d-my-active .card-active
```

The opponent selector remains:

```text
#m-opp-active .card-active, #d-opp-active .card-active
```

Both selectors are directly asserted for poison and trapped with `p1`, `me`, `p2`, and `opp` inputs.

### Indexed bench events

The handlers normalize `event.side` or `event.animKey` through `sideKey`, validate the non-negative integer index, and delegate to the existing animation authority:

```js
Anim.benchDamage(side, index, event.amount)
Anim.benchKo(side, index)
```

The real `Anim` methods were exercised with absent DOM targets and directly produced these selectors:

```text
#m-my-bench .card-mini:nth-child(1), #d-my-bench .card-mini:nth-child(1)
#m-opp-bench .card-mini:nth-child(2), #d-opp-bench .card-mini:nth-child(2)
#m-my-bench .card-mini:nth-child(2), #d-my-bench .card-mini:nth-child(2)
#m-opp-bench .card-mini:nth-child(1), #d-opp-bench .card-mini:nth-child(1)
```

No floating target text is attempted when the exact selector matches no current element.

### Missing-index fallback

An event with a valid semantic side but no usable index does not invent a card identity. It animates only that side's bench containers:

```text
#m-my-bench, #d-my-bench
#m-opp-bench, #d-opp-bench
```

Damage uses shake plus red flash and awaits 600 ms. KO uses the KO animation and awaits 400 ms. Missing/unknown side and missing animation primitives resolve safely.

### Promise order

The generated-event test holds the first damage Promise open and proves that neither the second damage nor KO begins early. Exact completed order is:

```text
benchDamage:me:0:5
wait:50
benchDamage:opp:0:5
wait:50
benchKo:me:0
wait:50
```

No unknown-event warning is emitted.

### Focused GREEN

```text
npm test -- --run tests/presentation/behavior-order-characterization.test.js

Test Files  1 passed (1)
Tests       19 passed (19)
```

## Verification Evidence

### Animation/render/effect regression gate

```text
npm test -- --run \
  tests/presentation/behavior-order-characterization.test.js \
  tests/anim.test.js \
  tests/render.test.js \
  tests/effects.test.js \
  tests/ability-effects.test.js \
  tests/events.test.js \
  tests/target-selector.test.js

Test Files  7 passed (7)
Tests       141 passed (141)
```

### Full unit suite

```text
npm test -- --run

Test Files  29 passed (29)
Tests       475 passed (475)
```

No concurrent Task 14/15 failure appeared in this run.

### Isolated production build

```text
npm run build -- --outDir /tmp/tiny-fangs-task16-build.EPkSvy

✓ 33 modules transformed.
✓ built in 300ms
```

### Static and diff checks

- `tldr diagnostics src/event-playback.js`: 0 errors, 0 warnings.
- `tldr diagnostics tests/presentation/behavior-order-characterization.test.js`: 0 errors, 0 warnings.
- `node --check src/event-playback.js`: passed.
- `node --check tests/presentation/behavior-order-characterization.test.js`: passed.
- `git diff --check`: passed.

The exact selectors were proven with injected playback dependencies and the real `Anim` selector implementation, so no browser was required for this bounded correction.

## Remaining Gaps

- `gameOver` event playback remains intentionally side-effect free; result ownership and overlays remain a separate task.
- Multiplayer still writes start time under `state.G` while the mounted timer reads root `state.startTime`; timer ownership remains unchanged.
- Current bench producers expose an index, not a stable UID, and rendered mini cards expose no semantic UID selector. If event playback ever moves across a render/reorder boundary, stable target identity requires an authorized producer/render target-registry design rather than guessing from card content.
- Browser timing, live DOM transitions, reduced motion, and the future Three presentation still need their dedicated journey/visual checks.

Root should update EVT-04/EVT-05 in the behavior matrix and the goal ledger using this handoff; Task 16 intentionally did not edit either.

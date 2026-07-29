---
date: 2026-07-27T17:18:18-04:00
task_number: 18
status: success
---

# Task Handoff: Event Sequencing, Failure Containment, Anim Safety, and Debug Redaction

## Task Summary

Added direct contracts for EVT-03, EVT-07, and EVT-08 and made the minimum event-playback hardening required by their RED evidence.

The completed lane proves:

- local and server event handlers are awaited strictly one at a time;
- the mandatory 50 ms wait remains between every event and is also awaited;
- synchronous throws and rejected handler Promises are contained, logged without secret details, followed by the wait, and do not abort later events;
- all 19 public Anim facade methods directly used by event playback safely tolerate missing and removed targets;
- debug output is enabled only by the exact storage value `"1"`;
- server event summaries and unknown-event diagnostics cannot expose arbitrary source values, card names, UIDs, pending context, or unknown type strings;
- local unknown-event warnings and handler-error diagnostics are likewise payload-free.

No `src/anim.js` production change was needed. All real facade safety cases passed during the initial RED run.

## Files Changed

- `src/event-playback.js`

## Files Added

- `tests/presentation/event-playback-hardening.test.js`
- `tests/anim-missing-targets.test.js`
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-18-event-debug-hardening.md`

Task 18 did not touch main, index, multiplayer client, server, shared engine/effects, fixture registry, visual baselines, package/config/workflow, render/styles, documentation references, behavior matrix, goal ledger, or Task 14/15/17 files.

## TDD Evidence

### Tests written before Task 18 production changes

Dedicated tests were added for:

- both `playEvents` and `playServerEvents`;
- strict deferred-handler sequencing;
- inter-event wait order;
- synchronous handler throw;
- rejected handler Promise;
- later-event continuation after each failure mode;
- exact debug enable and disable values;
- allowlisted server summaries;
- unknown server and local diagnostics;
- every directly used Anim facade method against missing and removed DOM targets.

### Focused RED

```text
npm test -- --run \
  tests/presentation/event-playback-hardening.test.js \
  tests/anim-missing-targets.test.js

Test Files  1 failed | 1 passed (2)
Tests       9 failed | 42 passed (51)
```

The nine failures were exact privacy/diagnostic defects:

1. Four local/server throw/reject cases logged:

```js
[
  'Error playing event damage:',
  Error('private-card-uid'),
]
```

instead of the safe exact diagnostic:

```js
['Error playing event damage']
```

2. Debug summary received:

```js
[
  '[DEBUG] Playing events:',
  ['damage[source-secret]', 'unknown-secret-type'],
]
```

instead of:

```js
[
  '[DEBUG] Playing events:',
  ['damage(0)[source]', 'unknown'],
]
```

3. The unknown server diagnostic logged the arbitrary unknown type.
4. Storage values `"0"`, `"false"`, and `"true"` incorrectly enabled debug because the previous check accepted any truthy string.
5. Local unknown-event warning logged the arbitrary type plus the complete event object, including name, UID, and pending context.

The 42 passing RED-stage tests proved:

- both playback loops were already strictly sequential;
- failure containment already continued to later events;
- all real Anim missing/removed-target cases were already safe.

## Minimal GREEN Implementation

Task 18 added four local helpers inside `createEventPlayback`:

- `getEventHandler(event)` accepts only own keys of `EVENT_HANDLERS`;
- `safeEventType(event)` returns a known handler type or literal `"unknown"`;
- `summarizeDebugEvent(event)` creates the allowlisted string;
- `isDebugEnabled()` requires exact storage value `"1"`.

Both playback loops retain their existing `for...of`, awaited handler, and awaited `Anim.wait(50)` order.

Handler failures now log only:

```text
Error playing event <known-type>
```

Unknown local events now warn only:

```text
Unknown event type
```

Unknown server diagnostics, when debug is enabled, now log only:

```text
[DEBUG] Unknown event type
```

No thrown Error object, event object, arbitrary unknown type, or nested payload is sent to console.

## Exact Debug Allowlist

Debug is enabled only when:

```js
localStorage.getItem('tinyFangsDebug') === '1'
```

The following values are directly proven disabled:

- `null`
- `""`
- `"0"`
- `"false"`
- `"true"`

Each summarized event may contain only:

1. a known own-key `EVENT_HANDLERS` type;
2. finite numeric `amount`, including zero, formatted as `(N)`;
3. the literal presence tag `[source]` when a source field exists.

It never includes the source value. An event without a known handler is summarized as literal `"unknown"`.

Example:

```js
{
  type: 'damage',
  amount: 0,
  source: 'source-secret',
  creature: 'Hidden Fang',
  uid: 'card-uid-secret',
  pendingAction: { context: 'pending-secret' },
}
```

becomes:

```text
damage(0)[source]
```

The card name, UID, source value, and pending context are absent.

## Anim Facade Coverage

The tests invoke current real methods with fake timers and a real-behavior DOM stub; they do not source-scan or replace the method under test.

Every direct facade method used by event playback is covered against both an empty selector result and a removed/invisible element:

1. `summon`
2. `summonBench`
3. `damage`
4. `benchDamage`
5. `lpDamage`
6. `attackDirect`
7. `attack`
8. `ko`
9. `benchKo`
10. `heal`
11. `manaGain`
12. `benchToActive`
13. `setVerse`
14. `castVerse`
15. `playOn`
16. `wait`
17. `getAnimPosition`
18. `floatText` with a null target
19. `negateX`

That is 38 parameterized missing/removed-target cases. Every case:

- returns or resolves without throwing/rejecting;
- leaves `Anim.cachedPositions` unchanged;
- cleans up any temporary document node after timers settle.

No unhandled rejection occurred.

## GREEN and Verification Evidence

### Focused GREEN

```text
npm test -- --run \
  tests/presentation/event-playback-hardening.test.js \
  tests/anim-missing-targets.test.js

Test Files  2 passed (2)
Tests       51 passed (51)
```

### Related playback/animation/effects/render gate

```text
npm test -- --run \
  tests/presentation/event-playback-hardening.test.js \
  tests/anim-missing-targets.test.js \
  tests/presentation/behavior-order-characterization.test.js \
  tests/anim.test.js \
  tests/events.test.js \
  tests/effects.test.js \
  tests/ability-effects.test.js \
  tests/render.test.js \
  tests/target-selector.test.js

Test Files  9 passed (9)
Tests       192 passed (192)
```

### Full unit suite

```text
npm test -- --run

Test Files  31 passed (31)
Tests       526 passed (526)
```

No concurrent Task 14/15/17 failure remained in the final run.

### Isolated production build

```text
npm run build -- --outDir /tmp/tiny-fangs-task18-build.hwBmLj

✓ 33 modules transformed.
✓ built in 307ms
```

### Static and diff checks

- `tldr diagnostics src/event-playback.js`: 0 errors, 0 warnings.
- `tldr diagnostics tests/presentation/event-playback-hardening.test.js`: 0 errors, 0 warnings.
- `tldr diagnostics tests/anim-missing-targets.test.js`: 0 errors, 0 warnings.
- `node --check` passed for all three files.
- `git diff --check`: passed.

## Boundaries Preserved

- Injected public gameplay `log(...)` behavior was not changed.
- Event producers and engine/client event order were not changed.
- Existing Task 16 status/bench playback changes in `src/event-playback.js` were preserved.
- No visual timing, CSS, result ownership, timer ownership, target registry, or browser global was added or refactored.
- No existing dirty workspace work was reverted, staged, or committed.

## Remaining Gaps

- `gameOver` playback remains intentionally side-effect free; result overlay ownership remains separate.
- Multiplayer/root timer ownership remains split and unchanged.
- Stable UID-backed semantic targeting for animation across render/reorder boundaries remains a future target-registry concern.
- Console diagnostics now favor privacy over per-event payload detail; richer debugging would require a separately designed, explicitly redacted diagnostic schema.

Root should update EVT-03, EVT-07, and EVT-08 in the behavior matrix and goal ledger using this handoff; Task 18 intentionally did not edit either.

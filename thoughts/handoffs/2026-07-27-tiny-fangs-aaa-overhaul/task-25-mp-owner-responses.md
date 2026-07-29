---
date: 2026-07-27T18:04:10-04:00
task_number: 25
status: success_full_sweeps_complete
---

# Task Handoff: Multiplayer Owner-Only Responses and Coin-to-Board Order

## Task Summary

Made Optional Set and Skitter response ownership authoritative at the real
WebSocket room boundary, removed trust in client-supplied Optional context, and
proved both response families with actual two-peer frames.

The room now owns one pending response. Only its target player can answer it;
normal actions and End Turn cannot cross that pause; malformed, wrong-owner,
duplicate, unsolicited, and stale answers are rejected without changing state.
The server reconstructs Optional `verseId` and `context` from its own pending
record and validates Skitter's selected bench index against the original option
UID and the live board.

The multiplayer start path now awaits the complete coin choreography before
state, timer, board render, queued updates, or gameplay input can surface.
Both gameplay shells are explicitly hidden before the coin begins. The
canonical 1672×941 two-client browser test proves this for host and joiner
independently.

No card art, renderer, stylesheet, fixture registry, shared engine/effects,
index markup, package, workflow, behavior-matrix, plan, or goal-ledger file was
changed. Task 11 socket lifecycle, Task 20 timer ownership, and the hidden Set
projection were preserved.

## Production Defects Found

### Pending responses had no server authority

`Room.broadcastState` already omitted `pendingAction` for the non-owner, but the
room did not persist the pending action. Shared engine turn validation exempts
`skitterSwap`, `skitterDecline`, and `respondOptionalTrigger`, so either socket
could submit those actions unsolicited. A duplicate/stale decline emitted a
new authoritative `stateUpdate`, and Optional answers trusted the client's
`verseId` and complete context.

### Multiplayer board was effective during the coin

The client launched coin playback in an untracked async IIFE. Incoming state
updates could process independently. Real browser mutation evidence also found
the desktop shell computed as `display:flex` when the coin overlay was added,
even though setup remained in front of it. That violated the strict
no-premature-board/input contract.

## What Changed

### Server room authority

- `server/index.js:35-44,80-102`
  - Adds/reset `Room.pendingAction`.
- `server/index.js:175-253`
  - Resolves the pending owner from canonical `p1`/`p2`.
  - Rejects response actions when no response exists.
  - Rejects all non-owner attempts with an opaque error.
  - Blocks ordinary owner actions while a response is pending.
  - Requires exact response shapes.
  - Canonicalizes Optional `verseId` and `context` from server memory.
  - Validates Skitter `benchIdx`, offered UID, and live bench UID.
- `server/index.js:379-421`
  - Runs only the prepared canonical action.
  - Preserves pending state on errors.
  - Replaces/clears pending state only after successful execution.
- `server/index.js:430-459`
  - Blocks End Turn during a response pause for both peers without exposing
    response identity to the non-owner.

### Multiplayer client ordering

- `src/mp-client.js:30-33,80-130`
  - Tracks the start promise.
  - Hides both gameplay shells immediately on `gameStart`.
  - Awaits the coin before `startMultiplayerGame`.
  - Holds every immediately following `stateUpdate` behind the same promise and
    then uses the existing serialized update queue.
- `src/mp-client.js:315-335`
  - Sends only `{ action: "respondOptionalTrigger", confirmed }`.
  - No client-controlled verse ID, card identity, UID, or combat context crosses
    the response boundary.

## Tests Added or Extended

- `tests/server/deterministic-random.js`
  - Test-only LCG preload. It seeds real deck shuffle/coin outcomes without a
    production protocol hook.
- `tests/server/server-process.test.js:162-290,497-777`
  - Real socket helpers with lossless message inboxes.
  - Unsolicited/malformed/stale atomic rejection.
  - Deterministic real game with host `p1` Shell and guest `p2` Swarm.
  - Optional owner `p1`; Skitter owner `p2`.
  - Yes/No and swap/decline branches.
  - Wrong-owner, forged-context, invalid-index, and duplicate attempts.
  - Owner-only payload and exact-once event assertions.
- `tests/presentation/behavior-order-characterization.test.js:251-331`
  - Deferred coin gate.
  - No state, timer, render, or update playback before coin resolution.
  - Both gameplay shells explicitly hidden while setup remains.
- `tests/e2e/multiplayer/owner-responses.spec.js`
  - Spawns an isolated deterministic real WebSocket server.
  - Uses two explicit 1672×941 Chromium contexts.
  - Captures inbound/outbound frames, console/debug, DOM, text, accessibility,
    readiness, resource URLs, and semantic DOM mutation order.
  - Proves host and guest each display the actual multiplayer coin overlay for
    more than 500 ms.
  - Proves overlay removal precedes setup hide and desktop show for each peer.
  - Proves Optional modal exists only for its owner.
  - Proves Skitter modal exists only for its owner.
  - Proves non-owner frames/surfaces contain no pending payload, Optional Set
    identity/prompt, or Skitter bench-option metadata.

## TDD Evidence

### Raw server RED

Command:

```text
npm run test:server-process -- --testNamePattern='rejects unsolicited'
```

Authoritative failure:

```text
expected { type: 'stateUpdate', ...events:[{type:'skitterDecline'}] }
to equal { type: 'error', message: 'No pending response' }
```

The focused run exited 1. This proved an actual authorization/state-transition
defect, not a test setup issue.

### Coin/update order RED

Command:

```text
npx vitest --run tests/presentation/behavior-order-characterization.test.js \
  --testNamePattern='keeps multiplayer state'
```

The test failed because `handleServerMessage(gameStart)` returned `undefined`
and a following `stateUpdate` could replace/render state before coin completion.

### Canonical browser RED

The first two failures identified harness assumptions and were corrected
without production changes:

1. the multiplayer overlay has no DOM ID, unlike the solo overlay;
2. transient visibility required per-page mutation evidence rather than a
   cross-page polling snapshot.

The corrected semantic probe then found the product defect:

```text
coinAdded.desktopDisplay === 'flex'
expected 'none'
```

The desktop shell was effective during the coin. The minimal shell-hide fix was
made only after this real browser RED.

## Focused GREEN Evidence

### Raw authorization

```text
npm run test:server-process -- --testNamePattern='rejects unsolicited'
1 passed | 14 skipped
exit 0
```

### Real owner-only pending flows

```text
npm run test:server-process -- --testNamePattern='delivers owner-only'
2 passed | 15 skipped
exit 0
```

This is actual WebSocket process evidence, not a mocked room:

- Optional owner `p1`, Skitter owner `p2`;
- owner receives full legal choices and canonical context;
- non-owner receives no `pendingAction`;
- Yes/No/swap/decline each resolve exactly once;
- wrong-owner/malformed/forged/invalid/duplicate/stale requests are atomic
  errors.

### Focused unit/integration

```text
npx vitest --run \
  tests/presentation/behavior-order-characterization.test.js \
  tests/presentation/game-timer-lifecycle.test.js \
  tests/presentation/mp-error-surface.test.js \
  tests/presentation/mp-endpoint.test.js

4 files passed
31 tests passed
```

After the real browser board-order fix:

```text
npx vitest --run \
  tests/presentation/behavior-order-characterization.test.js \
  tests/presentation/game-timer-lifecycle.test.js \
  --testNamePattern='keeps multiplayer state|multiplayer timer lifecycle seam'

4 passed | 22 skipped
```

### Canonical real browser

```text
npx playwright test --project=multiplayer --workers=1 \
  tests/e2e/multiplayer/owner-responses.spec.js

1 passed in 20.1s
exit 0
```

Both contexts were exactly 1672×941. The browser test used an isolated actual
server, actual WebSocket frames, actual modal DOM, actual debug console, and
actual accessibility/resource surfaces.

## Full Local Verification

```text
npm test -- --run
33 files passed
545 tests passed
```

```text
npm run build
33 modules transformed
built in 288 ms
exit 0
```

- `node --check` passed on every changed JavaScript file.
- Targeted `git diff --check` passed.
- `tldr diagnostics . --project --format text`: no diagnostics.
- No files were staged or committed.

## Evidence Pending Because of External Limit — RESOLVED 2026-07-27

The final full privileged reruns were originally requested:

```text
npm run test:server-process
npm run test:multiplayer
```

The approval reviewer blocked both because its global execution quota was
exhausted until **August 3, 2026 at 4:35 PM**. Per policy, no workaround or
indirect execution was attempted at that time.

A later session found the quota no longer blocking and ran both sweeps. Both are
now complete. See "Completed Full Sweeps" below.

## Completed Full Sweeps

```text
npm run test:server-process
1 file, 17/17 passed, exit 0
```

```text
TINY_FANGS_VITE_PORT=4222 TINY_FANGS_WS_PORT=3222 npm run test:multiplayer
8/8 passed — three consecutive full-project runs
```

No Task 25 assertion was weakened. The complete sweep did surface two
pre-existing test defects that the focused runs never exercised. Both are test
defects, not production regressions, and both were fixed in the tests only.

### Defect A — stale Task 17 shell characterization

`tests/e2e/multiplayer/responsive-shell.spec.js` froze the 601–899 duplicate-shell
mismatch and asserted the non-selected shell carried an empty inline `display`.

Task 25's `gameStart` shell-hide makes both shells explicitly inert before the
coin, so the non-selected shell now keeps inline `display: none`. Measuring all
six boundaries showed this **incidentally removed the duplicate-shell symptom**:
601 and 899 now render only the desktop shell instead of both trees.

| Width | Visible before | Visible now | Selected inline | Non-selected inline |
|---:|---|---|---|---|
| 599 | mobile | mobile | `flex` | `none` |
| 600 | mobile | mobile | `flex` | `none` |
| 601 | mobile + desktop | desktop | `flex` | `none` |
| 899 | mobile + desktop | desktop | `flex` | `none` |
| 900 | desktop | desktop | `flex` | `none` |
| 901 | desktop | desktop | `flex` | `none` |

The characterization was updated to the strictly stronger contract — exactly one
visible shell at every boundary — and retitled. The underlying 600 px JS versus
900 px CSS *selection* mismatch still exists and stays frozen as `selectedShell`,
so the Phase 12 focused fix is still owed. Privacy, overflow, and runtime-error
assertions are unchanged.

### Defect B — two independent flakes in Task 11 lifecycle authority

`tests/e2e/multiplayer/lifecycle-authority.spec.js:409` ("visible actions and End
Turn follow authoritative projected server state") failed intermittently against
the shared, genuinely-shuffling Playwright server. It passed in isolation, which
is why the focused Task 25 runs never caught it.

1. **No affordable opener.** The test asserted "known decks must expose an
   affordable opener". A 5-card hand is dealt from 20 cards at 1 mana; Shell
   holds 4 cost-1 creatures and Shadow 6, so P(no affordable opener) is 0.2817
   and 0.1291 respectively — a coin-weighted **20.5% failure rate per run**. Now
   the test deals up to 12 fresh rooms until the precondition it exists to
   exercise actually holds; P(all 12 fail) ≈ 5.7e-9.
2. **Ambiguous option selector.** Decks run duplicate creature names, so
   `.filter({ hasText: card.name })` hit Playwright strict-mode violations
   ("resolved to 2 elements") whenever the hand held two copies. `doSummon`
   lists every hand creature in hand order and only marks unaffordable ones
   disabled, so the option is now selected by index, with added assertions that
   the option is not disabled and shows the expected name. The outbound-frame
   and projection assertions still key on the exact `uid`.

Verification after both fixes: the focused test passed 8/8 consecutive runs
(one 22.7 s run exercised the reroll path), and the full project passed 8/8 on
three consecutive sweeps.

## Behavior-Matrix Disposition

The parent owns the shared matrix and should apply the edits.

- **OVR-07 — recommend `covered` for the desktop milestone.**
  Actual two-peer frames and 1672×941 DOM/accessibility/debug/resource surfaces
  prove Optional pending metadata and prompt are owner-only; both Yes and No are
  proven exact-once in raw server flow, with No proven through the actual modal.
- **OVR-09 — recommend `covered` for the desktop milestone.**
  Actual two-peer frames and browser surfaces prove Skitter choices/prompt are
  owner-only; swap and decline are exact-once in raw server flow, with decline
  proven through the actual modal.
- **MP-15 — recommend `covered` for the desktop milestone.**
  Both pending types are exercised in opposite player perspectives (`p1` and
  `p2`). The server is authoritative for owner, action family, choices, and
  Optional context. Non-owner frames have no pending field or response metadata.
- **SET-13 — update multiplayer evidence, but keep `missing` overall.**
  Strict host/joiner coin-to-board ordering is now directly covered at 1672×941,
  including the real defect fix. The row also requires a reduced-motion variant;
  no reduced-motion implementation or evidence was added, so the complete row
  must not be promoted yet.

## Privacy and Ordering Guarantees

- The non-owner receives no pending object at all.
- Error text does not identify the response family to the non-owner.
- Optional `verseId`, prompt, verse name, attacker/defender context, and UIDs are
  sent only to the owner.
- Optional response context cannot be forged by the browser.
- Skitter bench choice must match both the offered option UID and live bench UID.
- A pending response blocks normal actions and End Turn.
- Successful resolution clears or replaces the pending record exactly once.
- Duplicate/stale answers cannot emit another state transition.
- State/timer/render/update playback cannot start before the coin promise.
- Setup remains visible and both gameplay shells remain hidden during the coin.
- The selected desktop shell appears only after the exact overlay is removed.

## Remaining Scope

- Implement and test the reduced-motion timing policy before promoting SET-13
  overall.
- Rerun the complete server-process and multiplayer projects after the external
  approval quota resets.
- Mobile/tablet response presentation and viewport acceptance remain deferred
  under the desktop-first delivery decision.

No visual critic was required for this lane: it changes protocol authority and
pre-board visibility/order, not the AAA board/card art. The actual 1672×941
browser proof is the relevant presentation gate.

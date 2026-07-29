---
date: 2026-07-27T16:51:43-04:00
task_number: 10
task_total: 16
status: success_with_known_red_contracts
---

# Task Handoff: Shared-Engine Action, Status, Result, Turn, and AI Contracts

## Task Summary

Added 35 focused Vitest contracts around the authoritative shared engine and the injectable solo-AI executor seam. The tests use `createGame`, `mkCreature`, `mkVerse`, `executeAction`, `endTurn`, real card definitions/effects, `createSoloDispatch`, and `createSoloAi`; they do not duplicate production rules.

No production code changed. The behavior matrix was deliberately left untouched while Task 09 is in flight.

The initial RED run isolated two genuine exact-once contradictions:

1. `endTurn` emits a deck-out `gameOver`, then `executeAction` appends the same terminal event again.
2. `executeTrigger` emits the generic `triggerVerse` event, then its Last Breath branch emits the same reveal a second time.

Per Task 10 scope, neither contradiction was fixed or refactored. Both desired exact-once assertions remain executable as `it.fails` sentinels, after exact state assertions and the passing portions of their integration sequences.

## Files Added

- `tests/engine-action-contracts.test.js`
- `tests/engine-turn-status-contracts.test.js`
- `tests/solo-ai-turn-contracts.test.js`
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-10-engine-contracts.md`

No package/config/workflow/server/index, production engine, presentation, protected visual, goal ledger, Task 09/11, staging, or commit operation was touched.

## Direct Contracts Added

### Action authority and validation

- Parameterized non-current-player rejection for all six normal actions:
  - Summon
  - Cast
  - Set
  - Attack
  - Retreat
  - End Turn
- Non-current-player response exceptions:
  - Skitter swap
  - Skitter decline
  - optional Set-response decline
- Set rejection is atomic for:
  - insufficient mana
  - occupied Set slot
- Ordinary attack exact order:
  - attack
  - defender damage
  - Thornling ability reveal
  - retaliation damage
- Direct attack exact order, one-life loss, and final-life terminal event.
- Dark Pact self-life depletion through a real Cast effect and exact terminal result.
- First-global-turn attack rejection without mutation.
- Attack/retreat once-per-turn and mutual-exclusion matrix.
- End Turn reset of both action limits.
- Ordinary selected retreat swap and exact event.
- Atomic retreat rejection for:
  - missing active
  - empty bench
  - invalid bench index
  - trapped active

### End Turn, status, promotion, and result

- Complete exact End Turn phase order:
  - poison damage
  - KO
  - deterministic bench promotion
  - Broodmother Spawn
  - Antling summon
  - mana growth/refill
  - draw
  - turn start
- First-global-turn exception to max-mana growth.
- Direct `endTurn` deck-out winner/reason/event contract.
- `executeAction(endTurn)` exact-once deck-out RED sentinel.
- Hexweaver poison application through a real attack.
- Poison does not tick on the attacker's End Turn and ticks exactly 10 on its owner's End Turn.
- Mireveil trapped application, atomic retreat rejection, and owner-End-Turn clear.
- Real Fortify Cast, lethal survival at exactly 1 HP, and one-use consumption.
- Real Unbreakable Cast, next-damage negation, zero-damage event, and one-use consumption.
- Last Breath first-lethal state behavior:
  - life remains at one
  - Set moves to grave
  - once-per-game flag is set
  - winner remains unset
  - the next lethal direct attack depletes life and ends the game
- Last Breath exact-one reveal RED sentinel.

### Complete solo-AI turn executors

- Pup difficulty executes the full fixed-order lane through the real dispatch/engine bridge:
  - Summon
  - Cast
  - Set
  - direct Attack
  - End Turn
- The Pup test asserts exact dispatched payload order and final authoritative card, mana, life, turn, action-limit, and end-animation state.
- Hunter executes ten deterministic scored real Mana Surge Casts, then stops at `MAX_MOVES` and ends the turn with the eleventh legal card still in hand.
- Hunter's pass path uses the real `getScoredMoves` and `pickBestMove` helpers and dispatches only End Turn when no move clears threshold.

## TDD Evidence

### Initial RED

```text
npm test -- --run tests/engine-action-contracts.test.js tests/engine-turn-status-contracts.test.js tests/solo-ai-turn-contracts.test.js

Test Files  1 failed | 2 passed (3)
Tests       2 failed | 33 passed (35)
```

The two failures were exact:

- deck-out received a fourth event: a duplicate `{ type: 'gameOver', winner: 'p1', reason: 'Deck out' }`;
- Last Breath received a third event: a duplicate `{ type: 'triggerVerse', side: 'p2', verse: 'Last Breath' }`.

All other new contracts passed on the initial run. No production correction was authorized.

### Focused GREEN with preserved RED sentinels

```text
npm test -- --run tests/engine-action-contracts.test.js tests/engine-turn-status-contracts.test.js tests/solo-ai-turn-contracts.test.js

Test Files  3 passed (3)
Tests       35 passed (35)
```

The two desired exact-once contracts use `it.fails`, so Vitest now requires each known contradiction to remain reproducibly RED. If production is later corrected, those sentinels will fail the suite until converted to ordinary passing tests.

## Behavior-Matrix Evidence for Parent Integration

The source matrix was not edited. The following engine/unit lanes are directly proven; browser, playback, multiplayer, accessibility, and visual variants remain missing unless separately covered by another task.

| Row | Task 10 evidence | Remaining boundary |
|---|---|---|
| ACT-01 | Complete dispatcher guard table plus all three response exceptions | Multiplayer authority repetition remains separate |
| ACT-07B | Engine insufficient-mana and occupied-slot rejection, exact immutability | Disabled T/button/drag UI paths |
| ACT-08 | Baseline hit/Thorns retaliation exact order; existing specialized engine tests retain multi-hit/DR/KO lanes | Browser playback variants |
| ACT-09 | Direct life loss and final-life result through shared engine | Browser result journey |
| ACT-10 | First-turn engine prohibition and immutability | Disabled A/button presentation |
| ACT-11 | Complete engine mutual-exclusion/repetition/reset matrix | UI affordance state |
| ACT-12 | Ordinary engine swap and validation/trapped table | Replacement modal/browser path |
| ACT-13 | Full shared-engine phase state/order, first-turn mana exception, and raw deck-out | Dispatcher exact-once remains known RED; solo/MP handoff UI remains |
| ACT-14 | Not claimed by Task 10 | Six client controls and solo/MP payload routing remain missing |
| ACT-15 | Not claimed by Task 10 | Client animation/action lock remains missing |
| ACT-16 | Complete injected Pup and Hunter executors, including real engine effects and Hunter safety cap | Browser difficulty-selection journey is separate |
| STA-01 | Shared-engine application and owner-turn tick | Playback/browser visibility variants |
| STA-02 | Shared-engine apply/block/clear lifecycle | `clearStatus` playback/browser affordance restoration |
| STA-03 | Real Cast-to-lethal-survival engine lane | Visually distinct persistent badge/browser sequence |
| STA-04 | Real Cast-to-negation/consumption engine lane | Badge/negation presentation |
| STA-05 | Exact poison-KO/grave/promotion order in integrated End Turn | Browser journey; row already had narrower direct coverage |
| STA-06 | Shared-engine terminal winner and exact one `gameOver` for direct life and Dark Pact | Browser/MP result journey |
| STA-07 | Raw End Turn winner/reason/event exact; dispatcher duplicate frozen as known RED | Exact-once correction and result presentation |
| STA-08 | First-lethal state suppression and second-lethal terminal behavior | Exact-one reveal remains known RED; browser/MP reveal boundary |

Recommended matrix treatment: credit the new direct engine/unit evidence in the “Existing direct automated evidence” cells, but do not convert a row to fully covered when its named browser/UI variant remains outstanding. ACT-14 and ACT-15 should remain untouched.

## Verification Evidence

- Focused Task 10 suite: 35/35 passed across three files.
- Full unit suite: 426/426 passed across 29 files.
- Isolated production build:

```text
npm run build -- --outDir /tmp/tiny-fangs-task10-build.QAztb8
✓ 33 modules transformed.
✓ built in 296ms
```

- `tldr diagnostics tests/engine-action-contracts.test.js`: 0 errors, 0 warnings.
- `tldr diagnostics tests/engine-turn-status-contracts.test.js`: 0 errors, 0 warnings.
- `tldr diagnostics tests/solo-ai-turn-contracts.test.js`: 0 errors, 0 warnings.

## Boundaries Preserved

- No behavior was inferred from fixtures when a real factory/effect/action path existed.
- No test reimplemented damage, status, mana, draw, result, or AI execution rules.
- No production behavior was changed merely because it lacked coverage.
- The two contradictions are explicit RED contracts, not silently accepted event arrays.
- No browser/UI lane is represented as closed by engine-only evidence.
- No existing dirty workspace changes were reverted, overwritten, staged, or committed.

## Follow-Up for an Authorized Production-Fix Task

1. Prevent `executeAction` from appending a second deck-out result already emitted by `endTurn`.
2. Remove Last Breath's branch-local duplicate reveal while retaining the generic trigger reveal.
3. Convert both `it.fails` sentinels to ordinary `it` tests.
4. Run the focused/full unit suites and all solo/multiplayer result/reveal browser journeys.

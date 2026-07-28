---
date: 2026-07-27T16:54:31-04:00
task_number: 09
task_total: 16
status: success
---

# Task Handoff: Solo Setup, Deck, Difficulty, Coin, and Start E2E

## Task Summary

Added a deterministic mounted-browser regression lane for the complete classic solo setup journey: mode selection, five player decks, five rival decks, both real Random controls, deck previews, Pup/Hunter propagation, coin outcomes, turn choices, first-turn ownership/attack rules, and animation-before-board ordering. Fixed the one production defect directly proven by RED: deck preview timers survived `pointercancel`.

The shared behavior matrix was intentionally not edited because the parent requested conflict-free matrix ownership. Exact recommended row updates appear below.

## What Was Done

- Added 12 Playwright tests against the real mounted classic application.
- Covered desktop keyboard/mouse and a 390×844 touch-enabled mobile context.
- Asserted Solo exposes exactly five real deck controls, one Random control, Pup/Hunter, and no multiplayer lobby.
- Parameterized Shadow, Fang, Venom, Swarm, and Shell through both player and rival controls and compared the complete resulting browser-state deck inventories with the authoritative `DECKS` definitions.
- Drove both real Random controls with a deterministic `BrowserContext.addInitScript()` sequence:
  - player `0.61` resolved through production to Swarm;
  - rival `0.99` resolved through production to Shell;
  - the test observed each actual `Math.random()` call before inspecting the resulting real deck inventories.
- Covered immediate desktop hover preview, the exact mobile 399/400 ms hold boundary, release cleanup, cancellation cleanup, repeated use, and exactly one preview.
- Propagated selected Pup/Hunter values into real started games. Complete fixed-order/scored AI execution is independently covered by the concurrently landed `tests/solo-ai-turn-contracts.test.js`.
- Covered the full player-won toss matrix:
  - Heads → Go First;
  - Heads → Go Second;
  - Tails → Go First;
  - Tails → Go Second.
- Covered both player-loss branches and both AI decisions:
  - Heads loses to Tails; AI elects to go first;
  - Tails loses to Heads; AI elects the player to go first.
- Proved the first global player sees a disabled Attack control and the real browser dispatcher returns `Cannot attack on first turn` without changing attack state.
- Proved the second player can attack after the opening AI turn: the real scheduled Hunter turn completes, `firstTurn` clears, Attack enables, and the real browser action sets `hasAttacked`.
- Proved the coin overlay remains mounted and game state remains absent through 1,779 ms, then resolves at 1,780 ms.
- Proved the losing-player announcement remains mounted for 1,499 ms and begins the game only at 1,500 ms.
- Proved the Begin overlay remains mounted, hand stays empty, and game state stays absent through 1,329 ms; only after the final millisecond does the overlay leave, authoritative state appear, and the five-card hand render.
- Added `pointercancel="deckRelease?.()"` to only the five real previewable deck controls.

## Files Modified

- `index.html:65,70,75,80,85` - Routes `pointercancel` through the existing deck preview timer/overlay cleanup.
- `tests/e2e/solo-setup.spec.js:1-651` - Deterministic desktop/mobile setup, deck, preview, difficulty, toss, owner, attack-rule, and animation-order browser suite.
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-09-solo-setup-e2e.md` - This handoff.

No render, stylesheet, package, lockfile, Playwright config, workflow, server, shared engine, goal ledger, or shared behavior matrix file was edited by Task 09.

## Decisions Made

- **Mounted real path:** Tests click/tap the actual controls and inspect the browser's imported `state` and `DECKS` modules. No random-selection algorithm was copied and no production test API was added.
- **Deterministic randomness:** One context init script supplies only the exact branch-driving prefix, then falls back to a seeded PRNG for real UID/shuffle work. The trace proves Random controls consumed the expected real calls.
- **Deterministic time:** Playwright Clock is installed before navigation and explicitly paused after application readiness. `runFor()` drives each exact threshold and ordered animation Promise.
- **Classic regression lock:** The suite uses `?presentation=classic`; it protects the authoritative pre-overhaul behavior while the AAA presentation is being built concurrently.
- **Smallest production fix:** Existing `deckRelease()` already clears the timer and preview. Adding the five missing inline `pointercancel` bindings was sufficient; no input-handler refactor was introduced.
- **No redundant AI test:** A small Task 09 AI routing unit stub was removed after the concurrent rules lane landed stronger complete-turn Pup/Hunter coverage.
- **No reduced-motion claim:** The application still has no reduced-motion implementation, so Task 09 did not invent one or claim that portion of SET-13/RSP-08.

## Recommended Behavior-Matrix Updates

The parent should apply these after concurrent lanes settle:

- **SET-01 → covered:** desktop keyboard and mobile touch both prove exact Solo setup visibility and multiplayer-lobby hiding.
- **SET-02 → unchanged (`covered`).**
- **SET-03 → remain `missing`:** all five controls and exact resulting decks are directly proven in solo, but the row's stated new target also requires all five through multiplayer; that five-way multiplayer parameterization remains outstanding.
- **SET-04 → covered:** both mounted Random controls consume deterministic real randomness and resolve to valid authoritative decks.
- **SET-05 → covered:** desktop hover plus exact mobile hold/release and repeat cleanup.
- **SET-06 → covered:** direct `pointercancel` characterization is now GREEN after the minimal binding fix.
- **SET-07 → covered:** browser selection reaches `aiDifficulty` 1/2; `tests/solo-ai-turn-contracts.test.js` directly proves fixed-order versus scored complete-turn routing.
- **SET-08 → covered:** all five rival controls and Random resolve and traverse selector → Coin Flip → started state.
- **SET-09 → covered:** Heads/Tails each exercise deterministic win and loss branches.
- **SET-10 → covered:** exact Heads/Tails × Go First/Go Second browser matrix, owner state, disabled/rejected first-global-turn attack, and enabled/successful second-player attack.
- **SET-11 → covered:** both AI toss choices, announcements, auto-start routes, and resulting owner states.
- **SET-12 → unchanged (`covered`).**
- **SET-13 → remain `missing`:** solo coin and Begin ordering are directly proven, but multiplayer coin-to-board ordering and reduced-motion behavior remain unproved/unimplemented.

## TDD Verification

- [x] Browser test was written before the production correction.
- [x] Intended RED observed after the fake clock was paused: `pointerdown → pointercancel` still produced one stale preview at the exact 400 ms deadline.
- [x] Minimal GREEN: focused pointer-cancel test passed after the five bindings.
- [x] Strengthened focused Go Second/attack-enable path passed.
- [x] Final Task 09 Playwright lane:

```text
npx playwright test tests/e2e/solo-setup.spec.js --project=e2e --workers=1
12 passed (11.4s)
```

- [x] Focused AI/first-turn rule support:

```text
npx vitest --run tests/solo-ai-turn-contracts.test.js tests/engine-action-contracts.test.js tests/engine-turn-status-contracts.test.js
3 files passed
35 tests passed
```

- [x] A clean full-unit snapshot before the concurrent Task12 registry edit:

```text
npm test -- --run
29 files passed
426 tests passed
```

- [x] Refactoring and strengthened coverage retained Task 09 GREEN.

## Concurrent Full-Suite Snapshot

The final redundant full-unit invocation occurred while Task12 was editing fixture tests and registry code:

```text
26 files passed, 3 files failed
425 tests passed, 18 failed
```

All 18 failures were outside Task 09 and were the same concurrent fixture mismatch: tests expected `normal-attack`, `retaliation`, `multi-hit`, `damage-reduction`, `healing`, `optional-trigger-pending`, and `skitter-response-pending`, while the in-flight registry still returned `Unknown visual fixture`. No Task 09 E2E, setup, AI-turn, engine-action, or engine-turn test failed. Per parent instruction, Task 09 did not edit or wait on Task12's concurrent files.

## Build and Code Quality

- Isolated production build passed:

```text
npx vite build --outDir /private/tmp/tiny-fangs-task09-build.BdnUrX --emptyOutDir
✓ 33 modules transformed
✓ built in 302ms
```

- `tldr diagnostics tests/e2e/solo-setup.spec.js`: 0 errors, 0 warnings.
- `tldr diagnostics index.html`: 0 errors, 0 warnings.
- `node --check tests/e2e/solo-setup.spec.js`: passed.
- Targeted `git diff --check` and new-file whitespace check: passed.
- No files were staged or committed.

## Issues Encountered

- The managed sandbox blocked Vite's local listener with `EPERM`; browser runs passed after using the approved localhost/Chromium execution path.
- `page.clock.install()` allows time to progress until explicitly paused. The first threshold run therefore opened before 399 ms; pausing after app readiness produced the intended exact RED.
- Rival options include deck icons before their names, so an initially anchored text locator could not find them. The locator was corrected without changing production.
- The first post-opening attack probe selected Cindermaw, whose real reveal extends playback. Selecting deterministic Emberfang kept the contract focused on attack enablement and completed through the real action path.
- Other agents used the shared WebSocket process during some runs. Task 09's solo assertions remained isolated by page context and did not depend on those rooms.

## Patterns/Learnings for Next Tasks

- Install Playwright Clock before navigation, then explicitly `pauseAt()` only after the mounted module globals are ready.
- For real random-path tests, inject an exact prefix plus seeded fallback and assert call consumption; compare final state with authoritative definitions instead of reimplementing selection or shuffle.
- Dynamic browser imports of `/src/state.js` and `/src/cards.js` observe the same mounted ESM instances without adding a production global.
- Keep multiplayer five-deck parameterization separate; SET-03 should not be marked fully covered from the solo lane alone.
- SET-13 still needs direct multiplayer coin-overlay/board-order evidence. Reduced-motion remains a separate missing contract.

## Next Task Context

Task09-owned behavior is complete and GREEN. The parent should apply the recommended matrix updates after the Task10/Task12 concurrent edits settle, retaining the two explicitly partial rows (SET-03 and SET-13) as `missing`.

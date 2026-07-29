---
date: 2026-07-27T17:20:36-04:00
task_number: 14
status: success
---

# Task Handoff: Classic Pointer, Touch, Keyboard, and Developer Input

## Task Summary

Added a deterministic mounted-browser regression lane for the classic app's pointer, touch, keyboard, hold, drag/drop, inspection, Escape, and developer-shortcut contracts. The production-blocking desktop lane runs at the canonical 1672×941 viewport and uses Playwright Clock instead of sleeps. Already-completed 390×844 touch checks are retained as useful deferred parity evidence, but mobile is no longer a Task 14 release gate.

Four directly proven input defects were fixed in `src/main.js`:

1. A movement of exactly 15 px did not enter drag mode.
2. `pointercancel` over a legal field target incorrectly executed the drop.
3. Non-hand card, grave-card, and own-Set hold timers survived platform cancellation.
4. Two independent keyboard listeners allowed overlay/input leakage: gameplay keys could mutate through an open modal, Escape did not close supported non-generic overlays, and a key that dismissed a trigger reveal could also execute a gameplay shortcut.

The shared behavior matrix and goal ledger were intentionally not edited. Recommended row updates appear below.

## Files Modified

- `src/main.js:962` — makes 15 px the inclusive drag boundary required by Task 14.
- `src/main.js:1002-1040` — releases any active pointer capture, makes cancellation cleanup-only, removes document drag listeners, clears timers, removes the proxy, clears highlights, and resets drag state.
- `src/main.js:2201-2208` — adds one document-level `pointercancel` cleanup path for hand/card, Set, and grave hold timers without changing generated markup.
- `src/main.js:2218-2293` — replaces two racing keydown listeners with one ordered input router:
  - Escape dismisses trigger, card-detail, rules, or generic modal independently of turn/winner state;
  - trigger-reveal dismissal consumes the key;
  - editable targets, winner, wrong-turn, animating, and blocking-overlay states prevent gameplay/developer routing;
  - existing `S/C/T/A/R/E` and `Ctrl+0–9` semantics remain in place.
- `tests/e2e/classic-input-regression.spec.js:1-925` — 12 mounted-browser tests with exact fake-clock boundaries and state/DOM/privacy assertions.
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-14-input-regression.md` — this handoff.

Task 14 did not edit `src/render.js`, `src/styles.css`, `index.html`, package/config/workflow files, server/shared engine files, fixture registry/names/tests, behavior matrix, goal ledger, or concurrent task-owned test files. A normal production build refreshed the already-dirty `dist/` output; the isolated build evidence below is the authoritative Task 14 build result.

## TDD Evidence

### RED

The first execution exposed two harness mistakes: touch was not enabled and the installed browser clock had not yet been paused. Those were corrected without production edits. The authoritative RED run then produced:

```text
npx playwright test tests/e2e/classic-input-regression.spec.js --project=e2e --workers=1
4 passed
8 failed
```

Expected production failures:

- Desktop and 390×844 touch: exactly 15 px produced zero drag proxies because production used `dist > 15`.
- Drag cancellation over the field summoned the card, spent mana, and changed authoritative state.
- Active/bench cancellation at 399 ms still opened card detail at 400 ms.
- Grave-card cancellation at 399 ms still opened card detail at 400 ms.
- Legal `E` changed turn/winner state through an already-open generic modal.
- Escape left the Rules modal open.

The four passing RED contracts were click/tap selection identity, exact 499/500 ms End Turn behavior, the initial developer shortcut/privacy table, and already-correct portions of drop/inspection behavior.

### GREEN

After the minimal `src/main.js` corrections:

```text
npx playwright test tests/e2e/classic-input-regression.spec.js --project=e2e --workers=1
12 passed (15.1s)
```

No `waitForTimeout` exists in the Task 14 suite. All 399/400 ms and 499/500 ms boundaries use Playwright Clock paused after mounted-app readiness.

## Desktop Release-Blocking Evidence

All default desktop pages and the explicit desktop boundary/End Turn variants run at the canonical 1672×941 viewport.

The canonical desktop lane directly proves:

- exact click selection and rerender identity;
- 14.99/15 px press-to-drag behavior;
- affordable, unaffordable, invalid, cancelled, active, bench, Cast, Set, and full-zone drag/drop paths;
- 399/400 ms hand, active, bench, and grave inspection timing;
- exact 499/500 ms End Turn behavior and single dispatch;
- `S/C/T/A/R/E`, editable/animation/turn/modal guards, Escape routing, and trigger-key consumption;
- all ten developer shortcuts and hidden-Set privacy.

No Task 14 desktop input blocker remains at 1672×941.

## Deferred Mobile Parity Evidence

The existing 390×844 touch checks remain GREEN for tap selection, the exact 15 px drag boundary, own-Set/opponent-Set privacy, grave cancellation, and exact End Turn timing. These checks are regression value only under the updated desktop-first scope; mobile-only omissions listed later do not block Task 14 completion.

## Direct Behavior Proof

- **INP-01 — covered:** desktop click toggles the same card on/off, selecting a different card replaces the exact UID, and 390×844 tap produces the same selected UID/CSS rerender.
- **INP-02 — covered to the explicit Task 14 contract:** 14.99 px remains an inspection press; exactly 15 px enters drag on desktop mouse and mobile touch. The current matrix wording says “at or below 15 px remains a press,” which conflicts with Task 14's explicit “at/above threshold initiates drag.” The parent should update the matrix wording when integrating this lane.
- **INP-03 — covered:** affordable drag creates the proxy and legal-field highlight; an unaffordable card gains the unavailable proxy treatment, never highlights the field, and cannot mutate state; outside-field release is a no-op.
- **INP-04 — covered:** real hit-testing routes creature-to-active, creature-to-bench, Cast-to-grave, and Set-to-face-down slot; a full bench rejects the creature with exact unchanged state.
- **INP-05 — covered:** cancellation after a real drag over a legal field produces zero action and removes document listeners by behavior, timer, proxy, highlight classes, pointer capture where present, and drag state. Advancing 400 ms produces no stale detail modal.
- **INP-06 — covered for requested locations:** hand, active, and bench detail remain closed at 399 ms and open at 400 ms; cancellation at 399 ms prevents the active-card detail from appearing.
- **INP-07 — covered:** 390×844 own Set remains closed at 399 ms, opens at 400 ms, and cancels cleanly; opponent Set has no pointer handlers, remains detail-free, and never exposes `Soul Trap`.
- **INP-08 — covered for the fixture-exposed own grave path:** grave hold is exact at 399/400 ms and `pointercancel` leaves no stale modal. The current inspection fixture does not populate the opponent grave, so the symmetric opponent-grave generated option remains an automated gap.
- **INP-09 — covered:** both desktop and 390×844 End Turn remain unchanged at 499 ms and dispatch exactly once at 500 ms.
- **INP-10 — partially strengthened:** post-threshold pointerup followed by pointercancel cannot dispatch End Turn twice and both button variants clear `holding`. Pre-threshold pointerleave/cancel and every disabled/wrong-turn/animating button combination remain for a dedicated cancellation table.
- **INP-11 — covered for Task 14 scope:** `S/C/T` produce option-for-option modal parity with visible controls; `R` produces the same replacement modal; `A` produces the expected `-10`, lunge, and screen-flash semantic payload; `E` changes turn through the legal keyboard path. All six keys are blocked by the same open-modal guard; editable, animating, and wrong-turn guards are directly exercised through that single router.
- **INP-12 — partially covered:** Escape closes generic, rules, card-detail, and trigger overlays without board mutation and no longer depends on the player-turn guard. Setup/result/response-specific Escape policy remains intentionally unclaimed.
- **INP-13 — covered:** `Ctrl+1–9` each produce one expected semantic animation and one exact debug-log entry; `Ctrl+0` opens the expected test reveal. Wrong-turn debug input is a safe no-op. The opponent Set is `{faceDown:true}`, QA metadata omits its identity, and neither `Soul Trap` nor its ID appears in detail/reveal surfaces.
- **INP-14 — covered:** each of `S/C/T/A/R/E` dismisses an open trigger reveal and is consumed before gameplay routing; public board state remains unchanged.
- **Adjacent OVR-03/OVR-04 — partial evidence only:** Escape dismissal for Rules and card detail is direct, but full open/button/backdrop/content matrices belong to the overlay lane.

## Privacy Evidence

- Opponent Set client state is asserted as exactly `{ faceDown: true }`.
- QA stable metadata is asserted not to contain `soulTrap` or `Soul Trap`.
- The non-owner Set has no `onpointerdown` or `onpointerup`.
- The debug reveal shows the fixed semantic developer card (`Phantom Wall`) and is asserted not to show the fixture's hidden `Soul Trap`.
- Trigger-dismiss/gameplay-key tests compare both complete public player projections before and after every key.
- Existing real multiplayer privacy regression retained GREEN:

```text
npx playwright test tests/e2e/multiplayer/set-privacy.spec.js --project=multiplayer --workers=1
1 passed (9.4s)
```

## Adjacent Regression Evidence

```text
npm test -- --run tests/render.test.js tests/presentation/behavior-order-characterization.test.js
2 files passed
47 tests passed
```

```text
npx playwright test tests/e2e/solo-setup.spec.js tests/e2e/classic-input-regression.spec.js --project=e2e --workers=1
24 passed (24.6s)
```

The settled full-unit snapshot is clean:

```text
npm test -- --run
31 files passed
526 tests passed
```

An earlier concurrent full-unit snapshot reported only the intentional Task 18 RED tests in `event-playback-hardening.test.js` (517 passed, 9 failed). The Task 18 owner completed that independent lane, after which Task 14 reran and recorded the clean 526/526 result above.

## Build, Syntax, and Diagnostics

Isolated production build:

```text
npx vite build --outDir /private/tmp/tiny-fangs-task14-build.oVqqII --emptyOutDir
✓ 33 modules transformed
✓ built in 298ms
```

Additional checks:

- `node --check src/main.js` — passed.
- `node --check tests/e2e/classic-input-regression.spec.js` — passed.
- `tldr diagnostics src/main.js` — 0 errors, 0 warnings.
- `tldr diagnostics tests/e2e/classic-input-regression.spec.js` — 0 errors, 0 warnings.
- Targeted `git diff --check` — passed.
- `rg "waitForTimeout" tests/e2e/classic-input-regression.spec.js` — no matches.
- No files were staged or committed.

## Deferred Mobile and Manual Gaps

None of the following blocks the desktop-first 1672×941 release:

- Automated touch coverage is Chromium pointer/touch emulation at 390×844. Real iOS Safari and Android Chrome implicit pointer-capture behavior still needs device/manual confirmation.
- Landscape 844×390 and the 899/900 responsive boundary are owned by the responsive lane, not this input lane.
- The fixture-exposed grave test covers the player's grave only; opponent-grave hold/cancel should be added when a deterministic fixture exposes an opponent grave entry.
- End Turn still needs a dedicated pre-threshold pointerleave/pointercancel and disabled/wrong-turn/animating cross-product if INP-10 is to be marked fully covered.
- Escape intentionally does not dismiss the response modal or terminal result. Those choices can carry semantic consequences and need the overlay/optional-decision lane to define their policy.
- Keyboard focus management and accessibility focus containment are outside Task 14 and remain part of RSP-05.

## Concurrency Notes

- Task 14 worked in the shared dirty tree and preserved all pre-existing and concurrent edits.
- `src/main.js` already contained the fixture/presentation activation work before Task 14; those lines are not Task 14-owned.
- Task 18 independently changed `src/event-playback.js` and its tests while Task 14 was verifying. There was no file overlap.
- The responsive agent remained active during final Task 14 checks; Task 14 did not edit its files or the shared behavior matrix/goal ledger.

## Parent Integration

The parent should:

1. Update the matrix with the row dispositions above, explicitly correcting INP-02 to the requested inclusive 15 px boundary.
2. Keep INP-10 and INP-12 partial/missing unless the remaining cross-product and policy cases are added.
3. Record Task 14 as accomplished in the living goal ledger.
4. Preserve the Task 14 `src/main.js` input changes when later presentation refactors replace the classic DOM.

---
date: 2026-07-27T16:30:46-04:00
task_number: 07
task_total: 16
status: success
---

# Task Handoff: Real Two-Browser Set Privacy E2E

## Task Summary

Added a real Chromium, real local-WebSocket, two-isolated-context regression that proves an opponent's face-down Set Verse remains opaque from owner placement through a stable pre-trigger state. The owner retains the complete card and can inspect it; the non-owner receives only exact opaque presence, renders only the generic non-interactive back, and cannot recover identity from browser-observable presentation surfaces.

No production code changed. Task 01's privacy correction passed the live browser boundary without further redaction.

## Files Added

- `tests/e2e/multiplayer/set-privacy.spec.js`
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-07-multiplayer-privacy-e2e.md`

No package/lock, Playwright config, workflow, server, shared-engine, registry, renderer, stylesheet, or documentation source was edited.

## Scenario and Determinism

- Uses the existing serial `multiplayer` Playwright project, its two Playwright-owned local processes, and the real `?ws=ws://127.0.0.1:<port>` endpoint.
- Creates separate host and guest browser contexts.
- Selects fixed, disjoint decks:
  - host: `shell`;
  - guest: `shadow`.
- Both known decks contain Set Verses, while their Set identities are disjoint. This prevents the non-owner's own hand from legitimately containing the owner's identity sentinel.
- The server coin flip decides which browser is the owner/first player; the test derives that role from each real `gameStart` frame.
- If no affordable Set is in the owner's opening hand, the two real clients send valid alternating `endTurn` messages until the known deck yields one. The loop is bounded at 15 owner draws, which covers the complete post-opening deck.
- The owner opens the real Set modal and places the real affordable card through the UI.
- Capture begins immediately before that UI placement and ends only after the state, event playback, render, debug record, and browser-surface probes have reached a stable pre-trigger state.

The test intentionally stops before a rule-authorized trigger reveal. Task 07 permits either a later reveal boundary or a minimum stable pre-trigger boundary; this test locks the latter without weakening later reveal behavior.

## Locked Assertions

### Wire and protocol

- Owner `stateUpdate.state.me.setVerse` exactly equals the full chosen card.
- Non-owner `stateUpdate.state.opp.setVerse` exactly equals:

```js
{ faceDown: true }
```

- The marker's only key is `faceDown`.
- The non-owner's initial placement event exactly equals:

```js
{ type: 'setVerse', side: 'opp' }
```

- Every non-owner gameplay WebSocket payload captured after placement is checked against the owner's secret identity sentinels.

### Owner and non-owner UI

- Owner long-presses the real owned Set slot and sees the full name, trigger, and effect in the card-detail view.
- Non-owner sees a visible `.tf-card--set-down` with exact `[SET]` text and `.tf-card__set-back`.
- The opponent Set element has no `onclick`, `onpointerdown`, `onpointerup`, or `onpointerleave` binding.
- A real 450 ms pointer hold on the opponent Set does not open the card-detail modal.

### Leak surfaces

The owner's unique `uid`, catalog `id`, name, ASCII art, and flavor text are treated as secret sentinels. Case-insensitive absence is asserted across:

- all non-owner gameplay WebSocket frames captured after placement;
- rendered DOM HTML;
- rendered DOM text;
- Playwright's direct accessibility snapshot;
- visual-QA contract keys, fixture names, readiness metadata, and the global readiness flag;
- serialized browser debug output;
- every URL observed by Playwright's request listener;
- declared preload/prefetch/image/source metadata;
- browser resource timing URLs.

### Direct debug-path coverage

- Both contexts set `localStorage.tinyFangsDebug = "1"` before application code runs.
- The non-owner directly records `[DEBUG] Playing events:` with `setVerse`.
- The same debug record is included in sentinel-absence assertions.

## Test-Only Browser Probe

Playwright can capture received WebSocket frames and accessibility state directly, but the application keeps its gameplay socket and structured console arguments inside module closure scope. A deterministic init-script probe therefore:

- wraps `window.WebSocket` before application code;
- records inbound/outbound serialized frames;
- retains the real native socket and protocol;
- exposes a test-only `send()` helper for bounded turn advancement;
- wraps console methods to serialize structured arguments before DevTools formatting can reduce them to `[object Object]`;
- enables `tinyFangsDebug`;
- exposes only `window.__TINY_FANGS_PRIVACY_PROBE__` inside the test page.

The probe is injected by Playwright and does not exist in production source or builds.

## TDD Evidence

### RED 1: canonical WebSocket URL

The first focused run started the real Vite and WebSocket processes and a real room, but timed out waiting for `gameStart`. Playwright canonicalized the socket URL as `ws://127.0.0.1:3101/`, while the test filtered on the non-canonical no-slash form.

Fix: derive the capture key with `new URL(wsEndpoint).href`.

### RED 2: multiplayer coin-animation race

The second focused run reached the real game and advanced turns, but the chosen cost-two Set remained disabled in the owner's UI. The test had waited for `#desktop`, which is already visible beneath setup at desktop breakpoints, so it advanced server turns while the asynchronous multiplayer coin animation was still running. The later `startMultiplayerGame()` then replaced the client with the initial state.

Fix: wait for `#setup` to become hidden on both clients, then synchronize owner turn, hand count, turn number, and mana-pip count to the captured authoritative state before opening the Set modal.

### GREEN

The focused real-browser run then passed:

```text
npm run test:e2e:multiplayer -- tests/e2e/multiplayer/set-privacy.spec.js
1 passed
```

A second focused invocation also passed and exercised the opposite coin-flip owner. The nested npm command did not forward the requested repeat count, so this is reported as two successful focused runs, not a five-run stress result.

No privacy failure was observed and no production correction was needed.

## Verification Evidence

- Focused real-browser privacy E2E: passed twice, one test each time.
- Both observed coin-flip ownership paths were exercised across those successful runs.
- `npm test -- --run`: 389/389 passed across 25 files.
- Isolated production build:

```text
npm run build -- --outDir /private/tmp/tiny-fangs-task07-build.0Hunwh --emptyOutDir
✓ built in 303ms
```

- `tldr diagnostics tests/e2e/multiplayer/set-privacy.spec.js`: 0 errors, 0 warnings.
- `node --check tests/e2e/multiplayer/set-privacy.spec.js`: passed.
- `git diff --check`: passed.
- Trailing-whitespace/conflict-marker scan of the new spec: no findings.

## Environment Note

The managed sandbox blocks local listeners with `EPERM`; focused browser runs required localhost permission, as documented by Task 02. After the two successful focused runs, an attempted multi-repeat stress invocation and a later redundant rerun were denied by the environment's approval-usage limit. No required Task 07 gate remains unverified: the final spec content is the exact content from the successful focused run, and unit, isolated build, syntax, diagnostics, and diff checks all passed afterward.

## Boundaries Preserved

- No hidden card data was added to the opponent marker, event, DOM, labels, metadata, debug output, or asset URLs.
- No production test hook or state exposure was added.
- No later rule-authorized trigger/cast reveal contract changed.
- No gameplay rule, event order, room protocol, endpoint selection, or rendering implementation changed.
- No user-owned dirty work was reverted or overwritten.
- Nothing was staged or committed.

## Next Task Context

- Keep `tests/e2e/multiplayer/set-privacy.spec.js` in the serial one-worker multiplayer project.
- Future presentation renderers must preserve the generic opponent Set back and its lack of interaction bindings.
- Future face-art loaders and preloaders must remain keyed only from information available to the viewer; this test will fail if a hidden face identity appears in a requested URL or preload/resource entry.
- Later reveal-specific coverage may be added as a separate rule-trigger scenario. It must assert identity appears only after the authoritative reveal event, never by weakening this pre-trigger test.

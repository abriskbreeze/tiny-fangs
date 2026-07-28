---
date: 2026-07-27T15:57:55-04:00
task_number: 01
task_total: 16
status: success
---

# Task Handoff: Make Opponent Set State Opaque

## Task Summary

Close both pre-reveal opponent Set identity leaks with the smallest authorized protocol correction. Opponent projected state now exposes only exact opaque presence, and the initial placement event carries only its type and side. Own Set state, authoritative game state, public fields, gameplay rules, and later rule-authorized reveal events remain unchanged.

## What Was Done

- Replaced the opponent Set object spread in `getStateForPlayer()` with exact `{ faceDown: true }` presence.
- Removed the hidden card name from the initial `setVerse` placement event.
- Added symmetric server-projection tests for both player indexes.
- Added projection coverage for exact allowlisting, sentinel-field absence, absent Sets, complete own Sets, unchanged public fields, and authoritative-state immutability.
- Added a direct engine event test requiring exact `{ type: "setVerse", side }`.
- Reconfirmed the existing later-reveal assertion: a triggered Mana Drain event still contains its rule-authorized identity.

## Files Modified

- `server/GameEngine.js:147` - Projects an opponent Set as exact `{ faceDown: true }` or `null`.
- `shared/engine.js:1407` - Emits an identity-free initial placement event.
- `tests/server/game-engine.test.js:1-116` - Adds direct privacy-boundary regression coverage.
- `tests/engine.test.js:2-12,205-217` - Adds the initial placement-event contract.
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-01-set-privacy.md` - Records implementation and verification evidence.

## Locked Data Contracts

Projected opponent Set:

```js
null
```

or:

```js
{ faceDown: true }
```

Initial placement event:

```js
{ type: 'setVerse', side }
```

The owner continues to receive the complete Set object in `me.setVerse`. `triggerVerse` events retain identity only after game rules reveal the card.

## Consumer Trace

- `server/index.js:98-123` calls `getStateForPlayer()` for every `stateUpdate`.
- `server/index.js:126-143` remaps event perspective without reintroducing removed fields.
- `server/index.js:247-258` uses the same projection for `gameStart`.
- `src/mp-client.js:138-183` passes the opaque marker through without requiring identity.
- `src/render.js:87-98` uses Set truthiness only and renders a generic face-down card.
- `src/main.js:790-793` passes opponent Sets to the non-interactive face-down renderer.
- `src/event-playback.js:67-72` uses only event type and side for initial Set animation.
- `tests/engine.test.js:590-603` proves a later rule-authorized `triggerVerse` still reports `Mana Drain`.

## TDD Verification

- [x] Tests were written before production changes.
- [x] RED observed:
  - both opponent projections returned the full 15-field secret object instead of exact opaque presence;
  - initial placement returned `{ type, side, verse: "Brace" }`;
  - focused result was 3 failed and 44 passed.
- [x] GREEN observed:
  - `npm test -- --run tests/server/game-engine.test.js tests/engine.test.js`;
  - 47/47 focused tests passed.
- [x] Full suite:
  - `npm test -- --run`;
  - 318/318 tests passed across 15 files.
- [x] No refactor was needed after GREEN.

## Code Quality

- `tldr diagnostics server/GameEngine.js` - 0 errors, 0 warnings.
- `tldr diagnostics shared/engine.js` - 0 errors, 0 warnings.
- `tldr diagnostics tests/engine.test.js` - 0 errors, 0 warnings.
- `tldr diagnostics tests/server/game-engine.test.js` - 0 errors, 0 warnings.
- `git diff --check` passes.

## Build Verification

- `npm run build -- --outDir /private/tmp/tiny-fangs-task-01-build.JgHJEz --emptyOutDir` passed with Vite 6.4.1.
- Build output stayed outside the repository.

## Boundaries Preserved

- No edits to `src/render.js`, `src/styles.css`, `docs/`, package files, `server/index.js`, or Playwright configuration.
- No gameplay rule, event order, or other protocol field changed.
- No staging or commit was performed.
- Pre-existing dirty presentation work remains untouched.

## Residual Verification

Direct state and event contracts are complete. Captured two-browser WebSocket-frame, DOM, accessibility, preload, asset-request, and debug-output privacy checks remain a later Phase 1 task after the Playwright/server harness exists; they were intentionally not introduced by this isolated correction.

## Next Task Context

The opponent Set marker can now be treated as opaque truthy presence throughout presentation work. Do not add identity fields back to the marker or the initial placement event. Manifest/card-face work may proceed independently once the stable runtime face identity contract is implemented.

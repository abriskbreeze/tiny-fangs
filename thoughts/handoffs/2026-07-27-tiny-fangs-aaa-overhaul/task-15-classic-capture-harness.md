---
date: 2026-07-27T17:12:00-04:00
task_number: 15
task_total: 16
status: success
---

# Task Handoff: Exhaustive Classic Capture Harness

## Task Summary

Completed the deterministic `classic-v1` visual capture harness and immutable
baseline evidence for all 17 authoritative visual fixtures.

The harness opens the real application route for every fixture:

```text
/?presentation=classic&visualQa=1&fixture=<fixture-name>
```

Each capture uses Chromium at a 1672 by 941 CSS-pixel viewport and DPR 1. It
waits for all of the following before taking the screenshot:

- `window.__TINY_FANGS_VISUAL_READY__ === true`;
- the QA controller reports ready with `lastResetReason === "route"`;
- `document.fonts.ready` resolves and `document.fonts.status === "loaded"`;
- page navigation reaches network idle;
- every document image is complete and has non-zero natural width;
- there are no failed requests, HTTP errors, page errors, or console errors.

No gameplay, renderer, stylesheet, fixture registry, application shell,
package/config, server, reference image, goal ledger, plan, or behavior matrix
file was edited.

## Files Added

- `tests/visual/classic-capture.visual.spec.js`
- `tests/visual/baselines/classic-v1/manifest.json`
- `tests/visual/baselines/classic-v1/screenshots/damage-reduction.png`
- `tests/visual/baselines/classic-v1/screenshots/deck-out.png`
- `tests/visual/baselines/classic-v1/screenshots/defeat.png`
- `tests/visual/baselines/classic-v1/screenshots/dense-board-statuses.png`
- `tests/visual/baselines/classic-v1/screenshots/healing.png`
- `tests/visual/baselines/classic-v1/screenshots/inspection-overlays.png`
- `tests/visual/baselines/classic-v1/screenshots/ko-promotion.png`
- `tests/visual/baselines/classic-v1/screenshots/multi-hit.png`
- `tests/visual/baselines/classic-v1/screenshots/multiplayer-hidden.png`
- `tests/visual/baselines/classic-v1/screenshots/normal-attack.png`
- `tests/visual/baselines/classic-v1/screenshots/opening-empty-board.png`
- `tests/visual/baselines/classic-v1/screenshots/opening-hand-triad.png`
- `tests/visual/baselines/classic-v1/screenshots/optional-trigger-pending.png`
- `tests/visual/baselines/classic-v1/screenshots/retaliation.png`
- `tests/visual/baselines/classic-v1/screenshots/skitter-response-pending.png`
- `tests/visual/baselines/classic-v1/screenshots/target-selection.png`
- `tests/visual/baselines/classic-v1/screenshots/victory.png`
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-15-classic-capture-harness.md`

No file was staged or committed. `src/presentation/testing/capture-manifest.js`
did not require a change.

## Baseline Inventory

- Baseline ID: `classic-v1`
- Fixture count: 17
- Fixture-list SHA-256:
  `8bf420dabccc30389a6f2a3310faf180933333cb1dc88c32074252968e089d24`
- Manifest size: 217,106 bytes
- Manifest SHA-256:
  `099e83259c259aa9e6b72cf211cd7d1383380baeb7ff7967c12a221f84b4d11d`
- PNG count: 17
- Unique PNG hashes: 17
- Baseline directory size: 13 MB
- PNG dimensions: exactly 1672 by 941 for every record
- Recorded browser: Chromium `149.0.7827.55`
- Recorded DPR: 1

Every fixture has its own public-state SHA-256 and PNG SHA-256 in the manifest.
The contract test recomputes both rather than trusting recorded values.

## Manifest Schema

The top-level manifest records:

- `schemaVersion`
- `baselineId`
- `fixtureInventory`
  - exact sorted names
  - count
  - SHA-256 of the newline-delimited fixture list
- `captureSession`
  - browser name/version
  - viewport
  - DPR
  - presentation mode
  - capture timestamp
  - identity exclusions
  - screenshot portability boundary
- `limitations`
  - presentation metadata not consumed by classic rendering
  - explicit `visuallyCoveredByThisBaseline: false`
- `records`

Every fixture record contains:

- fixture name;
- privacy-safe stable fixture hash input;
- fixture SHA-256;
- screenshot relative path, SHA-256, and decoded PNG dimensions;
- browser name/version;
- viewport and DPR;
- presentation mode;
- exact route path and ordered query contract;
- readiness global, controller state, reset reason, and activation error;
- font readiness;
- image, failed-request, and HTTP-error inventories;
- page/console error inventories;
- privacy sentinel counts and leakage results;
- capture timestamp.

`captureSession.capturedAt` and `records[*].capturedAt` are explicitly excluded
from deterministic identity. All other recorded evidence is compared exactly.

## Determinism Contract

The test fails if any of these conditions occur:

- fixture record missing, duplicated, added, removed, or reordered;
- fixture inventory count, name list, or inventory hash mismatch;
- stable fixture hash input or its SHA-256 changes;
- screenshot file missing, bytes changed, hash changed, or PNG dimensions differ;
- viewport, DPR, presentation mode, browser name, or browser version differ;
- route path or ordered query string differs;
- global/controller readiness is not exactly true;
- reset reason is not exactly `route`;
- font status is not exactly `loaded`;
- an image is incomplete;
- a request fails or receives an HTTP error;
- a page error or console error is emitted;
- any tested private UID or owner-only response key leaks.

The immutable run passed twice from separate Vite/WebSocket server processes.
All 17 fixture PNG hashes matched on both runs.

PNG bytes are intentionally not claimed portable across different browser
versions, operating systems, installed fonts, or graphics stacks. The manifest
records this boundary and locks exact byte identity to its captured provenance.

## Privacy Evidence

For every fixture, the harness reconstructs the authoritative fixture in Node
and derives private UID sentinels from:

- opponent deck;
- opponent hand;
- opponent Set;
- owner Set where the fixture marks that path hidden.

It then proves no private sentinel appears in the browser-exposed
`stableHashInput`. For owner-only response fixtures it additionally proves the
keys `pendingAction` and `benchOptions` do not appear.

Across the 17 records:

- 17 of 17 have no private UID leakage;
- 17 of 17 have no owner-only response-key leakage;
- 17 of 17 have no failed images, failed requests, or HTTP errors;
- 17 of 17 have no page or console errors;
- 17 of 17 have exact readiness true;
- 17 of 17 have font status loaded.

The manifest never stores the private sentinel values themselves.

## TDD Evidence

### RED

Command:

```text
TINY_FANGS_VITE_PORT=4185 TINY_FANGS_WS_PORT=3115 \
  npx playwright test tests/visual/classic-capture.visual.spec.js \
  --project=visual --workers=1
```

Result:

```text
2 failed
```

Both tests failed for the intended reason: the versioned
`classic-v1/manifest.json` and screenshots did not exist. The local servers
required loopback-bind escalation after the sandbox correctly returned
`listen EPERM`.

### Baseline generation

Command:

```text
UPDATE_CLASSIC_BASELINES=1 \
TINY_FANGS_VITE_PORT=4186 TINY_FANGS_WS_PORT=3116 \
  npx playwright test tests/visual/classic-capture.visual.spec.js \
  --project=visual --workers=1
```

Result:

```text
1 passed
1 skipped
```

The skipped test is the immutable-baseline validator; generation itself
performs the same canonical per-record assertions before writing.

### Immutable GREEN, first run

Command:

```text
TINY_FANGS_VITE_PORT=4188 TINY_FANGS_WS_PORT=3118 \
  npx playwright test tests/visual/classic-capture.visual.spec.js \
  --project=visual --workers=1
```

Result:

```text
2 passed
```

### Immutable GREEN, fresh-process repeat

Command:

```text
TINY_FANGS_VITE_PORT=4189 TINY_FANGS_WS_PORT=3119 \
  npx playwright test tests/visual/classic-capture.visual.spec.js \
  --project=visual --workers=1
```

Result:

```text
2 passed
```

### Complete visual project

Command:

```text
TINY_FANGS_VITE_PORT=4190 TINY_FANGS_WS_PORT=3120 npm run test:visual
```

Result:

```text
3 passed
```

This includes the two classic-v1 tests plus the existing classic route smoke
capture.

## Other Verification

### Focused fixture/manifest units

```text
npm test -- --run \
  tests/presentation/capture-manifest.test.js \
  tests/presentation/fixture-activation.test.js \
  tests/presentation/visual-fixtures.test.js

Test Files  3 passed (3)
Tests       54 passed (54)
```

### Full unit suite

```text
npm test -- --run

Test Files  29 passed (29)
Tests       462 passed (462)
```

### Isolated production build

```text
npm run build -- --outDir \
  /private/tmp/tiny-fangs-task15-build-20260727-1710

33 modules transformed
built in 798ms
```

The output stayed outside the repository. `dist` was not updated.

### Diagnostics and whitespace

```text
tldr diagnostics tests/visual/classic-capture.visual.spec.js

error_count   0
warning_count 0
```

`git diff --check` exited 0.

### Protected files

Prototype blobs remain unchanged:

```text
src/render.js  5ace20ad5155e96de3ede0e161cac7d90e7698be
src/styles.css f8b4c7f99cfb5392ba33d82c9b8bf63bf1d0f9ba
```

Reference copies still match the source attachments byte-for-byte:

```text
card  4ecb53d517d40edc5a7b4907e6991c6b8dcce40cc34e6a21c14b709ed2228056
board 5229e89ad2888ef9f3245d6ecd77605ec56a3cc29a6e378c4c7474659e4b79e7
```

## Explicit Classic Baseline Limitation

The current classic fixture route renders the fixture's game state but does
not consume these presentation metadata paths:

- `presentation.camera`
- `presentation.multiplayer`
- `presentation.overlay`
- `presentation.overlays`
- `presentation.response`
- `presentation.result`
- `presentation.statusLegend`
- `presentation.transition`

Therefore this baseline does **not** visually cover authored camera intent,
target-selection overlays, inspection/rules/detail/reveal overlays, transition
playback, optional/Skitter response surfaces, presentation-directed result
surfaces, multiplayer presentation intent, or status-legend UI. The manifest
states `visuallyCoveredByThisBaseline: false`; no missing surface is faked or
counted as covered.

The screenshots still capture meaningful underlying game-state differences,
and all 17 PNG hashes are unique. That does not upgrade the unconsumed
presentation metadata to visual coverage.

## Plan Checkbox Recommendation

The root agent can mark the Phase 1 checklist item for the exhaustive
`classic-v1` deterministic screenshot capture harness complete, including:

- all 17 registered fixtures;
- canonical 1672 by 941, DPR 1 capture;
- exact readiness/fonts/assets/error evidence;
- fixture and PNG SHA-256 inventory;
- immutable browser provenance;
- privacy sentinel checks;
- two fresh-process deterministic replays;
- the explicit classic metadata coverage limitation.

Do not mark the presentation-specific overlay/transition/result rendering
items complete. Those remain implementation and visual-evidence work for the
AAA renderer.

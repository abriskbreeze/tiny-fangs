# Task 17 — Classic responsive, rotation, and mode-resolution regression lane

## Status

Completed as a test-only characterization lane. No production, visual,
configuration, baseline, behavior-matrix, or goal-ledger file was changed.

The active product target is desktop-first at canonical 1672×941. The
1672×941 result and the other desktop widths are the release-relevant evidence
from this task. Mobile/tablet and rotation results are preserved deferred-port
evidence only; they are not blockers for the desktop AAA overhaul.

New files:

- `tests/e2e/classic-responsive-regression.spec.js`
- `tests/e2e/multiplayer/responsive-shell.spec.js`

## RED evidence and corrections

### Confirmed product gap: multiplayer start duplicates shells from 601–899 px

The first multiplayer boundary run asserted the intended one-shell CSS contract
at 601 px. It failed with:

```text
visible shells at multiplayer start width 601
Expected: ["mobile"]
Received: ["mobile", "desktop"]
```

The RED command used isolated ports:

```text
TINY_FANGS_VITE_PORT=4218 TINY_FANGS_WS_PORT=3218 \
npx playwright test tests/e2e/multiplayer/responsive-shell.spec.js \
  --project=multiplayer --workers=1
```

Failure-only screenshot, video, error context, and trace evidence is retained
under:

```text
test-results/task17-responsive-red-artifacts/e2e-multiplayer-responsive-caf17-inst-the-900px-CSS-boundary-multiplayer/
```

This is the known source mismatch, now frozen without a production fix:

- CSS: mobile below 900 px, desktop at/above 900 px.
- multiplayer start JavaScript: mobile at/below 600 px, desktop above 600 px.
- at 601–899 px JavaScript adds `style="display:flex"` to the desktop shell
  while CSS still displays mobile, so both shells are effective.

The final characterization expects the exact observed duplicate only at 601 and
899 px, plus one mobile shell at 599/600 and one desktop shell at 900/901.

### Test-design REDs, not product defects

The first rotation run tried to hit-test action centers while the intentionally
blocking Rules modal was open. It failed because the modal correctly owns the
hit-test layer. The final test proves the modal stays open across resize, then
dismisses it, proves all six actions are reachable, reopens it, and reasserts
state/hash/selection stability.

The first multiplayer privacy assertion also rejected `Soul Trap` everywhere.
That was too broad because a player may legitimately own that card in their own
hand. The final assertion derives each peer's private hand names from the other
browser and proves none appear in either shell of the viewer. This tests the
actual privacy boundary.

## Boundary evidence

| Width | Ordinary classic fixture | Multiplayer immediately after real start |
|---:|---|---|
| 599 | mobile only | mobile only |
| 600 | mobile only | mobile only |
| 601 | mobile only | **mobile + desktop (known gap)** |
| 899 | mobile only | **mobile + desktop (known gap)** |
| 900 | desktop only | desktop only |
| 901 | desktop only | desktop only |

Every ordinary fixture boundary also asserts no horizontal document overflow
and zero console/page errors.

## Required viewport evidence

Each row was exercised first on the real setup route and then on the mounted
`dense-board-statuses` fixture.

| Viewport | Effective shell | Setup overflow | Dense-board overflow | Six actions reachable | Public LP/mana/turn/hand/Set data | Opponent Set |
|---|---|---|---|---|---|---|
| 2560×1440 | desktop | none | none | yes | present | opaque, noninteractive |
| 1672×941 | desktop | none | none | yes | present | opaque, noninteractive |
| 1440×900 | desktop | none | none | yes | present | opaque, noninteractive |
| 1280×720 | desktop | none | none | yes | present | opaque, noninteractive |
| 1024×768 | desktop | none | none | yes | present | opaque, noninteractive |
| 768×1024 | mobile | none | none | yes | present | opaque, noninteractive |
| 844×390 | mobile | none | none | yes | present | opaque, noninteractive |
| 430×932 | mobile | none | none | yes | present | opaque, noninteractive |
| 390×844 | mobile | none | none | yes | present | opaque, noninteractive |
| 360×800 | mobile | none | none | yes | present | opaque, noninteractive |

“Reachable” is semantic and geometric: each effective-shell action exists
exactly once, can be scrolled into view, is visible, has positive geometry, has
its center inside the viewport, and owns the center hit-test when no modal is
blocking it.

The opponent Set contract asserts `[SET]`, no card identity, no click/pointer
handler, no role, and `tabIndex === -1`. Both visible and stale hidden shells are
checked for `Soul Trap`/`soulTrap` absence in the privacy-projected fixture.

## Rotation evidence

Two real mounted journeys rotate/resize through:

1. 430×932
2. 844×390
3. 899×800
4. 900×800
5. 430×932

The deterministic fixture journey preserves:

- serialized client game state;
- the exact public fixture `stableHashInput`;
- selected hand-card UID;
- an open Rules modal before and after each resize;
- one CSS-selected shell;
- no horizontal document overflow;
- all six reachable actions after dismissing the safe modal;
- no hidden opponent Set identity in either shell.

The solo journey uses the real setup UI: Solo → Fang → Shell rival → HEADS →
Go First, with deterministic browser randomness and clock control. It preserves
the serialized authoritative client game state, selected hand-card UID, and open
Rules modal through the same rotation sequence. No direct state injection is
used.

No drag operation is exercised in this lane.

## Real mode-resolution evidence

The browser test verifies across actual reloads:

- valid query `presentation=classic` overrides stored `aaa`;
- absent query falls back to stored `aaa`;
- invalid stored value safely resolves to `classic`;
- the resolved value is applied to
  `document.documentElement.dataset.presentation`;
- body class and sampled computed styles for body/setup/mobile/desktop are
  identical between current `classic` and current `aaa`, matching the Phase 0
  guarantee that the mode marker alone does not mutate classic presentation.

## Matrix coverage for root integration

| Row | Result | Evidence boundary |
|---|---|---|
| RSP-01 | covered | 599/600/601/899/900/901 ordinary fixture; exactly one CSS shell |
| RSP-02 | partial / known gap | real two-client starts at all six widths; duplicate shells frozen at 601/899, not fixed |
| RSP-03 | partial, desktop release evidence / deferred-port evidence | canonical 1672×941 and all requested desktop widths are clean; mobile/tablet results are preserved for the deferred port; overlays and result routes are outside this task |
| RSP-04 | deferred-port evidence | deterministic fixture + real-started solo resize/rotation preserve state/hash/selection/safe modal/action access; drag cleanup not exercised and rotation is not a desktop-release blocker |
| RSP-06 | covered | real query/storage/invalid-storage reload matrix plus root dataset and no-style-mutation checks |

Root should update the shared behavior matrix and goal ledger. This task did not
edit either file.

## Verification

Focused classic browser lane:

```text
TINY_FANGS_VITE_PORT=4217 TINY_FANGS_WS_PORT=3217 \
npx playwright test tests/e2e/classic-responsive-regression.spec.js \
  --project=e2e --workers=2

19 passed
```

Focused multiplayer characterization:

```text
TINY_FANGS_VITE_PORT=4218 TINY_FANGS_WS_PORT=3218 \
npx playwright test tests/e2e/multiplayer/responsive-shell.spec.js \
  --project=multiplayer --workers=1

1 passed
```

That single serial multiplayer test starts six independent real two-browser
games, one per boundary width.

Applicable units:

```text
npm test -- --run \
  tests/presentation/presentation-mode.test.js \
  tests/presentation/visual-qa-bootstrap.test.js \
  tests/presentation/fixture-activation.test.js

3 files passed; 39 tests passed
```

Full unit suite:

```text
npm test -- --run

31 files passed; 526 tests passed
```

Isolated production build:

```text
npm run build -- --outDir /private/tmp/tiny-fangs-task17.pZ6mTv

33 modules transformed; exit 0
```

Diagnostics:

```text
tldr diagnostics tests/e2e/classic-responsive-regression.spec.js
tldr diagnostics tests/e2e/multiplayer/responsive-shell.spec.js

0 errors; 0 warnings in both files
```

Also clean:

- `node --check` for both new test files
- `git diff --check` for both new test files and this handoff

## Known limitation

RSP-02 is intentionally not repaired here. The duplicate-shell interval remains
601–899 px for a multiplayer game started in that width range. This task proves
the state projected into both shells does not reveal the peer's private hand
names, but rendering two effective shells is still a responsive correctness and
usability defect for a later focused deferred-port fix. It is not a blocker for
the canonical 1672×941 desktop AAA release.

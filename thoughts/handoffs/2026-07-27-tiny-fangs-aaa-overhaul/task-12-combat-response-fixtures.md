---
date: 2026-07-27T17:00:57-04:00
task_number: 12
task_total: 16
status: success
---

# Task Handoff: Deterministic Combat and Response Fixtures

## Task Summary

Completed the deterministic combat/response fixture set required by Phase 1 of
the AAA presentation plan. The registry now publishes 17 sorted, stable fixture
names, including seven new fixtures built from real decks, catalog cards, and
the authoritative `shared/engine.js::attack` transition.

No render, style, shell, gameplay-engine, server, package, Playwright, workflow,
behavior-matrix, goal-ledger, or reference-image file was edited.

## Files Changed

- `src/presentation/testing/fixture-registry.js`
- `src/presentation/testing/visual-fixture-names.js`
- `tests/presentation/visual-fixtures.test.js`
- `tests/presentation/fixture-client-adapter.test.js`
- `tests/presentation/fixture-activation.test.js`
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-12-combat-response-fixtures.md`

No staging or commit operation was performed.

## Exact Fixture Inventory

The registry is lexicographically sorted and now contains:

1. `damage-reduction`
2. `deck-out`
3. `defeat`
4. `dense-board-statuses`
5. `healing`
6. `inspection-overlays`
7. `ko-promotion`
8. `multi-hit`
9. `multiplayer-hidden`
10. `normal-attack`
11. `opening-empty-board`
12. `opening-hand-triad`
13. `optional-trigger-pending`
14. `retaliation`
15. `skitter-response-pending`
16. `target-selection`
17. `victory`

The existing `ko-promotion` builder and its exact transition contract were left
unchanged.

## New Fixture Contracts

| Fixture | Real setup | Authoritative result captured |
|---|---|---|
| `normal-attack` | Fang Emberfang attacks Shadow Duskfang | Exact `attack` then `damage` events; Duskfang loses 25 HP |
| `retaliation` | Fang Emberfang attacks Venom Thornling | Exact attack, committed damage, Thorns reveal, and 10 retaliation damage order |
| `multi-hit` | Fang Cindermaw attacks Shell Bulwark | Two real Frenzy hits, two defender damage events, then canonical 10 Burnout self-damage |
| `damage-reduction` | Fang Emberfang attacks Shell Ironhide | Real Iron Skin `abilityTrigger`/`damageReduced` events and 15 committed damage |
| `healing` | Damaged Venom Leechling attacks Shadow Duskfang | Real Drain trigger and 15-point heal to canonical max HP |
| `optional-trigger-pending` | Fang attacks owner-view Shell Ironhide with Brace Set | Real unresolved `optionalTrigger` for owner side `p1`, including confirmable engine context |
| `skitter-response-pending` | Fang attacks owner-view Swarm Skitter with two legal bench creatures | Real unresolved `skitterSwap` response with exact canonical bench UIDs, names, and indices |

All state is produced through `createGame`; card instances come from the real
deck catalog; stable UIDs are assigned by the existing deterministic
normalizer. Presentation metadata contains only real card UIDs, canonical side
keys, and unmodified engine event/pending-action shapes.

Every fixture retains exactly 20 valid catalog cards per player across deck,
hand, active, bench, grave, and Set zones. Repeated builds serialize identically,
while all 17 fixture serializations remain distinct.

## Privacy Proof

Both pending-response fixtures keep their full engine response under
`presentation.response` for the owning fixture view, but declare that complete
path owner-only for stable/public serialization:

```text
presentation.response -> { ownerOnly: true }
```

The same fixture privacy contract collapses opponent zones before hashing:

```text
G.players.1.deck     -> { hidden: true }
G.players.1.hand     -> { hidden: true }
G.players.1.setVerse -> { faceDown: true }
```

`optional-trigger-pending` additionally collapses the owner's unresolved Set in
public metadata:

```text
G.players.0.setVerse -> { faceDown: true }
```

Direct `toStableHashInput(fixture)` tests and activation-controller public
metadata tests prove:

- no `pendingAction`, `benchOptions`, or optional prompt payload survives;
- every opponent deck/hand/Set UID is absent;
- the opaque `ownerOnly` marker remains;
- the owner-facing authoritative fixture still contains the real confirmable
  Brace response and legal Skitter choices.

The client adapter continues to project the opponent's deck/hand to counts and
the opponent Set to exactly `{ faceDown: true }`.

## TDD Evidence

### Initial RED

```text
npm test -- --run tests/presentation/visual-fixtures.test.js \
  tests/presentation/fixture-client-adapter.test.js \
  tests/presentation/fixture-activation.test.js

Test Files  3 failed (3)
Tests       18 failed | 26 passed (44)
```

Failures were caused by the exact missing registry inventory and the seven
unknown fixture names. No syntax/setup failure was involved.

### Privacy RED

After the fixture builders were green, a narrower privacy test intentionally
called `toStableHashInput` directly:

```text
npm test -- --run tests/presentation/visual-fixtures.test.js -t serializes

Test Files  1 failed (1)
Tests       2 failed | 21 skipped (23)
```

Both failures showed opponent-private UIDs in direct fixture serialization.
The fixture privacy declarations were then expanded to cover the opponent
deck/hand/Set paths as well as the owner-only response.

### Focused GREEN

```text
npm test -- --run tests/presentation/visual-fixtures.test.js \
  tests/presentation/fixture-client-adapter.test.js \
  tests/presentation/fixture-activation.test.js \
  tests/presentation/stable-serialization.test.js \
  tests/presentation/visual-qa-bootstrap.test.js

Test Files  5 passed (5)
Tests       73 passed (73)
```

The activation suite parameterizes all 17 names through the existing
clear/set/route/render/readiness controller seam. Unknown names still fail
before mutation and disabled QA mode remains inert.

## Plan and Matrix Coverage

The source plan and behavior matrix were deliberately not edited.

- The Phase 1 checklist item at plan lines 451-458 ("Add deterministic game
  fixtures" including attack, retaliation, multi-hit, damage reduction, heal,
  KO, promotion, optional trigger, and Skitter response) is now implementable as
  complete. KO/promotion was already present and remains stable; Task 12 added
  the other seven named cases.
- `RSP-09` gains broader direct fixture inventory, deterministic activation,
  privacy, stable-hash, and readiness evidence.
- `ACT-08` gains deterministic visual-fixture inputs for normal attack,
  retaliation, multi-hit, reduction, and healing, but must remain missing until
  the D/M/L browser playback variants are proven.
- `OVR-08`, `OVR-09`, and `MP-15` must remain missing. These fixtures define
  deterministic owner-facing response states; they do not prove solo modal
  dispatch or two-client server delivery authority.
- Exhaustive screenshot baselines, capture hashes, and browser-version/DPR
  manifests remain the next Phase 1 boundary.

## Verification Evidence

### Full unit suite

```text
npm test -- --run

Test Files  29 passed (29)
Tests       462 passed (462)
```

### Isolated production build

```text
npm run build -- --outDir /private/tmp/tiny-fangs-task12-build.tu1jZ8

✓ 33 modules transformed.
✓ built in 298ms
```

The output directory was outside the repository, so the tracked/dirty `dist`
tree was not overwritten.

### Diagnostics and whitespace

`tldr diagnostics` reported 0 errors and 0 warnings for each changed JavaScript
file:

- `src/presentation/testing/fixture-registry.js`
- `src/presentation/testing/visual-fixture-names.js`
- `tests/presentation/visual-fixtures.test.js`
- `tests/presentation/fixture-client-adapter.test.js`
- `tests/presentation/fixture-activation.test.js`

`git diff --check` exited 0.

### Protected artifacts

Reference copies still match the original attachments byte-for-byte:

```text
card  4ecb53d517d40edc5a7b4907e6991c6b8dcce40cc34e6a21c14b709ed2228056
board 5229e89ad2888ef9f3245d6ecd77605ec56a3cc29a6e378c4c7474659e4b79e7
```

Protected prototype blobs remain unchanged:

```text
src/render.js  5ace20ad5155e96de3ede0e161cac7d90e7698be
src/styles.css f8b4c7f99cfb5392ba33d82c9b8bf63bf1d0f9ba
```

## Remaining Gaps

1. The renderer does not yet consume the new transition/response metadata for
   AAA animation; these fixtures only provide deterministic authoritative
   inputs.
2. No browser screenshots or visual hashes were created for the seven new
   fixtures.
3. Optional-trigger and Skitter ownership are privacy-safe in fixture metadata,
   but real two-client delivery remains a separate multiplayer test.
4. Solo confirm/decline, every Skitter choice, animation completion, focus
   return, and accessibility behavior remain browser-journey work.

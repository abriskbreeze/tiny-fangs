---
date: 2026-07-27T16:08:39-04:00
task_number: 04
task_total: 16
status: success
---

# Task Handoff: Add Stable Presentation-Face Identity

## Task Summary

Add a presentation-independent, fail-closed identity contract for catalog and runtime-derived card faces. All three existing Antling creators now stamp registered `presentationFaceId: "antling"` metadata, while every pre-existing gameplay field, state transition, and event remains unchanged.

## What Was Done

- Added a frozen canonical derived-face registry containing Antling.
- Added a pure resolver that accepts only:
  - a validated catalog ID when no explicit presentation identity exists;
  - a registered explicit `presentationFaceId` for token/derived faces.
- Added a frozen 56-record inventory for later asset-manifest generation.
- Made inventory construction fail on malformed catalog/derived entries, catalog key/ID mismatch, duplicate IDs, catalog/derived collisions, and unregistered `summonToken` references.
- Exported the complete contract through `shared/index.js`.
- Stamped Antling metadata in:
  - authoritative `shared/engine.js#endTurn()`;
  - `shared/effects.js#Effects.summonToken()`;
  - legacy `src/abilities.js#applySpawn()`.
- Added exact regression coverage for all paths, including the authoritative Hiveling-derived object and unchanged event order.

## Files Modified

- `shared/face-registry.js:1-148` - Canonical registry, fail-closed inventory builder, pure resolver, and registered stamp helper.
- `shared/index.js:10-17` - Re-exports the identity contract.
- `shared/engine.js:11,1519-1528` - Stamps only metadata on the authoritative Antling.
- `shared/effects.js:20-21,786-815` - Stamps the existing shared-effect Antling after preserving unknown-token handling.
- `src/abilities.js:1-4,242-262` - Stamps the legacy Antling helper.
- `tests/face-registry.test.js:1-232` - Covers resolution, rejection, exports, inventory, collisions, token declarations, shared Effects, and unknown tokens.
- `tests/engine.test.js:646-687` - Exercises the real Broodmother/end-turn path and locks its prior gameplay object/event behavior.
- `tests/ability-effects.test.js:395-423` - Locks the legacy creator's complete output shape plus identity.
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-04-face-identity.md` - Records implementation and verification evidence.

## Locked Contract

Canonical derived entry:

```js
{
  antling: {
    kind: 'token',
    presentationFaceId: 'antling'
  }
}
```

Resolution rules:

```js
resolvePresentationFaceId({ id: 'emberfang' }) === 'emberfang'
resolvePresentationFaceId({
  id: 'hiveling',
  presentationFaceId: 'antling'
}) === 'antling'

resolvePresentationFaceId({ name: 'Antling' }) === null
resolvePresentationFaceId({ id: 'antling' }) === null
resolvePresentationFaceId({
  id: 'emberfang',
  presentationFaceId: 'unknown'
}) === null
```

An unknown explicit identity fails closed; it never falls back to a valid catalog ID. Display names, subtitles, rules text, and art are never inspected.

## Inventory Contract

`PRESENTATION_FACE_INVENTORY` currently contains:

- 29 catalog creature records.
- 26 catalog verse records.
- 1 registered token record for Antling.
- 56 unique presentation-face IDs total.

Every record contains only stable content metadata:

```js
{
  source: 'catalog' | 'derived',
  sourceId: '...',
  kind: 'creature' | 'verse' | 'token',
  presentationFaceId: '...'
}
```

No browser URL, path, preload, or asset-delivery concern exists in `shared/`.

## Gameplay Preservation

The authoritative Antling intentionally remains the current Hiveling-derived gameplay object:

- `id: "hiveling"`
- `subtitle: "Swarm Drone"`
- `cost: 1`
- Hiveling's existing `Swarm` ability
- Hiveling flavor and ASCII art
- 10 HP / 10 current HP / 10 ATK
- existing runtime flags and UID behavior

Only `presentationFaceId: "antling"` was added. The exact existing event order remains:

1. Broodmother `abilityTrigger`
2. Antling `summon`
3. opponent `manaGain`
4. opponent `draw`
5. `turnStart`

The shared-effect and legacy Antlings retain their prior `id: "antling"`, cost-zero, `isToken: true`, ability-null shapes. Unknown shared-effect tokens still return exact `unknown_token` without modifying the bench.

## TDD Verification

- [x] Tests were written before production code.
- [x] Test syntax checks passed.
- [x] RED observed: all three focused suites failed solely because `shared/face-registry.js` did not exist.
- [x] GREEN observed:
  - `npm test -- --run tests/face-registry.test.js tests/engine.test.js tests/ability-effects.test.js`;
  - 83/83 focused tests passed.
- [x] Full suite:
  - `npm test -- --run`;
  - 361/361 tests passed across 21 files.
- [x] No gameplay refactor followed GREEN.

## Code Quality

- `tldr diagnostics` reports 0 errors and 0 warnings for:
  - `shared/face-registry.js`
  - `shared/engine.js`
  - `shared/effects.js`
  - `shared/index.js`
  - `src/abilities.js`
  - `tests/face-registry.test.js`
  - `tests/engine.test.js`
  - `tests/ability-effects.test.js`
- `git diff --check` passes.

## Build Verification

- `npm run build -- --outDir /private/tmp/tiny-fangs-task-04-final-build.n9r3Ry --emptyOutDir` passed with Vite 6.4.1.
- Build output stayed outside the repository.

## Issues Encountered

The first repository-wide run overlapped Task 02 while its new Playwright specs were temporarily visible to Vitest; sandboxed server-process tests also could not bind loopback. No Task 04 test failed. Coordination left Task 02-owned files untouched. After Task 02 isolated the runners, the normal full command passed 361/361. The server-process suite separately passed 8/8 with localhost permission.

## Boundaries Preserved

- No edits to package files, server files, renderer/style files, docs, Playwright files, or Task 02/03 paths.
- No generated art or browser asset manifest was created.
- No card balance, gameplay ID, ability, cost, state transition, or event sequence changed.
- No staging or commit was performed.
- Existing Task 01 privacy changes remain intact.

## Next Task Context

The later asset manifest should consume `PRESENTATION_FACE_INVENTORY` rather than independently scanning names or inventing IDs. Manifest validation should also instantiate the real Broodmother/end-turn path and require every resolved face to have an authored asset. Adding a future `summonToken` declaration without a corresponding registry entry now fails immediately during shared-module initialization.

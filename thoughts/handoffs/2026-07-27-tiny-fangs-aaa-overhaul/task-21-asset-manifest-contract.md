# Task 21 — Canonical Asset Manifest Contract

**Status:** Implementation complete; focused verification and isolated build pass.

**Scope:** Desktop-first presentation asset contract and validation lane only.

**Strict production readiness:** **BLOCKED as designed** until authored files and
complete provenance/license records exist.

## Boundaries Preserved

This task did not edit:

- `src/render.js`
- `src/styles.css`
- `src/main.js`
- `src/state.js`
- `src/mp-client.js`
- `index.html`
- the desktop art bible
- the behavior matrix
- the goal ledger
- the implementation plan

No files were staged or committed. Existing dirty-worktree changes were
preserved.

## Files Changed

### Added

- `src/presentation/assets/manifest.js`
- `src/presentation/assets/manifest-validation.js`
- `src/presentation/assets/runtime-face-samples.js`
- `scripts/validate-presentation-assets.mjs`
- `tests/presentation/asset-manifest.test.js`

### Updated

- `package.json`
  - added `validate:assets`
  - added `validate:assets:release`

## Contract Implemented

### Canonical card-face inventory

`buildPresentationAssetManifest()` generates card-face entries exclusively from
`PRESENTATION_FACE_INVENTORY`.

- 55 catalog faces
- 1 registered derived face: `antling`
- 56 total canonical renderable faces

Each card asset key and expected path is derived from
`presentationFaceId`. Display names, subtitles, rules text, flavor text, and
legacy ASCII art are not manifest identities or fallbacks.

Every card face declares four required production variants:

1. `source`
2. `detail`
3. `thumbnail`
4. `fallback`

Each variant carries minimum pixel dimensions, aspect-ratio intent and
tolerance, maximum encoded bytes, media type, and an expected repository path.
Those paths are production destinations only. This task did not create or claim
the presence of any art files.

### Explicit non-card inventory

The manifest also requires explicit entries in all requested families:

- `frames`
- `backs`
- `statusIcons`
- `ui`
- `environment`
- `audio`

The current contract contains:

- 56 card-face entries
- 39 explicit non-card entries
- 95 total asset entries
- 263 required files

The non-card set includes the three card families plus token frame, standard and
hidden-Set backs, poison/trapped/fortified/unbreakable icons, gameplay UI
tokens/rings/coin/divider, meadow and terrain resources, and the planned
ambience/card/UI/combat/result audio cue families.

### Provenance and rights

Every asset has a provenance record with:

- `creator`
- `origin`
- `license`
- optional `licenseUrl`
- `rightsConfirmed`

These fields are intentionally empty/unconfirmed in the checked-in planning
manifest. They are not synthetic claims.

## Validation Behavior

`validatePresentationAssetManifest()` validates:

- schema and asset-entry shape
- unique asset IDs
- all required families
- every explicit non-card required entry
- exact coverage of the canonical face inventory
- duplicate canonical face entries
- unregistered manifest faces
- runtime-produced face registration
- runtime-produced face manifest coverage
- required file contracts and unique file roles
- unique file paths
- missing physical files
- positive source byte sizes
- SHA-256 metadata
- duplicate content hashes
- image dimensions and minimum-resolution intent
- aspect-ratio intent and tolerance
- normalized focal points
- maximum encoded-source budgets
- creator/origin/license/rights metadata

### Draft phase

`npm run validate:assets`

Missing production files and incomplete provenance are warnings. Structural,
identity, invalid-metadata, duplicate-content, geometry, focal-point, and budget
defects remain errors.

Current honest result:

```text
Tiny Fangs asset manifest (draft): 56 canonical faces, 95 total assets, 263 required files
Errors: 0; warnings: 358
- MISSING_FILE: 263
- MISSING_PROVENANCE: 95
```

Exit code: `0`.

### Strict release phase

`npm run validate:assets:release`

Missing files and provenance become release errors.

Current honest result:

```text
Tiny Fangs asset manifest (release): 56 canonical faces, 95 total assets, 263 required files
Errors: 358; warnings: 0
- MISSING_FILE: 263
- MISSING_PROVENANCE: 95
```

Exit code: `1`, expected.

Strict production asset validation has **not** passed and must not be described
as passed.

## Runtime-Derived Face Audit

`createRepresentativeRuntimeFaces()` creates a minimal authoritative engine
state, places a real Broodmother as the active creature, calls the real
`endTurn()` implementation, and returns the resulting engine-created Antling.

Focused coverage proves:

- the engine creates one Antling;
- `resolvePresentationFaceId(antling)` is exactly `antling`;
- the generated manifest contains `card-face/antling`;
- validation has no runtime-identity error for that Antling;
- a future runtime token with `presentationFaceId: "future-token"` but no
  registry entry fails with `UNREGISTERED_RUNTIME_FACE`;
- a future registry inventory entry absent from the manifest fails with both
  `MISSING_CANONICAL_FACE` and `MISSING_RUNTIME_FACE_ASSET`;
- rebuilding from the expanded inventory generates the new stable-ID entry.

## Node Validation CLI

`scripts/validate-presentation-assets.mjs`:

- confines all expected paths to the repository root;
- indexes only declared manifest files;
- computes real SHA-256 and byte sizes;
- parses PNG, WebP, and JPEG dimensions without an additional dependency;
- creates the representative engine Antling;
- runs draft or release validation;
- summarizes issue counts by stable code;
- exits nonzero when the selected phase contains errors.

## Automated Evidence

### Focused tests

Command:

```text
npm test -- --run tests/presentation/asset-manifest.test.js tests/face-registry.test.js tests/engine.test.js
```

Result:

- 3 test files passed
- 65/65 tests passed
- exit code 0

The new asset-manifest file contributes 12 focused tests.

### Diagnostics

`tldr diagnostics` was run separately on:

- `src/presentation/assets/manifest.js`
- `src/presentation/assets/manifest-validation.js`
- `src/presentation/assets/runtime-face-samples.js`
- `scripts/validate-presentation-assets.mjs`
- `tests/presentation/asset-manifest.test.js`

Result for every file:

- 0 errors
- 0 warnings

`node --check` also passed for all five files.

### Isolated production build

Command:

```text
npm run build -- --outDir /private/tmp/tiny-fangs-task21-build.HjmVnk
```

Result:

- Vite 6.4.1
- 33 modules transformed
- build completed in 322 ms
- exit code 0
- existing `dist/` was not overwritten

### Full unit suite checkpoint

The first full-suite run occurred while Task 20's timer implementation was
actively editing shared files.

Result at that concurrent checkpoint:

- 542/544 passed
- the two failures were in Task 20-owned timer characterization:
  - a now-stale old timer-gap assertion in
    `tests/presentation/behavior-order-characterization.test.js`;
  - an in-progress `client.handleMessage` timer test in
    `tests/presentation/game-timer-lifecycle.test.js`.

No Task 21 test failed. Task 21 did not edit those files or the protected timer
implementation files. A clean full-suite rerun should be recorded after Task 20
settles.

## Remaining Strict-Art Blockers

The release validator must remain red until all of the following are true:

1. All 263 declared production files exist at their required paths.
2. Each image meets its minimum dimensions and aspect-ratio intent.
3. Each file is within its encoded-size budget.
4. Every indexed file has a valid SHA-256 and no unintended duplicate content.
5. Every visual asset retains a reviewed normalized focal point.
6. Every asset has real creator, origin, license, and confirmed-rights metadata.
7. Any new catalog or derived/runtime face is registered, generated into the
   manifest, physically present, and exercised by the runtime audit.
8. Golden-sample and independent visual-critic gates pass. This task validates
   inventory and technical readiness only; it does not assess AAA art quality.

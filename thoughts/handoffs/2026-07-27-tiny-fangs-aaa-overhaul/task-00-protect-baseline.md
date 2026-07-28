---
date: 2026-07-27T15:45:54-04:00
task_number: 00
task_total: 16
status: success
---

# Task Handoff: Protect Baselines and Add the Presentation Mode Gate

## Task Summary

Preserve the committed classic and user-owned dirty prototype baselines, record authoritative evidence for both, and add an inert, rollback-friendly presentation mode gate without changing visuals or touching the protected prototype/reference files.

## What Was Done

- Recorded branch, HEAD/tree, committed classic blobs, dirty prototype blobs/diff sizes, reference hashes/dimensions, reconciliation decisions, and verification commands in a machine-readable baseline artifact.
- Added a pure presentation-mode resolver that defaults to `classic`, accepts `?presentation=aaa` or `?presentation=classic`, reads a namespaced local-storage override, and rejects all other values.
- Added a root `data-presentation` attribute during bootstrap. No stylesheet targets it yet, so the current presentation is visually unchanged.
- Preserved all unrelated query parameters by only reading `location.search`; `?ws=` remains available to `src/mp-client.js`.
- Verified that `src/render.js`, `src/styles.css`, both references, and tracked `dist/index.html` retained their pre-task hashes.

## Files Modified

- `src/main.js:34-36` - Imports and applies the presentation mode gate before runtime setup.
- `src/presentation/presentation-mode.js:1-62` - Implements safe mode resolution and root attribute application.
- `tests/presentation/presentation-mode.test.js:1-94` - Covers defaults, query/storage precedence, unrelated query parameters, invalid values, denied storage, and root application.
- `tests/visual/baselines/phase-00-dual-baseline.json:1-155` - Records the dual baseline and reconciliation evidence.
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-00-protect-baseline.md` - This handoff.

## Decisions Made

- **Mode vocabulary:** Only `classic` and `aaa` are valid, preventing arbitrary values from reaching the root attribute.
- **Precedence:** A valid query override wins, then `tinyFangs.presentation.mode`, then `classic`.
- **Invalid query behavior:** Ignore it and continue to a valid stored override; otherwise fall back to `classic`.
- **Root contract:** Use `document.documentElement.dataset.presentation`, producing `data-presentation`.
- **Isolation:** Keep the gate inert in Phase 0. No CSS, renderer, scene, or dependency changes were introduced.
- **Baseline identity:** `HEAD` is the committed classic baseline; the pre-existing dirty files are the protected prototype fallback.

## Patterns/Learnings for Next Tasks

- Keep production selectors rooted under `[data-presentation="aaa"]`; unscoped new styles could alter the protected fallback.
- The resolver is dependency-injected and safe in Node, browser, denied-storage, and missing-root contexts.
- Do not rewrite the URL or consume `?ws=` while adding future presentation query options.
- Validation handoff blockers B1-B4 remain out of scope and unresolved; Phase 1 must address its prerequisite contracts before freezing exhaustive baselines.

## TDD Verification

- [x] Tests written before implementation.
- [x] RED observed: `npm test -- --run tests/presentation/presentation-mode.test.js` exited 1 because the production module did not exist.
- [x] GREEN observed: the same command passed 9/9 tests.
- [x] Full suite: `npm test -- --run` passed 313/313 tests across 14 files.
- [x] No refactor was needed after GREEN.

## Code Quality

- `tldr diagnostics src/main.js` - 0 errors, 0 warnings.
- `tldr diagnostics src/presentation/presentation-mode.js` - 0 errors, 0 warnings.
- `tldr diagnostics tests/presentation/presentation-mode.test.js` - 0 errors, 0 warnings.
- Baseline JSON parses successfully.
- `git diff --check` passes.
- `qlty` is not installed and no qlty configuration exists.

## Build Verification

- `npm run build -- --outDir /private/tmp/tiny-fangs-phase-00-build.AZvv2E --emptyOutDir` passed with Vite 6.4.1.
- Build output stayed outside the repository.
- Tracked `dist/index.html` remained blob `a8ff680001d2e73833f349a1210859d3c6d8f245`.

## Protected Evidence

- `src/render.js`: `5ace20ad5155e96de3ede0e161cac7d90e7698be`
- `src/styles.css`: `f8b4c7f99cfb5392ba33d82c9b8bf63bf1d0f9ba`
- Card reference SHA-256: `4ecb53d517d40edc5a7b4907e6991c6b8dcce40cc34e6a21c14b709ed2228056`
- Field reference SHA-256: `5229e89ad2888ef9f3245d6ecd77605ec56a3cc29a6e378c4c7474659e4b79e7`

## Issues Encountered

`tldr diagnostics` accepts one target per invocation. The initial multi-target command was rejected without changing files; each changed JavaScript file was then checked individually and passed.

## Next Task Context

Begin Phase 1 behavior characterization with `classic` as the default. Use `?presentation=aaa` for opt-in work and preserve the `tinyFangs.presentation.mode` contract. Do not freeze multiplayer hidden-information baselines until the validation handoff's opponent Set Verse privacy defect has an explicit resolution.

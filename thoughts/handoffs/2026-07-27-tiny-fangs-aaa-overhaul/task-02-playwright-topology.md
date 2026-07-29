---
date: 2026-07-27T16:13:41-04:00
task_number: 02
task_total: 16
status: success
---

# Task Handoff: Reproducible Playwright, Vite, and WebSocket Topology

## Task Summary

Added an exact-pinned, deterministic browser-test topology that owns both the Vite app and multiplayer WebSocket server, preserves the existing endpoint override order, exercises real Chromium, and keeps browser/process integration tests separate from the sandbox-safe Vitest unit suite.

## What Was Done

- Exact-pinned `three@0.185.1` as a root runtime dependency and `@playwright/test@1.61.1` as a root development dependency, with matching lockfile scopes.
- Kept the existing Vite/Vitest declarations unchanged; installed resolutions remain Vite 6.4.1 and Vitest 3.2.4.
- Added `playwright.config.mjs` with:
  - validated configurable `TINY_FANGS_VITE_PORT` and `TINY_FANGS_WS_PORT`;
  - deterministic defaults `4173` and `3101`;
  - explicit port-collision rejection;
  - Playwright-owned Vite and WebSocket `webServer` processes;
  - Vite `--host 127.0.0.1 --strictPort`;
  - health-based server readiness;
  - `SIGTERM` graceful shutdown;
  - no server reuse in CI;
  - `e2e`, serial `multiplayer`, and `visual` projects;
  - one CI worker;
  - retained-on-failure traces/videos/screenshots plus HTML/JUnit output.
- Changed the multiplayer server to use one HTTP listener for `/healthz` and WebSocket upgrades.
- Added strict `TINY_FANGS_WS_PORT` parsing while retaining port `3001` when the variable is absent.
- Added normal `SIGINT`/`SIGTERM` cleanup for the room interval, WebSocket clients/server, and HTTP listener.
- Made startup fail cleanly on invalid or occupied ports instead of leaving a live interval behind.
- Added Vitest characterization tests proving the existing client order remains:
  1. `?ws=`
  2. `localStorage.tinyFangsWs`
  3. production default
- Added a real browser smoke proving Vite, `/healthz`, the query WebSocket override, connection, and room creation.
- Added a one-worker, two-isolated-context multiplayer smoke proving create/join and lowercase-to-uppercase room normalization.
- Added a visual-project smoke that records mode-selection screenshot evidence in Playwright's ignored output directory.
- Split localhost process integration tests into `vitest.server.config.js`, keeping bare Vitest sandbox-safe.
- Updated GitHub Pages CI to install both root/server dependencies, install pinned Chromium, run all test layers, and always upload Playwright evidence while excluding `artifacts/visual/blind-mappings/**`.
- Preserved the repository's original ignore rules and added server dependencies plus Playwright outputs.

## Files Changed

- `package.json`
- `package-lock.json`
- `playwright.config.mjs`
- `vite.config.js`
- `vitest.server.config.js`
- `server/index.js`
- `.github/workflows/deploy.yml`
- `.gitignore`
- `tests/server/server-process.test.js`
- `tests/presentation/mp-endpoint.test.js`
- `tests/e2e/topology.spec.js`
- `tests/e2e/multiplayer/room-smoke.spec.js`
- `tests/visual/topology.visual.spec.js`
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-02-playwright-topology.md`

No protected renderer, stylesheet, privacy projection, or shared-engine files were edited by Task 02.

## Root Scripts

- `npm run test:server-process`
- `npm run test:e2e`
- `npm run test:multiplayer`
- `npm run test:e2e:multiplayer` — compatibility alias
- `npm run test:visual`
- `npm run test:presentation`

`test:presentation` runs unit tests, server-process integration, build, browser smoke, multiplayer smoke, and visual smoke in order.

## TDD Evidence

### RED

1. The initial server-process test was first blocked by sandbox loopback `EPERM`. Rerunning with localhost permission produced the intended failure:
   - requested random configured port;
   - server still logged port `3001`;
   - `/healthz` timed out.
2. Browser specs were written before their test topology. `npm run test:e2e` failed because the script/config/dependency did not exist.
3. Bare `npm test -- --run` then exposed the expected runner-isolation defect:
   - Vitest collected all three Playwright specs;
   - localhost process tests failed with sandbox `EPERM`.
4. The occupied-port process test failed because the server logged `EADDRINUSE` but did not exit while its cleanup interval remained alive.

### GREEN

- Endpoint precedence characterization: 3/3.
- Server process integration: 9/9.
- Bare Vitest unit suite: 361/361 across 21 files.
- Playwright e2e project: 1/1.
- Playwright multiplayer project: 1/1 with one worker and two isolated contexts.
- Playwright visual project: 1/1.
- A second e2e run passed with custom ports `4273`/`3201`.
- Equal configured Vite/WebSocket ports fail configuration immediately with the intended collision error.

## Verification Evidence

### Dependencies and clean-install contract

- `three`: exactly `0.185.1` under `dependencies`; its lockfile package entry is not development-only.
- `@playwright/test`: exactly `1.61.1` under `devDependencies`.
- Vite resolved version: unchanged `6.4.1`.
- Vitest resolved version: unchanged `3.2.4`.
- `npm ci --dry-run`: lockfile is synchronized.
- `npm --prefix server ci --dry-run`: server lockfile is synchronized.
- Chromium installed successfully for Playwright 1.61.1:
  - Chrome for Testing `149.0.7827.55`;
  - Playwright Chromium revision `1228`.

### Test and build commands

- `npm test -- --run`: 361/361 passed.
- `npm run test:server-process`: 9/9 passed with localhost permission.
- `npm run test:e2e`: 1/1 passed with localhost/browser permission.
- `npm run test:multiplayer`: 1/1 passed with localhost/browser permission.
- `npm run test:visual`: 1/1 passed with localhost/browser permission.
- Custom-port e2e with `TINY_FANGS_VITE_PORT=4273` and `TINY_FANGS_WS_PORT=3201`: 1/1 passed.
- Follow-up runtime-dependency correction:
  - package/lock scope assertions: 11/11 passed;
  - `npm ls three @playwright/test vite vitest --depth=0`: clean;
  - bare Vitest unit suite: 361/361 passed;
  - `npm run build -- --outDir /private/tmp/tiny-fangs-task02-runtime-build.SfxCuw --emptyOutDir`: passed under Vite 6.4.1.
- Post-run `lsof` checks found no listeners on ports `4173` or `3101`.

### Static quality

- `tldr diagnostics` reported zero errors and zero warnings for every Task 02-authored JavaScript/config/test file plus the workflow, package manifest, and ignore file.
- `node --check` passed for every Task 02 JavaScript file.
- Ruby YAML parsing passed for `.github/workflows/deploy.yml`.
- `git diff --check` passed.

## Environment and Artifact Notes

- The managed sandbox prohibits localhost binding with `EPERM`. All real process/browser tests were rerun with approved localhost permission and passed; no browser or process gate remains pending.
- Root/server `node_modules`, `dist`, `.DS_Store`, `playwright-report`, and `test-results` are ignored. Existing ignored `dist`/`.DS_Store` material was not deleted because its provenance was not solely Task 02.
- Browser evidence is generated under ignored `test-results/` and `playwright-report/`. CI uploads those paths even on failure.
- CI uploads `artifacts/visual/` but explicitly excludes `artifacts/visual/blind-mappings/**`, so critic-facing evidence cannot contain the answer key.

## Security Note

`npm audit --omit=dev --json` reports zero production vulnerabilities. Full `npm audit` reports five advisories in the pre-existing Vite/Vitest development toolchain (four high, one critical). Task 02 did not upgrade Vite or Vitest because the task explicitly prohibited it; that follow-up remains separate from this topology change.

## Next Task Context

- Use `?ws=ws://127.0.0.1:<TINY_FANGS_WS_PORT>` for all real browser multiplayer tests.
- Put normal browser specs under `tests/e2e/`, serial multiplayer specs under `tests/e2e/multiplayer/`, and Playwright visual specs under `tests/visual/` with `.visual.spec.js`.
- Keep localhost process tests in `tests/server/server-process.test.js`; run them through `npm run test:server-process`, not bare Vitest.
- Do not change endpoint precedence while adding future presentation query parameters.
- CI is wired but was not executed on GitHub during this local task; local equivalents all passed.

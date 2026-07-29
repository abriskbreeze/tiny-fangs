---
date: 2026-07-27T19:36:30Z
type: validation
status: NEEDS REVIEW
plan_file: /Users/rico/Desktop/Projects & Such/Tiny Fangs - TCG/thoughts/shared/plans/PLAN-tiny-fangs-aaa-presentation.md
---

# Plan Validation: Tiny Fangs AAA Presentation Overhaul

## Overall Status: NEEDS REVIEW

The presentation architecture is viable and the phase ordering is substantially correct. Direct Three.js for the decorative environment plus a keyed DOM presentation for cards, controls, overlays, and accessibility is the right fit for this vanilla-ESM repository.

The plan is not yet safe to execute as written because four current-state contradictions would make its own acceptance gates fail:

1. The multiplayer server currently sends the opponent's complete face-down Set Verse object, including `id`, `name`, rules, art, effects, and UID. The plan simultaneously requires hidden information to remain inaccessible and says the WebSocket protocol/hidden-state conversion must remain unchanged.
2. The authoritative end-turn path creates Antling by cloning Hiveling and leaves `id: "hiveling"` and Hiveling's subtitle/ability metadata in the runtime object. That conflicts with the promised 56-face manifest and makes a stable Antling asset key impossible without a defined presentation-face identity contract.
3. The proposed Playwright/two-browser harness has no specified root script, `playwright.config`, deterministic port strategy, server dependency installation, browser installation, or CI wiring. The current root install does not install `server/ws`, and the deploy workflow only runs root `npm ci` and `npm run build`.
4. A fixed orthographic camera is locked before the reference graybox. Reference 2 contains visible depth/scale cues; an orthographic camera keeps object size constant with distance. The camera must remain an empirical choice between orthographic and low-FOV perspective until the anonymized graybox comparison passes.

Phase 0 preservation work can proceed. Card-art production, multiplayer privacy acceptance, and reference-locked field production should not proceed until the four items above have explicit contracts.

## Evidence Rechecked

- Current branch and head: `feat/cel-shaded-field` at `f16804d`.
- Dirty work remains user-owned and unchanged:
  - modified `src/render.js`
  - modified `src/styles.css`
  - untracked `docs/`
  - untracked `thoughts/`
- `npm test -- --run`: 304/304 tests pass across 13 files.
- A production build to an isolated `/private/tmp` output directory passes under Vite 6.4.1.
- Both supplied references are 1672 x 941.
- The two `docs/` files match the supplied attachments byte-for-byte:
  - card reference: `4ecb53d517d40edc5a7b4907e6991c6b8dcce40cc34e6a21c14b709ed2228056`
  - board reference: `5229e89ad2888ef9f3245d6ecd77605ec56a3cc29a6e378c4c7474659e4b79e7`
- The root lockfile does not declare Three.js or Playwright. `three@0.185.1` is only an extraneous local install.
- The catalog count is authoritative: 29 creatures, 26 verses, and 5 decks.
- No browser, multiplayer-server, privacy-boundary, visual, accessibility, or performance tests exist in the committed test suite.

## Precedent Check

**RAG-Judge verdict:** unavailable

The validation skill's `scripts/braintrust_analyze.py` helper is not present in the repository or the installed skill package, so no Artifact Index verdict could be produced.

Repository precedent was reviewed instead:

- `MEMORY.md:121-130` records that render/event order and visible-target selection are correctness contracts, not cosmetic details.
- `MEMORY.md:1015-1042` records the current multiplayer state-update -> render -> animation ordering.
- `MEMORY.md:1080-1113` confirms that the shared engine is the single rules authority and that multiplayer updates must be queued.
- `tasks/root-cause-analysis.md:51-108` documents the prior failures caused by hidden multiplayer data assumptions and DOM-coupled animation targets.

This precedent supports the plan's keyed renderer, semantic target registry, Promise-preserving `Anim` facade, and two-browser characterization phase.

## Blocking Findings

### B1 - Opponent Set Verse identity is already exposed

**Severity:** P0  
**Blocks:** Phases 1, 5, 12, and release

`server/GameEngine.js:105-150` claims to remove hidden information, but line 147 spreads the entire opponent Set Verse and adds only `faceDown: true`. `src/mp-client.js:167-179` stores that complete object unchanged.

A direct current-state reproduction with Vengeance returned:

```json
{
  "id": "vengeance",
  "name": "Vengeance",
  "type": "set",
  "art": "...",
  "trigger": "When your creature would be KO'd by attack",
  "text": "Negate KO. Destroy attacker instead.",
  "effects": ["..."],
  "uid": "...",
  "faceDown": true
}
```

This contradicts:

- the hidden-information requirement in the plan,
- the claim at `PLAN...md:46` that `src/mp-client.js` preserves hidden information,
- `PLAN...md:354`, which says the protocol and conversion remain unchanged,
- `PLAN...md:913`, which requires opponent hidden information to remain hidden.

**Required decision:** authorize a minimal privacy correction to the server projection and its client conversion. The opponent payload should expose only presence/count semantics required by the UI, never identity-bearing fields. Add direct unit tests for `getStateForPlayer()` and two-browser/network-payload assertions before freezing the baseline. Treat this as an isolated prerequisite defect, not as presentation refactoring.

### B2 - Antling has two incompatible runtime identities

**Severity:** P0  
**Blocks:** Phases 2, 5, 6, and asset completion

Three different paths disagree:

- `shared/effects.js:790-803` defines the token correctly as `id: "antling"`, `subtitle: "Swarm Token"`, and `isToken: true`.
- `src/abilities.js:246-258` uses the same Antling identity.
- The authoritative shared-engine end-turn path at `shared/engine.js:1518-1527` clones Hiveling, changes only its name/stats, and leaves `id: "hiveling"`, `subtitle: "Swarm Drone"`, Hiveling ability metadata, and no `isToken`.

The current authoritative reproduction is:

```json
{
  "id": "hiveling",
  "name": "Antling",
  "subtitle": "Swarm Drone"
}
```

An asset map keyed by `card.id` will render Hiveling art for Antling. A name special case would undermine the plan's promise that future derived faces are discovered automatically.

**Required decision:** define one presentation-face key contract before the manifest is generated. Preferred resolution is one canonical token registry/factory used by the shared engine. If engine-state normalization is intentionally deferred, define and test a pure `resolveFaceId(card)` contract that resolves Antling and every future derived face without relying on display-name string matching. The manifest validator must exercise real engine-created objects, not only scan catalog declarations.

### B3 - Browser/multiplayer verification topology is incomplete

**Severity:** P1  
**Blocks:** reproducible Phase 1 and release CI

Current state:

- root `package.json` has only Vite/Vitest scripts and dependencies;
- `server/package.json` separately owns `ws`;
- `.github/workflows/deploy.yml` runs only root `npm ci` and `npm run build`;
- Playwright is not installed;
- `server/index.js` hardcodes port 3001;
- the client already supports a deterministic `?ws=` override at `src/mp-client.js:18-22`.

Playwright supports multiple `webServer` processes, but the plan does not list `playwright.config.js`, server install steps, browser install steps, test scripts, CI workflow changes, or teardown/port ownership. Its planned file list also omits `.github/workflows/deploy.yml`.

**Required decision:** add the following to the implementation contract:

- an exact-pinned `@playwright/test`;
- a committed `playwright.config.js` or `.mjs`;
- two named web servers for Vite and the WebSocket server;
- deterministic, configurable ports and the existing `?ws=` override;
- explicit `npm --prefix server ci`;
- explicit Chromium browser installation in CI;
- `test:e2e`, `test:visual`, and full release-gate scripts;
- CI artifact upload for traces, screenshots, comparison sheets, and reports;
- one-worker CI execution for the stateful multiplayer suite;
- guaranteed teardown of both processes.

Official Playwright guidance supports multiple web servers and warns that visual baselines vary by OS, browser version, hardware, and settings. The capture environment therefore must be pinned and recorded, as the plan intends.

### B4 - Camera model is prematurely fixed

**Severity:** P1  
**Blocks:** reference lock for Phases 2, 3, and 7

The plan fixes an `OrthographicCamera` at `PLAN...md:100` while also describing the reference as "near-orthographic." Three.js documents that orthographic projection keeps object size constant regardless of distance. Reference 2 has deliberately different near/far scale and foreground depth cues.

This does not mean perspective is automatically better. It means the plan cannot truthfully call the camera reference-locked before testing both.

**Required decision:** make the Phase 2 graybox a camera bake-off:

1. calibrated orthographic;
2. low-FOV perspective with matched framing.

Compare populated-board silhouettes, zone alignment, foreground/background scale, prop parallax, and DOM/Three drift at 1672 x 941. Lock the winner only after blind comparison. The 2 px/4 px compositing acceptance remains appropriate for either camera.

## Deferred Release Prerequisite

### R1 - Physical mobile reference device is not named

**Severity:** P1 at Phase 13; not a Phase 0 blocker

The performance protocol correctly refuses to claim a physical-device gate from emulation, but `mobile-reference` is still described as an "agreed lowest supported physical phone." No model, browser, OS, or availability is currently defined.

Before Phase 13, select and record the actual device. If none is available, the final performance completion gate must remain pending; emulation cannot be used to mark it complete.

## Tech Choices Validated

### 1. Vanilla Three.js + keyed DOM/CSS hybrid

**Purpose:** dimensional environment with accessible, crisp, interactive cards and UI  
**Status:** VALID

This matches the current vanilla-ESM architecture and avoids a React/state-layer rewrite. Keeping the canvas decorative and pointer-transparent preserves the DOM's input and accessibility semantics. The early compositing spike is necessary and correctly ordered before bulk asset work.

**Recommendation:** keep as-is.

### 2. Stable `WebGLRenderer` with a complete static fallback

**Purpose:** production Three.js scene without making WebGL a gameplay dependency  
**Status:** VALID

Current Three.js `WebGLRenderer` uses WebGL 2. The plan's fallback, context-loss handling, quality tiers, and lazy loading are therefore required, not optional polish.

**Recommendation:** keep as-is and test forced creation failure plus context loss/restoration.

### 3. Fixed orthographic camera

**Purpose:** board framing and DOM/Three coordinate alignment  
**Status:** NEEDS REVIEW

Orthographic projection simplifies alignment, but its constant-distance scale may conflict with the supplied board reference. Reference fidelity has higher priority than implementation convenience.

**Recommendation:** run the orthographic/low-FOV perspective graybox comparison before locking the camera.

### 4. Linear-light workflow, sRGB output, restrained tone mapping

**Purpose:** consistent painterly materials and lighting  
**Status:** VALID

Three.js uses Linear-sRGB as its working color space and exposes sRGB output/tone mapping through `WebGLRenderer`. Color textures still need explicit color-space annotation; data maps must remain non-color.

**Recommendation:** keep as-is and add texture-role validation to the asset manifest.

### 5. KTX2/Basis compressed textures

**Purpose:** reduce GPU upload and delivery cost  
**Status:** VALID WITH REQUIRED SETUP

`KTX2Loader` requires the Basis WASM/JS transcoder, a configured transcoder path, renderer support detection, and loader disposal. `public/basis/` is present in the proposed layout but those setup requirements are not explicit.

**Recommendation:** add a production-build test for `setTranscoderPath()` under `base: "./"`, call `detectSupport(renderer)`, and verify the loader and workers are disposed.

### 6. Instancing, pooled effects, capped drawing buffer, and explicit disposal

**Purpose:** meet the performance/memory budgets  
**Status:** VALID

Three.js requires explicit disposal of geometries, materials, textures, render targets, post-processing resources, and relevant loaders. The proposed `resource-tracker.js`, pooling, and `renderer.info` instrumentation are aligned with official guidance.

**Recommendation:** keep as-is; include `ImageBitmap.close()` when that decode path is used.

### 7. Keyed DOM reconciliation, FLIP, and deterministic springs

**Purpose:** preserve node identity and create physical-feeling motion without game-state physics  
**Status:** VALID

This directly addresses the current destructive `innerHTML`/`outerHTML` rerenders while preserving the shared engine as authority. A rigid-body engine would add nondeterminism and no rules benefit.

**Recommendation:** keep as-is. Preserve old/new snapshots long enough to animate removal and replacement events whose final-state nodes no longer exist.

### 8. Playwright for E2E, visual capture, and two-browser multiplayer

**Purpose:** functionality parity and deterministic evidence  
**Status:** VALID, PLAN INCOMPLETE

Playwright provides screenshot stabilization, multiple browser contexts, projects, and multiple managed web servers. Its official docs require stable execution environments for reliable visual baselines.

**Recommendation:** keep the technology, but resolve B3 before calling Phase 1 implementable.

### 9. Web Audio after first gesture, persistent mute, optional vibration

**Purpose:** AAA feedback without autoplay or capability failures  
**Status:** VALID

The plan follows browser autoplay policy by creating/resuming audio from a user gesture and gives the user mute/volume controls. Capability-gated vibration and reduced-motion equivalence are appropriate.

**Recommendation:** keep as-is. Audio unlock must be idempotent and a rejected `resume()` must never reject a gameplay action.

## Phase-by-Phase Implementability Audit

| Phase | Status | Validation |
|---|---|---|
| 0 - protect work/baseline | READY | Correct first step. Dirty prototype work is real and must be reconciled line-by-line. |
| 1 - characterize behavior | NEEDS REVIEW | Correct scope, but hidden-set assertions currently fail and the Playwright/server topology is unspecified. Add direct server projection tests first. |
| 2 - visual bible/manifest | NEEDS REVIEW | Reference decomposition is strong. Antling needs a stable face identity, and camera type must remain open through the graybox. |
| 3 - presentation boundary | READY AFTER B4 | Coordinator, target registry, lifecycle, fallback, and 2 px/4 px fiducial gate are implementable. |
| 4 - keyed board | READY | Correctly precedes premium motion. Stable UIDs exist in solo and server state. |
| 5 - card system | NEEDS REVIEW | Visual work is implementable, but the no-leak acceptance cannot pass until B1 is fixed. |
| 6 - all card art | NEEDS REVIEW | Production waves and per-card/faction review are sound after B2. |
| 7 - Three.js meadow | READY AFTER B4 | Scene scope, instancing, lighting, and fallback are implementable once the camera bake-off locks the projection. |
| 8 - board/HUD/actions | READY | Covers all authoritative zones and six actions without removing information. |
| 9 - setup/lobby/overlays | READY | Covers mode select, room lifecycle, deck preview, difficulty, rival deck, coin, decisions, reveals, and result states. |
| 10 - motion/audio/haptics | READY WITH CHARACTERIZATION | Promise contract and event order are preserved. Existing missing/incorrect event handlers are already called out; add UID metadata only through backward-compatible, tested additions. |
| 11 - responsive/a11y/fallback | READY | Viewport matrix and full static playability are sufficient. Cross-browser support targets still need to be named. |
| 12 - multiplayer parity | NEEDS REVIEW | Correct two-browser scope, but "protocol unchanged" conflicts with B1 and the server harness is incomplete. |
| 13 - performance | READY WITH DEFERRED GATE | Budgets and measurement protocol are unusually concrete. Physical `mobile-reference` remains unresolved. |
| 14 - independent critic loop | READY | Two fresh critics, no self-review, disagreement-as-failure, fresh evidence, and consecutive passes match the user's requested loop. |
| 15 - release | NEEDS REVIEW | The gate is strong, but CI does not currently install/run browser, server, visual, accessibility, asset, or performance checks. |

## Functionality Preservation Audit

The plan covers nearly all user-visible current behavior:

- solo and multiplayer journeys;
- five decks plus random;
- Pup/Hunter and rival deck selection;
- coin call and first/second flow;
- summon, cast, set, attack, retreat, and end turn;
- targeting, optional triggers, and Skitter decisions;
- card detail, own Set Verse, graveyard, rules, logs, reveals, and results;
- pointer/touch drag, cancellation, 400 ms inspection hold, 500 ms End Turn hold;
- `S/C/T/A/R/E`, `Escape`, and `Ctrl+0-9`;
- first-turn, affordability, zone limits, status, promotion, winner, and event-order semantics;
- mobile/desktop equivalence and fallback playability.

Add explicit preservation checks for these current contracts, which are only implicit in the plan:

1. `?ws=` and `localStorage.tinyFangsWs` WebSocket endpoint overrides;
2. room-code normalization, back-to-mode cleanup, and reconnect/error UI behavior that already exists;
3. deck-preview hover/hold cancellation, including `pointercancel`;
4. timer source ownership and interval disposal across solo, multiplayer, result, restart, and menu return;
5. `tinyFangsDebug` event logging if it remains a supported developer contract;
6. network payload privacy, not merely DOM/accessibility/image-URL privacy.

The existing 304 unit tests are valuable rules evidence, but they do not prove any browser interaction or multiplayer projection contract. Phase 1 is therefore essential and correctly ordered.

## Reference Coverage Audit

### Reference 1 - card close-up

Covered:

- three-card showcase;
- gold creature, teal cast, and plum set families;
- ivory edge, inset frame, parchment panel, cost/stat medallions, art window, and card back;
- close-up camera, card thickness, contact shadow, readable replacement rules text;
- exact-size blind comparison and aligned detail crops.

The only unresolved item is canonical card silhouette. The current plan's 0.64-0.67 ratio is a tuning hypothesis, not yet authoritative. Keep it provisional until measured golden-sample overlays pass the 3% geometry gate.

### Reference 2 - populated board

Covered:

- exact 1672 x 941 canonical frame;
- peripheral low-poly meadow with bright, quiet center;
- upper-left sunlight, long down/right shadows, river/fence/rocks/flowers/trees;
- opponent/player/hand vertical bands and 44% center divider;
- deck, active, two bench, set, grave access, and hand fan;
- populated rather than empty comparison;
- full-frame and aligned environment/card/slot/hand crops.

The fixed camera choice is the only material fidelity risk. Resolve B4 and the reference coverage is sufficient to begin production.

## Required Plan Decisions Before Production

1. Permit and require an isolated opponent-Set privacy fix plus direct server projection tests.
2. Define a stable `faceId`/token registry contract and make real engine-created Antling resolve to `antling`.
3. Specify the Playwright configuration, root/server install topology, deterministic ports, scripts, CI workflow, and artifact retention.
4. Replace "fixed orthographic" with a Phase 2 orthographic-versus-low-FOV-perspective comparison and lock the winning projection.
5. Name the physical `mobile-reference` device before Phase 13.
6. Add the six implicit functionality contracts listed above to the behavior matrix.

After these decisions are incorporated, the remaining technical choices are safe to proceed.

## Sources

- Three.js WebGLRenderer: https://threejs.org/docs/pages/WebGLRenderer.html
- Three.js OrthographicCamera: https://threejs.org/docs/pages/OrthographicCamera.html
- Three.js responsive rendering: https://threejs.org/manual/en/responsive.html
- Three.js color management: https://threejs.org/manual/en/color-management.html
- Three.js KTX2Loader: https://threejs.org/docs/pages/KTX2Loader.html
- Three.js cleanup: https://threejs.org/manual/en/cleanup.html
- Three.js disposal guidance: https://threejs.org/manual/en/how-to-dispose-of-objects.html
- Playwright multiple web servers: https://playwright.dev/docs/test-webserver
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
- Playwright CI: https://playwright.dev/docs/ci
- Web Audio best practices: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices

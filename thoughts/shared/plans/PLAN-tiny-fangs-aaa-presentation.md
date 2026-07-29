# Plan: Tiny Fangs AAA Presentation Overhaul

**Date:** 2026-07-27  
**Status:** In progress  
**Target:** Desktop-first, reference-faithful, production-quality visual and presentation rebuild with all current game behavior retained
**Living goal ledger:** `thoughts/shared/GOALS-tiny-fangs-aaa.md`

## Goal

Rebuild the complete Tiny Fangs presentation around the two supplied references:

- `docs/exec-50304c60-4218-4f0b-b73f-27b218d4b941.png` — card close-up and card-material reference
- `docs/exec-cb613d03-7a77-4266-bd6b-e0d83428f067.png` — full-board, camera, field, lighting, and composition reference

The result should feel like a polished physical card game staged in a warm, low-poly storybook meadow. It must preserve solo and multiplayer behavior, engine rules, hidden-information boundaries, input methods, animation sequencing, and all existing game states.

## Delivery Sequence — Desktop First

- The active production target is desktop at the references' canonical **1672 × 941** frame.
- Phases 2–10 build, tune, capture, and run critic loops on desktop first.
- Desktop interaction scope is mouse, trackpad/pointer, and keyboard. Existing mobile/touch regression evidence is preserved, but mobile-only defects do not block the desktop AAA milestone.
- Tablet, phone, portrait, landscape-rotation, touch-specific adaptation, and physical mobile performance are deferred to the later mobile-port pass in Phase 11 and Phase 13.
- The desktop presentation must be independently accepted at the full AAA critic gate before responsive/mobile visual adaptation begins.
- Deferred mobile work may not be deleted or made worse intentionally; it is simply not the current design or release blocker.

## Non-Negotiable Outcomes

- The field and card systems adhere closely to the supplied references rather than merely borrowing a green/gold palette.
- All 29 catalog creatures, 26 verses, and every runtime-created token/derived face receive complete, consistent, original presentation art.
- Solo and multiplayer remain clients of the existing shared engine; presentation code never becomes a second rules authority.
- Gameplay protocol remains unchanged except for a minimal, tested privacy projection correction: opponent state exposes a face-down Set Verse as opaque presence only, and the initial `setVerse` event carries no card identity.
- Every catalog, token, and derived face resolves through a stable content identity contract; display names are never asset keys or identity fallbacks.
- The current six gameplay actions, pointer/touch gestures, keyboard shortcuts, card inspection, targeting, triggers, graveyard, rules, logs, setup flows, and result flows remain usable.
- The high-end scene is optional from the game runtime's perspective: WebGL failure, context loss, reduced-motion preference, or a low-power device must not prevent play.
- Every quality-critical workstream is implemented by a specialist and reviewed by a different, independent critic.
- No visual workstream closes on self-review. The critic must pass deterministic screenshots against a written rubric and anonymized A/B comparison.
- The current critic target is the canonical desktop frame. Mobile critic loops begin only after desktop acceptance.
- The existing dirty worktree is preserved. Current changes in `src/render.js`, `src/styles.css`, and `docs/` are treated as user-owned prototype work until explicitly reconciled.

## Current Baseline

### Verified

- Branch: `feat/cel-shaded-field`
- Baseline commit: `f16804d`
- Unit suite: 304/304 tests pass across 13 test files.
- Production build: passes under Vite 6.4.1.
- Browser smoke test: mode selection, deck selection, match setup, and opening board load without console warnings or errors.
- Reference dimensions: both images are exactly 1672 × 941.
- The copies in `docs/` match the supplied attachments byte-for-byte:
  - Card reference SHA-256: `4ecb53d517d40edc5a7b4907e6991c6b8dcce40cc34e6a21c14b709ed2228056`
  - Board reference SHA-256: `5229e89ad2888ef9f3245d6ecd77605ec56a3cc29a6e378c4c7474659e4b79e7`

### Existing Architecture

- `shared/engine.js` is the rules authority for solo and multiplayer.
- `shared/cards.js` owns the 29 creature and 26 verse definitions.
- `src/solo-dispatch.js` adapts local actions and deliberately separates pre-render events, state replacement/render, and post-render events.
- `src/mp-client.js` receives projected server state, queues updates while animations run, and then plays server events. The current server projection leaks the identity of an opponent's face-down Set Verse; Phase 1 corrects and tests that privacy boundary before baselines are frozen.
- `src/main.js:751-824` currently rebuilds board subtrees with `innerHTML` and `outerHTML`.
- `src/anim.js` exposes Promise-returning animation methods consumed by `src/event-playback.js`.
- `index.html:105-302` contains separate mobile and desktop battlefield trees.
- `src/main.js:862-1125` implements selection, a 15 px drag threshold, field hit detection, and drop routing.
- `src/main.js:1128-1260` implements the 400 ms card-inspection hold behavior.
- `src/main.js:2178-2207` implements keyboard shortcuts.
- `src/main.js:2213-2259` implements the 500 ms pointer/touch End Turn hold.

### Current Visual Gap

The in-progress CSS prototype establishes useful card-family colors and a meadow direction, but it is still materially below the references:

- The field is a flat CSS gradient/pattern rather than a dimensional environment.
- The dark desktop side panels dominate the meadow and conflict with the reference's quiet, full-frame board.
- Slots do not yet form the clear, mirrored tabletop composition in reference 2.
- Cards use tiny text and ASCII art rather than authored illustrations and tactile materials.
- There are no low-poly perimeter models, water, fence, flowers, convincing contact shadows, depth, or atmospheric light.
- Setup, lobby, coin flip, overlays, rules, targeting, trigger reveals, and results still use the old monochrome presentation.
- Destructive DOM rerenders prevent continuous, high-quality card motion.
- There is no reproducible browser visual-regression or blind-comparison harness.

## Technical Choice

Use a **vanilla Three.js + keyed DOM/CSS hybrid**.

### Three.js Owns

- Meadow terrain and baked/lightmapped surface response
- Low-poly perimeter props: trees, rocks, fence, flowers, grass, and river edges
- Warm directional lighting and soft shadows
- Atmospheric particles, sun motes, water shimmer, and—only after the first compositing spike passes—restrained post-processing
- Board-zone decals and card-contact shadow proxies

### DOM/CSS Owns

- Readable card faces and backs
- Hand, board cards, HUD, controls, logs, setup, lobby, rules, modals, and results
- Pointer, touch, keyboard, focus, and screen-reader semantics
- Stable card elements keyed by card UID
- High-resolution close-up/card-detail views

### Why This Is the Best Fit

- The repository is vanilla ESM. React Three Fiber would require a framework and state-layer rewrite with no reference-fidelity benefit.
- Full-WebGL cards would make text rasterization, accessibility, hit testing, modals, and responsive behavior harder.
- DOM-only rendering cannot reproduce the references' environmental depth, cohesive lighting, water, atmospheric motion, and low-poly perimeter.
- A rigid-body dependency is not required. Deterministic FLIP and damped-spring motion can feel physical without allowing simulation state to affect game state.
- The Three scene remains decorative and disposable. The complete game remains playable over a static meadow fallback.

### Renderer and Camera

- Direct, exact-pinned `three@0.185.1` dependency; no reliance on the current extraneous local install.
- Stable `WebGLRenderer`, not experimental WebGPU.
- Do not lock the projection model up front. Phase 2 runs a same-frame graybox bake-off between a calibrated orthographic camera and a calibrated low-FOV perspective camera; only the blind-reference winner is locked.
- One canonical normalized board coordinate system shared by DOM anchors, scene decals, and contact-shadow proxies.
- Widescreen desktop layout matches reference 2. A separate intentional portrait anchor map is deferred to the mobile-port pass rather than constraining the desktop composition.
- Three r185 linear-light rendering with sRGB output and `NeutralToneMapping` for lit props, with calibrated exposure.
- The authored backdrop is display-referred and uses an unlit material with `toneMapped = false`, preventing renderer tone mapping from altering the approved backdrop grade.
- The first DOM/Three compositing spike uses no post-processing. Bloom or other passes may be evaluated only after projection and 2 px/4 px alignment gates pass.

## Reference-Locked Art Direction

### Overall Read

- Warm, inviting, handcrafted storybook fantasy rather than dark terminal UI.
- Low-poly forms with soft painterly lighting; not hard-outline cel shading.
- A bright, playable center framed by denser foliage and props at the perimeter.
- Gold sunlight from the upper-left, soft fill, and long shadows falling down/right.
- Shallow atmospheric depth and mild foreground softness without obscuring cards.

### Field Composition

- Canonical frame: 1672 × 941.
- Environment framing occupies roughly the outer 10–15% of the image.
- The central board remains visually quiet and high-contrast.
- The opponent row occupies approximately 15–37% of frame height.
- A warm emissive divider runs at approximately 44% of frame height, with a small diamond/rune center mark.
- The player field occupies approximately 46–73%; the hand occupies approximately 74–97%.
- Active cards create the same strong lower-left/upper-right diagonal as reference 2.
- Deck, active, bench, utility, and hand cards deliberately use different scales.
- Player and rival zones mirror one another.
- Each side retains deck, active, two bench, set, and grave access even if some rails are contextually collapsed.
- The player hand forms a shallow, centered bottom fan.
- Trees, shrubs, stones, flowers, fences, and river fragments frame corners without intersecting controls.

### Field Palette

- Field gold-green: approximately `#C4AE57`, `#AEA153`, and `#8D8453`
- Deep grass/foliage: approximately `#475646`, `#364A39`, and `#43503C`
- Card paper: approximately `#E3C5A4` and `#D9BA95`
- Creature gold: approximately `#A67635`
- Cast teal: approximately `#29696A`
- Set violet: approximately `#574C52`
- Card-back navy: approximately `#24243E`

These values are starting calibration targets. Final values are selected through same-viewport A/B review.

### Environment Materials

- Rough, soft grass with subtle painted color variation and a restrained normal response.
- Faceted rocks and tree canopies with deliberately simplified geometry.
- Matte wood fences with sunlit top edges.
- Small instanced flowers and grass clumps with seeded placement.
- Water limited to perimeter glimpses with slow shimmer and bright foam accents.
- One shadow-casting key light; distant scenery relies on baked or blob shadows to control cost.
- Bloom is selective and subtle: center divider, mana wisps, and a few magical effects only.

### Card Anatomy

- Approximately 2:3 chassis, with the rendered silhouette tuned to a 0.64–0.67 width/height ratio under the approved perspective. The current 5:7 prototype is too wide.
- The reference-1 showcase places three cards across the lower approximately 55% of frame, with three faint field slots in the upper third.
- Gameplay projection is selected by the Phase 2 orthographic-versus-low-FOV-perspective graybox bake-off. Both candidates use the same canonical anchors and approximately 22–30° off-vertical staging; inspection/showcase starts approximately 30–38° off vertical with restrained edge-focused depth of field. Exact values are tuned by comparison because they cannot be recovered from a still image.
- Thick ivory outer edge, recessed colored frame, inner paper face, and visible card thickness.
- Three frame families:
  - Creature: antique gold/amber
  - Cast Verse: aged teal
  - Set Verse: muted plum
- Cost medallion at top-left.
- Large art window in the upper half.
- Parchment rules panel below the art.
- Creature attack and health medallions at bottom-left and bottom-right.
- Cast/Set footer mark in the lower band.
- Navy/plum card back with fine gold celestial/filigree line work.
- Poison, trapped, fortified, and unbreakable appear as small physical charms, seals, or edge badges.
- Long names and long rules text remain readable; the illegible glyph-like text in the references is not copied.

### Card Art

- Produce an art manifest derived from every renderable face: the 55 catalog cards plus runtime-created tokens such as Antling (56 known faces today), with future tokens discovered automatically.
- Add a presentation-independent `shared/face-registry.js` content contract:
  - Catalog faces resolve from their immutable catalog `id`.
  - Every token or derived face is declared in a canonical registry and stamped with an explicit stable `presentationFaceId`.
  - `resolvePresentationFaceId(card)` reads only the explicit `presentationFaceId` or a validated catalog `id`; it never matches `name`, `subtitle`, rules text, or other display strings.
  - The authoritative shared-engine Antling creation path must stamp `presentationFaceId: "antling"` from the registry so its resolver result is exactly `antling`. This identity-only metadata correction must preserve current gameplay fields, effects, and state transitions.
  - Manifest validation enumerates the catalog and canonical registry and also exercises real engine-created objects. A future runtime face without a registered identity or manifest entry fails validation.
- Each card receives:
  - Source-resolution master
  - Detail crop
  - Thumbnail crop
  - Focal-point metadata
  - Palette/faction metadata
  - Provenance/license record
- Preserve the existing ASCII `art` field for text-only fallback and compatibility.
- Keep browser asset URLs out of shared content modules; the shared registry contains stable content identity and token metadata only, so the server and engine remain presentation-independent.
- Review every card individually, then review each faction as a contact sheet for consistency.

### HUD and Controls

- Remove the visual weight of the current black sidebars.
- Use quiet, diegetic edge rails or carved/parchment tokens for life, mana, deck, grave, timer, and turn.
- Actions remain immediately available but visually subordinate to the board.
- Disabled, available, selected, targeting, and unaffordable states must be unmistakable.
- The battle log becomes a collapsible journal/edge strip with a live region for accessibility.
- Keyboard labels remain visible where useful.

### Setup and Overlay States

The same material system applies to:

- Mode selection
- Multiplayer create/join/wait/error states
- Deck selection and preview
- AI difficulty
- Rival deck selection
- Coin call and first/second choice
- Begin/turn transitions
- Summon, cast, set, retreat, and target selectors
- Optional trigger and Skitter decisions
- Card detail and graveyard
- Rules
- Cast/set/ability reveal
- Victory/defeat and restart/menu return

### Motion, Effects, Audio, and Haptics

- Preserve the Promise-based `Anim` contract and event ordering.
- Use deterministic springs and FLIP transitions keyed by UID.
- Draw: deck-to-hand arc and spring settle.
- Summon: lifted card, rune glow, contact shadow, and settle.
- Attack: readable wind-up, lunge, impact, recoil, and damage response.
- Damage/heal: restrained particles, physical card reaction, and legible values.
- KO: lift, desaturate, dissolve/leaf motes, then move to grave.
- Set: flip to card back and slide into the set zone.
- Trigger/cast: faction-colored reveal and effect-specific accent.
- Retreat/promotion: explicit crossed paths that preserve positional comprehension.
- Coin flip: actual 3D coin rotation with deterministic result.
- Ambient motion never moves interaction targets.
- Hover lift is restrained to approximately 4–7 px with slight camera-relative tilt and a corresponding contact-shadow separation.
- Drag uses inertial lag and velocity-responsive pitch, with legal-slot magnetism only near the valid destination.
- Do not animate the whole field with a global “breathing” transform.
- Avoid elastic/bouncy UI motion; physical actions use one restrained damped settle.
- Audio includes meadow ambience, card handling, UI, summon, attack, damage, cast, trigger, coin, and result cues.
- Audio starts only after user gesture and includes mute controls.
- Optional vibration is capability-gated and never required.
- Reduced motion removes parallax, overshoot, shake, and full-screen flashes while retaining state clarity.

## Target Architecture

```text
shared engine / multiplayer server
              |
         state + events
              v
      PresentationCoordinator
       /          |          \
KeyedBoardView  MotionDirector  MeadowScene
DOM cards/HUD   Promise API     Three.js canvas
       \          |          /
        semantic target registry
```

### Core Contracts

- `PresentationCoordinator.update(nextState, selectedCard)` is idempotent.
- State reconciliation keys card nodes by stable `uid`; it never stores mutable engine object references.
- `TargetRegistry` resolves semantic targets such as `me.active`, `opp.bench.1`, and `me.life`.
- `Anim` remains a compatibility façade and always resolves safely, including missing-target and fallback cases.
- The canvas is `aria-hidden` and does not own gameplay pointer events.
- One responsive DOM board exists after migration; duplicate desktop/mobile trees are removed only after parity tests pass.
- A feature flag keeps classic/fallback presentation available until all gates pass.
- Gameplay protocol is unchanged except for the tested opponent face-down Set privacy projection correction: the client treats `{ faceDown: true }` as opaque presence, and the initial `setVerse` event is the exact identity-free shape `{ type: "setVerse", side }`.
- `window.__TINY_FANGS_VISUAL_READY__` is the single deterministic visual-QA readiness contract. It resets to `false` on fixture, viewport, quality-tier, or route changes and becomes `true` only after fonts, current-view art/textures, shader compilation, layout, and two settled animation frames are ready.

## Planned File Structure

```text
src/presentation/
  index.js
  presentation-coordinator.js
  board-layout.js
  quality-controller.js
  capabilities.js
  assets/
    manifest.js
    preload.js
  dom/
    keyed-board-view.js
    card-view.js
    hud-view.js
    overlay-view.js
    target-registry.js
  scene/
    meadow-scene.js
    meadow-materials.js
    environment-props.js
    board-decals.js
    atmosphere.js
    card-shadow-proxies.js
    resource-tracker.js
  motion/
    motion-director.js
    spring.js
    transition-planner.js
    reduced-motion.js
  audio/
    audio-director.js
  styles/
    tokens.css
    shell.css
    board.css
    cards.css
    overlays.css
    motion.css
    responsive.css

src/assets/
  cards/
    creatures/<card-id>/
    verses/<card-id>/
  frames/
  environment/
  ui/
  fonts/
  audio/

public/basis/

shared/
  face-registry.js

scripts/
  validate-assets.mjs
  capture-visuals.mjs
  make-blind-ab-sheet.mjs
  check-presentation-budget.mjs

playwright.config.mjs
tests/presentation/
tests/e2e/
tests/visual/
```

## Existing Files Expected to Change

- `package.json`, `package-lock.json`
  - Pin `three` exactly to `0.185.1`.
  - Pin `@playwright/test` exactly to `1.61.1`; do not use a caret or range.
  - Add `test:e2e`, `test:e2e:multiplayer`, `test:visual`, and `test:presentation` scripts.
  - Add asset validation and performance-budget scripts.
- `playwright.config.mjs`
  - Read and validate `TINY_FANGS_VITE_PORT` and `TINY_FANGS_WS_PORT`, defaulting deterministically to `4173` and `3101`.
  - Own two `webServer` processes: Vite on `127.0.0.1` with `--strictPort`, and `npm --prefix server start` with the configured WebSocket port.
  - Set `reuseExistingServer: false` in CI so Playwright owns and tears down both processes; local reuse is allowed only after health checks confirm the expected services.
  - Launch test pages with the existing `?ws=ws://127.0.0.1:<port>` override. Keep the stateful two-browser multiplayer project serial and run it with one worker.
- `vite.config.js`
  - Preserve `base: './'`.
  - Lazy-load the Three scene.
  - Keep large assets external and fingerprinted.
  - Validate GitHub Pages paths for GLB/KTX2/Basis assets.
- `index.html`
  - Add the scene canvas and unified board shell.
  - Retain compatibility IDs until E2E parity passes.
- `src/main.js`
  - Mount/dispose the presentation coordinator.
  - Delegate board reconciliation without changing actions or game flow.
- `src/render.js`
  - Preserve public exports.
  - Move card view-model/markup work into presentation modules.
  - Add stable UID, zone, and accessibility attributes.
- `src/anim.js`
  - Preserve method names, timing semantics, and Promises.
  - Delegate to `MotionDirector`.
- `src/event-playback.js`
  - Replace brittle CSS target lists with semantic targets.
  - Do not alter event meaning/order.
- `src/mp-client.js`
  - Delegate shell selection to the unified responsive presenter.
  - Preserve `?ws=` over `localStorage.tinyFangsWs` over the production default endpoint.
  - Keep gameplay protocol and conversion unchanged except for accepting the tested opaque opponent Set projection.
- `src/styles.css`
  - Preserve current prototype while components are migrated.
  - Ultimately become the compatibility/reset entrypoint for modular presentation styles.
- `tests/render.test.js`, `tests/anim.test.js`
  - Retain all existing assertions and add new contract coverage.
- `shared/face-registry.js`, `shared/engine.js`, and focused shared-engine tests
  - Add the presentation-independent face identity registry and stamp only stable token/derived presentation identity; preserve existing gameplay fields and effects.
  - Prove that an Antling created by the real authoritative engine resolves to `antling`; reject display-name matching.
  - Remove the unused card name from the initial `setVerse` event so its exact public shape is `{ type: "setVerse", side }`; trigger/cast reveal events retain identity only when the rules reveal that card.
- `server/GameEngine.js` and focused server projection tests
  - Replace the current spread of the opponent Set Verse with the exact opaque sentinel `{ faceDown: true }`.
  - Assert an allowlist for that projection and the absence of `id`, `uid`, `name`, `subtitle`, `art`, `text`, `trigger`, `effects`, and all other identity-bearing fields.
- `server/index.js`
  - Read the WebSocket port from validated `TINY_FANGS_WS_PORT`, retaining `3001` as the normal development default.
  - Expose a minimal non-gameplay `/healthz` response on the same HTTP server used for WebSocket upgrades so Playwright can wait for the exact process it owns.
- `.github/workflows/deploy.yml`
  - Run root `npm ci` and `npm --prefix server ci`.
  - Install the pinned Chromium with `npx playwright install --with-deps chromium`.
  - Run unit, build, E2E, multiplayer, visual, asset, and release-gate scripts in the pinned capture environment.
  - Upload Playwright reports, traces, screenshots, videos, visual diffs, and blind-comparison artifacts with `if: always()`; preserve failure evidence and do not leak blind-label mappings to critics.

### Playwright and CI Contract

- Root dev dependencies are exact: `"three": "0.185.1"` and `"@playwright/test": "1.61.1"`.
- Root scripts are explicit:
  - `"test:e2e": "playwright test --project=e2e"`
  - `"test:e2e:multiplayer": "playwright test --project=multiplayer --workers=1"`
  - `"test:visual": "playwright test --project=visual --workers=1"`
  - `"test:presentation": "npm test -- --run && npm run build && npm run test:e2e && npm run test:e2e:multiplayer && npm run test:visual"`
- `playwright.config.mjs` defines separate `e2e`, `multiplayer`, and `visual` projects. The multiplayer project matches only `tests/e2e/multiplayer/**`, sets `fullyParallel: false`, and each spec uses a fresh room and two isolated browser contexts.
- The config validates integer ports from `TINY_FANGS_VITE_PORT` and `TINY_FANGS_WS_PORT`, rejects collisions, and defaults to `4173` and `3101`. Vite starts with `--host 127.0.0.1 --strictPort`; the server receives the selected WebSocket port through its environment, serves `/healthz`, and upgrades gameplay connections on that same listener.
- Every multiplayer page is opened with `?ws=ws://127.0.0.1:<configured-port>`. Separate precedence tests exercise `localStorage.tinyFangsWs` without a query parameter and prove that a query parameter wins when both exist.
- Playwright owns both child processes. CI never reuses servers; local reuse requires the expected health response. Teardown is asserted by releasing both configured ports after the run.
- A clean CI job runs `npm ci`, `npm --prefix server ci`, and `npx playwright install --with-deps chromium` before tests. The exact package/lockfiles select the browser revision.
- Traces, screenshots, and videos are retained on failure; HTML/JUnit reports and deterministic visual/critic artifacts are uploaded with `if: always()`. Blind A/B mappings are stored separately from critic inputs.

## Detailed Implementation Plan

### Phase 0 — Protect Work and Record the Live Baseline

- [x] Record the current branch, commit, `git status`, and diffs.
- [x] Preserve the uncommitted `src/render.js`, `src/styles.css`, and reference copies.
- [x] Decide line-by-line which prototype changes are retained, superseded, or isolated; do not blanket-revert.
- [x] Record a minimal live smoke baseline for setup, deck selection, and opening board before adding test infrastructure.
- [x] Record the 304-test and build baseline.
- [x] Add a rollback-friendly presentation flag; classic/fallback remains available during migration.

**Acceptance**

- No user-owned edits are lost.
- Classic presentation can still launch.
- The pre-infrastructure smoke evidence, repository state, and reference hashes are recorded.

### Phase 1 — Characterize Functionality Before Visual Replacement

- [x] Build a full behavior matrix for solo and multiplayer.
- [x] Establish the reproducible browser topology:
  - Add exact-pinned `@playwright/test@1.61.1` to the root dev dependencies and commit the root lockfile change.
  - Run `npm ci` at the root and `npm --prefix server ci` for the separately locked WebSocket server.
  - Add `playwright.config.mjs` with deterministic, configurable Vite/WebSocket ports (`4173`/`3101` by default), two Playwright-owned `webServer` entries, Vite `--strictPort`, health checks, and guaranteed teardown.
  - Add `test:e2e`, `test:e2e:multiplayer`, `test:visual`, and `test:presentation`; the real two-browser multiplayer suite is serial and runs with `--workers=1`.
  - In CI install Chromium with `npx playwright install --with-deps chromium`, do not reuse existing servers, and upload reports/traces/screenshots/videos/diffs on every run.
- [x] Add direct regression tests that first demonstrate both current Set leaks:
  - `getStateForPlayer()` spreads the complete opponent face-down Set into projected state;
  - `shared/engine.js#setVerse()` emits the hidden card name in `events[].verse`, even though the UI's `setVerse` handler uses only event type and side.
- [x] Make the minimal isolated privacy correction: projected opponent Set state is exactly `null` or `{ faceDown: true }`, and the initial placement event is exactly `{ type: "setVerse", side }`. Do not redact later trigger/cast events after game rules reveal the card.
- [x] Add two-browser WebSocket-frame capture and DOM/accessibility/preload assertions proving that opponent face-down Set identity is absent from network payloads and cannot be inferred from markup, labels, asset URLs, preload metadata, or debug output.
- [x] Freeze endpoint-selection behavior in browser tests: `?ws=` has highest precedence, `localStorage.tinyFangsWs` is the fallback override, and the production endpoint remains the final fallback.
- [x] Freeze multiplayer room behavior in browser/server tests: uppercase-and-trim normalization, create/join/wait/ready/back flows, socket and empty-room cleanup, invalid/missing/full-room errors, not-in-room errors, disconnect, and action errors.
- [x] Freeze preview cancellation with `pointercancel`, including listener cleanup and no delayed preview after cancellation.
- [x] Characterize and replace timer ownership with one root mounted-game owner; prove canonical desktop `0:00 → 1:01`, one interval across repeated starts and authoritative state replacement, and disposal on result, reload action, back, mode change, disconnect, opponent departure, clear/unmount, and repeated connection. The full post-navigation restart journey remains STA-10.
- [x] Preserve and test the exact-value `localStorage.tinyFangsDebug` diagnostic path, including all 19 missing/removed animation targets and allowlisted diagnostics that cannot expose hidden card identity or payload/source values.
- [x] Add deterministic game fixtures for:
  - Empty opening board
  - Representative creature/cast/set opening hand
  - Full active/bench/set board
  - Target selection
  - Poison, trapped, fortified, and unbreakable
  - Attack, retaliation, multi-hit, damage reduction, heal, KO, promotion
  - Optional trigger and Skitter response
  - Graveyard, rules, card detail, trigger reveal
  - Victory, defeat, deck-out
  - Hidden opponent hand/set in multiplayer
- [x] Add the deterministic capture harness, state serialization, and exact `window.__TINY_FANGS_VISUAL_READY__` contract.
- [x] After the fixtures exist, freeze exhaustive classic baselines with fixture-state hashes, screenshot hashes, browser version, viewport, DPR, and font/asset readiness.
- [x] Characterize current event playback gaps before changing them.
- [x] Add canonical-desktop browser tests for the exact 15 px drag threshold, 400 ms long press, 500 ms End Turn hold, `S/C/T/A/R/E`, `Escape`, and the existing `Ctrl+0–9` developer animation/reveal shortcuts. Task 14 retains mobile emulation only as deferred-port evidence; the narrower INP-10 guard cross-product and semantic Escape-policy cases remain explicit follow-ups.
- [x] Add two-browser multiplayer smoke coverage against the real local WebSocket server.

**Files**

- `tests/e2e/*`
- `tests/visual/fixtures/*`
- `tests/server/*`
- `src/presentation/testing/*`
- `playwright.config.mjs`
- `server/GameEngine.js`
- `server/index.js`
- `.github/workflows/deploy.yml`

**Acceptance**

- Every currently supported journey has a repeatable test or explicit manual script.
- Direct projection tests prove an opponent's face-down Set is exactly opaque presence, direct event tests prove initial Set placement is identity-free, and captured WebSocket frames prove no identity-bearing field leaves the server before rules reveal the card.
- Gameplay protocol is unchanged except for this tested privacy projection correction covering opaque state and initial Set-event redaction.
- Endpoint override precedence, room normalization/cleanup/errors, preview `pointercancel`, timer ownership/disposal, and `tinyFangsDebug` behavior are all characterized by passing tests.
- Root and server installs, pinned browser installation, deterministic ports, one-worker multiplayer execution, process teardown, and CI evidence retention are reproducible from a clean checkout.
- Existing pre-render/post-render event order is captured by tests.
- Exhaustive baseline captures are reproducible from fixture and screenshot hashes.

### Phase 2 — Approve the Visual Bible and Asset Manifest

- [x] Create the production art-direction document from the two references. (Accepted by user manual pass at hash `84b89838…`; see Task 19 handoff.)
- [x] Build two populated-board grayboxes with identical anchors and art placeholders:
  - calibrated orthographic projection;
  - calibrated low-FOV perspective projection with matched framing.
- [x] Blind-compare both candidates at 1672 × 941 for board silhouette, zone alignment, near/far scale, foreground/background depth, prop parallax, reference fidelity, and projected DOM/Three drift. Lock the winning projection and its calibration only after it passes; retain both evidence sets and the blinded result. (**Locked: low-FOV perspective, FOV 30°, pitch 24.5°, distance 1950 — unanimous two-critic §13.4 pass on packet `camera-bakeoff-4` (92.1/92.3); decision record `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/camera-lock-decision.md`.**)
- [ ] Lock the selected camera, board anchors, color palette, card proportions, frame materials, lighting direction, environment density, and typography.
- [ ] Define source, detail, thumbnail, and fallback requirements.
- [x] Implement the canonical face registry and pure `resolvePresentationFaceId(card)` contract without asset URLs or display-name matching.
- [x] Stamp every Antling creation path with stable identity metadata from the canonical registry and add a shared-engine test proving a real end-turn-created Antling resolves to exactly `antling` while its pre-existing gameplay behavior remains unchanged.
- [x] Generate a canonical manifest contract from all 56 catalog/runtime faces plus 39 explicit frame, back, status, UI, environment, and audio entries. The 263 production-file destinations remain intentionally absent until art production.
- [x] Add draft and strict-release manifest validation for missing files, dimensions/aspect intent, duplicate hashes, focal points, encoded-size budgets, and provenance/rights. Draft currently reports missing production work as warnings; strict release remains correctly red.
- [x] Make manifest validation instantiate a real engine-created Antling and fail closed for an unregistered future runtime token or a registered derived face missing from the manifest.
- [ ] Self-host licensed fonts and remove remote capture dependencies.

**Acceptance**

- 56/56 currently known renderable faces are listed before bulk art production begins; real engine-created Antling resolves to `antling`, and the validation script fails when a future token/derived face lacks stable identity or an asset entry.
- No resolver or manifest path uses a display name, subtitle, rules string, or artwork text as identity.
- One approved creature, cast, set, and card-back “golden sample” passes blind reference review.
- The winning board graybox matches reference 2's camera and composition before detail work begins; the decision record shows why it beat the alternative projection.

### Phase 3 — Build the Presentation Boundary

- [ ] Add `PresentationCoordinator`.
- [ ] Add `TargetRegistry`.
- [ ] Add a canonical 1672 × 941 normalized board layout plus portrait anchor map.
- [ ] Build an early DOM/Three compositing spike before full asset production:
  - Define world-to-screen projection and the CSS transform contract.
  - Define DOM/Three z-order and occlusion rules.
  - Synchronize CSS pixels, drawing-buffer DPR, camera projection, resize, and orientation changes.
  - Project card-contact shadow proxies from the same canonical anchors.
  - Use visible fiducials and screenshot overlays to measure drift.
  - Use exact-pinned Three r185, `NeutralToneMapping` for lit props, and an authored unlit backdrop material with `toneMapped = false`.
  - Use no post-processing in this first spike so projection, color, and alignment errors remain directly observable.
- [ ] Add capability detection, quality tiers, and static fallback selection.
- [ ] Add lazy scene loading and clean lifecycle/disposal.
- [ ] After the first spike passes the alignment gate, configure `KTX2Loader`/Basis with a `base: './'`-safe transcoder path, call `detectSupport(renderer)`, validate the production path, and dispose loader workers/resources. Do not make compressed textures a prerequisite for the first spike.
- [ ] Implement the exact readiness lifecycle for `window.__TINY_FANGS_VISUAL_READY__` and exercise its reset/ready transitions in deterministic captures.
- [ ] Keep visuals unchanged initially while proving state and event contracts.

**Acceptance**

- Scene failure cannot block gameplay.
- Repeated mount/unmount does not leak listeners, RAF loops, textures, or audio nodes.
- State replacement reconciles by UID.
- DOM card corners, slot decals, and contact-shadow proxies align within 2 CSS px at 1672 × 941 and within 4 CSS px throughout the supported resize/orientation matrix.
- The selected Phase 2 projection, r185 color pipeline, backdrop treatment, and readiness contract are deterministic; the first-spike evidence contains no post-processing.
- KTX2/Basis support is added only after the spike, works from the production relative base, and disposes cleanly.

### Phase 4 — Replace Destructive Board Rerenders

- [ ] Introduce stable, keyed card nodes.
- [ ] Patch text/classes/attributes in place instead of replacing moving elements.
- [ ] Add previous/next presentation snapshots for FLIP.
- [ ] Migrate active, bench, hand, set, deck, grave, stats, logs, and actions incrementally.
- [ ] Keep compatibility IDs and inline global handlers until parity passes.
- [ ] Unify mobile/desktop into one responsive DOM tree only after interaction tests are green.

**Acceptance**

- A card keeps the same DOM identity while moving hand → active/bench → grave.
- Selection, long press, drag/drop, modal targeting, and keyboard behavior remain unchanged.
- Animation targeting no longer searches hidden duplicate trees.

### Phase 5 — Produce the Card System

- [ ] Build the three reference-locked frame families.
- [ ] Build the card back, cost medallion, rules panel, stat medallions, status charms, paper grain, edge wear, highlight, and contact shadow.
- [ ] Create detail, active, bench, and hand responsive variants from one card view model.
- [ ] Preserve complete readable rules and live ATK/HP/status changes.
- [ ] Add tilt/foil response with strict angle and motion limits.
- [ ] Add close-up/card-detail presentation modeled on reference 1.
- [ ] Validate longest names, longest rules, zero ATK, damaged HP, buffs/debuffs, tokens, unavailable database cards, and face-down privacy.

**Acceptance**

- Creature, cast, set, and card-back golden samples each score at least 93/100 weighted, with no normalized category below 9.0.
- Card text remains readable at active and detail sizes.
- Opponent set identity and hand contents cannot leak through projected state, initial Set event payloads, network frames, DOM, accessibility text, preload metadata, image URLs, visual-ready metadata, or debug output before a rule-authorized reveal.

### Phase 6 — Produce All Card Art

Split art production by faction into separate specialist passes:

- [ ] Shadow
- [ ] Fang
- [ ] Venom
- [ ] Swarm
- [ ] Shell
- [ ] Tokens and currently un-decked valid cards

For every card:

- [ ] Generate or author a style-consistent original scene.
- [ ] Check subject identity against the card name, subtitle, ability, and flavor.
- [ ] Check faction palette and silhouette at thumbnail size.
- [ ] Create master/detail/thumbnail crops.
- [ ] Record focal point and provenance.
- [ ] Run an individual blind card review.

For every faction:

- [ ] Run a contact-sheet consistency review.
- [ ] Correct outlier palette, rendering style, anatomy, lighting, or crop.

**Acceptance**

- Every renderable-face manifest entry passes; the current baseline is 56/56 (55 catalog cards plus Antling).
- No placeholders, repeated art, broken crops, accidental text, watermarks, or inconsistent rendering styles remain.
- Every card passes individually before its faction can pass.

### Phase 7 — Build the Three.js Meadow

- [ ] Implement the projection selected by the Phase 2 orthographic-versus-low-FOV-perspective bake-off and its responsive crop rules; do not substitute the losing projection for convenience.
- [ ] Build terrain, lightmap/roughness/normal response, and center divider.
- [ ] Add engraved/rune board-zone decals.
- [ ] Add low-poly trees, rocks, fence, flowers, grass, river edges, and foreground framing.
- [ ] Use instancing for repeated foliage.
- [ ] Add warm key light, restrained fill, baked scenery shadows, and dynamic card-contact shadows.
- [ ] Add seeded wind, dust motes, fireflies, and water shimmer.
- [ ] Only after the no-postprocessing spike and alignment gates pass, evaluate selective bloom/soft atmosphere by quality tier against reference fidelity and performance budgets; retain the unprocessed path when it is stronger or safer.
- [ ] Create static AVIF/WebP field fallback from the same approved composition.

**Acceptance**

- A matched populated `board-midgame-reference` capture at 1672 × 941 explicitly wins the blind comparison against reference 2. Field-only judgments use identically aligned environment masks/crops from those populated images rather than comparing an empty challenger to a populated reference.
- The center remains readable under a full board and full hand.
- No environmental prop overlaps a control or interactive card at any supported viewport.

### Phase 8 — Recompose the Board, HUD, and Actions

- [ ] Place deck, active, two bench, set, grave, and hand anchors to match reference 2.
- [ ] Convert life, mana, deck, grave, turn, timer, actions, and log to quiet edge rails/diegetic tokens.
- [ ] Preserve click/touch targets and visible disabled/selected/targeting/affordability states.
- [ ] Keep all six actions available on desktop and mobile.
- [ ] Make the player's and rival's ownership unmistakable without a heavy central divider.
- [ ] Ensure the hand fan supports current and edge-case hand sizes.

**Acceptance**

- Reference composition remains the first visual read.
- All current information remains available.
- Gameplay-critical affordances pass contrast, touch-size, keyboard-focus, and legibility checks.

### Phase 9 — Rebuild Setup, Lobby, Modals, Reveals, and Results

- [ ] Restyle mode select.
- [ ] Restyle multiplayer create/join/wait/error/disconnect states.
- [ ] Restyle deck selection, hover/hold preview, AI difficulty, and rival deck choice.
- [ ] Replace the ASCII coin animation with a 3D coin while preserving result timing.
- [ ] Restyle first/second choice and begin/turn transitions.
- [ ] Rebuild action, target, optional-trigger, and Skitter selectors.
- [ ] Rebuild card detail, graveyard, rules, trigger/cast/set reveals, and result screens.
- [ ] Preserve dismissal timing, backdrop behavior, key handling, disabled options, and ownership cues.

**Acceptance**

- Every overlay state belongs to the same visual world as the board.
- No modal traps focus, hides a required decision, or permits invalid action.

### Phase 10 — Motion, Effects, Physics Feel, Audio, and Haptics

- [ ] Keep the `Anim.*` API and Promise timing contract.
- [ ] Map all existing event types to semantic targets.
- [ ] Add deterministic springs/FLIP for draw, summon, attack, damage, heal, set, cast, retreat, promotion, KO, turn change, and result.
- [ ] Add pooled effect-specific particles.
- [ ] Prevent ambient motion from causing layout or hit-target drift.
- [ ] Add audio director, first-gesture unlock, mute, volume persistence, and missing-audio safety.
- [ ] Add capability-gated optional vibration.
- [ ] Add reduced-motion sequences.
- [ ] Produce deterministic 60 fps motion recordings/frame sequences and offline audio-analysis reports for review.

**Acceptance**

- Incoming multiplayer state never interrupts or reorders a running event sequence.
- Visual physics never produces a game action or mutates engine state.
- Every animation resolves even when its target disappears.
- Reduced-motion mode communicates the same state changes.
- Motion/effects pass the motion rubric; audio/haptics pass both their independent critic and objective audio/haptic gates.

### Phase 11 — Responsive, Accessibility, and Fallback Hardening

**Sequencing:** Deferred until the canonical desktop implementation passes its AAA critic loop. Desktop accessibility and static/WebGL fallback remain required during the desktop build; mobile/tablet layout adaptation begins in this phase.

- [ ] After desktop acceptance, validate 2560×1440, 1672×941, 1440×900, 1280×720, 1024×768, 768×1024, 844×390 landscape, 430×932, 390×844, and 360×800.
- [ ] Validate portrait/landscape changes during a match.
- [ ] Add focus order, visible focus, semantic labels, live announcements, and modal focus management.
- [ ] Add text scaling and contrast checks.
- [ ] Add reduced motion, muted audio, Save-Data, low-quality, WebGL-disabled, and context-loss states.
- [ ] Confirm the canvas remains decorative to assistive technology.

**Acceptance**

- Mobile and desktop expose equivalent game information and actions.
- Static fallback can complete a full solo and multiplayer game.
- No layout clipping, offscreen required control, or unreadable card detail remains.

### Phase 12 — Multiplayer and Edge-Case Parity

- [ ] Test create, join, invalid code, waiting, ready, action errors, and disconnect.
- [ ] Re-run direct server-projection, initial Set-event redaction, captured WebSocket-frame, DOM, accessibility, preload, asset-URL, readiness-metadata, and debug-output privacy tests for hidden hand/set/deck information.
- [ ] Re-test `?ws=`/`localStorage.tinyFangsWs` precedence, uppercase/trim room normalization, create/join/back cleanup, empty-room cleanup, and existing error messages.
- [ ] Test state replacement and queued events under slow animations.
- [ ] Test optional triggers and Skitter response in both solo and multiplayer.
- [ ] Re-test preview `pointercancel`, timer ownership/disposal, and `tinyFangsDebug` after the unified presenter replaces legacy DOM paths.
- [ ] Resolve the current 600 px vs 900 px shell-selection mismatch as a focused presentation fix.
- [ ] Characterize and test the current timer, result playback, and bench-event gaps before deciding whether any minimal fix is required.

**Acceptance**

- Gameplay protocol is unchanged except for the tested opponent face-down Set privacy projection correction: projected state is opaque and the initial placement event is identity-free. Shared gameplay rules remain unchanged, and stable token/derived-face metadata is presentation-independent.
- The opponent Set state is exactly opaque presence, its initial event is exactly `{ type: "setVerse", side }`, endpoint overrides and room lifecycle/error behavior remain compatible, and no timer/listener/socket survives its owner.
- Two-browser games reach result without visual desynchronization.

### Phase 13 — Performance and Delivery Hardening

- [ ] During the deferred mobile-port pass, name and record the actual lowest-supported physical mobile device before running the `mobile-reference` gate: model, chipset/RAM when known, OS version, browser and build, power state, viewport, DPR, and availability.
- [ ] Add adaptive quality selection and an explicit user override.
- [ ] Cap drawing-buffer DPR.
- [ ] Lazy-load scene and non-current card art.
- [ ] Use thumbnail/detail variants and compressed scene textures.
- [ ] Pool transient meshes/particles.
- [ ] Suspend ambient rendering on hidden tabs.
- [ ] Precompile/warm visible shaders and upload critical textures before reveal.
- [ ] Dispose textures, geometries, materials, render targets, observers, RAF loops, and audio nodes.
- [ ] Test the production `dist/` build under the relative GitHub Pages base.
- [ ] Enforce payload and runtime budgets.

**Acceptance**

- Meets all performance budgets below.
- The physical `mobile-reference` result names the device actually tested. Emulation or desktop throttling can support regression detection but cannot satisfy or be reported as this real-device gate. Selecting the device is required by Phase 13 and release, but does not block Phases 0–3.
- No context-loss crash or broken asset path.
- No progressive memory growth across repeated matches.

### Phase 14 — Independent AAA Critic Loop

Run this loop separately for:

1. Field/environment
2. Creature card
3. Cast card
4. Set card
5. Card back
6. Complete card-art catalog
7. Board composition/HUD
8. Setup/lobby
9. Modals/reveals/results
10. Motion/effects
11. Audio/haptics
12. Mobile
13. Static fallback
14. Final combined game

For each item:

- [ ] Implementer produces the deterministic evidence set appropriate to the item: stills, aligned crops, 60 fps recordings/frame sequences, audio analysis, or interaction traces.
- [ ] Regression agent verifies tests/build/functionality.
- [ ] For reference-comparable field/card items, the orchestrator creates equal-size, color-managed, randomized A/B contact sheets.
- [ ] Two fresh critics review every item: one domain critic and one general AAA visual director.
- [ ] Each critic receives a fresh context containing only the scoped brief, the applicable artifact-specific rubric, and anonymous evidence—not file names, implementation notes, prior scores, or the other critic's findings.
- [ ] Reference-comparable critics choose the stronger image before the mapping is revealed; ties are not accepted.
- [ ] Each critic lists the three largest visible deficits and scores every applicable category.
- [ ] Any failed category returns to the same specialist as a bounded correction brief.
- [ ] A new evidence set is generated and reviewed by two newly spawned critics to prevent score anchoring.
- [ ] No item closes until all gates pass.

Failure or disagreement from either critic fails the item. If a critic cannot evaluate the evidence, replace that critic; do not count an abstention as a pass.

There is no arbitrary iteration cap. The loop stops only when every gate passes on two consecutive revisions and the second pass introduces no new P1/P2 issue, or when an external blocker requires an explicit user decision. Three stagnant cycles on the same defect trigger an art-direction/asset decision review; they do not permit declaring the item complete.

### Phase 15 — Release Gate

- [ ] Run all unit, browser, multiplayer, accessibility, visual, asset, build, and performance checks.
- [ ] Run the final blinded field/card/full-board comparisons.
- [ ] Verify a clean production deployment artifact.
- [ ] Confirm only expected files changed.
- [ ] Update architecture and visual-system documentation.
- [ ] Obtain final user sign-off before removing the classic rollout flag.

## Specialist Agent Orchestration

The four-slot agent limit is handled in waves. The primary orchestrator never delegates engine authority.

### Wave A — Baselines and Contracts

- Functionality preservation agent
- Visual-bible/asset-manifest agent
- Browser-fixture and E2E agent

### Wave B — Parallel Production

- Meadow/environment agent
- Card-system agent
- HUD/overlay agent

Card art then runs in faction waves, with a stable art director and separate critic:

- Shadow agent
- Fang agent
- Venom agent
- Swarm agent
- Shell agent
- Token/un-decked-card agent

### Wave C — Integration

- Keyed-rendering/state-reconciliation agent
- Motion/effects/audio agent
- Responsive/accessibility/fallback agent

### Wave D — Hardening

- Multiplayer parity agent
- Performance/resource agent
- Functional regression agent

### Wave E — Critique

- Independent field critic
- Independent card critic
- Independent interface/responsive/fallback critic
- Independent interaction/motion critic
- Independent audio/haptics critic
- Fresh general AAA visual director paired with the relevant domain critic for every gate

A critic never reviews its own implementation. If a critic contributed code to a workstream, a fresh critic is assigned.

## Blind A/B Review Protocol

### Comparison Sets

- **Field:** reference 2 versus a populated Tiny Fangs board at 1672 × 941.
- **Cards:** reference 1 versus a matched three-card close-up using creature/cast/set cards.
- **Details:** aligned crops for environment corners, slot engraving, card frame, card art, rules panel, stats, card back, and hand fan.
- **Responsive:** Tiny Fangs build variants only, because the references provide no portrait/mobile target.
- **Motion/effects:** deterministic 60 fps recordings or frame sequences; no still-reference forced choice because the supplied images do not define timing.
- **Audio/haptics:** normalized clips, in-context recordings, offline analysis, and interaction traces; no visual-reference forced choice.

### Blinding

- Equal-size images with identical color profile and no filenames.
- Randomized left/right placement generated by script.
- Labels are only `A` and `B`.
- Mapping is stored separately and not shown to the critic.
- Critic records preference and scores before reveal.

This is a blinded label test, not a claim that the content is impossible to recognize. A reviewer may infer which image is the game from its text; the process prevents knowing which side the orchestrator expects it to prefer.

### Reference-Comparable Field/Card Rubric

| Category | Weight |
|---|---:|
| Reference fidelity and emotional tone | 20 |
| Composition, camera, scale, and hierarchy | 15 |
| Card craft, illustration, and graphic system | 20 |
| Lighting, materials, shadows, and environment | 15 |
| Readability and gameplay-state clarity | 10 |
| Motion, physics, feedback, and restraint | 10 |
| Cross-screen system coherence | 5 |
| Responsive, accessibility, and performance quality | 5 |

Use this rubric for the populated board, card showcase, card frames/backs, catalog contact sheets, and final combined reference comparisons. For a scoped crop where a category is genuinely not observable, mark it N/A and redistribute that weight proportionally across the remaining categories. A category cannot be marked N/A merely because it is weak.

**Amendment (2026-07-27):** for the desktop integrated-stills packet specifically, the art bible's §13.5 explicit seven-category weight vector (F20 C15 K20 L15 R10 S10 A10) supersedes proportional redistribution — motion is unobservable in stills by construction, so its weight is pre-assigned there once. This is the single governing weight vector for that packet; motion/effects artifacts keep the motion rubric below unchanged.

### Interface/Responsive/Fallback Rubric

| Category | Weight |
|---|---:|
| Art-direction coherence | 20 |
| Composition and responsive adaptation | 20 |
| Gameplay-state legibility | 20 |
| Input affordance and touch/focus quality | 15 |
| Functional parity and fallback completeness | 15 |
| Accessibility and performance | 10 |

Use this for setup, lobby, overlays, mobile, and static fallback. The still references provide no portrait/fallback equivalent, so these items do not need to “beat” a reference forced choice; they must instead meet this rubric and preserve the approved system.

### Motion/Effects Rubric

Evaluate deterministic 60 fps recordings or frame sequences, not still screenshots alone.

| Category | Weight |
|---|---:|
| Physical plausibility and weight | 20 |
| Timing, anticipation, impact, and settle | 20 |
| Gameplay readability and event order | 20 |
| Effect restraint and faction coherence | 15 |
| Shadow/particle/card synchronization | 10 |
| Reduced-motion equivalence | 10 |
| Frame pacing and input continuity | 5 |

### Audio/Haptics Rubric and Objective Gates

| Category | Weight |
|---|---:|
| World and faction coherence | 25 |
| Feedback clarity and timing | 25 |
| Mix balance and restraint | 20 |
| Loop/edit cleanliness | 15 |
| Mute/autoplay/fallback behavior | 10 |
| Haptic restraint | 5 |

Objective gates:

- Offline audio validation reports no clipping and a master true peak at or below −1 dBTP.
- Comparable clips within one SFX family stay within 3 LU unless a documented gameplay hierarchy requires a larger difference.
- Decoded, warmed SFX begin within 50 ms on `desktop-reference` and 100 ms on `mobile-reference`.
- Ambience loops have no audible click and pass the waveform seam check defined by the audio validation script.
- Autoplay-blocked startup is silent and error-free.
- Mute and volume persist across reload; missing files degrade silently with a logged diagnostic rather than a rejected game action.
- Haptics are opt-in/capability-gated, cancelable, and use no individual pulse longer than 50 ms or pattern longer than 200 ms.

### Pass Rule

**Amendment (2026-07-27):** the camera-graybox lock is governed solely by the art bible's §13.4 camera-specific gate (Tcamera ≥ 90.0, camera-category floors, Q exactly 10.0, zero P0/P1, unanimous blinded preference, one valid reviewed revision, no wow score) — the general pass rule below does not apply to camera grayboxes, which are deliberately provisional-looking. The bible's `desktop-reference-populated` fixture is the canonical populated critic state; the `board-midgame-reference` capture named in Phase 7 is that same fixture rendered under the winning camera, not a second state.

Apply only the criteria relevant to the artifact, plus all of that artifact's objective gates:

- Weighted score at least 93/100 from every critic.
- No normalized category below 9.0/10.
- Every critic rates the result “wow/premium” at least 9.0/10.
- Zero P0/P1 visual, functional, accessibility, or performance defect.
- For the two reference-comparable primary comparisons, the challenger explicitly wins the forced choice from every critic.
- Across reference-comparable full-frame and crop comparisons, the challenger wins at least 75%.
- For card/board items, scale and placement stay within 3% of the approved canonical geometry.
- For deterministic visual captures, same-build reruns achieve SSIM ≥ 0.995 outside declared dynamic masks.
- The item passes twice consecutively with no new P1/P2 issue on the second pass.
- Functional regression agent passes the corresponding state.
- Performance budget passes at that viewport.

The final user remains the only authority on personal taste. Agent approval is a rigorous quality gate, not an objective proof of universal superiority.

## Automated Verification

- `npm test -- --run`
- `npm run build`
- `npm run test:e2e`
- `npm run test:e2e:multiplayer`
- `npm run test:visual`
- `npm run test:presentation`
- Asset manifest validation
- Direct privacy/identity contracts:
  - `getStateForPlayer()` exposes an opponent Set only as exact opaque presence.
  - `setVerse()` emits no card identity until a later rule-authorized reveal.
  - Captured WebSocket frames contain no opponent Set identity-bearing fields in projected state or initial placement events.
  - A real authoritative-engine Antling resolves to `antling`.
  - An unregistered future token/derived face fails manifest validation.
- Browser E2E:
  - Solo setup through result
  - All six actions
  - Drag/drop and cancel
  - Long press and card detail
  - End Turn hold
  - Keyboard controls
  - Targeting and disabled choices
  - Trigger/Skitter response
  - Graveyard and rules
  - Responsive layout
  - WebGL-disabled fallback
  - `?ws=` and `localStorage.tinyFangsWs` precedence
  - Preview `pointercancel`, timer disposal, and `tinyFangsDebug`
- Multiplayer E2E:
  - Uppercase/trim room normalization, create/join/wait/ready/back, cleanup, and errors
  - Hidden-information assertions at server projection, network, DOM, accessibility, preload, and asset layers
  - Queued animation/state updates
  - Result and disconnect
- Accessibility checks:
  - Focus order
  - Modal focus containment/return
  - Labels/live regions
  - Contrast
  - Reduced motion
  - Text scaling
- Visual captures:
  - Exact reference viewport
  - Desktop/tablet/phone matrix
  - High/medium/low/static modes
  - Frozen seed/time/particles/camera
  - Wait for `window.__TINY_FANGS_VISUAL_READY__` after fonts, current-view art/textures, shaders, layout, and two settled frames are ready

## Performance Budgets

| Budget | Desktop high | Mobile/low |
|---|---:|---:|
| Frame target | 60 fps, p95 ≤ 16.7 ms | 30 fps minimum; 60 fps target |
| Draw calls | ≤ 100 | ≤ 50 |
| Visible triangles | ≤ 300k | ≤ 100k |
| Estimated GPU texture allocation | ≤ 160 MB | ≤ 64 MB |
| Decoded image/asset CPU memory | ≤ 256 MB | ≤ 96 MB |
| Canvas DPR | cap 1.5 | cap 1.0–1.25 |
| Initial app shell | ≤ 500 KB compressed | same |
| First playable visual payload | ≤ 8 MB | ≤ 4 MB |
| Additional streamed assets for one match | ≤ 20 MB | ≤ 10 MB |
| Complete compressed visual catalog | ≤ 80 MB | ≤ 40 MB mobile variants |
| Interaction long task | < 50 ms | < 50 ms |

Additional rules:

- No per-frame DOM layout reads.
- Scenery shadows are baked where possible.
- Dynamic shadows update only when necessary.
- Ambient animation suspends on hidden tabs.
- Gameplay controls never wait on high-quality assets.

### Reproducible Performance Protocol

- Store named profiles in `tests/performance/profiles.json`.
- **Amendment (2026-07-27):** desktop pass authority follows the art bible §13.9 revision 2: the acceptance gate runs on the named `desktop-minimum` tier (the lowest desktop configuration the project commits to supporting, named with the same rigor as `mobile-reference`) against the `desktop-reference-populated` critic fixture at quality tier `desktop-high`. `desktop-reference` below records headroom and regressions only and cannot grant the desktop pass. `board-dense` remains a stress/regression fixture. The mobile protocol is unchanged.
- `desktop-reference` records the exact CPU, GPU, RAM, OS, browser build, power state, viewport, DPR, and quality tier of the current development Mac.
- `mobile-reference` records the same metadata for the named lowest-supported physical phone. Phase 13 must name its model, OS, browser/build, and availability before this gate runs. If no physical device is available, the real-device gate remains explicitly pending rather than being claimed from emulation; this does not block Phases 0–3.
- `mobile-throttled-ci` uses pinned Playwright Chromium, 390 × 844, DPR 1.25, and 4× CPU slowdown for repeatable regression detection; it does not substitute for physical-GPU validation.
- Use the deterministic `board-dense` fixture, a 10-second warm-up, then a 30-second trace.
- Run three traces per profile. The median p95 frame interval must meet the table, and the worst desktop run must remain ≤ 20 ms p95.
- Measure frame intervals from `requestAnimationFrame` timestamps after readiness; exclude loading, hidden-tab, and navigation intervals.
- Read draw calls and triangles from `renderer.info.render`.
- Measure transferred bytes from Resource Timing.
- Measure decoded CPU memory with supported browser memory APIs and report unsupported cases explicitly.
- Estimate GPU texture allocation from dimensions, format, mip levels, and cube/array layers. Label it as an estimate because Three.js counters do not expose actual driver residency.
- “Additional streamed assets for one match” means assets requested after first-playable for the two selected decks and the current environment. It does not mean the entire catalog.

## Functionality Preservation Checklist

- [ ] Solo and multiplayer complete from mode selection to result/restart/menu.
- [ ] Five decks and random choice work.
- [ ] Pup and Hunter behavior is unchanged.
- [ ] Coin call, first/second choice, and first-turn attack prohibition remain.
- [ ] Summon, cast, set, attack, retreat, and end turn work by pointer/touch and keyboard.
- [ ] Existing `Ctrl+0–9` developer animation/reveal shortcuts still target the correct presentation objects.
- [ ] Drag threshold, valid zones, affordability, selection, and cancellation remain.
- [ ] Deck/card preview cancels cleanly on `pointercancel`, releases listeners/capture, and never opens after cancellation.
- [ ] Card inspection works for hand, active, bench, own set, and graveyard.
- [ ] Graveyard, rules, targeting, reveal, optional-trigger, Skitter, and result states remain.
- [ ] Active/bench/set limits, mana, turns, statuses, promotion, and win conditions match the engine.
- [ ] Every card mechanic has legible state and feedback.
- [ ] `?ws=` remains the highest-priority multiplayer endpoint override, followed by `localStorage.tinyFangsWs`, then the production default.
- [ ] Room codes still uppercase/trim; create, join, wait, ready, back, disconnect, empty-room cleanup, and all existing error paths remain correct.
- [ ] Opponent hidden information remains hidden in direct server projections, initial Set events, captured network frames, DOM/accessibility output, asset/preload metadata, readiness state, and diagnostics until a rule-authorized reveal.
- [ ] Multiplayer state cannot interrupt or reorder animation playback.
- [ ] Timer ownership is singular and every timer/listener is disposed on back, restart, mode change, disconnect, and presentation unmount.
- [ ] `localStorage.tinyFangsDebug` continues to enable useful presentation/event diagnostics without exposing hidden information.
- [ ] Mobile and desktop expose equivalent information/actions.
- [ ] Full state replacement reconciles by UID.
- [ ] Animation completion continues to gate state transitions.
- [ ] Existing 304 unit tests remain green.

## Pre-Mortem

### Tigers

1. **The asset catalog is too large to reach a consistent AAA bar.**
   - Severity: HIGH
   - Evidence: `shared/cards.js:5-507` contains 55 unique catalog cards and `shared/effects.js:783-811` plus `shared/engine.js:1521-1527` can create Antling at runtime, while the committed project has no authored card-art pipeline or manifest.
   - Mitigation checked and missing: no complete visual manifest, crop metadata, provenance tracking, or automated completeness gate currently exists.
   - Mitigation: approve golden samples first; derive the manifest from every renderable catalog and token source; validate the complete inventory; review each face individually and by contact sheet.

2. **Destructive DOM rendering breaks continuous motion and object identity.**
   - Severity: HIGH
   - Evidence: `src/main.js:751-824` replaces board subtrees via `innerHTML`/`outerHTML`.
   - Mitigation checked and missing: no keyed reconciliation or persistent visual-node registry exists.
   - Mitigation: finish the keyed presenter before sophisticated card motion.

3. **Presentation changes can reorder gameplay or leak multiplayer information.**
   - Severity: HIGH
   - Evidence: `src/solo-dispatch.js:115-153` and `src/mp-client.js:212-257` rely on specific state/event timing; `server/GameEngine.js:147` currently spreads the opponent's complete face-down Set object, while `shared/engine.js:1407` also emits that hidden card's name in the initial `setVerse` event broadcast to both players.
   - Mitigation checked and missing: existing tests do not cover live browser multiplayer sequencing or DOM/privacy leakage.
   - Mitigation: preserve the `Anim` Promise contract; use semantic targets; make the isolated opaque-state and identity-free-event correction; add direct state/event, captured-network, DOM/accessibility/preload, and real two-browser privacy assertions before integration.

4. **Reference fidelity and existing dense UI compete for the same screen.**
   - Severity: HIGH
   - Evidence: `index.html:193-302` devotes substantial width to permanent stats/actions/log panels, while reference 2 is an almost full-frame field.
   - Mitigation checked and missing: the current UI has no progressive/diegetic rail system.
   - Mitigation: move information into quiet edge rails and progressive panels without removing actions or information.

5. **WebGL/asset delivery fails on low-power devices or GitHub Pages.**
   - Severity: HIGH
   - Evidence: Three is not committed; there is no capability controller, context-loss handling, KTX2 path validation, or static fallback.
   - Mitigation checked and missing: no current WebGL fallback or production asset-path browser test exists.
   - Mitigation: make the scene optional; ship static fallback first; test built `dist/`; enforce quality and memory budgets.

6. **Current uncommitted visual work is overwritten.**
   - Severity: HIGH
   - Evidence: dirty `src/render.js`, `src/styles.css`, and untracked `docs/` on `feat/cel-shaded-field`.
   - Mitigation checked and missing: changes are not committed or isolated.
   - Mitigation: snapshot and reconcile the diff before implementation; never blanket-revert.

7. **Visual approval becomes an endless subjective loop.**
   - Severity: MEDIUM
   - Evidence: “AAA,” “perfect,” and “better” are subjective and the references do not define motion, mobile, sound, or interaction.
   - Mitigation checked and missing: the project currently has no scoring rubric, deterministic capture, or stopping rule.
   - Mitigation: use the explicit blind rubric and pass thresholds above, with the user retaining final taste approval.

8. **Runtime face identity selects the wrong art or lets future tokens bypass the manifest.**
   - Severity: HIGH
   - Evidence: the authoritative end-turn path currently renames a cloned Hiveling to Antling while retaining Hiveling's `id` and descriptive metadata.
   - Mitigation checked and missing: there is no canonical token/derived-face registry or tested stable presentation-face resolver.
   - Mitigation: add the shared content-identity registry, stamp the real engine Antling with stable presentation identity without changing its gameplay behavior, prohibit display-name matching, and make manifest validation fail closed for every unregistered engine-produced face.

### Elephants

- Producing 56 currently known coherent faces, and keeping future runtime tokens covered, is the dominant schedule and quality risk—not the Three.js code.
- Still images cannot reveal exact animation timing, sound, mobile composition, or interaction behavior; these require an approved extrapolation from the same art direction.
- A visual agent can enforce a severe rubric, but cannot mathematically prove that every viewer will prefer the result.
- Several current presentation paths appear under-tested or defective. The overhaul must distinguish preservation from quietly changing game behavior.

### Known Behaviors to Characterize Before Touching

- `src/event-playback.js:98-102` appears to map a desktop player status target to the opponent active selector.
- `src/mp-client.js:185-192` chooses its shell at 600 px while CSS switches at 900 px.
- Multiplayer timer ownership appears inconsistent between `deps.state.G.startTime` and `state.startTime`.
- Bench-specific event playback, `gameOver` playback, and some result paths may be incomplete.
- `server/GameEngine.js:147` and `shared/engine.js:1407` leak opponent face-down Set identity through projected state and the initial placement event; both are explicitly authorized for one minimal tested privacy projection correction.
- `shared/engine.js:1521-1527` creates a renamed Hiveling as Antling and is explicitly authorized to stamp stable `presentationFaceId` metadata from the canonical registry without changing existing gameplay behavior.

These are not authorization for a broad refactor. The opaque Set state, identity-free Set event, and Antling presentation-identity corrections are required, minimal prerequisites; every other item must receive a focused reproduction test and, if required for parity, a minimal isolated fix.

## Locked Implementation Assumptions

- The references are the visual authority for field and cards.
- Original Tiny Fangs characters and mechanics remain the content authority.
- The references' illegible/glyph-like text is replaced with readable real rules text.
- Direct Three.js plus DOM/CSS is acceptable; “ThreeJS or whatever would work” does not require cards themselves to be WebGL meshes.
- Deterministic spring motion satisfies the desired physical feel without a rigid-body engine.
- Audio and optional haptics are included as presentation polish.
- The classic renderer remains temporarily available as a rollback/fallback until final approval.

## Out of Scope

- Changing card balance, shared gameplay rules, or broadly redesigning the WebSocket protocol. The tested opaque Set state, identity-free initial Set event, and stable token/derived-face presentation metadata above are the only prerequisite data-contract corrections in scope.
- New decks, cards, mechanics, accounts, persistence, matchmaking, rematch, reconnect, forfeit, or pause
- Rewriting the project in React
- Making WebGL a requirement for playing
- Using presentation simulation as game-state authority
- Reproducing illegible placeholder glyphs instead of actual card text
- Shipping unlicensed fonts, art, models, or audio

## Completion Definition

The overhaul is complete only when:

- All phases above are complete.
- All 304 existing tests and all new presentation/E2E tests pass.
- Production build and GitHub Pages asset paths pass.
- Every existing solo and multiplayer journey passes.
- Every catalog card, runtime-created token/derived face, and presentation asset passes validation.
- Direct state/event and captured-network tests prove opponent face-down Set identity never crosses the privacy boundary before a rule-authorized reveal.
- Endpoint overrides, room normalization/cleanup/errors, preview `pointercancel`, timer ownership/disposal, and `tinyFangsDebug` pass preservation tests.
- The named physical mobile reference device passes Phase 13; emulation is not reported as a substitute.
- Field, cards, overlays, motion, mobile, fallback, and final combined game each pass the independent critic.
- Performance, accessibility, and fallback budgets pass.
- The final blinded comparison prefers the challenger for the scoped quality under review.
- The user gives final visual sign-off.

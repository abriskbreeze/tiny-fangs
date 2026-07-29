# Tiny Fangs AAA Presentation — Living Goal Ledger

**Last updated:** 2026-07-29 19:45 EDT  
**Overall status:** In progress  
**Authoritative implementation plan:** `thoughts/shared/plans/PLAN-tiny-fangs-aaa-presentation.md`

This document is the concise, continuously updated record of current and accomplished goals. A goal is marked accomplished only when its implementation handoff and verification evidence exist. Planned work is never counted as finished.

## Status Legend

- **ACCOMPLISHED** — implemented and independently verified
- **IN PROGRESS** — actively being implemented or reviewed
- **QUEUED** — accepted scope, not started
- **EVIDENCE PENDING** — implemented but missing a required verification gate
- **BLOCKED** — cannot advance without an external decision or state change

## Active Delivery Scope

- **Current milestone:** desktop AAA presentation at the canonical 1672 × 941 reference frame.
- **Primary experience (user direction, 2026-07-27):** single player. The complete visual overhaul is built and accepted against the references on the solo path first.
- **Multiplayer:** architecturally in mind, not a current build target. The presentation boundary, keyed card identity, semantic targets, and privacy contracts must stay multiplayer-compatible by construction, but no new multiplayer feature work is scheduled until the visual overhaul is built. Existing multiplayer behavior, authority, and privacy evidence are preserved and must not regress.
- **Current inputs:** mouse, trackpad/pointer, and keyboard.
- **Deferred port:** tablet/phone layouts, portrait/landscape adaptation, touch-specific polish, and physical mobile performance.
- Existing mobile regression evidence is preserved, but mobile-only gaps do not block the desktop build or its independent visual critic loops.

## Current Focus

### Phase 1 — Functionality Characterization and Deterministic Evidence

**Status:** IN PROGRESS

Active work:

- **Task 19 — ACCOMPLISHED BY USER MANUAL PASS (2026-07-28):** The user, as final acceptance authority, manually passed the art bible based on the `fe3d3b25…` lineage, closing the specification critic loop after seven revisions. The accepted artifact `84b89838…` additionally carries all critic-6 and critic-7 corrections (including both P1s: the fixture reachability annotation and the palette-gate median binding). Honest record: agent-critic spec acceptance was never achieved (critics 5–7: 88.3 / 89.1 / 88.2, empirical core byte-exact each time). The user pass covers the specification only — the camera bake-off, golden samples, and every downstream §13.4/§13.5 image gate remain required and unweakened. Next: populated O/P camera grayboxes.

Active evidence checkpoints:

- Task 27 rejected revision `9c3e2ecd…` at 91.2/100, wow 8.8/10, with three P1 and two P2 findings; all five required corrections were applied in the fourth pass (`8d5f84d0…`).
- Critic 5 rejected fourth-corrected revision `8d5f84d0…` at 88.3/100, wow 8.5/10, with three P1, six P2, and ten P3 findings. Every recomputable measurement survived independent verification; the rejection was protocol-layer only: self-defeating blind-mapping distribution, unmeasurable/reference-contradicting shadow and quiet-zone tolerances, an unpinned performance quality tier, dual rulebooks against the plan, and enumerated smaller defects. The fifth pass applied all nineteen findings and re-measured the divider/diamond from R2 pixels under stated thresholds.
- Task 24 is accomplished with 13/13 canonical desktop journeys, 545/545 units, and all 17 immutable classic screenshot hashes unchanged.
- Task 25 is accomplished: raw authorization 1/1, real owner-only flows 2/2, canonical two-client browser 1/1, complete server sweep 17/17, complete multiplayer project 8/8 three consecutive runs, 545/545 units, build, and diagnostics. The strict behavior matrix remains 70 covered, 32 missing, and one deferred physical/manual gate.

Remaining Phase 1 goals:

- Close remaining desktop-blocking behavior contracts without overstating partial evidence: 70 covered, 32 missing, one deferred manual gate
- Add the coupled Play Again journey, supported solo Return-to-Menu route, opponent-grave detail, and reveal auto-timeout
- Finish the remaining pre-threshold End Turn cancellation/guard cross-product
- Add desktop accessibility, reduced-motion, diagnostics, static/WebGL fallback, and live status/combat playback lanes
- Rerun the complete server-process and multiplayer projects after the external execution quota resets

## Accomplished Goals

### Planning and Validation

**Status:** ACCOMPLISHED

- Inspected both 1672 × 941 reference images and hash-verified the repository copies.
- Inventoried the complete current functionality surface.
- Selected a vanilla Three.js environment plus keyed DOM/CSS cards and controls.
- Created the full phased implementation plan, critic rubrics, performance protocol, fallback strategy, and release gates.
- Completed an adversarial plan audit.
- Resolved validation findings covering hidden Set data, Antling identity, browser/server topology, and camera model selection.
- Revalidated the revised plan through Phase 3.

Evidence:

- `thoughts/shared/plans/PLAN-tiny-fangs-aaa-presentation.md`
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/validation-aaa-presentation-v2.md`

### Phase 0 — Preserve and Gate the Existing Presentation

**Status:** ACCOMPLISHED

- Recorded the committed classic and dirty prototype baselines separately.
- Preserved the existing user-owned `src/render.js`, `src/styles.css`, and reference images byte-for-byte.
- Recorded line-by-line reconciliation decisions.
- Added an inert presentation mode gate:
  - default: `classic`
  - opt-in: `?presentation=aaa`
  - namespaced storage override: `tinyFangs.presentation.mode`
- Verified classic and opt-in modes launch without changing the current visuals.

Evidence:

- `tests/visual/baselines/phase-00-dual-baseline.json`
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-00-protect-baseline.md`
- 9/9 focused tests
- Protected prototype hashes unchanged

### Task 01 — Opponent Set Privacy

**Status:** ACCOMPLISHED

- Opponent face-down Set projection is now exactly `null` or `{ faceDown: true }`.
- Initial Set placement events no longer include hidden card identity.
- Owner state and later rule-authorized reveal identity remain unchanged.
- Added symmetric server-projection and engine-event regression coverage.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-01-set-privacy.md`
- 47/47 focused tests

### Task 02 — Reproducible Browser and Multiplayer Topology

**Status:** ACCOMPLISHED

- Exact-pinned runtime `three@0.185.1`.
- Exact-pinned dev-only `@playwright/test@1.61.1`.
- Added deterministic Vite/WebSocket ports, health checks, process teardown, and port validation.
- Added Playwright E2E, multiplayer, and visual projects.
- Added root/server clean-install and Chromium CI wiring.
- Added retained-on-failure browser evidence without exposing blind-test mappings.
- Verified default and custom ports, two-context multiplayer, and process cleanup.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-02-playwright-topology.md`
- 361/361 unit tests
- 9/9 server-process tests
- E2E, multiplayer, and visual smoke tests passed

### Task 03 — Deterministic Fixtures, Serialization, and Readiness

**Status:** ACCOMPLISHED

- Added ten authoritative deterministic fixtures.
- Added privacy-aware canonical state serialization.
- Added the exact `window.__TINY_FANGS_VISUAL_READY__` lifecycle.
- Added query-gated fixture names and readiness bootstrap without replacing game state.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-03-fixture-readiness.md`
- 30/30 focused tests

### Task 04 — Stable Presentation-Face Identity

**Status:** ACCOMPLISHED

- Added a fail-closed catalog and derived-face registry.
- Added a 56-face inventory: 29 creatures, 26 verses, and Antling.
- Stamped all three Antling creation paths with `presentationFaceId: "antling"`.
- Preserved every existing gameplay field and event order.
- Unknown, name-only, colliding, and unregistered identities fail closed.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-04-face-identity.md`
- 83/83 focused tests

### Task 05 — Safe Fixture Activation and Capture Seam

**Status:** ACCOMPLISHED

- Added exact `visualQa=1`-gated fixture activation through the existing state conversion, cleanup, and render paths.
- Projected opponent fixture data to counts and opaque Set presence before it reaches the client.
- Added privacy-safe fixture metadata and deterministic capture-manifest records.
- Invalid names mutate nothing; repeat activation is deterministic.
- Verified live Chromium activation, readiness, privacy, idempotence, and disabled-mode isolation.
- Independently rechecked the `dense-board-statuses` route in the live in-app browser at 1672 × 941: setup was hidden, the desktop battlefield was mounted, and poisoned, trapped, and unbreakable fixture states rendered without console errors.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-05-fixture-activation.md`
- 25/25 focused tests
- 383/383 full tests at task completion
- Live Chromium smoke and isolated production build passed

### Task 07 — Real Two-Browser Hidden-Set Privacy

**Status:** ACCOMPLISHED

- Added a serial, two-context Chromium test against the real WebSocket server.
- Proved non-owner state is exactly `{ faceDown: true }` and the placement event contains no identity.
- Proved the owner retains full inspection while the opponent sees a generic, noninteractive card back.
- Proved identity is absent from non-owner WebSocket frames, DOM, accessibility state, QA/readiness metadata, debug output, requests, preloads, and resource URLs before reveal.
- Exercised both coin-flip ownership paths across two successful runs.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-07-multiplayer-privacy-e2e.md`
- Focused real-browser privacy E2E passed twice
- 389/389 unit tests at task completion

### Task 08 — Authoritative Behavior Matrix and Event Ordering

**Status:** ACCOMPLISHED

- Added a 103-contract matrix covering the current solo, multiplayer, input, overlay, action, result, timer, debug, privacy, responsive, accessibility, and fallback surface.
- Current strict classification after Tasks 09–11 integration: 42 directly covered, 60 missing, and one physical/manual gate.
- Directly proved solo pre-render → state replacement/render → post-render ordering.
- Directly proved multiplayer FIFO state → render → event playback ordering.
- Froze four known gaps without silently fixing them: desktop status targeting, missing bench event playback, no-op `gameOver` playback, and split multiplayer timer ownership.

Evidence:

- `thoughts/shared/tiny-fangs-behavior-matrix.md`
- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-08-behavior-matrix.md`
- 6/6 focused characterization tests
- 389/389 full tests at task completion

### Task 10 — Authoritative Engine and Solo-AI Contracts

**Status:** ACCOMPLISHED

- Added 35 direct contracts for turn authority, Set validation, attack/retaliation order, direct life damage, attack/retreat limits, End Turn order, poison, trapped, Fortify, Unbreakable, promotion, deck-out, Last Breath, and complete Pup/Hunter turn executors.
- Independently re-ran all 35 focused contracts and diagnostics with no errors or warnings.
- Added executable RED sentinels for two newly isolated exact-once defects: duplicate deck-out `gameOver` emission through `executeAction(endTurn)` and duplicate Last Breath `triggerVerse`.
- Updated the behavior matrix evidence without overstating browser/UI coverage; ACT-01 and ACT-16 are now directly covered.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-10-engine-contracts.md`
- 35/35 focused tests
- 426/426 full tests at task completion
- Isolated production build passed

### Task 09 — Solo Setup, Decks, Preview, Coin, and Match Start

**Status:** ACCOMPLISHED

- Added 12 deterministic mounted-browser journeys across desktop keyboard/mouse and 390 × 844 touch.
- Proved all five player/rival deck routes, both real Random controls, Pup/Hunter propagation, all Heads/Tails and first/second branches, first-turn attack rejection, second-player attack enablement, and animation-before-state ordering.
- Proved deck preview RED on `pointercancel` at the exact 400 ms boundary, then GREEN after adding the existing cleanup hook to all five previewable deck controls.
- Independently rechecked the focused AI support and both changed files with clean diagnostics.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-09-solo-setup-e2e.md`
- 12/12 focused Playwright tests
- 35/35 supporting engine/AI tests
- Isolated production build passed

### Task 11 — Multiplayer Lifecycle and Server Authority

**Status:** ACCOMPLISHED

- Added raw-WebSocket and two-context browser coverage for normalized join, every lobby transition, validation without outbound frames, Back cleanup/re-entry, reachable protocol errors, error surfaces, disconnect, room recovery/deletion, visible Summon, illegal actions, and held End Turn.
- Corrected only the two proven lifecycle defects: server-side padded/lowercase room normalization and complete Back socket/UI cleanup.
- Kept `MP-07` partial because `Player not found` is unreachable through the public invariant, and kept owner-only Optional/Skitter delivery and strict multiplayer coin ordering explicitly pending.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-11-multiplayer-lifecycle.md`
- 14/14 raw server protocol tests
- 6/6 complete multiplayer Playwright project
- 5/5 focused client/endpoint unit tests
- Isolated production build passed

### Task 12 — Deterministic Combat and Response Fixtures

**Status:** ACCOMPLISHED

- Expanded the fixture registry from 10 to 17 sorted fixtures with real-engine normal attack, retaliation, multi-hit, damage reduction, healing, optional-trigger pending, and Skitter-response pending states.
- Preserved the existing KO/promotion and inspection/result fixtures.
- Made response payloads owner-only in public serialization and redacted opponent deck, hand, and Set identity; owner-facing authoritative fixtures retain legal response context.
- Independently re-ran all 73 focused fixture/activation/privacy contracts and diagnostics.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-12-combat-response-fixtures.md`
- 73/73 focused tests
- 462/462 full tests at task completion
- Isolated production build passed
- Protected reference and prototype hashes unchanged

### Task 13 — Shared-Engine Exact-Once Corrections

**Status:** ACCOMPLISHED

- Converted both Task 10 RED sentinels to ordinary exact assertions before changing production.
- Removed only the redundant Last Breath branch reveal; the authoritative generic trigger reveal and all negation/consumption state remain unchanged.
- Prevented only a duplicate deck-out `gameOver` append when End Turn already emitted that result.
- Independently re-ran 106 focused engine/effect contracts after the fixes.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-13-engine-exact-once.md`
- 9/9 exact focused contracts
- 195/195 engine/effect gate
- 462/462 full tests at task completion
- Isolated production build passed

### Task 15 — Exhaustive Classic Capture Baselines

**Status:** ACCOMPLISHED

- Added a canonical 1672 × 941, DPR 1 Playwright capture for all 17 authoritative fixtures.
- Recorded privacy-safe fixture hashes, PNG hashes/dimensions, Chromium version, viewport, DPR, readiness, fonts, network/assets, runtime errors, and route metadata.
- Generated 17 unique PNG baselines and proved exact immutable replay twice from fresh server pairs.
- Explicitly recorded that classic does not consume camera, overlay, response, result, status-legend, or transition metadata; those surfaces remain visually uncovered.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-15-classic-capture-harness.md`
- `tests/visual/baselines/classic-v1/manifest.json`
- 3/3 full visual project
- 54/54 focused fixture/manifest tests
- 462/462 full tests at task completion
- Isolated production build passed

### Task 16 — Event-Playback Status and Bench Targets

**Status:** ACCOMPLISHED

- Corrected player poison/trapped playback to target the player active card in both mobile and desktop shells.
- Added deterministic indexed `benchDamage` and `benchKo` playback for both perspectives, with strict Promise ordering and a non-guessing side-container fallback.
- Preserved producer event shapes, engine order, missing-DOM safety, and all styling.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-16-event-playback-targets.md`
- 19/19 focused contracts
- 141/141 animation/render/effect gate
- 475/475 full tests at task completion
- Isolated production build passed

### Task 18 — Event Sequencing, Missing Targets, and Debug Privacy

**Status:** ACCOMPLISHED

- Proved strict handler and inter-event wait ordering for both local and server playback.
- Redacted thrown/rejected handler errors, unknown event diagnostics, arbitrary source values, card names, UIDs, and pending context.
- Locked debug enablement to exact storage value `"1"` and an allowlist of known type, finite amount, and presence-only source tag.
- Exercised all 19 playback Anim facade methods against both missing and removed targets without mutation, leaked nodes, or unhandled rejection.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-18-event-debug-hardening.md`
- 51/51 focused contracts
- 192/192 related playback/animation/effect gate
- 526/526 full tests at task completion
- Isolated production build passed

### Task 14 — Desktop Input Regression and Root-Cause Corrections

**Status:** ACCOMPLISHED

- Added 12 mounted-browser contracts at canonical 1672 × 941 for selection identity, the exact drag boundary, legal/illegal drop routing, long-press inspection, End Turn hold, gameplay keys, Escape, developer shortcuts, and reveal-key consumption.
- Corrected the production boundary so movement below 15 px remains a press and movement at or above 15 px begins drag.
- Made drag `pointercancel` cleanup-only, including listeners, timers, proxy, highlights, capture, and drag state.
- Unified keyboard routing so editable, animation, wrong-turn, winner, and blocking-overlay guards apply consistently and the topmost safe overlay receives Escape.
- Preserved retained 390 × 844 emulation as deferred mobile-port evidence; it is not a desktop release gate.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-14-input-regression.md`
- 12/12 canonical desktop Playwright contracts
- 24/24 combined solo-setup/input contracts
- Real multiplayer Set-privacy regression passed
- 526/526 full tests at task completion
- Isolated production build passed

### Task 17 — Desktop Responsive and Mode-Resolution Characterization

**Status:** ACCOMPLISHED

- Proved the canonical 1672 × 941 viewport and every requested desktop width have one effective shell, no horizontal overflow, reachable controls, complete public HUD data, opaque opponent Set presentation, and zero runtime errors.
- Proved the CSS shell boundary at 599/600/601/899/900/901 and real query/storage/invalid-storage presentation-mode resolution across reloads.
- Froze the existing real-multiplayer 601–899 px duplicate-shell defect without changing production; it belongs to the deferred mobile/tablet port and does not affect canonical desktop.
- Preserved the ten-viewport and rotation matrix as deferred-port regression evidence.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-17-responsive-regression.md`
- 19/19 focused classic browser contracts
- Six real two-client multiplayer boundary starts passed their characterization contract
- 39/39 applicable unit contracts
- 526/526 full tests at task completion
- Isolated production build passed

### Task 22 — Fresh Art-Bible Critic, Revision 1

**Status:** ACCOMPLISHED — REJECTED AS DESIGNED

- Independently inspected both immutable references and rechecked representative geometry, palette samples, luminance regions, contrast arithmetic, camera logic, card anatomy, rail feasibility, and critic-gate executability.
- Rejected frozen Task 19 revision `efed9c0aa0c37017b67b1f4bf4894abd82a7482d9edbe9bad53506e666419746` at 84.2/100 and wow 7.8/10.
- Found five release-blocking P1 contradictions and two P2 numeric inconsistencies; no P0.
- Supplied bounded numeric and wording corrections. This was a specification review, not the later blind challenger-versus-reference image comparison.

Evidence:

- Fresh critic score: reference 9.3, composition/camera 8.2, card system 8.1, lighting/material/environment 9.4, typography/accessibility 8.2, measurability 7.3, implementation readiness 7.5
- Verified all 13 exact palette samples, five luminance-region quantiles, reference hashes, and representative normalized coordinates
- Correction loop remains open; rejection is not counted as visual acceptance

### Task 23 — Fresh Art-Bible Critic, Revision 2

**Status:** ACCOMPLISHED — REJECTED AS DESIGNED

- Independently verified corrected revision `caf117e208d32a89366f9299bcb946da8cb9579dde52a5adf26f39da257a0742` and both source-reference hashes.
- Rejected it at 86.85/100 and wow 8.1/10 with three P1 and two P2 defects; no P0.
- Found an impossible camera-graybox/final-art gate conflation, an unanchored four-card critic showcase, incomplete card-face safe geometry, an unresolved active/hand intersection, and a prose-only originality gate.
- Revalidated palette, luminance, contrast, CIEDE2000 separation, rail math, and unprojected-versus-projected card rules.

Evidence:

- Fresh critic scores: reference 9.2, composition/camera 8.3, card craft 8.4, lighting/environment 9.2, readability 8.5, system coherence 8.8, accessibility/fallback/determinism 8.1
- Specification audit only; this does not count as the later blind challenger-versus-reference image test

### Task 26 — Fresh Art-Bible Critic, Revision 3

**Status:** ACCOMPLISHED — REJECTED AS DESIGNED

- Independently verified revision `762086d3e8afe641c2e16bf6346d65e41f73fef2115c0eb5d3063abe898b9571` and both reference hashes.
- Rejected it despite a 93.3/100 total because readability, system-coherence, accessibility, wow, and zero-P1 gates did not pass.
- Found three P1s: missing deterministic overlay/fallback/performance packet evidence, board inspect targets that scale below 44 CSS px, and opponent HUD crossing its locked 24 px safe inset.
- Found one P2: mandatory color math assumes sRGB although both source PNGs are untagged; the correction must explicitly assign IEC 61966-2-1 on decode and require tagged/declared captures.

Evidence:

- Scores: reference 9.7, camera/composition 9.6, card system 9.5, lighting/environment 9.4, readability 8.9, system coherence 8.8, accessibility/determinism/performance 8.7
- Specification audit only; no blind camera or challenger image acceptance claimed

### Task 27 — Fresh Art-Bible Critic, Revision 4

**Status:** ACCOMPLISHED — REJECTED AS DESIGNED

- Independently verified revision `9c3e2ecdeecef1c13a629893d867debce4b59318a464c75e0a6436443ae24c2e`, both reference hashes/dimensions, and untagged RGB metadata.
- Rejected it at 91.2/100 and wow 8.8/10 with three P1 and two P2 findings; no P0.
- Found non-portable/partly unmeasured performance budgets, circular candidate-generated camera fidelity geometry, and a contradictory authorized-reveal frozen-state contract.
- Requested a canonical packet index/hash-omission rule and trusted signer/revocation policy as P2 corrections.

Evidence:

- Scores: reference 9.5, camera/composition 8.7, card system 9.6, lighting/environment 9.3, readability 9.4, system coherence 8.7, accessibility/fallback/determinism/performance 7.9
- Specification audit only; no camera or challenger image acceptance claimed

### Task 20 — Authoritative Desktop Timer Lifecycle

**Status:** ACCOMPLISHED

- Replaced split solo/multiplayer clock state with one idempotent root owner for start, elapsed read, stop, and reset.
- Preserved elapsed time across authoritative multiplayer `G` replacement and prevented repeated starts or connections from accumulating intervals or assigned socket handlers.
- Disposed the owner on result, Back, mode change, disconnect, opponent departure, clear/unmount, and before existing reload actions.
- Proved canonical desktop `0:00 → 1:01`, synchronized outputs, terminal freeze, and one active interval.
- Kept the actual post-navigation fresh-mount journey explicitly under STA-10.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-20-timer-lifecycle.md`
- 6/6 focused timer contracts
- 35/35 affected unit contracts
- 2/2 mounted canonical-desktop timer browser contracts
- 6/6 combined timer/real-multiplayer browser contracts
- 544/544 full tests
- Isolated production build passed

### Task 21 — Canonical Asset Manifest Contract

**Status:** ACCOMPLISHED — PRODUCTION ART STILL PENDING

- Generated stable-ID manifest entries for all 56 current renderable faces, including real engine-created Antling.
- Added 39 explicit non-card entries across frames, backs, statuses, UI, environment, and audio, totaling 263 production-file contracts.
- Added draft and strict-release validation for identity, files, dimensions/aspect, duplicate hashes, focal points, size budgets, provenance, and rights.
- Added real-engine runtime sampling and fail-closed future-token/derived-face tests.
- Draft validation remains honestly green with 358 missing-art/provenance warnings; strict release remains intentionally red until all real assets and rights records exist.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-21-asset-manifest-contract.md`
- 65/65 focused contracts
- 544/544 full tests after the concurrent timer lane settled
- Five changed source/test/CLI files at 0 diagnostics
- Isolated production build passed

### Task 24 — Canonical Desktop Overlay and Result Behavior

**Status:** ACCOMPLISHED

- Turned a 10/10 RED suite into 13/13 canonical desktop GREEN across modal ownership, target modes, solo Optional/Skitter responses, Rules/detail/reveals, victory/defeat/deck-out, terminal input blocking, and restart lifecycle.
- Corrected numeric winner `0` handling and presented real solo deck-out only after event playback.
- Made modal close re-entrant/double-close safe and made Escape inert for semantic target/response/result surfaces while retaining safe-overlay dismissal.
- Isolated behavior-QA fixture consumption behind `behaviorQa=1`; all 17 classic screenshot hashes remain byte-identical.
- Kept honest partial gaps for opponent grave detail, reveal auto-timeout, coupled Play Again, multiplayer result, and unsupported solo Return to Menu.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-24-desktop-overlay-results.md`
- 13/13 canonical desktop Playwright journeys
- 27/27 affected input/overlay/timer browser checkpoint
- 545/545 full tests
- 2/2 immutable classic visual suite
- Isolated production build and diagnostics passed

### Task 25 — Multiplayer Pending-Response Authority and Coin Ordering

**Status:** ACCOMPLISHED — FULL SWEEPS COMPLETE

- Added authoritative room-owned pending response state; only the target player can answer and client-supplied Optional identity/context is ignored.
- Rejects unsolicited, wrong-owner, malformed, forged, invalid-choice, duplicate, and stale responses atomically; normal actions and End Turn cannot cross the pause.
- Proved p1-owned Optional and p2-owned Skitter with actual two-peer frames, exact-once Yes/No/swap/decline, and no non-owner pending metadata across frames or browser surfaces.
- Hid both gameplay shells and serialized updates behind the awaited multiplayer coin; both canonical clients prove >500 ms coin lifetime and removal-before-board ordering.
- Both previously blocked sweeps ran on 2026-07-27 once the external quota cleared: server-process 17/17 and the complete multiplayer project 8/8 on three consecutive runs.
- The complete sweep surfaced two pre-existing **test** defects the focused runs never exercised; both were fixed in tests only, with no Task 25 assertion weakened.
  - Task 17's shell characterization was stale: Task 25's shell-hide incidentally removed the 601–899 duplicate-shell symptom, so exactly one shell is now visible at every boundary. The characterization was tightened to that stronger contract; the underlying 600 px JS versus 900 px CSS selection mismatch stays frozen and still owes its Phase 12 fix.
  - Task 11's `visible actions and End Turn` test carried two flakes against the genuinely-shuffling shared server: a 20.5%-per-run "no affordable opener" assumption, and an ambiguous duplicate-name option selector causing strict-mode violations. Both are now deterministic.

Evidence:

- `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/task-25-mp-owner-responses.md`
- Raw authorization RED then 1/1 GREEN
- Real owner-only raw WebSocket flows 2/2 GREEN
- Canonical two-client 1672 × 941 browser 1/1 GREEN
- Complete server-process sweep 17/17
- Complete multiplayer project 8/8, three consecutive runs
- Solo/desktop E2E 59/59; immutable classic visual 3/3
- 545/545 units; build and diagnostics clean

## Queued Major Goals

### Phase 2 — Visual Bible and Complete Asset Manifest

**Status:** IN PROGRESS — BIBLE ACCEPTED, CAMERA LOCKED

- **ACCOMPLISHED (2026-07-28): Camera locked — low-FOV perspective, FOV 30°, pitch 24.5°, distance 1950, equal-object ratio 1.0845.** Four blind packet revisions, two fresh critics each, sealed-commitment mappings verified after scores. Round 4 (`camera-bakeoff-4`): both critics passed `singleCameraCriticPass` (92.1 and 92.3) with unanimous perspective preference; the orthographic candidate failed every round on its zero-convergence elevation-diagram read. Golden quadrilaterals for all 12 anchors recorded in `tests/visual/baselines/camera-lock-v1/golden-quadrilaterals.json`; decision record in `thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/camera-lock-decision.md` with post-lock P2/P3 follow-ups.
- Art bible accepted by user manual pass (hash `84b89838…`); reference-locked palette, lighting, geometry, typography, and card proportions are in force.
- **ACCOMPLISHED (2026-07-28): Task 32 — fonts self-hosted, zero remote capture dependencies.** The exact JetBrains Mono v24 woff2 binaries (six script subsets, SIL OFL 1.1 with bundled license) replace the Google Fonts import; `grep` proves no `googleapis`/`gstatic` reference remains in source, dist, or entry points; all 17 classic hashes stayed byte-identical. Evidence: 580/580 units, 59/59 desktop E2E, 8/8 multiplayer, 11/11 visual. Handoff: `task-32-self-hosted-fonts.md`.
- **ACCOMPLISHED (2026-07-28): Task 33 — card chassis foundation and §13.2 showcase harness.** The §7 chassis renders as real DOM with every §7.4 rectangle within 1 px of authored coordinates, the §7.2 seven-layer hierarchy at 11.56% cumulative inset, §5 palette, and the four-family showcase at manifest geometry. 16 unit geometry contracts (including the bible's own pairwise non-overlap check) and 7 browser measurement gates are green; classic is untouched. Candidate render: `task-33-showcase-candidate-r1.png`. Handoff: `task-33-card-chassis-foundation.md`.
- **BLOCKED (user ratification): typography pairing.** Candidate is Alegreya (display/rules; OFL, self-hosted, passes all three §7.4 nameplate fixtures at locked 22 px) + JetBrains Mono (numerals/labels; tabular, unambiguous glyphs). Question: ratify this pairing, or name a preferred direction (more ornate fantasy serif / cleaner humanist / other), and work re-runs the objective §8 gates on the replacement. Work continues on the candidate meanwhile.
- **ACCOMPLISHED (2026-07-28): Task 34 — golden-sample aperture art candidates authored.** Original cel-style SVG scenes for duskfang (howling ridge wolf), manaSurge (erupting spring), phantomWall (spectral rampart), and the twin-fang back sigil, all in §5 palette with no traced geometry; craft corrections landed (footer contrast, seal fang stamp, opaque type-label grounds per §7.4). All 7 chassis gates stay green with real art in the apertures. Candidate: `task-34-showcase-candidate-r4-full.png`. Handoff: `task-34-golden-sample-art.md`.
- **ACCOMPLISHED (2026-07-28): Task 35 — deterministic card-showcase packet runner.** `scripts/make_card_packet.py` computes the §13.2 manifest hash under the §13.7.2 rule, captures the showcase byte-identically (proven across independent invocations, `captureSha256 20af8560…`), cuts all ten §13.3 card crops (1×/exact 2× Lanczos), and writes an honest §13.7.1-style index in which the §13.8 provenance index, card-row metric report, and sealed A/B commitment are `unsupported` failed rows — the packet is deliberately not passable yet. Scope decision recorded: pre-board review runs as plan-level packetKind `card-showcase` (the bible's `integrated-art` kind requires the Phase 7 board); the full §13.5 integrated gate re-runs at Phase 14. Handoff: `task-35-card-packet-runner.md`.
- **ACCOMPLISHED (2026-07-28): Task 36 — §13.8 provenance chain signed and verified.** Signer registry revision 1 committed (two distinct Ed25519 identities: creator agent + independent fresh-context reviewer; private keys outside the repo); the independent motif review actually ran with close-up comparisons of the highest-risk R1/R2 regions — 40 rows, 34 distinct, 6 N/A, zero escalations — and all four asset records are signed by both roles and pass the standalone verifier and the live packet-build verification. Packet now 12 rows present, 2 honestly unsupported (`metric-report`, `blind-mapping`). Handoff: `task-36-provenance-signing.md`.
- **ACCOMPLISHED (2026-07-28): Task 37 — §12 card-row metric report attached, allPass true.** Building the measurements exposed two real §12 violations, both fixed at root: non-concentric frame radii (now outer-minus-inset, measured live from computed styles) and entirely missing showcase contact shadows (now envelope-contained radial shadows with per-object §6.1 ID-mask measurement — all four centroids in the +20–100/+50–90 window on the 55–75° key band after isolating a neighbor-shadow bleed in the back's envelope). Nine machine-evaluated rows including full CIEDE2000 palette/family-separation checks, none rounded up. Packet: 13 present / 1 unsupported (blind mapping). Suites: 596/596 units, 18/18 visual, 59/59 E2E, 17 classic hashes byte-identical. Handoff: `task-37-card-metric-report.md`.
- **ACCOMPLISHED (2026-07-28): Task 38 — first blind critic run, REJECTED AS DESIGNED (revision 1).** Sealed A/B protocol ran cleanly end-to-end (commitment verified, mapping unsealed only after both scores; zero P0/P1 — the packet was fully reviewable, no protocol-layer stall). Challenger: T 72.1/77.0, wow 6.4/6.9, min category L 5.8/6.3, 2/10 crop wins per critic — decisive rejection with a consistent correction list: void staging kills grounding/shadows (the anchor failure), layer misregistration seams, provisional card back, flat material depth, wolf anatomy, footer-near-rail contrast, plus two metric-coverage extensions (in-context shadow visibility, on-rail contrast). Notably the reference side also failed both gates (83.3/80.3, wow 8.2/8.3); shared critic read: our typographic system + reference's materials is the target. Handoff: `task-38-critic-run-r1.md`; verdict artifacts in `tests/visual/card-packet/critic-*-r1.json`.
- **ACCOMPLISHED (2026-07-28): Task 39 — golden-sample revision 2 built against the full r1 correction list.** Lit meadow staging ground (shadows now visibly seat the cards), authored art keylines and nameplate surround (seams gone), dense gold-line back, 2×-surviving grain and rail emboss, refined wolf, and a root-cause frame-geometry fix for the footer-on-rail defect (bottom frame collapses to lip+keylines per §7.2's sides-only inset rule so the §7.4 footer sits on parchment; measured 2.27–2.9:1 → ≥4.5:1). Both critic-demanded metric extensions added and green: in-context shadow visibility and per-family footer-ground contrast. Metric report 11/11 PASS; packet rebuilt (`bb455972…`); 596/596 units, 18/18 visual, 59/59 E2E. Handoff: `task-39-golden-sample-r2.md`.
- **ACCOMPLISHED (2026-07-29): Task 40 — second blind critic run, REJECTED (r2).** Fresh critics 3/4 over a resealed mapping: challenger T 77.6/76.0 (r1: 72.1/77.0), wow 6.8/6.8, min category L, 1-2/10 crop wins; zero P0/P1 both rounds — the protocol layer stays clean. The system half of the rubric is now strong (R/S/A ≈ 9); materials/grounding remain the gap. The reference itself scored 83–85 — below its own gate — mirroring the art-bible plateau that ended in a user manual pass. New P2s recorded for any future revision (wallpaper-flat ground, lens-artifact moon, top layer-edge protrusion, weak set illustration). Handoff: `task-40-critic-run-r2.md`.
- **DIRECTION CHOSEN BY USER (2026-07-29, resolves the golden-sample BLOCKED entry): user-generated frame templates.** The user will generate three card frame images (creature / cast verse / set verse, ideally plus the back) without art or values; the system composites live art, names, rules, and numerals into the §7.4 rectangles on top. This is the four-critic synthesis and fills the manifest's existing `frame/*` slots. Generation spec recorded in `task-41-phase6-template-mode.md` (1536×2304 portrait, empty art window/nameplate/rules/medallion sockets, family palette hexes, painterly carved-and-gilded material, original motifs). **Golden samples: EVIDENCE PENDING (user frame images).** On delivery: wire frames under the live text system, re-run metrics, re-enter the blind gate. Production art per the 56-face manifest runs in Phase 6 TEMPLATE MODE (user decision 2026-07-28).

### Phase 3 — Presentation Boundary and Compositing Proof

**Status:** IN PROGRESS — BOUNDARY AND SPIKE ACCOMPLISHED (2026-07-28)

- **ACCOMPLISHED:** `PresentationCoordinator` (idempotent updates, deep snapshots with no mutable engine references, scene-failure containment that downgrades to static without blocking gameplay, complete listener/scene disposal, re-entrant dispose) and the semantic `TargetRegistry` (`me.active`, `opp.bench.1`, action/UI targets; shell-aware; explicit registration wins; unknown names fail closed) — 13/13 focused unit contracts.
- **ACCOMPLISHED:** DOM/Three compositing spike at the locked camera: DOM card faces are homography-mapped (CSS `matrix3d`) onto the camera-lock-v1 golden quadrilaterals over the live Three scene; measured browser-applied drift ≤2 CSS px at canonical 1672 × 941 and ≤4 CSS px across the 2560×1440/1440×900/1280×720/1024×768 resize matrix; forward-projection error ≤0.1 px; three consecutive mounts clean — 6/6 browser gates (`tests/visual/composite-spike.visual.spec.js`, `composite.html`). No post-processing in the spike, r185 + `NeutralToneMapping`, per plan.
- Remaining in phase: KTX2/Basis wiring (explicitly post-spike), portrait anchor map (deferred with the mobile port), wiring the coordinator into the live game shell during Phase 4 keyed-rendering migration.

### Phase 4 — Keyed Cards and Motion Wrappers

**Status:** ACCOMPLISHED AGAINST ACCEPTANCE CRITERIA (2026-07-28) — single-tree merge deferred to the mobile port, flagged for user review

- **ACCOMPLISHED: uid-keyed reconciler** (`src/presentation/dom/keyed-board-view.js`): create/patch/move/remove with stable DOM identity across zone moves, duplicate/missing-uid fail-closed, idempotent reconcile, snapshotRects/flipDeltas FLIP seams — 7/7 focused contracts.
- **ACCOMPLISHED: Task 28 — hand zones (`m-hand`, `d-hand`) render keyed** through the new `createHtmlKeyedView` adapter with byte-identical `renderHandCard` markup. Evidence: 573/573 units, 59/59 desktop E2E, 8/8 multiplayer, 11/11 visual including all 17 classic screenshot records (pngHash) equal to the committed baseline. Handoff: `task-28-keyed-hand-zone.md`.
- Fail-closed keying exposed and fixed a latent client defect: `src/state.js` `uid()` was pure `Math.random()` and collided under the E2E's stubbed randomness; it now carries a monotonic serial. A pre-existing shuffle-dependent deck-out E2E flake was root-caused (multi-event attacker playback exceeding the fake-clock budget) and made deterministic in the test only, with no assertion weakened.
- **ACCOMPLISHED: Task 29 — all four active and all four bench containers render keyed** (single-slot and two-slot view-models with stable synthetic empty uids, byte-identical markup), and every remaining `Math.random()`-only uid generator (`shared/engine.js`, `shared/effects.js` ×2, `src/game.js` ×2, `src/abilities.js`) now carries the monotonic serial suffix. Evidence: 573/573 units, 59/59 desktop E2E, 8/8 multiplayer, 11/11 visual with all 17 classic hashes byte-identical, 17/17 server-process, clean diagnostics. Handoff: `task-29-keyed-active-bench-zones.md`.
- **ACCOMPLISHED: Task 30 — set slots patched in place, log zones keyed, stats/actions dispositioned.** Set-verse slots keep one id-addressed DOM identity via the exported `syncElementToHtml` (no more outerHTML destruction); both log zones reconcile keyed per-entry nodes by absolute index with byte-identical markup; textContent-only stats zones and the static actions row are audited exempt (no per-card DOM exists to key; grave card lists belong to the Phase 9 overlay rebuild). Evidence: 574/574 units, 59/59 desktop E2E twice consecutively, 8/8 multiplayer, 11/11 visual with all 17 classic hashes byte-identical, 17/17 server-process, clean diagnostics. Handoff: `task-30-keyed-set-log-zones.md`.
- **ACCOMPLISHED: Task 31 — animation targeting no longer searches hidden duplicate trees.** Every dual-shell selector in `src/anim.js`/`src/event-playback.js` now resolves through the shell-aware semantic registry to the active shell's element only; mana-pip animation is gated to the shell that renders pips; the Task 16-era dual-shell test contracts were upgraded to the stronger active-shell assertions and 6 new resolution contracts drive shell selection and bench index math directly. Evidence: 580/580 units, 59/59 desktop E2E, 8/8 multiplayer, 11/11 visual with all 17 classic hashes byte-identical, 17/17 server-process. Handoff: `task-31-active-shell-anim-targeting.md`.
- **DECISION (needs user ratification): the literal one-DOM-tree merge is deferred to the mobile port.** All three Phase 4 acceptance criteria are met; physically merging the trees now would rebuild the mobile layout (the explicitly deferred port), risk the 17 byte-identical classic hashes, and churn the retained `m-*` regression evidence for no desktop-milestone value. If the merge should happen now instead, it becomes the next Phase 4 task.
- Cross-zone DOM adoption for FLIP travel is deferred to the Phase 10 motion director by design.

### Phase 6 — Card Art, TEMPLATE MODE

**Status:** ACCOMPLISHED IN TEMPLATE MODE (2026-07-29) — per-card art gate EVIDENCE PENDING (user art)

- Six style-consistent faction template scenes (shadow, fang, venom, swarm, shell, token) authored in the §5 palette and rendered to all four manifest variants at exact spec; all 224 canonical per-face paths populated (~8 MB); every renderable face resolves through `template-face-map.js` (deckless faces and antling → token).
- Manifest marks every card face `template-placeholder` with template focal points and an empty provenance block — no provenance claim. Draft validation green (0 errors; 334 honest warnings); **strict release honestly red (334 errors)**. The only validator change scopes DUPLICATE_CONTENT_HASH to a draft-phase warning for explicitly declared placeholder-tier assets — release severity and undeclared assets unchanged, exactly per the user's template-mode contract.
- Per-card blind reviews and faction contact-sheet gates deferred until real art exists: **EVIDENCE PENDING (user art)**. Evidence: 601/601 units (5 new exit contracts), unchanged production build. Handoff: `task-41-phase6-template-mode.md`.

### Phase 7 — Three.js Meadow

**Status:** IN PROGRESS — TERRAIN/DIVIDER/DIAMOND CHUNK GREEN (2026-07-29)

- **ACCOMPLISHED: Task 42 — meadow chunk 1 under the locked camera with every applicable §12 field row measured live and green:** divider center 413.47 (414±3), slope 0.006, span 76.3% (68–80), core 10 px (R2 measures 10), diamond 38×40 at 835.5 (33–45 × 38–50 at 836±3), palette region ΔE00 0/0/3.63 (≤5 final), perimeter/center ratio 0.225 (0.14–0.25), byte-identical determinism. Screen-anchored seeded painting (texture-space painting provably missed screen targets), gradient transparent-black fix, and a documented NoToneMapping decision (flat-quad bisect proved Neutral distorts §5 roles ~30% on blue; baked cel pipeline authors final colors). 4 new visual gates; 22/22 visual project; 601/601 units. Handoff: `task-42-meadow-field-chunk1.md`.
- **ACCOMPLISHED (2026-07-29): Task 44 — perimeter props and all three §12 environment rows green.** Authored low-poly trees/shrubs/rocks/fence/river/flowers per the §4.3 envelopes with seeded scatter and a props-only ID mask: frame extents 10.5–11.2% per side (10–15), quiet zone 0.03% prop share, zero intrusion into any golden card envelope; deep-left palette improved to ΔE 1.41 via calibrated shrubs, divider rows unchanged. Two authored-mask fixes from the calibration loop (flowers out of the divider detection window; measured-region shrub colors). 5 meadow gates, 23/23 visual, 601/601 units. Handoff: task-44-meadow-props.md.
- **ACCOMPLISHED (2026-07-29): Task 45 — zone decals/slot marks green.** All twelve camera-lock anchor footprints carry engraved outlines + rune diamonds painted at the §4.1 band; a real color-math defect was fixed at root (the band is a linear-luminance ratio; sRGB×1.25 measured 1.37–1.62, gamma-adjusted painting lands 1.157–1.247 across all anchors). New per-anchor metric + spec gate; 6 meadow gates, 24/24 visual, 601/601 units. Handoff: task-45-meadow-slots.md.
- **ACCOMPLISHED (2026-07-29): Task 46 — seeded ambient motion + static fallback.** Canopy sway, dust motes, fireflies, and river shimmer as pure functions of time (renderAt(t) byte-reproducible; t=0 settled frame keeps every prior gate); reduced-motion holds the settled frame (gated via media emulation); the real 3840×2160 settled render now fills the environment/meadow-backdrop manifest slot (205KB WebP). 7 meadow gates, 25/25 visual, 601/601 units. Handoff: task-46-meadow-motion-fallback.md.
- **ACCOMPLISHED (2026-07-29): Task 47 — canopy silhouette polish.** Clustered flattened icosahedron lobes replace cones (organic silhouettes under the locked pitch); re-densified the three rows the change nudged; all 7 meadow gates green (extents 10.3–11.1%, slots 1.157–1.247, palette 0/0/3.43). 25/25 visual, 601/601 units. Handoff: task-47-canopy-polish.md.
- **ACCOMPLISHED (2026-07-29): Task 48 — populated board harness.** All twelve golden anchors carded via the homography contract (registration error 0.0000 px), fanned hand in the §12 envelope, per-card contact shadows, faction template art wired into every aperture from the canonical manifest paths (no broken/missing art anywhere — the visual half of the Phase 6 exit). One real placement bug fixed (transform-origin pins the untransformed bottom edge). 2 new gates; 27/27 visual; 601/601 units. Handoff: task-48-populated-board.md.
- **ACCOMPLISHED (2026-07-29): Task 65 — Phase 5 audit CLOSED with a real bug found: status charms read card.poison/card.trapped, fields that never exist (engine truth: creature.status + fortified flag) — poison/trapped had never rendered in the AAA shell.** Landed: curHp on health medallions with damaged ink state (geometry untouched), effective ATK via shared getEffectiveAtk with boosted/reduced inks, zero-ATK verified (echomask), player-level unbreakable ward charm on vitals, worst-case name/text measured overflow-free in live DOM (≤1px). No token type exists in the engine — nothing to render. Unit 6/6, aaa-cards E2E 2/2, full E2E 98/98, visual 27/27, units 612/612. Handoff: task-65-phase5-audit.md. NEXT: priority 7 — behavior-matrix reconciliation, 600px shell fix, MP parity, perf budgets.
- **ACCOMPLISHED (2026-07-29): Task 64 — Phase 10c + PHASE 10 ACCEPTANCE REVIEW.** Pooled particle system (cap 48, pointer-transparent, self-cleaning, reduced-motion suppressed) bursting on summon/damage/heal/KO via null-safe shell seams; audio director with first-gesture unlock, persisted mute/volume (Sound chip in HUD), and fail-silent missing-file safety (all audio placeholder-pending user assets) — unit 5/5, aaa-garnish E2E 3/3. Phase 10 checklist: FLIP/springs done, accents done, particles done, audio director done, reduced-motion done, Anim contract kept; vibration deferred to mobile port; deterministic recordings + offline audio analysis EVIDENCE PENDING user assets (not faked); explicit MP interruption sweep re-runs in Phase 12. Full E2E 96/96; visual 27/27; units 606/606. Handoff: task-64-aaa-garnish-10c.md. NEXT: priority 8 — Phase 1 tail / Phases 11-13.
- **ACCOMPLISHED (2026-07-29): Task 63 — Phase 10b: event-driven accents on the AAA chassis via the Anim semantic seam.** The Anim facade's helpers grew an AAA branch resolving to chassis faces inside #aaa-stage (transform-safe; benchContainerEl → null no-op) — the ENTIRE classic event vocabulary (damage/heal/ko/bench/lp accents, float text, screen flash) now plays into the AAA shell with zero event-playback changes. Reduced-motion keeps color flashes, suppresses displacement, KO becomes a fade. aaa-effects E2E 4/4 (incl. real-attack defender accent mid-playback and the 5/5 missing-target Promise contract); full E2E 93/93; visual 27/27; units 601/601. Handoff: task-63-aaa-effects-10b.md. NEXT: Phase 10c — pooled particles + audio director (fail-silent pending user audio).
- **ACCOMPLISHED (2026-07-29): Task 62 — Phase 10a: uid-keyed FLIP motion on the AAA board.** Persistent .aaa-flip outers per card uid; First/Last/Play with fixed-curve 380ms deterministic transitions settling to empty transforms (byte-determinism gates untouched); hand→board summon glide, retreat swap glide, deck→hand draw rise, board→grave exit fade; DOM identity asserted across zone changes; prefers-reduced-motion renders instantly (E2E-asserted). Shadows still snap to destinations (10b polish candidate). aaa-motion 3/3; full E2E 89/89; visual 27/27; units 601/601. Handoff: task-62-aaa-flip-10a.md. NEXT: Phase 10b — event-driven damage/heal/KO accents via semantic targets with the Anim Promise contract.
- **ACCOMPLISHED (2026-07-29): Task 61 — Phase 9c: 3D coin (1780ms timing byte-identical, asserted at 1779/1780), parchment reveals with key dismissal, material result screen (victory fixture), grave-chip graveyard browser with hold-to-zoom preserved, AAA rules link + parchment rules book. PHASE 9 ACCEPTANCE MET — every overlay belongs to the board's visual world; dismissal/backdrop/key/disabled/ownership contracts E2E-asserted on unchanged classic flows. Residue to planned phases: MP lobby flows + Skitter aaa sweep → Phase 12; reveal/coin motion polish → Phase 10. aaa-overlays 5/5; full E2E 86/86; visual 27/27; units 601/601. Handoff: task-61-aaa-overlays-9c.md. NEXT: Phase 10 — motion/effects/audio.
- **ACCOMPLISHED (2026-07-29): Task 60 — Phase 9b: diegetic targeting, ownership cues, selected states, timer chip.** Creature selectors now highlight every legal target on the AAA board (gold halo) and make them DIRECTLY clickable through the same selector action (exactly-once by construction); in targeting mode the scrim passes clicks and the panel docks right — the E2E caught that the full-screen scrim made diegetic picking physically impossible. selector-yours/enemy cues asserted in-material; state.selectedCard renders as hand halo; #aaa-timer chip mirrors the single classic clock. aaa-selectors E2E 3/3 (incl. optional-trigger fixture: Escape inert, resolves once); full E2E 81/81; visual 27/27; units 601/601. Handoff: task-60-aaa-selectors-9b.md. NEXT: Phase 9c — 3D coin (timing preserved), reveals, results, graveyard browser, rules.
- **ACCOMPLISHED (2026-07-29): Task 59 — Phase 9a: setup, deck select, generic/response modals, and card detail wear the AAA material.** CSS-only, fully flag-gated (classic negative-control asserted): parchment + §7.6 paper grain on modal boxes, ink/gold accents, leather buttons, meadow-green setup backdrop with gold title; selector ownership variants restyled in-material for 9b. All behavior contracts asserted unchanged (full solo start through restyled modals, .off options, Close + backdrop dismissal). aaa-material E2E 3/3; full E2E 78/78; visual 27/27; units 601/601. Handoff: task-59-aaa-material-9a.md + screenshots. NEXT: Phase 9b — selectors + selected/targeting states + timer surface.
- **ACCOMPLISHED (2026-07-29): Task 58 — Phase 8 chunk 3: detail interactions, accessibility gates, live-shell §12 identity. PHASE 8 ACCEPTANCE MET.** Board-card click opens classic showCardDetail; hand context-click inspects without playing; face-down rival zones expose no inspectable affordance. A11y E2E at the canonical viewport: ≥40px targets, Tab-order traversal with ≥2px focus-visible rings (lesson: programmatic focus() doesn't trigger :focus-visible), Enter activation, WCAG AA contrast on all rails, You/Rival labels + geometric row separation. §12 identity: shell canvas byte-identical to the calibrated meadow harness — root cause of initial mismatch was 4-decimal quad transcription shifting slot AA; regenerated at full float precision. aaa-polish 5/5; full E2E 75/75; visual 27/27; units 601/601. Selected/targeting visuals + timer surface roll into Phase 9 by design. Handoff: task-58-aaa-polish-chunk3.md. NEXT: Phase 9.
- **ACCOMPLISHED (2026-07-29): Task 57 — Phase 8 chunk 2: all six actions verified end-to-end in the AAA shell.** New aaa-actions E2E 5/5: set (opaque back on me.set quad, identity-free), cast (incl. generic target-selection settlement, grave chip mirror), retreat (bench modal, quad swap), attack (damage on hearts/creature, hearts-rail mirror), hand fan at 7+ cards inside the frame. Lesson: passive turn-passing loses to the AI mid-test — adaptive loops summon defensively while advancing. Full E2E 70/70, visual 27/27, units 601/601, build clean. Handoff: task-57-aaa-actions-chunk2.md. NEXT: Phase 8 chunk 3 — card detail interactions, contrast/touch/keyboard checks, live-shell §12 measurement.
- **ACCOMPLISHED (2026-07-29): Task 56 — Phase 8 chunk 1: the AAA shell runs the REAL solo game.** aaa flag mounts the meadow + golden-quad chassis cards + quiet edge rails (hearts, mana, counts, turn token, status charms, log rail, six-action rail) driven by live projected state; actions delegate to the classic dispatch functions (engine sole authority, modals unchanged); affordability mirrors updateButtons(); rival Set stays opaque presence. Harness card mount deduped into shared board-card-mount.js; camera-lock quads transcribed to a runtime module. Evidence: new 3/3 aaa-shell E2E (mount surfaces; summon through rail to the active quad; end turn round-trips the AI), full E2E 65/65, visual 27/27 (classic hashes intact), units 601/601, build clean. Handoff: task-56-aaa-shell-chunk1.md. NEXT: Phase 8 chunk 2 — full-flow E2E for cast/set/retreat/attack in the AAA shell + interaction polish.
- **BLOCKED — EVIDENCE PENDING USER ART (2026-07-29): Task 55 — fourth blind field comparison LOST 0/10 twice; Phase 7 exit gate moves to EVIDENCE PENDING user painterly environment assets.** Series r1 0+0, r2 0+0, r3 1+1 (field-hand), r4 0+0 across eight independent fresh critics, protocol clean every round. The r4 converged worklist is asset-class for the first time: "paint an actual grass surface", "distinct illustrations per card", painterly prop texture — all user-owned per the task-43 size-sheet direction (user regenerates ALL assets, incl. the 3840x2160 environment backdrop). r4's shadows/banks/stock/texture exist in the capture; critics perceive vector-flat material, not missing features. Gate/thresholds/protocol UNCHANGED — re-runs with fresh critics when user assets land, same as the Phase 2 and Phase 6 art gates. Banked unanimously: the card design/typography layer is production-ready and beat the reference every round. §12 floor stays green and suite-enforced. Handoff: task-55-field-blind-r4.md. NEXT: Phase 8 (highest-priority unblocked item).
- **ACCOMPLISHED (2026-07-29): Task 54 — field revision 4 implemented, verified at 1x, all §12 rows green, r4 blind set resealed (commitment 7a967fd1).** Full task-53 worklist: tree shadows stepped to +110s offsets past the canopy silhouettes, shrub/rock/fence long shadows, denser 1x-readable cover (4,200 strokes, clover, 190 flowers, softer wider mow-bands), organic painted streams with banks/foam replacing plane strips, scale-aware card-stock extrusion (screen-px authored / render scale). Detector forensics instead of guessing: the diamond row broke because upward-pointing strokes rooted below the window poked bright pixels into the gap-inclusive column span — exclusion widened to stroke reach; two wrong guesses (halo, retone) measured and reverted. Deep-left ΔE 1.05, ratio 0.187, diamond 37x39, slots 1.172-1.340. 27/27 x3, 601/601, byte-identical capture 1d3be22d. Handoff: task-54-field-r4.md. NEXT: two new fresh critics score the r4 set blind.
- **ACCOMPLISHED (2026-07-29): Task 53 — third blind field comparison, CHALLENGER LOSES r3 but takes its FIRST CROP (field-hand, BOTH critics; card text layer called "genuinely excellent").** Root cause of the repeated "no shadows" verdict found: under the locked near-top-down camera the canopies occlude their own painted shadows (offset ~29px < canopy radius ~85px) — authored ≠ visible, same class as r2's invisible strokes. Converged r4 worklist: (1) long shadows offset past the canopy silhouette, (2) denser ground cover + softer mow-bands, (3) stream painted organically into the terrain replacing plane strips, (4) scale-aware card extrusion (current slabs shrink to ~1.5px after homography). BLOCKED note: "teal sleeves clash" is an art-bible §7 palette amendment (accepted hash) — recorded, not acted on. Camera-lock note: opp.grave quad tightness is locked geometry. Handoff: task-53-field-blind-r3.md. NEXT: implement field r4.
- **ACCOMPLISHED (2026-07-29): Task 52 — field revision 3 implemented and verified at 1x, all §12 rows green, r3 blind set resealed.** Full task-51 worklist: painted cast shadows for every prop/fence post under the one sun (anchors exported, separate rng stream), three-tone mid-green species albedo with key 1.0/ambient 0.5, 3,200 visible grass strokes + 120 flower speckles + mow-bands + golden-hour grade, directional card shadows + even stepped card-stock extrusion + hand-card stock/shadow, banked stream with dashed sheen, irregular divider bleed. Caught BY EYE (not by gates): the hand-card wrapper collapsed to 0x0 and broke transform-origin — §12 stayed green while the layout was broken; visual pass before sealing is now part of the protocol. Recalibrated deep-left (10.38→2.10), ratio (0.313→0.201), extents. 27/27 x3, 601/601. Sealed r3 mapping 7ebf0dba… before critics. Handoff: task-52-field-r3.md. NEXT: two new fresh critics score the r3 set blind.
- **ACCOMPLISHED (2026-07-29): Task 51 — second blind field comparison, CHALLENGER LOSES r2 (0/10, 0 ties, both critics prefer reference overall).** Fresh seal, two new critics, protocol clean. Verified against the capture after unseal: r2's changes are real but an order of magnitude too subtle at 1x — near-black canopy albedo, sub-visible grass blades, one-sided slab reading as misregistration, halo (not directional) card shadows, zero cast shadows on the ground. Credits banked again: our card faces are the readable ones. Deduplicated r3 worklist recorded in the handoff, attack order: (1) real cast shadows under one sun for props/fence/cards, (2) prop albedo out of near-black + species-readable identity, (3) terrain that reads at 1x (tuft/flower/mow-band contrast), (4) true even card-stock extrusion + fix hand-card teal misregistration, (5) stream banks/highlights, (6) golden-hour grade + divider-terrain interaction. Handoff: task-51-field-blind-r2.md. NEXT: implement field r3.
- **ACCOMPLISHED (2026-07-29): Task 50 — field revision 2 implemented, all §12 rows green, determinism hardened, r2 blind set resealed.** Full r1 critic worklist landed: Lambert flat-shaded props under one warm key light, card edge slabs + 3-layer deck/grave stacks + warm spill contact shadows, 2,600 seeded grass blades, divider grass-bleed (diamond-windowed), slot interior fills. Five broken measured rows recalibrated at the authoring layer (deep-left ΔE 13.84→4.91, ratio 0.045→0.153, slots 1.127→1.154, diamond 49→38, top extent 0.0985→0.1017). Hand-row raster nondeterminism root-caused (compositor raster-scale under GPU load) and fixed with will-change layer promotion; 6/6 full parallel suite runs green, 601/601 units. New sealed mapping committed 7703b478… BEFORE critics. Handoff: task-50-field-r2.md. NEXT: two new fresh critics score the r2 set blind.
- **ACCOMPLISHED (2026-07-29): Task 49 — first blind field comparison, CHALLENGER LOSES r1 (0/10 and 0/10+1 tie; both critics prefer the reference overall).** Protocol clean end-to-end. Converged read: our measured-green geometry is not yet scenery (abstract polygon clumps vs the reference's resolved shaded props), and reference cards sit ON the world (edge thickness, stack physicality, warm spill shadows) while ours float. Credits: our card design system judged the most readable of the two; divider tied one crop. Field r2 worklist recorded (resolved shaded props, card physicality/stacks, ground micro-texture, divider grass-bleed, empty-slot affordance). Handoff: task-49-field-blind-r1.md.
- Remaining: implement the field r2 worklist, then re-run the blind comparison with two new fresh critics.

### Task 43 — Placeholder Assets at Exact Sizes (User Direction 2026-07-29)

**Status:** ACCOMPLISHED — all 24 non-card image slots filled with basic-shape placeholders at exact manifest dimensions

- User direction: basic shapes now with correct sizing; user regenerates all art later. The full regeneration size sheet is recorded in `task-43-placeholder-assets.md` (headline: one 2048×1536 master per card — pipeline derives the rest; frames/backs 1536×2304; status 512; UI 512/1024; environment 3840×2160 down to 1024). Draft validation now 0 errors with 310 honest warnings (200 declared template duplicates, 15 missing audio — no encoder available, Phase 10 owns audio — and 95 provenance); strict release stays honestly red. 601/601 units.

### Phases 5, 8–13 — Full Production

**Status:** QUEUED
- Complete card system and all original card art
- Three.js meadow, props, lighting, atmosphere, shadows, and fallback
- HUD, setup, lobby, overlays, reveals, and results
- Motion, effects, audio, and optional haptics
- Desktop accessibility, multiplayer, fallback, and performance hardening
- Deferred mobile/tablet responsive port after desktop critic acceptance

### Phase 14 — Independent AAA Critic Loops

**Status:** QUEUED

- Two fresh critics per desktop artifact
- Anonymized side-by-side comparisons
- Weighted score at least 93/100 from both critics
- No category below 9/10
- Challenger preference in every primary reference comparison
- Two consecutive clean passes with no new P1/P2 defect

### Phase 15 — Release Audit

**Status:** QUEUED

- Requirement-by-requirement completion proof
- Full unit, browser, multiplayer, accessibility, visual, asset, build, and performance gates
- Physical mobile-device performance evidence during the deferred port
- Final blind comparison and user visual sign-off

## Current Blockers

No implementation blocker for the desktop milestone.

The external privileged-execution quota that previously blocked Task 25's complete sweeps has cleared; both sweeps ran green on 2026-07-27 and the blocker is closed.

The physical `mobile-reference` device is intentionally deferred until after desktop acceptance and does not block current work.

## Update Rule

Update this ledger immediately when:

- an implementation task starts or finishes;
- a verification gate passes or fails;
- a critic accepts or rejects an artifact;
- scope changes;
- a blocker appears or clears.

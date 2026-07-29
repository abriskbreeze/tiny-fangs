---
date: 2026-07-27
type: plan
status: in-progress
plan_file: thoughts/shared/plans/PLAN-tiny-fangs-aaa-presentation.md
---

# Plan Handoff: Tiny Fangs AAA Presentation Overhaul

## Summary

The in-progress implementation plan rebuilds Tiny Fangs as a reference-faithful low-poly meadow card game while preserving the shared rules authority, solo/multiplayer behavior, inputs, event ordering, endpoint overrides, room lifecycle, diagnostics, and fallback playability.

Gameplay protocol remains unchanged except for one required and tested privacy projection correction: an opponent's face-down Set Verse is projected as opaque presence only, and its initial placement event carries no card identity. A separate minimal content-identity correction makes every real runtime token/derived face select the intended artwork without display-name matching.

## Plan

`thoughts/shared/plans/PLAN-tiny-fangs-aaa-presentation.md`

## Validated Architecture

- Exact-pinned `three@0.185.1` for the decorative environment.
- Stable keyed DOM/CSS cards, HUD, controls, overlays, input, and accessibility.
- `PresentationCoordinator` between authoritative state/events and visual layers.
- Semantic animation target registry with the Promise-based `Anim` API retained.
- Static meadow plus complete DOM game as the non-WebGL fallback.
- No React/R3F rewrite and no rigid-body engine initially.
- Phase 2 graybox bake-off between calibrated orthographic and low-FOV perspective projection; lock only the blinded reference winner.
- Three r185 `NeutralToneMapping` for lit props, authored unlit backdrop with `toneMapped = false`, and no post-processing in the first compositing spike.
- KTX2/Basis setup only after the first spike proves the 2 px/4 px alignment gate.
- Deterministic visual readiness through the exact `window.__TINY_FANGS_VISUAL_READY__` contract.

## Required Prerequisite Corrections

### Opponent Set privacy

- `server/GameEngine.js` currently spreads the complete opponent Set object while marking it face-down, and `shared/engine.js#setVerse()` separately emits the hidden card name in the initial event broadcast to both players.
- Phase 1 is authorized to replace that spread with the exact opaque sentinel `{ faceDown: true }` when a Set exists.
- The same isolated correction removes the unused `events[].verse` field from initial placement, yielding exact `{ type: "setVerse", side }`; later rule-authorized trigger/cast reveals retain identity.
- Direct state/event tests and captured two-browser WebSocket-frame tests must prove that no `id`, `uid`, name, rules, art, effects, or other identity-bearing field crosses the wire before reveal.
- DOM, accessibility, asset URL, preload, readiness-metadata, and debug-output checks must also remain clean.
- This is an isolated privacy projection correction, not a broader protocol redesign.

### Stable renderable-face identity

- A presentation-independent canonical face registry supplies stable catalog/token/derived identity without browser asset URLs.
- Catalog cards resolve from immutable catalog IDs; tokens/derived faces carry an explicit `presentationFaceId` stamped from the registry.
- `resolvePresentationFaceId(card)` must never match display names, subtitles, rules, or art strings.
- All Antling creation paths must stamp identity from the canonical registry, and a real authoritative-engine Antling must resolve to exactly `antling` without changing its pre-existing gameplay fields, effects, or state transitions.
- Manifest validation enumerates the catalog/registry, exercises real engine-created objects, and fails closed for any future runtime face missing identity or art.

## Playwright and CI Topology

- Exact-pin `@playwright/test@1.61.1` in the root lockfile.
- Add `playwright.config.mjs` with deterministic configurable ports: Vite `4173`, WebSocket `3101` by default.
- Playwright owns Vite and `npm --prefix server start` as separate `webServer` processes, uses Vite `--strictPort`, waits on a minimal same-listener server `/healthz` endpoint, and tears down both.
- The client continues using `?ws=ws://127.0.0.1:<port>`; tests also preserve `localStorage.tinyFangsWs` fallback and query-parameter precedence.
- Root scripts: `test:e2e`, `test:e2e:multiplayer`, `test:visual`, and `test:presentation`.
- Multiplayer uses two isolated browser contexts, fresh rooms, serial specs, and one worker.
- CI runs root `npm ci`, `npm --prefix server ci`, and `npx playwright install --with-deps chromium`.
- CI uploads reports, traces, screenshots, videos, visual diffs, and critic artifacts with `if: always()` while keeping blind mappings separate from critics.

## Preservation Contracts Added

- `?ws=` → `localStorage.tinyFangsWs` → production endpoint precedence.
- Uppercase/trim room normalization; create/join/wait/ready/back; disconnect and empty-room cleanup; existing error paths.
- Preview `pointercancel`, listener/capture cleanup, and no delayed reveal.
- Single timer ownership and disposal on back, restart, mode change, disconnect, and unmount.
- `localStorage.tinyFangsDebug` diagnostics without privacy leakage.
- Direct and network-layer hidden-information protection.

## Baseline Evidence

- Branch `feat/cel-shaded-field`, head `f16804d`.
- User changes already exist in `src/render.js`, `src/styles.css`, `docs/`, and `thoughts/`; Phase 0 preserves and reconciles them.
- 304/304 unit tests pass.
- Production build passes under Vite 6.4.1.
- Both references are 1672 × 941, and the `docs/` copies match the supplied attachments by SHA-256.

## Implementation Waves

1. Phase 0 preservation snapshot and rollout flag.
2. Phase 1 browser topology, behavior contracts, privacy correction, and baseline capture.
3. Phase 2 camera bake-off, visual bible, stable face registry, and complete manifest.
4. Phase 3 no-postprocessing compositing spike, deterministic readiness, fallback/lifecycle, then Basis setup.
5. Keyed rendering, cards/art, field, HUD/overlays, motion/audio, responsive/accessibility, multiplayer, and performance.
6. Independent blind A/B critic loops, release gate, and user sign-off.

## Quality Gate

- Deterministic 1672 × 941 reference-aligned captures and equal-size randomized A/B sheets.
- Separate implementer and fresh critics for every quality-critical workstream.
- Weighted score at least 93/100 from every critic, no normalized category below 9.0, zero P0/P1 defects, reference-comparable challenger wins, and two consecutive passing revisions.
- Functional, privacy, accessibility, performance, and fallback gates pass alongside appearance.

## Physical Mobile Gate

Phase 13 must name the actual lowest-supported physical phone, OS, browser/build, and test conditions. Emulation and desktop throttling are useful regression signals but cannot satisfy or be reported as the physical-device gate. This unresolved device choice does not block Phases 0–3.

## Next Step

Proceed with Phase 0 only: snapshot and reconcile the dirty worktree, record live baseline evidence, and add the rollback-friendly presentation flag. Do not begin bulk visual production until the Phase 1–3 contracts and gates pass in order.

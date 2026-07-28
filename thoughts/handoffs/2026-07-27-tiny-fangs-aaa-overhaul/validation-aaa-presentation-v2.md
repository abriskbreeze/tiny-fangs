---
date: 2026-07-27
type: validation
status: VALIDATED
plan_file: /Users/rico/Desktop/Projects & Such/Tiny Fangs - TCG/thoughts/shared/plans/PLAN-tiny-fangs-aaa-presentation.md
supersedes: thoughts/handoffs/2026-07-27-tiny-fangs-aaa-overhaul/validation-aaa-presentation.md
---

# Plan Validation v2: Tiny Fangs AAA Presentation Overhaul

## Overall Status: VALIDATED

The revised plan is safe to execute through Phases 0–3. Every prior `NEEDS REVIEW` finding now has an explicit implementation boundary, a reproducible test topology, and a fail-closed acceptance gate before dependent visual production begins.

This validates the plan and its Phase 0–3 sequencing. It does not claim that implementation, later AAA critic gates, physical-device performance, or release validation is complete.

## Revalidation Scope

- Re-read the revised main plan and implementation handoff.
- Rechecked the two opponent Set identity leak paths against current source.
- Rechecked the authoritative Antling creation path and current duplicate token definitions.
- Rechecked the separate root/server package topology, hardcoded server port, existing endpoint overrides, room lifecycle, preview cancellation, timer state, and debug switch.
- Rechecked the camera, Three r185 color pipeline, compositing, Basis, readiness, and alignment gates.
- This validation subtask edited documentation only. Concurrent implementation work elsewhere in the shared worktree is outside this v2 plan-safety verdict.

## Resolved Findings

### R1 — Opponent face-down Set privacy: RESOLVED IN PLAN

The revised prerequisite covers both current leaks:

1. `server/GameEngine.js#getStateForPlayer()` spreads the complete hidden Set card into opponent state.
2. `shared/engine.js#setVerse()` includes the hidden card name in `events[].verse`, and the server broadcasts that event to both players.

The plan now authorizes only the minimal privacy projection correction:

- projected opponent state is exactly `null` or `{ faceDown: true }`;
- the initial placement event is exactly `{ type: "setVerse", side }`;
- later trigger/cast events retain identity only when game rules reveal the card.

The current `src/event-playback.js` Set handler uses event type and side, not `event.verse`, so removing the initial hidden name has a bounded consumer contract. Phase 1 requires direct state/event tests plus per-recipient WebSocket-frame, DOM, accessibility, asset/preload, readiness-metadata, and debug-output assertions. The preservation wording is consistently “gameplay protocol unchanged except for the tested privacy projection correction.”

**Gate:** no baseline is frozen and no card presentation is integrated until both exact payload tests and real two-browser network assertions pass.

### R2 — Stable Antling/renderable-face identity: RESOLVED IN PLAN

The plan defines a presentation-independent canonical face registry and a pure `resolvePresentationFaceId(card)` contract:

- catalog cards resolve from immutable catalog IDs;
- tokens/derived faces are registered and stamped with explicit `presentationFaceId`;
- the resolver never matches display names, subtitles, rules, or art strings;
- the real authoritative end-turn Antling must resolve to exactly `antling`;
- the identity change is metadata-only and must preserve existing gameplay fields, effects, and state transitions;
- manifest validation enumerates registry/catalog entries, exercises real engine-created objects, and fails on a future face missing identity or art.

This is safer than silently changing Antling's existing gameplay object shape based on its display name and gives the asset pipeline a deterministic key.

**Gate:** bulk card art cannot start until the real-engine Antling test and fail-closed future-token manifest fixture pass.

### R3 — Playwright/multiplayer topology: RESOLVED IN PLAN

The revised plan specifies:

- exact root pins `three@0.185.1` and `@playwright/test@1.61.1`;
- committed `playwright.config.mjs`;
- configurable validated ports with deterministic defaults: Vite `4173`, WebSocket `3101`;
- Playwright-owned Vite and WebSocket `webServer` processes;
- Vite `--strictPort`, same-listener `/healthz`, and guaranteed teardown;
- the existing `?ws=` override for real local multiplayer plus explicit `localStorage.tinyFangsWs` precedence coverage;
- separate `e2e`, `multiplayer`, and `visual` projects;
- two isolated browser contexts, fresh rooms, serial multiplayer specs, and one worker;
- exact root scripts for E2E, multiplayer, visual, and combined presentation validation;
- root `npm ci`, `npm --prefix server ci`, and pinned Chromium installation in CI;
- reports, traces, screenshots, videos, diffs, and critic evidence uploaded even on failure.

The root/server dependency split, browser binary, port ownership, process lifetime, and artifact retention are no longer implicit.

**Gate:** a clean-checkout CI run must prove both installs, both owned processes, and released ports.

### R4 — Camera projection: RESOLVED IN PLAN

The fixed orthographic lock is removed. Phase 2 now compares:

1. calibrated orthographic;
2. calibrated low-FOV perspective with matched framing.

Both candidates use identical populated-board anchors. Blind review evaluates silhouette, near/far scale, depth, prop parallax, reference fidelity, and projected DOM/Three drift at 1672 × 941. Only the winner is locked. Phase 3 retains the maximum 2 CSS px canonical and 4 CSS px responsive alignment gates for either projection.

**Gate:** the field implementation cannot choose a projection for convenience or proceed before the blinded bake-off decision is recorded.

## Additional Contracts Revalidated

- Endpoint selection remains `?ws=` → `localStorage.tinyFangsWs` → production default.
- Uppercase/trim room normalization, create/join/wait/ready/back flows, socket/empty-room cleanup, disconnects, and errors are explicit preservation tests.
- Preview `pointercancel` must release capture/listeners and prevent a delayed reveal.
- Timer ownership is singular and timers/listeners are disposed on back, restart, mode change, disconnect, and unmount.
- `localStorage.tinyFangsDebug` remains supported without hidden-information leakage.
- `window.__TINY_FANGS_VISUAL_READY__` is the sole deterministic visual readiness name and has explicit reset/ready semantics.
- Three r185 uses `NeutralToneMapping` for lit props and `toneMapped = false` for the authored unlit backdrop.
- The first compositing spike has no post-processing.
- KTX2/Basis configuration begins only after the first alignment spike passes and includes production-relative transcoder paths, support detection, and disposal.
- Phase 13 must name a real physical mobile device. Emulation cannot satisfy that gate, and the unresolved device selection does not block Phases 0–3.

## Phase 0–3 Safety Matrix

| Phase | Status | Why it is safe to start/continue |
|---|---|---|
| 0 — Preserve baseline | VALIDATED | It snapshots user-owned dirty work, records current evidence, and adds only a rollback flag before migration. |
| 1 — Characterize behavior | VALIDATED | Test infrastructure, privacy correction, endpoint/room/input/timer/debug contracts, clean-install topology, and network assertions are explicit prerequisites. |
| 2 — Visual bible/manifest | VALIDATED AFTER PHASE 1 GATES | Projection is empirical, face identity is metadata-only and fail-closed, and bulk art waits for golden samples plus complete manifest validation. |
| 3 — Presentation boundary | VALIDATED AFTER PHASE 2 GATES | It proves alignment and lifecycle without post-processing, keeps WebGL disposable, defines deterministic readiness, and defers Basis until the first spike passes. |

## Remaining Deferred Gates

- A physical phone is intentionally unnamed today. Phase 13 and release remain pending until a real device is selected and recorded.
- AAA visual acceptance still requires the planned independent blinded critic loops and final user sign-off.
- Current event-playback, shell breakpoint, timer, and result-path observations remain characterization targets, not authorization for broad refactoring.

None of these deferred items blocks Phase 0, Phase 1, the gated Phase 2 camera/identity work, or the gated Phase 3 compositing spike.

## Evidence Baseline

- Branch/head recorded in the plan: `feat/cel-shaded-field` at `f16804d`.
- Previous validation run: 304/304 unit tests passed across 13 files.
- Previous isolated production build passed under Vite 6.4.1.
- Both reference copies were verified as 1672 × 941 and byte-identical to their supplied attachments.
- Current source confirms the Set state leak, Set event-name leak, Hiveling-derived Antling identity mismatch, root/server install split, server port ownership issue, and existing endpoint override order described above.

## Verdict

**VALIDATED for execution through Phase 3 in the documented order.**

Phase 1 privacy tests must cover both projected state and initial Set events. Phase 2 must keep Antling correction identity-only and cannot begin bulk art until real-engine identity and manifest fail-closed tests pass. Phase 3 cannot add post-processing before the camera/alignment spike passes. Any implementation that bypasses those gates invalidates this verdict.

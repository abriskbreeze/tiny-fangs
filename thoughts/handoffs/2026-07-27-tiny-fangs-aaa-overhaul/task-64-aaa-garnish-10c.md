# Task 64 — Phase 10c: Pooled Particles + Audio Director — Phase 10 Acceptance Review

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## What landed

- **`src/presentation/particle-pool.js`**: fixed-size pooled DOM sparks (cap 48, reuse without allocation churn) bursting from an element's frame-space center on summon/damage/heal/KO. Absolute nodes in a dedicated layer, `pointer-events: none` throughout (no hit-target drift), no layout participation, self-cleaning, and `prefers-reduced-motion` disables bursts entirely (particles are garnish, never state communication).
- **`src/presentation/audio-director.js`**: event-slot → file mapping (12 slots), first-gesture unlock (pointerdown/keydown once, capture, self-unbinding), mute/volume persisted in `localStorage` (`tinyFangs.audio.v1`), and **fail-silent missing-file safety** — a slot whose file 404s (all audio is placeholder-pending user regeneration) is marked dead forever with no retries, no logs, no throws; rejecting `play()`, absent `Audio` constructor, and corrupted persisted settings are all survived silently.
- **Wiring**: the shell mounts both, exposes null-safe garnish seams (`__tfAaaBurst`, `__tfAaaAudio`) consumed by the Anim facade's AAA paths (damage/heal/ko/summon), and adds a `Sound: On/Off` chip (aria-pressed, persisted) beside the Rules link. Dispose cleans both seams.

## Evidence

- Unit **5/5** (`audio-director.test.js`): gesture-gated unlock with listener unbinding, persistence roundtrip + restore, dead-slot no-retry on file error, rejecting-play/broken-constructor survival, corrupted-settings fallback.
- New `aaa-garnish` E2E **3/3**: summon burst observed live within the pool cap and pointer-transparent then self-cleans to zero; sound chip toggles + persists across reload (fresh shell restores Off); reduced motion shows zero particles across the whole playback window.
- Full E2E **96/96**, visual **27/27**, units **606/606**, build clean.

## Phase 10 acceptance review (plan checklist)

- Anim.* API + Promise timing contract: **kept** (10b missing-target 5/5).
- Event types → semantic targets: **done** (classic vocabulary resolves into the shell).
- Deterministic springs/FLIP for zone motion: **done** (10a; fixed-curve, settles to identity).
- Pooled effect particles: **done** (10c).
- Ambient motion never causes layout/hit-target drift: **asserted** (pointer-transparent particles; scene motes are canvas-side).
- Audio director, first-gesture unlock, mute/volume persistence, missing-audio safety: **done** (10c).
- Capability-gated vibration: **deferred to the mobile port** (no vibration hardware contract on the desktop milestone; recorded, not skipped silently).
- Reduced-motion sequences: **done** (FLIP instant path, accent displacement suppression, particle suppression — all E2E-asserted).
- Deterministic 60fps motion recordings + offline audio-analysis reports: **EVIDENCE PENDING user audio/art assets** — recordings without final assets would be evidence theater; recorded as pending, not faked.
- Incoming multiplayer state vs running sequences + visual physics never mutating engine state: playback pipeline unchanged (Phase 1 hardening); re-verified implicitly by 96/96 incl. multiplayer suites; the explicit MP interruption sweep re-runs in Phase 12.

## Next

Priority 8: Phase 1 tail / Phases 11-13 — the 32 missing behavior contracts, the 600px-vs-900px shell fix, multiplayer parity re-runs, performance budgets.

# Task 63 — Phase 10b: Event-Driven Effect Accents on the AAA Chassis

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## What landed

The classic event-playback pipeline now animates the AAA shell with **zero changes to event-playback itself**: the `Anim` facade's semantic helpers (`activeCardEl`, `benchCardEl`, `benchCardEls`, `lpEl`, `setSlotEl`, `benchContainerEl` in `src/anim.js`) grow an AAA branch that resolves targets to the **chassis faces** inside `#aaa-stage` when the shell is mounted. The face carries no transform, so the classic accent classes (`anim-shake`, `anim-flash-red`, `anim-flash-green`, `anim-ko`, `anim-pulse`) apply without fighting the homography on the wrapper. `benchContainerEl` intentionally resolves null in AAA (no bench container exists; container-wide plays no-op safely through the existing `play(null)` contract). Classic resolution is untouched.

Coverage inherited for free: damage/benchDamage/heal/ko/benchKo/lpDamage/lpHeal accents, float text (positions via `centerOf` of the resolved AAA elements), and screen flashes — the whole classic event vocabulary.

**Reduced motion**: AAA-scoped media rules keep the color flashes (state change stays communicated) while suppressing shake/pulse displacement and turning KO into a plain fade.

## Evidence

New `aaa-effects` E2E **4/4**:
1. `Anim.activeCardEl('me')` resolves to a `.tf-aaa-card` inside `#aaa-stage`; a damage call lands `anim-flash-red` + `anim-shake` on it, resolves on the fake clock, and cleans its classes; heal lands `anim-flash-green`.
2. A REAL attack (adaptive board build) shows a damage/KO accent on the **defender** chassis mid-playback, discovered by stepping the fake clock in 100 ms increments.
3. Promise contract: with no rival active present, damage/heal/ko/benchDamage/benchKo all resolve (5/5) — every animation resolves even when its target disappears.
4. Reduced motion: flash class still applied, shake `animation-name` computed as `none`.

Full E2E **93/93**, visual **27/27**, units **601/601**, build clean.

## Next (Phase 10c)

Pooled particles; audio director (first-gesture unlock, mute/volume persistence, fail-silent on the placeholder-pending audio assets); shadow-glide polish if cheap.

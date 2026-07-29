# Task 67 — Parallel Gap Closure: 13 Matrix Rows Closed, 3 Real Defects Fixed

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

Four subagents worked in parallel (user-directed); integration, defect fixes, and verification are mine.

## Rows closed (matrix now 91 covered / 11 missing / 1 manual-pending, from 78/24/1)

| Agent | Deliverable | Rows |
|---|---|---|
| Status playback | `tests/e2e/aaa-status.spec.js` (6/6, twice) | STA-01, STA-02, STA-03, STA-04, STA-08, OVR-10 |
| Affordances | `tests/e2e/aaa-affordances.spec.js` (5), `tests/e2e/classic-hold-guards.spec.js` (4) | ACT-07B, ACT-09, ACT-11, ACT-15, OVR-02, INP-10 |
| Multiplayer | `tests/e2e/multiplayer/deck-parity.spec.js` (5/5 on 4222/3222) | SET-03 |
| Perf audit | lazy-import code split in `src/main.js` | (Phase 13 evidence) |

Highlights: STA-01 poisons via a **real Hexweaver attack** through the shared trigger pipeline and proves exactly one 10-damage tick with heal-netted accounting; ACT-15 fires two synchronous clicks in one JS task and proves `actionLock` blocks the duplicate before the engine; ACT-09 adaptively empties the rival board for a genuine direct attack; INP-10 covers pre-threshold pointerleave/pointercancel plus the disabled/wrong-turn/animating guard table at desktop and touch.

## Defects found and fixed

1. **Bench statuses were invisible in the AAA shell** — `renderStatuses` was wired only to the two active anchors; a poisoned/trapped/fortified bench creature rendered no charm. Now wired for all four bench anchors (`aaa-shell.js`).
2. **Production card art 404'd** — `card-face.js` hard-coded `/src/assets/cards/faces/…`, a dev-only path absent from `dist/`. Template art now resolves through `import.meta.glob(..., { query: '?url' })`; the build emits hashed webp assets (6 deduped faction files verified in `dist/assets/`).
3. (Same sweep, task-66: the RSP-07 dead-screen fallback.)

## Contract clarifications recorded

- The rail Set button does **not** gate on affordability — `updateButtons()` gates presence/occupancy/turn/terminal; affordability is per-option in `doSet`. The test pins the real contract rather than the assumed one.
- Reveal timings: `showCastReveal` 2500 ms, `showTriggerReveal` 5000 ms (`ANIM_TIMING.TRIGGER_REVEAL`), `showSetReveal` 1000 ms; promises settle 300 ms after the modal's `open` class drops.

## Phase 13 evidence (desktop)

Classic payload **739.85 kB → 170.90 kB** (gzip 198.05 → 49.61) with the AAA shell + three.js in a lazy chunk (568.95 kB) loaded only under the aaa flag; the import-failure path routes into the same RSP-07 downgrade. DPR hard-capped at 1 in the shipping renderer (harnesses use the canonical constant). Idle frame time **8.33 ms avg** (p95 10.2) with no ambient render loop. **Open gaps:** the quality tiers in `capabilities.js`/`presentation-coordinator.js` are dead code on the shipping path, and no user quality override exists — both plan-required.

## Evidence

Visual **27/27**, E2E **115/115**, multiplayer deck-parity **5/5**, units **612/612**, build clean with real art assets emitted.

## Next

RSP-02 600/900 shell fix; wire quality tiers + user override; remaining MP parity block; Phase 14 critic loops; Phase 15 release audit.

# Task 66 — Behavior-Matrix Reconciliation + RSP-07 Fallback Defect Fixed

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## Reconciliation

Re-audited all 32 missing rows against the AAA-era suites (~104 E2E added since the last count). **Eight rows flipped to covered** with evidence pointers written into the matrix: ACT-04 (affordability UI), ACT-08 (attack family playback), ACT-10 (first-turn attack UI), ACT-12 (retreat journey), ACT-13 (solo end-turn handoff), STA-06 (D-solo result), RSP-07, RSP-08 (reduced motion). New counts: **78 covered / 24 missing / 1 manual-pending**, with the remaining rows ranked by risk in the matrix's new reconciliation section (MP parity block first, then the 600/900 shell fix, action-lock, status-playback quartet, and the small affordance/journey tables).

## The RSP-07 find: a real dead-screen defect, fixed

The promised WebGL fallback did not exist end-to-end: in aaa mode the CSS hides both classic shells, and a failed scene mount left the flag set — a dead screen. `renderAaaShell` now downgrades `data-presentation` to classic when the shell fails to mount, restoring the fully playable classic renderer. `aaa-fallback.spec.js` blocks WebGL contexts, asserts the downgrade, and plays a real classic turn (1/1).

## Evidence

Full E2E **99/99** (new fallback spec included), visual **27/27**, units **612/612**.

## Next

Parallel gap-closure subagents (user-directed): status-playback quartet, affordance tables, MP parity sweep, Phase 13 perf budgets.

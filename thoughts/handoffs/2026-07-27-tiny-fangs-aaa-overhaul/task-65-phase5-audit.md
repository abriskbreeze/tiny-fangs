# Task 65 — Phase 5 Audit: Current-HP Medallions, Effective ATK, Status Truth — Phase 5 Closed

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## The audit found a real bug immediately

The shell's status charms checked `card.poison` / `card.trapped` — fields that **never exist**. Engine truth is `creature.status === 'poison' | 'trapped'` plus the boolean `creature.fortified`. Poison and trapped charms had never rendered in the AAA shell. Fixed at the source with a comment recording the trap.

## What landed

- **Current HP on the health medallion** (`card-face.js`): creature models carry `hp = curHp ?? baseHp`, `maxHp`, and a `damaged` flag; the medallion gets `data-damaged` with a pale-ember ink shift (ink only — §7 geometry untouched, chassis gates unaffected). `curHp: 0` displays as 0, never falling back to base.
- **Effective ATK**: actives render `displayAtk` computed by the shell via the same shared `getEffectiveAtk` the classic UI shows (presentation-only read of projected state); `data-boosted` (gold ink) / `data-reduced` (ash ink) states.
- **Zero-ATK boundary**: 0 is a legal value end-to-end (echomask verified in units).
- **Status coverage vs engine truth**: psn/trp (via `status`), frt (flag) on creatures; **player-level `unbreakable`** now renders as a `ward` charm on the owner's vitals rail (it existed nowhere in the AAA HUD before).
- **Worst-case content**: every real card normalizes; the longest name ("Call of the Wild") and longest rules text (titanback) render inside the §7.4 safe rects with ≤1px tolerance, measured on live layout at chassis size.

## Evidence

- Unit **6/6** (`card-face-states.test.js`): curHp display + damaged flag, undamaged fallback, boosted/reduced, zero-ATK (synthetic + real echomask), curHp-zero display, all-cards normalization sweep.
- New `aaa-cards` E2E **2/2**: a real attack leaves the defender's health medallion showing engine `curHp` with the damaged ink state (color-asserted); worst-case cards measured overflow-free in live DOM.
- Full E2E **98/98**, visual **27/27** (chassis gates unaffected by ink-state additions), units **612/612**, build clean.

## Phase 5 status

Closed. Frame families, back, medallions (now stateful), status charms (now truthful), rules panel, and the detail/active/bench/hand variants all derive from the one `normalizeFaceModel` view model; face-down privacy was verified in task-57. Tokens: the engine has no separate token-creature type today — nothing to render; if tokens land in `shared/cards.js` later they flow through the same model.

## Next

Priority 7: Phase 1 tail / Phases 11-13 — reconcile the behavior matrix (32 missing contracts), the 600px-vs-900px shell fix, multiplayer parity re-runs, performance budgets.

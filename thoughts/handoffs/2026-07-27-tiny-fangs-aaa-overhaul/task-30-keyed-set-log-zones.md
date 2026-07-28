# Task 30 — Phase 4 Keyed Rendering: Set Slots, Log Zones, and Stats/Actions Audit

**Date:** 2026-07-28
**Branch:** `feat/cel-shaded-field`
**Scope:** Third zone-by-zone wiring step, completing the per-zone list from the plan: set-verse slots patched in place, both log zones keyed, and the textContent-only stats zones plus static actions row audited and exempted with rationale. Classic pixels are unchanged.

## What changed

1. **Set-verse slots (`m-my-set`, `m-opp-set`, `d-my-set`, `d-opp-set`).** These are single-slot, id-addressed elements consumed by anim selectors (`#m-my-set, #d-my-set`). The old path destroyed the node with `outerHTML` on every render, invalidating any captured reference. `patchSetSlot` now syncs the existing node in place from the identical `renderSetVerse` markup via the new exported `syncElementToHtml` helper, with an html cache for no-op renders. One DOM identity per slot for the life of the shell.
2. **`syncElementToHtml` (extracted in `src/presentation/dom/html-keyed-view.js`).** The in-place attribute/child sync that the keyed patch already used, now exported with a `preservedAttributes` option (`data-uid` for keyed nodes, nothing for id-owned slots). Keyed-view behavior is unchanged — it now calls the shared helper.
3. **Log zones (`m-log`, `d-log`).** Keyed by absolute log index (`log-<n>`): entries are append-only within a game, so existing lines keep their DOM node and only new lines are created; the desktop view reconciles the same window newest-first, mobile the last 8 inline. Markup comes from new per-entry exports `renderLogEntry` / `renderLogInlineEntry` in `src/render.js`; the aggregate `renderLogEntries` / `renderLogInline` now delegate to them, keeping their output byte-identical (28 existing render contracts unchanged).
4. **Stats and actions zones — audited, exempt from keying.** `d-deck`, `d-grave`, `d-opp-deck`, `d-opp-hand`, `d-opp-grave`, mana pips, LP hearts, turn/hand counters, and the mobile grave-slot count/class toggles render text or class state only — no per-card DOM exists to key. The action buttons are static `index.html` elements whose `disabled` state is toggled. Grave *card lists* appear only inside modal overlays, which belong to the Phase 9 overlay rebuild. No keying is applicable; recorded here so the Phase 4 zone list is fully dispositioned.

## Evidence

- Units: **574/574** (new `syncElementToHtml` contract).
- Desktop/solo E2E: **59/59, two consecutive full runs.** (One solo-setup deck-list test failed once under full-suite load in the first run, passed in isolation and in both subsequent full runs; unrelated surface — setup screen, no board rendering — recorded honestly here, watch for recurrence.)
- Visual project: **11/11** with all 17 classic screenshot records (pngHash included) equal to the committed baseline.
- Multiplayer project: **8/8**; server-process **17/17**.
- Isolated production build passed; diagnostics 0/0 on all changed files.

## Phase 4 remaining

- Every board zone now renders through identity-preserving paths. The last Phase 4 item is the **desktop/mobile DOM-tree unification** (one shell tree instead of duplicated `m-*`/`d-*` renders), to be done only against the full parity evidence above.

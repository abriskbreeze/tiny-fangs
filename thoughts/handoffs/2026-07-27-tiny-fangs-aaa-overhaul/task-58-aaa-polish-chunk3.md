# Task 58 — Phase 8 Chunk 3: Detail Interactions, Accessibility Gates, Live-Shell §12 Identity

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## What landed

**Card detail in the AAA world** (`aaa-shell.js`): clicking any face-up board card opens the classic `showCardDetail` surface (same modal, same effective-stat computation); hand cards inspect on context-click without playing; face-down rival zones (set/deck) expose NO inspectable affordance — the privacy contract holds at the interaction layer too. `showCardDetail` joins the injected actions in `main.js`.

**Accessibility/affordance gates** (Phase 8 acceptance list), all E2E-verified at the canonical 1672×941 DPR 1 milestone viewport:
- Touch targets: all six rail buttons and every hand card ≥40px in both axes.
- Keyboard: Tab traverses the rail in DOM order across whatever subset is enabled, each keyboard-focused button shows a ≥2px visible focus ring (`:focus-visible`), and Enter activates End Turn through the real dispatch. Lesson: programmatic `.focus()` does not trigger `:focus-visible` — the test drives focus entirely with Tab.
- Contrast: WCAG AA (≥4.5:1) verified for rail ink on parchment buttons, vitals labels, log lines over the darkest meadow tone the rail can sit on, and count-chip gold on near-black.
- Ownership: labeled You/Rival vitals, owner-tagged turn chip, and a geometric assertion that every `me.*` anchor renders strictly below the divider row and every `opp.*` anchor strictly above it.

**§12 on the live shell — identity proof**: the shell's WebGL canvas after mount is **byte-identical** (`toDataURL` equality) to the calibrated `meadow.html` harness canvas in the same browser profile, so every measured §12 environment row carries to the live composition unchanged. Root cause of the initial mismatch: the runtime golden-quads module had been transcribed at 4-decimal precision, shifting slot-mark antialiasing sub-pixel — regenerated at full float precision (comment records the lesson). `preserveDrawingBuffer` enabled on the shell renderer for capture parity (matches the harness).

## Evidence

- New `aaa-polish` E2E **5/5** (detail + privacy, keyboard/touch, contrast, ownership, terrain identity).
- Full E2E **75/75**, visual **27/27**, units **601/601**, build clean.

## Phase 8 status after chunk 3

Complete against the acceptance list: anchors match the reference composition (golden quads, terrain identity); life/mana/deck/grave/turn/actions/log are quiet edge rails; click targets with disabled/enabled states preserved and mirrored from the classic single source; all six actions available and E2E-verified; ownership unmistakable; hand fan handles current and edge-case sizes; contrast/touch/keyboard/legibility gates green. Remaining Phase 8 residue rolls into Phase 9/10 by design: selected/targeting visual states arrive with the Phase 9 selector rebuild, and timer surfacing joins the Phase 9 HUD polish. Next ledger item: Phase 9.

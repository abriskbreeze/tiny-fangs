# Task 59 — Phase 9a: Setup, Deck Select, Generic Modal, Card Detail in the AAA Material

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## What landed

Pure CSS-level restyle (`aaa-shell.css`), every selector gated under `:root[data-presentation="aaa"]` — classic mode's computed styles untouched (E2E asserts the classic Solo button is NOT parchment before asserting the aaa one IS):

- **Body/setup backdrop**: deep meadow-green gradient with a warm sun bloom; TINY FANGS title in divider-gold with warm glow; Alegreya across the setup surfaces.
- **Mode/deck/difficulty buttons**: parchment gradient, ink text, gold hover borders, active difficulty in medallion gold; room-code input in mono on dark.
- **Generic + response modals** (`.modal-box`): the card chassis's own material — parchment linear gradient PLUS the §7.6 repeating-conic paper grain — ink title with rule line, options as raised parchment chips with gold hover, `.off` options faded, cancel as dark-leather button. Selector ownership variants (`selector-yours` gold / `selector-enemy` plum) restyled in-material for 9b's selectors.
- **Card detail** (`.card-detail`): parchment panel on a dim scrim, leather close button.

## Behavior contracts (asserted, unchanged)

Full solo start flows through the restyled modals identically (deck → rival → coin → first-turn); disabled options carry visible `.off` treatment; Close button dismisses; card-detail backdrop click dismisses; keyboard/dismissal handling untouched (same DOM, same handlers).

## Evidence

- New `aaa-material` E2E **3/3** (flag-gated material on setup/deck buttons with classic negative-control; modal material + full behavior flow + off-option treatment + dismissal; card-detail material + backdrop dismissal).
- Full E2E **78/78**, visual **27/27** (classic hashes byte-identical), units **601/601**, build clean.
- Screenshots: `task-59-setup-aaa.png`, `task-59-modal-aaa.png`.

## Next (Phase 9b)

Selectors (action/target/optional-trigger/Skitter) exercised in the AAA shell with the in-material ownership cues; selected/targeting visual states on AAA cards; timer surface on the HUD rails.

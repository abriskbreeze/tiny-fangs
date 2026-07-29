# Task 62 — Phase 10a: Uid-Keyed FLIP Motion for the AAA Board

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## What landed

Every identity-bearing card (face-up board cards and hand cards) now renders inside a persistent frame-spanning `.aaa-flip` outer keyed by uid (`flipMap` in `aaa-shell.js`). On each state update the shell runs classic FLIP:

- **First**: capture the viewport rect of every connected keyed card before the layer wipe.
- **Last**: rebuild exactly as before (settled DOM identical — settled outers carry `transform: ''`, so every byte-determinism gate is untouched).
- **Play**: moved cards get a translate/scale delta at a computed transform-origin, one forced reflow, then a fixed-curve 380 ms transition back to identity (deterministic cubic-bezier; no randomness). Stage-scale-aware (rect deltas divided by the frame scale).

Zone transitions covered: **hand → active/bench** (summon glides from the fan), **active ↔ bench** (retreat glides both cards), **deck → hand** (new hand uids synthesize a First rect from the me.deck quad and rise from it), **board → grave** (departed uids whose card reached a grave get their old content resurrected and sent gliding/fading toward the grave quad, then removed and pruned). DOM identity persists across zone changes — asserted with an identity probe attribute surviving summon.

**Reduced motion**: `prefers-reduced-motion: reduce` skips capture/animation entirely (instant placement, no transitions), belt-and-suspenders CSS `transition: none` under the media query.

## Evidence

- New `aaa-motion` E2E **3/3**: summon FLIP (same DOM node, moving class during transit, settles to empty transform), retreat FLIP (both swapped uids glide and land on the correct quads), reduced-motion (instant, transform empty, no moving class).
- Full E2E **89/89**, visual **27/27** (settled-frame determinism intact), units **601/601**, build clean.

## Notes / residue

- Contact shadows rebuild instantly at destinations while cards glide (shadow layer sits under all cards; gliding shadows would need per-card z-compositing). Recorded as a 10b polish candidate, not a contract.
- The classic event-playback pipeline still owns sequencing; FLIP is purely reactive to state diffs. 10b will add event-driven accents (damage flash/heal glow/KO emphasis) on the semantic targets.

## Next (Phase 10b)

Event-driven effect accents on the AAA chassis via the event-playback semantic targets, preserving the Anim.* Promise contract (every animation resolves even if its target disappears).

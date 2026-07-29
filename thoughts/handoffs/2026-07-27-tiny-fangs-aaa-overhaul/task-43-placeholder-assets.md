# Task 43 — Placeholder Assets at Exact Manifest Sizes (User Direction)

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`
**Scope:** Per the user's direction ("use basic shapes and such for now but correct sizing"; "i'll re-generate all the assets later just give me the necessary sizes"), every non-card image slot in the asset manifest is now filled with a basic-shape placeholder at the exact required dimensions and within budget, so all downstream wiring proceeds against real files. No provenance claim anywhere; strict release stays honestly red.

## The regeneration size sheet (given to the user, recorded here)

- **Per-card art (56):** user generates ONE master per card at **2048×1536 PNG (4:3)** ≤8MB; the pipeline derives detail 1600×1200 WebP, thumbnail 800×600 WebP, fallback 800×600 JPG.
- **Frames** (creature / verse-cast / verse-set / token): **1536×2304 WebP** ≤1.5MB, empty art window/nameplate/rules/medallion sockets.
- **Backs** (standard, set-hidden): **1536×2304 WebP** ≤1.5MB.
- **Status icons** (poison, trapped, fortified, unbreakable): **512×512 WebP** ≤220KB.
- **UI:** life-token, mana-token, turn-marker, divider-rune **512×512** ≤280KB; selection-ring, legal-target-ring, coin-heads, coin-tails **1024×1024** ≤500KB (alpha where ring/coin).
- **Environment:** meadow-backdrop **3840×2160** ≤8MB; terrain-color **2048×2048** ≤4MB; terrain-normal **2048×2048** (normal map); water-normal **1024×1024**; props-atlas **2048×2048**; contact-shadow **1024×1024** (alpha).
- **Audio (11):** .ogg ≤4MB each — left honestly missing (no encoder available; Phase 10 owns audio).

## What was generated (`scripts/make_placeholder_assets.py`)

24 basic-shape placeholders in the §5 palette at exact spec: four frames with correct socket geometry (transparent art window, nameplate band, rules keyline, cost socket; creature adds stat sockets), two navy-and-gold backs with the twin-fang mark (set-hidden visually distinct), four status icons, eight UI tokens/rings/coins, and six environment maps (flat normal maps at neutral 128,128,255, radial contact-shadow alpha blob, basic props atlas). One real duplicate caught by the validator (turn-marker and unbreakable shared identical bytes) and differentiated.

## Validation state

- **Draft: 0 errors**, 310 honest warnings (200 declared template-placeholder duplicates, 15 missing audio, 95 missing provenance).
- Strict release: honestly red as designed.
- Units **601/601**; production build unchanged.

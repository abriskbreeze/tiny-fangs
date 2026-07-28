# Task 32 — Phase 2: Self-Hosted Fonts, Zero Remote Capture Dependencies

**Date:** 2026-07-28
**Branch:** `feat/cel-shaded-field`
**Scope:** The Phase 2 engineering remainder: the game and every capture lane now render with zero remote dependencies. The last one was the Google Fonts `@import` for JetBrains Mono in `src/styles.css`.

## What changed

1. **`src/fonts/` (new).** The six exact woff2 binaries Google Fonts served on 2026-07-28 for `JetBrains Mono wght@400;500;600` (v24 variable-weight files, one per script subset: latin, latin-ext, greek, cyrillic, cyrillic-ext, vietnamese) plus `jetbrains-mono.css` reproducing all 18 `@font-face` blocks with identical `unicode-range`s and local `src` URLs, and the SIL OFL 1.1 license text (`OFL.txt`) as required for redistribution.
2. **`src/styles.css`.** The remote `@import url('https://fonts.googleapis.com/…')` is replaced by `@import url('./fonts/jetbrains-mono.css')`. Vite bundles five subsets as hashed assets and inlines the 1.6 KB cyrillic-ext subset as a data URI (under the 4 KB inline limit) — all self-hosted either way.

## Why this is safe for the immutable baselines

The classic capture records store only `fonts: { status: 'loaded' }` and failure lists — no URLs — so the manifest shape is unchanged. Pixel identity was the real gate: the self-hosted binaries are byte-for-byte the files the remote captures rendered with, and the visual suite passed with **all 17 classic screenshot records (pngHash included) equal to the committed baseline**.

## Evidence

- `grep -rl "googleapis|gstatic"` over `src/`, `dist/`, and both HTML entry points: **zero matches** — no remote font or capture dependency remains.
- Units **580/580**; build clean; visual **11/11** (17/17 classic hashes byte-identical); desktop E2E **59/59**; multiplayer **8/8**.

## Phase 2 remaining

- Creature, cast, set, and card-back golden samples through the two-fresh-critic blind gate (>=93 weighted, no category below 9.0, wow >=9.0, zero P0/P1). Golden-sample acceptance is also a user taste decision — expect a BLOCKED ledger entry with specific questions once candidate samples exist.
- Production art per the 56-face manifest runs in Phase 6 TEMPLATE MODE per the user's 2026-07-28 decision.

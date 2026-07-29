# Prompt: wire every art asset into the Tiny Fangs renderer

> Paste everything below the line into a fresh session.

---

Work in `/Users/rico/Desktop/Projects & Such/Tiny Fangs - TCG` on branch `feat/cel-shaded-field`.

## The problem

This project has a complete asset manifest — 95 assets across 7 families, validated by `npm run validate:assets` — but **only one family is actually loaded by rendering code.** I verified this by grepping `src/` for each asset directory and excluding the manifest itself:

| Family | Files | References outside the manifest | What the game draws instead |
|---|---|---|---|
| Card art (`src/assets/cards/faces/*/`) | 56 × 4 | **wired** (thumbnail only) | loads `thumbnail.webp` |
| Frames (`src/assets/frames/`) | 4 | **0** | CSS gradient layers |
| Backs (`src/assets/backs/`) | 2 | **0** | an inline SVG sigil |
| Status icons (`src/assets/status/`) | 4 | **0** | literal text `psn` / `trp` / `frt` |
| UI tokens (`src/assets/ui/`) | 8 | **0** | Unicode `♥ ♡ ● ○`, a CSS coin |
| Environment (`src/assets/environment/`) | 6 | **0** | procedural canvas + Three.js geometry |
| Audio (`src/assets/audio/`) | 15 | wired | audio director, fails silent |

So if all 95 assets were produced today, **6 would appear and 89 would sit unused.** Your job is to close that gap.

Read `ART-SPEC.md` in the repo root first — it is the authored specification for every asset (sizes, formats, paths, and the card-frame socket coordinates). It is the source of truth for what each asset is meant to be.

## Your job

Wire every asset family into the renderer, so that dropping a file at its manifest path makes it appear in the game. Work in this order — each step is independently committable:

### 1. Card frames and backs (highest impact)

`src/presentation/cards/card-face.js` builds the chassis. Today it composes the frame from four nested divs (`__keyline` → `__rail` → `__inner-keyline` → `__panel`) styled with CSS gradients in `src/presentation/cards/cards.css`. Card backs render `GOLDEN_SAMPLE_ART.backSigil`, an inline SVG.

Replace both with image-backed rendering:
- Creature cards use `src/assets/frames/creature.webp`, cast verses `verse-cast.webp`, set verses `verse-set.webp`, tokens `token.webp`.
- Deck backs use `src/assets/backs/standard.webp`; face-down set verses use `backs/set-hidden.webp`.
- Frames are **opaque** with an inset art window (see ART-SPEC section 1). The art image goes *behind* the frame; the frame's art aperture is a transparent hole through which it shows. Text and medallion values continue to be composited by the DOM on top.

**Critical:** the art window geometry lives in `src/presentation/cards/chassis-geometry.js` as `SAFE_RECTS`. A geometry rebuild may have just landed (art window `26, 78 → 306, 278`, i.e. 280 × 200 at 7:5). **Read the current values rather than trusting these numbers**, and derive positions from `SAFE_RECTS` rather than hard-coding.

### 2. Load the right card-art variant

`card-face.js` currently loads only `thumbnail.webp` (700 × 500) via `import.meta.glob`, even in the full-size detail modal. Wire the variants to their intended uses: `thumbnail` for board and hand, `detail` (1400 × 1000) for the card-detail overlay, and `fallback.jpg` when WebP is unsupported. `source.png` is an archival master and should never be fetched at runtime.

### 3. Status icons and UI tokens

- Status charms render as text in `src/presentation/aaa-shell.js::renderStatuses` (`psn`, `trp`, `frt`, plus a player-level `ward`). Swap for `src/assets/status/{poison,trapped,fortified,unbreakable}.webp`.
- Life and mana render as Unicode in `renderHud` (`'♥'.repeat(...)`, `'●'.repeat(...)`). Swap for `ui/life-token.webp` and `ui/mana-token.webp`, keeping filled-vs-empty states distinguishable.
- The turn chip (`aaa-turn-chip`) should use `ui/turn-marker.webp`.
- The coin flip in `src/main.js::doCoinFlip` builds a CSS-3D coin (`aaa-coin-face`) with letters H and T. Swap the faces for `ui/coin-heads.webp` / `ui/coin-tails.webp`. **Its result timing is a hard contract: the overlay must remain visible at 1779 ms and be gone at exactly 1780 ms.** There is a test asserting this; do not alter any frame delay.
- `ui/selection-ring.webp` and `ui/legal-target-ring.webp` should replace the CSS glow used for the selected hand card (`.aaa-hand-card--selected`) and targeting highlights (`.aaa-card--targetable`).
- `ui/divider-rune.webp` belongs at the field divider's center diamond, currently painted procedurally in `src/presentation/scene/meadow-scene.js`.

### 4. Environment textures

`src/presentation/scene/meadow-scene.js` paints the terrain onto a canvas and builds props as Three.js geometry. Wire `environment/meadow-backdrop.webp` (3840 × 2160) as the field image, and use `terrain-color`, `terrain-normal`, `water-normal`, `props-atlas`, and `contact-shadow` where they apply.

**Read this before touching the scene:** the field has twelve measured quality gates in `tests/visual/meadow-field.visual.spec.js` (palette ΔE, perimeter/center luminance ratio, divider geometry, slot-mark luminance band, environment frame extents). They are calibrated to the *procedural* field. When a real backdrop image replaces it, these gates must be **recalibrated to the new art, not deleted or loosened** — same operators, same structure, new targets measured from the new render. If you cannot recalibrate a row honestly, stop and report it.

## Non-negotiable requirement: graceful degradation

Every asset is currently absent from the repo (they are placeholder shapes or missing entirely). **A missing asset must degrade to today's procedural rendering, never break the game.** The audio director in `src/presentation/audio-director.js` is the reference implementation of this pattern — it maps event slots to files, marks a slot dead on first error, never retries, never logs, and never throws. Mirror that discipline for images.

This means the game must remain fully playable with zero art files present, and progressively improve as files land. Prove it with a test.

## How to verify

```bash
npm test -- --run                                              # unit suite
npx playwright test --project=e2e --workers=1 --reporter=line   # browser suite
npx playwright test --project=visual --workers=1                # visual + measured gates
npm run build && npm run validate:assets
```

Use `--workers=1`. Running the AAA specs in parallel causes WebGL context contention and produces false failures — this was proven by reproducing it on a clean worktree at HEAD.

**Three tests are known-fragile and fail for reasons unrelated to any asset work:** `aaa-actions › retreat swaps`, `aaa-motion › retreat FLIPs`, and `aaa-selectors › target selection`. They build board positions by playing against the rival AI, and the AI now wins during their setup loops. The behaviors they cover are proven by other tests. Report them if you see them; do not fix or weaken them.

Also add a test proving the degradation contract: with assets absent, the game still renders and plays; with an asset present, it is actually used.

## Rules

- **Never weaken a gate, threshold, privacy contract, or validator** to make something pass. If a measured gate legitimately needs new targets because the art changed, recalibrate it deliberately and say so explicitly in your report.
- `shared/engine.js` is the only rules authority. This is presentation work; it must not touch game rules.
- The classic renderer (`?presentation=classic`, the default) must keep working. The AAA presentation is opt-in via `?presentation=aaa`.
- Prefer `import.meta.glob` or explicit imports so the bundler emits hashed assets. A hard-coded `/src/...` URL works in dev and **404s in production** — that exact bug was already found and fixed once in this codebase.
- No `console.log` in shipped code.
- Do not edit anything under `thoughts/` — that is a separate working ledger.

## Context you should read

- `ART-SPEC.md` — the asset specification (root).
- `src/presentation/assets/manifest.js` — the machine-readable manifest and validator contract.
- `src/presentation/cards/chassis-geometry.js` — `SAFE_RECTS`, the card layout source of truth.
- `src/presentation/audio-director.js` — the fail-silent pattern to mirror.
- `thoughts/shared/GOALS-tiny-fangs-aaa.md` — the project ledger, newest entries first, for background on why things are the way they are.

## Report back

State plainly: which asset families are now wired and verified, which remain procedural and why, every measured gate you recalibrated with old → new values and the justification, all test counts, and anything you could not make work. If an asset family cannot be wired without art present to test against, say so rather than shipping untested code.

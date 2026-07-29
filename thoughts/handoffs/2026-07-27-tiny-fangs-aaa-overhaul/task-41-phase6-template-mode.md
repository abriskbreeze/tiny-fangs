# Task 41 — Phase 6 TEMPLATE MODE Complete; User Frame-Template Direction Recorded

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`

## Phase 6 template mode (user decision 2026-07-28) — exit conditions met

1. **Six style-consistent template scenes authored and rendered** (`scripts/make_template_art.py` → `src/assets/cards/templates/<key>/`): one per faction — shadow (dusk wisps under a wan moon), fang (howling ridge silhouette), venom (marsh drip and venom droplet), swarm (spiral of ink-dark motes), shell (spiral shell on the shore), plus token/generic (fang-ring watermark meadow) — all sharing one cel-scene structure (sky band, tree line, meadow ground, single motif) in the §5 palette. Each renders the four manifest variants at exact spec: source.png 2048×1536, detail.webp 1600×1200, thumbnail.webp 800×600, fallback.jpg 800×600; whole set ≈ 8 MB.
2. **Every renderable face resolves through the registry** (`src/presentation/assets/template-face-map.js`): deck membership maps 52 catalog faces to their faction; deckless faces (piranix, reflector, manaSurge) and derived antling fall to token. All 224 canonical per-face manifest paths are populated on disk.
3. **Manifest marks placeholder tier honestly:** every cardFaces entry carries `artTier: 'template-placeholder'`, its `templateKey`, and the template motif's focal point; provenance stays empty — **no provenance claim**.
4. **Validator contract implemented exactly as the user specified:** draft is green (0 errors; 334 honest warnings = 200 template duplicate hashes + 39 missing non-card files + 95 provenance) and **strict release stays honestly red (334 errors)**. The one validator change is severity scoping, not relaxation: DUPLICATE_CONTENT_HASH is a *draft warning only* for assets explicitly declared `template-placeholder`; it remains an error in release for everything, and in every phase for undeclared assets.
5. **No broken/missing art anywhere:** the classic shell renders ASCII and the showcase renders inline SVG; nothing consumes these files yet, and when Phase 5 wires faces, all 56 resolve. **Deferred per-card art gate: EVIDENCE PENDING (user art)** — per-card blind reviews and faction contact sheets wait for real art.

## User direction received mid-iteration (answers the Task 40 BLOCKED entry)

The user proposes generating card **frame template images** themselves — three families (creature / cast verse / set verse, ideally plus the back) without art or values — with the system compositing live art, names, rules, and numerals on top. This is exactly the four-critic synthesis (reference's material object + our information system) and exactly the manifest's existing `frame/*` slots (1536×2304 WebP). Generation spec given to the user and recorded in the ledger: portrait 2:3 at 1536×2304; empty art window (~upper 55%), nameplate band, rules panel, and medallion sockets; family rails amber `#B47015` / teal `#277A79` / plum `#6A5A66`; ivory lip `#DEBB91`, parchment `#DCBA96`, ink `#3B2317`, gold `#EEC34E`, navy back `#372F3F`; painterly carved-and-gilded material, warm upper-left light, original motifs only. Precision fitting to §7.4 happens in-engine.

## Evidence

- Units **601/601** (5 new template-mode exit contracts: registry resolution, token fallback, template files on disk, all 224 canonical paths populated, placeholder-tier marking with no provenance claim).
- Draft validation **0 errors**; release honestly red **334 errors**; production build unchanged.

## Next

Golden samples wait on the user's frame images (EVIDENCE PENDING — user frames). Next unblocked item: **Phase 7, the Three.js meadow under the locked camera**.

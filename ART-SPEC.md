# Tiny Fangs — Art Specification

**Generated:** 2026-07-29 from `src/presentation/cards/chassis-geometry.js` and `src/presentation/assets/manifest.js` (the validator and the browser chassis spec read the same sources, so these numbers are enforced, not aspirational).

**Everything degrades.** Every asset below is optional at runtime: a missing or broken file leaves the procedural CSS rendering in place, silently, with no retry and no console noise. The game is fully playable with zero art files present and improves as files land, so you can ship these one at a time in any order.

> **Approved layout:** cards use an **opaque frame with an inset art window**. The illustration does *not* bleed to the card edge — it sits in a 7:5 landscape window with the frame visible all the way around it, and the nameplate runs as a band across the top beside the cost medallion. Card art is authored at **2100 × 1500 (7:5)**. `npm run validate:assets` checks these numbers directly.

**Total: 95 assets** — 56 card faces, 4 frames, 2 backs, 4 status icons, 8 UI pieces, 6 environment textures, 15 audio files.

Everything lives under `src/assets/`. The build pipeline hashes and copies them into `dist/` automatically — put files at the exact paths below and they get picked up. Validate any time with:

```bash
npm run validate:assets
```

---

## 1. Card frames — the highest-value pieces

**4 files · 1536 × 2304 px · WebP · ≤1.5 MB each**

| File | What it is |
|---|---|
| `src/assets/frames/creature.webp` | Creature card frame (amber family) |
| `src/assets/frames/verse-cast.webp` | Cast verse frame (teal family) |
| `src/assets/frames/verse-set.webp` | Set verse frame (plum family) |
| `src/assets/frames/token.webp` | Token creature frame |

**Frames are opaque, with one transparent hole.** The frame is the card: an ornamental border, a parchment field, a nameplate band across the top, and panels for the type line, rules text and flavor footer. Only the **art window** — a 7:5 landscape rectangle in the upper-middle of the card — is fully transparent, and the illustration shows through it. Everything else is painted.

Save as WebP with alpha (or PNG during authoring); alpha is only needed for the art window and the outer rounded corners.

The frame is authored at 1536 × 2304 and displays on a **333 × 505** chassis. Design at the large size; check readability at the small one.

**The two axes do not scale equally.** 1536 × 2304 is a 0.6667 ratio; the chassis is 0.6594. The frame is drawn stretched to the card box, so horizontal scale is **×4.6126** and vertical is **×4.5624** — about 1.1% apart. Use the per-axis factors for any coordinate you compute yourself; a single uniform factor drifts by ~20 px near the bottom of the canvas. (This is also why the art window measures 1.4154 on your canvas but lands as exactly 7:5 on screen.)

**Text panels are opaque.** The nameplate, rules box and flavor footer sit on the parchment field, not over artwork, so they carry dark ink at full contrast. There is no art behind them to fight.

### Where the sockets must land

These are the exact regions the code writes into, given in **display pixels (333 × 505)** and in canvas pixels (x × 4.6126, y × 4.5624 — see the per-axis note above).

| Socket | Display rect (x, y, w × h) | On your 1536 × 2304 canvas | Holds |
|---|---|---|---|
| Cost medallion | 6, 6 — 68 × 68 | 28, 27 — 314 × 310 | Mana cost numeral |
| Nameplate | 80, 22 — 227 × 46 | 369, 100 — 1047 × 210 | Card name band, top of card |
| Title text box | 88, 27 — 211 × 36 | 406, 123 — 973 × 164 | Name ink, inside the nameplate |
| **Art window** | **26, 78 — 280 × 200** | **120, 356 — 1292 × 912** | **Transparent: the illustration** |
| Family seal | 145, 257 — 43 × 43 | 669, 1173 — 198 × 196 | Faction emblem, straddles the window's bottom edge |
| Type line | 60, 308 — 213 × 20 | 277, 1405 — 982 × 91 | "Twilight Wolf" / "Cast Verse" |
| Rules box | 34, 334 — 265 × 98 | 157, 1524 — 1222 × 447 | Ability text |
| Flavor footer | 84, 438 — 165 × 24 | 387, 1998 — 761 × 109 | Italic flavor line |
| Attack medallion | 6, 437 — 68 × 62 | 28, 1994 — 314 × 283 | ATK numeral (creatures) |
| Health medallion | 259, 437 — 68 × 62 | 1195, 1994 — 314 × 283 | HP numeral (creatures) |
| Status stack *(reserved)* | 309, 84 — 22 × 156 | 1425, 383 — 101 × 712 | Poison/trapped/etc. charms — not yet rendered |
| Inspect glyph *(reserved)* | 285, 282 — 42 × 42 | 1315, 1287 — 194 × 192 | Inspect affordance — not yet rendered |

The art window's canvas rectangle in full is **x 120 → 1411, y 356 → 1268**. That is the only fully transparent region in the file.

The frame band around the card is **20 px per side at display size (≈92 px on your canvas)**: a 6 px lip, a 2 px keyline, a 10 px family-colour rail, and a 2 px inner keyline. The art window sits a further 6 px inside that, so the border reads continuously all the way around the illustration.

Two things that will bite if missed: the medallions are where numerals print, so keep their centres clear; and the family seal is a stamp that deliberately overlaps the bottom edge of the art window, so leave the window's lower-centre uncluttered.

**Corner radius:** the chassis uses 21 px at display size (≈97 px on your canvas), and the frame layers step concentrically inwards — 21 → 15 → 13 → 3 → 1 at display scale. Frames are drawn inside that rounded rectangle.

---

## 2. Card backs

**2 files · 1536 × 2304 px · WebP · ≤1.5 MB each**

| File | What it is |
|---|---|
| `src/assets/backs/standard.webp` | Deck back — seen on both decks |
| `src/assets/backs/set-hidden.webp` | Face-down set verse |

Backs cover the whole card — no aperture, no transparency. The art-safe region for a central sigil is **display 24, 24 — 285 × 457** (canvas **111, 109 — 1315 × 2085**).

`set-hidden` matters for fairness: an opponent's face-down verse must be **completely identity-free**. Two different set cards must be pixel-identical from the back. The renderer already guarantees this — the variant is chosen from the slot and never from the card — so just don't vary the art.

---

## 3. Card art — 56 illustrations

**Card art fills the frame's inset art window.** It is *not* full-bleed: the window is a 7:5 landscape rectangle, 280 × 200 at display size, and the opaque frame surrounds it on all four sides. Art is authored at that aspect so nothing is cropped away.

Each face needs **four files** in its own folder, `src/assets/cards/faces/<faceId>/`:

| Role | File | Size | Format | Max |
|---|---|---|---|---|
| Source | `source.png` | 2100 × 1500 | PNG | 8 MB |
| Detail | `detail.webp` | 1400 × 1000 | WebP | 1.1 MB |
| Thumbnail | `thumbnail.webp` | 700 × 500 | WebP | 235 KB |
| Fallback | `fallback.jpg` | 700 × 500 | JPEG | 310 KB |

All four are **7:5 landscape** (±1%) — the art window's shape. Realistically you author `source.png` and derive the rest; say the word and I'll add a script that generates the three derivatives from each source automatically.

`source.png` is deliberately excluded from the bundler's asset glob, so it is never emitted into `dist/` and never requested by a browser. Keep it as your master; it costs nothing at runtime. The other three each have a job: `thumbnail` on the board and in hand, `detail` in the card-detail overlay, `fallback.jpg` on browsers without WebP.

> **The 56 folders on disk today still hold the old 4:3 art** (2048 × 1536 / 1600 × 1200 / 800 × 600) from before the inset-window rebuild. That is the entire current `validate:assets` error count — 224 aspect mismatches plus 56 under-size sources. They render, cover-cropped, but they are the wrong shape and need regenerating at 7:5.

### Composing for the window

The window is a crop of your illustration only in the sense that a picture frame is: the whole 7:5 image is shown, scaled to 280 × 200 display px. Nothing of the frame's furniture sits on top of it except one element.

| Region of the art | Roughly | What happens there |
|---|---|---|
| The whole window | 2100 × 1500 | Fully visible — this is the illustration, edge to edge |
| Lower centre | x 890 → 1215, y 1340 → 1500 | The family seal stamps the bottom edge here |
| Outer ~2% | all four edges | A 1.5 px ink keyline and a soft inner vignette land here |

Practical guidance: **compose for a landscape frame, not a portrait card** — a single clear subject reading at roughly 280 × 200 on screen. Keep the lower-centre free of anything load-bearing (the seal overlaps it), and let the outer few percent be atmosphere rather than detail.

### The 56 faces

**Creatures (29)**
- *Shadow:* whisper, gloom, mireveil, duskfang, shadePup
- *Fang:* cindermaw, bladewhisker, pulsefin, stormtalon, emberfang
- *Venom:* thornling, hexweaver, sundewqueen, echomask, leechling
- *Swarm:* fangpup, hiveling, skitter, hollowfox, alpha, broodmother
- *Shell:* shellkin, pebbleback, ironhide, coilshell, bulwark, titanback
- *Token:* piranix, reflector

**Verses (26)**
- *Shadow:* soulSiphon, darkPact, graveEcho, soulTrap, graveRise, manaDrain
- *Fang:* predatorsMark, bloodMoon, phantomWall, vengeance, lastBreath, ignite
- *Venom:* banish, secondWind
- *Swarm:* packTactics, callOfTheWild, sacrifice, denMother, swarmShield
- *Shell:* shellArmor, brace, spikeShield, regenerate, fortify, unbreakable
- *Token:* manaSurge

**Token (1)** — antling

Folder names must match those IDs exactly (camelCase as written).

---

## 4. Status icons

**4 files · 512 × 512 px · WebP · ≤215 KB each**

| File | Meaning |
|---|---|
| `src/assets/status/poison.webp` | Ticking 10 damage at end of turn |
| `src/assets/status/trapped.webp` | Cannot retreat |
| `src/assets/status/fortified.webp` | Survives one lethal hit |
| `src/assets/status/unbreakable.webp` | Negates next damage (player-level) |

These render at roughly **22 px** on the status rail, so they need to read as silhouettes. Until a file exists the charm shows its three-letter text (`psn`, `trp`, `frt`, `ward`); that text stays in the DOM for screen readers either way and simply goes transparent once art loads.

---

## 5. UI pieces

**8 files · WebP**

| File | Size | Max | What it is |
|---|---|---|---|
| `src/assets/ui/life-token.webp` | 512 × 512 | 273 KB | One life (3 per player) |
| `src/assets/ui/mana-token.webp` | 512 × 512 | 273 KB | One mana pip (up to 5) |
| `src/assets/ui/turn-marker.webp` | 512 × 512 | 273 KB | Whose turn it is |
| `src/assets/ui/divider-rune.webp` | 512 × 512 | 273 KB | Centerpiece on the field divider |
| `src/assets/ui/selection-ring.webp` | 1024 × 1024 | 488 KB | Highlights your selected card |
| `src/assets/ui/legal-target-ring.webp` | 1024 × 1024 | 488 KB | Highlights valid targets |
| `src/assets/ui/coin-heads.webp` | 1024 × 1024 | 488 KB | Coin flip — heads |
| `src/assets/ui/coin-tails.webp` | 1024 × 1024 | 488 KB | Coin flip — tails |

Notes that affect authoring:

- **Life and mana tokens** draw at ~20 px and need a clear filled-vs-empty read. One file serves both states: empty pips render the same art desaturated at 32% opacity. Design the filled state, then check it still reads when greyed.
- **The two rings** must read clearly **over** artwork — they overlay cards during targeting. They replace a gold border-and-glow, and only take effect when *both* files are present.
- **`divider-rune.webp` is not wired yet.** The field divider's centre diamond is still painted procedurally; see §6.

---

## 6. Environment

**6 files · WebP**

| File | Size | Max | What it is |
|---|---|---|---|
| `src/assets/environment/meadow-backdrop.webp` | 3840 × 2160 | 8 MB | The painted battlefield — **the big one** |
| `src/assets/environment/terrain-color.webp` | 2048 × 2048 | 4 MB | Ground surface texture (tiling) |
| `src/assets/environment/terrain-normal.webp` | 2048 × 2048 | 4 MB | Ground normal map |
| `src/assets/environment/props-atlas.webp` | 2048 × 2048 | 4 MB | Trees, rocks, flowers sprite sheet |
| `src/assets/environment/water-normal.webp` | 1024 × 1024 | 2 MB | Stream ripple normals |
| `src/assets/environment/contact-shadow.webp` | 1024 × 1024 | 977 KB | Soft blob shadow under cards |

> **This family is not wired yet — dropping the files in changes nothing on screen.** The field is still generated procedurally, and `paintMeadowTexture()` bakes the slot marks, divider light-bleed, mow bands and river *into* the terrain canvas. Those are exactly the features the twelve measured §12 field gates read, so a backdrop has to be composited **beneath** them rather than replacing the canvas — and all twelve gate rows then have to be re-measured against the new render. That is the outstanding engineering work; it is worth authoring the art in parallel.

**The backdrop is the single highest-impact asset in the project.** Four rounds of blind critics rejected the procedurally generated field against a painted reference — every measurement passed while it still lost every comparison. This one file is what closes that gate, once the compositing work above is done.

Composition constraints from the accepted art bible:
- The camera is locked (30° FOV, 24.5° pitch) — the field reads as a shallow tabletop.
- Scenery occupies roughly the outer 10–15% on each edge; the center stays open for cards.
- The horizontal divider sits at **y ≈ 414** of 941 (about 44% down).
- One consistent light direction, warm, from the upper left.

---

## 7. Audio

**15 files · OGG Vorbis · ≤4 MB each (ambience ≤8 MB)**

The director **fails silently** on missing files, so the game works fine with zero audio. But the director and the manifest currently disagree, and **only 8 of these 15 are actually played**:

| File | When it plays |
|---|---|
| `src/assets/audio/summon.ogg` | Summoning a creature |
| `src/assets/audio/attack.ogg` | Attacking |
| `src/assets/audio/damage.ogg` | Taking damage |
| `src/assets/audio/heal.ogg` | Healing |
| `src/assets/audio/cast.ogg` | Casting a verse |
| `src/assets/audio/coin.ogg` | Coin flip |
| `src/assets/audio/victory.ogg` | You win |
| `src/assets/audio/defeat.ogg` | You lose |
| `src/assets/audio/ambience-meadow.ogg` | Looping background — **not wired** |
| `src/assets/audio/card-draw.ogg` | Drawing a card — **not wired** |
| `src/assets/audio/card-place.ogg` | Placing a card — **not wired** |
| `src/assets/audio/card-flip.ogg` | Revealing a face-down card — **not wired** |
| `src/assets/audio/trigger.ogg` | A set verse triggering — **not wired** |
| `src/assets/audio/ui-confirm.ogg` | Confirming an action — **not wired** |
| `src/assets/audio/ui-cancel.ogg` | Cancelling — **not wired** |

Separately, `AUDIO_SLOTS` in `src/presentation/audio-director.js` plays four names the manifest does not define — `ko.ogg`, `set.ogg`, `draw.ogg`, `turn.ogg` — so those are neither validated nor listed above.

Reconciling the two lists is a code fix, not an art problem. Until it lands, the seven unwired files buy nothing. **If you want audible results now, make the eight at the top of the table.**

---

## Wiring status

What the renderer does with each family today. "Wired" means dropping a file at its manifest path makes it appear in the game, with no code change:

| Family | Status |
|---|---|
| Frames | **Wired** |
| Backs | **Wired** |
| Card art | **Wired** — thumbnail on board/hand, detail in the overlay, JPEG fallback |
| Status icons | **Wired** |
| UI pieces | **Wired**, except `divider-rune.webp` |
| Environment | **Not wired** — field is procedural, see §6 |
| Audio | **Partly wired** — 8 of 15, see §7 |

## Priority order

If you're deciding what to make first, this is the order that unblocks the most:

1. **The 4 frames + 2 backs** — every card on screen uses them; six files transform the whole game, and they are fully wired today.
2. **Card art at 7:5** — 56 window illustrations. The existing folders are the wrong aspect, so this is regeneration rather than new work. Start with the Shadow deck (10 cards) since it's the default.
3. **Status icons and UI** — small, currently placeholder shapes, all wired.
4. **`meadow-backdrop.webp`** — the highest-impact single image, but it needs the §6 compositing work before it renders at all. Worth authoring in parallel with the above.
5. **Audio** — the eight wired slots only; the rest await the §7 reconciliation.

## Palette reference

From the accepted art bible, if you want the pieces to sit together:

| Role | Hex |
|---|---|
| Parchment | `#DCBA96` |
| Ink (text) | `#3B2317` |
| Gold (accents) | `#EEC34E` |
| Creature family | `#B47015` (amber) |
| Cast verse family | `#277A79` (teal) |
| Set verse family | `#6A5A66` (plum) |
| Card back | `#372F3F` (navy) |
| Meadow (upper) | `#C2AB4D` |
| Meadow (lower) | `#B3A74F` |
| Foliage | `#334B42` |

Nothing here is binding on you — if your art moves the palette, the measured gates get recalibrated to your art, not the other way around.

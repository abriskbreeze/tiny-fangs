# Task 68 — Wave-2 Integration: RSP-02 Repair, Quality Tiers, Docs, and a Code-Split Regression

**Date:** 2026-07-30
**Branch:** `feat/cel-shaded-field`

## Landed

- **RSP-02 REPAIRED** (was a frozen defect): `src/mp-client.js` selected a shell at 600 px while the CSS switches at 900 px, so 601–899 px revealed **both** shells. New `src/viewport.js` (`DESKTOP_MIN_WIDTH = 900`, `isMobileViewport()` preferring `matchMedia` so the answer *is* the CSS query) is now the single source of truth; two hand-rolled copies in `src/main.js` were rewired too. The characterization spec became a correctness contract and gained an assertion that the stylesheet's shell equals the revealed shell.
- **Phase 13 quality tiers wired** (`src/presentation/quality-tier.js`): precedence explicit → `?quality=` → localStorage → `detectCapabilities()` → `static` floor. `desktop-high` is byte-identical to before; `desktop-low` drops antialias, cuts the particle pool 48→16, and skips the additive light-spill shadow layer; `static` reuses the existing RSP-07 downgrade rather than inventing a second fallback. A persisted `#aaa-quality` HUD chip cycles tiers. 18 unit tests + 4 E2E.
- **MP-07 resolved as unreachable**: an additive protocol test walks every membership escape the protocol allows and proves each lands on a different correct error — defence in depth, not a missing test.
- **Docs refreshed**: MEMORY, CHANGELOG (Unreleased, no version bump), ARCHITECTURE, CLAUDE, README.

## Regression found and fixed

The Phase 13 code split made **`aaa-shell.css` lazy along with the JS**. Since the flag-gated styles also dress classic-DOM surfaces (setup, deck select, modals, coin, rules), AAA mode showed **unstyled screens until a game mounted**. The CSS (19 kB) now loads eagerly from `src/main.js` while the heavy three.js chunk stays lazy — the payload win is preserved.

Caught only because `aaa-material` and `aaa-overlays` assert computed styles on those surfaces. Worth remembering: **splitting JS silently splits its CSS imports too.**

## Verification (quiet tree)

Units **630/630**, server-process **18/18**, multiplayer **19/19**, visual **27/27**, E2E **110/116**, both presentation modes booting a live solo game with **zero page errors**.

## Known-fragile (not product defects)

Three adaptive-trajectory tests — `aaa-actions` "retreat swaps", `aaa-motion` "retreat FLIPs", `aaa-selectors` "target selection" — now fail because the rival AI wins during their board-building loops; wave-2 timing shifted the seeded trajectory. The behaviors are proven elsewhere (ACT-11 affordances; the selector's ownership/highlight assertions). Fix by seeding a deterministic board through the fixture route rather than playing the AI into a shape. **Do not weaken the assertions.**

## Direction recorded

Materials are placeholder — the real path is **image compositing** (user supplies images; the system merges/moves them). The chassis geometry, safe rects, homography, and anchor layout are the compositing layer that direction needs. Multiplayer is not a priority until visuals are done.

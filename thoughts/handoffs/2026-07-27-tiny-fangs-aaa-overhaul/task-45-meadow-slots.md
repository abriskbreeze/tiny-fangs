# Task 45 — Phase 7 Chunk 3: Zone Decals and Slot Marks

**Date:** 2026-07-29
**Branch:** `feat/cel-shaded-field`
**Scope:** Engraved slot marks at all twelve camera-lock anchor footprints, painted into the terrain at the §4.1 luminance band and measured per anchor.

## What was built

- The golden quadrilaterals (`camera-lock-v1`) are now consumed by the terrain painter: each anchor's face corners map through the ground plane into texture space and are stroked as an engraved footprint outline (≈1.8 screen px) with a small rune diamond at the center — the "engraved/rune board-zone decals" of the Phase 7 plan item.
- **Root-cause color math fix:** the §4.1 band (line luminance 1.15–1.35× surrounding grass) is a *linear-luminance* ratio; painting sRGB channels ×1.25 produced measured ratios of 1.37–1.62 (sRGB×1.25 ≈ linear×1.7). The painted factor is now gamma-adjusted (sRGB ×1.115 after an AA-attenuation calibration pass), landing every anchor at 1.157–1.247.
- Per-row grass base: opponent-row slots brighten the sunlit upper meadow color, player-row slots the lower meadow color, so the ratio holds against each slot's actual surroundings.
- New harness metric (`slotMarks`): peak line luminance across a probe at each anchor's top-edge midpoint vs grass sampled outside; new spec gate requires all 12 anchors inside 1.15–1.35.

## Measured

- Slot ratios: min 1.157 / max 1.247 across all 12 anchors (band 1.15–1.35).
- Every prior row unchanged and green: divider 76.3%/413.5/core 10, diamond 38×40, palette ΔE 0/0/1.41, ratio 0.184, frame extents 10.5–11.2%, quiet zone 0.03%, intrusion 0.

## Evidence

- Meadow spec **6 gates** green; visual project **24/24** (17 classic hashes byte-identical); units **601/601**. Render: `task-45-meadow-slots.png`.

## Next

Seeded ambient motion (wind/motes/fireflies with reduced-motion equivalents), canopy silhouette polish, static AVIF/WebP fallback, then the populated-board blind comparison vs R2.

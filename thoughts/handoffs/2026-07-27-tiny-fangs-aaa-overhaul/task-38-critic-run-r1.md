# Task 38 — Phase 2: First Blind Critic Run — REJECTED AS DESIGNED (Revision 1)

**Date:** 2026-07-28
**Branch:** `feat/cel-shaded-field`
**Scope:** The first two-fresh-critic blind review of the card-showcase golden samples. The gate ran cleanly at the protocol layer (zero P0/P1, packet fully reviewable — the failure mode that stalled the art-bible loop did not recur); the challenger was rejected on visual merit with a consistent, actionable correction list.

## Protocol

- Blind A/B set: all ten §13.3 card rectangles cut identically from R1 and the challenger capture, detail rows at exact 2× Lanczos; one sealed random mapping (commitment `18cce1c3…` in the packet index, mapping file git-ignored outside the packet). Challenger drew label **B**.
- Two fresh-context critics, independently, scored both sides on all seven §13.5 categories plus wow, stated per-crop preferences, and filed severity findings. Mapping unsealed only after both outputs existed. Verdict computed mechanically (`critic-verdict-r1.json`).

## Verdict — `gatePass: false`

| | Critic 1 | Critic 2 | Gate |
|---|---|---|---|
| Challenger T | 72.1 | 77.0 | ≥93.0 |
| Challenger wow | 6.4 | 6.9 | ≥9.0 |
| Min category | 5.8 (L) | 6.3 (L) | ≥9.0 |
| Challenger crop wins | 2/10 | 2/10 | ≥75% |
| P0/P1 | 0 | 0 | 0 ✓ |

Both critics preferred the challenger only on `card-title` and `card-rules` (typographic hierarchy). The reference side also failed both critics' gates (T 83.3 / 80.3, wow 8.2 / 8.3) — their shared read: "A is the art direction, B is the information system; the target is A's materials and grounding carrying B's typographic discipline."

## Consolidated correction list for revision 2 (both critics agree)

1. **Lighting/grounding is the anchor failure (L 5.8/6.3).** The dark void stage makes the (metrically passing) contact shadows invisible and denies the cards any ground plane. The showcase staging needs a lit, warm tabletop/meadow ground on which shadows actually read.
2. **Layer misregistration seams (P2, both critics):** art-aperture edge peeking past the creature card's mask; a green nameplate sliver behind the plate.
3. **Card back reads provisional/sparse (P2, critic 1):** the navy field needs richer, denser gold line work while keeping §7.6 limits.
4. **Material believability:** flat cel surfaces need tactile paper/print depth — grain that survives 2×, believable bevels, less vector-flat filigree.
5. **Wolf illustration anatomy still muddled (P3, both).**
6. **Flavor-text contrast where the footer approaches the colored rail (P3)** — a surface the current contrast metric row does not measure; extend the row rather than argue with the finding.
7. **Metric coverage gaps flagged by both critics (protocol feedback, not a gate change):** the shadow row passes while shadows are invisible in context, and the contrast row measures only ink-on-parchment. Both rows should measure *in-context visibility* in revision 2.

## Evidence

- `tests/visual/card-packet/critic-1-r1.json`, `critic-2-r1.json`, `critic-verdict-r1.json` (scores, per-crop preferences, findings, unsealed mapping).
- Sealed commitment verified: mapping file hash matches the pre-review commitment row.

## Next

Revision 2 implements the correction list (staging ground first — it is the largest single lever), re-runs the metric rows including the two extended coverage rows, and re-enters the blind gate with two new fresh critics.

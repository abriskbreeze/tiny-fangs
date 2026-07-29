# Task 37 — Phase 2: Card-Row Metric Report, Concentric Corners, Contact Shadows

**Date:** 2026-07-28
**Branch:** `feat/cel-shaded-field`
**Scope:** The §12 mandatory-measurement report for the card-showcase packet, plus the two real §12 violations it caught and their root-cause fixes. The packet now lacks only the sealed blind mapping; no critic gate is claimed.

## Two violations found by building the measurements — fixed, not papered over

1. **Corner construction (§12: concentric radius error ≤1 px).** The frame layers used decorative radii (13/11/5/3 px); concentric means outer radius minus cumulative inset (21 − 11.5 = 9.5; 21 − 14.5 = 6.5; deeper layers clamp to 0). Fixed in `cards.css`; the metric row now measures computed radii against the formula live.
2. **Showcase contact shadows (§12 stack/showcase row; §13.2 envelopes).** The specimens rendered no shadows at all. Each specimen now casts an envelope-contained radial shadow whose alpha-mass centroid sits at card centroid + (45, 70) px — inside the +20–100 / +50–90 windows at 57.3°, within the 55–75° key band — and fades out before every envelope edge. First measurement attempt failed on the card-back because the set card's shadow bled into its envelope; per §6.1 the method is **per-object ID masks**, so the harness gained a `?mode=shadow-mask&only=<specimen>` mode rendering one shadow alone, and all four specimens now measure in-window (fronts at +44.5/+69.5–70, 57.1–57.6°, zero edge leak).

## The metric report

`scripts/make_card_metrics.py` emits `tests/visual/card-packet/metric-report.json` (schema `tiny-fangs.card-metric-report.v1`) with nine machine-evaluated rows, none rounded up:

| Row | Method | Result |
|---|---|---|
| canonical-capture | 1672×941 / DPR1 / sRGB declared | PASS |
| palette-family-roles | 5×5 medians at family rail/panel samples vs §5 targets, full CIEDE2000 implementation | PASS (≤5 final tolerance) |
| cast-set-separation | CIEDE2000 between measured cast/set medians | PASS (≥12) |
| text-contrast | authored ink vs sampled parchment median | PASS (≥4.5:1) |
| corner-construction | computed radii vs outer-minus-inset | PASS (≤1 px) |
| showcase-shadow | per-object mask centroid/direction/containment | PASS |
| chassis-geometry-units | fresh vitest run, 16 contracts | PASS |
| chassis-browser-gates | fresh playwright run, 7 gates | PASS |
| provenance | live §13.8 verification | PASS |

`allPass: true`. The packet index attaches the report with its digest; `metric-report` row is `present`. Packet: **13 present / 1 unsupported** (`blind-mapping` — sealed A/B commitment lands with the critic run). The capture hash moved to `92244c40…` (shadows + concentric radii are real pixel changes); the runner's byte-identical double-capture determinism still holds.

## Evidence

- Metric run: 9/9 rows PASS, exit 0.
- Full suites after the visual changes: units **596/596**, visual **18/18** (7 chassis gates green under the new radii; 17 classic hashes byte-identical), desktop E2E **59/59**. Classic untouched.

## Next

Sealed A/B commitment + R1 comparison assets, then the two-fresh-critic blind run — the packet's last unsupported row.

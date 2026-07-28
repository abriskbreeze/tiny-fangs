# Task 35 — Phase 2: Deterministic Card-Showcase Packet Runner

**Date:** 2026-07-28
**Branch:** `feat/cel-shaded-field`
**Scope:** The reproducible packet infrastructure the blind critic gate requires. No critic has run and no gate is claimed.

## Scope decision (recorded, not hidden)

The bible defines only `camera-graybox` and `integrated-art` packet kinds, and `integrated-art` requires §13.1 populated-board fixtures, overlays, fallback and §13.9 performance tiers — none of which can exist before Phase 7. The plan's own phase order runs the golden-sample gate (Phase 2/5: ≥93 weighted per specimen, no category <9.0) long before the board exists, so the pre-board review runs as packetKind `card-showcase`: a plan-level construct that reuses the bible's §13.2 manifest, §13.3 card crop rows, and §13.7.2 hashing verbatim, and states in the packet itself that it is **not** the §13.5 integrated gate, which re-runs in full at Phase 14.

## What was built

**`scripts/make_card_packet.py`** (modeled on the camera bake-off runner):

1. Encodes the §13.2 `desktop-four-family` revision-1 manifest (all four specimens' centers, sizes, rotations, z, ordered corner quadrilaterals, shadow envelopes, crop ids) and computes `manifestSha256` under the §13.7.2 own-digest-omission rule; the hash is recomputed before every screenshot per §13.2 rule 4.
2. Captures `/showcase.html` at 1672 × 941 DPR 1 twice and **aborts unless the two PNGs are byte-identical**; run-to-run determinism was additionally proven across two independent runner invocations (same `captureSha256` both times).
3. Cuts all ten §13.3 card rows — `cards-full` at 1×, the nine detail crops at exact 2× Lanczos — with no crop-local grade/sharpen.
4. Writes a `tiny-fangs.critic-packet-index.v1` index with per-artifact sha256 rows and **honest statuses**: the §13.8 provenance index, the card-row metric report, and the sealed A/B commitment are `unsupported` rows with reasons. Per §13.5, unevaluated rows are failed rows — the packet is currently, deliberately, not passable, and the gate math will say so until those rows exist.

Current packet: `tests/visual/card-packet/` — `manifestSha256: 8df87b2c…`, `captureSha256: 20af8560…`, `indexSha256: 9957f15d…`, 10 crops.

## Evidence

- Two consecutive in-run captures byte-identical (runner-enforced) and two independent invocations byte-identical (`20af8560…`).
- 10/10 §13.3 card crops produced at correct native and output sizes.
- No production surface touched; suites unaffected.

## Next (in order, before any critic run can be meaningful)

1. **§13.8 provenance/motif index + signer registry** for the four authored art pieces — without it F/K are capped at 8.9 and the gate cannot pass.
2. **Card-row metric report** attached in packet form (chassis rows already green in suites; wire them into the packet).
3. R1 comparison assets + sealed A/B commitment, then the two-fresh-critic run.

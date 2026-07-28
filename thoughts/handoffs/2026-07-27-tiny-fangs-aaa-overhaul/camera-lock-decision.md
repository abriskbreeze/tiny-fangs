# Camera Lock Decision — Low-FOV Perspective

Date: 2026-07-28
Status: LOCKED per art bible §13.4 (unanimous two-critic pass on packet `camera-bakeoff-4`)

## Locked projection

- **Perspective**, vertical FOV **30°**, off-vertical pitch **24.5°**, camera distance **1950**
  world units, yaw/roll 0, aim at board center; implementation
  `src/presentation/scene/graybox-scene.js` `createCameraCandidate('P')`.
- Equal-object near/far scale ratio **1.0845** (inside the §3.3/§12 band 1.05–1.12).
- Golden quadrilaterals for all 12 board anchors (face + ground footprint):
  `tests/visual/baselines/camera-lock-v1/golden-quadrilaterals.json` (versioned, hashed).

## Blind protocol history

Four packet revisions, each reviewed by two brand-new context-clean critics; the mapping was
sealed outside every packet as a SHA-256 commitment and revealed only after scores.

| Round | Packet | Perspective scores | Ortho scores | Preference | Lock result |
|---|---|---|---|---|---|
| 1 | camera-bakeoff-1 | 87.4 / 90.05 | 74.5 / 79.85 | unanimous P | no (split pass; evidence gaps) |
| 2 | camera-bakeoff-2 | 88.3 / 88.25 | 82.5 / 77.05 | unanimous P | no (missing §12 numeric rows) |
| 3 | camera-bakeoff-3 | 91.45 / 90.6 | 85.85 / 83.5 | unanimous P | no (env-frame row failed both — measurement + massing fixed) |
| 4 | camera-bakeoff-4 | **92.1 / 92.3 — both singleCameraCriticPass TRUE** | 85.7 / 85.5 | **unanimous P** | **LOCKED** |

Round-4 mapping reveal: `tests/visual/bakeoff/sealed/mapping.json` (O→B, P→A) hashes to exactly
the committed `sha256:395a0623…`, verified after both critics submitted scores. All 27 packet
artifact hashes verified by both critics; determinism proven by byte-identical two-run captures
(SSIM 1.0), fixture/scene module hashes and git head recorded.

Per-round corrections (each from critic findings, none weakening a gate): face-quad calibration
to §3.1.1 traces; FOV 26→30 and distance 2400→1950 for convergence; numeric active/hand gap
evidence with hand-tuck solved to a fixed screen target; §12 numeric rows (anchor attestation,
divider evidence, environment-frame occupancy with a stated field-pixel method); continuous
perimeter band massing; determinism binding via rawCaptureSha256.

## Rationale (both round-4 critics, blind)

R2's six immutable traced quads show 1.97–4.91° side convergence and 0.889–0.954 top:bottom
compression. The perspective candidate reproduces both in the correct direction on all six quads
with lower residual mass (meanRMS 3.85 vs 4.98 px; 3/6 vs 4/6 outside propagated uncertainty)
and an in-band equal-object ratio; the orthographic candidate produces exactly zero of R2's
projection signature on every quad and reads as the elevation diagram §3.2 warns against.

## Post-lock follow-ups (from round-4 P2/P3 findings; none block the lock)

1. Optional convergence nudge for Q3/Q5/Q6 (currently −2.3 to −2.8° vs R2's strongest traces) —
   only within the locked FOV/pitch family and only if a later fidelity comparison wants it.
2. Deck allocation spill 12–13 px: widen deck allocations or trim stack proportions before
   final-art envelope gating.
3. Embed sRGB ICC profiles in captures rather than manifest declaration.
4. Record per-candidate rerun hash pairs explicitly in determinism evidence.
5. Ed25519 signing of this decision record awaits the §13.8.1 signer registry (not yet created;
   no production art exists). Until then this record plus the packet/sealed hashes above are the
   decision evidence.

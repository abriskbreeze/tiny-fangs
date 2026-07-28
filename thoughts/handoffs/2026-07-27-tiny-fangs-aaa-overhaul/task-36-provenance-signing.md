# Task 36 — Phase 2: §13.8 Signed Provenance with Independent Motif Review

**Date:** 2026-07-28
**Branch:** `feat/cel-shaded-field`
**Scope:** The §13.8/§13.8.1/§13.8.2 provenance chain for the four golden-sample art pieces, with a genuinely independent motif review. This unblocks the F/K category caps in the gate math; no critic gate is claimed.

## What was built

1. **`thoughts/shared/tiny-fangs-signers.json` (registry revision 1).** Two Ed25519 signer entries with distinct keys and roles: `creator-fable-agent` (the art author — this coding agent, identity disclosed) and `reviewer-fresh-agent` (an independent fresh-context review agent). Public keys and fingerprints only; private keys live outside the repository in `~/.tiny-fangs/signing/` (mode 600). Registry is append-only per §13.8.1.
2. **Independent motif review — actually performed, not rubber-stamped.** A fresh-context subagent with no authoring-session knowledge read R1/R2 (hashes verified against the bible: `4ecb53d5…`/`5229e89a…`), made close-up crops of the three highest-risk regions (R1 card back, R1 teal wisp window, R2 deck stacks), inspected every SVG path in the source line by line, and completed all 40 checklist rows (10 per asset): **34 distinct, 6 not-applicable, 0 similar-escalated**. Its most substantive findings: the manaSurge/R1-wisp comparison (no teardrop geometry anywhere in the asset — a symmetric spire vs R1's curling teardrop) and the back-sigil row-6 analysis (twin fangs vs crescent, double circles + compass ticks vs single open arc), with allowed §9.4 palette retention documented explicitly in row 9 of every asset. Review archived at `tests/visual/card-packet/provenance/motif-review.json`.
3. **`scripts/sign_provenance.mjs`.** Builds the four `tiny-fangs.asset-provenance.v1` records (identity with per-asset source hashes, disclosed-assisted-generation origin naming the agent and model with no image-generation model and no source layers, work-for-hire rights owned by the project owner, reference-use statement, and the reviewer's verbatim motif rows). Refuses to sign the reviewer attestation unless the reviewer output exists and approves with zero unresolved escalations. Signs both attestations as detached Ed25519 over the signatures-omitted canonical subject; hashes follow §13.7.2.
4. **`scripts/verify_provenance.mjs`.** Independent verifier: index digest, per-file digests, record digests, registry resolution (signer, fingerprint, role, validity window, active status), both signatures, distinct-signer rule, and motif-review completeness. Exit-code gated.
5. **Packet integration.** `make_card_packet.py` now runs the verifier live at packet build; the provenance row is `present` (with the verification report embedded) only when it passes. Rebuilt packet: capture hash unchanged (`20af8560…`), provenance index `cb44373a…`, 4 records signed and verified, registry revision 1 recorded.

## Honest status

- Packet rows now: 12 present, 2 unsupported (`metric-report`, `blind-mapping`) — still deliberately not passable until those exist.
- The creator/reviewer separation is two distinct registered keys held by two distinct agent contexts operated for the project owner. The bible's letter (different signer IDs, different keys, different roles, real independent comparison) is met; the user remains the ultimate acceptance authority and can revoke either key in the registry at any time.

## Next

1. Card-row metric report attached in packet form (chassis rows are already green in suites).
2. R1 comparison assets + sealed A/B commitment, then the two-fresh-critic run.

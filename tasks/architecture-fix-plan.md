# Architecture Fix Plan (v0.4.86 → cleanup)

## High priority

| ID | Task | Status |
|----|------|--------|
| H1 | Solo ↔ shared parity (AI poison, turnEnd) | DONE |
| H2 | Wire declarative triggers into engine | PARTIAL — matchesVerseTrigger uses triggerDef; full findMatchingTriggers for creatures still open |
| H3 | Unify getEffectiveAtk | DONE — abilities.js re-exports shared |
| H4 | Card truths (denMother, fangpup, Elusive) | DONE |

## Medium priority

| ID | Task | Status |
|----|------|--------|
| M1 | Mid-attack pendingAction resume | PARTIAL — bonuses/hasAttacked fixed; Cindermaw multi-hit resume still open |
| M2 | MP sticky flags + WS config | DONE |
| M3 | Delete/archive dead PeerJS client | DONE → archive/multiplayer-peerjs-legacy.js |
| M4 | Split main.js | IN PROGRESS |
| M5 | Shrink engine switches | PARTIAL — follows H2 |

## Low priority

| ID | Task | Status |
|----|------|--------|
| L1 | Docs sync | OPEN |
| L2 | DEBUG noise | DONE — gated on localStorage.tinyFangsDebug |
| L3 | Archive README | DONE |
| L4 | MP smoke test | OPEN |

## Verify
- `npm test` → **291 passing** (as of last run)

## Next loop ticks
1. Finish M4 — peel mp-client / event-playback / solo-ai from main.js
2. Finish M1 — Cindermaw resume after optional beforeDamage
3. Finish H2/M5 — creature DR via findMatchingTriggers
4. L1 docs + L4 smoke test

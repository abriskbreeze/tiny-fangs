# Architecture Fix Plan (v0.4.86 → cleanup)

## High priority

| ID | Task | Status |
|----|------|--------|
| H1 | Solo ↔ shared parity (AI poison, turnEnd) | DONE |
| H2 | Wire declarative triggers into engine | DONE — `shared/damage-reduction.js` + `findMatchingTriggers` for creature DR; Titanback DR declarative |
| H3 | Unify getEffectiveAtk | DONE — abilities.js re-exports shared |
| H4 | Card truths (denMother, fangpup, Elusive) | DONE |

## Medium priority

| ID | Task | Status |
|----|------|--------|
| M1 | Mid-attack pendingAction resume | DONE — Cindermaw Frenzy resumes after Brace/Swarm Shield |
| M2 | MP sticky flags + WS config | DONE |
| M3 | Delete/archive dead PeerJS client | DONE → archive/multiplayer-peerjs-legacy.js |
| M4 | Split main.js | DONE — `event-playback`, `solo-dispatch`, `mp-client`, `solo-ai`, `side-key` |
| M5 | Shrink engine switches | DONE — attack DR ID switches removed (cast/KO ID switches remain lower priority) |

## Low priority

| ID | Task | Status |
|----|------|--------|
| L1 | Docs sync | DONE |
| L2 | DEBUG noise | DONE — gated on localStorage.tinyFangsDebug |
| L3 | Archive README | DONE |
| L4 | MP smoke test | DONE — create-room OK; ws import fixed for Node ESM |

## Verify
- `npm test` → **294 passing**
- `npm run build` → OK
- MP: `cd server && node index.js` → WS create → `roomCreated`

## Remaining (optional follow-ups)
- Further shrink cast/KO creature ID switches in `attack()` (Echomask, Stormtalon, etc.)
- Prefer installing `ws` under `server/node_modules` so MP doesn't rely on a global `~/node_modules/ws`

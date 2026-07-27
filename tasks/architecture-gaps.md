# Architecture Gaps Analysis

## Current State (post M4 → M1 → H2/M5)

### ✅ Done
- Solo AI no longer double-applies poison; client `processTriggers('turnEnd')` removed after shared `endTurn`
- `getEffectiveAtk` unified — `src/abilities.js` re-exports shared
- denMother / fangpup / Whisper Elusive card truths aligned
- MP sticky flags + overridable WS URL; PeerJS archived
- **M4:** `main.js` peeled into `event-playback.js`, `solo-dispatch.js`, `mp-client.js`, `solo-ai.js`, `side-key.js`
- **M1:** Cindermaw Frenzy resumes remaining hits after optional beforeDamage (Brace / Swarm Shield)
- **H2/M5:** Creature DR via `shared/damage-reduction.js` + `findMatchingTriggers` (Ironhide, Pebbleback, Shellkin, Titanback, Hollowfox)

### ⚠️ Optional follow-ups
1. Further shrink cast/KO ID switches in `attack()` (Echomask, Stormtalon, Titanback death recoil, …)
2. Keep ARCHITECTURE / CARD-AUTHORING docs in sync as authoring patterns evolve

See `tasks/architecture-fix-plan.md` for status table.

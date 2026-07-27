# Architecture Gaps Analysis

## Current State (post architecture-fix pass)

### ✅ Done this pass
- Solo AI no longer double-applies poison; client `processTriggers('turnEnd')` removed after shared `endTurn`
- `getEffectiveAtk` unified — `src/abilities.js` re-exports shared
- denMother card text/handler aligned (deck summon on KO)
- fangpup `packCount * 10` evaluated in shared ATK
- Whisper Elusive blocks Set Verse damage while `summonedThisTurn`
- MP `usedLastBreath` / `usedManaSurge` pass through `getStateForPlayer`
- WS URL overridable via `?ws=` or `localStorage.tinyFangsWs`
- Legacy PeerJS client → `archive/multiplayer-peerjs-legacy.js`
- `matchesVerseTrigger` prefers declarative `triggerDef.event`
- Mid-attack optional: attack bonuses / `hasAttacked` fixed on respond

### ⚠️ Still open
1. **Creature abilities via `findMatchingTriggers`** — engine still special-cases many creature IDs in `attack()`
2. **Cindermaw + optional beforeDamage** — second hit resume after Swarm Shield/Brace still incomplete
3. **`src/main.js` split** — still ~3.6k LOC (mp / AI / UI mixed)
4. **Cast/trigger ID switches** — shrink further after creature matcher wiring
5. **Docs** — keep ARCHITECTURE/CARD-AUTHORING in sync (in progress)

See `tasks/architecture-fix-plan.md` for live checkbox status.

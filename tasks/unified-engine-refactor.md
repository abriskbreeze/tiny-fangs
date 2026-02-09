# Unified Game Engine Refactor Plan

## Goal
Single GameEngine that handles ALL game logic for both solo and multiplayer modes.

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GAME ENGINE                                  │
│              (runs locally OR on server)                        │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Actions    │  │   Triggers   │  │   Effects    │          │
│  │  - summon    │  │  - beforeAtk │  │  - damage    │          │
│  │  - attack    │  │  - onKO      │  │  - heal      │          │
│  │  - cast      │  │  - onSummon  │  │  - draw      │          │
│  │  - set       │  │  - turnEnd   │  │  - etc.      │          │
│  │  - retreat   │  │  - etc.      │  │              │          │
│  │  - endTurn   │  │              │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  Input: executeAction(state, playerIdx, action)                 │
│  Output: { state, events[], error? }                            │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
              ┌─────▼─────┐                 ┌─────▼─────┐
              │   SOLO    │                 │    MP     │
              │           │                 │           │
              │ GameEngine│                 │ GameEngine│
              │ runs in   │                 │ runs on   │
              │ browser   │                 │ server    │
              │           │                 │           │
              │ AI = P2   │                 │ P2 = human│
              └───────────┘                 └───────────┘
                    │                             │
                    └──────────────┬──────────────┘
                                   │
                            ┌──────▼──────┐
                            │   CLIENT    │
                            │             │
                            │ - Renders   │
                            │ - Animates  │
                            │ - Input     │
                            └─────────────┘
```

## Key Principles

1. **GameEngine is THE source of truth**
   - All game rules live here
   - No game logic in client (even for solo)

2. **Client is render-only**
   - Receives state → renders
   - Receives events → animates
   - User action → dispatchAction

3. **AI is just another player**
   - Makes decisions, calls executeAction
   - Runs after human ends turn
   - Same API as human player

4. **Events drive animations**
   - Every state change produces events
   - Client plays animations from events
   - Same for solo and MP

---

## Current State Analysis

### What GameEngine.js already has:
- ✅ createGame(deck1, deck2)
- ✅ executeAction(state, playerIdx, action) - basic structure
- ✅ summon - basic, some onSummon abilities
- ✅ attack - basic, some creature abilities (thorns, drain, etc.)
- ✅ endTurn - basic, poison, Broodmother spawn
- ✅ getStateForPlayer - hides opponent hand

### What's MISSING from GameEngine.js:

#### Cast Verses (14 total, only 3 implemented)
- ❌ ignite
- ❌ banish  
- ❌ bloodMoon
- ❌ soulSiphon
- ❌ graveEcho (selection required)
- ❌ sacrifice (selection required)
- ❌ callOfTheWild
- ❌ secondWind
- ❌ shellArmor
- ❌ regenerate
- ❌ fortify
- ❌ unbreakable
- ✅ darkPact
- ✅ predatorsMark
- ✅ manaSurge

#### Set Verse Triggers (10 total, 0 implemented)
- ❌ phantomWall (negate attack)
- ❌ spikeShield (damage attacker)
- ❌ brace (reduce damage)
- ❌ soulTrap (damage summoned)
- ❌ vengeance (survive KO, destroy attacker)
- ❌ graveRise (summon from grave on KO)
- ❌ manaDrain (negate spell)
- ❌ lastBreath (survive LP loss)
- ❌ denMother (summon on ally KO)
- ❌ swarmShield (reduce damage)

#### Creature Abilities (many, partially implemented)
- Some onSummon working (Duskfang, Emberfang, Hiveling)
- Some onHit working (Thorns, Drain, Poison, etc.)
- ❌ Bulwark (survive lethal)
- ❌ Broodmother spawn (partially working)
- ❌ Skitter (swap on damage)
- ❌ Many trigger-based abilities

#### Full Trigger System
- ❌ processTriggers equivalent
- ❌ Event emission (beforeAttack, onKO, etc.)
- ❌ Optional trigger prompts
- ❌ Priority ordering

---

## Implementation Phases

### Phase 1: Complete GameEngine (Highest Priority)

**Task 1A: Cast Verses**
- Implement all 11 missing cast verses
- Handle selection UI (graveEcho, sacrifice, ignite, banish)
- Return events for animations

**Task 1B: Set Verse Triggers**
- Implement trigger system
- Check triggers at appropriate points (beforeAttack, onKO, etc.)
- Handle optional triggers (player choice)
- Priority ordering for multiple triggers

**Task 1C: Creature Abilities**
- Complete all creature abilities
- Abilities that modify attack flow (Pulsefin, Cindermaw)
- Abilities that trigger on events (Duskfang, Gloom, etc.)

### Phase 2: Browser Integration

**Task 2A: ES Module Compatibility**
- Ensure GameEngine.js works in browser
- May need build step or dynamic import

**Task 2B: Solo Mode Refactor**
- Import GameEngine in client
- Create local game instance for solo
- Replace executeLocal* with GameEngine calls

### Phase 3: AI Integration

**Task 3A: AI as Player Module**
- Extract AI decision logic
- AI calls executeAction via GameEngine
- Run AI turn loop after human ends turn

**Task 3B: AI Turn Flow**
- GameEngine handles turn switching
- After human endTurn → signal client to run AI
- AI makes moves → client renders each

### Phase 4: Client Unification

**Task 4A: Unified dispatchAction**
- Solo: call local GameEngine
- MP: send to server
- Same response handling

**Task 4B: Unified State/Event Handling**
- Same state format for both modes
- Same event → animation mapping
- Remove all solo-specific rendering logic

---

## Critical Edge Cases

### 1. Selection Actions
Some actions require player selection:
- Grave Echo: choose creature from graveyard
- Sacrifice: choose creature to sacrifice
- Ignite/Banish: choose target creature

**Solution:** Two-phase action
```javascript
// Phase 1: Client shows selection UI
// Phase 2: Client sends action with selection
{ action: 'cast', cardUid: 'xxx', selection: 'targetCreatureUid' }
```

### 2. Optional Triggers
Some set verses are optional (player chooses to activate):
- Brace, Phantom Wall, Spike Shield, etc.

**Solution:** 
- Server returns `{ type: 'triggerPrompt', triggers: [...] }`
- Client shows prompt, player chooses
- Client sends `{ type: 'triggerResponse', triggerId, activate: true/false }`

### 3. Multiple Triggers
When multiple triggers could fire:
- Priority ordering (negate > reduce > standard)
- Non-active player fires first (defender advantage)

**Solution:** GameEngine orders triggers, processes in order

### 4. AI Trigger Decisions
AI needs to decide on optional triggers too

**Solution:** AI module has trigger decision logic

### 5. Desync Prevention
State must stay in sync

**Solution:**
- Client NEVER modifies state directly
- On stateUpdate, client REPLACES entire state
- Events tell client what to animate

### 6. State Format Consistency
Server uses `players[0]`, `players[1]`
Client uses `me`, `opp`

**Solution:** getStateForPlayer already handles this mapping

---

## File Changes

| File | Changes |
|------|---------|
| `server/GameEngine.js` | Complete all game logic |
| `server/triggers.js` | NEW - trigger processing |
| `server/effects.js` | NEW - effect execution |
| `server/ai.js` | NEW - AI decision making |
| `index.html` | Remove all game logic, keep only render/animate |
| `src/state.js` | Simplify - just state container |

---

## Success Criteria

1. ✅ All 262 existing tests pass
2. ✅ New tests for all GameEngine actions
3. ✅ Solo mode: human vs AI works
4. ✅ MP mode: human vs human works
5. ✅ Same behavior in both modes
6. ✅ All card effects work
7. ✅ All triggers work
8. ✅ AI makes reasonable decisions

---

## Subagent Task Breakdown

### Subagent 1: Cast Verses
- Implement all missing cast verses in GameEngine.js
- Add selection handling for Grave Echo, Sacrifice, Ignite, Banish
- Add tests

### Subagent 2: Trigger System
- Create trigger processor in GameEngine
- Implement all set verse triggers
- Handle optional triggers, priority ordering
- Add tests

### Subagent 3: Creature Abilities
- Complete all creature abilities
- Ensure events are emitted
- Add tests

### Main Agent (me): Integration
- Coordinate subagents
- Handle browser integration
- Refactor client to use GameEngine
- Wire up AI

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| GameEngine diverges from client | Port logic carefully, test extensively |
| Browser module compatibility | Test early, may need bundler |
| AI behavior changes | Compare AI decisions before/after |
| Trigger complexity | Port trigger system wholesale if needed |
| Selection UI complexity | Keep selection in client, just send result |

---

## Timeline Estimate

- Phase 1: 2 hours (3 subagents in parallel)
- Phase 2: 30 min
- Phase 3: 30 min  
- Phase 4: 30 min
- Testing: 30 min

**Total: ~4 hours**

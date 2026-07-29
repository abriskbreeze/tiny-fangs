# Tiny Fangs — Architecture Reference

**Version:** 0.4.87 (+ unreleased AAA presentation work on `feat/cel-shaded-field`)  
**Last Updated:** 2026-07-29

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TINY FANGS v0.4.87                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │   index.    │  │    src/     │  │   tests/    │  │   dist/    │  │
│  │   html      │  │  modules    │  │   *.test    │  │   build    │  │
│  │  (394 LOC)  │  │ (18 + pres) │  │  (42 files) │  │  (vite)    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  │
│         │                │                │                │        │
│         ▼                ▼                ▼                ▼        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     Game Runtime                             │   │
│  │  • State Management (state.js)                               │   │
│  │  • Game Logic (shared/engine.js)                             │   │
│  │  • Card Data (shared/cards.js)                               │   │
│  │  • Effects System (effects.js)                               │   │
│  │  • Trigger System (triggers.js, events.js)                   │   │
│  │  • AI System (ai.js, abilities.js)                           │   │
│  │  • Animation (anim.js)                                       │   │
│  │  • Rendering (render.js — classic; presentation/ — AAA)       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Module Dependency Graph

```
                    ┌──────────────┐
                    │  index.html  │
                    │  (Game Core) │
                    └──────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐      ┌─────────┐      ┌──────────┐
    │ state.js│◄─────│ cards.js│      │  anim.js │
    │ (global)│      │  (data) │      │  (async) │
    └────┬────┘      └────┬────┘      └────┬─────┘
         │                │                │
         │    ┌───────────┴───────────┐    │
         │    │                       │    │
         ▼    ▼                       ▼    ▼
    ┌─────────────┐             ┌─────────────┐
    │  helpers.js │             │  render.js  │
    │ (utilities) │             │   (DOM)     │
    └──────┬──────┘             └─────────────┘
           │
    ┌──────┴──────┬──────────────┬──────────────┐
    │             │              │              │
    ▼             ▼              ▼              ▼
┌────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐
│game.js │  │effects.js│  │triggers.js│  │   ai.js   │
│(damage)│  │(execute) │  │ (match)   │  │(decisions)│
└────────┘  └──────────┘  └─────┬─────┘  └─────┬─────┘
                                │              │
                                ▼              ▼
                          ┌──────────┐  ┌───────────┐
                          │events.js │  │abilities. │
                          │(emitter) │  │    js     │
                          └──────────┘  └───────────┘
```

---

## Data Flow

### Turn Cycle

```
┌─────────────────────────────────────────────────────────────────┐
│                        TURN CYCLE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌───────────┐     ┌───────────┐     ┌───────────┐            │
│   │  DRAW     │────▶│   MAIN    │────▶│   END     │            │
│   │  PHASE    │     │   PHASE   │     │   PHASE   │            │
│   └───────────┘     └─────┬─────┘     └─────┬─────┘            │
│        │                  │                 │                   │
│        ▼                  ▼                 ▼                   │
│   +1 card from       Player actions:     • Poison damage       │
│   deck to hand       • Summon creature   • turnEnd triggers    │
│   +1 mana (max 5)    • Attack            • Switch turns        │
│                      • Cast verse                              │
│                      • Set verse                               │
│                      • Retreat                                 │
│                                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Attack Resolution

```
┌─────────────────────────────────────────────────────────────────┐
│                    ATTACK RESOLUTION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. ──▶ beforeAttack triggers (Phantom Wall, Spike Shield)     │
│         │                                                       │
│         ├── attackNegated? ──▶ STOP                            │
│         │                                                       │
│  2. ──▶ Calculate base damage (getEffectiveAtk)                │
│         │                                                       │
│  3. ──▶ beforeDamage triggers (Brace, Shellkin, Ironhide)      │
│         │                                                       │
│         └── Apply damageReduction (perTurn flag support)       │
│                                                                 │
│  4. ──▶ Apply damage (applyDamage)                             │
│         │                                                       │
│  5. ──▶ checkLethalDamage()                                    │
│         │                                                       │
│         ├── Fortify buff? ──▶ Survive with 1 HP                │
│         ├── onLethalDamage triggers (Bulwark Fortress)         │
│         └── HP > 0? ──▶ Prevented, skip KO                     │
│         │                                                       │
│  7. ──▶ onHit triggers (Leechling Drain, Sundew Digest)        │
│         │                                                       │
│         └── Attacker sustain - heals BEFORE retaliation        │
│                                                                 │
│  8. ──▶ afterAttack triggers (Thornling, Hexweaver, Mireveil)  │
│         │                                                       │
│         └── Defender retaliation & status effects              │
│                                                                 │
│  9. ──▶ If HP ≤ 0:                                             │
│         │                                                       │
│         ├── beforeKO triggers (Vengeance)                      │
│         │   └── koNegated? ──▶ Skip KO                         │
│         │                                                       │
│         └── ko() ──▶ onKO triggers (Den Mother, Gloom)         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Leechling vs Thornling Example

```
┌─────────────────────────────────────────────────────────────────┐
│  SCENARIO: Leechling (10/20 HP, 15 ATK) attacks Thornling      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. beforeAttack ──▶ (no triggers)                             │
│  2. Calculate damage ──▶ 15                                    │
│  3. beforeDamage ──▶ (no reduction)                            │
│  4. Apply damage ──▶ Thornling takes 15                        │
│  5. onLethalDamage ──▶ (not lethal)                            │
│  6. Fortify ──▶ (none)                                         │
│                                                                 │
│  7. onHit ──▶ Leechling Drain triggers!                        │
│     ┌────────────────────────────────────────┐                 │
│     │ Drain heals 15 HP                      │                 │
│     │ Leechling: 10 → 25 HP                  │                 │
│     └────────────────────────────────────────┘                 │
│                                                                 │
│  8. afterAttack ──▶ Thornling Thorns triggers!                 │
│     ┌────────────────────────────────────────┐                 │
│     │ Thorns deals 10 damage                 │                 │
│     │ Leechling: 25 → 15 HP                  │                 │
│     └────────────────────────────────────────┘                 │
│                                                                 │
│  RESULT: Leechling survives at 15 HP ✓                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Event System

### Event Types

```
┌─────────────────────────────────────────────────────────────────┐
│                         EVENT TYPES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  COMBAT EVENTS                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │beforeAttack │  │beforeDamage │  │    onHit    │             │
│  │             │  │             │  │             │             │
│  │Phantom Wall │  │Brace        │  │Leechling    │             │
│  │Spike Shield │  │Swarm Shield │  │Sundew Queen │             │
│  │             │  │Shellkin     │  │(attacker    │             │
│  │             │  │Ironhide     │  │ sustain)    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  ┌─────────────┐                                               │
│  │ afterAttack │  ← Fires AFTER onHit                          │
│  │             │                                               │
│  │Thornling    │  (defender retaliation)                       │
│  │Hexweaver    │  (status effects)                             │
│  │Mireveil     │                                               │
│  │Coilshell    │                                               │
│  └─────────────┘                                               │
│                                                                 │
│  LETHAL/KO EVENTS                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │onLethalDmg  │  │  beforeKO   │  │    onKO     │             │
│  │             │  │             │  │             │             │
│  │Bulwark      │  │Vengeance    │  │Den Mother   │             │
│  │(Fortress)   │  │             │  │Gloom        │             │
│  │             │  │             │  │Grave Rise   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  LIFECYCLE EVENTS                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  onSummon   │  │   onCast    │  │beforeLifeLs │             │
│  │             │  │             │  │             │             │
│  │Soul Trap    │  │Mana Drain   │  │Last Breath  │             │
│  │Emberfang    │  │             │  │             │             │
│  │Duskfang     │  │             │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  TURN EVENTS                                                    │
│  ┌─────────────┐  ┌─────────────┐                              │
│  │  turnEnd    │  │ afterDamage │                              │
│  │             │  │             │                              │
│  │Broodmother  │  │Skitter      │                              │
│  │(Spawn)      │  │(Scurry)     │                              │
│  └─────────────┘  └─────────────┘                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Priority System

```
┌─────────────────────────────────────────────────────────────────┐
│                     TRIGGER PRIORITY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Priority 1 ──▶ Negate other triggers                          │
│  Priority 2 ──▶ Negate actions (negateAttack, negateSpell)     │
│  Priority 3 ──▶ Pre-modification (reduceDamage)                │
│  Priority 4 ──▶ Standard effects (default)                     │
│  Priority 5 ──▶ Post-event reactions                           │
│                                                                 │
│  TIEBREAKER: Same priority → defender fires first              │
│                                                                 │
│  Example: Brace (P3) vs Spike Shield (P2)                      │
│  ┌──────────────────────────────────────────┐                  │
│  │  1. Spike Shield fires (P2) - attacker   │                  │
│  │     takes 15 damage                      │                  │
│  │  2. If attack continues...               │                  │
│  │  3. Brace fires (P3) - reduce damage 15  │                  │
│  └──────────────────────────────────────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Effect System

### Effect Primitives

```
┌─────────────────────────────────────────────────────────────────┐
│                     EFFECT PRIMITIVES                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DAMAGE/HEAL                                                    │
│  ├── damage(target, amount)     Deal damage to creature        │
│  ├── heal(target, amount)       Restore HP (capped at max)     │
│  ├── aoeAll(amount)             Damage all creatures           │
│  └── destroy(target)            KO without damage              │
│                                                                 │
│  RESOURCES                                                      │
│  ├── gainMana(amount)           +mana (capped at 5)            │
│  ├── loseLife(amount)           -LP to player                  │
│  └── draw(count)                Draw cards from deck           │
│                                                                 │
│  STATUS                                                         │
│  ├── setStatus(target, status)  Apply poison/stun/etc          │
│  ├── cureStatus(target)         Remove status                  │
│  ├── atkBonus(amount)           Temporary ATK boost            │
│  └── setFlag(target, flag)      Set creature flag              │
│                                                                 │
│  MOVEMENT                                                       │
│  ├── moveCard(from, to)         Move card between zones        │
│  ├── summon(creatureId)         Summon from definition         │
│  ├── summonFromGrave(filter)    Summon from graveyard          │
│  ├── summonToken(token)         Create token creature          │
│  ├── swapWithBench(index)       Swap active ↔ bench            │
│  └── banish(target)             Remove from game               │
│                                                                 │
│  NEGATION                                                       │
│  ├── negateAttack()             Cancel attack resolution       │
│  ├── negateSpell()              Cancel cast verse              │
│  ├── negateKO()                 Prevent creature death         │
│  ├── negateLifeLoss()           Prevent LP loss                │
│  └── reduceDamage(amount)       Reduce incoming damage         │
│                                                                 │
│  SPECIAL                                                        │
│  ├── setHP(target, amount)      Set HP to specific value       │
│  └── markUsed(flag)             Set once-per-game flag         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Effect Resolution

```
┌─────────────────────────────────────────────────────────────────┐
│                    EFFECT RESOLUTION                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Card Definition:                                               │
│  ┌────────────────────────────────────────────┐                │
│  │  soulSiphon: {                             │                │
│  │    effects: [                              │                │
│  │      { type: 'damage',                     │                │
│  │        target: 'opp.active',               │                │
│  │        amount: 20,                         │                │
│  │        condition: 'opp.active' },          │                │
│  │      { type: 'heal',                       │                │
│  │        target: 'me.active',                │                │
│  │        amount: 10,                         │                │
│  │        condition: 'me.active' }            │                │
│  │    ]                                       │                │
│  │  }                                         │                │
│  └────────────────────────────────────────────┘                │
│                       │                                         │
│                       ▼                                         │
│  ┌────────────────────────────────────────────┐                │
│  │  processEffects(card, ctx)                 │                │
│  │  ├── For each effect:                      │                │
│  │  │   ├── Check condition                   │                │
│  │  │   ├── Resolve target                    │                │
│  │  │   ├── Execute effect                    │                │
│  │  │   └── Collect KOs                       │                │
│  │  └── Return { kos: [...] }                 │                │
│  └────────────────────────────────────────────┘                │
│                       │                                         │
│                       ▼                                         │
│  ┌────────────────────────────────────────────┐                │
│  │  Handle KOs:                               │                │
│  │  for (ko of result.kos) {                  │                │
│  │    await ko(creature, owner);              │                │
│  │  }                                         │                │
│  └────────────────────────────────────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## AI System

### Decision Tree

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI DECISION FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────┐               │
│  │            getAllMoves(ai, player)          │               │
│  │  ├── Summon to active (if empty)            │               │
│  │  ├── Summon to bench (if room)              │               │
│  │  ├── Attack (if active exists)              │               │
│  │  ├── Cast verse (if affordable)             │               │
│  │  ├── Set verse (if slot empty)              │               │
│  │  └── Pass turn                              │               │
│  └─────────────────┬───────────────────────────┘               │
│                    │                                            │
│                    ▼                                            │
│  ┌─────────────────────────────────────────────┐               │
│  │           scoreMove(move, ai, player)       │               │
│  │                                             │               │
│  │  summon-active:  100 + survival bonus       │               │
│  │  summon-bench:   40 + HP/ATK bonus          │               │
│  │  attack:         50 + KO bonus - trap fear  │               │
│  │  cast-verse:     context-specific (0-100+)  │               │
│  │  set-verse:      30-60 (defensive value)    │               │
│  │  pass:           0                          │               │
│  └─────────────────┬───────────────────────────┘               │
│                    │                                            │
│                    ▼                                            │
│  ┌─────────────────────────────────────────────┐               │
│  │          pickBestMove(moves, threshold)     │               │
│  │  • Threshold = 10                           │               │
│  │  • Pick highest score above threshold       │               │
│  │  • If none above threshold, pass            │               │
│  └─────────────────┬───────────────────────────┘               │
│                    │                                            │
│                    ▼                                            │
│  ┌─────────────────────────────────────────────┐               │
│  │              executeMove(move)              │               │
│  │  • Dispatch based on move.kind              │               │
│  │  • Await animations                         │               │
│  │  • Loop until pass is best                  │               │
│  └─────────────────────────────────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### AI Difficulty Levels

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI DIFFICULTY LEVELS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Level 1: PUP (aiTurnPup)                                       │
│  ├── Simple heuristics                                          │
│  ├── No verse evaluation                                        │
│  └── Basic summon/attack loop                                   │
│                                                                 │
│  Level 2: HUNTER (aiTurnHunter) ← DEFAULT                       │
│  ├── Full move scoring                                          │
│  ├── Verse evaluation                                           │
│  ├── Trap awareness                                             │
│  └── Self-preservation (Blood Moon)                             │
│                                                                 │
│  Level 3: ALPHA (planned)                                       │
│  ├── Multi-turn planning                                        │
│  ├── Combo detection                                            │
│  └── Opponent hand tracking                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Card System

### Card Types

```
┌─────────────────────────────────────────────────────────────────┐
│                       CARD TYPES                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CREATURES (29 total)                                           │
│  ┌────────────────────────────────────────────┐                │
│  │  {                                         │                │
│  │    id: 'whisper',                          │                │
│  │    name: 'Whisper',                        │                │
│  │    subtitle: 'Shadow Cat',                 │                │
│  │    cost: 1,                                │                │
│  │    hp: 30,                                 │                │
│  │    atk: 20,                                │                │
│  │    ability: {                              │                │
│  │      name: 'Elusive',                      │                │
│  │      text: 'Cannot be targeted.',          │                │
│  │      passive: { type: 'elusive' }          │                │
│  │    },                                      │                │
│  │    flavor: '"Now you see me..."',          │                │
│  │    art: ' /\\_/\\\n( o.o )\n > ^ <'        │                │
│  │  }                                         │                │
│  └────────────────────────────────────────────┘                │
│                                                                 │
│  CAST VERSES (10 total)                                         │
│  ┌────────────────────────────────────────────┐                │
│  │  {                                         │                │
│  │    id: 'ignite',                           │                │
│  │    name: 'Ignite',                         │                │
│  │    type: 'cast',                           │                │
│  │    cost: 1,                                │                │
│  │    text: 'Deal 15 damage to enemy.',       │                │
│  │    requiresTarget: true,                   │                │
│  │    effects: [                              │                │
│  │      { type: 'damage',                     │                │
│  │        target: 'selected',                 │                │
│  │        amount: 15 }                        │                │
│  │    ]                                       │                │
│  │  }                                         │                │
│  └────────────────────────────────────────────┘                │
│                                                                 │
│  SET VERSES (10 total)                                          │
│  ┌────────────────────────────────────────────┐                │
│  │  {                                         │                │
│  │    id: 'brace',                            │                │
│  │    name: 'Brace',                          │                │
│  │    type: 'set',                            │                │
│  │    cost: 1,                                │                │
│  │    text: 'Reduce next attack by 15.',      │                │
│  │    triggerDef: {                           │                │
│  │      event: 'beforeDamage',                │                │
│  │      condition: { target: 'me.active' },   │                │
│  │      optional: true                        │                │
│  │    },                                      │                │
│  │    effects: [                              │                │
│  │      { type: 'reduceDamage', amount: 15 }  │                │
│  │    ]                                       │                │
│  │  }                                         │                │
│  └────────────────────────────────────────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Ability Types

```
┌─────────────────────────────────────────────────────────────────┐
│                      ABILITY TYPES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PASSIVE (calculated, not triggered)                            │
│  ┌────────────────────────────────────────────┐                │
│  │  ability: {                                │                │
│  │    passive: {                              │                │
│  │      type: 'atkMod',     // Modify ATK     │                │
│  │      amount: 15,                           │                │
│  │      condition: 'noAllyActive'             │                │
│  │    }                                       │                │
│  │  }                                         │                │
│  └────────────────────────────────────────────┘                │
│  Examples: Shade Pup (Orphan), Bladewhisker (Rend)             │
│                                                                 │
│  TRIGGERED (event-driven)                                       │
│  ┌────────────────────────────────────────────┐                │
│  │  ability: {                                │                │
│  │    trigger: {                              │                │
│  │      event: 'afterAttack',                 │                │
│  │      condition: { defender: 'self' }       │                │
│  │    },                                      │                │
│  │    effects: [                              │                │
│  │      { type: 'damage',                     │                │
│  │        target: 'attacker',                 │                │
│  │        amount: 10 }                        │                │
│  │    ]                                       │                │
│  │  }                                         │                │
│  └────────────────────────────────────────────┘                │
│  Examples: Thornling (Thorns), Emberfang (Ignite)              │
│                                                                 │
│  PROCEDURAL (hardcoded, complex game flow)                      │
│  ┌────────────────────────────────────────────┐                │
│  │  ability: {                                │                │
│  │    procedural: true,                       │                │
│  │    // Logic in index.html                  │                │
│  │  }                                         │                │
│  └────────────────────────────────────────────┘                │
│  Examples: Cindermaw (Frenzy), Pulsefin (Sonic Strike)         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Management

### Game State Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                      GAME STATE (state.G)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  state.G = {                                                    │
│    turn: 1,              // Current turn number                 │
│    myTurn: true,         // Is it player's turn?                │
│    winner: null,         // null | 'Player' | 'Rival'           │
│    log: [],              // Game event log                      │
│    aiDifficulty: 2,      // 1=Pup, 2=Hunter, 3=Alpha           │
│                                                                 │
│    me: {                 // Player state                        │
│      lp: 3,              // Life points (hearts)                │
│      mana: 1,            // Current mana                        │
│      hand: [...],        // Cards in hand                       │
│      deck: [...],        // Cards in deck                       │
│      grave: [...],       // Graveyard                           │
│      active: null,       // Active creature                     │
│      bench: [],          // Bench creatures (max 2)             │
│      setVerse: null,     // Set verse slot                      │
│      attackBonuses: [],  // Temp ATK bonuses                    │
│    },                                                           │
│                                                                 │
│    opp: { ... }          // Same structure as me                │
│  }                                                              │
│                                                                 │
│  state.selectedCard = null;  // Currently selected card         │
│  state.startTime = null;     // Game start timestamp            │
│  state.timerInt = null;      // Timer interval ID               │
│  state.longPressTimer = null; // Touch long-press timer         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Creature Instance

```
┌─────────────────────────────────────────────────────────────────┐
│                    CREATURE INSTANCE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  creature = {                                                   │
│    // From template                                             │
│    id: 'whisper',                                               │
│    name: 'Whisper',                                             │
│    hp: 30,              // Max HP                               │
│    atk: 20,             // Base ATK                             │
│    cost: 1,                                                     │
│    ability: { ... },                                            │
│                                                                 │
│    // Runtime state                                             │
│    cardType: 'creature',                                        │
│    uid: 'abc1234',      // Unique instance ID                   │
│    curHp: 30,           // Current HP                           │
│    status: null,        // 'poison' | 'stun' | null             │
│    firstAtk: true,      // For Pulsefin double damage           │
│                                                                 │
│    // Ability flags (set by markUsed effect)                    │
│    fortressUsed: false, // Bulwark one-time save                │
│    fortified: false,    // Fortify verse buff                   │
│    shielded: false,     // Unbreakable verse buff               │
│  }                                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Animation System

### Timing Constants

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANIMATION TIMING                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ANIM_TIMING = {                                                │
│    attack: 500,      // Attack animation                        │
│    damage: 400,      // Damage flash                            │
│    ko: 600,          // KO animation                            │
│    draw: 300,        // Card draw                               │
│    summon: 400,      // Summon to field                         │
│    benchToActive: 400,  // Bench replacement                    │
│    setVerse: 300,    // Set verse placement                     │
│    versePopup: 800,  // Verse name popup                        │
│    hitDelay: 0,      // Delay before hit effects                │
│    hitFlash: 200,    // Red flash duration                      │
│    hitReaction: 300, // Tilt wobble duration                    │
│  }                                                              │
│                                                                 │
│  All animations return Promises for sequencing:                 │
│  await Anim.attack('me', 'opp', 20);                           │
│  await Anim.damage('opp', 20);                                 │
│  await Anim.ko('opp');                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Presentation Modes (Classic + AAA)

Rendering is split behind a presentation flag. **Classic** — the ASCII board in
`src/render.js` + `src/styles.css` — remains the default and is fully playable.
**AAA** is an opt-in 3D presentation living entirely under `src/presentation/`.

Presentation code is *presentation only*: it never mutates game state, and every
affordance delegates to the same dispatch functions the classic buttons call, so
`shared/engine.js` stays the only rules authority.

### Flag resolution and routing

```
resolvePresentationMode()          src/presentation/presentation-mode.js
   ?presentation=aaa|classic       (1) query string wins
   localStorage                    (2) 'tinyFangs.presentation.mode'
   'classic'                       (3) default
        │
        ▼
applyPresentationMode()  →  <html data-presentation="classic|aaa">
        │
        ▼
src/main.js :: render()  →  renderAaaShell()          [only when data-presentation="aaa"]
        │
        ├── lazy import('./presentation/aaa-shell.js')   ← code-split; classic never fetches it
        ├── createAaaShell({ actions: { doSummon, doCast, doSet,
        │                    doAttack, doRetreat, endTurn, ... } })
        ├── shell.update(state.G, { selectedCard })
        └── mirrors updateButtons() disabled state onto the AAA action rail
```

**RSP-07 downgrade (fail-safe).** The AAA CSS hides the classic shells, so a
silent failure would leave a dead screen. Both failure paths in
`src/main.js::renderAaaShell` therefore rewrite `data-presentation` back to
`classic` and hide `#aaa-stage`, handing rendering fully to the classic
renderer:

| Failure | Handling |
|---------|----------|
| Lazy chunk fails to load | `catch` → downgrade to `classic`, hide `#aaa-stage` |
| Scene fails to mount (no WebGL, context loss, scene error) | `!aaaShell.mounted` → downgrade to `classic`, drop the shell |

### Quality tiers

`capabilities.js` detects WebGL, reduced motion, save-data and low memory and
derives a tier; `quality-tier.js` resolves the active one with the same
precedence shape as the presentation flag:

```
HUD chip's session pick  →  ?quality=  →  localStorage
  'tinyFangs.presentation.quality'      →  detectCapabilities()  →  'static'
```

| Tier | Scene | Antialias | Particle cap | Light spill |
|------|-------|-----------|--------------|-------------|
| `desktop-high` | yes | yes | 48 | yes |
| `desktop-low` | yes | no | 16 | no |
| `static` | no | no | 0 | no |

Every step is total — an invalid or unreadable value is ignored rather than
thrown, and detection failure lands on `static`, which is always playable
because it renders no scene at all. Changing the tier **rebuilds** the shell
(a WebGL renderer cannot change antialiasing in place); board state is untouched
because the shell renders purely from `state.G`, and a `static` pick simply
fails to mount and takes the RSP-07 path above.

Shell selection has its own single source of truth in `src/viewport.js`:
`DESKTOP_MIN_WIDTH = 900` mirrors the `@media (min-width: 900px)` shell queries
in `src/styles.css`, so JS can never disagree with the stylesheet about which
shell is visible.

### Module map (`src/presentation/`)

| Path | Role |
|------|------|
| `presentation-mode.js` | Flag resolution + `data-presentation` application |
| `aaa-shell.js` / `aaa-shell.css` | The live AAA shell: meadow, board cards, quiet edge rails, action rail, FLIP motion, particle/audio seams |
| `presentation-coordinator.js` | Optional scene lifecycle: mount, idempotent updates on deep snapshots (no mutable engine refs), full disposal, failure containment |
| `capabilities.js` | WebGL / reduced-motion / save-data / memory detection |
| `quality-tier.js` | Tier resolution (`?quality=` / storage / detection), profiles, HUD chip cycling |
| `board-layout.js` | Board anchor layout constants |
| `particle-pool.js` | Fixed-cap pooled DOM sparks (summon/damage/heal/KO); pointer-transparent; suppressed under reduced motion |
| `audio-director.js` | Semantic audio slots, first-gesture unlock, persisted mute/volume, fail-silent on missing files |
| `scene/` | Three.js meadow (`meadow-scene.js`, `meadow-props.js`), `golden-quads.js`, and the standalone harness pages (`meadow-page`, `board-page`, `graybox-page`, `composite-page`) |
| `cards/` | Card chassis: `chassis-geometry.js`, `card-face.js`, `cards.css`, `showcase-page.js`, `art/` |
| `dom/` | `keyed-board-view.js` (uid-keyed reconciler), `html-keyed-view.js`, `board-card-mount.js`, `quad-transform.js` (homography), `target-registry.js` |
| `assets/` | Face manifest + draft/release validation, template face map, runtime face samples |
| `testing/` | Deterministic fixtures, stable serialization, capture manifest, `__TINY_FANGS_VISUAL_READY__` readiness |

### Camera lock and golden quads

The camera is a **decision record**, not a live value: low-FOV perspective,
FOV 30°, pitch 24.5°, distance 1950, at the canonical 1672 × 941 reference
frame. The twelve board anchors' screen-space quadrilaterals are frozen in
`tests/visual/baselines/camera-lock-v1/golden-quadrilaterals.json` and
transcribed at full float precision into
`src/presentation/scene/golden-quads.js` — 4-decimal rounding was measured to
shift slot-mark antialiasing and break byte-identity gates.

`dom/quad-transform.js` solves the 8-DOF projective homography that maps the
333 × 505 DOM card chassis onto a golden quad via CSS `matrix3d`, so DOM text
and controls share one geometry with the Three.js decals and shadows.

### Semantic target registry + Anim seam

```
src/anim.js  ──▶  createTargetRegistry()  ──▶  live DOM element | null
                  src/presentation/dom/target-registry.js
```

Animations resolve **semantic, side-relative names** (`me.active`,
`opp.bench.1`, `me.life`, `me.mana`) instead of brittle selector lists.
Resolution is shell-aware — classic desktop `d-*` ids, classic mobile `m-*`
ids, and explicit `registerElement` entries from the AAA shell, which always
win. Resolution is lazy (never cached across renders); an unknown or missing
name resolves to `null`, which the Anim facade already treats as a safe no-op.
This is what lets the *entire* classic event vocabulary (damage / heal / KO /
bench / LP accents, float text, screen flash) play into the AAA shell with no
changes to `src/event-playback.js`.

Card identity is uid-keyed (`dom/keyed-board-view.js`): create / patch / move /
remove with stable DOM nodes across zone moves, so FLIP motion animates the same
node from hand to board.

### Testing surfaces

| Surface | Where | What it covers |
|---------|-------|----------------|
| Unit | `tests/presentation/*.test.js` | Flag resolution, coordinator, registry, keyed views, chassis geometry, manifest, audio, readiness |
| E2E — AAA | `tests/e2e/aaa-*.spec.js` | shell, actions, cards, status, selectors, overlays, material, motion, effects, garnish, polish, affordances, **fallback** (WebGL blocked → real classic turn) |
| E2E — classic | `tests/e2e/classic-*.spec.js`, `topology`, `solo-setup`, `timer-lifecycle`, `desktop-overlay-results` | Classic regression, input, responsive |
| Multiplayer | `tests/e2e/multiplayer/*.spec.js` | Privacy, authority, owner responses, deck parity, lifecycle |
| Visual (§12) | `tests/visual/*.visual.spec.js` | Classic capture byte-identity, meadow field metrics, card chassis, populated board, graybox, compositing spike |
| Harness pages | `meadow.html`, `board.html`, `graybox.html`, `showcase.html`, `composite.html` | Standalone routes the visual suites drive |

Run them with `npm run test:e2e`, `npm run test:multiplayer`, `npm run test:visual`
(or `npm run test:presentation` for the full chain).

---

## File Structure

```
tiny-fangs/
├── index.html          # HTML structure + setup screens + #aaa-stage (394 LOC)
├── VERSION             # Current version (v0.4.87)
├── CHANGELOG.md        # Version history
├── ARCHITECTURE.md     # This file
├── MEMORY.md           # Project memory
├── README.md           # Quick start
│
├── shared/             # Single source of truth (client + server)
│   ├── cards.js        # Card definitions (29 creatures, 26 verses, 5 decks)
│   ├── effects.js      # Effect primitives (28 types) + processEffects
│   ├── triggers.js     # Trigger matching (priority-based)
│   ├── damage-reduction.js # Declarative creature DR (findMatchingTriggers)
│   ├── engine.js       # Core game ops + executeAction
│   └── index.js        # Re-exports
│
├── src/                # Client modules
│   ├── main.js         # UI shell + wiring (~2.7k LOC after peel)
│   ├── event-playback.js # Engine events → Anim/log
│   ├── solo-dispatch.js  # Solo executeAction bridge
│   ├── solo-ai.js        # Pup/Hunter AI turns
│   ├── mp-client.js      # WebSocket multiplayer client
│   ├── side-key.js       # Engine side → me/opp
│   ├── viewport.js       # Shell selection rules (RSP-02, 900px)
│   ├── presentation/     # Opt-in AAA presentation (see above)
│   │   ├── presentation-mode.js   # Flag: classic (default) | aaa
│   │   ├── aaa-shell.js / .css    # The live AAA shell
│   │   ├── presentation-coordinator.js, capabilities.js, quality-tier.js
│   │   ├── board-layout.js
│   │   ├── particle-pool.js, audio-director.js
│   │   ├── scene/        # Three.js meadow + harness pages
│   │   ├── cards/        # Card chassis, faces, showcase
│   │   ├── dom/          # Keyed views, homography, target registry
│   │   ├── assets/       # Face manifest + validation
│   │   └── testing/      # Deterministic fixtures + readiness
│   ├── styles.css      # All classic CSS (~2,882 LOC)
│   ├── cards.js        # Re-exports from shared/cards.js
│   ├── effects.js      # Shared effects + animation layer
│   ├── triggers.js     # Client trigger processing + UI prompts
│   ├── state.js        # Global state singleton
│   ├── game.js         # Client helpers (applyDamage, createCreature)
│   ├── helpers.js      # Utility functions
│   ├── events.js       # Simple event emitter
│   ├── ai.js           # Hunter AI scoring
│   ├── abilities.js    # ATK/DR display helpers (combat ATK → shared)
│   ├── anim.js         # ASCII animations (Promise-based)
│   └── render.js       # DOM rendering
│
├── archive/
│   └── multiplayer-peerjs-legacy.js  # Dead PeerJS client
│
├── server/             # Multiplayer
│   ├── index.js        # WebSocket room server (port 3001)
│   ├── GameEngine.js   # Thin wrapper → shared/engine.js (149 LOC)
│   └── utils.js        # Server helpers
│
├── guides/             # Documentation
│   ├── CARD-AUTHORING.md   # How to add cards
│   └── EVENT-SYSTEM.md     # Event system details
│
├── tests/              # Vitest units (630 tests, 42 files)
│   ├── presentation/   # AAA presentation unit contracts
│   ├── e2e/            # Playwright: aaa-*, classic-*, multiplayer/
│   ├── visual/         # Playwright §12 visual gates + baselines
│   └── server/         # Engine wrapper + server-process (separate config)
├── scripts/            # Asset/packet/provenance tooling + bump.sh
├── dist/               # Built output (GitHub Pages)
├── thoughts/           # Working ledger + task handoffs
└── tasks/              # Planning docs
```

---

## Multiplayer Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       MULTIPLAYER NETWORK FLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   PLAYER 1 (Host)                    PLAYER 2 (Guest)                   │
│   ┌─────────────┐                    ┌─────────────┐                   │
│   │   Browser   │                    │   Browser   │                   │
│   │  index.html │                    │  index.html │                   │
│   └──────┬──────┘                    └──────┬──────┘                   │
│          │ WebSocket                        │ WebSocket                 │
│          ▼                                  ▼                           │
│   ┌─────────────────────────────────────────────────────┐              │
│   │                    SERVER (Node.js)                  │              │
│   │                                                      │              │
│   │   Room Manager ──▶ Shared Engine ──▶ Broadcast       │              │
│   │                                                      │              │
│   └─────────────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Shared Module Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SHARED MODULE (shared/)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│   │  cards.js   │  │ effects.js  │  │ triggers.js │  │  engine.js  │  │
│   │  (29 crea-  │  │ (28 effect  │  │ (priority   │  │ (core game  │  │
│   │   tures,    │  │  primitives)│  │  matching)  │  │  operations)│  │
│   │  26 verses) │  │             │  │             │  │             │  │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│          └─────────────────┴─────────────────┴─────────────────┘        │
│                                    │                                    │
│                            ┌───────┴───────┐                           │
│                            │   index.js    │                           │
│                            │ (31 exports)  │                           │
│                            └───────────────┘                           │
│                                    │                                    │
│              ┌─────────────────────┼─────────────────────┐             │
│              ▼                                           ▼             │
│   ┌─────────────────────┐                   ┌─────────────────────┐   │
│   │   CLIENT (Browser)  │                   │   SERVER (Node.js)  │   │
│   │  + Animation layer  │                   │  + WebSocket layer  │   │
│   └─────────────────────┘                   └─────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Single Source of Truth

The `shared/` module embodies a key architectural principle: **single source of truth for game logic**.

### Why It Exists

**Problem:** Prior to v0.4.0, game logic existed in two places:
- Client: `src/cards.js`, `src/effects.js`, `src/triggers.js`
- Server: Hardcoded switch cases in `server/GameEngine.js`

This led to:
- **Bugs:** Server missing effects (e.g., Phantom Wall not dealing damage)
- **Drift:** Changes made in one place but not the other
- **Maintenance burden:** Every rule change required dual implementation

**Solution:** Extract all game rules into `shared/` module, used by both client and server.

### What Goes in `shared/`

✅ **Belongs in shared:**
- Card definitions (stats, abilities, effects)
- Effect primitives (damage, heal, summon, etc.)
- Trigger matching logic
- Core game operations (attack, summon, cast)
- Win/loss conditions
- Turn phase logic

❌ **Does NOT belong in shared:**
- Animation (client-only)
- WebSocket code (server-only)
- AI decision logic (client-only for now)
- DOM rendering (client-only)
- Session management (server-only)

### Benefits

1. **Correctness:** One implementation = one truth
2. **Testability:** Shared logic can be tested once
3. **Maintainability:** Change a card once, works everywhere
4. **Multiplayer parity:** Client and server always agree on rules

---

## Quick Reference

### Shared Engine (`shared/engine.js`)

| Function | Purpose |
|----------|---------|
| `createGame(deck1Id, deck2Id)` | Initialize state, shuffle, deal |
| `executeAction(state, playerIdx, action)` | Main entry for all player actions |
| `summon` / `attack` / `castVerse` / `setVerse` / `retreat` | Core actions |
| `endTurn(state, playerIdx)` | Poison tick, turnEnd triggers, switch |
| `resolveSelection` | Declarative target selection |
| `respondOptionalTrigger` | Optional trigger prompts (Vengeance, Brace, etc.) |
| `getEffectiveAtk` / `applyDamage` / `draw` | Combat & resource helpers |

### Client Entry (`src/main.js`)

| Concern | How it works |
|---------|----------------|
| Solo play | Calls `sharedExecuteAction()`, plays events via `EVENT_HANDLERS` → `Anim.*` |
| Multiplayer | WebSocket to `WS_SERVER`; server validates via shared engine |
| AI | `src/ai.js` scores moves (Pup / Hunter) |
| Render | `src/render.js` + `await Anim.*` before `render()` |
| Presentation | `data-presentation` on `<html>`; `renderAaaShell()` when `aaa`, downgrading to `classic` on any failure |

---

*Last updated: v0.4.87 + unreleased AAA presentation — 2026-07-29*

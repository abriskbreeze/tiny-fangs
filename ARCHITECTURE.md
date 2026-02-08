# Tiny Fangs — Architecture Reference

**Version:** 0.3.5  
**Last Updated:** 2026-02-05

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TINY FANGS v0.3.5                           │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │   index.    │  │    src/     │  │   tests/    │  │   docs/    │  │
│  │   html      │  │  modules    │  │   *.test    │  │   build    │  │
│  │  (6000 LOC) │  │  (12 files) │  │  (22 files) │  │  (vite)    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  │
│         │                │                │                │        │
│         ▼                ▼                ▼                ▼        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     Game Runtime                             │   │
│  │  • State Management (state.js)                               │   │
│  │  • Game Logic (game.js, helpers.js)                          │   │
│  │  • Card Data (cards.js)                                      │   │
│  │  • Effects System (effects.js)                               │   │
│  │  • Trigger System (triggers.js, events.js)                   │   │
│  │  • AI System (ai.js, abilities.js)                           │   │
│  │  • Animation (anim.js)                                       │   │
│  │  • Rendering (render.js)                                     │   │
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

## File Structure

```
tiny-fangs/
├── index.html          # Main game (6000+ LOC)
├── VERSION             # Current version
├── CHANGELOG.md        # Version history
├── ARCHITECTURE.md     # This file
├── MEMORY.md           # Project memory
├── README.md           # Quick start
│
├── src/                # Modules
│   ├── state.js        # Global state management
│   ├── cards.js        # Card definitions (CREATURES, VERSES, DECKS)
│   ├── game.js         # Core game logic (applyDamage, createCreature)
│   ├── helpers.js      # Utility functions (getEffectiveAtk, etc.)
│   ├── effects.js      # Effect processor (25+ effect types)
│   ├── triggers.js     # Trigger matcher and processor
│   ├── events.js       # Simple event emitter
│   ├── ai.js           # AI decision system
│   ├── abilities.js    # Ability helpers
│   ├── anim.js         # Animation system
│   └── render.js       # UI rendering helpers
│
├── guides/             # Documentation
│   ├── CARD-AUTHORING.md   # How to add cards
│   └── EVENT-SYSTEM.md     # Event system details
│
├── tests/              # Test files (Vitest)
│   └── *.test.js       # 350+ tests
│
├── docs/               # Built output (GitHub Pages)
│   ├── index.html      # Bundled game
│   └── assets/         # Bundled assets
│
└── tasks/              # Planning docs
    └── *.md            # Task tracking
```

---

## Quick Reference

### Key Functions (index.html)

| Function | Purpose |
|----------|---------|
| `startGame()` | Initialize new game |
| `drawPhase(player)` | Draw card, gain mana |
| `doAttack(attacker, defender)` | Resolve attack |
| `summon(card, side)` | Place creature on field |
| `castVerse(card, side)` | Cast a cast verse |
| `setVerse(card, side)` | Set a set verse |
| `ko(creature, owner)` | Handle creature death |
| `loseLife(player, key)` | Handle LP loss |
| `checkLethalDamage(creature, key, source)` | Check survival triggers |
| `processTriggers(event, ctx, state, gameCtx)` | Run triggers |
| `processEffects(card, ctx)` | Execute effects |
| `aiTurn()` | AI turn dispatcher |

### Key Helpers (src/helpers.js)

| Function | Purpose |
|----------|---------|
| `getEffectiveAtk(creature, owner, opp)` | Calculate final ATK |
| `getAtkModifiers(creature, owner, opp)` | List ATK modifiers |
| `hasElusive(creature)` | Check if untargetable |
| `canTarget(creature)` | Check if can be targeted |

---

*Last updated: v0.3.5 — 2026-02-05*

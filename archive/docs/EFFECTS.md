# Tiny Fangs — Card & Effect System Specification

> A data-driven system for defining cards and abilities in plain text

---

## Philosophy

**Cards are data, not code.**

Instead of writing JavaScript for each ability, cards are defined declaratively using a simple effect language. The game engine interprets these definitions at runtime.

Benefits:
- Add/change cards without touching game code
- Easy to balance (just edit numbers)
- Cards can be defined in plain text/markdown
- Validate all cards with tests
- Future: let players create custom cards

---

## Card Definition Format

Cards are defined in a simple structured format that can be written as YAML, JSON, or parsed from markdown tables.

### Creature Card

```yaml
whisper:
  name: "Whisper"
  subtitle: "Shadow Ermine"
  type: creature
  pack: shadow
  cost: 1
  hp: 30
  atk: 20
  
  # Keyword abilities (shorthand for common effects)
  keywords:
    - elusive
  
  # Custom effects (when keywords aren't enough)
  effects: []
  
  # Flavor text
  flavor: "A flicker in the corner of your eye."
  
  # ASCII art (optional)
  art: |
     /\_/\
    (  ·.·)
    > ~ <
```

### Verse Card

```yaml
dark_pact:
  name: "Dark Pact"
  type: verse
  subtype: cast  # cast | set
  pack: shadow
  cost: 1
  
  # For set verses
  trigger: null
  
  # Effect when played/triggered
  effects:
    - draw: 2
    - damage_lp: { target: self, amount: 1 }
  
  text: "Draw 2 cards. Lose 1 LP."
```

### Set Verse Card

```yaml
phantom_wall:
  name: "Phantom Wall"
  type: verse
  subtype: set
  pack: universal
  cost: 1
  
  trigger:
    event: opponent_attacks
  
  effects:
    - negate_attack: true
    - damage: { target: attacker, amount: 10 }
  
  trigger_text: "When opponent attacks"
  text: "Negate attack. Deal 10 damage to attacker."
```

---

## Effect Language

### Core Concepts

**Effects** are actions that modify game state.
**Triggers** define when effects activate.
**Targets** specify what the effect applies to.
**Conditions** gate effects behind requirements.

### Triggers

| Trigger | When It Fires |
|---------|---------------|
| `on_summon` | This creature enters the field |
| `on_attack` | This creature declares an attack |
| `on_deal_damage` | This creature deals damage |
| `on_take_damage` | This creature takes damage |
| `on_ko` | This creature is KO'd |
| `on_kill` | This creature KO's another |
| `on_turn_start` | Your turn begins |
| `on_turn_end` | Your turn ends |
| `opponent_summons` | Opponent summons a creature |
| `opponent_attacks` | Opponent declares attack |
| `opponent_casts` | Opponent plays a Cast verse |
| `creature_ko` | Any creature is KO'd |
| `your_creature_ko` | Your creature is KO'd |
| `self_would_ko` | This would be KO'd (can negate) |

### Targets

| Target | What It Refers To |
|--------|-------------------|
| `self` | This card |
| `active` | Your active creature |
| `enemy_active` | Opponent's active creature |
| `bench` | Your bench creatures |
| `enemy_bench` | Opponent's bench creatures |
| `all_allies` | Your active + bench |
| `all_enemies` | Enemy active + bench |
| `all_creatures` | Every creature in play |
| `attacker` | The creature that attacked |
| `defender` | The creature being attacked |
| `summoned` | The creature that was just summoned |
| `killed` | The creature that was just KO'd |
| `graveyard` | Your graveyard |
| `enemy_graveyard` | Opponent's graveyard |
| `hand` | Your hand |
| `enemy_hand` | Opponent's hand |
| `random_enemy` | Random enemy creature |
| `random_ally` | Random ally creature |
| `triggered_card` | The card that triggered this |

### Actions

| Action | Parameters | Effect |
|--------|------------|--------|
| `damage` | target, amount | Deal damage to target |
| `damage_lp` | target, amount | Deal LP damage directly |
| `heal` | target, amount | Restore HP to target |
| `heal_lp` | target, amount | Restore LP |
| `buff_atk` | target, amount | Increase ATK |
| `debuff_atk` | target, amount | Decrease ATK |
| `buff_hp` | target, amount | Increase max HP (and current) |
| `draw` | amount | Draw cards |
| `discard` | target, amount | Discard from hand |
| `discard_random` | target, amount | Discard random cards |
| `summon` | card_id, position | Summon a creature |
| `summon_from_grave` | filter, position | Summon from graveyard |
| `return_to_hand` | target | Return creature to hand |
| `destroy` | target | KO target (bypasses damage) |
| `banish` | target | Remove from game |
| `poison` | target | Apply poison status |
| `trap` | target | Apply trapped status (can't retreat) |
| `negate_attack` | - | Cancel current attack |
| `negate_ko` | - | Prevent KO from resolving |
| `prevent_targeting` | duration | Can't be targeted by verses |
| `gain_mana` | amount | Add mana this turn |
| `cost_reduction` | target, amount | Reduce cost of card |
| `copy_atk` | source, target | Copy ATK value |
| `swap_with_bench` | - | Swap active with bench creature |
| `attack_again` | - | Perform another attack |
| `trigger_bench_attack` | amount | Bench deals damage |

### Conditions

| Condition | Parameters | True When |
|-----------|------------|-----------|
| `if_graveyard_has` | type | Your graveyard has matching card |
| `if_bench_empty` | - | You have no bench creatures |
| `if_bench_exists` | - | You have bench creatures |
| `if_hp_below` | target, percent | Target HP below X% |
| `if_hp_above` | target, percent | Target HP above X% |
| `if_first_attack` | - | This is first attack this game |
| `if_creature_count` | operator, count | Compare your creature count |
| `if_enemy_poisoned` | - | Enemy active is poisoned |
| `if_card_in_hand` | filter | Hand contains matching card |
| `once_per_game` | - | Only triggers once ever |
| `once_per_turn` | - | Only triggers once per turn |

### Modifiers

| Modifier | Effect |
|----------|--------|
| `amount: damage_dealt` | Use the damage just dealt |
| `amount: overkill` | Use overkill damage amount |
| `amount: enemy_atk` | Use enemy's ATK value |
| `amount: creature_count` | Use number of your creatures |
| `filter: cost_1` | Only 1-cost cards |
| `filter: cost_lte_2` | Cost ≤ 2 |
| `filter: creature` | Only creatures |
| `filter: verse` | Only verses |
| `position: active` | Summon to active slot |
| `position: bench` | Summon to bench |

---

## Effect Examples

### Simple Effects

```yaml
# Emberfang - "Spark: When summoned, deal 5 damage to enemy active"
emberfang:
  effects:
    - trigger: on_summon
      action: damage
      target: enemy_active
      amount: 5
```

```yaml
# Leechling - "Drain: Heal HP equal to damage dealt"
leechling:
  effects:
    - trigger: on_deal_damage
      action: heal
      target: self
      amount: damage_dealt
```

```yaml
# Thornling - "Thorns: Attackers take 10 damage"
thornling:
  effects:
    - trigger: on_take_damage
      condition: attacker_exists
      action: damage
      target: attacker
      amount: 10
```

### Conditional Effects

```yaml
# Duskfang - "Pack Call: +20 ATK if creature in your graveyard"
duskfang:
  effects:
    - trigger: on_summon
      condition:
        if_graveyard_has: creature
      action: buff_atk
      target: self
      amount: 20
```

```yaml
# Shade Pup - "Orphan: +15 ATK while you have no bench creatures"
shade_pup:
  effects:
    - trigger: continuous  # Always active while in play
      condition:
        if_bench_empty: true
      action: buff_atk
      target: self
      amount: 15
```

```yaml
# Pulsefin - "Sonic Strike: First attack deals double"
pulsefin:
  effects:
    - trigger: on_attack
      condition:
        if_first_attack: true
      action: buff_atk
      target: self
      amount: self_atk  # Doubles it
```

### Multi-Step Effects

```yaml
# Cindermaw - "Frenzy: Attacks twice, takes 10 self-damage"
cindermaw:
  effects:
    - trigger: on_attack
      actions:
        - attack_again: true
        - damage: { target: self, amount: 10 }
```

```yaml
# Dark Pact - "Draw 2 cards. Lose 1 LP."
dark_pact:
  effects:
    - action: draw
      amount: 2
    - action: damage_lp
      target: self
      amount: 1
```

```yaml
# Razorclaw - "Eviscerate: Overkill damage hits enemy LP directly"
razorclaw:
  effects:
    - trigger: on_kill
      condition:
        if_overkill: true
      action: damage_lp
      target: enemy
      amount: overkill
```

### Set Verse Effects

```yaml
# Mirror Force - "When your creature would be KO'd, negate and destroy attacker"
mirror_force:
  trigger:
    event: self_would_ko
    condition: attacker_exists
  effects:
    - action: negate_ko
    - action: destroy
      target: attacker
```

```yaml
# Creeping Doom - "When enemy attacks, poison that creature"
creeping_doom:
  trigger:
    event: opponent_attacks
  effects:
    - action: poison
      target: attacker
```

```yaml
# Reinforcements - "When your active KO'd, summon 2-cost or less from hand free"
reinforcements:
  trigger:
    event: your_creature_ko
    location: active
  effects:
    - action: summon_from_hand
      filter: cost_lte_2
      cost: 0
      position: active
```

### Complex Effects

```yaml
# Alpha - "Rally: Your bench creatures can attack (deal half their ATK)"
alpha:
  effects:
    - trigger: on_attack
      action: trigger_bench_attack
      amount: 0.5  # Half ATK
```

```yaml
# Broodmother - "Spawn: At end of turn, summon a 10/10 Antling to bench"
broodmother:
  effects:
    - trigger: on_turn_end
      condition:
        if_bench_not_full: true
      action: summon
      card_id: token_antling
      position: bench
```

```yaml
# Corpselight - "Lure: On KO, summon a 1-cost creature from grave to active"
corpselight:
  effects:
    - trigger: on_ko
      action: summon_from_grave
      filter: cost_1
      position: active
```

---

## Keyword System

Keywords are shorthand for common effects. They expand to full effect definitions.

| Keyword | Expands To |
|---------|------------|
| `elusive` | `on_summon: prevent_targeting for 1 turn` |
| `thorns` | `on_take_damage: damage attacker 10` |
| `poison` | `on_deal_damage: apply poison to defender` |
| `drain` | `on_deal_damage: heal self damage_dealt` |
| `frenzy` | `on_attack: attack_again, damage self 10` |
| `rend` | `continuous: buff_atk self 10` |
| `trapped` | Status: cannot retreat |
| `poisoned` | Status: take 10 damage at end of turn |

```yaml
# Using keywords
thornling:
  keywords: [thorns]
  
# Equivalent to:
thornling:
  effects:
    - trigger: on_take_damage
      condition: attacker_exists
      action: damage
      target: attacker
      amount: 10
```

---

## Card Definition File Format

Cards can be defined in `cards.yaml` or split across pack files:

### Single File (cards.yaml)
```yaml
cards:
  # Shadow Pack
  whisper:
    name: "Whisper"
    # ...
  
  gloom:
    name: "Gloom"
    # ...

packs:
  shadow:
    cards: [whisper, gloom, duskfang, echomask, nighthollow, shade_pup, corpselight, dark_pact, grave_echo, shadowstep]
  
  fang:
    cards: [emberfang, cindermaw, bladewhisker, pulsefin, boltmouse, razorclaw, stormtalon, ignite, predators_mark, blood_moon]
```

### Split Files
```
cards/
├── shadow.yaml
├── fang.yaml
├── venom.yaml
├── swarm.yaml
├── universal.yaml
└── tokens.yaml
```

---

## Validation Rules

The card validator should check:

### Structure
- [ ] All required fields present (id, name, type, cost)
- [ ] Creatures have hp, atk
- [ ] Verses have text
- [ ] Set verses have trigger
- [ ] No duplicate IDs
- [ ] Referenced card IDs exist

### Values
- [ ] Cost is 0-5
- [ ] HP is > 0 for creatures
- [ ] ATK is >= 0
- [ ] Pack is valid (shadow/fang/venom/swarm/universal)

### Effects
- [ ] All triggers are valid
- [ ] All actions are valid  
- [ ] All targets are valid
- [ ] All conditions are valid
- [ ] Referenced targets exist in context

### Balance Warnings (non-blocking)
- [ ] Flag very high stats for cost
- [ ] Flag potentially broken combos
- [ ] Flag missing counter-play

---

## Runtime Effect Processor

```javascript
// Pseudo-code for effect processor

class EffectProcessor {
  constructor(gameState) {
    this.state = gameState;
    this.effectQueue = [];
  }
  
  // Register all card effects as listeners
  registerCard(card, owner) {
    for (const effect of card.effects) {
      this.addListener(effect.trigger, () => {
        if (this.checkCondition(effect.condition)) {
          this.executeAction(effect, owner);
        }
      });
    }
  }
  
  // Fire a trigger (e.g., 'on_summon')
  fireTrigger(trigger, context) {
    const listeners = this.listeners[trigger] || [];
    for (const listener of listeners) {
      listener(context);
    }
    this.processQueue(); // Resolve effects in order
  }
  
  // Evaluate a condition
  checkCondition(condition, context) {
    if (!condition) return true;
    
    switch (condition.type) {
      case 'if_graveyard_has':
        return this.state.getGraveyard(context.owner)
          .some(c => c.type === condition.filter);
      case 'if_bench_empty':
        return this.state.getBench(context.owner).length === 0;
      // ... etc
    }
  }
  
  // Execute an action
  executeAction(effect, context) {
    const target = this.resolveTarget(effect.target, context);
    const amount = this.resolveAmount(effect.amount, context);
    
    switch (effect.action) {
      case 'damage':
        this.state.dealDamage(target, amount);
        break;
      case 'heal':
        this.state.heal(target, amount);
        break;
      case 'buff_atk':
        target.atk += amount;
        break;
      // ... etc
    }
  }
}
```

---

## Adding a New Card (Workflow)

### 1. Define the card in YAML

```yaml
# In cards/venom.yaml
spore_crawler:
  name: "Spore Crawler"
  subtitle: "Fungal Horror"
  type: creature
  pack: venom
  cost: 2
  hp: 35
  atk: 20
  
  effects:
    - trigger: on_ko
      action: poison
      target: all_enemies
  
  flavor: "Death is just the beginning."
  
  art: |
    .oOo.
    (   )
    /| |\
```

### 2. Add to pack definition

```yaml
# In cards/packs.yaml
venom:
  cards:
    - thornling
    - leechling
    - spore_crawler  # New!
    # ...
```

### 3. Write tests

```javascript
// In tests/cards/spore_crawler.test.js
describe('Spore Crawler', () => {
  test('has valid structure', () => {
    const card = getCard('spore_crawler');
    expect(card.type).toBe('creature');
    expect(card.cost).toBe(2);
    expect(card.hp).toBe(35);
    expect(card.atk).toBe(20);
  });
  
  test('poisons all enemies on KO', () => {
    const state = createTestState();
    const crawler = summon(state, 'spore_crawler', 'me');
    const enemy1 = summon(state, 'whisper', 'opp', 'active');
    const enemy2 = summon(state, 'gloom', 'opp', 'bench');
    
    // KO the crawler
    ko(state, crawler);
    
    expect(enemy1.status).toBe('poisoned');
    expect(enemy2.status).toBe('poisoned');
  });
});
```

### 4. Run tests

```bash
npm test -- spore_crawler
```

### 5. Balance (iterate)

```yaml
# Too strong? Adjust:
spore_crawler:
  cost: 3  # Increased from 2
  hp: 30   # Decreased from 35
```

---

## Future Extensions

### Custom Card Creator

```
┌─────────────────────────────────────────────────────────────┐
│  CREATE A CARD                                              │
│                                                             │
│  Name: [________________]                                   │
│  Type: ( ) Creature  ( ) Verse                             │
│  Cost: [2]   HP: [30]   ATK: [25]                          │
│                                                             │
│  Ability:                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ When: [on_summon     ▼]                             │   │
│  │ Do:   [damage        ▼]                             │   │
│  │ To:   [enemy_active  ▼]                             │   │
│  │ Amount: [10]                                        │   │
│  └─────────────────────────────────────────────────────┘   │
│  [ + Add Another Effect ]                                   │
│                                                             │
│              [ TEST CARD ]    [ SAVE ]                      │
└─────────────────────────────────────────────────────────────┘
```

### Moddable Card Packs

```
mods/
├── expansion_deep_sea/
│   ├── cards.yaml
│   └── pack.yaml
└── community_cards/
    └── cards.yaml
```

Load community cards:
```javascript
game.loadPack('mods/expansion_deep_sea');
```

---

## Summary

| Component | Purpose |
|-----------|---------|
| **Card YAML** | Define cards as data |
| **Effect Language** | Compose abilities from primitives |
| **Keywords** | Shorthand for common patterns |
| **Triggers** | When effects activate |
| **Actions** | What effects do |
| **Conditions** | Requirements for effects |
| **Targets** | Who effects apply to |
| **Validator** | Ensure cards are well-formed |
| **Processor** | Execute effects at runtime |

This system makes it trivial to add new cards — just write YAML and tests.

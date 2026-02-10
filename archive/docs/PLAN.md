# Tiny Fangs v3.0 — Comprehensive Development Plan

## Vision

Transform Tiny Fangs from a single-file prototype into a polished single-player card battler with:
- **Draft-based progression** — Build your first deck by drafting from themed packs
- **Gold economy** — Win battles → earn gold → buy packs
- **Collection building** — Grow your card pool over time
- **Deck customization** — Build decks from your collection
- **Replayability** — Draft new runs, try different strategies

---

## Core Game Loop

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │  DRAFT   │ →  │  BATTLE  │ →  │   SHOP   │ ──┐         │
│  │ 5 packs  │    │  for gold│    │ buy packs│   │         │
│  │ 15 cards │    │          │    │          │   │         │
│  └──────────┘    └──────────┘    └──────────┘   │         │
│       ▲                                          │         │
│       │         ┌──────────┐                    │         │
│       │         │COLLECTION│ ←──────────────────┘         │
│       │         │deckbuild │                              │
│       │         └──────────┘                              │
│       │              │                                     │
│       └──────────────┘                                     │
│         (new run)                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Game Mechanics

### Deck Rules
- **Deck size:** 15 cards exactly
- **Card limit:** Max 2 copies of any card per deck
- **Starting hand:** 5 cards
- **Max hand size:** 7 cards (discard at end of turn if over)

### Draft System

**The Cube:** 40 unique cards split into 4 themed booster packs

**Draft Flow:**
1. Two random packs appear (from 4 possible)
2. Pick one pack to open
3. See 5 random cards from that pack's 10
4. Pick 3 of those 5 cards
5. Repeat 5 times → 15 cards total

```
Round 1: [Shadow Pack] vs [Venom Pack] → Pick Shadow → Choose 3 of 5
Round 2: [Fang Pack] vs [Swarm Pack] → Pick Fang → Choose 3 of 5
Round 3: [Shadow Pack] vs [Swarm Pack] → ...
Round 4: ...
Round 5: ...
= 15 card deck
```

### Economy
- **Win battle:** +15-30 gold (scales with opponent difficulty)
- **Lose battle:** +5 gold (consolation)
- **Pack cost:** 50 gold (guarantees 3 cards from a specific pack)
- **Duplicate cards:** Auto-converted to +10 gold each (max 2 copies)

### AI Opponents
Different AI opponents with themed decks and varying difficulty:
```
┌────────────────────────────────────────────────┐
│  CHOOSE YOUR OPPONENT                          │
│                                                │
│  [🌑] The Shade          Easy    +15 gold     │
│       "Shadow swarm"                          │
│                                                │
│  [🔥] Cinderclaw         Medium  +20 gold     │
│       "Aggressive burn"                       │
│                                                │
│  [🕷️] The Broodmother    Hard    +30 gold     │
│       "Poison control"                        │
│                                                │
│  [👑] The Hollow King    Boss    +50 gold     │
│       "Requires 3 wins to unlock"             │
└────────────────────────────────────────────────┘
```

---

## Card Design

### The Four Packs

Each pack has **10 unique cards** with a cohesive theme:
- 6-7 Creatures
- 3-4 Verses
- Internal synergies that reward drafting multiple cards from same pack
- But also cards that splash well into other strategies

---

### 🌑 SHADOW PACK — "Whispers in the Dark"
*Theme: Stealth, death triggers, graveyard synergy, evasion*

**Creatures (7):**

| Name | Subtitle | Cost | HP | ATK | Ability |
|------|----------|------|-----|-----|---------|
| Whisper | Shadow Ermine | 1 | 30 | 20 | *Elusive:* Can't be targeted by Set Verses on summon turn |
| Gloom | Void Mite | 1 | 20 | 20 | *Fade:* On KO, opponent discards 1 random card |
| Duskfang | Twilight Wolf | 3 | 60 | 40 | *Pack Call:* +20 ATK if creature in your graveyard |
| Echomask | Mirror Fiend | 4 | 40 | — | *Reflection:* ATK = enemy ATK. *Shatter:* 1 LP on death |
| **Nighthollow** | Phantom Owl | 2 | 35 | 25 | *Silent Wings:* First attack each game can't be blocked by Set Verses |
| **Shade Pup** | Lost Cub | 1 | 25 | 15 | *Orphan:* +15 ATK while you have no bench creatures |
| **Corpselight** | Will-o-Wisp | 2 | 20 | 30 | *Lure:* On KO, summon a 1-cost creature from grave to active |

**Verses (3):**

| Name | Type | Cost | Effect |
|------|------|------|--------|
| Dark Pact | Cast | 1 | Draw 2 cards. Lose 1 LP. |
| Grave Echo | Cast | 3 | Return a creature from your graveyard to hand. |
| **Shadowstep** | Cast | 1 | Return your active creature to hand. It costs 1 less next summon. |

---

### 🔥 FANG PACK — "Strike First, Strike Hard"
*Theme: Aggression, direct damage, speed, overkill*

**Creatures (7):**

| Name | Subtitle | Cost | HP | ATK | Ability |
|------|----------|------|-----|-----|---------|
| Cindermaw | Ember Shrew | 2 | 30 | 30 | *Frenzy:* Attacks twice, takes 10 self-damage |
| Bladewhisker | Steel Weasel | 2 | 40 | 30 | *Rend:* +10 damage on attacks |
| Pulsefin | Abyssal Shrimp | 2 | 40 | 30 | *Sonic Strike:* First attack deals double |
| Stormtalon | Thunder Raptor | 4 | 50 | 50 | *Chain Lightning:* On KO, deal 20 to next summoned creature |
| **Emberfang** | Fire Weasel | 1 | 25 | 25 | *Spark:* When summoned, deal 5 damage to enemy active |
| **Razorclaw** | Blade Badger | 3 | 45 | 40 | *Eviscerate:* Overkill damage hits enemy LP directly |
| **Boltmouse** | Storm Shrew | 2 | 30 | 25 | *Static:* After attacking, deal 10 to enemy active |

**Verses (3):**

| Name | Type | Cost | Effect |
|------|------|------|--------|
| Predator's Mark | Cast | 2 | Your creature's next attack deals +30 damage. |
| Blood Moon | Cast | 2 | All creatures take 20 damage. |
| **Ignite** | Cast | 1 | Deal 15 damage to enemy active creature. |

---

### 🕷️ VENOM PACK — "Slow Death"
*Theme: Poison, control, lifesteal, attrition*

**Creatures (7):**

| Name | Subtitle | Cost | HP | ATK | Ability |
|------|----------|------|-----|-----|---------|
| Thornling | Bramble Sprite | 1 | 40 | 10 | *Thorns:* Attackers take 10 damage |
| Hexweaver | Curse Spider | 2 | 40 | 20 | *Venom Thread:* On hit, enemy takes 10 at end of each turn (poison) |
| Mireveil | Swamp Phantom | 3 | 50 | 20 | *Bog Grasp:* Enemy can't retreat next turn |
| Sundew Queen | Carnivorous Monarch | 4 | 70 | 30 | *Digest:* Heal 30 HP when it KO's a creature |
| **Scorpius** | Sand Stalker | 2 | 35 | 25 | *Neurotoxin:* Poison deals 15 instead of 10 |
| **Leechling** | Blood Mite | 1 | 20 | 15 | *Drain:* Heal HP equal to damage dealt |
| **Rotbloom** | Decay Blossom | 3 | 50 | 15 | *Wilt:* Enemy creatures have -10 ATK |

**Verses (3):**

| Name | Type | Cost | Effect |
|------|------|------|--------|
| Soul Siphon | Cast | 2 | Deal 20 damage to enemy creature. Heal your creature 10. |
| Second Wind | Cast | 2 | Heal your active creature 40 HP. |
| **Creeping Doom** | Set | 2 | *Trigger:* Enemy creature attacks. *Effect:* Poison that creature. |

---

### 🐺 SWARM PACK — "Strength in Numbers"
*Theme: Bench synergy, pack tactics, sacrifice, tokens*

**Creatures (7):**

| Name | Subtitle | Cost | HP | ATK | Ability |
|------|----------|------|-----|-----|---------|
| **Fangpup** | Wolf Cub | 1 | 25 | 20 | *Pack Bond:* +10 ATK for each other creature you control |
| **Skitter** | Tunnel Rat | 1 | 30 | 15 | *Scurry:* When damaged, swap with a bench creature (free retreat) |
| **Hiveling** | Drone Wasp | 1 | 20 | 20 | *Swarm:* When summoned, if you have 2+ creatures, draw 1 |
| **Piranix** | River Fang | 2 | 35 | 25 | *Feeding Frenzy:* +15 ATK if enemy creature is below half HP |
| **Alpha** | Pack Leader | 3 | 55 | 35 | *Rally:* Your bench creatures can attack (deal half their ATK) |
| **Broodmother** | Queen Ant | 4 | 60 | 20 | *Spawn:* At end of turn, summon a 0-cost 10/10 Antling to bench |
| **Vulpix** | Den Fox | 2 | 40 | 25 | *Den Guard:* While you have a bench creature, take -10 damage |

**Verses (3):**

| Name | Type | Cost | Effect |
|------|------|------|--------|
| **Pack Tactics** | Cast | 1 | Your bench creatures each deal 10 damage to enemy active. |
| **Sacrifice** | Cast | 2 | Destroy one of your creatures. Draw 2 and gain 1 mana. |
| **Reinforcements** | Set | 1 | *Trigger:* Your active is KO'd. *Effect:* Summon 2-cost or less from hand free. |

---

### Universal Cards (in all packs)

These 4 cards appear in every pack's pool (1 per pack):

| Name | Type | Cost | Effect |
|------|------|------|--------|
| Banish | Cast | 3 | Destroy enemy creature. Remove from game. |
| Mana Surge | Cast | 0 | Gain 2 mana. Once per game. |
| Phantom Wall | Set | 1 | *Trigger:* Opponent attacks. *Effect:* Negate attack, deal 10 to attacker. |
| Mirror Force | Set | 2 | *Trigger:* Your creature would be KO'd. *Effect:* Negate KO, destroy attacker. |

---

### Card Count Summary

| Pack | Creatures | Verses | Universal | Total Unique |
|------|-----------|--------|-----------|--------------|
| Shadow | 7 | 3 | — | 10 |
| Fang | 7 | 3 | — | 10 |
| Venom | 7 | 3 | — | 10 |
| Swarm | 7 | 3 | — | 10 |
| Universal | — | — | 4 | (in each) |

**Total unique cards: 40** (36 pack-specific + 4 universal)

---

## Card & Effect System

See **EFFECTS.md** for the complete specification.

### Overview

Cards are defined as **data, not code**. A declarative effect language lets us:
- Add/change cards by editing YAML files
- Balance by tweaking numbers (no code changes)
- Validate all cards with automated tests
- Future-proof for custom cards or modding

### Card Definition Example

```yaml
emberfang:
  name: "Emberfang"
  subtitle: "Fire Weasel"
  type: creature
  pack: fang
  cost: 1
  hp: 25
  atk: 25
  
  effects:
    - trigger: on_summon
      action: damage
      target: enemy_active
      amount: 5
  
  flavor: "First spark, last breath."
```

### Effect Building Blocks

| Component | Examples |
|-----------|----------|
| **Triggers** | on_summon, on_attack, on_ko, on_turn_end |
| **Actions** | damage, heal, buff_atk, draw, poison, summon |
| **Targets** | self, enemy_active, bench, attacker, graveyard |
| **Conditions** | if_graveyard_has, if_bench_empty, if_first_attack |

### Keywords (Shorthand)

Common abilities have keywords that expand to full effect definitions:

| Keyword | Effect |
|---------|--------|
| `thorns` | on_take_damage → damage attacker 10 |
| `drain` | on_deal_damage → heal self damage_dealt |
| `poison` | on_deal_damage → apply poison to defender |
| `elusive` | on_summon → can't be targeted for 1 turn |

### Adding a New Card (Workflow)

1. Write card definition in `cards/[pack].yaml`
2. Add card ID to pack's card list
3. Write tests for the ability
4. Run tests: `npm test`
5. Balance and iterate

---

## Technical Architecture

### File Structure

```
tiny-fangs/
├── index.html                 # App shell, loads main.js
├── vite.config.js             # Build config
├── package.json
│
├── src/
│   ├── main.js                # Entry point, router, init
│   ├── state.js               # Global state (Proxy-based reactivity)
│   ├── storage.js             # LocalStorage save/load
│   ├── constants.js           # Game constants (deck size, mana cap, etc.)
│   │
│   ├── cards/
│   │   ├── index.js           # Exports all cards, loader
│   │   ├── database.js        # Card registry, lookup functions
│   │   ├── validator.js       # Card structure validation
│   │   ├── packs.js           # Pack definitions
│   │   └── definitions/       # YAML card definitions
│   │       ├── shadow.yaml    # Shadow pack cards
│   │       ├── fang.yaml      # Fang pack cards
│   │       ├── venom.yaml     # Venom pack cards
│   │       ├── swarm.yaml     # Swarm pack cards
│   │       ├── universal.yaml # Universal cards
│   │       └── tokens.yaml    # Token cards (Antling, etc.)
│   │
│   ├── effects/
│   │   ├── processor.js       # Effect execution engine
│   │   ├── triggers.js        # Trigger definitions & handlers
│   │   ├── actions.js         # Action implementations
│   │   ├── conditions.js      # Condition evaluators
│   │   ├── targets.js         # Target resolvers
│   │   └── keywords.js        # Keyword → effect expansion
│   │
│   ├── game/
│   │   ├── engine.js          # Turn flow, phase management
│   │   ├── combat.js          # Damage calc, triggers, KO
│   │   ├── abilities.js       # Ability implementations
│   │   ├── ai.js              # AI decision tree
│   │   └── opponents.js       # AI opponent definitions
│   │
│   ├── modes/
│   │   ├── draft.js           # Draft mode logic
│   │   ├── battle.js          # Battle orchestration
│   │   └── shop.js            # Shop logic, purchases
│   │
│   ├── ui/
│   │   ├── screens/
│   │   │   ├── title.js       # Title screen
│   │   │   ├── draft.js       # Draft UI
│   │   │   ├── battle.js      # Battle UI
│   │   │   ├── shop.js        # Shop UI
│   │   │   ├── collection.js  # Collection viewer
│   │   │   └── deckbuilder.js # Deck builder UI
│   │   │
│   │   ├── components/
│   │   │   ├── card.js        # Card rendering
│   │   │   ├── modal.js       # Modal component
│   │   │   ├── button.js      # Button component
│   │   │   └── healthbar.js   # HP bar component
│   │   │
│   │   ├── render.js          # DOM manipulation helpers
│   │   └── animations.js      # Animation system
│   │
│   └── utils/
│       ├── random.js          # Seeded PRNG
│       ├── events.js          # Event emitter
│       └── helpers.js         # Misc utilities
│
├── styles/
│   ├── main.css               # Variables, reset, base
│   ├── layout.css             # Screen layouts
│   ├── cards.css              # Card styling
│   ├── components.css         # UI components
│   └── animations.css         # Keyframes, transitions
│
├── tests/
│   ├── setup.js               # Test utilities
│   ├── cards.test.js          # Card definitions valid
│   ├── combat.test.js         # Combat mechanics
│   ├── abilities.test.js      # Each ability works correctly
│   ├── draft.test.js          # Draft logic
│   ├── ai.test.js             # AI makes valid decisions
│   └── storage.test.js        # Save/load works
│
└── dist/
    ├── PLAN.md                # This file
    ├── CARDS.md               # Card reference
    └── CHANGELOG.md           # Version history
```

---

## State Management

### Player State (persisted)
```javascript
const playerState = {
  // Collection
  collection: {
    whisper: 2,      // Owns 2 copies
    duskfang: 1,
    // ...card_id: count
  },
  
  // Currency
  gold: 150,
  
  // Decks
  decks: [
    {
      id: 'deck_001',
      name: 'Shadow Rush',
      cards: ['whisper', 'whisper', 'gloom', ...], // 15 cards
    },
  ],
  activeDeck: 'deck_001',
  
  // Stats
  stats: {
    gamesPlayed: 47,
    gamesWon: 31,
    totalGoldEarned: 2450,
    cardsCollected: 28,
    favoriteCard: 'duskfang',
  },
  
  // Current draft run (if in progress)
  draftRun: null,
};
```

### Game State (ephemeral)
```javascript
const gameState = {
  screen: 'battle', // title | draft | battle | shop | collection | deckbuilder
  
  // Battle state
  battle: {
    me: { lp: 3, mana: 2, maxMana: 2, deck: [], hand: [], active: null, bench: [], grave: [], setVerse: null },
    opp: { /* same structure */ },
    turn: 4,
    myTurn: true,
    log: [],
    winner: null,
  },
  
  // Draft state
  draft: {
    round: 3,           // 1-5
    packChoices: ['shadow', 'fang'],
    currentPack: null,  // 5 cards to pick from
    picked: [],         // Cards picked so far
    deck: [],           // Final deck (15 cards)
  },
  
  // Shop state
  shop: {
    featured: ['shadow', 'venom'], // Today's featured packs
  },
};
```

---

## Test Plan

### Unit Tests

**Card Validation Tests (`cards.test.js`)**
```
✓ All 40 cards have required fields (id, name, cost, type)
✓ All creatures have hp, atk
✓ All verses have text, set verses have trigger
✓ No duplicate card IDs
✓ Pack definitions reference valid cards
✓ Each pack has exactly 10 cards
✓ All card costs are 0-5
✓ All creature HP > 0
✓ All effects reference valid triggers
✓ All effects reference valid actions
✓ All effects reference valid targets
```

**Effect System Tests (`effects.test.js`)**
```
✓ Trigger 'on_summon' fires when creature summoned
✓ Trigger 'on_attack' fires when creature attacks
✓ Trigger 'on_ko' fires when creature is KO'd
✓ Trigger 'on_deal_damage' fires with correct damage amount
✓ Trigger 'on_take_damage' fires with correct damage amount
✓ Trigger 'on_turn_end' fires at end of turn
✓ Action 'damage' reduces target HP
✓ Action 'heal' increases target HP (capped at max)
✓ Action 'buff_atk' increases ATK
✓ Action 'draw' adds cards to hand
✓ Action 'poison' applies poisoned status
✓ Action 'summon_from_grave' moves card correctly
✓ Condition 'if_graveyard_has' checks graveyard
✓ Condition 'if_bench_empty' checks bench state
✓ Condition 'if_first_attack' tracks attack history
✓ Target 'self' resolves to source card
✓ Target 'enemy_active' resolves to opponent's active
✓ Target 'attacker' resolves during combat
✓ Keyword 'thorns' expands correctly
✓ Keyword 'drain' expands correctly
✓ Effects chain in correct order
✓ Nested triggers resolve properly
```

**Combat Tests (`combat.test.js`)**
```
✓ Basic attack reduces defender HP
✓ KO triggers when HP <= 0
✓ Overkill damage carries to LP
✓ Direct attack when no defender deals 1 LP
✓ First turn attack blocked
✓ Poison ticks at end of turn
✓ Thorns damages attacker
```

**Ability Tests (`abilities.test.js`)**
```
✓ Elusive blocks Set Verse targeting on summon turn
✓ Fade discards on KO
✓ Pack Call gives +20 ATK with graveyard creature
✓ Frenzy attacks twice with self-damage
✓ Drain heals equal to damage dealt
✓ ... (one test per ability)
```

**Draft Tests (`draft.test.js`)**
```
✓ Two random packs offered each round
✓ Pack shows 5 of its 10 cards
✓ Picking 3 cards adds to deck
✓ After 5 rounds, deck has 15 cards
✓ Same pack can appear multiple rounds
✓ Cards removed from pool after picking
```

**AI Tests (`ai.test.js`)**
```
✓ AI summons creature if no active
✓ AI attacks when able
✓ AI plays removal on threatening target
✓ AI doesn't play more than mana allows
✓ AI uses healing when low HP
```

**Storage Tests (`storage.test.js`)**
```
✓ Save persists to LocalStorage
✓ Load restores state correctly
✓ Handles missing/corrupted data gracefully
✓ Migration from older save versions
```

### Integration Tests

```
✓ Complete draft flow produces valid 15-card deck
✓ Battle completes with winner
✓ Gold awarded correctly after battle
✓ Shop purchase adds cards to collection
✓ Deck builder validates 15-card limit
✓ Full game loop: draft → battle → shop → battle
```

---

## Development Phases

### Phase 1: Foundation (Days 1-2)
*Set up project structure, migrate existing code*

- [ ] Initialize Vite project
- [ ] Create file structure
- [ ] Migrate existing game engine to `src/game/engine.js`
- [ ] Migrate combat logic to `src/game/combat.js`
- [ ] Migrate card definitions to `src/cards/`
- [ ] Set up test framework (Vitest)
- [ ] Write card validation tests
- [ ] Verify existing functionality works

### Phase 2: Card Expansion (Days 3-4)
*Design and implement all 40 cards*

- [ ] Implement Shadow pack (7 creatures, 3 verses)
- [ ] Implement Fang pack (7 creatures, 3 verses)
- [ ] Implement Venom pack (7 creatures, 3 verses)
- [ ] Implement Swarm pack (7 creatures, 3 verses)
- [ ] Implement universal cards
- [ ] Write ability tests for each new card
- [ ] Balance pass: cost/stats/effects

### Phase 3: Draft Mode (Days 5-6)
*Build the draft system*

- [ ] Implement pack generation logic
- [ ] Build draft state machine
- [ ] Create draft UI screen
- [ ] Write draft tests
- [ ] Polish pick animations

### Phase 4: Economy & Shop (Days 7-8)
*Gold system and card shop*

- [ ] Implement gold rewards
- [ ] Build shop logic
- [ ] Create shop UI (ASCII aesthetic)
- [ ] Handle duplicate cards → gold conversion
- [ ] Write economy tests

### Phase 5: Collection & Deck Building (Days 9-10)
*Let players manage their cards*

- [ ] Build collection viewer
- [ ] Create deck builder UI
- [ ] Deck validation (15 cards, max 2 copies)
- [ ] Multiple deck slots
- [ ] Set active deck

### Phase 6: AI Opponents (Days 11-12)
*Multiple opponents with different strategies*

- [ ] Design 4-5 AI opponent decks
- [ ] Implement difficulty scaling
- [ ] Opponent select screen
- [ ] Win/loss rewards
- [ ] Boss unlock condition

### Phase 7: Polish & Persistence (Days 13-14)
*Make it feel complete*

- [ ] Save/load system
- [ ] New player flow (tutorial?)
- [ ] Title screen
- [ ] Run statistics
- [ ] Animation polish
- [ ] Mobile responsive pass
- [ ] Bug fixes

### Phase 8: Stretch Goals (Future)
*If time permits*

- [ ] Sound effects
- [ ] Daily challenges
- [ ] Achievements
- [ ] Friend 1v1 (room codes)
- [ ] Endless mode

---

## UI Screens

### Title Screen
```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║                     TINY FANGS                            ║
║                   ─────────────                           ║
║                    /\_____/\                              ║
║                   /  o   o  \                             ║
║                  ( ==  ^  == )                            ║
║                   )         (                             ║
║                  (           )                            ║
║                 ( (  )   (  ) )                           ║
║                (__(__)___(__)__)                          ║
║                                                           ║
║                                                           ║
║               [ NEW RUN ]     [ CONTINUE ]                ║
║                                                           ║
║               [ COLLECTION ]  [ DECKS ]                   ║
║                                                           ║
║                                                           ║
║                    Gold: 150 ◆                            ║
╚═══════════════════════════════════════════════════════════╝
```

### Draft Screen
```
╔═══════════════════════════════════════════════════════════╗
║  DRAFT — Round 3/5                        Deck: 9/15     ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║                  Choose a booster pack:                   ║
║                                                           ║
║   ┌─────────────────┐       ┌─────────────────┐          ║
║   │   🌑 SHADOW     │       │   🕷️ VENOM      │          ║
║   │                 │       │                 │          ║
║   │  Stealth        │       │  Poison         │          ║
║   │  Death triggers │       │  Life drain     │          ║
║   │  Graveyard      │       │  Control        │          ║
║   │                 │       │                 │          ║
║   │    [ OPEN ]     │       │    [ OPEN ]     │          ║
║   └─────────────────┘       └─────────────────┘          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

### Draft Pick Screen
```
╔═══════════════════════════════════════════════════════════╗
║  🌑 SHADOW PACK — Pick 3 of 5                            ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────┐ ║
║  │ Whisper │ │  Gloom  │ │Duskfang │ │Nighthol.│ │Dark │ ║
║  │ ●○○○○   │ │ ●○○○○   │ │ ●●●○○   │ │ ●●○○○   │ │Pact │ ║
║  │ 30 / 20 │ │ 20 / 20 │ │ 60 / 40 │ │ 35 / 25 │ │ ●○○ │ ║
║  │ Elusive │ │  Fade   │ │PackCall │ │ Silent  │ │Draw2│ ║
║  │         │ │         │ │         │ │ Wings   │ │-1 LP│ ║
║  │  [ ✓ ]  │ │  [   ]  │ │  [ ✓ ]  │ │  [   ]  │ │[ ✓ ]│ ║
║  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────┘ ║
║                                                           ║
║              Selected: 3/3    [ CONFIRM ]                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

### Shop Screen
```
╔═══════════════════════════════════════════════════════════╗
║  THE BURROW — Card Shop                    Gold: 150 ◆   ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   Welcome, hunter. What'll it be?                         ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  🌑 SHADOW PACK                         50 ◆   │    ║
║   │  Contains: 3 random Shadow cards               │    ║
║   │                                  [ BUY ]       │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  🔥 FANG PACK                           50 ◆   │    ║
║   │  Contains: 3 random Fang cards                 │    ║
║   │                                  [ BUY ]       │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  🎲 MYSTERY PACK                        75 ◆   │    ║
║   │  Contains: 3 cards from any pack               │    ║
║   │                                  [ BUY ]       │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║                      [ BACK ]                             ║
╚═══════════════════════════════════════════════════════════╝
```

### Opponent Select
```
╔═══════════════════════════════════════════════════════════╗
║  CHOOSE YOUR PREY                          Gold: 150 ◆   ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  🌑 THE SHADE                                   │    ║
║   │  Difficulty: ★☆☆        Reward: 15 ◆           │    ║
║   │  "Relies on early shadow creatures"            │    ║
║   │                                    [ FIGHT ]   │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  🔥 CINDERCLAW                                  │    ║
║   │  Difficulty: ★★☆        Reward: 20 ◆           │    ║
║   │  "Aggressive burn, fast kills"                 │    ║
║   │                                    [ FIGHT ]   │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║   ┌─────────────────────────────────────────────────┐    ║
║   │  👑 THE HOLLOW KING                  🔒 LOCKED │    ║
║   │  Difficulty: ★★★        Reward: 50 ◆           │    ║
║   │  "Win 3 battles to challenge"                  │    ║
║   └─────────────────────────────────────────────────┘    ║
║                                                           ║
║         [ SHOP ]    [ DECKS ]    [ COLLECTION ]          ║
╚═══════════════════════════════════════════════════════════╝
```

---

## Definition of Done

**MVP Complete When:**
- [x] ~~Basic game engine works~~ (already done)
- [ ] 40 cards implemented and balanced
- [ ] Draft mode produces 15-card decks
- [ ] Can battle AI opponents for gold
- [ ] Can buy packs from shop
- [ ] Collection persists between sessions
- [ ] Can build custom decks
- [ ] 3+ AI opponents with different strategies
- [ ] Mobile-responsive UI
- [ ] No game-breaking bugs

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Card balance issues | Start conservative, buff weak cards |
| AI too easy/hard | Multiple difficulty tiers, tune based on playtesting |
| Save corruption | Version saves, handle migrations, backup before writes |
| Scope creep | Stick to MVP, polish list is for AFTER core works |
| Burnout | Small daily progress, celebrate milestones |

---

## Next Steps

1. **Review this plan** — Any changes before we start?
2. **Initialize project** — Set up Vite, create folder structure
3. **Migrate existing code** — Split index.html into modules
4. **Write card tests** — Validate card structure
5. **Begin card expansion** — Implement new cards pack by pack

---

*Let's make something special.* 🦷

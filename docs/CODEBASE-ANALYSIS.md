# Tiny Fangs Codebase Analysis

**Date:** 2026-02-05  
**Version:** 0.2.57  
**Analyst:** Neve

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           TINY FANGS v0.2.57                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        index.html (6226 lines)                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │  Game Loop  │  │   Render    │  │    Event Handlers       │  │   │
│  │  │  doAttack() │  │   render()  │  │    cardPress()          │  │   │
│  │  │  ko()       │  │   renderLog │  │    onDragMove()         │  │   │
│  │  │  endTurn()  │  │             │  │    executeDrop()        │  │   │
│  │  └──────┬──────┘  └─────────────┘  └─────────────────────────┘  │   │
│  │         │                                                        │   │
│  │         ▼                                                        │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │              AI Turn Logic (aiTurnHunter)               │    │   │
│  │  │              ~500 lines inline                          │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         │                    │                     │                    │
│         ▼                    ▼                     ▼                    │
│  ┌───────────┐        ┌───────────┐         ┌───────────┐              │
│  │ cards.js  │        │effects.js │         │triggers.js│              │
│  │  458 ln   │        │  709 ln   │         │  360 ln   │              │
│  │           │        │           │         │           │              │
│  │ CREATURES │        │ 20 effect │         │ Priority  │              │
│  │ VERSES    │◄──────►│ primitives│◄───────►│ Processor │              │
│  │ DECKS     │        │           │         │           │              │
│  └───────────┘        └───────────┘         └───────────┘              │
│         │                    │                     │                    │
│         ▼                    ▼                     ▼                    │
│  ┌───────────┐        ┌───────────┐         ┌───────────┐              │
│  │abilities.js        │ events.js │         │  game.js  │              │
│  │  265 ln   │        │   94 ln   │         │   57 ln   │              │
│  │           │        │           │         │           │              │
│  │ ATK Calc  │        │ GameEvents│         │applyDamage│              │
│  │ Passives  │        │ Emitter   │         │           │              │
│  └───────────┘        └───────────┘         └───────────┘              │
│                                                                         │
│  ┌───────────┐        ┌───────────┐         ┌───────────┐              │
│  │  ai.js    │        │  anim.js  │         │ render.js │              │
│  │  371 ln   │        │  364 ln   │         │  119 ln   │              │
│  │           │        │           │         │           │              │
│  │ Move Gen  │        │ Animations│         │ UI Render │              │
│  │ Scoring   │        │ Effects   │         │ Helpers   │              │
│  └───────────┘        └───────────┘         └───────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CARD PLAY FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

   Player Input                     AI Input
        │                               │
        ▼                               ▼
  ┌──────────┐                   ┌──────────┐
  │cardPress │                   │aiTurn    │
  │executeDrop                   │Hunter    │
  └────┬─────┘                   └────┬─────┘
       │                              │
       └──────────┬───────────────────┘
                  ▼
        ┌─────────────────┐
        │  Card Type?     │
        └─────────────────┘
          │       │       │
    ┌─────┴───┐   │   ┌───┴─────┐
    ▼         ▼   │   ▼         
┌────────┐ ┌──────┴──┐ ┌────────┐
│CREATURE│ │CAST     │ │SET     │
│summon  │ │VERSE    │ │VERSE   │
└───┬────┘ └────┬────┘ └───┬────┘
    │           │          │
    ▼           ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐
│emitOn  │ │process │ │Store in│
│Summon()│ │Effects │ │setVerse│
└───┬────┘ └────┬───┘ │slot    │
    │           │     └────────┘
    ▼           ▼
┌────────────────────────┐
│   processTriggers()    │
│   (Soul Trap, etc.)    │
└────────────────────────┘
```

---

## 3. Attack Resolution Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ATTACK RESOLUTION                            │
└─────────────────────────────────────────────────────────────────────┘

doAttack()
    │
    ▼
┌───────────────────────────────────┐
│ 1. BEFORE ATTACK                  │
│    processTriggers('beforeAttack')│
│    → Phantom Wall (negateAttack)  │
│    → Spike Shield (damage)        │
└─────────────────┬─────────────────┘
                  │
          attackNegated?
         /              \
       YES               NO
        │                 │
        ▼                 ▼
    [RETURN]    ┌─────────────────────┐
                │ 2. CALCULATE DAMAGE │
                │    getEffectiveAtk()│
                │    + attackBonuses  │
                │    ⚠ HARDCODED:     │
                │    - bladewhisker   │
                │    - pulsefin       │
                │    - echomask       │
                │    - cindermaw      │
                └─────────┬───────────┘
                          │
                          ▼
                ┌─────────────────────┐
                │ 3. BEFORE DAMAGE    │
                │ processTriggers()   │
                │ → Brace (reduce)    │
                │ → Swarm Shield      │
                │ → Shellkin (reduce) │
                └─────────┬───────────┘
                          │
                          ▼
                ┌─────────────────────┐
                │ 4. APPLY DAMAGE     │
                │    curHp -= dmg     │
                │    Anim.damage()    │
                └─────────┬───────────┘
                          │
                    curHp <= 0?
                   /          \
                 YES           NO
                  │             │
                  ▼             ▼
         ┌──────────────┐  ┌────────────────┐
         │ 5. BEFORE KO │  │ afterAttack    │
         │ Vengeance?   │  │ triggers       │
         │ → negateKO   │  │ ⚠ HARDCODED:   │
         │ → destroy    │  │ - thornling    │
         └──────┬───────┘  │ - leechling    │
                │          │ - hexweaver    │
                ▼          │ - mireveil     │
         ┌──────────────┐  │ - sundewqueen  │
         │ 6. KO        │  └────────────────┘
         │ ko() called  │
         │ → beforeKO   │
         │ → onKO emit  │
         │ → life loss  │
         └──────────────┘
```

---

## 4. Issues Identified

### 4.1 🔴 CRITICAL: Hardcoded Creature ID Checks

**67 hardcoded `.id ===` checks in index.html**

Despite the declarative ability system, many creatures still have hardcoded behavior:

| Location | Creature | What's Hardcoded |
|----------|----------|------------------|
| index.html:4117 | cindermaw | Frenzy (double attack) |
| index.html:4157 | bladewhisker | +10 ATK bonus |
| index.html:4169 | pulsefin | First attack double damage |
| index.html:4176 | echomask | ATK = enemy ATK |
| index.html:4294 | leechling | Heal on damage |
| index.html:4320 | thornling | Retaliation damage |
| index.html:4322 | coilshell | Retaliation damage |
| index.html:4324 | reflector | Retaliation damage |
| index.html:4346 | hexweaver | Apply poison |
| index.html:4353 | mireveil | Apply trapped |
| index.html:4370 | sundewqueen | Heal on KO |
| index.html:4275 | bulwark | Survive lethal once |
| index.html:4437 | broodmother | Spawn antling |

**Root Cause:** The event system was built but not all abilities were migrated.

**Risk:** Adding new creatures requires code changes, not just data.

---

### 4.2 🟡 MEDIUM: Duplicated Logic

#### ATK Calculation Duplication
```
abilities.js:getEffectiveAtk()  ←  Used by AI
index.html:doAttack()           ←  Has SEPARATE inline ATK calc
```

Example from index.html:4157:
```javascript
if (attacker.id === 'bladewhisker') baseDmg += 10;
```

But abilities.js:35 also has:
```javascript
if (creature.id === 'bladewhisker') { atk += 10; }
```

**Risk:** If one is updated, the other might be forgotten.

---

### 4.3 🟡 MEDIUM: Procedural Abilities Not Migrated

8 creatures marked `procedural: true` still need hardcoded handlers:

1. **whisper** - Elusive (can't be targeted turn summoned)
2. **cindermaw** - Frenzy (attacks twice)
3. **pulsefin** - Sonic Strike (first attack double)
4. **skitter** - Scurry (swap on damage)
5. **alpha** - Rally (bench assists attacks)
6. **broodmother** - Spawn (summon token at turn end)
7. **bulwark** - Fortress (survive lethal once)
8. **titanback** - Juggernaut (dual ability)

**Why they're hard to migrate:**
- Modify attack flow (cindermaw, pulsefin)
- Require player choice (skitter)
- Spawn tokens (broodmother)
- One-time flags (bulwark)

---

### 4.4 🟢 LOW: Documentation Gaps

#### CARD-AUTHORING.md claims:
> "All cards use declarative definitions. Most cards require **zero code changes**."

**Reality:** 8 creatures require code changes. The guide should document:
1. Which abilities are procedural
2. How to add new procedural abilities
3. Migration path for future declarative support

---

### 4.5 🟢 LOW: index.html is Too Large

| File | Lines | Concern |
|------|-------|---------|
| index.html | 6,226 | Monolithic, hard to test |
| All src/*.js | 3,046 | Well-modularized |

**Recommendation:** Extract to modules:
- `src/player-actions.js` (summon, cast, attack, retreat)
- `src/ai-turn.js` (aiTurnHunter, executeAiMove)
- `src/ko-resolution.js` (ko, death abilities)

---

## 5. Trigger Event Coverage

```
┌───────────────────────────────────────────────────────────────────┐
│                     EVENT COVERAGE MATRIX                         │
├───────────────┬───────────────┬───────────────┬───────────────────┤
│    Event      │  Set Verses   │   Creatures   │   Status          │
├───────────────┼───────────────┼───────────────┼───────────────────┤
│ beforeAttack  │ Phantom Wall  │       -       │ ✅ Migrated       │
│               │ Spike Shield  │               │                   │
├───────────────┼───────────────┼───────────────┼───────────────────┤
│ beforeDamage  │ Brace         │ Shellkin      │ ✅ Migrated       │
│               │ Swarm Shield  │ Pebbleback    │                   │
│               │               │ Ironhide      │                   │
├───────────────┼───────────────┼───────────────┼───────────────────┤
│ afterAttack   │       -       │ Thornling     │ ⚠️ HARDCODED     │
│               │               │ Coilshell     │                   │
│               │               │ Reflector     │                   │
│               │               │ Hexweaver     │                   │
│               │               │ Mireveil      │                   │
│               │               │ Leechling     │                   │
│               │               │ Sundewqueen   │                   │
├───────────────┼───────────────┼───────────────┼───────────────────┤
│ beforeKO      │ Vengeance     │       -       │ ✅ Migrated       │
├───────────────┼───────────────┼───────────────┼───────────────────┤
│ onKO          │ Den Mother    │ Gloom         │ ⚠️ PARTIAL       │
│               │ Grave Rise    │ Echomask      │ (death abilities  │
│               │               │ Stormtalon    │  still hardcoded) │
├───────────────┼───────────────┼───────────────┼───────────────────┤
│ onSummon      │ Soul Trap     │ Emberfang     │ ⚠️ PARTIAL       │
│               │               │ Duskfang      │ (entry abilities  │
│               │               │ Hiveling      │  still hardcoded) │
├───────────────┼───────────────┼───────────────┼───────────────────┤
│ onCast        │ Mana Drain    │       -       │ ✅ Migrated       │
├───────────────┼───────────────┼───────────────┼───────────────────┤
│ beforeLifeLoss│ Last Breath   │       -       │ ✅ Migrated       │
├───────────────┼───────────────┼───────────────┼───────────────────┤
│ turnEnd       │       -       │ Broodmother   │ ⚠️ HARDCODED     │
└───────────────┴───────────────┴───────────────┴───────────────────┘
```

---

## 6. Recommendations

### Immediate (Before v0.3.0)
1. **Update CARD-AUTHORING.md** to document procedural abilities
2. **Add migration notes** for which creatures need code

### Short-term (v0.3.x)
3. **Migrate afterAttack creatures** (Thornling, Coilshell, etc.)
4. **Migrate onSummon creatures** (Emberfang, Duskfang, Hiveling)
5. **Migrate death abilities** (Gloom, Echomask, Stormtalon)

### Medium-term (v0.4.x)
6. **Extract index.html** into modules
7. **Add turnEnd event** for Broodmother
8. **Design token system** for Spawn ability

### Long-term
9. **Fully declarative creatures** — zero hardcoded ID checks
10. **Visual ability editor** — generate card definitions

---

## 7. Test Coverage

```
┌────────────────────────────────────────┐
│         TEST COVERAGE BY MODULE        │
├────────────────────┬───────────────────┤
│ Module             │ Tests / Status    │
├────────────────────┼───────────────────┤
│ triggers.js        │ 42 tests ✅       │
│ effects.js         │ 46 tests ✅       │
│ abilities.js       │ 30 tests ✅       │
│ ai.js              │ 25 tests ✅       │
│ events.js          │ 13 tests ✅       │
│ render.js          │ 28 tests ✅       │
│ helpers.js         │ 25 tests ✅       │
│ state.js           │ 8 tests ✅        │
│ game.js            │ 8 tests ✅        │
│ anim.js            │ 5 tests ✅        │
├────────────────────┼───────────────────┤
│ index.html (game)  │ ~50 tests ⚠️      │
│                    │ (integration only)│
├────────────────────┼───────────────────┤
│ TOTAL              │ 276 passing       │
└────────────────────┴───────────────────┘
```

**Gap:** index.html has 6200+ lines but limited direct testing.
Most game logic is tested via integration tests.

---

## 8. Creature Ability Breakdown

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CREATURE ABILITY TYPES (29 total)                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │              DECLARATIVE (21 creatures)                   │    │
│   │                                                           │    │
│   │  ┌─────────────────┐    ┌─────────────────┐              │    │
│   │  │ Trigger+Effects │    │ Passive Only    │              │    │
│   │  │    (18)         │    │    (5)          │              │    │
│   │  │                 │    │                 │              │    │
│   │  │ thornling       │    │ bladewhisker    │              │    │
│   │  │ gloom           │    │ shadePup        │              │    │
│   │  │ mireveil        │    │ fangpup         │              │    │
│   │  │ hexweaver       │    │ piranix         │              │    │
│   │  │ duskfang        │    │ hollowfox       │              │    │
│   │  │ sundewqueen     │    └─────────────────┘              │    │
│   │  │ stormtalon      │                                     │    │
│   │  │ echomask        │    Note: 2 creatures have           │    │
│   │  │ emberfang       │    BOTH trigger AND procedural:     │    │
│   │  │ leechling       │    - skitter                        │    │
│   │  │ hiveling        │    - broodmother                    │    │
│   │  │ shellkin        │                                     │    │
│   │  │ pebbleback      │                                     │    │
│   │  │ ironhide        │                                     │    │
│   │  │ coilshell       │                                     │    │
│   │  │ reflector       │                                     │    │
│   │  └─────────────────┘                                     │    │
│   └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │              PROCEDURAL (8 creatures)                     │    │
│   │                                                           │    │
│   │  whisper     - Elusive (targeting immunity)               │    │
│   │  cindermaw   - Frenzy (double attack)                     │    │
│   │  pulsefin    - Sonic Strike (first-attack bonus)          │    │
│   │  skitter     - Scurry (damage swap) + trigger             │    │
│   │  alpha       - Rally (bench assist)                       │    │
│   │  broodmother - Spawn (token summon) + trigger             │    │
│   │  bulwark     - Fortress (survive lethal)                  │    │
│   │  titanback   - Juggernaut (dual: reduce + death dmg)      │    │
│   └───────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 9. Summary

| Metric | Value |
|--------|-------|
| Total Lines | 9,272 |
| Hardcoded Creature Checks | 67 |
| Declarative Creatures | 21/29 (72%) |
| Procedural Creatures | 8/29 (28%) |
| Event Types | 8 |
| Fully Migrated Events | 5/8 |
| Test Count | 276 |
| Test Pass Rate | 100% |

**Overall Health:** 🟡 GOOD with known technical debt

The event system is well-designed but migration is incomplete.
Core gameplay is solid; architecture needs continued cleanup.

---

## 10. Potential Bugs Found

### 10.1 ⚠️ Skitter has trigger but still procedural

`skitter` defines both `trigger` AND `procedural: true`:
```js
ability: {
  trigger: { event: 'afterDamage', condition: { target: 'self', survived: true } },
  effects: [{ type: 'swapWithBench', target: 'self' }],
  procedural: true  // ← Why both?
}
```

**Issue:** The `swapWithBench` effect type doesn't exist in `effects.js`.
The trigger definition is aspirational - actual behavior is hardcoded.

### 10.2 ⚠️ Broodmother same issue

Has `trigger` for `turnEnd` but marked procedural because `summonToken` effect doesn't exist.

### 10.3 ✅ Guards are present

All `.active.` accesses I reviewed have proper null guards.
No obvious null pointer bugs found.

### 10.4 ⚠️ Debug console.logs in production

12 `console.log` statements remain in index.html.
Consider using a debug flag or removing before v1.0.

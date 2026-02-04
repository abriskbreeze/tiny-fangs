# Tiny Fangs — Project Context for Claude

## Quick Start
```bash
cd ~/clawd/tiny-fangs
npm test              # Run tests (162 should pass)
npm run build         # Build to docs/ for GitHub Pages
launchctl stop com.tinyfangs.v2 && launchctl start com.tinyfangs.v2  # Restart local server
```

- **Local:** http://localhost:3004
- **Live:** https://abriskbreeze.github.io/tiny-fangs/
- **Version file:** `VERSION` (currently 0.2.4)

## Version Numbering
- Format: `0.X.Y` where Y can go past 9 (0.2.9 → 0.2.10 → 0.2.11)
- **DO NOT bump from 0.2.x to 0.3.x without Rico's approval**
- Update version in ALL 3 places in `index.html`:
  1. `<title>TINY FANGS v0.2.X</title>` (line ~6)
  2. `<p class="sub">v0.2.X • Card Battler</p>` (deck selection screen)
  3. `<div class="logo">TINY FANGS v0.2.X</div>` (mobile header)
- Also update `TODO.md` version history

## Architecture

### Files
```
index.html          # Main game (monolith, ~3600 lines)
src/
  state.js          # Game state singleton (state.G)
  game.js           # applyDamage() helper
  abilities.js      # ATK modifiers, damage reduction, ability effects
  anim.js           # All animations + ANIM_TIMING constants
  render.js         # Card rendering functions
  cards.js          # CREATURES, VERSES, DECKS definitions
  helpers.js        # Utility functions
tests/              # Vitest tests (162 total)
docs/               # Built output for GitHub Pages
```

### Key Patterns

**State Access:**
```js
import { state } from './src/state.js';
state.G.me        // Player state
state.G.opp       // AI opponent state
state.G.myTurn    // Boolean
```

**Player/Opponent Structure:**
```js
{
  active: creature | null,
  bench: [creature, creature],  // Max 2
  hand: [card...],
  deck: [card...],
  grave: [card...],
  setVerse: verse | null,
  lp: 3,                        // Lives
  mana: 0, maxMana: 5,
  denMotherBonus: 0             // One-shot attack buff
}
```

**Damage Application:**
```js
import { applyDamage } from './src/game.js';
const isKO = applyDamage(creature, amount);  // Clamps HP to 0, returns true if KO
```

**ATK Modifiers (for display):**
```js
import { getAtkModifiers } from './src/abilities.js';
const { baseAtk, effectiveAtk, modifiers } = getAtkModifiers(creature, owner, enemy);
// modifiers = [{ name: 'Rally', value: 20, desc: '2 benched' }, ...]
```

**Animations:**
```js
import { Anim, ANIM_TIMING } from './src/anim.js';
await Anim.summon('me');           // Active summon
await Anim.summonBench('me', idx); // Bench summon with spark burst
await Anim.benchToActive('me');    // Bench → active slide
await Anim.attack('me', 'opp', dmg);
Anim.floatText('SUMMON!', 'gold', element);
Anim.sparkBurst(element, 'purple'); // 'gold' or 'purple'
```

**Modals:**
```js
showModal('Title', [
  { name: 'Option', sub: 'description', action: () => { closeModal(); /* do thing */ } }
]);
```

### Card Types
- **Creatures:** Have HP, ATK, ability
- **Cast Verses:** One-time effect (gold border)
- **Set Verses:** Face-down trap with trigger (purple border)

### Abilities Implemented
| Creature | Ability | Effect |
|----------|---------|--------|
| Shade Pup | Orphan | +15 ATK when bench empty |
| Fangpup | Pack Bond | +10 ATK per benched creature |
| Alpha | Rally | +10 ATK per benched creature |
| Piranix | Feeding Frenzy | +15 ATK if enemy <50% HP |
| Vulpix | Den Guard | -10 damage from attacks (not verses) |
| Skitter | Scurry | When damaged, may swap with bench |
| Emberfang | Spark | Deal 5 on summon |
| Leechling | Drain | Heal equal to damage dealt |
| Hiveling | Swarm | Draw 1 on summon if 2+ creatures |
| Broodmother | Spawn | Summon Antling token end of turn |

### Set Verse Triggers
- `denMother`: On KO → next attack +10 (stored as `owner.denMotherBonus`)
- `swarmShield`: On attack received → -15 damage if has bench
- `graveRise`: On KO → revive 1-cost from grave (player chooses)
- `mirrorForce`: On KO from attack → survive at 1 HP, KO attacker

### Common Bugs Fixed (Reference)
1. **Animation in wrong place:** Use `getVisibleElement()` not `querySelector()` for elements that exist in both mobile/desktop
2. **Float text off-center:** Animation keyframes must include `translate(-50%, -50%)`
3. **Mana spent on failed cast:** Pre-check conditions before deducting mana
4. **Wrong selector:** Verify class names match (e.g., `.card-mini` not `.mini-card`)

## Testing
```bash
npm test                    # All tests
npm test -- tests/game.test.js  # Single file
```

Tests use Vitest. Mock state with:
```js
import { state, clearGame, setGame } from '../src/state.js';
beforeEach(() => clearGame());
```

## Deployment
1. `npm run build` → builds to `docs/`
2. `git push` → GitHub Pages auto-deploys from `docs/`
3. Restart local: `launchctl stop/start com.tinyfangs.v2`

## Style Guide
- ASCII only (no emoji)
- Cast verses = gold/orange
- Set verses = purple
- Damage = red, Heal = green
- Hearts for LP: ♥ (filled), ♡ (empty)

## TODO.md
Check `TODO.md` for version history and refactoring phases still in progress.

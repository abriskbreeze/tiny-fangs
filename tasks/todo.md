# Tiny Fangs — AI Difficulty System

## Goal
Replace fixed-order AI with intelligent decision-making. Three difficulty levels.

## Assumptions (to verify)
1. Score-based picking is sufficient for "smart" feel (no minimax needed initially)
2. AI should still feel beatable — not optimal play
3. All current AI actions work correctly (summon, bench, cast, set, attack)

## Difficulty Levels

| Level | Name | Behavior | Target Winrate |
|-------|------|----------|----------------|
| 1 | **Pup** | Current fixed-order. Predictable. | ~70% player wins |
| 2 | **Hunter** | Score-based. Evaluates options. | ~50% player wins |
| 3 | **Alpha** | 1-ply lookahead. Plays around traps. | ~30% player wins |

---

## Architecture

### Move Generation
```javascript
function getAllMoves(player, opponent) {
  const moves = [];
  
  // Summon moves (if no active or bench has room)
  for (const card of player.hand.filter(c => c.cardType === 'creature' && c.cost <= player.mana)) {
    if (!player.active) moves.push({ type: 'summon-active', card });
    if (player.bench.length < 2) moves.push({ type: 'summon-bench', card });
  }
  
  // Cast verse moves
  for (const card of player.hand.filter(c => c.type === 'cast' && c.cost <= player.mana)) {
    moves.push({ type: 'cast', card });
  }
  
  // Set verse moves
  if (!player.setVerse) {
    for (const card of player.hand.filter(c => c.type === 'set' && c.cost <= player.mana)) {
      moves.push({ type: 'set', card });
    }
  }
  
  // Attack move
  if (player.active && opponent.active) {
    moves.push({ type: 'attack' });
  }
  
  // Pass (always available)
  moves.push({ type: 'pass' });
  
  return moves;
}
```

### Scoring System
```javascript
function scoreMove(move, ai, player) {
  let score = 0;
  
  switch (move.type) {
    case 'summon-active':
      score = 100; // High priority if no active
      score += move.card.atk + move.card.hp;
      break;
    case 'summon-bench':
      score = 30 + move.card.atk;
      break;
    case 'cast':
      score = scoreCastVerse(move.card, ai, player);
      break;
    case 'set':
      score = scoreSetVerse(move.card, ai, player);
      break;
    case 'attack':
      score = scoreAttack(ai, player);
      break;
    case 'pass':
      score = 0;
      break;
  }
  
  return score;
}
```

---

## Implementation Tasks

### Phase 1: Move Generation & Scoring
- [ ] Create `src/ai.js` module
- [ ] `getAllMoves(player, opponent)` — generate all legal moves
- [ ] `scoreMove(move, ai, player)` — evaluate a single move
- [ ] Unit tests for move generation
- [ ] Unit tests for scoring edge cases

### Phase 2: Hunter AI (Score-Based)
- [ ] `aiTurnHunter()` — loop: get moves → score → pick best → execute → repeat
- [ ] Threshold: don't play moves with score < 10 (save mana)
- [ ] Integration with existing `aiTurn()`
- [ ] Manual playtest: feels smarter than Pup

### Phase 3: Alpha AI (Lookahead)
- [ ] `simulateMove(state, move)` — apply move to cloned state
- [ ] `evaluateBoard(ai, player)` — heuristic board evaluation
- [ ] `scoreWithLookahead(move, ai, player)` — consider opponent's best response
- [ ] Manual playtest: plays around traps, makes counter-plays

### Phase 4: Difficulty Selection
- [ ] Add difficulty selector to deck pick screen
- [ ] Store `state.G.aiDifficulty` (1/2/3)
- [ ] Route to correct AI function based on difficulty
- [ ] Default to Hunter (2)

---

## Scoring Heuristics (Hunter)

### Creatures
- `summon-active`: 100 + ATK + HP (urgent if no active)
- `summon-bench`: 30 + ATK (support)

### Cast Verses
| Card | Score Formula |
|------|---------------|
| manaSurge | 80 (free mana) |
| soulSiphon | 60 if both actives exist |
| ignite | 90 if can KO (enemy HP ≤ 15) |
| darkPact | 40 if LP > 1 and hand < 4 |
| predatorsMark | 70 if about to attack |
| banish | 80 if enemy ATK ≥ 40 |
| bloodMoon | 50 if net positive damage |
| secondWind | 60 if active HP < 50% |
| packTactics | 30 * creature count |
| graveEcho | 50 if creatures in grave |
| callOfTheWild | 60 if board has room |
| sacrifice | 40 if bench > 0 and hand < 3 |

### Set Verses
| Card | Score Formula |
|------|---------------|
| soulTrap | 40 (always decent) |
| phantomWall | 50 if enemy ATK > 30 |
| mirrorForce | 60 (strong counter) |
| graveRise | 40 if 1-cost in grave |
| lastBreath | 30 (insurance) |
| denMother | 35 (combo enabler) |
| swarmShield | 45 if bench > 0 |
| manaDrain | 55 (disruption) |

### Attack
- Base: 50
- +30 if can KO enemy active
- +20 if no risk of dying on counter
- -20 if enemy has set verse (might be trap)
- +40 if Predator's Mark active

---

## Acceptance Criteria

### Phase 1 ✓
```bash
npm test -- --grep "ai.test"  # All pass
```
- `getAllMoves` returns correct moves for given state
- `scoreMove` returns expected values for known scenarios

### Phase 2 ✓
- Hunter AI beats Pup AI in 10-game series (>60% winrate)
- Hunter never plays obviously bad moves (e.g., Dark Pact at 1 LP)
- Hunter prioritizes summon when no active

### Phase 3 ✓
- Alpha AI beats Hunter in 10-game series
- Alpha avoids attacking into obvious Phantom Wall
- Alpha sets up combos (Predator's Mark → Attack)

### Phase 4 ✓
- Difficulty selector visible on deck pick
- Selected difficulty persists through game
- Each difficulty feels distinctly different

---

## Notes

**Why not minimax?**
- Card games have hidden information (opponent's hand)
- Probabilistic outcomes (deck draws)
- Minimax assumes perfect information
- Score-based + simple lookahead is more appropriate

**Why module extraction?**
- `src/ai.js` keeps AI logic testable
- Easier to iterate on scoring without touching game.js
- Can A/B test different scoring weights

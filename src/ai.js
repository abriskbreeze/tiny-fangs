/**
 * AI Module — Move generation and scoring for Tiny Fangs
 * 
 * Difficulty Levels:
 * 1. Pup — Fixed order (legacy)
 * 2. Hunter — Score-based picking
 * 3. Alpha — 1-ply lookahead
 */

import { getEffectiveAtk } from './abilities.js';

/**
 * Generate all legal moves for a player
 * @param {Object} player - The AI player state
 * @param {Object} opponent - The opponent state
 * @param {boolean} canAttack - Whether attack is allowed (not first turn)
 * @returns {Array} List of move objects
 */
export function getAllMoves(player, opponent, canAttack = true) {
  const moves = [];
  
  // Summon creatures
  const playableCreatures = player.hand.filter(c => 
    c.cardType === 'creature' && c.cost <= player.mana
  );
  
  for (const card of playableCreatures) {
    // Summon to active (if empty)
    if (!player.active) {
      moves.push({ type: 'summon-active', card });
    }
    // Summon to bench (if room)
    if (player.bench.length < 2) {
      moves.push({ type: 'summon-bench', card });
    }
  }
  
  // Cast verses
  const playableCasts = player.hand.filter(c => 
    c.cardType === 'verse' && c.type === 'cast' && c.cost <= player.mana
  );
  
  for (const card of playableCasts) {
    moves.push({ type: 'cast', card });
  }
  
  // Set verses (if slot empty)
  if (!player.setVerse) {
    const playableSets = player.hand.filter(c => 
      c.cardType === 'verse' && c.type === 'set' && c.cost <= player.mana
    );
    
    for (const card of playableSets) {
      moves.push({ type: 'set', card });
    }
  }
  
  // Attack (if has active, opponent has active, and attacks allowed)
  if (player.active && opponent.active && canAttack) {
    moves.push({ type: 'attack' });
  }
  
  // Direct attack (if has active, opponent has no active)
  if (player.active && !opponent.active && canAttack) {
    moves.push({ type: 'attack-direct' });
  }
  
  // Pass is always available
  moves.push({ type: 'pass' });
  
  return moves;
}

/**
 * Score a single move
 * @param {Object} move - The move to score
 * @param {Object} ai - AI player state
 * @param {Object} player - Human player state (opponent)
 * @returns {number} Score (higher = better)
 */
export function scoreMove(move, ai, player) {
  switch (move.type) {
    case 'summon-active':
      return scoreSummonActive(move.card, ai, player);
    case 'summon-bench':
      return scoreSummonBench(move.card, ai, player);
    case 'cast':
      return scoreCast(move.card, ai, player);
    case 'set':
      return scoreSet(move.card, ai, player);
    case 'attack':
      return scoreAttack(ai, player);
    case 'attack-direct':
      return 200; // Direct LP damage is very high priority
    case 'pass':
      return 0;
    default:
      return 0;
  }
}

/**
 * Score summoning a creature to active slot
 */
function scoreSummonActive(card, ai, player) {
  let score = 100; // High base - having an active is critical
  
  // Create a mock creature to calculate effective ATK after summon
  const mockCreature = { ...card, curHp: card.hp };
  // Calculate effective ATK this creature would have (BUG-16 fix)
  const effectiveAtk = getEffectiveAtk(mockCreature, ai, player);
  
  // Prefer creatures that can survive enemy attack
  if (player.active) {
    const enemyAtk = getEffectiveAtk(player.active, player, ai);
    if (card.hp > enemyAtk) {
      score += 30; // Can survive at least one hit
    }
    if (effectiveAtk >= player.active.curHp) {
      score += 40; // Can KO enemy
    }
  }
  
  // Value stats (use effective ATK for valuation)
  score += effectiveAtk * 0.5;
  score += card.hp * 0.3;
  
  // Prefer lower cost when options are similar (save mana)
  score -= card.cost * 5;
  
  // Duskfang bonus if creatures in grave
  if (card.id === 'duskfang' && ai.grave.some(c => c.cardType === 'creature')) {
    score += 20;
  }
  
  return score;
}

/**
 * Score summoning a creature to bench
 */
function scoreSummonBench(card, ai, player) {
  let score = 30; // Lower base than active
  
  // Value stats (bench is backup)
  score += card.atk * 0.3;
  score += card.hp * 0.2;
  
  // Prefer cheap creatures for bench
  score -= card.cost * 8;
  
  // Swarm synergy - more bench = better for some cards
  if (ai.active?.id === 'vulpix') {
    score += 15; // Den Guard benefits from bench
  }
  if (ai.active?.id === 'alpha') {
    score += 20; // Pack Leader benefits
  }
  
  // Don't over-invest in bench if no active
  if (!ai.active) {
    score -= 20;
  }
  
  return score;
}

/**
 * Score casting a verse
 */
function scoreCast(card, ai, player) {
  switch (card.id) {
    case 'manaSurge':
      // Free mana is great, but don't use twice
      return ai.usedManaSurge ? -100 : 80;
      
    case 'soulSiphon':
      // Need both actives, better if we're damaged
      if (!player.active || !ai.active) return -100;
      const healValue = ai.active.curHp < ai.active.hp ? 30 : 0;
      return 50 + healValue;
      
    case 'ignite':
      // Amazing if can KO, otherwise mediocre
      if (!player.active) return -100;
      if (player.active.curHp <= 15) return 100; // KO!
      return 25;
      
    case 'darkPact':
      // Draw 2 lose 1 LP — only if safe
      if (ai.lp <= 1) return -100; // Would die
      if (ai.hand.length >= 5) return -50; // Hand already full
      return 45 + (5 - ai.hand.length) * 10; // Better when hand is empty
      
    case 'secondWind':
      // Heal 40 — only valuable if damaged
      if (!ai.active) return -100;
      const missing = ai.active.hp - ai.active.curHp;
      if (missing < 20) return -20; // Not worth it
      return 40 + missing;
      
    case 'predatorsMark':
      // +30 next attack — need to be able to attack (BUG-18 fix)
      if (!ai.active || !player.active) return -100;
      
      // Don't cast if we already attacked this turn (can't use it)
      if (ai.hasAttackedThisTurn) return -50;
      
      // Don't cast if we already have overwhelming advantage (can already KO)
      const myAtk = getEffectiveAtk(ai.active, ai, player);
      if (myAtk >= player.active.curHp) return 10; // Already can KO, low priority
      
      // Higher priority if the +30 would enable a KO
      if (myAtk + 30 >= player.active.curHp) return 85;
      
      return 70;
      
    case 'banish':
      // Remove enemy active — very strong
      if (!player.active) return -100;
      // More valuable against strong enemies
      return 60 + player.active.atk * 0.5;
      
    case 'bloodMoon':
      // 20 damage to all — need net positive (BUG-17 fix)
      
      // Don't cast if it would KO our active but not theirs
      if (ai.active?.curHp <= 20 && player.active?.curHp > 20) {
        return -100;
      }
      
      // Don't cast if we'd lose our only creature while they have backup
      if (ai.active?.curHp <= 20 && ai.bench.length === 0) {
        return -100;
      }
      
      const aiDmg = ai.active ? Math.min(20, ai.active.curHp) : 0;
      const playerDmg = player.active ? Math.min(20, player.active.curHp) : 0;
      const netDmg = playerDmg - aiDmg;
      
      // Bonus if it would KO their active but not ours
      if (player.active?.curHp <= 20 && (!ai.active || ai.active.curHp > 20)) {
        return 90;
      }
      
      if (netDmg <= 0) return -50;
      return 30 + netDmg * 2;
      
    case 'packTactics':
      // Draw per creature — need creatures
      const creatureCount = (ai.active ? 1 : 0) + ai.bench.length;
      if (creatureCount === 0) return -100;
      return 20 + creatureCount * 25;
      
    case 'graveEcho':
      // Return creature from grave
      const graveCreatures = ai.grave.filter(c => c.cardType === 'creature');
      if (!graveCreatures.length) return -100;
      // More valuable if good creature in grave
      const bestGrave = Math.max(...graveCreatures.map(c => c.atk + c.hp));
      return 30 + bestGrave * 0.3;
      
    case 'callOfTheWild':
      // Summon 1-cost from deck
      const hasOneCost = ai.deck?.some(c => c.cardType === 'creature' && c.cost === 1);
      if (!hasOneCost) return -100;
      const hasRoom = !ai.active || ai.bench.length < 2;
      if (!hasRoom) return -100;
      return 55;
      
    case 'sacrifice':
      // KO bench creature, draw 2
      if (ai.bench.length === 0) return -100;
      if (ai.hand.length >= 5) return -30;
      return 35;
      
    default:
      return 20; // Unknown cast verse, low priority
  }
}

/**
 * Score setting a verse
 */
function scoreSet(card, ai, player) {
  switch (card.id) {
    case 'soulTrap':
      // Damages summoned creatures — always decent
      return 40;
      
    case 'phantomWall':
      // Negates attack, deals 10 — better vs high ATK
      if (!player.active) return 20;
      return 35 + (player.active.atk > 30 ? 25 : 0);
      
    case 'mirrorForce':
      // Survive lethal + kill attacker — very strong
      return 60;
      
    case 'graveRise':
      // Summon 1-cost on KO
      const hasOneCostGrave = ai.grave.some(c => c.cardType === 'creature' && c.cost === 1);
      return hasOneCostGrave ? 50 : 30;
      
    case 'lastBreath':
      // Draw on KO — insurance
      return 30;
      
    case 'denMother':
      // +10 next attack on KO
      return 35;
      
    case 'swarmShield':
      // Reduce damage if bench — need bench
      if (ai.bench.length === 0) return 15;
      return 45;
      
    case 'manaDrain':
      // Counter spells — always useful
      return 55;
      
    default:
      return 25; // Unknown set verse
  }
}

/**
 * Score attacking
 */
function scoreAttack(ai, player) {
  if (!ai.active || !player.active) return -100;
  
  let score = 50; // Base attack value
  
  // Calculate damage we'd deal using ability-aware ATK (BUG-16 fix)
  let dmg = getEffectiveAtk(ai.active, ai, player);
  
  // Pulsefin First Strike doubles damage on first attack
  if (ai.active.id === 'pulsefin' && ai.active.firstAtk) dmg *= 2;
  // Cindermaw Rampage doubles damage
  if (ai.active.id === 'cindermaw') dmg *= 2;
  
  // Attack bonuses (Den Mother, Predator's Mark, etc.)
  if (ai.attackBonuses?.length > 0) {
    for (const bonus of ai.attackBonuses) {
      dmg += bonus.value;
    }
  }
  
  // Bonus for KO
  if (dmg >= player.active.curHp) {
    score += 50; // Can KO!
  }
  
  // Risk assessment - would we die on counterattack?
  const counterDmg = getEffectiveAtk(player.active, player, ai);
  if (counterDmg >= ai.active.curHp) {
    score -= 30; // We might die
  }
  
  // Fear of set verse (might be trap)
  if (player.setVerse) {
    score -= 25; // Cautious of traps
  }
  
  // Cindermaw self-damage consideration
  if (ai.active.id === 'cindermaw') {
    if (ai.active.curHp <= 10) {
      score -= 40; // Would kill ourselves
    }
  }
  
  return score;
}

/**
 * Pick the best move from a list
 * @param {Array} moves - List of scored moves
 * @param {number} threshold - Minimum score to play (default 10)
 * @returns {Object|null} Best move, or null if all below threshold
 */
export function pickBestMove(moves, threshold = 10) {
  if (!moves.length) return null;
  
  // Sort by score descending
  const sorted = [...moves].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  
  // Don't play if below threshold (save mana for later)
  if (best.score < threshold) {
    return { type: 'pass', score: 0 };
  }
  
  return best;
}

/**
 * Get all moves with their scores
 */
export function getScoredMoves(player, opponent, canAttack = true) {
  const moves = getAllMoves(player, opponent, canAttack);
  return moves.map(move => ({
    ...move,
    score: scoreMove(move, player, opponent)
  }));
}

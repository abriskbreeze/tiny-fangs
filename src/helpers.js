import { state } from './state.js';

// ═══════════════════════════════════════════════════════════════
// GAME HELPERS - Pure Logic
// ═══════════════════════════════════════════════════════════════

/**
 * Add entry to game log
 */
export function log(text, colorClass = '') {
  state.G.log.push({ t: text, c: colorClass });
}

/**
 * Draw a card from deck to hand
 * @returns {boolean} true if draw succeeded, false if deck empty
 */
export function drawCard(player) {
  if (player.deck.length === 0) {
    return false; // Deck out
  }
  player.hand.push(player.deck.pop());
  return true;
}

/**
 * Check deck-out condition
 */
export function checkDeckOut(player) {
  return player.deck.length === 0;
}

/**
 * Check if player should lose (LP <= 0)
 * @returns {{ shouldLose: boolean, lastBreathSaves: boolean }}
 */
export function checkPlayerLoss(player) {
  if (player.lp <= 0) {
    // Check Last Breath save
    if (player.setVerse?.id === 'lastBreath' && !player.usedLastBreath) {
      return { shouldLose: false, lastBreathSaves: true };
    }
    return { shouldLose: true, lastBreathSaves: false };
  }
  return { shouldLose: false, lastBreathSaves: false };
}

/**
 * Apply Last Breath effect
 */
export function applyLastBreath(player) {
  player.lp = 1;
  player.usedLastBreath = true;
  player.setVerse = null;
}

/**
 * Check win conditions for both players
 * @returns {{ winner: 'You' | 'Rival' | null, lastBreathTriggered: 'me' | 'opp' | null }}
 */
export function checkWinConditions() {
  const meCheck = checkPlayerLoss(state.G.me);
  const oppCheck = checkPlayerLoss(state.G.opp);
  
  if (meCheck.lastBreathSaves) {
    return { winner: null, lastBreathTriggered: 'me' };
  }
  if (oppCheck.lastBreathSaves) {
    return { winner: null, lastBreathTriggered: 'opp' };
  }
  if (meCheck.shouldLose) {
    return { winner: 'Rival', lastBreathTriggered: null };
  }
  if (oppCheck.shouldLose) {
    return { winner: 'You', lastBreathTriggered: null };
  }
  return { winner: null, lastBreathTriggered: null };
}

// ═══════════════════════════════════════════════════════════════
// KO EFFECTS - Pure Logic (no UI)
// ═══════════════════════════════════════════════════════════════

/**
 * Check if Mirror Force should trigger
 */
export function shouldMirrorForceTrigger(owner, hasAttacker) {
  return hasAttacker && owner.setVerse?.id === 'mirrorForce';
}

/**
 * Apply Mirror Force effect (pure state changes)
 */
export function applyMirrorForce(defender, defenderOwner, attacker, attackerOwner) {
  defender.curHp = 1; // Survive with 1 HP
  defenderOwner.grave.push(defenderOwner.setVerse);
  defenderOwner.setVerse = null;
  
  // KO the attacker
  attackerOwner.grave.push(attacker);
  if (attackerOwner.active?.uid === attacker.uid) {
    attackerOwner.active = null;
  }
}

/**
 * Check if Grave Rise should trigger
 */
export function shouldGraveRiseTrigger(owner) {
  return owner.setVerse?.id === 'graveRise';
}

/**
 * Apply Grave Rise effect
 * @returns {Object|null} The revived creature or null
 */
export function applyGraveRise(owner) {
  const oneCost = owner.grave.filter(c => c.cardType === 'creature' && c.cost === 1);
  if (oneCost.length && owner.bench.length < 2) {
    const revived = oneCost[0];
    revived.curHp = revived.hp; // Full heal
    owner.grave = owner.grave.filter(x => x.uid !== revived.uid);
    owner.bench.push(revived);
    owner.grave.push(owner.setVerse);
    owner.setVerse = null;
    return revived;
  }
  owner.grave.push(owner.setVerse);
  owner.setVerse = null;
  return null;
}

/**
 * Apply Gloom's Fade effect (discard random enemy card)
 */
export function applyGloomFade(enemy) {
  if (enemy.hand.length > 0) {
    const idx = Math.floor(Math.random() * enemy.hand.length);
    enemy.grave.push(enemy.hand.splice(idx, 1)[0]);
    return true;
  }
  return false;
}

/**
 * Apply Echomask's Shatter effect (enemy loses 1 LP)
 */
export function applyEchomaskShatter(enemy) {
  enemy.lp -= 1;
}

/**
 * Apply Stormtalon's Chain Lightning effect (arm for next summon)
 */
export function applyStormtalonChainLightning(enemy) {
  enemy.chainLightning = 20;
}

/**
 * Process creature death effects based on creature ID
 * @returns {{ gloomFade: boolean, echomaskShatter: boolean, chainLightning: boolean }}
 */
export function processDeathEffects(creature, owner) {
  const enemy = owner === state.G.me ? state.G.opp : state.G.me;
  const effects = { gloomFade: false, echomaskShatter: false, chainLightning: false };
  
  if (creature.id === 'gloom') {
    effects.gloomFade = applyGloomFade(enemy);
  }
  if (creature.id === 'echomask') {
    applyEchomaskShatter(enemy);
    effects.echomaskShatter = true;
  }
  if (creature.id === 'stormtalon') {
    applyStormtalonChainLightning(enemy);
    effects.chainLightning = true;
  }
  
  return effects;
}

/**
 * Move creature to grave and clear active
 */
export function sendToGrave(creature, owner) {
  owner.grave.push(creature);
  owner.active = null;
}

/**
 * Auto-replace from bench
 * @returns {Object|null} The replacement creature or null
 */
export function autoReplace(owner) {
  if (owner.bench.length > 0) {
    owner.active = owner.bench.shift();
    return owner.active;
  }
  return null;
}

/**
 * Check if chain lightning should hit replacement
 */
export function shouldChainLightningHit(owner) {
  return owner.chainLightning > 0 && owner.active;
}

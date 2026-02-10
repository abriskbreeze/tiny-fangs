// ═══════════════════════════════════════════════════════════════
// GAME ENGINE (Server-side)
// ═══════════════════════════════════════════════════════════════
// Phase 2 Migration: Now uses shared/ for card creation and game initialization
// Complex effects logic still here - will move to shared/ in Phase 3/4

// Import from shared module (single source of truth)
import {
  CREATURES,
  VERSES,
  DECKS,
  mkCreature,
  mkVerse,
  mkDeck,
  mkPlayer as sharedMkPlayer,
  createGame as sharedCreateGame
} from '../shared/index.js';
import { processEffects } from '../shared/effects.js';

// ═══════════════════════════════════════════════════════════════
// GAME INITIALIZATION (Re-export from shared)
// ═══════════════════════════════════════════════════════════════

export function mkPlayer(deckId) {
  return sharedMkPlayer(deckId);
}

export function createGame(deck1Id, deck2Id) {
  return sharedCreateGame(deck1Id, deck2Id);
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Draw a card from player's deck
 * @param {object} player - Player object
 * @returns {object} - { success: boolean, events: [] }
 */
export function draw(player) {
  const events = [];
  
  if (player.deck.length === 0) {
    return { success: false, events };
  }
  
  const card = player.deck.pop();
  player.hand.push(card);
  events.push({ type: 'draw', count: 1 });
  
  return { success: true, events };
}

/**
 * Apply damage to a creature
 * @param {object} creature - Creature to damage
 * @param {number} amount - Damage amount
 * @returns {boolean} - True if creature was KO'd
 */
export function applyDamage(creature, amount) {
  creature.curHp -= amount;
  return creature.curHp <= 0;
}

/**
 * Auto-swap bench creature to active if active is empty
 * @param {object} player - Player object
 * @param {string} side - 'p1' or 'p2'
 * @param {array} events - Events array to push to
 */
function autoSwapBenchToActive(player, side, events) {
  if (!player.active && player.bench.length > 0) {
    const swapped = player.bench.shift();
    player.active = swapped;
    events.push({ type: 'benchToActive', side, creature: swapped.name });
  }
}

/**
 * Get effective attack value for a creature
 * @param {object} creature - Attacking creature
 * @param {object} owner - Owner player
 * @param {object} opponent - Opponent player
 * @returns {number} - Effective attack value
 */
export function getEffectiveAtk(creature, owner, opponent) {
  let atk = creature.atk;
  
  // Apply passive abilities
  if (creature.ability?.passive?.type === 'atkBonus') {
    const bonus = creature.ability.passive.amount;
    const condition = creature.ability.passive.condition;
    
    if (!condition || checkCondition(condition, owner, opponent, creature)) {
      if (typeof bonus === 'number') {
        atk += bonus;
      }
    }
  }
  
  // Apply creature-specific attack bonuses (from triggered abilities like Duskfang's Pack Call)
  if (creature.atkBonuses) {
    for (const bonus of creature.atkBonuses) {
      atk += bonus.value;
    }
  }
  
  // Apply temporary attack bonuses (player-level, like Predator's Mark)
  for (const bonus of owner.attackBonuses) {
    atk += bonus.value;
  }
  
  // Echomask: ATK equals enemy creature's ATK
  if (creature.id === 'echomask' && opponent.active) {
    atk = opponent.active.atk;
  }
  
  // Alpha Rally: Bench creatures assist (+10 each)
  if (creature.id === 'alpha') {
    atk += owner.bench.length * 10;
  }
  
  // Pack Bond: +10 ATK per other creature
  if (creature.id === 'fangpup') {
    const otherCreatures = (owner.active && owner.active.uid !== creature.uid ? 1 : 0) + 
                          (owner.bench.filter(c => c.uid !== creature.uid).length);
    atk += otherCreatures * 10;
  }
  
  return atk;
}

/**
 * Check if a condition is met
 */
function checkCondition(condition, owner, opponent, creature) {
  if (condition === 'me.bench.empty') {
    return owner.bench.length === 0;
  }
  if (condition === 'me.bench.notEmpty') {
    return owner.bench.length > 0;
  }
  if (condition === 'me.grave.hasCreature') {
    return owner.grave.some(c => c.cardType === 'creature');
  }
  if (condition === 'opp.active') {
    return opponent.active !== null;
  }
  if (condition === 'opp.active.belowHalf') {
    return opponent.active && opponent.active.curHp < opponent.active.hp / 2;
  }
  return true;
}

/**
 * Get ATK modifiers for display
 */
export function getAtkModifiers(creature, owner, opponent) {
  const baseAtk = creature.atk;
  const effectiveAtk = getEffectiveAtk(creature, owner, opponent);
  const modifiers = [];
  
  if (effectiveAtk !== baseAtk) {
    const diff = effectiveAtk - baseAtk;
    if (creature.ability?.passive?.type === 'atkBonus') {
      modifiers.push({ name: creature.ability.name, value: diff });
    }
    for (const bonus of owner.attackBonuses) {
      modifiers.push({ name: bonus.source, value: bonus.value });
    }
  }
  
  return { baseAtk, effectiveAtk, modifiers };
}

// ═══════════════════════════════════════════════════════════════
// TRIGGER SYSTEM
// ═══════════════════════════════════════════════════════════════

/**
 * Build context object for processEffects from server variables
 * Maps server naming (owner/enemy) to shared module naming (me/opp)
 */
function buildEffectsContext(context, owner, enemy, ownerSide, enemySide) {
  return {
    me: owner,
    opp: enemy,
    meSide: ownerSide,
    oppSide: enemySide,
    attacker: context.attacker,
    defender: context.defender,
    summoned: context.creature,
    koedCreature: context.koedCreature,
    damage: context.damage,
    selected: context.selected,
    // Add attackerOwner/attackerOwnerKey for damage to attacker
    attackerOwner: enemy,
    attackerOwnerKey: 'opp',
  };
}

/**
 * Process cast verse effects using shared processEffects
 * Handles KOs and returns events for the caller
 * @param {object} card - The verse card being cast
 * @param {object} ctx - Effects context from buildEffectsContext
 * @param {object} player - Casting player
 * @param {object} opponent - Opponent player
 * @param {string} side - Player side ('p1' or 'p2')
 * @param {string} oppSide - Opponent side
 * @returns {{ events: array, result: object }}
 */
function processCastVerseEffects(card, ctx, player, opponent, side, oppSide) {
  const verseTemplate = VERSES[card.id];
  const result = processEffects(verseTemplate, ctx);
  const events = [...result.events];
  
  // Handle KOs from effects
  for (const koInfo of result.kos || []) {
    const koOwner = koInfo.owner || (koInfo.ownerKey === 'me' ? player : opponent);
    const koSide = koOwner === player ? side : oppSide;
    
    events.push({ type: 'ko', side: koSide, creature: koInfo.creature.name });
    koOwner.grave.push(koInfo.creature);
    
    // Clear from board
    if (koOwner.active?.uid === koInfo.creature.uid) {
      koOwner.active = null;
      // Auto-swap bench to active
      autoSwapBenchToActive(koOwner, koSide, events);
    } else {
      koOwner.bench = koOwner.bench.filter(c => c.uid !== koInfo.creature.uid);
    }
  }
  
  return { events, result };
}

/**
 * Check if a verse matches a trigger event
 * @param {object} verse - Set verse card
 * @param {string} event - Event type to check
 * @returns {boolean} - True if verse triggers on this event
 */
function matchesTrigger(verse, event) {
  const triggers = {
    phantomWall: 'beforeAttack',
    spikeShield: 'beforeAttack',
    brace: 'beforeDamage',
    swarmShield: 'beforeDamage',
    soulTrap: 'onSummon',
    vengeance: 'onLethalDamage',
    graveRise: 'onKO',
    denMother: 'onAllyKO',
    manaDrain: 'onCast',
    lastBreath: 'onLifeLoss'
  };
  return triggers[verse.id] === event;
}

/**
 * Execute a triggered verse
 * @param {object} verse - Set verse card
 * @param {object} context - Event context (varies by trigger type)
 * @param {object} owner - Owner of the set verse
 * @param {object} enemy - Opponent player
 * @param {string} ownerSide - 'p1' or 'p2' for owner
 * @param {string} enemySide - 'p1' or 'p2' for enemy
 * @returns {object} - { events: [], negated: boolean, damageReduction: number, modifiedDamage: number }
 */
function executeTrigger(verse, context, owner, enemy, ownerSide, enemySide) {
  const events = [];
  let negated = false;
  let damageReduction = 0;
  let modifiedDamage = null;
  
  events.push({ type: 'triggerVerse', side: ownerSide, verse: verse.name });
  
  switch (verse.id) {
    case 'phantomWall': {
      // Use processEffects from shared module
      const verseTemplate = VERSES[verse.id];
      const ctx = buildEffectsContext(context, owner, enemy, ownerSide, enemySide);
      const result = processEffects(verseTemplate, ctx);
      events.push(...result.events);
      if (result.modifiedContext?.attackNegated) negated = true;
      // Handle KOs from damage effects
      for (const koInfo of result.kos || []) {
        events.push({ type: 'ko', side: enemySide, creature: koInfo.creature.name });
        enemy.grave.push(koInfo.creature);
        if (enemy.active?.uid === koInfo.creature.uid) enemy.active = null;
      }
      break;
    }
      
    case 'spikeShield': {
      // Use processEffects from shared module
      const verseTemplate = VERSES[verse.id];
      const ctx = buildEffectsContext(context, owner, enemy, ownerSide, enemySide);
      const result = processEffects(verseTemplate, ctx);
      events.push(...result.events);
      // Handle KOs from damage effects
      for (const koInfo of result.kos || []) {
        events.push({ type: 'ko', side: enemySide, creature: koInfo.creature.name });
        enemy.grave.push(koInfo.creature);
        if (enemy.active?.uid === koInfo.creature.uid) enemy.active = null;
      }
      break;
    }
      
    case 'brace': {
      // Use processEffects from shared module
      const verseTemplate = VERSES[verse.id];
      const ctx = buildEffectsContext(context, owner, enemy, ownerSide, enemySide);
      const result = processEffects(verseTemplate, ctx);
      events.push(...result.events);
      if (result.modifiedContext?.damageReduction) {
        damageReduction = result.modifiedContext.damageReduction;
      }
      break;
    }
      
    case 'swarmShield': {
      // Use processEffects from shared module (perBench computed amount)
      const verseTemplate = VERSES[verse.id];
      const ctx = buildEffectsContext(context, owner, enemy, ownerSide, enemySide);
      const result = processEffects(verseTemplate, ctx);
      events.push(...result.events);
      if (result.modifiedContext?.damageReduction) {
        damageReduction = result.modifiedContext.damageReduction;
      }
      break;
    }
      
    case 'soulTrap': {
      // Use processEffects from shared module
      const verseTemplate = VERSES[verse.id];
      const ctx = buildEffectsContext(context, owner, enemy, ownerSide, enemySide);
      const result = processEffects(verseTemplate, ctx);
      events.push(...result.events);
      // Handle KOs from damage effects
      for (const koInfo of result.kos || []) {
        events.push({ type: 'ko', side: enemySide, creature: koInfo.creature.name });
        enemy.grave.push(koInfo.creature);
        // Remove from board (could be active or bench for summoned creatures)
        if (enemy.active?.uid === koInfo.creature.uid) {
          enemy.active = null;
        } else {
          enemy.bench = enemy.bench.filter(c => c.uid !== koInfo.creature.uid);
        }
      }
      break;
    }
      
    case 'vengeance': {
      // Use processEffects from shared module (negateKO + destroy attacker)
      const verseTemplate = VERSES[verse.id];
      const ctx = buildEffectsContext(context, owner, enemy, ownerSide, enemySide);
      // Set target to defender for negateKO's setHP effect
      ctx.target = context.defender;
      const result = processEffects(verseTemplate, ctx);
      events.push(...result.events);
      
      if (result.modifiedContext?.koNegated && context.defender) {
        // Defender survives at 1 HP (set by negateKO)
        modifiedDamage = context.defender.hp - 1; // Prevent KO
      }
      
      if (result.modifiedContext?.destroyed && result.modifiedContext?.destroyedOwner) {
        // Attacker was destroyed - already handled by destroy effect
        events.push({ type: 'ko', side: enemySide, creature: context.attacker?.name, source: 'Vengeance' });
      }
      break;
    }
      
    case 'graveRise': {
      // Use processEffects from shared module (summonFromGrave)
      const verseTemplate = VERSES[verse.id];
      const ctx = buildEffectsContext(context, owner, enemy, ownerSide, enemySide);
      const result = processEffects(verseTemplate, ctx);
      
      // Convert shared module events to server events
      for (const evt of result.events) {
        if (evt.type === 'summonBench') {
          // Find the creature that was just added to bench
          const creature = owner.bench[owner.bench.length - 1];
          events.push({ type: 'summon', side: ownerSide, creature: creature?.name, slot: 'bench', source: 'Grave Rise' });
        } else if (evt.type === 'log') {
          // Skip log events for now (different format)
        } else {
          events.push(evt);
        }
      }
      break;
    }
      
    case 'denMother':
      // CUSTOM: onAllyKO - Summon 1-cost creature from deck
      // Kept as custom because:
      // 1. Searches deck for specific cost creature (not random)
      // 2. Complex placement logic: active > bench > grave
      // 3. The 'summon' effect doesn't support the "send to grave if full" fallback
      if (context.koedCreature) {
        // Find a 1-cost creature in deck
        const oneCostIdx = owner.deck.findIndex(c => c.cardType === 'creature' && c.cost === 1);
        if (oneCostIdx !== -1) {
          const summonedCreature = owner.deck.splice(oneCostIdx, 1)[0];
          
          // Place in active or bench
          if (!owner.active) {
            owner.active = summonedCreature;
            events.push({ type: 'summon', side: ownerSide, creature: summonedCreature.name, slot: 'active', source: 'Den Mother' });
          } else if (owner.bench.length < 2) {
            owner.bench.push(summonedCreature);
            events.push({ type: 'summon', side: ownerSide, creature: summonedCreature.name, slot: 'bench', source: 'Den Mother' });
          } else {
            // No space, send to grave
            owner.grave.push(summonedCreature);
          }
        }
      }
      break;
      
    case 'manaDrain': {
      // Use processEffects from shared module (negateSpell + gainMana)
      const verseTemplate = VERSES[verse.id];
      const ctx = buildEffectsContext(context, owner, enemy, ownerSide, enemySide);
      const result = processEffects(verseTemplate, ctx);
      events.push(...result.events);
      
      if (result.modifiedContext?.negated) {
        negated = true;
      }
      // Cap mana at maxMana (gainMana doesn't do this)
      owner.mana = Math.min(owner.maxMana, owner.mana);
      // Add server-format mana gain event
      events.push({ type: 'manaGain', side: ownerSide, amount: 2, source: 'Mana Drain' });
      break;
    }
      
    case 'lastBreath': {
      // CUSTOM: onLifeLoss - Negate lethal LP loss (once per game)
      // Kept as custom because:
      // 1. One-time-use flag (usedLastBreath) checked BEFORE triggering
      // 2. Condition depends on runtime state (LP vs damage amount)
      // 3. The triggerDef condition system doesn't support "notUsed" flag checks
      const damageAmount = context.amount || 1;
      if (!owner.usedLastBreath && owner.lp <= damageAmount) {
        negated = true;
        owner.usedLastBreath = true;
        events.push({ type: 'triggerVerse', side: ownerSide, verse: 'Last Breath' });
      }
      break;
    }
  }
  
  return { events, negated, damageReduction, modifiedDamage };
}

/**
 * Check for and execute triggered set verses
 * @param {string} event - Event type
 * @param {object} context - Event context
 * @param {object} activePlayer - Current player
 * @param {object} inactivePlayer - Opponent player
 * @param {string} activeSide - 'p1' or 'p2'
 * @param {string} inactiveSide - 'p1' or 'p2'
 * @returns {object} - { events: [], negated: boolean, damageReduction: number, modifiedDamage: number }
 */
function checkTriggers(event, context, activePlayer, inactivePlayer, activeSide, inactiveSide) {
  console.log('[DEBUG] checkTriggers called:', event, 'defender verse:', inactivePlayer.setVerse?.id, 'attacker verse:', activePlayer.setVerse?.id);
  const events = [];
  let negated = false;
  let damageReduction = 0;
  let modifiedDamage = null;
  let pendingAction = null;
  
  // Check inactive player's set verse first (defender advantage)
  const defenderVerse = inactivePlayer.setVerse;
  if (defenderVerse && matchesTrigger(defenderVerse, event)) {
    // Check if optional trigger
    const verseTemplate = VERSES[defenderVerse.id];
    if (verseTemplate?.triggerDef?.optional) {
      // Return pending action instead of executing
      pendingAction = {
        type: 'optionalTrigger',
        side: inactiveSide,
        verseId: defenderVerse.id,
        verseName: defenderVerse.name,
        prompt: `Activate ${defenderVerse.name}?`,
        context: { ...context }
      };
      return { events, negated, damageReduction, modifiedDamage, pendingAction };
    }
    
    // Non-optional - execute immediately
    const result = executeTrigger(defenderVerse, context, inactivePlayer, activePlayer, inactiveSide, activeSide);
    events.push(...result.events);
    if (result.negated) negated = true;
    if (result.damageReduction) damageReduction = result.damageReduction;
    if (result.modifiedDamage !== null) modifiedDamage = result.modifiedDamage;
    
    // Consume set verse
    inactivePlayer.grave.push(defenderVerse);
    inactivePlayer.setVerse = null;
  }
  
  // Check active player's set verse (for their own triggers like onAllyKO, onLifeLoss)
  const attackerVerse = activePlayer.setVerse;
  if (attackerVerse && matchesTrigger(attackerVerse, event) && !negated) {
    // Check if optional trigger
    const verseTemplate = VERSES[attackerVerse.id];
    if (verseTemplate?.triggerDef?.optional) {
      // Return pending action instead of executing
      pendingAction = {
        type: 'optionalTrigger',
        side: activeSide,
        verseId: attackerVerse.id,
        verseName: attackerVerse.name,
        prompt: `Activate ${attackerVerse.name}?`,
        context: { ...context }
      };
      return { events, negated, damageReduction, modifiedDamage, pendingAction };
    }
    
    // Non-optional - execute immediately
    const result = executeTrigger(attackerVerse, context, activePlayer, inactivePlayer, activeSide, inactiveSide);
    events.push(...result.events);
    if (result.negated) negated = true;
    if (result.damageReduction) damageReduction += result.damageReduction;
    if (result.modifiedDamage !== null) modifiedDamage = result.modifiedDamage;
    
    // Consume set verse
    activePlayer.grave.push(attackerVerse);
    activePlayer.setVerse = null;
  }
  
  return { events, negated, damageReduction, modifiedDamage, pendingAction };
}

// ═══════════════════════════════════════════════════════════════
// EXECUTE ACTION
// ═══════════════════════════════════════════════════════════════

/**
 * Execute a game action
 * @param {object} state - Game state
 * @param {number} playerIdx - Player index (0 or 1)
 * @param {object} action - Action object { action: 'summon'|'attack'|'cast'|'set'|'retreat', ...params }
 * @returns {object} - { state, events, error? }
 */
export function executeAction(state, playerIdx, action) {
  const events = [];
  
  // Validate it's this player's turn
  if (state.currentPlayer !== playerIdx + 1) {
    return { state, events, error: "Not your turn" };
  }
  
  const player = state.players[playerIdx];
  const opponent = state.players[1 - playerIdx];
  const side = playerIdx === 0 ? 'p1' : 'p2';
  const oppSide = playerIdx === 0 ? 'p2' : 'p1';
  
  // Execute based on action type
  switch (action.action) {
    case 'summon': {
      const card = player.hand.find(c => c.uid === action.cardUid);
      if (!card || card.cardType !== 'creature') {
        return { state, events, error: "Invalid card" };
      }
      
      if (card.cost > player.mana) {
        return { state, events, error: "Not enough mana" };
      }
      
      // Deduct mana and remove from hand
      player.mana -= card.cost;
      player.hand = player.hand.filter(c => c.uid !== action.cardUid);
      
      // Determine summon location
      const location = action.target || (!player.active ? 'active' : 'bench');
      
      if (location === 'active') {
        if (player.active) {
          return { state, events, error: "Active slot occupied" };
        }
        player.active = card;
        card.summonedThisTurn = true;
        events.push({ type: 'summon', side, creature: card.name, slot: 'active' });
      } else {
        if (player.bench.length >= 2) {
          return { state, events, error: "Bench full" };
        }
        player.bench.push(card);
        card.summonedThisTurn = true;
        events.push({ type: 'summon', side, creature: card.name, slot: 'bench' });
      }
      
      // CHECK: onSummon trigger (opponent's set verses like soulTrap)
      const onSummonTrigger = checkTriggers('onSummon', { creature: card }, player, opponent, side, oppSide);
      events.push(...onSummonTrigger.events);
      
      // === CREATURE ON-SUMMON ABILITIES (Using processEffects) ===
      const creatureCard = CREATURES[card.id];
      if (creatureCard?.ability?.trigger?.event === 'onSummon') {
        // Check location condition for Hiveling (only triggers on bench summon)
        const locationCondition = creatureCard.ability.trigger.condition?.location;
        const locationMatches = !locationCondition || locationCondition === location;
        
        if (locationMatches) {
          const ctx = buildEffectsContext({ creature: card }, player, opponent, side, oppSide);
          ctx.card = creatureCard;
          ctx.self = card;  // For atkBonus target: 'self'
          ctx.draw = () => draw(player);  // For draw effects
          
          const result = processEffects(creatureCard.ability, ctx);
          
          // Add ability trigger event if any effects were processed
          if (result.events.length > 0 || result.kos?.length > 0) {
            events.push({ type: 'abilityTrigger', side, creature: card.name, ability: creatureCard.ability.name });
          }
          
          // Convert shared module events to server format
          for (const evt of result.events) {
            if (evt.type === 'damage') {
              events.push({ type: 'damage', side: oppSide, amount: evt.amount, source: creatureCard.ability.name });
            } else if (evt.type === 'draw') {
              events.push(evt);
            } else if (evt.type === 'log') {
              // Skip log events (different format)
            } else {
              events.push(evt);
            }
          }
          
          // Handle KOs from damage effects (e.g., Emberfang's Spark)
          for (const koInfo of result.kos || []) {
            events.push({ type: 'ko', side: oppSide, creature: koInfo.creature.name });
            opponent.grave.push(koInfo.creature);
            if (opponent.active?.uid === koInfo.creature.uid) opponent.active = null;
          }
        }
      }
      
      break;
    }
    
    case 'attack': {
      if (!player.active) {
        return { state, events, error: "No active creature" };
      }
      
      if (state.firstTurn) {
        return { state, events, error: "Cannot attack on first turn" };
      }
      
      if (state.hasAttacked) {
        return { state, events, error: "Already attacked this turn" };
      }
      
      if (state.hasRetreated) {
        return { state, events, error: "Cannot attack after retreating" };
      }
      
      const attacker = player.active;
      const defender = opponent.active;
      
      // CHECK: beforeAttack trigger
      const beforeAttackTrigger = checkTriggers('beforeAttack', { attacker, defender }, player, opponent, side, oppSide);
      events.push(...beforeAttackTrigger.events);
      if (beforeAttackTrigger.negated) {
        state.hasAttacked = true;
        break; // Attack negated - don't process further
      }
      
      // Cindermaw: Frenzy - attacks twice
      const attackCount = attacker.id === 'cindermaw' ? 2 : 1;
      if (attacker.id === 'cindermaw') {
        events.push({ type: 'abilityTrigger', side, creature: attacker.name, ability: 'Frenzy' });
      }
      
      // Attack loop (Cindermaw attacks twice, others once)
      for (let hit = 0; hit < attackCount; hit++) {
        // Skip if attacker died (from reflection damage, etc.)
        if (!player.active || player.active.uid !== attacker.uid) break;
        
      // Calculate damage
      let damage = getEffectiveAtk(attacker, player, opponent);
      
      // Pulsefin: First attack deals double damage
      if (attacker.id === 'pulsefin' && attacker.firstAtk) {
        damage *= 2;
        attacker.firstAtk = false;
        events.push({ type: 'abilityTrigger', side, creature: attacker.name, ability: 'Sonic Strike' });
        events.push({ type: 'atkBonus', side, amount: damage / 2, source: 'Sonic Strike' });
      }
      
      // Clear attack bonuses after use
      player.attackBonuses = [];
      
      if (defender) {
        // Attack creature
        events.push({ type: 'attack', side, damage });
        
        // CHECK: beforeDamage trigger
        const beforeDamageTrigger = checkTriggers('beforeDamage', { attacker, defender, damage }, player, opponent, side, oppSide);
        events.push(...beforeDamageTrigger.events);
        
        // Apply damage reduction from set verses
        if (beforeDamageTrigger.damageReduction) {
          damage = Math.max(0, damage - beforeDamageTrigger.damageReduction);
        }
        
        // === CREATURE PASSIVE DAMAGE REDUCTION ===
        
        // Unbreakable verse - prevent ALL damage
        if (opponent.unbreakable) {
          damage = 0;
          opponent.unbreakable = false;
          events.push({ type: 'damageNegated', side: oppSide, source: 'Unbreakable' });
        }
        
        // Ironhide: Always takes -10 damage
        if (defender.id === 'ironhide' && damage > 0) {
          const reduction = Math.min(10, damage);
          damage -= reduction;
          events.push({ type: 'abilityTrigger', side: oppSide, creature: defender.name, ability: 'Iron Skin' });
          events.push({ type: 'damageReduced', side: oppSide, amount: reduction, source: 'Iron Skin' });
        }
        
        // Pebbleback: Always takes -5 damage
        if (defender.id === 'pebbleback' && damage > 0) {
          const reduction = Math.min(5, damage);
          damage -= reduction;
          events.push({ type: 'abilityTrigger', side: oppSide, creature: defender.name, ability: 'Sturdy' });
          events.push({ type: 'damageReduced', side: oppSide, amount: reduction, source: 'Sturdy' });
        }
        
        // Shellkin: Negate first 10 damage each turn
        if (defender.id === 'shellkin' && !defender.shellkinUsed && damage > 0) {
          const reduction = Math.min(10, damage);
          damage -= reduction;
          defender.shellkinUsed = true;
          events.push({ type: 'abilityTrigger', side: oppSide, creature: defender.name, ability: 'Harden' });
          events.push({ type: 'damageReduced', side: oppSide, amount: reduction, source: 'Harden' });
        }
        
        // Titanback: Resist first 15 damage per turn
        if (defender.id === 'titanback' && !defender.titanbackUsed && damage > 0) {
          const reduction = Math.min(15, damage);
          damage -= reduction;
          defender.titanbackUsed = true;
          events.push({ type: 'abilityTrigger', side: oppSide, creature: defender.name, ability: 'Juggernaut' });
          events.push({ type: 'damageReduced', side: oppSide, amount: reduction, source: 'Juggernaut' });
        }
        
        // Hollowfox: -10 damage while having bench
        if (defender.id === 'hollowfox' && opponent.bench.length > 0 && damage > 0) {
          const reduction = Math.min(10, damage);
          damage -= reduction;
          events.push({ type: 'abilityTrigger', side: oppSide, creature: defender.name, ability: 'Den Guard' });
          events.push({ type: 'damageReduced', side: oppSide, amount: reduction, source: 'Den Guard' });
        }
        
        // Check for lethal damage and vengeance trigger
        const wouldBeLethal = defender.curHp - damage <= 0;
        if (wouldBeLethal) {
          const lethalTrigger = checkTriggers('onLethalDamage', { attacker, defender, damage }, player, opponent, side, oppSide);
          if (lethalTrigger.pendingAction) {
            return { state, events, pendingAction: lethalTrigger.pendingAction };
          }
          events.push(...lethalTrigger.events);
          if (lethalTrigger.modifiedDamage !== null) {
            damage = lethalTrigger.modifiedDamage;
          }
        }
        
        // Apply damage
        let ko = applyDamage(defender, damage);
        events.push({ type: 'damage', side: oppSide, amount: damage });
        
        // === SURVIVAL MECHANICS ===
        
        // Bulwark: Survive first lethal hit at 1 HP
        if (ko && defender.id === 'bulwark' && !defender.bulwarkUsed) {
          defender.curHp = 1;
          defender.bulwarkUsed = true;
          ko = false;
          events.push({ type: 'abilityTrigger', side: oppSide, creature: defender.name, ability: 'Fortress' });
          events.push({ type: 'survival', side: oppSide, creature: defender.name, hp: 1 });
        }
        
        // Fortified (from Fortify verse): Survive lethal with 1 HP
        if (ko && defender.fortified) {
          defender.curHp = 1;
          defender.fortified = false;
          ko = false;
          events.push({ type: 'survival', side: oppSide, creature: defender.name, hp: 1, source: 'Fortify' });
        }
        
        // === SKITTER: Optional swap after taking damage (if survived) ===
        if (!ko && defender.id === 'skitter' && opponent.bench.length > 0) {
          events.push({ type: 'abilityTrigger', side: oppSide, creature: defender.name, ability: 'Scurry' });
          // Return with pendingAction - client will prompt for swap
          return { 
            state, 
            events, 
            pendingAction: {
              type: 'skitterSwap',
              side: oppSide,
              creature: defender.name,
              benchOptions: opponent.bench.map((c, idx) => ({ uid: c.uid, name: c.name, idx }))
            }
          };
        }
        
        // === ON DEATH TRIGGERS ===
        
        if (ko) {
          events.push({ type: 'ko', side: oppSide, creature: defender.name });
          const koedCreature = defender;
          opponent.grave.push(defender);
          opponent.active = null;
          
          // Auto-swap bench to active for defender
          autoSwapBenchToActive(opponent, oppSide, events);
          
          // CHECK: onKO trigger (defender's owner)
          const onKOTrigger = checkTriggers('onKO', { koedCreature, attacker }, player, opponent, side, oppSide);
          events.push(...onKOTrigger.events);
          
          // CHECK: onAllyKO trigger (for opponent's own triggers)
          const onAllyKOTrigger = checkTriggers('onAllyKO', { koedCreature, attacker }, opponent, player, oppSide, side);
          events.push(...onAllyKOTrigger.events);
          
          // Gloom: onKO trigger (Using processEffects)
          const koedCard = CREATURES[koedCreature.id];
          if (koedCard?.ability?.trigger?.event === 'onKO' && 
              koedCard.ability.trigger.condition?.target === 'self' &&
              koedCard.ability.effects?.some(e => e.type === 'discard')) {
            // Context: 'opp' in effects refers to the killer (current player)
            // because the KO'd creature's owner considers attacker as 'opp'
            const ctx = buildEffectsContext({ koedCreature, attacker }, opponent, player, oppSide, side);
            ctx.card = koedCard;
            ctx.self = koedCreature;
            
            // Track discarded card name before calling processEffects
            const handBefore = [...player.hand];
            const result = processEffects(koedCard.ability, ctx);
            
            if (result.modifiedContext?.discarded || (handBefore.length > player.hand.length)) {
              events.push({ type: 'abilityTrigger', side: oppSide, creature: koedCreature.name, ability: koedCard.ability.name });
              // Find what was discarded by comparing before/after
              const discardedCard = handBefore.find(c => !player.hand.some(h => h.uid === c.uid));
              if (discardedCard) {
                events.push({ type: 'discard', side, card: discardedCard.name });
              }
            }
          }
          
          // Echomask: Enemy loses 1 life
          if (koedCreature.id === 'echomask') {
            // CHECK: onLifeLoss trigger for echomask ability
            const echomaskLifeLossTrigger = checkTriggers('onLifeLoss', { amount: 1 }, opponent, player, oppSide, side);
            events.push(...echomaskLifeLossTrigger.events);
            
            if (!echomaskLifeLossTrigger.negated) {
              player.lp -= 1;
              events.push({ type: 'abilityTrigger', side: oppSide, creature: koedCreature.name, ability: 'Reflection' });
              events.push({ type: 'lpDamage', side, amount: 1 });
            }
          }
          
          // Stormtalon: Set chainLightning flag
          if (koedCreature.id === 'stormtalon') {
            player.chainLightning = 20;
            events.push({ type: 'abilityTrigger', side: oppSide, creature: koedCreature.name, ability: 'Chain Lightning' });
            events.push({ type: 'setFlag', side, flag: 'chainLightning', value: 20 });
          }
          
          // Titanback: Deal 25 damage to attacker on death
          if (koedCreature.id === 'titanback') {
            const recoilKo = applyDamage(attacker, 25);
            events.push({ type: 'abilityTrigger', side: oppSide, creature: koedCreature.name, ability: 'Juggernaut' });
            events.push({ type: 'damage', side, amount: 25, source: 'Juggernaut' });
            if (recoilKo) {
              events.push({ type: 'ko', side, creature: attacker.name });
              player.grave.push(attacker);
              player.active = null;
              
              // CHECK: onAllyKO trigger for attacker's death
              const atkKoTrigger = checkTriggers('onAllyKO', { koedCreature: attacker }, player, opponent, side, oppSide);
              events.push(...atkKoTrigger.events);
            }
          }
        }
        
        // === REFLECTION DAMAGE (Using processEffects for Thornling) ===
        
        // Check defender for afterAttack trigger (Thornling, Coilshell, Reflector)
        const defenderCard = CREATURES[defender.id];
        if (defenderCard?.ability?.trigger?.event === 'afterAttack' && 
            defenderCard.ability.trigger.condition?.defender === 'self') {
          const ctx = buildEffectsContext({ attacker, defender, damage }, player, opponent, side, oppSide);
          ctx.card = defenderCard;
          ctx.self = defender;
          // For reflection damage, attacker is owned by current player
          ctx.attackerOwner = player;
          ctx.attackerOwnerKey = 'me';
          
          const result = processEffects(defenderCard.ability, ctx);
          
          if (result.events.length > 0 || result.kos?.length > 0) {
            events.push({ type: 'abilityTrigger', side: oppSide, creature: defender.name, ability: defenderCard.ability.name });
          }
          
          // Convert events to server format
          for (const evt of result.events) {
            if (evt.type === 'damage') {
              events.push({ type: 'damage', side, amount: evt.amount, source: defenderCard.ability.name });
            } else if (evt.type !== 'log') {
              events.push(evt);
            }
          }
          
          // Handle attacker KO from reflection damage
          for (const koInfo of result.kos || []) {
            events.push({ type: 'ko', side, creature: attacker.name });
            const koedCreature = attacker;
            player.grave.push(attacker);
            player.active = null;
            
            // Auto-swap bench to active for attacker
            autoSwapBenchToActive(player, side, events);
            
            // CHECK: onAllyKO trigger (for player's own triggers)
            const onAllyKOTrigger = checkTriggers('onAllyKO', { koedCreature }, player, opponent, side, oppSide);
            events.push(...onAllyKOTrigger.events);
          }
        }
        
        // === ATTACKER ON-HIT TRIGGERS (Using processEffects) ===
        
        if (!ko && defender && damage > 0) {
          const attackerCard = CREATURES[attacker.id];
          if (attackerCard?.ability?.trigger?.event === 'afterAttack' || 
              attackerCard?.ability?.trigger?.event === 'onHit') {
            const triggerCondition = attackerCard.ability.trigger.condition;
            // Check conditions: attacker: 'self', didDamage: true, defenderAlive: true
            const isAttackerAbility = triggerCondition?.attacker === 'self';
            const didDamageOk = !triggerCondition?.didDamage || damage > 0;
            const defenderAliveOk = !triggerCondition?.defenderAlive || !ko;
            
            if (isAttackerAbility && didDamageOk && defenderAliveOk) {
              const ctx = buildEffectsContext({ attacker, defender, damage }, player, opponent, side, oppSide);
              ctx.card = attackerCard;
              ctx.self = attacker;
              ctx.damageDealt = damage;  // For Leechling's healSelf amount: 'damageDealt'
              ctx.attackerOwner = player;
              ctx.attackerOwnerKey = 'me';
              ctx.defenderOwner = opponent;
              
              const result = processEffects(attackerCard.ability, ctx);
              
              if (result.events.length > 0) {
                events.push({ type: 'abilityTrigger', side, creature: attacker.name, ability: attackerCard.ability.name });
              }
              
              for (const evt of result.events) {
                if (evt.type === 'log') {
                  // Convert log events to setStatus or heal format for server
                  if (evt.message?.includes('Poisoned')) {
                    events.push({ type: 'setStatus', side: oppSide, status: 'poison' });
                  } else if (evt.message?.includes('Trapped')) {
                    events.push({ type: 'setStatus', side: oppSide, status: 'trapped' });
                  }
                } else if (evt.type === 'heal') {
                  events.push({ type: 'heal', side, amount: evt.amount });
                } else {
                  events.push(evt);
                }
              }
            }
          }
        }
        
        // === ATTACKER ON-KILL TRIGGERS (Using processEffects) ===
        
        if (ko) {
          const attackerCard = CREATURES[attacker.id];
          if (attackerCard?.ability?.trigger?.event === 'onHit' && 
              attackerCard.ability.trigger.condition?.causedKO) {
            const ctx = buildEffectsContext({ attacker, defender }, player, opponent, side, oppSide);
            ctx.card = attackerCard;
            ctx.self = attacker;
            ctx.attackerOwner = player;
            ctx.attackerOwnerKey = 'me';
            
            const result = processEffects(attackerCard.ability, ctx);
            
            if (result.events.length > 0) {
              events.push({ type: 'abilityTrigger', side, creature: attacker.name, ability: attackerCard.ability.name });
            }
            
            for (const evt of result.events) {
              if (evt.type === 'heal') {
                events.push({ type: 'heal', side, amount: evt.amount });
              } else if (evt.type !== 'log') {
                events.push(evt);
              }
            }
          }
        }
        
      } else {
        // Direct attack on life points
        // CHECK: onLifeLoss trigger (before LP decrement)
        const onLifeLossTrigger = checkTriggers('onLifeLoss', { amount: 1 }, player, opponent, side, oppSide);
        events.push(...onLifeLossTrigger.events);
        
        if (!onLifeLossTrigger.negated) {
          opponent.lp -= 1;
          events.push({ type: 'lpDamage', side: oppSide, amount: 1 });
        }
        
      }
      } // End attack loop
      
      // Cindermaw self-damage (once after all attacks)
      if (attacker.id === 'cindermaw' && player.active && player.active.uid === attacker.uid) {
        const selfKo = applyDamage(attacker, 10);
        events.push({ type: 'damage', side, amount: 10, source: 'Frenzy (Burnout)' });
        if (selfKo) {
          events.push({ type: 'ko', side, creature: attacker.name });
          const koedCreature = attacker;
          player.grave.push(attacker);
          player.active = null;
          
          // Auto-swap bench to active for attacker
          autoSwapBenchToActive(player, side, events);
          
          // CHECK: onAllyKO trigger
          const onAllyKOTrigger = checkTriggers('onAllyKO', { koedCreature }, player, opponent, side, oppSide);
          events.push(...onAllyKOTrigger.events);
        }
      }
      
      state.hasAttacked = true;
      break;
    }
    
    case 'cast': {
      const card = player.hand.find(c => c.uid === action.cardUid);
      if (!card || card.cardType !== 'verse' || card.type !== 'cast') {
        return { state, events, error: "Invalid card" };
      }
      
      if (card.cost > player.mana) {
        return { state, events, error: "Not enough mana" };
      }
      
      // Deduct mana and move to grave
      player.mana -= card.cost;
      player.hand = player.hand.filter(c => c.uid !== action.cardUid);
      
      // CHECK: onCast trigger (before spell resolves)
      const onCastTrigger = checkTriggers('onCast', { spell: card }, player, opponent, side, oppSide);
      events.push(...onCastTrigger.events);
      
      if (onCastTrigger.negated) {
        // Spell negated - move to grave but don't execute effect
        player.grave.push(card);
        break;
      }
      
      player.grave.push(card);
      
      // Execute cast effects (simplified - full effects in Phase 3/4)
      events.push({ type: 'cast', side, verse: card.name });
      
      // darkPact - Draw 2, lose 1 life (uses processEffects)
      if (card.id === 'darkPact') {
        // CHECK: onLifeLoss trigger first
        const darkPactLifeLossTrigger = checkTriggers('onLifeLoss', { amount: 1 }, opponent, player, oppSide, side);
        events.push(...darkPactLifeLossTrigger.events);
        
        if (!darkPactLifeLossTrigger.negated) {
          const ctx = buildEffectsContext({}, player, opponent, side, oppSide);
          const { events: cardEvents } = processCastVerseEffects(card, ctx, player, opponent, side, oppSide);
          events.push(...cardEvents);
        } else {
          // If life loss negated, still draw cards
          draw(player);
          draw(player);
          events.push({ type: 'draw', count: 2 });
        }
      }
      // predatorsMark - +30 ATK next attack (uses processEffects)
      if (card.id === 'predatorsMark') {
        const ctx = buildEffectsContext({}, player, opponent, side, oppSide);
        const { events: cardEvents } = processCastVerseEffects(card, ctx, player, opponent, side, oppSide);
        events.push(...cardEvents);
      }
      // manaSurge - Gain 2 mana (uses processEffects)
      if (card.id === 'manaSurge') {
        const ctx = buildEffectsContext({}, player, opponent, side, oppSide);
        const { events: cardEvents } = processCastVerseEffects(card, ctx, player, opponent, side, oppSide);
        events.push(...cardEvents);
      }
      
      // ignite - Deal 15 damage to target creature (uses processEffects)
      if (card.id === 'ignite') {
        if (!action.targetUid) {
          player.mana += card.cost;
          player.hand.push(card);
          player.grave = player.grave.filter(c => c.uid !== card.uid);
          return { state, events, error: 'Select target creature' };
        }
        
        // Find target in opponent's active or bench
        let target = null;
        let targetLocation = null;
        let targetIdx = -1;
        
        if (opponent.active && opponent.active.uid === action.targetUid) {
          target = opponent.active;
          targetLocation = 'active';
        } else {
          targetIdx = opponent.bench.findIndex(c => c.uid === action.targetUid);
          if (targetIdx !== -1) {
            target = opponent.bench[targetIdx];
            targetLocation = 'bench';
          }
        }
        
        if (!target) {
          player.mana += card.cost;
          player.hand.push(card);
          player.grave = player.grave.filter(c => c.uid !== card.uid);
          return { state, events, error: 'Invalid target' };
        }
        
        const ctx = buildEffectsContext({ selected: { creature: target, location: targetLocation, idx: targetIdx, ownerKey: 'opp' } }, player, opponent, side, oppSide);
        const { events: cardEvents } = processCastVerseEffects(card, ctx, player, opponent, side, oppSide);
        events.push(...cardEvents);
      }
      
      // banish - Remove target creature from game (uses processEffects)
      if (card.id === 'banish') {
        if (!action.targetUid) {
          player.mana += card.cost;
          player.hand.push(card);
          player.grave = player.grave.filter(c => c.uid !== card.uid);
          return { state, events, error: 'Select target creature' };
        }
        
        // Find target (can be any creature)
        let target = null;
        let targetLocation = null;
        let targetIdx = -1;
        let targetOwnerKey = 'opp';
        
        if (opponent.active && opponent.active.uid === action.targetUid) {
          target = opponent.active;
          targetLocation = 'active';
        } else {
          targetIdx = opponent.bench.findIndex(c => c.uid === action.targetUid);
          if (targetIdx !== -1) {
            target = opponent.bench[targetIdx];
            targetLocation = 'bench';
          }
        }
        // Also check player's own creatures
        if (!target && player.active && player.active.uid === action.targetUid) {
          target = player.active;
          targetLocation = 'active';
          targetOwnerKey = 'me';
        }
        if (!target) {
          const pIdx = player.bench.findIndex(c => c.uid === action.targetUid);
          if (pIdx !== -1) {
            target = player.bench[pIdx];
            targetLocation = 'bench';
            targetIdx = pIdx;
            targetOwnerKey = 'me';
          }
        }
        
        if (!target) {
          player.mana += card.cost;
          player.hand.push(card);
          player.grave = player.grave.filter(c => c.uid !== card.uid);
          return { state, events, error: 'Invalid target' };
        }
        
        events.push({ type: 'banish', side: targetOwnerKey === 'me' ? side : oppSide, creature: target.name });
        
        const ctx = buildEffectsContext({ selected: { creature: target, location: targetLocation, idx: targetIdx, ownerKey: targetOwnerKey } }, player, opponent, side, oppSide);
        const { events: cardEvents } = processCastVerseEffects(card, ctx, player, opponent, side, oppSide);
        events.push(...cardEvents);
      }
      
      // soulSiphon - Deal 20 damage + heal 10 if damage was dealt (uses processEffects)
      if (card.id === 'soulSiphon') {
        if (!action.targetUid) {
          player.mana += card.cost;
          player.hand.push(card);
          player.grave = player.grave.filter(c => c.uid !== card.uid);
          return { state, events, error: 'Select target creature' };
        }
        
        // Find target (can be any creature)
        let target = null;
        let targetLocation = null;
        let targetIdx = -1;
        let targetOwnerKey = 'opp';
        
        if (opponent.active && opponent.active.uid === action.targetUid) {
          target = opponent.active;
          targetLocation = 'active';
        } else {
          targetIdx = opponent.bench.findIndex(c => c.uid === action.targetUid);
          if (targetIdx !== -1) {
            target = opponent.bench[targetIdx];
            targetLocation = 'bench';
          }
        }
        // Also check player's own creatures (soulSiphon can target any)
        if (!target && player.active && player.active.uid === action.targetUid) {
          target = player.active;
          targetLocation = 'active';
          targetOwnerKey = 'me';
        }
        if (!target) {
          const pIdx = player.bench.findIndex(c => c.uid === action.targetUid);
          if (pIdx !== -1) {
            target = player.bench[pIdx];
            targetLocation = 'bench';
            targetIdx = pIdx;
            targetOwnerKey = 'me';
          }
        }
        
        if (!target) {
          player.mana += card.cost;
          player.hand.push(card);
          player.grave = player.grave.filter(c => c.uid !== card.uid);
          return { state, events, error: 'Invalid target' };
        }
        
        const ctx = buildEffectsContext({ selected: { creature: target, location: targetLocation, idx: targetIdx, ownerKey: targetOwnerKey } }, player, opponent, side, oppSide);
        const { events: cardEvents } = processCastVerseEffects(card, ctx, player, opponent, side, oppSide);
        events.push(...cardEvents);
      }
      
      // secondWind - Heal your active creature 40 HP (uses processEffects)
      if (card.id === 'secondWind') {
        const ctx = buildEffectsContext({}, player, opponent, side, oppSide);
        const { events: cardEvents } = processCastVerseEffects(card, ctx, player, opponent, side, oppSide);
        events.push(...cardEvents);
      }
      
      // shellArmor - Heal your active creature 25 HP (uses processEffects)
      if (card.id === 'shellArmor') {
        const ctx = buildEffectsContext({}, player, opponent, side, oppSide);
        const { events: cardEvents } = processCastVerseEffects(card, ctx, player, opponent, side, oppSide);
        events.push(...cardEvents);
      }
      
      // regenerate - Heal your active 40 HP and cure poison (uses processEffects)
      if (card.id === 'regenerate') {
        const ctx = buildEffectsContext({}, player, opponent, side, oppSide);
        const { events: cardEvents } = processCastVerseEffects(card, ctx, player, opponent, side, oppSide);
        events.push(...cardEvents);
      }
      
      // fortify - Your active survives next lethal hit (uses processEffects)
      if (card.id === 'fortify') {
        const ctx = buildEffectsContext({}, player, opponent, side, oppSide);
        const { events: cardEvents } = processCastVerseEffects(card, ctx, player, opponent, side, oppSide);
        events.push(...cardEvents);
      }
      
      // unbreakable - Prevent next damage to any of your creatures
      if (card.id === 'unbreakable') {
        player.unbreakable = true;
        events.push({ type: 'setFlag', side, flag: 'unbreakable' });
      }
      
      // bloodMoon - Deal 20 damage to ALL creatures (uses processEffects)
      if (card.id === 'bloodMoon') {
        const ctx = buildEffectsContext({}, player, opponent, side, oppSide);
        const { events: cardEvents } = processCastVerseEffects(card, ctx, player, opponent, side, oppSide);
        events.push(...cardEvents);
      }
      
      // callOfTheWild - Summon random 1-cost creature from deck
      if (card.id === 'callOfTheWild') {
        const oneCostCreatures = player.deck.filter(c => c.cardType === 'creature' && c.cost === 1);
        
        if (oneCostCreatures.length > 0 && player.bench.length < 2) {
          const randIdx = Math.floor(Math.random() * oneCostCreatures.length);
          const creature = oneCostCreatures[randIdx];
          
          // Remove from deck
          player.deck = player.deck.filter(c => c.uid !== creature.uid);
          
          // Summon to bench (or active if empty)
          if (!player.active) {
            player.active = creature;
            creature.summonedThisTurn = true;
            events.push({ type: 'summon', side, creature: creature.name, slot: 'active', source: 'Call of the Wild' });
          } else {
            player.bench.push(creature);
            creature.summonedThisTurn = true;
            events.push({ type: 'summon', side, creature: creature.name, slot: 'bench', source: 'Call of the Wild' });
          }
        }
      }
      
      // graveEcho - Return creature from graveyard to hand
      if (card.id === 'graveEcho') {
        if (!action.graveUid) {
          player.mana += card.cost;
          player.hand.push(card);
          player.grave = player.grave.filter(c => c.uid !== card.uid);
          return { state, events, error: 'Select creature from graveyard' };
        }
        
        const graveIdx = player.grave.findIndex(c => c.uid === action.graveUid && c.cardType === 'creature');
        if (graveIdx === -1) {
          player.mana += card.cost;
          player.hand.push(card);
          player.grave = player.grave.filter(c => c.uid !== card.uid);
          return { state, events, error: 'Invalid graveyard target' };
        }
        
        const creature = player.grave[graveIdx];
        player.grave.splice(graveIdx, 1);
        player.hand.push(creature);
        events.push({ type: 'graveReturn', side, creature: creature.name });
      }
      
      // sacrifice - Sacrifice creature, draw 2 cards
      if (card.id === 'sacrifice') {
        if (!action.sacrificeUid) {
          player.mana += card.cost;
          player.hand.push(card);
          player.grave = player.grave.filter(c => c.uid !== card.uid);
          return { state, events, error: 'Select creature to sacrifice' };
        }
        
        // Find creature in active or bench
        let target = null;
        let targetLocation = null;
        let targetIdx = -1;
        
        if (player.active && player.active.uid === action.sacrificeUid) {
          target = player.active;
          targetLocation = 'active';
        } else {
          targetIdx = player.bench.findIndex(c => c.uid === action.sacrificeUid);
          if (targetIdx !== -1) {
            target = player.bench[targetIdx];
            targetLocation = 'bench';
          }
        }
        
        if (!target) {
          player.mana += card.cost;
          player.hand.push(card);
          player.grave = player.grave.filter(c => c.uid !== card.uid);
          return { state, events, error: 'Invalid sacrifice target' };
        }
        
        // Sacrifice the creature
        events.push({ type: 'sacrifice', side, creature: target.name });
        player.grave.push(target);
        if (targetLocation === 'active') {
          player.active = null;
        } else {
          player.bench.splice(targetIdx, 1);
        }
        
        // Draw 2 cards
        draw(player);
        draw(player);
        events.push({ type: 'draw', side, count: 2 });
      }
      
      break;
    }
    
    case 'set': {
      const card = player.hand.find(c => c.uid === action.cardUid);
      if (!card || card.cardType !== 'verse' || card.type !== 'set') {
        return { state, events, error: "Invalid card" };
      }
      
      if (card.cost > player.mana) {
        return { state, events, error: "Not enough mana" };
      }
      
      if (player.setVerse) {
        return { state, events, error: "Already have a set verse" };
      }
      
      // Deduct mana and remove from hand
      player.mana -= card.cost;
      player.hand = player.hand.filter(c => c.uid !== action.cardUid);
      player.setVerse = card;
      
      events.push({ type: 'setVerse', side, verse: card.name });
      break;
    }
    
    case 'retreat': {
      if (!player.active) {
        return { state, events, error: "No active creature" };
      }
      
      if (player.bench.length === 0) {
        return { state, events, error: "No bench creatures" };
      }
      
      if (state.hasAttacked) {
        return { state, events, error: "Cannot retreat after attacking" };
      }
      
      if (state.hasRetreated) {
        return { state, events, error: "Already retreated this turn" };
      }
      
      if (player.active.status === 'trapped') {
        return { state, events, error: "Active creature is trapped" };
      }
      
      const fromCreature = player.active;
      const toIdx = action.benchIdx;
      
      if (toIdx < 0 || toIdx >= player.bench.length) {
        return { state, events, error: "Invalid bench index" };
      }
      
      const toCreature = player.bench[toIdx];
      
      // Swap
      player.active = toCreature;
      player.bench[toIdx] = fromCreature;
      
      events.push({ type: 'retreat', side, from: fromCreature.name, to: toCreature.name });
      state.hasRetreated = true;
      break;
    }
    
    case 'skitterSwap': {
      // Skitter's Scurry ability - swap with bench creature after taking damage
      // This is called by the OPPONENT (the one who owns skitter)
      if (!player.active || player.active.id !== 'skitter') {
        return { state, events, error: "No skitter in active slot" };
      }
      
      if (player.bench.length === 0) {
        return { state, events, error: "No bench creatures to swap with" };
      }
      
      const benchIdx = action.benchIdx;
      if (benchIdx === undefined || benchIdx < 0 || benchIdx >= player.bench.length) {
        return { state, events, error: "Invalid bench index" };
      }
      
      // Perform the swap
      const skitter = player.active;
      const benchCreature = player.bench[benchIdx];
      
      player.active = benchCreature;
      player.bench[benchIdx] = skitter;
      
      events.push({ type: 'skitterSwap', side, from: skitter.name, to: benchCreature.name });
      break;
    }
    
    case 'skitterDecline': {
      // Player declined to use Skitter's ability - just acknowledge
      events.push({ type: 'skitterDecline', side });
      break;
    }
    
    case 'respondOptionalTrigger': {
      // Handle optional trigger response (e.g., Vengeance)
      const { confirmed, verseId, context: serializedContext } = action;
      
      if (!player.setVerse || player.setVerse.id !== verseId) {
        return { state, events, error: "No matching verse set" };
      }
      
      const verse = player.setVerse;
      
      // Reconstruct context with actual game state references
      // Context was serialized, so we need to map back to actual objects
      const damage = serializedContext?.damage || 0;
      const defender = player.active;  // The defender is the player who owns the trigger
      const attacker = opponent.active;  // The attacker is the opponent's active creature
      
      const triggerContext = { attacker, defender, damage };
      
      if (confirmed) {
        // Execute the trigger
        const result = executeTrigger(verse, triggerContext, player, opponent, side, oppSide);
        events.push(...result.events);
        
        // Consume the verse
        player.grave.push(verse);
        player.setVerse = null;
        
        // For onLethalDamage triggers (like Vengeance), the trigger has already modified
        // the game state (e.g., set defender HP to 1, destroyed attacker)
        // No need to apply additional damage
      } else {
        // Player declined - consume verse and apply original lethal damage
        player.grave.push(verse);
        player.setVerse = null;
        events.push({ type: 'triggerDeclined', side, verse: verse.name });
        
        // Apply the lethal damage that was pending
        if (defender && damage > 0) {
          // Apply damage
          const ko = applyDamage(defender, damage);
          events.push({ type: 'damage', side, amount: damage });
          
          if (ko) {
            // Move to grave
            player.grave.push(defender);
            player.active = null;
            events.push({ type: 'ko', side, creature: defender.name });
          }
        }
      }
      break;
    }
    
    default:
      return { state, events, error: "Unknown action" };
  }
  
  // Check win conditions
  if (player.lp <= 0) {
    state.winner = 1 - playerIdx;
    events.push({ type: 'gameOver', winner: oppSide, reason: 'LP depleted' });
  }
  if (opponent.lp <= 0) {
    state.winner = playerIdx;
    events.push({ type: 'gameOver', winner: side, reason: 'LP depleted' });
  }
  if (opponent.deck.length === 0 && opponent.hand.length === 0) {
    state.winner = playerIdx;
    events.push({ type: 'gameOver', winner: side, reason: 'Deck out' });
  }
  
  return { state, events };
}

// ═══════════════════════════════════════════════════════════════
// END TURN
// ═══════════════════════════════════════════════════════════════

/**
 * End the current player's turn
 * @param {object} state - Game state
 * @param {number} playerIdx - Player index (0 or 1)
 * @returns {object} - { state, events }
 */
export function endTurn(state, playerIdx) {
  const events = [];
  
  // Validate it's this player's turn
  if (state.currentPlayer !== playerIdx + 1) {
    return { state, events, error: "Not your turn" };
  }
  
  const player = state.players[playerIdx];
  const nextPlayerIdx = 1 - playerIdx;
  const nextPlayer = state.players[nextPlayerIdx];
  
  // Clear summonedThisTurn flags
  if (player.active) player.active.summonedThisTurn = false;
  player.bench.forEach(c => c.summonedThisTurn = false);
  
  // Compute player side for events
  const endTurnSide = playerIdx === 0 ? 'p1' : 'p2';
  
  // Clear trapped status at end of turn
  if (player.active && player.active.status === 'trapped') {
    player.active.status = null;
    events.push({ type: 'clearStatus', side: endTurnSide, status: 'trapped' });
  }
  
  // Reset per-turn damage reduction flags for next player
  if (nextPlayer.active) {
    nextPlayer.active.shellkinUsed = false;
    nextPlayer.active.titanbackUsed = false;
  }
  nextPlayer.bench.forEach(c => {
    c.shellkinUsed = false;
    c.titanbackUsed = false;
  });
  
  // Poison damage at end of turn
  if (player.active && player.active.status === 'poison') {
    const ko = applyDamage(player.active, 10);
    events.push({ 
      type: 'damage', 
      side: endTurnSide, 
      amount: 10, 
      source: 'Poison' 
    });
    if (ko) {
      events.push({ 
        type: 'ko', 
        side: endTurnSide, 
        creature: player.active.name 
      });
      player.grave.push(player.active);
      player.active = null;
      // Auto-swap bench to active
      autoSwapBenchToActive(player, endTurnSide, events);
    }
  }
  
  // Broodmother spawn (simplified - full trigger system in Phase 4)
  if (player.active && player.active.id === 'broodmother' && player.bench.length < 2) {
    const antling = mkCreature('hiveling');  // Placeholder - would be custom token
    antling.name = 'Antling';
    antling.hp = 10;
    antling.curHp = 10;
    antling.atk = 10;
    player.bench.push(antling);
    events.push({ type: 'abilityTrigger', side: playerIdx === 0 ? 'p1' : 'p2', creature: player.active.name, ability: 'Spawn' });
    events.push({ type: 'summon', side: playerIdx === 0 ? 'p1' : 'p2', creature: 'Antling', slot: 'bench' });
  }
  
  // Switch turn
  state.currentPlayer = nextPlayerIdx + 1;
  state.turn += (nextPlayerIdx === 0 ? 1 : 0);  // Increment turn when it cycles back to player 1
  const wasFirstTurn = state.firstTurn;
  state.firstTurn = false;
  state.hasAttacked = false;
  state.hasRetreated = false;
  
  // Next player: increment mana and draw
  // Don't increment mana on very first turn end (P2's first turn starts with 1 mana like P1)
  if (!wasFirstTurn) {
    nextPlayer.maxMana = Math.min(5, nextPlayer.maxMana + 1);
  }
  nextPlayer.mana = nextPlayer.maxMana;
  events.push({ type: 'manaGain', side: nextPlayerIdx === 0 ? 'p1' : 'p2' });
  
  const drawResult = draw(nextPlayer);
  if (drawResult.success) {
    events.push(...drawResult.events);
  } else {
    // Deck out
    state.winner = playerIdx;
    events.push({ type: 'gameOver', winner: playerIdx === 0 ? 'p1' : 'p2', reason: 'Deck out' });
  }
  
  events.push({ type: 'turnStart', yourTurn: false });
  
  return { state, events };
}

// ═══════════════════════════════════════════════════════════════
// GET STATE FOR PLAYER
// ═══════════════════════════════════════════════════════════════

/**
 * Get game state with hidden info removed for a specific player
 * @param {object} state - Full game state
 * @param {number} playerIdx - Player index (0 or 1)
 * @returns {object} - Filtered state for this player
 */
export function getStateForPlayer(state, playerIdx) {
  const player = state.players[playerIdx];
  const opponent = state.players[1 - playerIdx];
  
  return {
    turn: state.turn,
    currentPlayer: state.currentPlayer,
    yourTurn: state.currentPlayer === playerIdx + 1,
    winner: state.winner,
    firstTurn: state.firstTurn,
    hasAttacked: state.hasAttacked,
    hasRetreated: state.hasRetreated,
    me: {
      lp: player.lp,
      mana: player.mana,
      maxMana: player.maxMana,
      deckCount: player.deck.length,
      hand: player.hand,  // Full hand details
      active: player.active,
      bench: player.bench,
      grave: player.grave,
      setVerse: player.setVerse,
      attackBonuses: player.attackBonuses,
      chainLightning: player.chainLightning,
      unbreakable: player.unbreakable
    },
    opp: {
      lp: opponent.lp,
      mana: opponent.mana,
      maxMana: opponent.maxMana,
      deckCount: opponent.deck.length,
      handCount: opponent.hand.length,  // Hidden - only count
      active: opponent.active,
      bench: opponent.bench,
      grave: opponent.grave,
      setVerse: opponent.setVerse ? { ...opponent.setVerse, faceDown: true } : null,  // Hidden - face down
      chainLightning: opponent.chainLightning
    }
  };
}

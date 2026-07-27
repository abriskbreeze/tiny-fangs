// ═══════════════════════════════════════════════════════════════
// GAME ENGINE (Pure Functions)
// ═══════════════════════════════════════════════════════════════
// Core game operations - all functions are pure (no mutations)
// Phase 3: Server delegates to these functions

import { CREATURES, VERSES, DECKS } from './cards.js';
import { processEffects } from './effects.js';
import { findMatchingTriggers, sortByPriority, matchesTrigger } from './triggers.js';
import { applyCreatureDamageReduction } from './damage-reduction.js';

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

function uid() {
  return Math.random().toString(36).substr(2, 9);
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ═══════════════════════════════════════════════════════════════
// CARD CREATION
// ═══════════════════════════════════════════════════════════════

export function mkCreature(id) {
  const template = CREATURES[id];
  if (!template) throw new Error(`Unknown creature: ${id}`);
  
  return {
    ...template,
    cardType: 'creature',
    curHp: template.hp,
    status: null,
    uid: uid(),
    firstAtk: true,
    summonedThisTurn: false
  };
}

export function mkVerse(id) {
  const template = VERSES[id];
  if (!template) throw new Error(`Unknown verse: ${id}`);
  
  return {
    ...template,
    cardType: 'verse',
    uid: uid()
  };
}

export function mkDeck(deckId) {
  const def = DECKS[deckId];
  if (!def) throw new Error(`Unknown deck: ${deckId}`);
  
  const cards = [
    ...def.creatures.map(mkCreature),
    ...def.verses.map(mkVerse)
  ];
  
  return shuffle(cards);
}

export function mkPlayer(deckId) {
  const deck = mkDeck(deckId);
  const hand = deck.splice(0, 5);
  
  return {
    lp: 3,
    mana: 1,
    maxMana: 1,
    deck,
    hand,
    active: null,
    bench: [],
    grave: [],
    setVerse: null,
    usedManaSurge: false,
    usedLastBreath: false,
    attackBonuses: [],
    poisoned: false,
    chainLightning: 0,
    unbreakable: false
  };
}

export function createGame(deck1Id, deck2Id) {
  return {
    turn: 1,
    currentPlayer: 1,
    players: [
      mkPlayer(deck1Id),
      mkPlayer(deck2Id)
    ],
    log: [],
    winner: null,
    firstTurn: true,
    hasAttacked: false,
    hasRetreated: false
  };
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Draw a card from player's deck (mutates player)
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
 * Apply damage to a creature (mutates creature)
 * @returns {boolean} - True if creature was KO'd
 */
export function applyDamage(creature, amount) {
  creature.curHp -= amount;
  return creature.curHp <= 0;
}

/**
 * Prepare creature for grave - clears temporary state
 * Call this before pushing creature to grave to prevent stacking bugs
 */
function prepareForGrave(creature) {
  if (!creature) return;
  creature.atkBonuses = [];
  creature.shellkinUsed = false;
  creature.titanbackUsed = false;
  creature.firstAtk = true;
  creature.summonedThisTurn = false;
}

/**
 * Auto-swap bench creature to active if active is empty (mutates player)
 * Also handles chainLightning damage to the new active
 */
export function autoSwapBenchToActive(player, side, events) {
  if (!player.active && player.bench.length > 0) {
    const swapped = player.bench.shift();
    player.active = swapped;
    events.push({ type: 'benchToActive', side, creature: swapped.name });
    
    // Chain Lightning: damage newly active creature after bench swap
    if (player.chainLightning > 0) {
      const chainDamage = player.chainLightning;
      player.chainLightning = 0;
      
      swapped.curHp -= chainDamage;
      events.push({ type: 'damage', side, amount: chainDamage, source: 'Chain Lightning' });
      
      if (swapped.curHp <= 0) {
        events.push({ type: 'ko', side, creature: swapped.name, source: 'Chain Lightning' });
        prepareForGrave(swapped);
        player.grave.push(swapped);
        player.active = null;
        // Recursive call to get next bench creature if available
        autoSwapBenchToActive(player, side, events);
      }
    }
  }
}

/**
 * Get effective attack value for a creature
 */
/**
 * Get effective attack value for a creature
 * @param {object} creature
 * @param {object} owner - creature's owner player
 * @param {object} opponent - opposing player
 * @param {object} [opts]
 * @param {boolean} [opts.skipEchomask] - prevent infinite mirror recursion
 */
export function getEffectiveAtk(creature, owner, opponent, opts = {}) {
  if (!creature) return 0;

  // Echomask: copy enemy active's effective ATK
  if (!opts.skipEchomask && creature.id === 'echomask' && opponent?.active) {
    return getEffectiveAtk(opponent.active, opponent, owner, { skipEchomask: true });
  }

  let atk = creature.atk;
  const ability = creature.ability || CREATURES[creature.id]?.ability;

  // Apply passive abilities (from instance or card template)
  if (ability?.passive?.type === 'atkBonus') {
    const bonus = ability.passive.amount;
    const condition = ability.passive.condition;

    if (!condition || checkCondition(condition, owner, opponent, creature)) {
      if (typeof bonus === 'number') {
        atk += bonus;
      } else if (bonus === 'packCount * 10') {
        const others =
          (owner.active && owner.active.uid !== creature.uid ? 1 : 0) +
          owner.bench.filter(c => c.uid !== creature.uid).length;
        atk += others * 10;
      }
    }
  }

  // Creature-level temporary bonuses
  if (creature.atkBonuses) {
    for (const bonus of creature.atkBonuses) {
      atk += bonus.value;
    }
  }

  // Owner temporary attack bonuses
  for (const bonus of owner.attackBonuses || []) {
    atk += bonus.value;
  }

  // Alpha Rally: +10 ATK per benched creature
  if (creature.id === 'alpha') {
    atk += owner.bench.length * 10;
  }

  return atk;
}

function checkCondition(condition, owner, opponent, creature) {
  if (condition === 'me.bench.empty') return owner.bench.length === 0;
  if (condition === 'me.bench.notEmpty') return owner.bench.length > 0;
  if (condition === 'me.grave.hasCreature') return owner.grave.some(c => c.cardType === 'creature');
  if (condition === 'opp.active') return opponent.active !== null;
  if (condition === 'opp.active.belowHalf') return opponent.active && opponent.active.curHp < opponent.active.hp / 2;
  return true;
}

// ═══════════════════════════════════════════════════════════════
// SELECTION RESOLVER
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve target selection from action
 * @param {object} state - Game state
 * @param {number} playerIdx - Acting player index
 * @param {object} action - Action with targetUid, graveUid, etc.
 * @param {object} selectionConfig - Card's selection configuration
 * @returns {{ creature?, location?, owner?, ownerKey?, idx?, error?, needsSelection? }}
 */
export function resolveSelection(state, playerIdx, action, selectionConfig) {
  if (!selectionConfig) return null;
  
  const player = state.players[playerIdx];
  const opponent = state.players[1 - playerIdx];
  const targetUid = action.targetUid || action.graveUid || action.sacrificeUid || action.selectedUid;
  
  if (!targetUid && selectionConfig.required !== false) {
    return { needsSelection: true, config: selectionConfig };
  }
  
  let target = null;
  let location = null;
  let owner = null;
  let ownerKey = null;
  let idx = -1;
  
  // Search for target by UID in specified locations
  const checkBoard = (p, key) => {
    if (p.active?.uid === targetUid) {
      target = p.active;
      location = 'active';
      owner = p;
      ownerKey = key;
      return true;
    }
    const benchIdx = p.bench.findIndex(c => c.uid === targetUid);
    if (benchIdx !== -1) {
      target = p.bench[benchIdx];
      location = 'bench';
      owner = p;
      ownerKey = key;
      idx = benchIdx;
      return true;
    }
    return false;
  };
  
  const checkGrave = (p, key) => {
    const graveIdx = p.grave.findIndex(c => c.uid === targetUid && c.cardType === 'creature');
    if (graveIdx !== -1) {
      target = p.grave[graveIdx];
      location = 'grave';
      owner = p;
      ownerKey = key;
      idx = graveIdx;
      return true;
    }
    return false;
  };
  
  // Normalize selection config format
  // New format: { type: 'creature', filter: 'any'|'friendly'|'enemy', location: 'board'|'grave' }
  // Old format: { type: 'anyCreature'|'ownCreature'|'graveCreature'|'enemyCreature' }
  const configType = selectionConfig.type;
  const filter = selectionConfig.filter;
  const loc = selectionConfig.location;
  
  // Handle new declarative format
  if (configType === 'creature') {
    const checkFriendly = filter === 'any' || filter === 'friendly';
    const checkEnemy = filter === 'any' || filter === 'enemy';
    
    if (loc === 'board') {
      if (checkFriendly) checkBoard(player, 'me');
      if (!target && checkEnemy) checkBoard(opponent, 'opp');
    } else if (loc === 'grave') {
      if (checkFriendly) checkGrave(player, 'me');
      if (!target && checkEnemy) checkGrave(opponent, 'opp');
    }
  } 
  // Handle old format for backwards compatibility
  else {
    if (configType === 'anyCreature' || configType === 'ownCreature') {
      checkBoard(player, 'me');
    }
    if (!target && (configType === 'anyCreature' || configType === 'enemyCreature')) {
      checkBoard(opponent, 'opp');
    }
    if (!target && configType === 'graveCreature') {
      checkGrave(player, 'me');
    }
  }
  
  if (!target) return { error: 'Invalid target' };
  
  return { creature: target, location, owner, ownerKey, idx };
}

// ═══════════════════════════════════════════════════════════════
// TRIGGER SYSTEM
// ═══════════════════════════════════════════════════════════════

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
    attackerOwner: enemy,
    attackerOwnerKey: 'opp',
    sourceType: context.sourceType || null,
  };
}

/**
 * Process cast verse effects using shared processEffects
 */
function processCastVerseEffects(card, ctx, player, opponent, side, oppSide) {
  const verseTemplate = VERSES[card.id];
  const result = processEffects(verseTemplate, ctx);
  const events = [...result.events];
  let pendingAction = null;
  
  // Handle KOs from effects
  for (const koInfo of result.kos || []) {
    const koOwner = koInfo.owner || (koInfo.ownerKey === 'me' ? player : opponent);
    const koSide = koOwner === player ? side : oppSide;
    const other = koOwner === player ? opponent : player;
    const otherSide = koOwner === player ? oppSide : side;
    
    events.push({ type: 'ko', side: koSide, creature: koInfo.creature.name });
    prepareForGrave(koInfo.creature);
    koOwner.grave.push(koInfo.creature);
    
    if (koOwner.active?.uid === koInfo.creature.uid) {
      koOwner.active = null;
      autoSwapBenchToActive(koOwner, koSide, events);
    } else {
      koOwner.bench = koOwner.bench.filter(c => c.uid !== koInfo.creature.uid);
    }
    
    // Grave Rise / death set-verses for the KO'd creature's owner
    const onKOTrigger = checkTriggers(
      'onKO',
      { koedCreature: koInfo.creature, koOwnerSide: koSide },
      other, koOwner, otherSide, koSide
    );
    events.push(...onKOTrigger.events);
    if (!pendingAction && onKOTrigger.pendingAction) {
      pendingAction = onKOTrigger.pendingAction;
    }
  }
  
  return { events, result, pendingAction };
}

/**
 * Check if a verse matches a trigger event.
 * Prefers declarative triggerDef.event; falls back to legacy ID map.
 */
function matchesVerseTrigger(verse, event, isOwnerAction = false, context = {}, ownerSide = null, owner = null) {
  const legacyTriggers = {
    phantomWall: 'beforeAttack',
    spikeShield: 'beforeAttack',
    brace: 'beforeDamage',
    swarmShield: 'beforeDamage',
    soulTrap: 'onSummon',
    vengeance: 'onLethalDamage',
    graveRise: 'onKO',
    denMother: 'onKO',
    manaDrain: 'onCast',
    lastBreath: 'onLifeLoss'
  };

  // Engine event → accepted card triggerDef.event names
  const eventAliases = {
    onLethalDamage: ['onLethalDamage', 'beforeKO'],
    onLifeLoss: ['onLifeLoss', 'beforeLifeLoss'],
    onKO: ['onKO', 'onAllyKO']
  };
  
  const verseTemplate = VERSES[verse.id];
  const triggerDef = verseTemplate?.triggerDef;
  const declaredEvent = triggerDef?.event || legacyTriggers[verse.id];
  if (!declaredEvent) return false;

  const accepted = eventAliases[event] || [event];
  if (!accepted.includes(declaredEvent) && declaredEvent !== event) return false;
  
  const condition = triggerDef?.condition;
  
  if (condition?.owner === 'opp') {
    return !isOwnerAction;
  }
  
  if (condition?.owner === 'me' && ownerSide) {
    if (context.targetSide && context.targetSide !== ownerSide) return false;
    if (context.koOwnerSide && context.koOwnerSide !== ownerSide) return false;
  }
  
  if (condition?.hasOneCostInGrave && owner) {
    const hasOneCost = owner.grave.some(c => c.cardType === 'creature' && c.cost === 1);
    if (!hasOneCost) return false;
  }
  if (condition?.benchNotFull && owner) {
    if (owner.bench.length >= 2) return false;
  }
  if (condition?.hasBench && owner && owner.bench.length === 0) return false;
  
  return true;
}

/**
 * Execute a triggered verse
 */
function executeTrigger(verse, context, owner, enemy, ownerSide, enemySide) {
  const events = [];
  let negated = false;
  let damageReduction = 0;
  let modifiedDamage = null;
  
  events.push({ type: 'triggerVerse', side: ownerSide, verse: verse.name });
  
  switch (verse.id) {
    case 'phantomWall': {
      const verseTemplate = VERSES[verse.id];
      const ctx = buildEffectsContext(context, owner, enemy, ownerSide, enemySide);
      const result = processEffects(verseTemplate, ctx);
      events.push(...result.events);
      if (result.modifiedContext?.attackNegated) negated = true;
      for (const koInfo of result.kos || []) {
        events.push({ type: 'ko', side: enemySide, creature: koInfo.creature.name });
        prepareForGrave(koInfo.creature); enemy.grave.push(koInfo.creature);
        if (enemy.active?.uid === koInfo.creature.uid) enemy.active = null;
      }
      break;
    }
      
    case 'spikeShield': {
      const verseTemplate = VERSES[verse.id];
      const ctx = buildEffectsContext(context, owner, enemy, ownerSide, enemySide);
      const result = processEffects(verseTemplate, ctx);
      events.push(...result.events);
      for (const koInfo of result.kos || []) {
        events.push({ type: 'ko', side: enemySide, creature: koInfo.creature.name });
        prepareForGrave(koInfo.creature); enemy.grave.push(koInfo.creature);
        if (enemy.active?.uid === koInfo.creature.uid) enemy.active = null;
      }
      break;
    }
      
    case 'brace': {
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
      const verseTemplate = VERSES[verse.id];
      const ctx = buildEffectsContext(
        { ...context, creature: context.creature || context.summoned, sourceType: 'setVerse' },
        owner, enemy, ownerSide, enemySide
      );
      // Soul Trap targets the summoned creature
      ctx.summoned = context.creature;
      const result = processEffects(verseTemplate, ctx);
      events.push(...result.events);
      for (const koInfo of result.kos || []) {
        events.push({ type: 'ko', side: enemySide, creature: koInfo.creature.name });
        prepareForGrave(koInfo.creature); enemy.grave.push(koInfo.creature);
        if (enemy.active?.uid === koInfo.creature.uid) {
          enemy.active = null;
        } else {
          enemy.bench = enemy.bench.filter(c => c.uid !== koInfo.creature.uid);
        }
      }
      break;
    }
      
    case 'vengeance': {
      const verseTemplate = VERSES[verse.id];
      const ctx = buildEffectsContext(context, owner, enemy, ownerSide, enemySide);
      ctx.target = context.defender;
      const result = processEffects(verseTemplate, ctx);
      events.push(...result.events);
      
      if (result.modifiedContext?.koNegated && context.defender) {
        modifiedDamage = context.defender.hp - 1;
      }
      
      if (result.modifiedContext?.destroyed && result.modifiedContext?.destroyedOwner) {
        events.push({ type: 'ko', side: enemySide, creature: context.attacker?.name, source: 'Vengeance' });
      }
      break;
    }
      
    case 'graveRise': {
      const verseTemplate = VERSES[verse.id];
      const ctx = buildEffectsContext(context, owner, enemy, ownerSide, enemySide);
      const result = processEffects(verseTemplate, ctx);
      
      for (const evt of result.events) {
        if (evt.type === 'summonBench') {
          const creature = owner.bench[owner.bench.length - 1];
          events.push({ type: 'summon', side: ownerSide, creature: creature?.name, slot: 'bench', source: 'Grave Rise' });
        } else if (evt.type !== 'log') {
          events.push(evt);
        }
      }
      break;
    }
      
    case 'denMother':
      if (context.koedCreature) {
        const oneCostIdx = owner.deck.findIndex(c => c.cardType === 'creature' && c.cost === 1);
        if (oneCostIdx !== -1) {
          const summonedCreature = owner.deck.splice(oneCostIdx, 1)[0];
          
          if (!owner.active) {
            owner.active = summonedCreature;
            events.push({ type: 'summon', side: ownerSide, creature: summonedCreature.name, slot: 'active', source: 'Den Mother' });
          } else if (owner.bench.length < 2) {
            owner.bench.push(summonedCreature);
            events.push({ type: 'summon', side: ownerSide, creature: summonedCreature.name, slot: 'bench', source: 'Den Mother' });
          } else {
            prepareForGrave(summonedCreature); owner.grave.push(summonedCreature);
          }
        }
      }
      break;
      
    case 'manaDrain': {
      const verseTemplate = VERSES[verse.id];
      const ctx = buildEffectsContext(context, owner, enemy, ownerSide, enemySide);
      const result = processEffects(verseTemplate, ctx);
      events.push(...result.events);
      
      if (result.modifiedContext?.negated) {
        negated = true;
      }
      owner.mana = Math.min(owner.maxMana, owner.mana);
      events.push({ type: 'manaGain', side: ownerSide, amount: 2, source: 'Mana Drain' });
      break;
    }
      
    case 'lastBreath': {
      // Last Breath only triggers if the OWNER is the one losing LP
      if (context.targetSide && context.targetSide !== ownerSide) {
        break; // Not my LP being lost
      }
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
 */
function checkTriggers(event, context, activePlayer, inactivePlayer, activeSide, inactiveSide) {
  const events = [];
  let negated = false;
  let damageReduction = 0;
  let modifiedDamage = null;
  let pendingAction = null;
  
  // Check inactive player's set verse first (defender advantage)
  // isOwnerAction = false because the activePlayer (opponent) is performing the action
  const defenderVerse = inactivePlayer.setVerse;
  if (defenderVerse && matchesVerseTrigger(defenderVerse, event, false, context, inactiveSide, inactivePlayer)) {
    const verseTemplate = VERSES[defenderVerse.id];
    if (verseTemplate?.triggerDef?.optional) {
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
    
    const result = executeTrigger(defenderVerse, context, inactivePlayer, activePlayer, inactiveSide, activeSide);
    events.push(...result.events);
    if (result.negated) negated = true;
    if (result.damageReduction) damageReduction = result.damageReduction;
    if (result.modifiedDamage !== null) modifiedDamage = result.modifiedDamage;
    
    inactivePlayer.grave.push(defenderVerse);
    inactivePlayer.setVerse = null;
  }
  
  // Check active player's set verse
  // isOwnerAction = true because the activePlayer owns this verse and is performing the action
  const attackerVerse = activePlayer.setVerse;
  if (attackerVerse && matchesVerseTrigger(attackerVerse, event, true, context, activeSide, activePlayer) && !negated) {
    const verseTemplate = VERSES[attackerVerse.id];
    if (verseTemplate?.triggerDef?.optional) {
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
    
    const result = executeTrigger(attackerVerse, context, activePlayer, inactivePlayer, activeSide, inactiveSide);
    events.push(...result.events);
    if (result.negated) negated = true;
    if (result.damageReduction) damageReduction += result.damageReduction;
    if (result.modifiedDamage !== null) modifiedDamage = result.modifiedDamage;
    
    activePlayer.grave.push(attackerVerse);
    activePlayer.setVerse = null;
  }
  
  return { events, negated, damageReduction, modifiedDamage, pendingAction };
}

// ═══════════════════════════════════════════════════════════════
// ACTION: SUMMON
// ═══════════════════════════════════════════════════════════════

export function summon(state, playerIdx, cardUid, target) {
  const events = [];
  const player = state.players[playerIdx];
  const opponent = state.players[1 - playerIdx];
  const side = playerIdx === 0 ? 'p1' : 'p2';
  const oppSide = playerIdx === 0 ? 'p2' : 'p1';
  
  const card = player.hand.find(c => c.uid === cardUid);
  if (!card || card.cardType !== 'creature') {
    return { state, events, error: "Invalid card" };
  }
  
  if (card.cost > player.mana) {
    return { state, events, error: "Not enough mana" };
  }
  
  player.mana -= card.cost;
  player.hand = player.hand.filter(c => c.uid !== cardUid);
  
  const location = target || (!player.active ? 'active' : 'bench');
  
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
  
  // CHECK: onSummon trigger
  const onSummonTrigger = checkTriggers('onSummon', { creature: card }, player, opponent, side, oppSide);
  events.push(...onSummonTrigger.events);
  
  // Creature on-summon abilities
  const creatureCard = CREATURES[card.id];
  if (creatureCard?.ability?.trigger?.event === 'onSummon') {
    const locationCondition = creatureCard.ability.trigger.condition?.location;
    const locationMatches = !locationCondition || locationCondition === location;
    
    if (locationMatches) {
      const ctx = buildEffectsContext({ creature: card }, player, opponent, side, oppSide);
      ctx.card = creatureCard;
      ctx.self = card;
      ctx.draw = () => draw(player);
      
      const result = processEffects(creatureCard.ability, ctx);
      
      if (result.events.length > 0 || result.kos?.length > 0) {
        events.push({ type: 'abilityTrigger', side, creature: card.name, ability: creatureCard.ability.name });
      }
      
      for (const evt of result.events) {
        if (evt.type === 'damage') {
          events.push({ type: 'damage', side: oppSide, amount: evt.amount, source: creatureCard.ability.name });
        } else if (evt.type === 'draw') {
          events.push(evt);
        } else if (evt.type !== 'log') {
          events.push(evt);
        }
      }
      
      for (const koInfo of result.kos || []) {
        events.push({ type: 'ko', side: oppSide, creature: koInfo.creature.name });
        prepareForGrave(koInfo.creature); opponent.grave.push(koInfo.creature);
        if (opponent.active?.uid === koInfo.creature.uid) opponent.active = null;
      }
    }
  }
  
  // Chain Lightning: damage newly summoned creature
  if (player.chainLightning > 0) {
    const chainDamage = player.chainLightning;
    player.chainLightning = 0;
    
    // Find the card (might be on board or already KO'd)
    const onBoard = player.active?.uid === card.uid || player.bench.some(c => c.uid === card.uid);
    if (onBoard) {
      card.curHp -= chainDamage;
      events.push({ type: 'damage', side, amount: chainDamage, source: 'Chain Lightning' });
      
      if (card.curHp <= 0) {
        events.push({ type: 'ko', side, creature: card.name, source: 'Chain Lightning' });
        player.grave.push(card);
        if (player.active?.uid === card.uid) {
          player.active = null;
          autoSwapBenchToActive(player, side, events);
        } else {
          player.bench = player.bench.filter(c => c.uid !== card.uid);
        }
      }
    }
  }
  
  return { state, events };
}

// ═══════════════════════════════════════════════════════════════
// ACTION: ATTACK
// ═══════════════════════════════════════════════════════════════

/**
 * @param {object} [options]
 * @param {boolean} [options.fromResume] - Continue multi-hit after optional beforeDamage
 * @param {number} [options.startHit] - Hit index to resume from (0-based)
 * @param {string} [options.attackerUid] - Expected attacker uid when resuming
 */
export function attack(state, playerIdx, options = {}) {
  const { fromResume = false, startHit = 0, attackerUid = null } = options;
  const events = [];
  const player = state.players[playerIdx];
  const opponent = state.players[1 - playerIdx];
  const side = playerIdx === 0 ? 'p1' : 'p2';
  const oppSide = playerIdx === 0 ? 'p2' : 'p1';
  let pendingAction = null;
  
  if (!player.active) {
    return { state, events, error: fromResume ? undefined : "No active creature" };
  }
  
  if (!fromResume) {
    if (state.firstTurn) {
      return { state, events, error: "Cannot attack on first turn" };
    }
    
    if (state.hasAttacked) {
      return { state, events, error: "Already attacked this turn" };
    }
    
    if (state.hasRetreated) {
      return { state, events, error: "Cannot attack after retreating" };
    }
  }
  
  const attacker = player.active;
  if (fromResume && attackerUid && attacker.uid !== attackerUid) {
    state.hasAttacked = true;
    return { state, events };
  }
  
  if (!fromResume) {
    // CHECK: beforeAttack trigger
    const beforeAttackTrigger = checkTriggers(
      'beforeAttack',
      { attacker, defender: opponent.active },
      player, opponent, side, oppSide
    );
    events.push(...beforeAttackTrigger.events);
    if (beforeAttackTrigger.negated) {
      state.hasAttacked = true;
      return { state, events };
    }
  }
  
  // Cindermaw: Frenzy - attacks twice
  const attackCount = attacker.id === 'cindermaw' ? 2 : 1;
  if (!fromResume && attacker.id === 'cindermaw') {
    events.push({ type: 'abilityTrigger', side, creature: attacker.name, ability: 'Frenzy' });
  }
  
  for (let hit = startHit; hit < attackCount; hit++) {
    if (!player.active || player.active.uid !== attacker.uid) break;
    
    let damage = getEffectiveAtk(attacker, player, opponent);
    
    // Pulsefin: First attack deals double damage
    if (attacker.id === 'pulsefin' && attacker.firstAtk) {
      damage *= 2;
      attacker.firstAtk = false;
      events.push({ type: 'abilityTrigger', side, creature: attacker.name, ability: 'Sonic Strike' });
      events.push({ type: 'atkBonus', side, amount: damage / 2, source: 'Sonic Strike' });
    }

    // Live defender each hit (Frenzy may KO then hit the replacement)
    const defender = opponent.active;
    
    if (defender) {
      events.push({ type: 'attack', side, damage });
      
      // CHECK: beforeDamage trigger (Swarm Shield, Brace, etc.)
      const beforeDamageTrigger = checkTriggers('beforeDamage', { attacker, defender, damage }, player, opponent, side, oppSide);
      events.push(...beforeDamageTrigger.events);
      
      // Optional trigger — pause before consuming attack bonuses / finishing the hit
      if (beforeDamageTrigger.pendingAction) {
        return {
          state,
          events,
          pendingAction: {
            ...beforeDamageTrigger.pendingAction,
            context: {
              ...beforeDamageTrigger.pendingAction.context,
              damage,
              resumeAttack: { hit, attackCount, attackerUid: attacker.uid }
            }
          }
        };
      }

      // Consume one-shot attack bonuses only once damage is committed
      player.attackBonuses = [];
      
      if (beforeDamageTrigger.damageReduction) {
        damage = Math.max(0, damage - beforeDamageTrigger.damageReduction);
      }
      
      // Unbreakable verse
      if (opponent.unbreakable) {
        damage = 0;
        opponent.unbreakable = false;
        events.push({ type: 'damageNegated', side: oppSide, source: 'Unbreakable' });
      }
      
      // Declarative creature DR (Iron Skin, Sturdy, Harden, Juggernaut, Den Guard, …)
      damage = applyCreatureDamageReduction(defender, opponent, damage, {
        events,
        side: oppSide
      });
      
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
      
      // Survival mechanics
      if (ko && defender.id === 'bulwark' && !defender.bulwarkUsed) {
        defender.curHp = 1;
        defender.bulwarkUsed = true;
        ko = false;
        events.push({ type: 'abilityTrigger', side: oppSide, creature: defender.name, ability: 'Fortress' });
        events.push({ type: 'survival', side: oppSide, creature: defender.name, hp: 1 });
      }
      
      if (ko && defender.fortified) {
        defender.curHp = 1;
        defender.fortified = false;
        ko = false;
        events.push({ type: 'survival', side: oppSide, creature: defender.name, hp: 1, source: 'Fortify' });
      }
      
      // Skitter: Optional swap after taking damage
      if (!ko && defender.id === 'skitter' && opponent.bench.length > 0) {
        events.push({ type: 'abilityTrigger', side: oppSide, creature: defender.name, ability: 'Scurry' });
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
      
      // On death triggers
      if (ko) {
        events.push({ type: 'ko', side: oppSide, creature: defender.name });
        const koedCreature = defender;
        prepareForGrave(defender); opponent.grave.push(defender);
        opponent.active = null;
        
        autoSwapBenchToActive(opponent, oppSide, events);
        
        const onKOTrigger = checkTriggers(
          'onKO',
          { koedCreature, attacker, koOwnerSide: oppSide },
          player, opponent, side, oppSide
        );
        events.push(...onKOTrigger.events);
        if (onKOTrigger.pendingAction) pendingAction = onKOTrigger.pendingAction;
        
        const onAllyKOTrigger = checkTriggers(
          'onAllyKO',
          { koedCreature, attacker, koOwnerSide: oppSide },
          opponent, player, oppSide, side
        );
        events.push(...onAllyKOTrigger.events);
        if (!pendingAction && onAllyKOTrigger.pendingAction) {
          pendingAction = onAllyKOTrigger.pendingAction;
        }
        
        // Gloom: onKO trigger
        const koedCard = CREATURES[koedCreature.id];
        if (koedCard?.ability?.trigger?.event === 'onKO' && 
            koedCard.ability.trigger.condition?.target === 'self' &&
            koedCard.ability.effects?.some(e => e.type === 'discard')) {
          const ctx = buildEffectsContext({ koedCreature, attacker }, opponent, player, oppSide, side);
          ctx.card = koedCard;
          ctx.self = koedCreature;
          
          const handBefore = [...player.hand];
          const result = processEffects(koedCard.ability, ctx);
          
          if (result.modifiedContext?.discarded || (handBefore.length > player.hand.length)) {
            events.push({ type: 'abilityTrigger', side: oppSide, creature: koedCreature.name, ability: koedCard.ability.name });
            const discardedCard = handBefore.find(c => !player.hand.some(h => h.uid === c.uid));
            if (discardedCard) {
              events.push({ type: 'discard', side, card: discardedCard.name });
            }
          }
        }
        
        // Echomask: Enemy loses 1 life
        if (koedCreature.id === 'echomask') {
          const echomaskLifeLossTrigger = checkTriggers('onLifeLoss', { amount: 1, targetSide: side }, opponent, player, oppSide, side);
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
            prepareForGrave(attacker); player.grave.push(attacker);
            player.active = null;
            
            const atkKoTrigger = checkTriggers(
              'onKO',
              { koedCreature: attacker, koOwnerSide: side },
              player, opponent, side, oppSide
            );
            events.push(...atkKoTrigger.events);
            if (!pendingAction && atkKoTrigger.pendingAction) {
              pendingAction = atkKoTrigger.pendingAction;
            }
            
            const atkAllyKoTrigger = checkTriggers(
              'onAllyKO',
              { koedCreature: attacker, koOwnerSide: side },
              player, opponent, side, oppSide
            );
            events.push(...atkAllyKoTrigger.events);
            if (!pendingAction && atkAllyKoTrigger.pendingAction) {
              pendingAction = atkAllyKoTrigger.pendingAction;
            }
          }
        }
      }
      
      // Reflection damage
      const defenderCard = CREATURES[defender.id];
      if (defenderCard?.ability?.trigger?.event === 'afterAttack' && 
          defenderCard.ability.trigger.condition?.defender === 'self') {
        const ctx = buildEffectsContext({ attacker, defender, damage }, player, opponent, side, oppSide);
        ctx.card = defenderCard;
        ctx.self = defender;
        ctx.attackerOwner = player;
        ctx.attackerOwnerKey = 'me';
        
        const result = processEffects(defenderCard.ability, ctx);
        
        if (result.events.length > 0 || result.kos?.length > 0) {
          events.push({ type: 'abilityTrigger', side: oppSide, creature: defender.name, ability: defenderCard.ability.name });
        }
        
        for (const evt of result.events) {
          if (evt.type === 'damage') {
            events.push({ type: 'damage', side, amount: evt.amount, source: defenderCard.ability.name });
          } else if (evt.type !== 'log') {
            events.push(evt);
          }
        }
        
        for (const koInfo of result.kos || []) {
          events.push({ type: 'ko', side, creature: attacker.name });
          prepareForGrave(attacker); player.grave.push(attacker);
          player.active = null;
          
          autoSwapBenchToActive(player, side, events);
          
          const onKOTrigger = checkTriggers(
            'onKO',
            { koedCreature: attacker, koOwnerSide: side },
            player, opponent, side, oppSide
          );
          events.push(...onKOTrigger.events);
          if (!pendingAction && onKOTrigger.pendingAction) {
            pendingAction = onKOTrigger.pendingAction;
          }
          
          const onAllyKOTrigger = checkTriggers(
            'onAllyKO',
            { koedCreature: attacker, koOwnerSide: side },
            player, opponent, side, oppSide
          );
          events.push(...onAllyKOTrigger.events);
          if (!pendingAction && onAllyKOTrigger.pendingAction) {
            pendingAction = onAllyKOTrigger.pendingAction;
          }
        }
      }
      
      // Attacker on-hit triggers
      if (!ko && defender && damage > 0) {
        const attackerCard = CREATURES[attacker.id];
        if (attackerCard?.ability?.trigger?.event === 'afterAttack' || 
            attackerCard?.ability?.trigger?.event === 'onHit') {
          const triggerCondition = attackerCard.ability.trigger.condition;
          const isAttackerAbility = triggerCondition?.attacker === 'self';
          const didDamageOk = !triggerCondition?.didDamage || damage > 0;
          const defenderAliveOk = !triggerCondition?.defenderAlive || !ko;
          
          if (isAttackerAbility && didDamageOk && defenderAliveOk) {
            const ctx = buildEffectsContext({ attacker, defender, damage }, player, opponent, side, oppSide);
            ctx.card = attackerCard;
            ctx.self = attacker;
            ctx.damageDealt = damage;
            ctx.attackerOwner = player;
            ctx.attackerOwnerKey = 'me';
            ctx.defenderOwner = opponent;
            
            const result = processEffects(attackerCard.ability, ctx);
            
            if (result.events.length > 0) {
              events.push({ type: 'abilityTrigger', side, creature: attacker.name, ability: attackerCard.ability.name });
            }
            
            for (const evt of result.events) {
              if (evt.type === 'log') {
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
      
      // Attacker on-kill triggers
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
      // Direct attack on life points (only if damage > 0)
      if (damage > 0) {
        events.push({ type: 'attack', side, damage, direct: true });
        
        const onLifeLossTrigger = checkTriggers('onLifeLoss', { amount: 1, targetSide: oppSide }, player, opponent, side, oppSide);
        events.push(...onLifeLossTrigger.events);
        
        if (!onLifeLossTrigger.negated) {
          opponent.lp -= 1;
          events.push({ type: 'lpDamage', side: oppSide, amount: 1 });
        }
      }
    }
  }
  
  // Cindermaw self-damage
  if (attacker.id === 'cindermaw' && player.active && player.active.uid === attacker.uid) {
    const selfKo = applyDamage(attacker, 10);
    events.push({ type: 'damage', side, amount: 10, source: 'Frenzy (Burnout)' });
    if (selfKo) {
      events.push({ type: 'ko', side, creature: attacker.name });
      prepareForGrave(attacker); player.grave.push(attacker);
      player.active = null;
      
      autoSwapBenchToActive(player, side, events);
      
      const onKOTrigger = checkTriggers(
        'onKO',
        { koedCreature: attacker, koOwnerSide: side },
        player, opponent, side, oppSide
      );
      events.push(...onKOTrigger.events);
      if (!pendingAction && onKOTrigger.pendingAction) {
        pendingAction = onKOTrigger.pendingAction;
      }
      
      const onAllyKOTrigger = checkTriggers(
        'onAllyKO',
        { koedCreature: attacker, koOwnerSide: side },
        player, opponent, side, oppSide
      );
      events.push(...onAllyKOTrigger.events);
      if (!pendingAction && onAllyKOTrigger.pendingAction) {
        pendingAction = onAllyKOTrigger.pendingAction;
      }
    }
  }
  
  state.hasAttacked = true;
  return { state, events, pendingAction };
}

// ═══════════════════════════════════════════════════════════════
// ACTION: CAST VERSE
// ═══════════════════════════════════════════════════════════════

export function castVerse(state, playerIdx, cardUid, action = {}) {
  const events = [];
  const player = state.players[playerIdx];
  const opponent = state.players[1 - playerIdx];
  const side = playerIdx === 0 ? 'p1' : 'p2';
  const oppSide = playerIdx === 0 ? 'p2' : 'p1';
  let pendingAction = null;
  
  const applyCastEffects = (cardRef, ctxRef) => {
    const { events: cardEvents, pendingAction: castPending } =
      processCastVerseEffects(cardRef, ctxRef, player, opponent, side, oppSide);
    events.push(...cardEvents);
    if (!pendingAction && castPending) pendingAction = castPending;
  };
  
  const card = player.hand.find(c => c.uid === cardUid);
  if (!card || card.cardType !== 'verse' || card.type !== 'cast') {
    return { state, events, error: "Invalid card" };
  }
  
  if (card.cost > player.mana) {
    return { state, events, error: "Not enough mana" };
  }
  
  // Check selection requirements
  const verseTemplate = VERSES[card.id];
  if (verseTemplate?.selection) {
    const selection = resolveSelection(state, playerIdx, action, verseTemplate.selection);
    if (selection?.needsSelection) {
      // Return structured response so client can show selection UI
      return { 
        state, 
        events, 
        needsSelection: true, 
        selectionConfig: { ...verseTemplate.selection, cardUid } 
      };
    }
    if (selection?.error) {
      return { state, events, error: selection.error };
    }
    action.selected = selection;
  }
  
  player.mana -= card.cost;
  player.hand = player.hand.filter(c => c.uid !== cardUid);
  
  // CHECK: onCast trigger
  const onCastTrigger = checkTriggers('onCast', { spell: card }, player, opponent, side, oppSide);
  events.push(...onCastTrigger.events);
  
  if (onCastTrigger.negated) {
    player.grave.push(card);
    return { state, events };
  }
  
  player.grave.push(card);
  events.push({ type: 'cast', side, verse: card.name });
  
  // Execute verse effects
  const ctx = buildEffectsContext({ selected: action.selected }, player, opponent, side, oppSide);
  
  switch (card.id) {
    case 'darkPact': {
      const darkPactLifeLossTrigger = checkTriggers('onLifeLoss', { amount: 1, targetSide: side }, opponent, player, oppSide, side);
      events.push(...darkPactLifeLossTrigger.events);
      
      if (!darkPactLifeLossTrigger.negated) {
        applyCastEffects(card, ctx);
      } else {
        draw(player);
        draw(player);
        events.push({ type: 'draw', count: 2 });
      }
      break;
    }
    
    case 'predatorsMark':
    case 'manaSurge':
    case 'secondWind':
    case 'shellArmor':
    case 'regenerate':
    case 'fortify':
    case 'bloodMoon': {
      applyCastEffects(card, ctx);
      break;
    }
    
    case 'unbreakable': {
      player.unbreakable = true;
      events.push({ type: 'setFlag', side, flag: 'unbreakable' });
      break;
    }
    
    case 'ignite':
    case 'banish':
    case 'soulSiphon': {
      if (!action.selected) {
        player.mana += card.cost;
        player.hand.push(card);
        player.grave = player.grave.filter(c => c.uid !== card.uid);
        return { state, events, error: verseTemplate?.selection?.prompt || 'Select target creature' };
      }
      applyCastEffects(card, ctx);
      if (card.id === 'banish') {
        events.push({ type: 'banish', side: action.selected.ownerKey === 'me' ? side : oppSide, creature: action.selected.creature.name });
      }
      break;
    }
    
    case 'callOfTheWild': {
      const oneCostCreatures = player.deck.filter(c => c.cardType === 'creature' && c.cost === 1);
      if (oneCostCreatures.length > 0 && player.bench.length < 2) {
        const randIdx = Math.floor(Math.random() * oneCostCreatures.length);
        const creature = oneCostCreatures[randIdx];
        player.deck = player.deck.filter(c => c.uid !== creature.uid);
        
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
      break;
    }
    
    default:
      // Generic verse - try processEffects
      applyCastEffects(card, ctx);
  }
  
  return { state, events, pendingAction };
}

// ═══════════════════════════════════════════════════════════════
// ACTION: SET VERSE
// ═══════════════════════════════════════════════════════════════

export function setVerse(state, playerIdx, cardUid) {
  const events = [];
  const player = state.players[playerIdx];
  const side = playerIdx === 0 ? 'p1' : 'p2';
  
  const card = player.hand.find(c => c.uid === cardUid);
  if (!card || card.cardType !== 'verse' || card.type !== 'set') {
    return { state, events, error: "Invalid card" };
  }
  
  if (card.cost > player.mana) {
    return { state, events, error: "Not enough mana" };
  }
  
  if (player.setVerse) {
    return { state, events, error: "Already have a set verse" };
  }
  
  player.mana -= card.cost;
  player.hand = player.hand.filter(c => c.uid !== cardUid);
  player.setVerse = card;
  
  events.push({ type: 'setVerse', side, verse: card.name });
  return { state, events };
}

// ═══════════════════════════════════════════════════════════════
// ACTION: RETREAT
// ═══════════════════════════════════════════════════════════════

export function retreat(state, playerIdx, benchIdx) {
  const events = [];
  const player = state.players[playerIdx];
  const side = playerIdx === 0 ? 'p1' : 'p2';
  
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
  
  if (benchIdx < 0 || benchIdx >= player.bench.length) {
    return { state, events, error: "Invalid bench index" };
  }
  
  const fromCreature = player.active;
  const toCreature = player.bench[benchIdx];
  
  player.active = toCreature;
  player.bench[benchIdx] = fromCreature;
  
  events.push({ type: 'retreat', side, from: fromCreature.name, to: toCreature.name });
  state.hasRetreated = true;
  
  // Chain Lightning: damage newly active creature after retreat
  if (player.chainLightning > 0) {
    const chainDamage = player.chainLightning;
    player.chainLightning = 0;
    
    const newActive = player.active;
    newActive.curHp -= chainDamage;
    events.push({ type: 'damage', side, amount: chainDamage, source: 'Chain Lightning' });
    
    if (newActive.curHp <= 0) {
      events.push({ type: 'ko', side, creature: newActive.name, source: 'Chain Lightning' });
      prepareForGrave(newActive);
      player.grave.push(newActive);
      player.active = null;
      autoSwapBenchToActive(player, side, events);
    }
  }
  
  return { state, events };
}

// ═══════════════════════════════════════════════════════════════
// ACTION: END TURN
// ═══════════════════════════════════════════════════════════════

export function endTurn(state, playerIdx) {
  const events = [];
  const player = state.players[playerIdx];
  const nextPlayerIdx = 1 - playerIdx;
  const nextPlayer = state.players[nextPlayerIdx];
  const side = playerIdx === 0 ? 'p1' : 'p2';
  const nextSide = playerIdx === 0 ? 'p2' : 'p1';
  
  // Clear summonedThisTurn flags
  if (player.active) player.active.summonedThisTurn = false;
  player.bench.forEach(c => c.summonedThisTurn = false);
  
  // Clear trapped status at end of turn
  if (player.active && player.active.status === 'trapped') {
    player.active.status = null;
    events.push({ type: 'clearStatus', side, status: 'trapped' });
  }
  
  // Reset per-turn damage reduction flags
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
    events.push({ type: 'damage', side, amount: 10, source: 'Poison' });
    if (ko) {
      events.push({ type: 'ko', side, creature: player.active.name });
      prepareForGrave(player.active); player.grave.push(player.active);
      player.active = null;
      autoSwapBenchToActive(player, side, events);
    }
  }
  
  // Broodmother spawn
  if (player.active && player.active.id === 'broodmother' && player.bench.length < 2) {
    const antling = mkCreature('hiveling');
    antling.name = 'Antling';
    antling.hp = 10;
    antling.curHp = 10;
    antling.atk = 10;
    player.bench.push(antling);
    events.push({ type: 'abilityTrigger', side, creature: player.active.name, ability: 'Spawn' });
    events.push({ type: 'summon', side, creature: 'Antling', slot: 'bench' });
  }
  
  // Switch turn
  state.currentPlayer = nextPlayerIdx + 1;
  state.turn += (nextPlayerIdx === 0 ? 1 : 0);
  const wasFirstTurn = state.firstTurn;
  state.firstTurn = false;
  state.hasAttacked = false;
  state.hasRetreated = false;
  
  // Next player: increment mana and draw
  if (!wasFirstTurn) {
    nextPlayer.maxMana = Math.min(5, nextPlayer.maxMana + 1);
  }
  nextPlayer.mana = nextPlayer.maxMana;
  events.push({ type: 'manaGain', side: nextSide });
  
  const drawResult = draw(nextPlayer);
  if (drawResult.success) {
    events.push(...drawResult.events);
  } else {
    state.winner = playerIdx;
    events.push({ type: 'gameOver', winner: side, reason: 'Deck out' });
  }
  
  events.push({ type: 'turnStart', yourTurn: false });
  
  return { state, events };
}

// ═══════════════════════════════════════════════════════════════
// ACTION: SPECIAL ACTIONS
// ═══════════════════════════════════════════════════════════════

export function skitterSwap(state, playerIdx, benchIdx) {
  const events = [];
  const player = state.players[playerIdx];
  const side = playerIdx === 0 ? 'p1' : 'p2';
  
  if (!player.active || player.active.id !== 'skitter') {
    return { state, events, error: "No skitter in active slot" };
  }
  
  if (player.bench.length === 0) {
    return { state, events, error: "No bench creatures to swap with" };
  }
  
  if (benchIdx === undefined || benchIdx < 0 || benchIdx >= player.bench.length) {
    return { state, events, error: "Invalid bench index" };
  }
  
  const skitter = player.active;
  const benchCreature = player.bench[benchIdx];
  
  player.active = benchCreature;
  player.bench[benchIdx] = skitter;
  
  events.push({ type: 'skitterSwap', side, from: skitter.name, to: benchCreature.name });
  return { state, events };
}

export function skitterDecline(state, playerIdx) {
  const events = [];
  const side = playerIdx === 0 ? 'p1' : 'p2';
  events.push({ type: 'skitterDecline', side });
  return { state, events };
}

export function respondOptionalTrigger(state, playerIdx, action) {
  const events = [];
  const player = state.players[playerIdx];
  const opponent = state.players[1 - playerIdx];
  const side = playerIdx === 0 ? 'p1' : 'p2';
  const oppSide = playerIdx === 0 ? 'p2' : 'p1';
  
  const { confirmed, verseId, context: serializedContext = {} } = action;
  
  if (!player.setVerse || player.setVerse.id !== verseId) {
    return { state, events, error: "No matching verse set" };
  }
  
  const verse = player.setVerse;
  const verseTemplate = VERSES[verseId];
  const triggerEvent = verseTemplate?.triggerDef?.event;
  const damage = serializedContext.damage || 0;
  const defender = player.active;
  const attacker = opponent.active;
  // Merge live board refs with pending context (koedCreature, etc.)
  const triggerContext = {
    ...serializedContext,
    attacker: attacker || serializedContext.attacker,
    defender: defender || serializedContext.defender,
    damage
  };
  
  // Damage was deferred for beforeDamage / lethal gates — not for post-KO verses
  const defersDamage = triggerEvent === 'beforeDamage' ||
    triggerEvent === 'beforeKO' ||
    triggerEvent === 'onLethalDamage' ||
    ['swarmShield', 'brace', 'vengeance'].includes(verseId);
  
  if (confirmed) {
    const result = executeTrigger(verse, triggerContext, player, opponent, side, oppSide);
    events.push(...result.events);
    
    player.grave.push(verse);
    player.setVerse = null;
    
    // Apply deferred damage after trigger (Swarm Shield / Brace / Vengeance)
    if (defersDamage && defender && damage > 0) {
      const finalDamage = (result.modifiedDamage !== null && result.modifiedDamage !== undefined)
        ? result.modifiedDamage
        : Math.max(0, damage - (result.damageReduction || 0));
      if (finalDamage > 0) {
        const ko = applyDamage(defender, finalDamage);
        events.push({ type: 'damage', side, amount: finalDamage });
        
        if (ko) {
          prepareForGrave(defender); player.grave.push(defender);
          player.active = null;
          events.push({ type: 'ko', side, creature: defender.name });
          autoSwapBenchToActive(player, side, events);
        }
      }
      // Attacker spent one-shot bonuses for this hit
      opponent.attackBonuses = [];

      const resumed = resumeMultiHitAttack(state, playerIdx, serializedContext, events);
      if (resumed) return resumed;

      state.hasAttacked = true;
    }
  } else {
    player.grave.push(verse);
    player.setVerse = null;
    events.push({ type: 'triggerDeclined', side, verse: verse.name });
    
    if (defersDamage && defender && damage > 0) {
      const ko = applyDamage(defender, damage);
      events.push({ type: 'damage', side, amount: damage });
      
      if (ko) {
        prepareForGrave(defender); player.grave.push(defender);
        player.active = null;
        events.push({ type: 'ko', side, creature: defender.name });
        autoSwapBenchToActive(player, side, events);
      }
      opponent.attackBonuses = [];

      const resumed = resumeMultiHitAttack(state, playerIdx, serializedContext, events);
      if (resumed) return resumed;

      state.hasAttacked = true;
    }
  }
  
  return { state, events };
}

/**
 * Continue Cindermaw (etc.) remaining hits after optional beforeDamage resolves.
 * @returns {object|null} Full action result if resumed, else null
 */
function resumeMultiHitAttack(state, defenderIdx, context, eventsSoFar) {
  const resume = context?.resumeAttack;
  if (!resume || resume.hit + 1 >= resume.attackCount) return null;

  const attackerIdx = 1 - defenderIdx;
  const attacker = state.players[attackerIdx].active;
  if (!attacker || attacker.uid !== resume.attackerUid) {
    state.hasAttacked = true;
    return { state, events: eventsSoFar };
  }

  const cont = attack(state, attackerIdx, {
    fromResume: true,
    startHit: resume.hit + 1,
    attackerUid: resume.attackerUid
  });
  return {
    state,
    events: [...eventsSoFar, ...(cont.events || [])],
    pendingAction: cont.pendingAction,
    error: cont.error
  };
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXECUTE ACTION
// ═══════════════════════════════════════════════════════════════

/**
 * Execute a game action
 * @param {object} state - Game state
 * @param {number} playerIdx - Player index (0 or 1)
 * @param {object} action - Action object
 * @returns {object} - { state, events, error?, pendingAction? }
 */
export function executeAction(state, playerIdx, action) {
  // Validate turn (except for special actions)
  const specialActions = ['skitterSwap', 'skitterDecline', 'respondOptionalTrigger'];
  if (!specialActions.includes(action.action) && state.currentPlayer !== playerIdx + 1) {
    return { state, events: [], error: "Not your turn" };
  }
  
  let result;
  
  switch (action.action) {
    case 'summon':
      result = summon(state, playerIdx, action.cardUid, action.target);
      break;
    case 'attack':
      result = attack(state, playerIdx);
      break;
    case 'cast':
      result = castVerse(state, playerIdx, action.cardUid, action);
      break;
    case 'set':
      result = setVerse(state, playerIdx, action.cardUid);
      break;
    case 'retreat':
      result = retreat(state, playerIdx, action.benchIdx);
      break;
    case 'endTurn':
      result = endTurn(state, playerIdx);
      break;
    case 'skitterSwap':
      result = skitterSwap(state, playerIdx, action.benchIdx);
      break;
    case 'skitterDecline':
      result = skitterDecline(state, playerIdx);
      break;
    case 'respondOptionalTrigger':
      result = respondOptionalTrigger(state, playerIdx, action);
      break;
    default:
      return { state, events: [], error: "Unknown action" };
  }
  
  // Check win conditions
  const player = state.players[playerIdx];
  const opponent = state.players[1 - playerIdx];
  const side = playerIdx === 0 ? 'p1' : 'p2';
  const oppSide = playerIdx === 0 ? 'p2' : 'p1';
  
  if (player.lp <= 0) {
    state.winner = 1 - playerIdx;
    result.events.push({ type: 'gameOver', winner: oppSide, reason: 'LP depleted' });
  }
  if (opponent.lp <= 0) {
    state.winner = playerIdx;
    result.events.push({ type: 'gameOver', winner: side, reason: 'LP depleted' });
  }
  if (opponent.deck.length === 0 && opponent.hand.length === 0) {
    state.winner = playerIdx;
    result.events.push({ type: 'gameOver', winner: side, reason: 'Deck out' });
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export default {
  // Main action handler
  executeAction,
  
  // Core operations
  createGame,
  attack,
  summon,
  castVerse,
  setVerse,
  retreat,
  endTurn,
  
  // Special actions
  skitterSwap,
  skitterDecline,
  respondOptionalTrigger,
  
  // Helpers
  draw,
  applyDamage,
  autoSwapBenchToActive,
  getEffectiveAtk,
  resolveSelection,
  
  // Card creation
  mkCreature,
  mkVerse,
  mkDeck,
  mkPlayer
};

// ═══════════════════════════════════════════════════════════════
// GAME ENGINE (Pure Functions)
// ═══════════════════════════════════════════════════════════════
// Core game operations - all functions are pure (no mutations)
// Each returns { state: newState, events: [...] }

import { CREATURES, VERSES, DECKS } from './cards.js';
import { processEffects } from './effects.js';
import { findMatchingTriggers, sortByPriority } from './triggers.js';

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a unique ID
 */
function uid() {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Shuffle an array (Fisher-Yates)
 */
function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Deep clone an object
 */
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ═══════════════════════════════════════════════════════════════
// CARD CREATION
// ═══════════════════════════════════════════════════════════════

/**
 * Create a creature instance from template
 * @param {String} id - Creature ID from CREATURES
 * @returns {Object} - Creature instance
 */
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

/**
 * Create a verse instance from template
 * @param {String} id - Verse ID from VERSES
 * @returns {Object} - Verse instance
 */
export function mkVerse(id) {
  const template = VERSES[id];
  if (!template) throw new Error(`Unknown verse: ${id}`);
  
  return {
    ...template,
    cardType: 'verse',
    uid: uid()
  };
}

/**
 * Create a shuffled deck from deck definition
 * @param {String} deckId - Deck ID from DECKS
 * @returns {Array} - Shuffled deck of card instances
 */
export function mkDeck(deckId) {
  const def = DECKS[deckId];
  if (!def) throw new Error(`Unknown deck: ${deckId}`);
  
  const cards = [
    ...def.creatures.map(mkCreature),
    ...def.verses.map(mkVerse)
  ];
  
  return shuffle(cards);
}

/**
 * Create a player state
 * @param {String} deckId - Deck ID from DECKS
 * @returns {Object} - Player state
 */
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

// ═══════════════════════════════════════════════════════════════
// GAME CREATION
// ═══════════════════════════════════════════════════════════════

/**
 * Create initial game state
 * @param {String} deck1Id - Player 1 deck ID
 * @param {String} deck2Id - Player 2 deck ID
 * @returns {Object} - Initial game state
 */
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
 * Draw a card from player's deck (PURE - returns new player state)
 * @param {Object} player - Player state
 * @returns {Object} - { player: newPlayer, success: boolean, events: [] }
 */
export function draw(player) {
  const events = [];
  
  if (player.deck.length === 0) {
    return { player, success: false, events };
  }
  
  const newDeck = [...player.deck];
  const card = newDeck.pop();
  const newHand = [...player.hand, card];
  
  const newPlayer = {
    ...player,
    deck: newDeck,
    hand: newHand
  };
  
  events.push({ type: 'draw', count: 1 });
  
  return { player: newPlayer, success: true, events };
}

/**
 * Apply damage to a creature (PURE - returns new creature and KO status)
 * @param {Object} creature - Creature to damage
 * @param {Number} amount - Damage amount
 * @returns {Object} - { creature: newCreature, ko: boolean }
 */
export function applyDamage(creature, amount) {
  const newCreature = {
    ...creature,
    curHp: creature.curHp - amount
  };
  
  return {
    creature: newCreature,
    ko: newCreature.curHp <= 0
  };
}

/**
 * Auto-swap bench creature to active if active is empty (PURE)
 * @param {Object} player - Player state
 * @param {Array} events - Events array to append to
 * @returns {Object} - { player: newPlayer, events }
 */
export function autoSwapBenchToActive(player, events = []) {
  if (player.active || player.bench.length === 0) {
    return { player, events };
  }
  
  const newBench = [...player.bench];
  const swapped = newBench.shift();
  
  const newPlayer = {
    ...player,
    active: swapped,
    bench: newBench
  };
  
  events.push({ type: 'benchToActive', creature: swapped.name });
  
  return { player: newPlayer, events };
}

/**
 * Get effective attack value for a creature
 * @param {Object} creature - Attacking creature
 * @param {Object} owner - Owner player
 * @param {Object} opponent - Opponent player
 * @returns {Number} - Effective attack value
 */
export function getEffectiveAtk(creature, owner, opponent) {
  let atk = creature.atk;
  
  // Apply passive abilities
  if (creature.ability?.passive?.type === 'atkBonus') {
    atk += creature.ability.passive.amount;
  }
  
  // Apply temporary attack bonuses
  for (const bonus of owner.attackBonuses || []) {
    atk += bonus.value;
  }
  
  // Special cases
  if (creature.id === 'echomask' && opponent.active) {
    atk = opponent.active.atk;
  }
  
  if (creature.id === 'alpha') {
    atk += owner.bench.length * 10;
  }
  
  if (creature.id === 'fangpup') {
    const otherCreatures = (owner.active && owner.active.uid !== creature.uid ? 1 : 0) +
                          owner.bench.filter(c => c.uid !== creature.uid).length;
    atk += otherCreatures * 10;
  }
  
  return atk;
}

// ═══════════════════════════════════════════════════════════════
// CORE GAME OPERATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Attack with active creature (PURE)
 * @param {Object} state - Current game state
 * @param {Number} playerIdx - Attacking player index (0 or 1)
 * @returns {Object} - { state: newState, events: [] }
 */
export function attack(state, playerIdx) {
  const events = [];
  let newState = clone(state);
  
  const player = newState.players[playerIdx];
  const opponent = newState.players[1 - playerIdx];
  
  // Validation
  if (!player.active) {
    return { state, events, error: "No active creature" };
  }
  
  if (newState.hasAttacked) {
    return { state, events, error: "Already attacked this turn" };
  }
  
  const attacker = player.active;
  const defender = opponent.active;
  
  // Calculate damage
  const damage = getEffectiveAtk(attacker, player, opponent);
  
  events.push({ type: 'attack', damage });
  
  if (defender) {
    // Attack creature
    const damageResult = applyDamage(defender, damage);
    opponent.active = damageResult.creature;
    
    events.push({ type: 'damage', amount: damage, target: defender.name });
    
    if (damageResult.ko) {
      events.push({ type: 'ko', creature: defender.name });
      opponent.grave.push(damageResult.creature);
      opponent.active = null;
      
      // Auto-swap bench to active
      const swapResult = autoSwapBenchToActive(opponent, events);
      newState.players[1 - playerIdx] = swapResult.player;
      events.push(...swapResult.events);
    }
  } else {
    // Direct attack on life points
    opponent.lp -= 1;
    events.push({ type: 'lpDamage', amount: 1 });
  }
  
  newState.hasAttacked = true;
  
  return { state: newState, events };
}

/**
 * Summon a creature (PURE)
 * @param {Object} state - Current game state
 * @param {Number} playerIdx - Summoning player index
 * @param {String} cardUid - UID of card in hand
 * @param {String} slot - 'active' or 'bench'
 * @returns {Object} - { state: newState, events: [] }
 */
export function summon(state, playerIdx, cardUid, slot = 'auto') {
  const events = [];
  let newState = clone(state);
  
  const player = newState.players[playerIdx];
  
  // Find card in hand
  const cardIdx = player.hand.findIndex(c => c.uid === cardUid);
  if (cardIdx === -1) {
    return { state, events, error: "Card not in hand" };
  }
  
  const card = player.hand[cardIdx];
  
  if (card.cardType !== 'creature') {
    return { state, events, error: "Card is not a creature" };
  }
  
  if (card.cost > player.mana) {
    return { state, events, error: "Not enough mana" };
  }
  
  // Deduct mana and remove from hand
  player.mana -= card.cost;
  player.hand.splice(cardIdx, 1);
  
  // Determine summon location
  const targetSlot = slot === 'auto' ? (!player.active ? 'active' : 'bench') : slot;
  
  if (targetSlot === 'active') {
    if (player.active) {
      return { state, events, error: "Active slot occupied" };
    }
    card.summonedThisTurn = true;
    player.active = card;
    events.push({ type: 'summon', creature: card.name, slot: 'active' });
  } else {
    if (player.bench.length >= 2) {
      return { state, events, error: "Bench full" };
    }
    card.summonedThisTurn = true;
    player.bench.push(card);
    events.push({ type: 'summon', creature: card.name, slot: 'bench' });
  }
  
  return { state: newState, events };
}

/**
 * Cast a verse (PURE)
 * @param {Object} state - Current game state
 * @param {Number} playerIdx - Casting player index
 * @param {String} cardUid - UID of verse in hand
 * @param {Object} selection - Target selection (varies by verse)
 * @returns {Object} - { state: newState, events: [] }
 */
export function castVerse(state, playerIdx, cardUid, selection = {}) {
  const events = [];
  let newState = clone(state);
  
  const player = newState.players[playerIdx];
  const opponent = newState.players[1 - playerIdx];
  
  // Find card in hand
  const cardIdx = player.hand.findIndex(c => c.uid === cardUid);
  if (cardIdx === -1) {
    return { state, events, error: "Card not in hand" };
  }
  
  const card = player.hand[cardIdx];
  
  if (card.cardType !== 'verse' || card.type !== 'cast') {
    return { state, events, error: "Card is not a cast verse" };
  }
  
  if (card.cost > player.mana) {
    return { state, events, error: "Not enough mana" };
  }
  
  // Deduct mana and move to grave
  player.mana -= card.cost;
  player.hand.splice(cardIdx, 1);
  player.grave.push(card);
  
  events.push({ type: 'cast', verse: card.name });
  
  // Process effects (using effects.js)
  const effectsResult = processEffects(card.effects || [], {
    state: newState,
    playerIdx,
    selection
  });
  
  newState = effectsResult.state;
  events.push(...effectsResult.events);
  
  return { state: newState, events };
}

/**
 * Set a verse face-down (PURE)
 * @param {Object} state - Current game state
 * @param {Number} playerIdx - Setting player index
 * @param {String} cardUid - UID of verse in hand
 * @returns {Object} - { state: newState, events: [] }
 */
export function setVerse(state, playerIdx, cardUid) {
  const events = [];
  let newState = clone(state);
  
  const player = newState.players[playerIdx];
  
  // Find card in hand
  const cardIdx = player.hand.findIndex(c => c.uid === cardUid);
  if (cardIdx === -1) {
    return { state, events, error: "Card not in hand" };
  }
  
  const card = player.hand[cardIdx];
  
  if (card.cardType !== 'verse' || card.type !== 'set') {
    return { state, events, error: "Card is not a set verse" };
  }
  
  if (card.cost > player.mana) {
    return { state, events, error: "Not enough mana" };
  }
  
  if (player.setVerse) {
    return { state, events, error: "Already have a set verse" };
  }
  
  // Deduct mana and remove from hand
  player.mana -= card.cost;
  player.hand.splice(cardIdx, 1);
  player.setVerse = card;
  
  events.push({ type: 'setVerse', verse: card.name });
  
  return { state: newState, events };
}

/**
 * End turn and switch players (PURE)
 * @param {Object} state - Current game state
 * @param {Number} playerIdx - Ending player index
 * @returns {Object} - { state: newState, events: [] }
 */
export function endTurn(state, playerIdx) {
  const events = [];
  let newState = clone(state);
  
  const player = newState.players[playerIdx];
  
  // Reset turn flags
  player.attackBonuses = [];
  if (player.active) {
    player.active.summonedThisTurn = false;
  }
  player.bench.forEach(c => c.summonedThisTurn = false);
  
  // Switch players
  newState.currentPlayer = newState.currentPlayer === 1 ? 2 : 1;
  newState.hasAttacked = false;
  newState.hasRetreated = false;
  newState.firstTurn = false;
  
  const nextPlayer = newState.players[newState.currentPlayer - 1];
  
  // Draw phase for next player
  const drawResult = draw(nextPlayer);
  newState.players[newState.currentPlayer - 1] = drawResult.player;
  events.push(...drawResult.events);
  
  // Mana phase
  if (nextPlayer.maxMana < 5) {
    nextPlayer.maxMana += 1;
  }
  nextPlayer.mana = nextPlayer.maxMana;
  events.push({ type: 'manaGain', amount: nextPlayer.mana });
  
  // Increment turn counter (when returning to player 1)
  if (newState.currentPlayer === 1) {
    newState.turn += 1;
  }
  
  events.push({ type: 'turnEnd', nextPlayer: newState.currentPlayer });
  
  return { state: newState, events };
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export default {
  // Core operations
  createGame,
  attack,
  summon,
  castVerse,
  setVerse,
  endTurn,
  
  // Helpers
  draw,
  applyDamage,
  autoSwapBenchToActive,
  getEffectiveAtk,
  
  // Card creation
  mkCreature,
  mkVerse,
  mkDeck,
  mkPlayer
};

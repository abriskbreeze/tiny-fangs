// ═══════════════════════════════════════════════════════════════
// GAME ENGINE (Server-side) - Thin Wrapper
// ═══════════════════════════════════════════════════════════════
// Phase 3: Server delegates to shared/engine.js for all game logic

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

import {
  executeAction as sharedExecuteAction,
  draw as sharedDraw,
  applyDamage as sharedApplyDamage,
  autoSwapBenchToActive as sharedAutoSwapBenchToActive,
  getEffectiveAtk as sharedGetEffectiveAtk,
  endTurn as sharedEndTurn
} from '../shared/engine.js';

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
// HELPER FUNCTIONS (Re-export from shared)
// ═══════════════════════════════════════════════════════════════

export function draw(player) {
  return sharedDraw(player);
}

export function applyDamage(creature, amount) {
  return sharedApplyDamage(creature, amount);
}

export function getEffectiveAtk(creature, owner, opponent) {
  return sharedGetEffectiveAtk(creature, owner, opponent);
}

export function getAtkModifiers(creature, owner, opponent) {
  const baseAtk = creature.atk;
  const effectiveAtk = getEffectiveAtk(creature, owner, opponent);
  const modifiers = [];
  
  if (effectiveAtk !== baseAtk) {
    const diff = effectiveAtk - baseAtk;
    if (creature.ability?.passive?.type === 'atkBonus') {
      modifiers.push({ name: creature.ability.name, value: diff });
    }
    for (const bonus of owner.attackBonuses || []) {
      modifiers.push({ name: bonus.source, value: bonus.value });
    }
  }
  
  return { baseAtk, effectiveAtk, modifiers };
}

// ═══════════════════════════════════════════════════════════════
// EXECUTE ACTION (Delegates to shared)
// ═══════════════════════════════════════════════════════════════

/**
 * Execute a game action
 * @param {object} state - Game state
 * @param {number} playerIdx - Player index (0 or 1)
 * @param {object} action - Action object
 * @returns {object} - { state, events, error?, pendingAction? }
 */
export function executeAction(state, playerIdx, action) {
  return sharedExecuteAction(state, playerIdx, action);
}

// ═══════════════════════════════════════════════════════════════
// END TURN (Delegates to shared)
// ═══════════════════════════════════════════════════════════════

export function endTurn(state, playerIdx) {
  // Validate turn
  if (state.currentPlayer !== playerIdx + 1) {
    return { state, events: [], error: "Not your turn" };
  }
  
  return sharedEndTurn(state, playerIdx);
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
      hand: player.hand,
      active: player.active,
      bench: player.bench,
      grave: player.grave,
      setVerse: player.setVerse,
      attackBonuses: player.attackBonuses,
      chainLightning: player.chainLightning,
      unbreakable: player.unbreakable,
      usedManaSurge: !!player.usedManaSurge,
      usedLastBreath: !!player.usedLastBreath
    },
    opp: {
      lp: opponent.lp,
      mana: opponent.mana,
      maxMana: opponent.maxMana,
      deckCount: opponent.deck.length,
      handCount: opponent.hand.length,
      active: opponent.active,
      bench: opponent.bench,
      grave: opponent.grave,
      setVerse: opponent.setVerse ? { faceDown: true } : null,
      chainLightning: opponent.chainLightning
    }
  };
}

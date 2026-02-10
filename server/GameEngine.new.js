// ═══════════════════════════════════════════════════════════════
// GAME ENGINE (Server - Thin Wrapper)
// ═══════════════════════════════════════════════════════════════
// Server-side game engine - wraps shared logic with adapters
// All game rules live in shared/ - this is just the server interface

import {
  createGame as sharedCreateGame,
  attack as sharedAttack,
  summon as sharedSummon,
  castVerse as sharedCastVerse,
  setVerse as sharedSetVerse,
  endTurn as sharedEndTurn,
  draw as sharedDraw,
  mkCreature,
  mkVerse,
  mkDeck,
  mkPlayer,
  applyDamage as sharedApplyDamage,
  getEffectiveAtk,
  autoSwapBenchToActive
} from '../shared/index.js';

// ═══════════════════════════════════════════════════════════════
// RE-EXPORTS (Direct pass-through)
// ═══════════════════════════════════════════════════════════════

export { mkPlayer };

// ═══════════════════════════════════════════════════════════════
// GAME CREATION
// ═══════════════════════════════════════════════════════════════

/**
 * Create initial game state
 * @param {string} deck1Id - Player 1 deck ID
 * @param {string} deck2Id - Player 2 deck ID
 * @returns {object} - Initial game state
 */
export function createGame(deck1Id, deck2Id) {
  return sharedCreateGame(deck1Id, deck2Id);
}

// ═══════════════════════════════════════════════════════════════
// HELPER ADAPTERS (Convert pure → mutable)
// ═══════════════════════════════════════════════════════════════

/**
 * Draw a card (mutable adapter)
 * @param {object} player - Player object (will be mutated)
 * @returns {object} - { success: boolean, events: [] }
 */
export function draw(player) {
  const result = sharedDraw(player);
  
  if (result.success) {
    // Mutate player in-place to match server expectations
    player.deck = result.player.deck;
    player.hand = result.player.hand;
  }
  
  return {
    success: result.success,
    events: result.events
  };
}

/**
 * Apply damage to a creature (mutable adapter)
 * @param {object} creature - Creature to damage (will be mutated)
 * @param {number} amount - Damage amount
 * @returns {boolean} - True if creature was KO'd
 */
export function applyDamage(creature, amount) {
  const result = sharedApplyDamage(creature, amount);
  
  // Mutate creature in-place
  creature.curHp = result.creature.curHp;
  
  return result.ko;
}

/**
 * Get ATK modifiers for display
 * NOTE: This is kept server-side for now, may move to shared later
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
    for (const bonus of owner.attackBonuses || []) {
      modifiers.push({ name: bonus.source, value: bonus.value });
    }
  }
  
  return { baseAtk, effectiveAtk, modifiers };
}

// ═══════════════════════════════════════════════════════════════
// EXECUTE ACTION (Delegates to shared functions)
// ═══════════════════════════════════════════════════════════════

/**
 * Execute a game action
 * @param {object} state - Game state (will be mutated)
 * @param {number} playerIdx - Player index (0 or 1)
 * @param {object} action - Action object { action: 'summon'|'attack'|'cast'|'set'|'retreat', ...params }
 * @returns {object} - { state, events, error?, pendingAction? }
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
  
  let result;
  
  // Delegate to shared functions based on action type
  switch (action.action) {
    case 'summon': {
      const slot = action.target || 'auto';
      result = sharedSummon(state, playerIdx, action.cardUid, slot);
      
      if (result.error) {
        return { state, events, error: result.error };
      }
      
      // Merge shared result into mutable state
      mergeState(state, result.state);
      
      // Map events to include player sides
      events.push(...mapEvents(result.events, side, oppSide));
      break;
    }
    
    case 'attack': {
      result = sharedAttack(state, playerIdx);
      
      if (result.error) {
        return { state, events, error: result.error };
      }
      
      // Merge shared result into mutable state
      mergeState(state, result.state);
      
      // Map events to include player sides
      events.push(...mapEvents(result.events, side, oppSide));
      break;
    }
    
    case 'cast': {
      // Build selection object from action params
      const selection = {
        targetUid: action.targetUid,
        graveUid: action.graveUid,
        sacrificeUid: action.sacrificeUid
      };
      
      result = sharedCastVerse(state, playerIdx, action.cardUid, selection);
      
      if (result.error) {
        return { state, events, error: result.error };
      }
      
      // Merge shared result into mutable state
      mergeState(state, result.state);
      
      // Map events to include player sides
      events.push(...mapEvents(result.events, side, oppSide));
      break;
    }
    
    case 'set': {
      result = sharedSetVerse(state, playerIdx, action.cardUid);
      
      if (result.error) {
        return { state, events, error: result.error };
      }
      
      // Merge shared result into mutable state
      mergeState(state, result.state);
      
      // Map events to include player sides
      events.push(...mapEvents(result.events, side, oppSide));
      break;
    }
    
    case 'retreat': {
      // Retreat is not yet in shared - keep legacy implementation for now
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
      // Skitter ability - keep legacy implementation for now
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
 * @param {object} state - Game state (will be mutated)
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
  const side = playerIdx === 0 ? 'p1' : 'p2';
  const oppSide = playerIdx === 0 ? 'p2' : 'p1';
  
  // === SERVER-SPECIFIC END-OF-TURN EFFECTS ===
  // TODO: Move these to shared/effects.js in Phase 3/4
  
  // Clear summonedThisTurn flags
  if (player.active) player.active.summonedThisTurn = false;
  player.bench.forEach(c => c.summonedThisTurn = false);
  
  // Clear trapped status at end of turn
  if (player.active && player.active.status === 'trapped') {
    player.active.status = null;
    events.push({ type: 'clearStatus', side, status: 'trapped' });
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
      side, 
      amount: 10, 
      source: 'Poison' 
    });
    if (ko) {
      events.push({ 
        type: 'ko', 
        side, 
        creature: player.active.name 
      });
      player.grave.push(player.active);
      player.active = null;
      
      // Auto-swap bench to active
      if (player.bench.length > 0) {
        const swapped = player.bench.shift();
        player.active = swapped;
        events.push({ type: 'benchToActive', side, creature: swapped.name });
      }
    }
  }
  
  // Broodmother spawn (simplified - full trigger system in Phase 4)
  // TODO: Move to creature triggers in shared/effects.js
  if (player.active && player.active.id === 'broodmother' && player.bench.length < 2) {
    const antling = mkCreature('hiveling');  // Placeholder - would be custom token
    antling.name = 'Antling';
    antling.hp = 10;
    antling.curHp = 10;
    antling.atk = 10;
    player.bench.push(antling);
    events.push({ type: 'abilityTrigger', side, creature: player.active.name, ability: 'Spawn' });
    events.push({ type: 'summon', side, creature: 'Antling', slot: 'bench' });
  }
  
  // === DELEGATE TO SHARED ENDTURN ===
  // NOTE: Shared endTurn handles:
  // - Switching players
  // - Incrementing turn counter
  // - Resetting hasAttacked/hasRetreated
  // - Drawing card for next player
  // - Incrementing mana for next player
  
  const result = sharedEndTurn(state, playerIdx);
  
  if (result.error) {
    return { state, events, error: result.error };
  }
  
  // Merge shared result into mutable state
  mergeState(state, result.state);
  
  // Map events to include player sides
  const mappedEvents = mapEvents(result.events, side, oppSide);
  events.push(...mappedEvents);
  
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

// ═══════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Merge immutable state result into mutable state
 * Deep copy approach - replaces entire state
 * @param {object} target - Target state to mutate
 * @param {object} source - Source state (from shared pure function)
 */
function mergeState(target, source) {
  // Replace all properties with source
  // This ensures we get the new state from shared functions
  Object.keys(source).forEach(key => {
    target[key] = source[key];
  });
}

/**
 * Map events from shared format to server format (add side labels)
 * @param {array} events - Events from shared function
 * @param {string} side - Current player side ('p1' or 'p2')
 * @param {string} oppSide - Opponent side ('p1' or 'p2')
 * @returns {array} - Mapped events
 */
function mapEvents(events, side, oppSide) {
  return events.map(event => {
    // If event doesn't have a side yet, try to infer it
    if (!event.side) {
      // Most events belong to the acting player
      return { ...event, side };
    }
    return event;
  });
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

// Re-export shared functions that are used directly
export { getEffectiveAtk };

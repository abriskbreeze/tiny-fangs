// ═══════════════════════════════════════════════════════════════
// GAME ENGINE (Server-side)
// ═══════════════════════════════════════════════════════════════

import { CREATURES, VERSES, DECKS } from './cards.js';
import { uid, shuffle } from './utils.js';

// ═══════════════════════════════════════════════════════════════
// CARD CREATION
// ═══════════════════════════════════════════════════════════════

function mkCreature(id) {
  const t = CREATURES[id];
  return { 
    ...t, 
    cardType: 'creature', 
    curHp: t.hp, 
    status: null, 
    uid: uid(), 
    firstAtk: true,
    summonedThisTurn: false  // For Whisper's Elusive
  };
}

function mkVerse(id) {
  const t = VERSES[id];
  return { ...t, cardType: 'verse', uid: uid() };
}

function mkDeck(deckId) {
  const def = DECKS[deckId];
  const cards = [
    ...def.creatures.map(mkCreature),
    ...def.verses.map(mkVerse)
  ];
  return shuffle(cards);
}

// ═══════════════════════════════════════════════════════════════
// PLAYER CREATION
// ═══════════════════════════════════════════════════════════════

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
    attackBonuses: [], // [{source, value}]
    poisoned: false,
    chainLightning: 0,
    unbreakable: false  // For Unbreakable verse
  };
}

// ═══════════════════════════════════════════════════════════════
// GAME CREATION
// ═══════════════════════════════════════════════════════════════

export function createGame(deck1Id, deck2Id) {
  return {
    turn: 1,
    currentPlayer: 1,  // 1 or 2
    players: [
      mkPlayer(deck1Id),  // Player 1 (index 0)
      mkPlayer(deck2Id)   // Player 2 (index 1)
    ],
    log: [],
    winner: null,
    firstTurn: true,
    hasAttacked: false,  // Track if current player attacked this turn
    hasRetreated: false  // Track if current player retreated this turn
  };
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
  
  // Apply temporary attack bonuses
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
      
      // Trigger onSummon effects (simplified for MVP - full trigger system in Phase 4)
      if (card.id === 'duskfang' && player.grave.some(c => c.cardType === 'creature')) {
        events.push({ type: 'atkBonus', side, amount: 20, source: 'Pack Call' });
      }
      if (card.id === 'emberfang' && opponent.active) {
        const ko = applyDamage(opponent.active, 5);
        events.push({ type: 'damage', side: oppSide, amount: 5, source: 'Spark' });
        if (ko) {
          events.push({ type: 'ko', side: oppSide, creature: opponent.active.name });
          opponent.grave.push(opponent.active);
          opponent.active = null;
        }
      }
      if (card.id === 'hiveling' && location === 'bench') {
        const drawResult = draw(player);
        events.push(...drawResult.events);
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
      
      // Calculate damage
      let damage = getEffectiveAtk(attacker, player, opponent);
      
      // Pulsefin double damage on first attack
      if (attacker.id === 'pulsefin' && attacker.firstAtk) {
        damage *= 2;
        attacker.firstAtk = false;
        events.push({ type: 'atkBonus', side, amount: damage / 2, source: 'Sonic Strike' });
      }
      
      // Clear attack bonuses after use
      player.attackBonuses = [];
      
      if (defender) {
        // Attack creature
        events.push({ type: 'attack', side, damage });
        
        // Apply damage
        const ko = applyDamage(defender, damage);
        events.push({ type: 'damage', side: oppSide, amount: damage });
        
        if (ko) {
          events.push({ type: 'ko', side: oppSide, creature: defender.name });
          opponent.grave.push(defender);
          opponent.active = null;
          
          // Trigger onKO effects (simplified)
          if (defender.id === 'gloom' && player.hand.length > 0) {
            // Discard random card
            const idx = Math.floor(Math.random() * player.hand.length);
            const discarded = player.hand.splice(idx, 1)[0];
            player.grave.push(discarded);
            events.push({ type: 'discard', side, card: discarded.name });
          }
          if (defender.id === 'echomask') {
            player.lp -= 1;
            events.push({ type: 'lpDamage', side, amount: 1 });
          }
          if (defender.id === 'stormtalon') {
            player.chainLightning = 20;
            events.push({ type: 'setFlag', side, flag: 'chainLightning', value: 20 });
          }
        }
        
        // Thorns/Recoil damage
        if (defender.id === 'thornling' || defender.id === 'coilshell') {
          const reflectDmg = defender.id === 'thornling' ? 10 : 10;
          const atkKo = applyDamage(attacker, reflectDmg);
          events.push({ type: 'damage', side, amount: reflectDmg, source: 'Thorns' });
          if (atkKo) {
            events.push({ type: 'ko', side, creature: attacker.name });
            player.grave.push(attacker);
            player.active = null;
          }
        }
        
        // Mireveil trap
        if (attacker.id === 'mireveil' && !ko && defender) {
          defender.status = 'trapped';
          events.push({ type: 'setStatus', side: oppSide, status: 'trapped' });
        }
        
        // Hexweaver poison
        if (attacker.id === 'hexweaver' && !ko && defender) {
          defender.status = 'poison';
          events.push({ type: 'setStatus', side: oppSide, status: 'poison' });
        }
        
        // Sundew Queen heal
        if (attacker.id === 'sundewqueen' && ko) {
          attacker.curHp = Math.min(attacker.hp, attacker.curHp + 30);
          events.push({ type: 'heal', side, amount: 30 });
        }
        
        // Leechling drain
        if (attacker.id === 'leechling' && !ko) {
          attacker.curHp = Math.min(attacker.hp, attacker.curHp + damage);
          events.push({ type: 'heal', side, amount: damage });
        }
        
        // Cindermaw self-damage
        if (attacker.id === 'cindermaw') {
          const selfKo = applyDamage(attacker, 10);
          events.push({ type: 'damage', side, amount: 10, source: 'Frenzy' });
          if (selfKo) {
            events.push({ type: 'ko', side, creature: attacker.name });
            player.grave.push(attacker);
            player.active = null;
          }
        }
      } else {
        // Direct attack on life points
        opponent.lp -= 1;
        events.push({ type: 'lpDamage', side: oppSide, amount: 1 });
        
        // Cindermaw self-damage even on direct attack
        if (attacker.id === 'cindermaw') {
          const selfKo = applyDamage(attacker, 10);
          events.push({ type: 'damage', side, amount: 10, source: 'Frenzy' });
          if (selfKo) {
            events.push({ type: 'ko', side, creature: attacker.name });
            player.grave.push(attacker);
            player.active = null;
          }
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
      player.grave.push(card);
      
      // Execute cast effects (simplified - full effects in Phase 3/4)
      events.push({ type: 'cast', side, verse: card.name });
      
      // Basic cast implementations
      if (card.id === 'darkPact') {
        draw(player);
        draw(player);
        player.lp -= 1;
        events.push({ type: 'draw', count: 2 });
        events.push({ type: 'lpDamage', side, amount: 1 });
      }
      if (card.id === 'predatorsMark') {
        player.attackBonuses.push({ source: "Predator's Mark", value: 30 });
        events.push({ type: 'atkBonus', side, amount: 30, source: "Predator's Mark" });
      }
      if (card.id === 'manaSurge') {
        player.mana += 2;
        player.usedManaSurge = true;
        events.push({ type: 'manaGain', side, amount: 2 });
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
  
  // Clear trapped status
  if (player.active && player.active.status === 'trapped') {
    player.active.status = null;
  }
  
  // Poison damage at end of turn
  if (player.active && player.active.status === 'poison') {
    const ko = applyDamage(player.active, 10);
    events.push({ 
      type: 'damage', 
      side: playerIdx === 0 ? 'p1' : 'p2', 
      amount: 10, 
      source: 'Poison' 
    });
    if (ko) {
      events.push({ 
        type: 'ko', 
        side: playerIdx === 0 ? 'p1' : 'p2', 
        creature: player.active.name 
      });
      player.grave.push(player.active);
      player.active = null;
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
    events.push({ type: 'summon', side: playerIdx === 0 ? 'p1' : 'p2', creature: 'Antling', slot: 'bench' });
  }
  
  // Switch turn
  state.currentPlayer = nextPlayerIdx + 1;
  state.turn += (nextPlayerIdx === 0 ? 1 : 0);  // Increment turn when it cycles back to player 1
  state.firstTurn = false;
  state.hasAttacked = false;
  state.hasRetreated = false;
  
  // Next player: increment mana and draw
  nextPlayer.maxMana = Math.min(5, nextPlayer.maxMana + 1);
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

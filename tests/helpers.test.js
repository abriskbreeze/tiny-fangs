import { describe, it, expect, beforeEach } from 'vitest';
import { state, clearGame, setGame } from '../src/state.js';
import {
  log,
  drawCard,
  checkDeckOut,
  checkPlayerLoss,
  applyLastBreath,
  checkWinConditions,
  shouldMirrorForceTrigger,
  applyMirrorForce,
  shouldGraveRiseTrigger,
  applyGraveRise,
  applyGloomFade,
  applyEchomaskShatter,
  applyStormtalonChainLightning,
  processDeathEffects,
  sendToGrave,
  autoReplace,
} from '../src/helpers.js';

/**
 * Game Helpers Tests
 * 
 * Tests for helper functions extracted to src/helpers.js
 */

// Mock player factory for testing
function mockPlayer(overrides = {}) {
  return {
    lp: 3,
    hand: [],
    deck: [{ id: 'card1' }, { id: 'card2' }, { id: 'card3' }],
    grave: [],
    bench: [],
    active: null,
    setVerse: null,
    chainLightning: 0,
    ...overrides
  };
}

// Mock creature factory
function mockCreature(id, hp = 30) {
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    hp,
    curHp: hp,
    atk: 20,
    cardType: 'creature',
    uid: Math.random().toString(36).slice(2, 9)
  };
}

describe('log() - Game Log', () => {
  
  beforeEach(() => {
    clearGame();
    setGame({
      me: mockPlayer(),
      opp: mockPlayer(),
      log: [],
      winner: null
    });
  });

  it('pushes message to game log', () => {
    log('Test message');
    
    expect(state.G.log).toHaveLength(1);
    expect(state.G.log[0].t).toBe('Test message');
  });

  it('supports color class', () => {
    log('Damage!', 'dmg');
    
    expect(state.G.log[0].c).toBe('dmg');
  });

  it('accumulates multiple log entries', () => {
    log('Turn 1');
    log('Attack!', 'dmg');
    log('Healed', 'heal');
    
    expect(state.G.log).toHaveLength(3);
  });
});

describe('drawCard() - Card Draw Logic', () => {
  
  beforeEach(() => {
    clearGame();
    setGame({
      me: mockPlayer(),
      opp: mockPlayer(),
      log: [],
      winner: null
    });
  });

  it('moves top card from deck to hand', () => {
    const deckSize = state.G.me.deck.length;
    const topCard = state.G.me.deck[state.G.me.deck.length - 1];
    
    const success = drawCard(state.G.me);
    
    expect(success).toBe(true);
    expect(state.G.me.deck).toHaveLength(deckSize - 1);
    expect(state.G.me.hand).toContain(topCard);
  });

  it('returns false on empty deck', () => {
    state.G.me.deck = []; // Empty deck
    
    const success = drawCard(state.G.me);
    
    expect(success).toBe(false);
  });

  it('checkDeckOut detects empty deck', () => {
    state.G.me.deck = [];
    expect(checkDeckOut(state.G.me)).toBe(true);
    
    state.G.me.deck = [{ id: 'card1' }];
    expect(checkDeckOut(state.G.me)).toBe(false);
  });
});

describe('checkWinConditions() - Win Condition Logic', () => {
  
  beforeEach(() => {
    clearGame();
    setGame({
      me: mockPlayer(),
      opp: mockPlayer(),
      log: [],
      winner: null
    });
  });

  it('player loses when LP reaches 0', () => {
    state.G.me.lp = 0;
    
    const result = checkWinConditions();
    
    expect(result.winner).toBe('Rival');
  });

  it('player wins when opponent LP reaches 0', () => {
    state.G.opp.lp = 0;
    
    const result = checkWinConditions();
    
    expect(result.winner).toBe('You');
  });

  it('Last Breath triggers instead of loss', () => {
    state.G.me.lp = 0;
    state.G.me.setVerse = { id: 'lastBreath' };
    state.G.me.usedLastBreath = false;
    
    const result = checkWinConditions();
    
    expect(result.winner).toBeNull();
    expect(result.lastBreathTriggered).toBe('me');
  });

  it('applyLastBreath sets LP to 1 and consumes verse', () => {
    state.G.me.lp = 0;
    state.G.me.setVerse = { id: 'lastBreath' };
    state.G.me.usedLastBreath = false;
    
    applyLastBreath(state.G.me);
    
    expect(state.G.me.lp).toBe(1);
    expect(state.G.me.usedLastBreath).toBe(true);
    expect(state.G.me.setVerse).toBeNull();
  });

  it('Last Breath only works once', () => {
    state.G.me.lp = 0;
    state.G.me.setVerse = { id: 'lastBreath' };
    state.G.me.usedLastBreath = true; // Already used
    
    const result = checkPlayerLoss(state.G.me);
    
    expect(result.shouldLose).toBe(true);
    expect(result.lastBreathSaves).toBe(false);
  });
});

describe('ko() - Knockout Logic', () => {
  
  beforeEach(() => {
    clearGame();
    setGame({
      me: mockPlayer(),
      opp: mockPlayer(),
      log: [],
      winner: null
    });
  });

  it('sendToGrave moves creature and clears active', () => {
    const creature = mockCreature('whisper');
    state.G.me.active = creature;
    
    sendToGrave(creature, state.G.me);
    
    expect(state.G.me.grave).toContain(creature);
    expect(state.G.me.active).toBeNull();
  });

  it('autoReplace pulls from bench', () => {
    const benched = mockCreature('thornling');
    state.G.me.bench = [benched];
    state.G.me.active = null;
    
    const replacement = autoReplace(state.G.me);
    
    expect(replacement).toBe(benched);
    expect(state.G.me.active).toBe(benched);
    expect(state.G.me.bench).toHaveLength(0);
  });

  it('autoReplace returns null if bench empty', () => {
    state.G.me.bench = [];
    state.G.me.active = null;
    
    const replacement = autoReplace(state.G.me);
    
    expect(replacement).toBeNull();
  });

  it('applyGloomFade discards enemy card', () => {
    state.G.opp.hand = [{ id: 'enemy_card' }];
    
    const result = applyGloomFade(state.G.opp);
    
    expect(result).toBe(true);
    expect(state.G.opp.hand).toHaveLength(0);
    expect(state.G.opp.grave).toHaveLength(1);
  });

  it('applyGloomFade returns false if no cards', () => {
    state.G.opp.hand = [];
    
    const result = applyGloomFade(state.G.opp);
    
    expect(result).toBe(false);
  });

  it('applyEchomaskShatter reduces enemy LP by 1', () => {
    state.G.opp.lp = 3;
    
    applyEchomaskShatter(state.G.opp);
    
    expect(state.G.opp.lp).toBe(2);
  });

  it('applyStormtalonChainLightning arms 20 damage', () => {
    state.G.opp.chainLightning = 0;
    
    applyStormtalonChainLightning(state.G.opp);
    
    expect(state.G.opp.chainLightning).toBe(20);
  });

  it('processDeathEffects handles Gloom', () => {
    const gloom = mockCreature('gloom', 20);
    state.G.me.active = gloom;
    state.G.opp.hand = [{ id: 'card' }];
    
    const effects = processDeathEffects(gloom, state.G.me);
    
    expect(effects.gloomFade).toBe(true);
    expect(state.G.opp.hand).toHaveLength(0);
  });

  it('processDeathEffects handles Echomask', () => {
    const echomask = mockCreature('echomask', 40);
    state.G.me.active = echomask;
    state.G.opp.lp = 3;
    
    const effects = processDeathEffects(echomask, state.G.me);
    
    expect(effects.echomaskShatter).toBe(true);
    expect(state.G.opp.lp).toBe(2);
  });

  it('processDeathEffects handles Stormtalon', () => {
    const stormtalon = mockCreature('stormtalon', 50);
    state.G.me.active = stormtalon;
    state.G.opp.chainLightning = 0;
    
    const effects = processDeathEffects(stormtalon, state.G.me);
    
    expect(effects.chainLightning).toBe(true);
    expect(state.G.opp.chainLightning).toBe(20);
  });

  it('shouldMirrorForceTrigger detects set verse', () => {
    state.G.me.setVerse = { id: 'mirrorForce' };
    expect(shouldMirrorForceTrigger(state.G.me, true)).toBe(true);
    expect(shouldMirrorForceTrigger(state.G.me, false)).toBe(false); // No attacker
    
    state.G.me.setVerse = null;
    expect(shouldMirrorForceTrigger(state.G.me, true)).toBe(false);
  });

  it('applyMirrorForce saves defender, kills attacker', () => {
    const defender = mockCreature('whisper');
    const attacker = mockCreature('cindermaw');
    defender.curHp = 0;
    
    state.G.me.active = defender;
    state.G.me.setVerse = { id: 'mirrorForce' };
    state.G.opp.active = attacker;
    
    applyMirrorForce(defender, state.G.me, attacker, state.G.opp);
    
    expect(defender.curHp).toBe(1);
    expect(state.G.me.setVerse).toBeNull();
    expect(state.G.opp.active).toBeNull();
    expect(state.G.opp.grave).toContain(attacker);
  });

  it('shouldGraveRiseTrigger detects set verse', () => {
    state.G.me.setVerse = { id: 'graveRise' };
    expect(shouldGraveRiseTrigger(state.G.me)).toBe(true);
    
    state.G.me.setVerse = null;
    expect(shouldGraveRiseTrigger(state.G.me)).toBe(false);
  });

  it('applyGraveRise revives 1-cost creature', () => {
    const oneCost = { ...mockCreature('whisper'), cost: 1, curHp: 10, hp: 30 };
    state.G.me.setVerse = { id: 'graveRise' };
    state.G.me.grave = [oneCost];
    state.G.me.bench = [];
    
    const revived = applyGraveRise(state.G.me);
    
    expect(revived).toBe(oneCost);
    expect(oneCost.curHp).toBe(30); // Full HP restored
    expect(state.G.me.bench).toContain(oneCost);
    expect(state.G.me.setVerse).toBeNull();
  });
});

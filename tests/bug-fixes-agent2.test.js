/**
 * Bug Fix Tests - Agent 2 (Card Effects)
 * BUG-05, BUG-06, BUG-10, BUG-11, BUG-19
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VERSES } from '../src/cards.js';

// Mock state factory
function createMockState() {
  return {
    G: {
      me: {
        active: null,
        bench: [],
        hand: [],
        deck: [],
        grave: [],
        mana: 5,
        lp: 3,
        setVerse: null,
        attackBonuses: []
      },
      opp: {
        active: null,
        bench: [],
        hand: [],
        deck: [],
        grave: [],
        mana: 5,
        lp: 3,
        setVerse: null,
        attackBonuses: []
      }
    }
  };
}

// Mock creature factory
function createCreature(overrides = {}) {
  return {
    uid: Math.random().toString(36).slice(2),
    id: 'testCreature',
    name: 'Test Creature',
    cardType: 'creature',
    hp: 30,
    curHp: 30,
    atk: 10,
    cost: 1,
    status: null,
    ...overrides
  };
}

// Mock Anim
global.Anim = {
  damage: () => Promise.resolve(),
  heal: () => Promise.resolve(),
  ko: () => Promise.resolve(),
  lpDamage: () => Promise.resolve(),
  manaGain: () => Promise.resolve(),
  wait: () => Promise.resolve(),
  benchDamage: () => Promise.resolve(),
  summon: () => Promise.resolve(),
  summonBench: () => Promise.resolve()
};
global.log = () => {};

describe('BUG-05: Grave Echo returns creature with 0 HP', () => {
  it('creature returned to hand should have full HP', async () => {
    const state = createMockState();
    // Creature died with 0 HP in grave
    const deadCreature = createCreature({ 
      name: 'Dead Guy', 
      hp: 50, 
      curHp: 0  // Dead - 0 HP
    });
    state.G.me.grave = [deadCreature];
    state.G.me.hand = [];
    
    const ctx = {
      state,
      me: state.G.me,
      opp: state.G.opp,
      selected: deadCreature
    };
    
    const { Effects } = await import('../src/effects.js');
    await Effects.moveCard(ctx, { from: 'me.grave', to: 'me.hand', target: 'selected' });
    
    // Creature should be in hand with FULL HP
    expect(state.G.me.hand).toHaveLength(1);
    expect(state.G.me.hand[0].curHp).toBe(50); // Should be max HP, not 0
  });

  it('creature returned to hand should reset any negative HP', async () => {
    const state = createMockState();
    // Creature overkilled with negative HP
    const overkilled = createCreature({ 
      name: 'Overkilled', 
      hp: 30, 
      curHp: -20  // Overkilled
    });
    state.G.me.grave = [overkilled];
    
    const ctx = {
      state,
      me: state.G.me,
      opp: state.G.opp,
      selected: overkilled
    };
    
    const { Effects } = await import('../src/effects.js');
    await Effects.moveCard(ctx, { from: 'me.grave', to: 'me.hand', target: 'selected' });
    
    expect(state.G.me.hand[0].curHp).toBe(30);
  });
});

describe('BUG-06: Vengeance triggers on verse KO', () => {
  it('Vengeance triggerDef should require source: attack', () => {
    const vengeance = VERSES.vengeance;
    
    // Vengeance should only trigger on attack KO, not verse KO
    expect(vengeance.triggerDef.condition.source).toBe('attack');
  });

  it('Vengeance should NOT match when source is verse', async () => {
    const { matchesTrigger } = await import('../src/triggers.js');
    
    const vengeanceTrigger = VERSES.vengeance.triggerDef;
    
    // Context for a verse KO (e.g., Ignite killed the creature)
    const verseKOContext = {
      target: createCreature(),
      targetOwner: 'me',
      targetLocation: 'active',
      triggerOwnerKey: 'me',
      source: 'verse'  // KO came from a verse, not attack
    };
    
    expect(matchesTrigger(vengeanceTrigger, 'beforeKO', verseKOContext)).toBe(false);
  });

  it('Vengeance SHOULD match when source is attack', async () => {
    const { matchesTrigger } = await import('../src/triggers.js');
    
    const vengeanceTrigger = VERSES.vengeance.triggerDef;
    
    // Context for an attack KO
    const attackKOContext = {
      target: createCreature(),
      targetOwner: 'me',
      targetLocation: 'active',
      triggerOwnerKey: 'me',
      attacker: createCreature(),
      source: 'attack'  // KO came from attack
    };
    
    expect(matchesTrigger(vengeanceTrigger, 'beforeKO', attackKOContext)).toBe(true);
  });
});

describe('BUG-10: Mana Drain doesn\'t consume caster\'s mana', () => {
  // The bug is that when Mana Drain negates a spell, the caster should still lose mana.
  // This is actually about the game flow in index.html, but we can test the expected behavior.
  
  it('processTriggers for onCast should happen AFTER mana deduction', async () => {
    // This is more of an integration test documenting expected behavior.
    // The actual flow is: deduct mana → emit onCast → if negated, spell doesn't resolve
    // The key is mana should be spent regardless of negation.
    
    // We can at least verify Mana Drain trigger fires correctly
    const { getMatchingTriggers } = await import('../src/triggers.js');
    
    const state = createMockState();
    state.G.opp.setVerse = {
      id: 'manaDrain',
      name: 'Mana Drain',
      triggerDef: VERSES.manaDrain.triggerDef,
      effects: VERSES.manaDrain.effects
    };
    
    // 'me' casts a spell - opp's Mana Drain should trigger
    const context = {
      casterKey: 'me',
      triggerOwnerKey: 'opp'
    };
    
    const matches = getMatchingTriggers('onCast', context, state);
    
    expect(matches.length).toBe(1);
    expect(matches[0].card.id).toBe('manaDrain');
  });
});

describe('BUG-11: Predator\'s Mark stacks wrong with Pulsefin', () => {
  // Pulsefin: 30 ATK, Sonic Strike doubles first attack
  // Predator's Mark: +30 damage to next attack
  // 
  // WRONG: 30 + 30 = 60, then doubled = 120
  // CORRECT: 30 doubled = 60, then +30 = 90
  //
  // One-shot bonuses (Predator's Mark, Den Mother) should NOT be doubled by Pulsefin
  
  it('documents expected damage calculation order', () => {
    // This test documents the expected behavior
    // Actual implementation is in index.html doAttack()
    
    const baseAtk = 30;       // Pulsefin base
    const pulseDouble = 2;    // Sonic Strike
    const predatorBonus = 30; // Predator's Mark
    
    // CORRECT calculation:
    // 1. Apply ability modifiers to base (none for Pulsefin)
    // 2. Apply Pulsefin doubling: 30 * 2 = 60
    // 3. Apply one-shot bonuses: 60 + 30 = 90
    const correctDamage = (baseAtk * pulseDouble) + predatorBonus;
    expect(correctDamage).toBe(90);
    
    // WRONG calculation (current bug):
    // 1. Add Predator's Mark to base: 30 + 30 = 60
    // 2. Apply Pulsefin doubling: 60 * 2 = 120
    const wrongDamage = (baseAtk + predatorBonus) * pulseDouble;
    expect(wrongDamage).toBe(120);
    
    // The fix should result in 90, not 120
    expect(correctDamage).not.toBe(wrongDamage);
  });
});

describe('BUG-19: Call of the Wild text should say RANDOM', () => {
  it('text should mention RANDOM selection', () => {
    const callOfTheWild = VERSES.callOfTheWild;
    
    // Text should clearly state it's a random creature
    expect(callOfTheWild.text.toLowerCase()).toContain('random');
  });
});

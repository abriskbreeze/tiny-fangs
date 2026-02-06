/**
 * Tests for creature ability trigger bugs
 * - Ironhide/Shellkin/Pebbleback damage reduction via triggers
 * - Gloom discard effect via processEffects
 * - showTriggerReveal handling creature abilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, clearGame, setGame } from '../src/state.js';
import { CREATURES, VERSES } from '../src/cards.js';
import { getMatchingTriggers, matchesTrigger } from '../src/triggers.js';
import { Effects, processEffects } from '../src/effects.js';

describe('Creature Ability Triggers - beforeDamage', () => {
  beforeEach(() => {
    clearGame();
  });

  it('Ironhide matches beforeDamage trigger when it is the target', () => {
    const ironhide = { ...CREATURES.ironhide, uid: 'iron1', curHp: 50 };
    
    setGame({
      me: { active: ironhide, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 },
      opp: { active: { ...CREATURES.whisper, uid: 'w1', curHp: 30 }, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 }
    });

    const context = {
      targetOwner: 'me',
      targetLocation: 'active',
      target: ironhide,
      damage: 20,
      damageReduction: 0
    };

    const matches = getMatchingTriggers('beforeDamage', context, state);
    expect(matches.length).toBe(1);
    expect(matches[0].card.id).toBe('ironhide');
    expect(matches[0].type).toBe('ability');
  });

  it('Shellkin matches beforeDamage trigger when it is the target', () => {
    const shellkin = { ...CREATURES.shellkin, uid: 'shell1', curHp: 20 };
    
    setGame({
      me: { active: shellkin, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 },
      opp: { active: null, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 }
    });

    const context = {
      targetOwner: 'me',
      targetLocation: 'active',
      target: shellkin,
      damage: 20,
      damageReduction: 0
    };

    const matches = getMatchingTriggers('beforeDamage', context, state);
    expect(matches.length).toBe(1);
    expect(matches[0].card.id).toBe('shellkin');
  });

  it('Pebbleback matches beforeDamage trigger when it is the target', () => {
    const pebbleback = { ...CREATURES.pebbleback, uid: 'peb1', curHp: 30 };
    
    setGame({
      me: { active: pebbleback, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 },
      opp: { active: null, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 }
    });

    const context = {
      targetOwner: 'me',
      targetLocation: 'active',
      target: pebbleback,
      damage: 20,
      damageReduction: 0
    };

    const matches = getMatchingTriggers('beforeDamage', context, state);
    expect(matches.length).toBe(1);
    expect(matches[0].card.id).toBe('pebbleback');
  });
});

describe('processEffects - creature abilities', () => {
  beforeEach(() => {
    clearGame();
  });

  it('processEffects handles card.ability.effects for creatures', async () => {
    // Gloom has ability.effects with discard
    const gloom = { ...CREATURES.gloom, uid: 'gloom1', curHp: 0, cardType: 'creature' };
    
    setGame({
      me: { active: null, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 },
      opp: { active: null, bench: [], hand: [
        { ...CREATURES.whisper, uid: 'w1' },
        { ...CREATURES.thornling, uid: 't1' }
      ], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 }
    });

    const ctx = {
      state,
      me: state.G.me,
      opp: state.G.opp
    };

    // processEffects should find gloom.ability.effects and execute discard
    const result = await processEffects(gloom, ctx);
    
    // Opponent should have lost 1 card (discarded randomly)
    expect(state.G.opp.hand.length).toBe(1);
    expect(state.G.opp.grave.length).toBe(1);
  });

  it('Effects.discard removes random card from hand', async () => {
    setGame({
      me: { active: null, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 },
      opp: { active: null, bench: [], hand: [
        { ...CREATURES.whisper, uid: 'w1' },
        { ...CREATURES.thornling, uid: 't1' },
        { ...CREATURES.gloom, uid: 'g1' }
      ], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 }
    });

    const ctx = {
      state,
      me: state.G.me,
      opp: state.G.opp
    };

    const result = await Effects.discard(ctx, { target: 'opp', count: 1, random: true });
    
    expect(result.discarded).toBe(1);
    expect(state.G.opp.hand.length).toBe(2);
    expect(state.G.opp.grave.length).toBe(1);
  });
});

describe('onSummon creature abilities', () => {
  beforeEach(() => {
    clearGame();
  });

  it('Duskfang onSummon trigger is found even before creature is placed on field', () => {
    const duskfang = { ...CREATURES.duskfang, uid: 'd1', curHp: 60, cardType: 'creature' };
    
    setGame({
      me: { 
        active: null, // Duskfang NOT on field yet
        bench: [], hand: [], deck: [], 
        grave: [{ ...CREATURES.whisper, uid: 'w1' }],
        setVerse: null,
        lp: 3, mana: 5 
      },
      opp: { active: null, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 }
    });

    const context = {
      summoned: duskfang,
      creatureOwnerKey: 'me',
      summoningPlayer: 'me'
    };

    const matches = getMatchingTriggers('onSummon', context, state);
    expect(matches.length).toBe(1);
    expect(matches[0].card.id).toBe('duskfang');
    expect(matches[0].type).toBe('summonAbility');
  });

  it('Emberfang onSummon trigger is found before placement', () => {
    const emberfang = { ...CREATURES.emberfang, uid: 'e1', curHp: 25, cardType: 'creature' };
    
    setGame({
      me: { active: null, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 },
      opp: { 
        active: { ...CREATURES.whisper, uid: 'w1', curHp: 30 }, 
        bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 
      }
    });

    const context = {
      summoned: emberfang,
      creatureOwnerKey: 'me',
      summoningPlayer: 'me'
    };

    const matches = getMatchingTriggers('onSummon', context, state);
    expect(matches.length).toBe(1);
    expect(matches[0].card.id).toBe('emberfang');
  });
});

describe('Gloom death ability', () => {
  it('Gloom has onKO trigger with discard effect', () => {
    const gloom = CREATURES.gloom;
    
    expect(gloom.ability).toBeDefined();
    expect(gloom.ability.trigger).toBeDefined();
    expect(gloom.ability.trigger.event).toBe('onKO');
    expect(gloom.ability.trigger.condition.target).toBe('self');
    expect(gloom.ability.effects).toBeDefined();
    expect(gloom.ability.effects[0].type).toBe('discard');
    expect(gloom.ability.effects[0].target).toBe('opp');
  });

  it('Gloom matches onKO trigger when it dies', () => {
    const gloom = { ...CREATURES.gloom, uid: 'gloom1', curHp: 0, cardType: 'creature' };
    
    setGame({
      me: { active: null, bench: [], hand: [], deck: [], grave: [gloom], setVerse: null, lp: 3, mana: 5 },
      opp: { active: null, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 }
    });

    // onKO triggers check the dying creature specially
    const context = {
      creature: gloom,
      creatureOwnerKey: 'me',
      targetOwner: 'me'
    };

    const matches = getMatchingTriggers('onKO', context, state);
    expect(matches.length).toBe(1);
    expect(matches[0].card.id).toBe('gloom');
    expect(matches[0].type).toBe('deathAbility');
  });
});

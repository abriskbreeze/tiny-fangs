/**
 * Tests for new effect primitives
 * - summonToken (Broodmother Spawn)
 * - swapWithBench (Skitter Scurry)
 * - turnEnd event
 * - afterDamage event
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, clearGame, setGame } from '../src/state.js';
import { CREATURES, VERSES } from '../src/cards.js';
import { Effects, processEffects } from '../src/effects.js';
import { getMatchingTriggers, matchesTrigger } from '../src/triggers.js';

describe('summonToken effect', () => {
  beforeEach(() => {
    clearGame();
  });

  it('summons an Antling token to bench', async () => {
    setGame({
      me: { active: { ...CREATURES.broodmother, uid: 'b1', curHp: 60 }, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 },
      opp: { active: null, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 }
    });

    const ctx = { state, me: state.G.me, opp: state.G.opp };
    const result = await Effects.summonToken(ctx, { token: 'antling', location: 'bench', maxBench: 2 });

    expect(result.summoned).toBe(true);
    expect(result.creature.name).toBe('Antling');
    expect(state.G.me.bench.length).toBe(1);
    expect(state.G.me.bench[0].atk).toBe(10);
    expect(state.G.me.bench[0].hp).toBe(10);
    expect(state.G.me.bench[0].isToken).toBe(true);
  });

  it('respects maxBench limit', async () => {
    setGame({
      me: { 
        active: { ...CREATURES.broodmother, uid: 'b1', curHp: 60 }, 
        bench: [
          { ...CREATURES.whisper, uid: 'w1', curHp: 30 },
          { ...CREATURES.whisper, uid: 'w2', curHp: 30 }
        ], 
        hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 
      },
      opp: { active: null, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 }
    });

    const ctx = { state, me: state.G.me, opp: state.G.opp };
    const result = await Effects.summonToken(ctx, { token: 'antling', location: 'bench', maxBench: 2 });

    expect(result.summoned).toBe(false);
    expect(result.reason).toBe('bench_full');
  });
});

describe('swapWithBench effect', () => {
  beforeEach(() => {
    clearGame();
  });

  it('swaps active with first bench creature (AI/test default)', async () => {
    const skitter = { ...CREATURES.skitter, uid: 's1', curHp: 20 };
    const benchCreature = { ...CREATURES.whisper, uid: 'w1', curHp: 30 };
    
    setGame({
      me: { active: skitter, bench: [benchCreature], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 },
      opp: { active: null, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 }
    });

    const ctx = { state, me: state.G.me, opp: state.G.opp };
    const result = await Effects.swapWithBench(ctx, { target: 'self' });

    expect(result.swapped).toBe(true);
    expect(state.G.me.active.uid).toBe('w1'); // Whisper is now active
    expect(state.G.me.bench[0].uid).toBe('s1'); // Skitter is on bench
  });

  it('fails if no bench creatures', async () => {
    const skitter = { ...CREATURES.skitter, uid: 's1', curHp: 20 };
    
    setGame({
      me: { active: skitter, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 },
      opp: { active: null, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 }
    });

    const ctx = { state, me: state.G.me, opp: state.G.opp };
    const result = await Effects.swapWithBench(ctx, { target: 'self' });

    expect(result.swapped).toBe(false);
    expect(result.reason).toBe('no_bench');
  });
});

describe('turnEnd event - Broodmother', () => {
  beforeEach(() => {
    clearGame();
  });

  it('Broodmother turnEnd trigger matches when active', () => {
    const broodmother = { ...CREATURES.broodmother, uid: 'b1', curHp: 60 };
    
    setGame({
      me: { active: broodmother, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 },
      opp: { active: null, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 }
    });

    const context = {
      activePlayer: state.G.me,
      activePlayerKey: 'me'
    };

    const matches = getMatchingTriggers('turnEnd', context, state);
    expect(matches.length).toBe(1);
    expect(matches[0].card.id).toBe('broodmother');
  });

  it('Broodmother turnEnd trigger does NOT match when on bench', () => {
    const broodmother = { ...CREATURES.broodmother, uid: 'b1', curHp: 60 };
    
    setGame({
      me: { 
        active: { ...CREATURES.whisper, uid: 'w1', curHp: 30 }, 
        bench: [broodmother], 
        hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 
      },
      opp: { active: null, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 }
    });

    const context = {
      activePlayer: state.G.me,
      activePlayerKey: 'me'
    };

    const matches = getMatchingTriggers('turnEnd', context, state);
    expect(matches.length).toBe(0);
  });
});

describe('afterDamage event - Skitter', () => {
  beforeEach(() => {
    clearGame();
  });

  it('Skitter afterDamage trigger matches when damaged and survived', () => {
    const skitter = { ...CREATURES.skitter, uid: 's1', curHp: 20 };
    
    setGame({
      me: { active: skitter, bench: [{ ...CREATURES.whisper, uid: 'w1', curHp: 30 }], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 },
      opp: { active: null, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 }
    });

    const context = {
      target: skitter,
      targetOwner: 'me',
      targetLocation: 'active',
      survived: true,
      damage: 10
    };

    const matches = getMatchingTriggers('afterDamage', context, state);
    expect(matches.length).toBe(1);
    expect(matches[0].card.id).toBe('skitter');
  });

  it('Skitter afterDamage trigger does NOT match if survived is false', () => {
    const skitter = { ...CREATURES.skitter, uid: 's1', curHp: 0 };
    
    setGame({
      me: { active: skitter, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 },
      opp: { active: null, bench: [], hand: [], deck: [], grave: [], setVerse: null, lp: 3, mana: 5 }
    });

    const context = {
      target: skitter,
      targetOwner: 'me',
      targetLocation: 'active',
      survived: false,  // KO'd
      damage: 30
    };

    const matches = getMatchingTriggers('afterDamage', context, state);
    expect(matches.length).toBe(0);
  });
});

describe('condition matching for self: active', () => {
  it('matches when self is active', () => {
    const trigger = { event: 'turnEnd', condition: { self: 'active' } };
    const creature = { id: 'broodmother', uid: 'b1' };
    const player = { active: creature, bench: [] };
    
    const context = {
      self: creature,
      triggerOwner: player,
      triggerOwnerKey: 'me'
    };

    expect(matchesTrigger(trigger, 'turnEnd', context)).toBe(true);
  });

  it('does NOT match when self is on bench', () => {
    const trigger = { event: 'turnEnd', condition: { self: 'active' } };
    const creature = { id: 'broodmother', uid: 'b1' };
    const player = { 
      active: { id: 'whisper', uid: 'w1' }, 
      bench: [creature] 
    };
    
    const context = {
      self: creature,
      triggerOwner: player,
      triggerOwnerKey: 'me'
    };

    expect(matchesTrigger(trigger, 'turnEnd', context)).toBe(false);
  });
});

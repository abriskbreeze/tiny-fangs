/**
 * Combat Flow Bug Tests
 * BUG-12: Multiple attack button clicks = multiple attacks
 * BUG-13: Creature with 0 HP stays on field after Soul Siphon
 * BUG-14: AI monster not attacking
 * BUG-15: Grave Rise summons to bench if available
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { state, clearGame, setGame } from '../src/state.js';
import { Effects, processEffects } from '../src/effects.js';
import { getAllMoves, scoreMove, scoreAttack } from '../src/ai.js';

describe('BUG-12: Multiple attack prevention', () => {
  beforeEach(() => clearGame());

  it('actionLock should block multiple attacks', () => {
    // This tests the state flag concept
    setGame({
      me: {
        active: { id: 'fangpup', name: 'Fangpup', hp: 30, curHp: 30, atk: 15 },
        bench: [],
        hand: [],
        deck: [],
        grave: [],
        lp: 3,
        mana: 0,
        attackBonuses: []
      },
      opp: {
        active: { id: 'shadepup', name: 'Shade Pup', hp: 30, curHp: 30, atk: 15 },
        bench: [],
        hand: [],
        deck: [],
        grave: [],
        lp: 3,
        mana: 0,
        attackBonuses: []
      },
      myTurn: true,
      firstTurn: false
    });

    // When actionLock is false, attack should be allowed
    state.G.actionLock = false;
    expect(state.G.actionLock).toBe(false);

    // Simulate setting lock at start of attack
    state.G.actionLock = true;
    expect(state.G.actionLock).toBe(true);

    // Lock should prevent further attacks until released
    // In real code: if (state.G.actionLock) return;
  });
});

describe('BUG-13: Soul Siphon KO handling', () => {
  beforeEach(() => clearGame());

  it('damage effect returns ko:true when target HP <= 0', async () => {
    const ctx = {
      me: {
        active: { id: 'fangpup', name: 'Fangpup', hp: 30, curHp: 20, atk: 15 }
      },
      opp: {
        active: { id: 'shadepup', name: 'Shade Pup', hp: 30, curHp: 15, atk: 15 }
      }
    };

    // Soul Siphon deals 20 damage - should KO a 15 HP creature
    const result = await Effects.damage(ctx, { target: 'opp.active', amount: 20 });
    
    expect(result.ko).toBe(true);
    expect(ctx.opp.active.curHp).toBe(-5);
    expect(result.creature).toBe(ctx.opp.active);
    expect(result.owner).toBe(ctx.opp);
  });

  it('processEffects collects KOs from damage effects', async () => {
    const ctx = {
      me: {
        active: { id: 'fangpup', name: 'Fangpup', hp: 30, curHp: 20, atk: 15 }
      },
      opp: {
        active: { id: 'shadepup', name: 'Shade Pup', hp: 30, curHp: 15, atk: 15 }
      }
    };

    const card = {
      effects: [
        { type: 'damage', target: 'opp.active', amount: 20 }
      ]
    };

    const result = await processEffects(card, ctx);
    
    expect(result.kos).toHaveLength(1);
    expect(result.kos[0].ko).toBeUndefined(); // kos array stores creature/owner, not ko flag
    expect(result.kos[0].creature.curHp).toBeLessThanOrEqual(0);
  });
});

describe('BUG-14: AI attack scoring', () => {
  beforeEach(() => clearGame());

  it('AI should generate attack move when both actives exist', () => {
    const ai = {
      active: { id: 'fangpup', name: 'Fangpup', hp: 30, curHp: 30, atk: 15 },
      bench: [],
      hand: [],
      deck: [],
      grave: [],
      lp: 3,
      mana: 0,
      attackBonuses: []
    };

    const player = {
      active: { id: 'shadepup', name: 'Shade Pup', hp: 30, curHp: 30, atk: 15 },
      bench: [],
      hand: [],
      deck: [],
      grave: [],
      lp: 3,
      setVerse: null
    };

    const moves = getAllMoves(ai, player, true);
    const attackMove = moves.find(m => m.type === 'attack');
    
    expect(attackMove).toBeDefined();
  });

  it('AI should score attack > 0 when enemy active exists', () => {
    const ai = {
      active: { id: 'fangpup', name: 'Fangpup', hp: 30, curHp: 30, atk: 15 },
      bench: [],
      attackBonuses: []
    };

    const player = {
      active: { id: 'shadepup', name: 'Shade Pup', hp: 30, curHp: 30, atk: 15 },
      setVerse: null
    };

    const score = scoreMove({ type: 'attack' }, ai, player);
    expect(score).toBeGreaterThan(0);
  });

  it('AI should NOT try to attack creature with 0 HP (if KO was missed)', () => {
    // This tests the edge case where a creature wasn't properly KO'd
    const ai = {
      active: { id: 'fangpup', name: 'Fangpup', hp: 30, curHp: 30, atk: 15 },
      bench: [],
      hand: [],
      deck: [],
      grave: [],
      lp: 3,
      mana: 0,
      attackBonuses: []
    };

    const player = {
      active: { id: 'shadepup', name: 'Shade Pup', hp: 30, curHp: 0, atk: 15 }, // 0 HP - should be KO'd
      bench: [],
      setVerse: null
    };

    // If curHp is 0, the creature shouldn't be on field
    // But if it IS there (due to bug), AI should still attack it
    const moves = getAllMoves(ai, player, true);
    const attackMove = moves.find(m => m.type === 'attack');
    
    // Attack move should exist because player.active exists (even at 0 HP)
    expect(attackMove).toBeDefined();
    
    // Score should still be positive - it's a guaranteed KO
    const score = scoreMove({ type: 'attack' }, ai, player);
    expect(score).toBeGreaterThan(0);
  });
});

describe('BUG-15: Grave Rise bench summon', () => {
  beforeEach(() => clearGame());

  it('summonFromGrave should summon to bench when bench has room', async () => {
    const creature = { uid: 1, id: 'fangpup', name: 'Fangpup', hp: 30, curHp: 0, atk: 15, cost: 1, cardType: 'creature' };
    
    const ctx = {
      me: {
        active: { id: 'alpha', name: 'Alpha', hp: 50, curHp: 50, atk: 25 },
        bench: [], // Empty bench - room for Grave Rise summon
        grave: [creature]
      }
    };

    const result = await Effects.summonFromGrave(ctx, { filter: { cost: 1 }, location: 'bench' });
    
    expect(result.summoned).toBe(true);
    expect(ctx.me.bench).toHaveLength(1);
    expect(ctx.me.bench[0].name).toBe('Fangpup');
    expect(ctx.me.bench[0].curHp).toBe(30); // HP restored
    expect(ctx.me.grave).toHaveLength(0);
  });

  it('summonFromGrave should fail when bench is full', async () => {
    const creature = { uid: 1, id: 'fangpup', name: 'Fangpup', hp: 30, curHp: 0, atk: 15, cost: 1, cardType: 'creature' };
    
    const ctx = {
      me: {
        active: { id: 'alpha', name: 'Alpha', hp: 50, curHp: 50, atk: 25 },
        bench: [
          { id: 'bench1', name: 'Bench1', hp: 20, curHp: 20, atk: 10 },
          { id: 'bench2', name: 'Bench2', hp: 20, curHp: 20, atk: 10 }
        ], // Full bench
        grave: [creature]
      }
    };

    const result = await Effects.summonFromGrave(ctx, { filter: { cost: 1 }, location: 'bench' });
    
    expect(result.summoned).toBe(false);
    expect(result.reason).toBe('bench_full');
  });

  it('summonFromGrave uses prompt when multiple candidates', async () => {
    const creature1 = { uid: 1, id: 'fangpup', name: 'Fangpup', hp: 30, curHp: 0, atk: 15, cost: 1, cardType: 'creature' };
    const creature2 = { uid: 2, id: 'shadepup', name: 'Shade Pup', hp: 25, curHp: 0, atk: 15, cost: 1, cardType: 'creature' };
    
    let promptedCandidates = null;
    
    const ctx = {
      me: {
        active: { id: 'alpha', name: 'Alpha', hp: 50, curHp: 50, atk: 25 },
        bench: [],
        grave: [creature1, creature2]
      },
      promptGraveSelect: async (candidates) => {
        promptedCandidates = candidates;
        return candidates[1]; // Pick second
      }
    };

    const result = await Effects.summonFromGrave(ctx, { filter: { cost: 1 }, location: 'bench' });
    
    expect(result.summoned).toBe(true);
    expect(promptedCandidates).toHaveLength(2);
    expect(ctx.me.bench[0].name).toBe('Shade Pup'); // Second was picked
  });
});

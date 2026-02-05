/**
 * Effect System Tests
 * TDD: Write tests first, then implement to pass
 */

import { describe, it, expect, beforeEach } from 'vitest';

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
        mana: 3,
        lp: 3,
        setVerse: null,
        attackBonuses: [],
        usedManaSurge: false
      },
      opp: {
        active: null,
        bench: [],
        hand: [],
        deck: [],
        grave: [],
        mana: 3,
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

// Mock Anim (no-op for tests)
global.Anim = {
  damage: () => Promise.resolve(),
  heal: () => Promise.resolve(),
  ko: () => Promise.resolve(),
  lpDamage: () => Promise.resolve(),
  manaGain: () => Promise.resolve(),
  wait: () => Promise.resolve(),
  benchDamage: () => Promise.resolve(),
  summon: () => Promise.resolve(),
  summonBench: () => Promise.resolve(),
  benchToActive: () => Promise.resolve()
};

// Mock log
global.log = () => {};

// Will import Effects after implementing
// For now, define what we expect the API to look like

describe('Effects System', () => {
  let state;
  let ctx;

  beforeEach(() => {
    state = createMockState();
    ctx = {
      state,
      me: state.G.me,
      opp: state.G.opp,
      selected: null
    };
  });

  describe('damage', () => {
    it('reduces target curHp by amount', async () => {
      ctx.opp.active = createCreature({ curHp: 30 });
      
      const { Effects } = await import('../src/effects.js');
      const result = await Effects.damage(ctx, { target: 'opp.active', amount: 20 });
      
      expect(ctx.opp.active.curHp).toBe(10);
      expect(result.ko).toBe(false);
    });

    it('returns ko: true when damage is lethal', async () => {
      ctx.opp.active = createCreature({ curHp: 15 });
      
      const { Effects } = await import('../src/effects.js');
      const result = await Effects.damage(ctx, { target: 'opp.active', amount: 20 });
      
      expect(ctx.opp.active.curHp).toBe(-5);
      expect(result.ko).toBe(true);
    });

    it('does nothing if target does not exist', async () => {
      ctx.opp.active = null;
      
      const { Effects } = await import('../src/effects.js');
      const result = await Effects.damage(ctx, { target: 'opp.active', amount: 20 });
      
      expect(result).toEqual({ ko: false });
    });
  });

  describe('heal', () => {
    it('increases curHp by amount', async () => {
      ctx.me.active = createCreature({ hp: 30, curHp: 10 });
      
      const { Effects } = await import('../src/effects.js');
      await Effects.heal(ctx, { target: 'me.active', amount: 15 });
      
      expect(ctx.me.active.curHp).toBe(25);
    });

    it('caps healing at max hp', async () => {
      ctx.me.active = createCreature({ hp: 30, curHp: 25 });
      
      const { Effects } = await import('../src/effects.js');
      await Effects.heal(ctx, { target: 'me.active', amount: 20 });
      
      expect(ctx.me.active.curHp).toBe(30);
    });

    it('does nothing if target does not exist', async () => {
      ctx.me.active = null;
      
      const { Effects } = await import('../src/effects.js');
      const result = await Effects.heal(ctx, { target: 'me.active', amount: 20 });
      
      expect(result).toBeUndefined();
    });
  });

  describe('draw', () => {
    it('moves cards from deck to hand', async () => {
      const card1 = createCreature({ name: 'Card 1' });
      const card2 = createCreature({ name: 'Card 2' });
      ctx.me.deck = [card1, card2];
      ctx.me.hand = [];
      
      const { Effects } = await import('../src/effects.js');
      await Effects.draw(ctx, { count: 2 });
      
      expect(ctx.me.hand.length).toBe(2);
      expect(ctx.me.deck.length).toBe(0);
    });

    it('draws only available cards if deck has fewer', async () => {
      const card1 = createCreature({ name: 'Card 1' });
      ctx.me.deck = [card1];
      ctx.me.hand = [];
      
      const { Effects } = await import('../src/effects.js');
      await Effects.draw(ctx, { count: 3 });
      
      expect(ctx.me.hand.length).toBe(1);
      expect(ctx.me.deck.length).toBe(0);
    });

    it('computes creatureCount for draw', async () => {
      ctx.me.active = createCreature();
      ctx.me.bench = [createCreature(), createCreature()];
      ctx.me.deck = [createCreature(), createCreature(), createCreature(), createCreature()];
      ctx.me.hand = [];
      
      const { Effects } = await import('../src/effects.js');
      const result = await Effects.draw(ctx, { count: 'creatureCount', max: 3 });
      
      expect(result.drawn).toBe(3); // 1 active + 2 bench = 3, capped at max 3
      expect(ctx.me.hand.length).toBe(3);
    });

    it('respects max cap on creatureCount', async () => {
      ctx.me.active = createCreature();
      ctx.me.bench = [];
      ctx.me.deck = [createCreature(), createCreature()];
      ctx.me.hand = [];
      
      const { Effects } = await import('../src/effects.js');
      const result = await Effects.draw(ctx, { count: 'creatureCount', max: 3 });
      
      expect(result.drawn).toBe(1); // Only 1 creature
      expect(ctx.me.hand.length).toBe(1);
    });
  });

  describe('loseLife', () => {
    it('reduces lp by amount', async () => {
      ctx.me.lp = 3;
      
      const { Effects } = await import('../src/effects.js');
      await Effects.loseLife(ctx, { count: 1 });
      
      expect(ctx.me.lp).toBe(2);
    });
  });

  describe('gainMana', () => {
    it('increases mana by amount', async () => {
      ctx.me.mana = 2;
      
      const { Effects } = await import('../src/effects.js');
      await Effects.gainMana(ctx, { amount: 2 });
      
      expect(ctx.me.mana).toBe(4);
    });
  });

  describe('atkBonus', () => {
    it('adds attack bonus to player', async () => {
      ctx.me.attackBonuses = [];
      
      const { Effects } = await import('../src/effects.js');
      await Effects.atkBonus(ctx, { amount: 30, source: "Predator's Mark" });
      
      expect(ctx.me.attackBonuses).toHaveLength(1);
      expect(ctx.me.attackBonuses[0]).toEqual({ source: "Predator's Mark", value: 30 });
    });
  });

  describe('setStatus', () => {
    it('sets status on active creature', async () => {
      ctx.me.active = createCreature();
      
      const { Effects } = await import('../src/effects.js');
      await Effects.setStatus(ctx, { target: 'me.active', status: 'fortified' });
      
      expect(ctx.me.active.fortified).toBe(true);
    });

    it('does nothing if no active creature', async () => {
      ctx.me.active = null;
      
      const { Effects } = await import('../src/effects.js');
      // Should not throw
      await Effects.setStatus(ctx, { target: 'me.active', status: 'fortified' });
    });
  });

  describe('cureStatus', () => {
    it('removes poison status', async () => {
      ctx.me.active = createCreature({ status: 'poison' });
      ctx.me.poisoned = true;
      
      const { Effects } = await import('../src/effects.js');
      await Effects.cureStatus(ctx, { target: 'me.active', status: 'poison' });
      
      expect(ctx.me.active.status).toBeNull();
      expect(ctx.me.poisoned).toBe(false);
    });
  });

  describe('moveCard', () => {
    it('moves selected card from grave to hand', async () => {
      const creature = createCreature({ name: 'Dead Guy' });
      ctx.me.grave = [creature];
      ctx.me.hand = [];
      ctx.selected = creature;
      
      const { Effects } = await import('../src/effects.js');
      await Effects.moveCard(ctx, { from: 'me.grave', to: 'me.hand', target: 'selected' });
      
      expect(ctx.me.grave).toHaveLength(0);
      expect(ctx.me.hand).toHaveLength(1);
      expect(ctx.me.hand[0].name).toBe('Dead Guy');
    });
  });

  describe('setFlag', () => {
    it('sets a flag on player', async () => {
      ctx.me.usedManaSurge = false;
      
      const { Effects } = await import('../src/effects.js');
      await Effects.setFlag(ctx, { flag: 'usedManaSurge', value: true });
      
      expect(ctx.me.usedManaSurge).toBe(true);
    });
  });

  describe('aoeAll', () => {
    it('damages all creatures on both sides', async () => {
      ctx.me.active = createCreature({ curHp: 30 });
      ctx.me.bench = [createCreature({ curHp: 25 })];
      ctx.opp.active = createCreature({ curHp: 30 });
      ctx.opp.bench = [createCreature({ curHp: 20 }), createCreature({ curHp: 15 })];
      
      const { Effects } = await import('../src/effects.js');
      const result = await Effects.aoeAll(ctx, { amount: 20 });
      
      expect(ctx.me.active.curHp).toBe(10);
      expect(ctx.me.bench[0].curHp).toBe(5);
      expect(ctx.opp.active.curHp).toBe(10);
      expect(ctx.opp.bench[0].curHp).toBe(0);
      expect(ctx.opp.bench[1].curHp).toBe(-5);
    });

    it('returns KO info for creatures that died', async () => {
      ctx.me.active = createCreature({ curHp: 15 });
      ctx.opp.active = createCreature({ curHp: 30 });
      
      const { Effects } = await import('../src/effects.js');
      const result = await Effects.aoeAll(ctx, { amount: 20 });
      
      expect(result.kos).toHaveLength(1);
      expect(result.kos[0].target).toBe('me.active');
    });

    it('orders KOs: bench first, then active', async () => {
      ctx.me.active = createCreature({ curHp: 10 });
      ctx.me.bench = [createCreature({ curHp: 5 })];
      ctx.opp.active = createCreature({ curHp: 10 });
      
      const { Effects } = await import('../src/effects.js');
      const result = await Effects.aoeAll(ctx, { amount: 20 });
      
      // Bench KOs should come before active KOs
      expect(result.kos.length).toBe(3);
      expect(result.kos[0].isBench).toBe(true);  // me.bench first
      expect(result.kos[1].isBench).toBe(false); // me.active
      expect(result.kos[2].isBench).toBe(false); // opp.active
    });
  });

  describe('summon', () => {
    it('summons 1-cost creature from deck to bench', async () => {
      ctx.me.active = createCreature({ name: 'Active' });
      ctx.me.bench = [];
      ctx.me.deck = [
        createCreature({ name: 'Expensive', cost: 3 }),
        createCreature({ name: 'Cheap', cost: 1 }),
        createCreature({ name: 'Also Cheap', cost: 1 })
      ];
      
      const { Effects } = await import('../src/effects.js');
      const result = await Effects.summon(ctx, { filter: { cost: 1 }, location: 'bench' });
      
      expect(result.summoned).toBe(true);
      expect(result.creature.cost).toBe(1);
      expect(ctx.me.bench.length).toBe(1);
      expect(ctx.me.deck.length).toBe(2);
    });

    it('summons to active if no active creature', async () => {
      ctx.me.active = null;
      ctx.me.bench = [];
      ctx.me.deck = [createCreature({ name: 'Cheap', cost: 1 })];
      
      const { Effects } = await import('../src/effects.js');
      const result = await Effects.summon(ctx, { filter: { cost: 1 }, location: 'bench' });
      
      expect(result.summoned).toBe(true);
      expect(ctx.me.active).not.toBeNull();
      expect(ctx.me.active.name).toBe('Cheap');
    });

    it('returns summoned: false if no valid targets', async () => {
      ctx.me.deck = [createCreature({ name: 'Expensive', cost: 3 })];
      
      const { Effects } = await import('../src/effects.js');
      const result = await Effects.summon(ctx, { filter: { cost: 1 } });
      
      expect(result.summoned).toBe(false);
    });
  });
});

describe('processEffects', () => {
  let state;
  let ctx;

  beforeEach(() => {
    state = createMockState();
    ctx = {
      state,
      me: state.G.me,
      opp: state.G.opp,
      selected: null
    };
  });

  it('processes multiple effects in sequence', async () => {
    ctx.opp.active = createCreature({ curHp: 30 });
    ctx.me.active = createCreature({ hp: 30, curHp: 20 });
    
    const card = {
      effects: [
        { type: 'damage', target: 'opp.active', amount: 20 },
        { type: 'heal', target: 'me.active', amount: 10 }
      ]
    };
    
    const { processEffects } = await import('../src/effects.js');
    const result = await processEffects(card, ctx);
    
    expect(result.success).toBe(true);
    expect(ctx.opp.active.curHp).toBe(10);
    expect(ctx.me.active.curHp).toBe(30);
  });

  it('skips effects when condition is false', async () => {
    ctx.opp.active = null; // No target
    ctx.me.active = createCreature({ hp: 30, curHp: 20 });
    
    const card = {
      effects: [
        { type: 'damage', target: 'opp.active', amount: 20, condition: 'opp.active' },
        { type: 'heal', target: 'me.active', amount: 10 }
      ]
    };
    
    const { processEffects } = await import('../src/effects.js');
    const result = await processEffects(card, ctx);
    
    expect(result.success).toBe(true);
    expect(ctx.me.active.curHp).toBe(30); // Heal still happened
  });

  it('collects KO results for later processing', async () => {
    ctx.opp.active = createCreature({ curHp: 10 });
    
    const card = {
      effects: [
        { type: 'damage', target: 'opp.active', amount: 20 }
      ]
    };
    
    const { processEffects } = await import('../src/effects.js');
    const result = await processEffects(card, ctx);
    
    expect(result.success).toBe(true);
    expect(result.kos).toHaveLength(1);
    expect(result.kos[0].target).toBe('opp.active');
  });
});

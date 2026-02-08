/**
 * Target Selector Tests - BUG-07, BUG-08, BUG-09
 * TDD: Write tests first, then implement to pass
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

// Mock Anim
global.Anim = {
  damage: () => Promise.resolve(),
  heal: () => Promise.resolve(),
  ko: () => Promise.resolve(),
  benchKo: () => Promise.resolve(),
  lpDamage: () => Promise.resolve(),
  manaGain: () => Promise.resolve(),
  wait: () => Promise.resolve(),
  benchDamage: () => Promise.resolve(),
  summon: () => Promise.resolve(),
  summonBench: () => Promise.resolve(),
  benchToActive: () => Promise.resolve()
};

global.log = () => {};

describe('Target Selector Cards', () => {
  describe('Card Definitions', () => {
    it('BUG-07: Ignite should require anyCreature selection', () => {
      const ignite = VERSES.ignite;
      expect(ignite.requiresSelection).toBe(true);
      expect(ignite.selection.type).toBe('anyCreature');
    });

    it('BUG-08: Banish should require anyCreature selection', () => {
      const banish = VERSES.banish;
      expect(banish.requiresSelection).toBe(true);
      expect(banish.selection.type).toBe('anyCreature');
    });

    it('BUG-09: Soul Siphon should require anyCreature selection', () => {
      const soulSiphon = VERSES.soulSiphon;
      expect(soulSiphon.requiresSelection).toBe(true);
      expect(soulSiphon.selection.type).toBe('anyCreature');
    });

    it('Ignite effects should target selected', () => {
      const ignite = VERSES.ignite;
      const damageEffect = ignite.effects.find(e => e.type === 'damage');
      expect(damageEffect.target).toBe('selected');
    });

    it('Banish effects should target selected', () => {
      const banish = VERSES.banish;
      const banishEffect = banish.effects.find(e => e.type === 'banish');
      expect(banishEffect.target).toBe('selected');
    });

    it('Soul Siphon damage should target selected', () => {
      const soulSiphon = VERSES.soulSiphon;
      const damageEffect = soulSiphon.effects.find(e => e.type === 'damage');
      expect(damageEffect.target).toBe('selected');
    });
  });

  describe('Effects with selected target', () => {
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

    it('damage effect resolves selected target correctly', async () => {
      const creature = createCreature({ name: 'Target', curHp: 30 });
      ctx.opp.active = creature;
      ctx.selected = { 
        creature, 
        location: 'active', 
        ownerKey: 'opp' 
      };

      const { Effects } = await import('../src/effects.js');
      const result = await Effects.damage(ctx, { target: 'selected', amount: 15 });

      expect(creature.curHp).toBe(15);
      expect(result.ko).toBe(false);
    });

    it('damage effect returns ko: true when selected target dies', async () => {
      const creature = createCreature({ name: 'Weak', curHp: 10 });
      ctx.opp.bench = [creature];
      ctx.selected = { 
        creature, 
        location: 'bench', 
        idx: 0,
        ownerKey: 'opp' 
      };

      const { Effects } = await import('../src/effects.js');
      const result = await Effects.damage(ctx, { target: 'selected', amount: 15 });

      expect(creature.curHp).toBe(-5);
      expect(result.ko).toBe(true);
    });

    it('damage effect can target your own creatures', async () => {
      const myCreature = createCreature({ name: 'MyGuy', curHp: 40 });
      ctx.me.active = myCreature;
      ctx.selected = { 
        creature: myCreature, 
        location: 'active', 
        ownerKey: 'me' 
      };

      const { Effects } = await import('../src/effects.js');
      const result = await Effects.damage(ctx, { target: 'selected', amount: 15 });

      expect(myCreature.curHp).toBe(25);
    });

    it('banish effect works with selected target', async () => {
      const creature = createCreature({ name: 'Banished' });
      ctx.opp.active = creature;
      ctx.selected = { 
        creature, 
        location: 'active', 
        ownerKey: 'opp' 
      };

      const { Effects } = await import('../src/effects.js');
      const result = await Effects.banish(ctx, { target: 'selected' });

      expect(result.banished).toBe(true);
      expect(ctx.opp.active).toBeNull();
    });

    it('banish effect works on bench creatures', async () => {
      const creature = createCreature({ name: 'BenchBanish' });
      ctx.opp.bench = [creature];
      ctx.selected = { 
        creature, 
        location: 'bench', 
        idx: 0,
        ownerKey: 'opp' 
      };

      const { Effects } = await import('../src/effects.js');
      const result = await Effects.banish(ctx, { target: 'selected' });

      expect(result.banished).toBe(true);
      expect(ctx.opp.bench.length).toBe(0);
    });

    it('banish effect can target your own creatures', async () => {
      const creature = createCreature({ name: 'SelfBanish' });
      ctx.me.active = creature;
      ctx.selected = { 
        creature, 
        location: 'active', 
        ownerKey: 'me' 
      };

      const { Effects } = await import('../src/effects.js');
      const result = await Effects.banish(ctx, { target: 'selected' });

      expect(result.banished).toBe(true);
      expect(ctx.me.active).toBeNull();
    });
  });

  describe('BUG-09: Soul Siphon conditional heal', () => {
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

    it('Soul Siphon heals when damage was dealt', async () => {
      const target = createCreature({ name: 'Target', curHp: 30 });
      ctx.opp.active = target;
      ctx.me.active = createCreature({ name: 'Healer', hp: 40, curHp: 20 });
      ctx.selected = { 
        creature: target, 
        location: 'active', 
        ownerKey: 'opp' 
      };

      const soulSiphon = VERSES.soulSiphon;
      const { processEffects } = await import('../src/effects.js');
      
      // Add damageDealt tracking to ctx
      await processEffects(soulSiphon, ctx);

      expect(target.curHp).toBe(10); // 30 - 20 = 10
      expect(ctx.me.active.curHp).toBe(30); // 20 + 10 = 30 (should heal)
    });

    it('Soul Siphon does NOT heal when no damage was dealt (no target)', async () => {
      ctx.opp.active = null; // No target
      ctx.me.active = createCreature({ name: 'Healer', hp: 40, curHp: 20 });
      ctx.selected = null; // No valid selection

      const soulSiphon = VERSES.soulSiphon;
      const { processEffects } = await import('../src/effects.js');
      
      await processEffects(soulSiphon, ctx);

      // Heal should NOT happen because no damage was dealt
      expect(ctx.me.active.curHp).toBe(20); // No change
    });

    it('Soul Siphon heals even when target is KOd', async () => {
      const target = createCreature({ name: 'Weak', curHp: 10 });
      ctx.opp.active = target;
      ctx.me.active = createCreature({ name: 'Healer', hp: 40, curHp: 20 });
      ctx.selected = { 
        creature: target, 
        location: 'active', 
        ownerKey: 'opp' 
      };

      const soulSiphon = VERSES.soulSiphon;
      const { processEffects } = await import('../src/effects.js');
      
      const result = await processEffects(soulSiphon, ctx);

      expect(target.curHp).toBe(-10); // KO'd
      expect(ctx.me.active.curHp).toBe(30); // Still heals! Damage was dealt
      expect(result.kos.length).toBe(1); // KO was tracked
    });
  });
});

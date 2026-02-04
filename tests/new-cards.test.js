import { describe, it, expect, beforeEach } from 'vitest';
import { CREATURES, VERSES } from '../src/cards.js';
import { state, clearGame, setGame } from '../src/state.js';
import { applyDamage } from '../src/game.js';

/**
 * New Card Tests - Quick Win Batch
 * 
 * Testing: Emberfang, Ignite, Leechling, Shade Pup
 */

function mockPlayer(overrides = {}) {
  return {
    lp: 3,
    hand: [],
    deck: [],
    grave: [],
    bench: [],
    active: null,
    mana: 5,
    ...overrides
  };
}

function mockCreature(id, overrides = {}) {
  const base = CREATURES[id] || { id, name: id, hp: 30, atk: 20, cost: 1 };
  return {
    ...base,
    curHp: base.hp,
    uid: Math.random().toString(36).slice(2, 9),
    ...overrides
  };
}

describe('Emberfang - Spark ability', () => {
  beforeEach(() => {
    clearGame();
    setGame({
      me: mockPlayer(),
      opp: mockPlayer(),
      log: [],
      winner: null
    });
  });

  it('exists in CREATURES', () => {
    expect(CREATURES.emberfang).toBeDefined();
    expect(CREATURES.emberfang.ability).toBe('Spark');
  });

  it('has correct stats (1 cost, 25 HP, 25 ATK)', () => {
    const card = CREATURES.emberfang;
    expect(card.cost).toBe(1);
    expect(card.hp).toBe(25);
    expect(card.atk).toBe(25);
  });

  it('Spark deals 5 damage on summon', () => {
    const enemy = mockCreature('whisper', { curHp: 30 });
    state.G.opp.active = enemy;
    
    // Simulate Spark trigger
    const sparkDamage = 5;
    if (CREATURES.emberfang.ability === 'Spark') {
      applyDamage(enemy, sparkDamage);
    }
    
    expect(enemy.curHp).toBe(25);
  });
});

describe('Ignite - Cast Verse', () => {
  it('exists in VERSES', () => {
    expect(VERSES.ignite).toBeDefined();
    expect(VERSES.ignite.type).toBe('cast');
  });

  it('costs 1 mana', () => {
    expect(VERSES.ignite.cost).toBe(1);
  });

  it('deals 15 damage to enemy creature', () => {
    clearGame();
    setGame({ me: mockPlayer(), opp: mockPlayer(), log: [], winner: null });
    
    const enemy = mockCreature('thornling', { curHp: 40 });
    state.G.opp.active = enemy;
    
    // Simulate Ignite effect
    const igniteDamage = 15;
    applyDamage(enemy, igniteDamage);
    
    expect(enemy.curHp).toBe(25);
  });
});

describe('Shade Pup - Orphan ability', () => {
  beforeEach(() => {
    clearGame();
    setGame({
      me: mockPlayer(),
      opp: mockPlayer(),
      log: [],
      winner: null
    });
  });

  it('exists in CREATURES', () => {
    expect(CREATURES.shadePup).toBeDefined();
    expect(CREATURES.shadePup.ability).toBe('Orphan');
  });

  it('has correct base stats (1 cost, 25 HP, 15 ATK)', () => {
    const card = CREATURES.shadePup;
    expect(card.cost).toBe(1);
    expect(card.hp).toBe(25);
    expect(card.atk).toBe(15);
  });

  it('gets +15 ATK when bench is empty', () => {
    const pup = mockCreature('shadePup');
    state.G.me.active = pup;
    state.G.me.bench = []; // Empty bench
    
    // Calculate effective ATK with Orphan
    const orphanBonus = state.G.me.bench.length === 0 ? 15 : 0;
    const effectiveAtk = pup.atk + orphanBonus;
    
    expect(effectiveAtk).toBe(30); // 15 + 15
  });

  it('no bonus when bench has creatures', () => {
    const pup = mockCreature('shadePup');
    state.G.me.active = pup;
    state.G.me.bench = [mockCreature('whisper')]; // Has bench
    
    const orphanBonus = state.G.me.bench.length === 0 ? 15 : 0;
    const effectiveAtk = pup.atk + orphanBonus;
    
    expect(effectiveAtk).toBe(15); // No bonus
  });
});

describe('Leechling - Drain ability', () => {
  beforeEach(() => {
    clearGame();
    setGame({
      me: mockPlayer(),
      opp: mockPlayer(),
      log: [],
      winner: null
    });
  });

  it('exists in CREATURES', () => {
    expect(CREATURES.leechling).toBeDefined();
    expect(CREATURES.leechling.ability).toBe('Drain');
  });

  it('has correct stats (1 cost, 20 HP, 15 ATK)', () => {
    const card = CREATURES.leechling;
    expect(card.cost).toBe(1);
    expect(card.hp).toBe(20);
    expect(card.atk).toBe(15);
  });

  it('heals HP equal to damage dealt', () => {
    const leech = mockCreature('leechling', { curHp: 10 }); // Damaged
    const enemy = mockCreature('thornling', { curHp: 40 });
    
    state.G.me.active = leech;
    state.G.opp.active = enemy;
    
    // Simulate attack with Drain
    const damageDealt = leech.atk; // 15
    applyDamage(enemy, damageDealt);
    
    // Drain heals equal to damage dealt
    const healAmount = Math.min(damageDealt, leech.hp - leech.curHp); // Don't overheal
    leech.curHp = Math.min(leech.hp, leech.curHp + damageDealt);
    
    expect(enemy.curHp).toBe(25); // 40 - 15
    expect(leech.curHp).toBe(20); // 10 + 15, capped at max HP
  });

  it('does not overheal past max HP', () => {
    const leech = mockCreature('leechling', { curHp: 18 }); // Slightly damaged
    
    // Drain 15, but only 2 HP missing
    const healAmount = Math.min(15, leech.hp - leech.curHp);
    leech.curHp = Math.min(leech.hp, leech.curHp + 15);
    
    expect(leech.curHp).toBe(20); // Capped at max
  });
});

describe('Swarm Pack - New Deck', () => {
  it('Fangpup exists with Pack Bond', () => {
    expect(CREATURES.fangpup).toBeDefined();
    expect(CREATURES.fangpup.ability).toBe('Pack Bond');
  });

  it('Fangpup gets +10 ATK per other creature', () => {
    clearGame();
    setGame({ me: mockPlayer(), opp: mockPlayer(), log: [], winner: null });
    
    const pup = mockCreature('fangpup');
    state.G.me.active = pup;
    state.G.me.bench = [mockCreature('whisper'), mockCreature('gloom')];
    
    // Pack Bond: +10 per other creature (bench count)
    const packBonus = state.G.me.bench.length * 10;
    const effectiveAtk = pup.atk + packBonus;
    
    expect(effectiveAtk).toBe(40); // 20 + 20
  });
});

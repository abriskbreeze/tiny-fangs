import { describe, it, expect, beforeEach } from 'vitest';
import { CREATURES } from '../src/cards.js';
import { state, clearGame, setGame } from '../src/state.js';
import { applyDamage } from '../src/game.js';
import {
  getEffectiveAtk,
  getEffectiveDamageReduction,
  applyDrain,
  applySpark,
  checkSwarm,
  shouldScurryTrigger,
  executeScurry,
  applyDenMotherBuff,
  applySpawn,
} from '../src/abilities.js';

/**
 * Ability Effects Tests
 * 
 * Testing ability logic extracted to abilities.js
 */

function mockPlayer(overrides = {}) {
  return {
    lp: 3,
    hand: [],
    deck: [{ id: 'card1' }, { id: 'card2' }],
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

describe('getEffectiveAtk() - ATK Modifiers', () => {
  beforeEach(() => {
    clearGame();
    setGame({
      me: mockPlayer(),
      opp: mockPlayer(),
      log: [],
      winner: null
    });
  });

  it('returns base ATK for normal creature', () => {
    const whisper = mockCreature('whisper'); // 20 ATK
    state.G.me.active = whisper;
    state.G.me.bench = [];
    
    expect(getEffectiveAtk(whisper, state.G.me, state.G.opp)).toBe(20);
  });

  it('Orphan: +15 ATK when bench is empty', () => {
    const pup = mockCreature('shadePup'); // 15 ATK base
    state.G.me.active = pup;
    state.G.me.bench = [];
    
    expect(getEffectiveAtk(pup, state.G.me, state.G.opp)).toBe(30); // 15 + 15
  });

  it('Orphan: no bonus when bench has creatures', () => {
    const pup = mockCreature('shadePup');
    state.G.me.active = pup;
    state.G.me.bench = [mockCreature('whisper')];
    
    expect(getEffectiveAtk(pup, state.G.me, state.G.opp)).toBe(15); // base only
  });

  it('Pack Bond: +10 ATK per other creature', () => {
    const pup = mockCreature('fangpup'); // 20 ATK base
    state.G.me.active = pup;
    state.G.me.bench = [mockCreature('whisper'), mockCreature('gloom')];
    
    expect(getEffectiveAtk(pup, state.G.me, state.G.opp)).toBe(40); // 20 + 10 + 10
  });

  it('Pack Bond: no bonus when alone', () => {
    const pup = mockCreature('fangpup');
    state.G.me.active = pup;
    state.G.me.bench = [];
    
    expect(getEffectiveAtk(pup, state.G.me, state.G.opp)).toBe(20); // base only
  });

  it('Feeding Frenzy: +15 ATK if enemy below half HP', () => {
    const fish = mockCreature('piranix'); // 25 ATK base
    const enemy = mockCreature('thornling', { curHp: 15, hp: 40 }); // Below half
    
    state.G.me.active = fish;
    state.G.opp.active = enemy;
    
    expect(getEffectiveAtk(fish, state.G.me, state.G.opp)).toBe(40); // 25 + 15
  });

  it('Feeding Frenzy: no bonus if enemy above half HP', () => {
    const fish = mockCreature('piranix');
    const enemy = mockCreature('thornling', { curHp: 30, hp: 40 }); // Above half
    
    state.G.me.active = fish;
    state.G.opp.active = enemy;
    
    expect(getEffectiveAtk(fish, state.G.me, state.G.opp)).toBe(25); // base only
  });

  it('Rally: +10 ATK per bench creature for any attacker', () => {
    const alpha = mockCreature('alpha'); // 35 ATK base
    state.G.me.active = alpha;
    state.G.me.bench = [mockCreature('fangpup'), mockCreature('hiveling')];
    
    // Alpha's Rally ability boosts its own attacks with bench
    expect(getEffectiveAtk(alpha, state.G.me, state.G.opp)).toBe(55); // 35 + 10 + 10
  });
});

describe('getEffectiveDamageReduction() - Damage Reduction', () => {
  beforeEach(() => {
    clearGame();
    setGame({
      me: mockPlayer(),
      opp: mockPlayer(),
      log: [],
      winner: null
    });
  });

  it('returns 0 for normal creature', () => {
    const whisper = mockCreature('whisper');
    state.G.me.active = whisper;
    state.G.me.bench = [];
    
    expect(getEffectiveDamageReduction(whisper, state.G.me)).toBe(0);
  });

  it('Den Guard: -10 damage when bench has creatures', () => {
    const hollowfox = mockCreature('hollowfox');
    state.G.me.active = hollowfox;
    state.G.me.bench = [mockCreature('whisper')];
    
    expect(getEffectiveDamageReduction(hollowfox, state.G.me)).toBe(10);
  });

  it('Den Guard: no reduction when bench is empty', () => {
    const hollowfox = mockCreature('hollowfox');
    state.G.me.active = hollowfox;
    state.G.me.bench = [];
    
    expect(getEffectiveDamageReduction(hollowfox, state.G.me)).toBe(0);
  });
});

describe('applyDrain() - Leechling Heal', () => {
  it('heals HP equal to damage dealt', () => {
    const leech = mockCreature('leechling', { curHp: 10, hp: 20 });
    
    applyDrain(leech, 15); // Dealt 15 damage
    
    expect(leech.curHp).toBe(20); // 10 + 15, capped at 20
  });

  it('does not overheal', () => {
    const leech = mockCreature('leechling', { curHp: 18, hp: 20 });
    
    applyDrain(leech, 15);
    
    expect(leech.curHp).toBe(20); // capped at max
  });

  it('returns amount actually healed', () => {
    const leech = mockCreature('leechling', { curHp: 18, hp: 20 });
    
    const healed = applyDrain(leech, 15);
    
    expect(healed).toBe(2); // Only healed 2
  });
});

describe('applySpark() - Emberfang Summon Damage', () => {
  beforeEach(() => {
    clearGame();
    setGame({
      me: mockPlayer(),
      opp: mockPlayer(),
      log: [],
      winner: null
    });
  });

  it('deals 5 damage to enemy creature', () => {
    const enemy = mockCreature('whisper', { curHp: 30 });
    state.G.opp.active = enemy;
    
    const result = applySpark(state.G.opp);
    
    expect(enemy.curHp).toBe(25);
    expect(result.damage).toBe(5);
    expect(result.ko).toBe(false);
  });

  it('can KO weak enemy', () => {
    const enemy = mockCreature('gloom', { curHp: 5 });
    state.G.opp.active = enemy;
    
    const result = applySpark(state.G.opp);
    
    expect(enemy.curHp).toBe(0);
    expect(result.ko).toBe(true);
  });

  it('does nothing if no enemy active', () => {
    state.G.opp.active = null;
    
    const result = applySpark(state.G.opp);
    
    expect(result.damage).toBe(0);
  });
});

describe('checkSwarm() - Hiveling Draw', () => {
  beforeEach(() => {
    clearGame();
    setGame({
      me: mockPlayer(),
      opp: mockPlayer(),
      log: [],
      winner: null
    });
  });

  it('returns true when player has 2+ creatures total', () => {
    state.G.me.active = mockCreature('hiveling');
    state.G.me.bench = [mockCreature('whisper')]; // 2 total
    
    expect(checkSwarm(state.G.me)).toBe(true);
  });

  it('returns false when player has only 1 creature', () => {
    state.G.me.active = mockCreature('hiveling');
    state.G.me.bench = []; // Only 1
    
    expect(checkSwarm(state.G.me)).toBe(false);
  });

  it('returns true with full board', () => {
    state.G.me.active = mockCreature('hiveling');
    state.G.me.bench = [mockCreature('whisper'), mockCreature('gloom')]; // 3 total
    
    expect(checkSwarm(state.G.me)).toBe(true);
  });
});

describe('Swarm Shield - Set Verse Damage Reduction', () => {
  beforeEach(() => {
    clearGame();
    setGame({
      me: mockPlayer(),
      opp: mockPlayer(),
      log: [],
      winner: null
    });
  });

  it('reduces damage by 15 when has bench', () => {
    const creature = mockCreature('whisper');
    state.G.me.active = creature;
    state.G.me.bench = [mockCreature('gloom')];
    state.G.me.setVerse = { id: 'swarmShield' };
    
    expect(getEffectiveDamageReduction(creature, state.G.me)).toBe(15);
  });

  it('no reduction when bench is empty', () => {
    const creature = mockCreature('whisper');
    state.G.me.active = creature;
    state.G.me.bench = [];
    state.G.me.setVerse = { id: 'swarmShield' };
    
    expect(getEffectiveDamageReduction(creature, state.G.me)).toBe(0);
  });

  it('stacks with Den Guard (Hollowfox)', () => {
    const hollowfox = mockCreature('hollowfox');
    state.G.me.active = hollowfox;
    state.G.me.bench = [mockCreature('whisper')];
    state.G.me.setVerse = { id: 'swarmShield' };
    
    // Hollowfox Den Guard (10) + Swarm Shield (15) = 25
    expect(getEffectiveDamageReduction(hollowfox, state.G.me)).toBe(25);
  });
});

describe('Scurry - Skitter Swap', () => {
  beforeEach(() => {
    clearGame();
    setGame({
      me: mockPlayer(),
      opp: mockPlayer(),
      log: [],
      winner: null
    });
  });

  it('should trigger when Skitter takes damage and has bench', () => {
    const skitter = mockCreature('skitter', { curHp: 20 });
    state.G.me.active = skitter;
    state.G.me.bench = [mockCreature('whisper')];
    
    expect(shouldScurryTrigger(skitter, state.G.me)).toBe(true);
  });

  it('should not trigger when bench is empty', () => {
    const skitter = mockCreature('skitter', { curHp: 20 });
    state.G.me.active = skitter;
    state.G.me.bench = [];
    
    expect(shouldScurryTrigger(skitter, state.G.me)).toBe(false);
  });

  it('should not trigger when Skitter is KOd', () => {
    const skitter = mockCreature('skitter', { curHp: 0 });
    state.G.me.active = skitter;
    state.G.me.bench = [mockCreature('whisper')];
    
    expect(shouldScurryTrigger(skitter, state.G.me)).toBe(false);
  });

  it('executeScurry swaps active with bench', () => {
    const skitter = mockCreature('skitter');
    const whisper = mockCreature('whisper');
    state.G.me.active = skitter;
    state.G.me.bench = [whisper];
    
    executeScurry(state.G.me);
    
    expect(state.G.me.active).toBe(whisper);
    expect(state.G.me.bench).toContain(skitter);
  });
});

describe('Den Mother - KO Buff', () => {
  beforeEach(() => {
    clearGame();
    setGame({
      me: mockPlayer(),
      opp: mockPlayer(),
      log: [],
      winner: null
    });
  });

  it('buffs all remaining creatures by +10 ATK', () => {
    const active = mockCreature('fangpup'); // 20 ATK
    const benched = mockCreature('whisper'); // 20 ATK
    state.G.me.active = active;
    state.G.me.bench = [benched];
    
    applyDenMotherBuff(state.G.me);
    
    expect(active.atk).toBe(30); // 20 + 10
    expect(benched.atk).toBe(30); // 20 + 10
  });

});

describe('Broodmother Spawn', () => {
  beforeEach(() => {
    clearGame();
    setGame({
      me: mockPlayer(),
      opp: mockPlayer(),
      log: [],
      winner: null
    });
  });

  it('creates Antling token on bench', () => {
    state.G.me.active = mockCreature('broodmother');
    state.G.me.bench = [];
    
    const antling = applySpawn(state.G.me);
    
    expect(antling).not.toBeNull();
    expect(antling.name).toBe('Antling');
    expect(antling.hp).toBe(10);
    expect(antling.atk).toBe(10);
    expect(antling.isToken).toBe(true);
    expect(state.G.me.bench).toContain(antling);
  });

  it('returns null when bench is full', () => {
    state.G.me.active = mockCreature('broodmother');
    state.G.me.bench = [mockCreature('whisper'), mockCreature('gloom')];
    
    const result = applySpawn(state.G.me);
    
    expect(result).toBeNull();
    expect(state.G.me.bench).toHaveLength(2);
  });
});


import { describe, it, expect } from 'vitest';
import { getAllMoves, scoreMove, pickBestMove, getScoredMoves } from '../src/ai.js';

function mockPlayer(overrides = {}) {
  return {
    lp: 3,
    hand: [],
    deck: [],
    grave: [],
    bench: [],
    active: null,
    setVerse: null,
    mana: 3,
    maxMana: 3,
    ...overrides
  };
}

function mockCreature(id, overrides = {}) {
  return {
    uid: Math.random().toString(36).slice(2, 9),
    cardType: 'creature',
    id,
    name: id,
    cost: 2,
    hp: 40,
    curHp: 40,
    atk: 30,
    ...overrides
  };
}

function mockVerse(id, type, cost = 2) {
  return {
    uid: Math.random().toString(36).slice(2, 9),
    cardType: 'verse',
    id,
    name: id,
    type,
    cost
  };
}

describe('getAllMoves', () => {
  it('returns pass when no options', () => {
    const ai = mockPlayer();
    const player = mockPlayer();
    const moves = getAllMoves(ai, player);
    
    expect(moves).toHaveLength(1);
    expect(moves[0].type).toBe('pass');
  });
  
  it('includes summon-active when no active and creature in hand', () => {
    const ai = mockPlayer({
      hand: [mockCreature('test', { cost: 2 })],
      mana: 3
    });
    const player = mockPlayer();
    const moves = getAllMoves(ai, player);
    
    expect(moves.some(m => m.type === 'summon-active')).toBe(true);
  });
  
  it('includes summon-bench when active exists and bench has room', () => {
    const ai = mockPlayer({
      hand: [mockCreature('test', { cost: 2 })],
      active: mockCreature('active'),
      bench: [],
      mana: 3
    });
    const player = mockPlayer();
    const moves = getAllMoves(ai, player);
    
    expect(moves.some(m => m.type === 'summon-bench')).toBe(true);
  });
  
  it('excludes summon-bench when bench is full', () => {
    const ai = mockPlayer({
      hand: [mockCreature('test', { cost: 2 })],
      active: mockCreature('active'),
      bench: [mockCreature('b1'), mockCreature('b2')],
      mana: 3
    });
    const player = mockPlayer();
    const moves = getAllMoves(ai, player);
    
    expect(moves.some(m => m.type === 'summon-bench')).toBe(false);
  });
  
  it('includes cast for cast verses', () => {
    const ai = mockPlayer({
      hand: [mockVerse('soulSiphon', 'cast', 2)],
      mana: 3
    });
    const player = mockPlayer();
    const moves = getAllMoves(ai, player);
    
    expect(moves.some(m => m.type === 'cast')).toBe(true);
  });
  
  it('includes set for set verses when slot empty', () => {
    const ai = mockPlayer({
      hand: [mockVerse('soulTrap', 'set', 1)],
      setVerse: null,
      mana: 3
    });
    const player = mockPlayer();
    const moves = getAllMoves(ai, player);
    
    expect(moves.some(m => m.type === 'set')).toBe(true);
  });
  
  it('excludes set when slot occupied', () => {
    const ai = mockPlayer({
      hand: [mockVerse('soulTrap', 'set', 1)],
      setVerse: mockVerse('existing', 'set'),
      mana: 3
    });
    const player = mockPlayer();
    const moves = getAllMoves(ai, player);
    
    expect(moves.some(m => m.type === 'set')).toBe(false);
  });
  
  it('includes attack when both actives exist', () => {
    const ai = mockPlayer({ active: mockCreature('ai') });
    const player = mockPlayer({ active: mockCreature('player') });
    const moves = getAllMoves(ai, player);
    
    expect(moves.some(m => m.type === 'attack')).toBe(true);
  });
  
  it('excludes attack when canAttack is false', () => {
    const ai = mockPlayer({ active: mockCreature('ai') });
    const player = mockPlayer({ active: mockCreature('player') });
    const moves = getAllMoves(ai, player, false);
    
    expect(moves.some(m => m.type === 'attack')).toBe(false);
  });
  
  it('includes attack-direct when enemy has no active', () => {
    const ai = mockPlayer({ active: mockCreature('ai') });
    const player = mockPlayer({ active: null });
    const moves = getAllMoves(ai, player);
    
    expect(moves.some(m => m.type === 'attack-direct')).toBe(true);
  });
  
  it('excludes unaffordable cards', () => {
    const ai = mockPlayer({
      hand: [mockCreature('expensive', { cost: 5 })],
      mana: 2
    });
    const player = mockPlayer();
    const moves = getAllMoves(ai, player);
    
    // Should only have pass
    expect(moves).toHaveLength(1);
    expect(moves[0].type).toBe('pass');
  });
});

describe('scoreMove', () => {
  describe('summon-active', () => {
    it('scores high when no active', () => {
      const ai = mockPlayer({ active: null });
      const player = mockPlayer();
      const card = mockCreature('test');
      
      const score = scoreMove({ type: 'summon-active', card }, ai, player);
      expect(score).toBeGreaterThan(80);
    });
    
    it('scores higher for creatures that can KO enemy', () => {
      const ai = mockPlayer();
      const player = mockPlayer({ 
        active: mockCreature('enemy', { curHp: 30 }) 
      });
      const canKO = mockCreature('strong', { atk: 40 });
      const cantKO = mockCreature('weak', { atk: 20 });
      
      const scoreKO = scoreMove({ type: 'summon-active', card: canKO }, ai, player);
      const scoreNoKO = scoreMove({ type: 'summon-active', card: cantKO }, ai, player);
      
      expect(scoreKO).toBeGreaterThan(scoreNoKO);
    });
  });
  
  describe('cast verses', () => {
    it('scores ignite very high when can KO', () => {
      const ai = mockPlayer();
      const player = mockPlayer({
        active: mockCreature('weak', { curHp: 15 })
      });
      const ignite = mockVerse('ignite', 'cast', 1);
      
      const score = scoreMove({ type: 'cast', card: ignite }, ai, player);
      expect(score).toBeGreaterThanOrEqual(100);
    });
    
    it('scores ignite low when cannot KO', () => {
      const ai = mockPlayer();
      const player = mockPlayer({
        active: mockCreature('healthy', { curHp: 50 })
      });
      const ignite = mockVerse('ignite', 'cast', 1);
      
      const score = scoreMove({ type: 'cast', card: ignite }, ai, player);
      expect(score).toBeLessThan(50);
    });
    
    it('scores darkPact negative at 1 LP', () => {
      const ai = mockPlayer({ lp: 1 });
      const player = mockPlayer();
      const darkPact = mockVerse('darkPact', 'cast', 1);
      
      const score = scoreMove({ type: 'cast', card: darkPact }, ai, player);
      expect(score).toBeLessThan(0);
    });
    
    it('scores manaSurge high first time', () => {
      const ai = mockPlayer({ usedManaSurge: false });
      const player = mockPlayer();
      const manaSurge = mockVerse('manaSurge', 'cast', 0);
      
      const score = scoreMove({ type: 'cast', card: manaSurge }, ai, player);
      expect(score).toBeGreaterThan(70);
    });
    
    it('scores manaSurge negative if already used', () => {
      const ai = mockPlayer({ usedManaSurge: true });
      const player = mockPlayer();
      const manaSurge = mockVerse('manaSurge', 'cast', 0);
      
      const score = scoreMove({ type: 'cast', card: manaSurge }, ai, player);
      expect(score).toBeLessThan(0);
    });
  });
  
  describe('attack', () => {
    it('scores higher when can KO', () => {
      const aiActive = mockCreature('ai', { atk: 50 });
      const playerActive = mockCreature('player', { curHp: 40 });
      
      const ai = mockPlayer({ active: aiActive });
      const player = mockPlayer({ active: playerActive });
      
      const score = scoreMove({ type: 'attack' }, ai, player);
      expect(score).toBeGreaterThan(80);
    });
    
    it('scores lower when enemy has set verse', () => {
      const ai = mockPlayer({ active: mockCreature('ai') });
      const player = mockPlayer({ 
        active: mockCreature('player'),
        setVerse: mockVerse('trap', 'set')
      });
      
      const scoreWithTrap = scoreMove({ type: 'attack' }, ai, player);
      
      const player2 = mockPlayer({ 
        active: mockCreature('player'),
        setVerse: null
      });
      const scoreNoTrap = scoreMove({ type: 'attack' }, ai, player2);
      
      expect(scoreWithTrap).toBeLessThan(scoreNoTrap);
    });
  });
  
  describe('pass', () => {
    it('always scores 0', () => {
      const ai = mockPlayer();
      const player = mockPlayer();
      
      const score = scoreMove({ type: 'pass' }, ai, player);
      expect(score).toBe(0);
    });
  });
});

describe('pickBestMove', () => {
  it('picks highest scored move', () => {
    const moves = [
      { type: 'pass', score: 0 },
      { type: 'attack', score: 50 },
      { type: 'cast', score: 80 }
    ];
    
    const best = pickBestMove(moves);
    expect(best.type).toBe('cast');
  });
  
  it('returns pass if all below threshold', () => {
    const moves = [
      { type: 'summon-bench', score: 5 },
      { type: 'pass', score: 0 }
    ];
    
    const best = pickBestMove(moves, 10);
    expect(best.type).toBe('pass');
  });
  
  it('respects custom threshold', () => {
    const moves = [
      { type: 'attack', score: 30 },
      { type: 'pass', score: 0 }
    ];
    
    const best = pickBestMove(moves, 50);
    expect(best.type).toBe('pass');
  });
});

describe('getScoredMoves', () => {
  it('returns moves with scores attached', () => {
    const ai = mockPlayer({
      hand: [mockCreature('test')],
      active: null,
      mana: 3
    });
    const player = mockPlayer();
    
    const scored = getScoredMoves(ai, player);
    
    expect(scored.length).toBeGreaterThan(0);
    expect(scored[0]).toHaveProperty('score');
    expect(typeof scored[0].score).toBe('number');
  });
});

// ═══════════════════════════════════════════════════════════════
// BUG-16: AI should use getEffectiveAtk() for ability-modified creatures
// ═══════════════════════════════════════════════════════════════

describe('BUG-16: AI uses ability-modified ATK', () => {
  it('scoreAttack uses Shade Pup Orphan bonus (+15 when bench empty)', () => {
    // Shade Pup: base 15 ATK, +15 with Orphan = 30 effective
    const aiActive = mockCreature('shadePup', { atk: 15, curHp: 40, hp: 40 });
    const playerActive = mockCreature('enemy', { atk: 20, curHp: 25, hp: 40 });
    
    const ai = mockPlayer({ active: aiActive, bench: [] }); // Empty bench = Orphan active
    const player = mockPlayer({ active: playerActive });
    
    // With Orphan (30 ATK), AI can KO the 25 HP enemy
    const score = scoreMove({ type: 'attack' }, ai, player);
    
    // Should score high because effective ATK (30) >= enemy HP (25) = KO
    expect(score).toBeGreaterThan(80); // KO bonus should apply
  });
  
  it('scoreAttack uses Pulsefin First Strike double damage', () => {
    const aiActive = mockCreature('pulsefin', { atk: 30, curHp: 40, hp: 40, firstAtk: true });
    const playerActive = mockCreature('enemy', { atk: 20, curHp: 50, hp: 50 });
    
    const ai = mockPlayer({ active: aiActive, bench: [] });
    const player = mockPlayer({ active: playerActive });
    
    // Pulsefin with firstAtk: 30 * 2 = 60, can KO 50 HP enemy
    const score = scoreMove({ type: 'attack' }, ai, player);
    expect(score).toBeGreaterThan(80); // Should detect KO
  });
  
  it('scoreSummonActive considers ability modifiers when checking KO potential', () => {
    // Shade Pup would have 30 effective ATK (15 + 15 Orphan) if summoned with empty bench
    const shadePup = mockCreature('shadePup', { atk: 15, hp: 40, cost: 1 });
    const playerActive = mockCreature('enemy', { atk: 20, curHp: 28, hp: 40 });
    
    const ai = mockPlayer({ bench: [] }); // Will have empty bench after summon
    const player = mockPlayer({ active: playerActive });
    
    // Shade Pup can KO 28 HP enemy with Orphan (30 ATK)
    const score = scoreMove({ type: 'summon-active', card: shadePup }, ai, player);
    
    // Should get KO bonus (30 ATK >= 28 HP)
    expect(score).toBeGreaterThan(130); // 100 base + 40 KO bonus
  });
});

// ═══════════════════════════════════════════════════════════════
// BUG-17: AI Blood Moon kills own creature when no benefit
// ═══════════════════════════════════════════════════════════════

describe('BUG-17: AI Blood Moon self-preservation', () => {
  it('scores Blood Moon negative when it would KO our active but not theirs', () => {
    const aiActive = mockCreature('ai', { curHp: 15, hp: 40 }); // Would die to 20 damage
    const playerActive = mockCreature('player', { curHp: 50, hp: 50 }); // Survives easily
    
    const ai = mockPlayer({ active: aiActive, bench: [] });
    const player = mockPlayer({ active: playerActive });
    const bloodMoon = mockVerse('bloodMoon', 'cast', 2);
    
    const score = scoreMove({ type: 'cast', card: bloodMoon }, ai, player);
    expect(score).toBeLessThan(0); // Should NOT cast this
  });
  
  it('scores Blood Moon negative when we lose our only creature', () => {
    const aiActive = mockCreature('ai', { curHp: 20, hp: 40 }); // Would die exactly
    const playerActive = mockCreature('player', { curHp: 20, hp: 40 }); // Also dies
    
    const ai = mockPlayer({ active: aiActive, bench: [] }); // No backup!
    const player = mockPlayer({ active: playerActive, bench: [mockCreature('backup')] });
    
    const bloodMoon = mockVerse('bloodMoon', 'cast', 2);
    
    const score = scoreMove({ type: 'cast', card: bloodMoon }, ai, player);
    expect(score).toBeLessThan(0); // Trade is bad when we have no bench
  });
  
  it('scores Blood Moon positive when it KOs theirs but not ours', () => {
    const aiActive = mockCreature('ai', { curHp: 50, hp: 50 }); // Survives
    const playerActive = mockCreature('player', { curHp: 18, hp: 40 }); // Dies
    
    const ai = mockPlayer({ active: aiActive, bench: [] });
    const player = mockPlayer({ active: playerActive });
    const bloodMoon = mockVerse('bloodMoon', 'cast', 2);
    
    const score = scoreMove({ type: 'cast', card: bloodMoon }, ai, player);
    expect(score).toBeGreaterThan(50); // Good trade
  });
});

// ═══════════════════════════════════════════════════════════════
// BUG-18: AI wastes Predator's Mark
// ═══════════════════════════════════════════════════════════════

describe('BUG-18: AI Predator\'s Mark efficiency', () => {
  it('scores Predator\'s Mark low when AI can already KO', () => {
    const aiActive = mockCreature('ai', { atk: 50, curHp: 40, hp: 40 });
    const playerActive = mockCreature('player', { atk: 20, curHp: 30, hp: 40 });
    
    const ai = mockPlayer({ active: aiActive, bench: [] });
    const player = mockPlayer({ active: playerActive });
    const predatorsMark = mockVerse('predatorsMark', 'cast', 1);
    
    // AI already has 50 ATK vs 30 HP - can KO without buff
    const score = scoreMove({ type: 'cast', card: predatorsMark }, ai, player);
    expect(score).toBeLessThan(30); // Low priority, don't waste it
  });
  
  it('scores Predator\'s Mark negative when AI already attacked this turn', () => {
    const aiActive = mockCreature('ai', { atk: 30, curHp: 40, hp: 40 });
    const playerActive = mockCreature('player', { atk: 20, curHp: 50, hp: 50 });
    
    const ai = mockPlayer({ 
      active: aiActive, 
      bench: [],
      hasAttackedThisTurn: true // Already attacked!
    });
    const player = mockPlayer({ active: playerActive });
    const predatorsMark = mockVerse('predatorsMark', 'cast', 1);
    
    const score = scoreMove({ type: 'cast', card: predatorsMark }, ai, player);
    expect(score).toBeLessThan(0); // Useless this turn
  });
  
  it('scores Predator\'s Mark high when it enables a KO', () => {
    const aiActive = mockCreature('ai', { atk: 25, curHp: 40, hp: 40 });
    const playerActive = mockCreature('player', { atk: 20, curHp: 50, hp: 50 });
    
    const ai = mockPlayer({ 
      active: aiActive, 
      bench: [],
      hasAttackedThisTurn: false
    });
    const player = mockPlayer({ active: playerActive });
    const predatorsMark = mockVerse('predatorsMark', 'cast', 1);
    
    // 25 + 30 = 55 ATK, can KO 50 HP enemy
    const score = scoreMove({ type: 'cast', card: predatorsMark }, ai, player);
    expect(score).toBeGreaterThan(50); // Good use
  });
});

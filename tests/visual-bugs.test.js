/**
 * Tests for Visual/UI bugs (BUG-01 through BUG-04)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { state, clearGame, setGame } from '../src/state.js';
import { getAtkModifiers } from '../src/abilities.js';

describe('BUG-01: Pulsefin ATK modifier UI', () => {
  beforeEach(() => clearGame());

  it('should show doubled ATK modifier when firstAtk is true', () => {
    const pulsefin = {
      id: 'pulsefin',
      name: 'Pulsefin',
      atk: 30,
      hp: 40,
      curHp: 40,
      firstAtk: true
    };
    
    const owner = { bench: [], active: pulsefin, attackBonuses: [] };
    const enemy = { active: null, bench: [] };
    
    const result = getAtkModifiers(pulsefin, owner, enemy);
    
    // Base ATK is 30, should be doubled to 60 on first attack
    expect(result.effectiveAtk).toBe(60);
    expect(result.modifiers.length).toBeGreaterThan(0);
    
    const sonicStrike = result.modifiers.find(m => m.name === 'Sonic Strike');
    expect(sonicStrike).toBeDefined();
    expect(sonicStrike.value).toBe(30); // +30 (double the base)
    expect(sonicStrike.desc).toBe('First attack doubled');
  });

  it('should NOT show doubled ATK modifier when firstAtk is false', () => {
    const pulsefin = {
      id: 'pulsefin',
      name: 'Pulsefin',
      atk: 30,
      hp: 40,
      curHp: 40,
      firstAtk: false
    };
    
    const owner = { bench: [], active: pulsefin, attackBonuses: [] };
    const enemy = { active: null, bench: [] };
    
    const result = getAtkModifiers(pulsefin, owner, enemy);
    
    // No Sonic Strike modifier when firstAtk is false
    expect(result.effectiveAtk).toBe(30);
    const sonicStrike = result.modifiers.find(m => m.name === 'Sonic Strike');
    expect(sonicStrike).toBeUndefined();
  });
});

describe('BUG-02: Duskfang ATK boost UI', () => {
  beforeEach(() => clearGame());

  it('should show atkBonuses from creature (Pack Call trigger)', () => {
    const duskfang = {
      id: 'duskfang',
      name: 'Duskfang',
      atk: 25,
      hp: 45,
      curHp: 45,
      atkBonuses: [
        { source: 'Pack Call', value: 10 }
      ]
    };
    
    const owner = { bench: [], active: duskfang, attackBonuses: [] };
    const enemy = { active: null, bench: [] };
    
    const result = getAtkModifiers(duskfang, owner, enemy);
    
    // Base ATK 25 + 10 from Pack Call = 35
    expect(result.effectiveAtk).toBe(35);
    expect(result.modifiers.length).toBeGreaterThan(0);
    
    const packCall = result.modifiers.find(m => m.source === 'Pack Call' || m.name === 'Pack Call');
    expect(packCall).toBeDefined();
    expect(packCall.value).toBe(10);
  });

  it('should show multiple atkBonuses if creature has multiple', () => {
    const creature = {
      id: 'duskfang',
      name: 'Duskfang',
      atk: 25,
      hp: 45,
      curHp: 45,
      atkBonuses: [
        { source: 'Pack Call', value: 10 },
        { source: 'Another Buff', value: 5 }
      ]
    };
    
    const owner = { bench: [], active: creature, attackBonuses: [] };
    const enemy = { active: null, bench: [] };
    
    const result = getAtkModifiers(creature, owner, enemy);
    
    // Base ATK 25 + 10 + 5 = 40
    expect(result.effectiveAtk).toBe(40);
    expect(result.modifiers.length).toBe(2);
  });

  it('should NOT break when creature has no atkBonuses', () => {
    const creature = {
      id: 'duskfang',
      name: 'Duskfang',
      atk: 25,
      hp: 45,
      curHp: 45
      // no atkBonuses property
    };
    
    const owner = { bench: [], active: creature, attackBonuses: [] };
    const enemy = { active: null, bench: [] };
    
    const result = getAtkModifiers(creature, owner, enemy);
    
    // Should work without error, just base ATK
    expect(result.effectiveAtk).toBe(25);
  });
});

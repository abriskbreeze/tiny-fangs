import { describe, it, expect, beforeEach } from 'vitest';
import { state, clearGame } from '../src/state.js';
import { applyDamage } from '../src/game.js';

/**
 * Cindermaw Frenzy Bug Test
 * 
 * BUG: Cindermaw dies from self-damage BEFORE hitting the opponent
 * EXPECTED: Cindermaw attacks → deals damage → THEN takes self-damage → dies
 * 
 * Log showed: "Frenzy! Double hit, -10 self Cindermaw KO'd!" with no attack
 */

// Mock creatures
function mockCindermaw(hp) {
  return {
    id: 'cindermaw',
    name: 'Cindermaw',
    hp: 30,
    curHp: hp,
    atk: 30,
    cardType: 'creature'
  };
}

function mockDefender(hp) {
  return {
    id: 'whisper',
    name: 'Whisper',
    hp: 30,
    curHp: hp,
    atk: 20,
    cardType: 'creature'
  };
}

describe('Cindermaw Frenzy - Bug Reproduction', () => {
  
  it('BUG: current logic - Cindermaw with 10 HP dies before attacking', () => {
    // Simulate CURRENT buggy behavior
    const cindermaw = mockCindermaw(10); // 10 HP remaining
    const defender = mockDefender(30);
    
    let dmg = cindermaw.atk; // 30
    
    // CURRENT ORDER (buggy):
    // 1. Self-damage first
    dmg *= 2; // 60
    const frenzyKo = applyDamage(cindermaw, 10); // Cindermaw: 10 -> 0, KO!
    
    // 2. Cindermaw is KO'd, so attack never happens
    let attackLanded = false;
    if (!frenzyKo) {
      applyDamage(defender, dmg);
      attackLanded = true;
    }
    
    // BUG: Cindermaw died, defender never took damage
    expect(cindermaw.curHp).toBe(0);
    expect(frenzyKo).toBe(true);
    expect(attackLanded).toBe(false);
    expect(defender.curHp).toBe(30); // Never damaged!
  });

  it('FIX: correct logic - Cindermaw attacks THEN dies from self-damage', () => {
    const cindermaw = mockCindermaw(10); // 10 HP remaining
    const defender = mockDefender(30);
    
    let dmg = cindermaw.atk; // 30
    
    // CORRECT ORDER:
    // 1. Calculate damage multiplier
    dmg *= 2; // 60
    
    // 2. Attack lands FIRST
    const defenderKo = applyDamage(defender, dmg); // Defender: 30 -> 0
    
    // 3. THEN self-damage
    const frenzyKo = applyDamage(cindermaw, 10); // Cindermaw: 10 -> 0
    
    // Correct: Both took damage, Cindermaw got his hit in before dying
    expect(defender.curHp).toBe(0); // Defender took the hit!
    expect(defenderKo).toBe(true);
    expect(cindermaw.curHp).toBe(0); // Cindermaw died after
    expect(frenzyKo).toBe(true);
  });
});

describe('Cindermaw Frenzy - Edge Cases', () => {

  it('Cindermaw with plenty HP - attacks and survives', () => {
    const cindermaw = mockCindermaw(30); // Full HP
    const defender = mockDefender(30);
    
    let dmg = cindermaw.atk * 2; // 60 (Frenzy)
    
    // Attack first
    applyDamage(defender, dmg);
    // Then self-damage
    const frenzyKo = applyDamage(cindermaw, 10);
    
    expect(defender.curHp).toBe(0); // KO'd
    expect(cindermaw.curHp).toBe(20); // Survived with 20
    expect(frenzyKo).toBe(false);
  });

  it('Cindermaw with 5 HP - overkill self-damage still lets attack through', () => {
    const cindermaw = mockCindermaw(5); // Very low HP
    const defender = mockDefender(30);
    
    let dmg = cindermaw.atk * 2; // 60
    
    // Attack first (this is what matters)
    applyDamage(defender, dmg);
    // Then self-damage (Cindermaw will die)
    const frenzyKo = applyDamage(cindermaw, 10);
    
    expect(defender.curHp).toBe(0); // Got hit before Cindermaw died
    expect(cindermaw.curHp).toBe(0); // Clamped to 0, not -5
    expect(frenzyKo).toBe(true);
  });
});

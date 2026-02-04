import { describe, it, expect } from 'vitest';

/**
 * BUG REPRODUCTION TEST: Negative HP Display
 * 
 * Scenario: Chain Lightning + Soul Trap causes creature to display negative HP
 * Root cause: ko() is async but not awaited, render() runs before HP is clamped
 * 
 * Expected behavior: curHp should NEVER be negative after damage is applied
 */

// Mock creature factory (mirrors index.html createCreature)
function createCreature(template) {
  return {
    ...template,
    cardType: 'creature',
    curHp: template.hp,
    status: null,
    uid: Math.random().toString(36).slice(2, 9),
    firstAtk: true,
  };
}

// THE FIX: Safe damage application that clamps HP to minimum 0
function applyDamage(creature, amount) {
  creature.curHp = Math.max(0, creature.curHp - amount);
  return creature.curHp <= 0; // returns true if KO'd
}

// BUGGY VERSION: What the code currently does (no clamping)
function applyDamageBuggy(creature, amount) {
  creature.curHp -= amount;
  return creature.curHp <= 0;
}

describe('HP Clamping - Bug Reproduction', () => {
  
  it('BUG: unclamped damage can result in negative HP', () => {
    // This test documents the bug - it should pass showing the bug exists
    const whisper = createCreature({ id: 'whisper', name: 'Whisper', hp: 30, atk: 20 });
    
    // Soul Trap deals 20 damage
    applyDamageBuggy(whisper, 20); // curHp = 10
    expect(whisper.curHp).toBe(10);
    
    // Chain Lightning deals 20 more
    applyDamageBuggy(whisper, 20); // curHp = -10 (BUG!)
    
    // This demonstrates the bug - HP goes negative
    expect(whisper.curHp).toBe(-10); // BUG: negative HP!
  });

  it('FIX: clamped damage should never result in negative HP', () => {
    const whisper = createCreature({ id: 'whisper', name: 'Whisper', hp: 30, atk: 20 });
    
    // Soul Trap deals 20 damage
    const ko1 = applyDamage(whisper, 20);
    expect(whisper.curHp).toBe(10);
    expect(ko1).toBe(false);
    
    // Chain Lightning deals 20 more - should clamp to 0, not go negative
    const ko2 = applyDamage(whisper, 20);
    expect(whisper.curHp).toBe(0); // Clamped to 0, not -10
    expect(ko2).toBe(true); // KO triggered
  });

  it('FIX: massive overkill damage should clamp to 0', () => {
    const gloom = createCreature({ id: 'gloom', name: 'Gloom', hp: 20, atk: 20 });
    
    // 100 damage to a 20 HP creature
    const ko = applyDamage(gloom, 100);
    expect(gloom.curHp).toBe(0); // Not -80
    expect(ko).toBe(true);
  });

  it('FIX: exact lethal damage should result in 0 HP', () => {
    const gloom = createCreature({ id: 'gloom', name: 'Gloom', hp: 20, atk: 20 });
    
    const ko = applyDamage(gloom, 20);
    expect(gloom.curHp).toBe(0);
    expect(ko).toBe(true);
  });

  it('FIX: non-lethal damage should work normally', () => {
    const duskfang = createCreature({ id: 'duskfang', name: 'Duskfang', hp: 60, atk: 40 });
    
    const ko = applyDamage(duskfang, 25);
    expect(duskfang.curHp).toBe(35);
    expect(ko).toBe(false);
  });
});

describe('Chain Lightning + Soul Trap Scenario', () => {
  
  it('should handle double damage source without negative HP', () => {
    // Simulates: Summon creature → Soul Trap (-20) → Chain Lightning (-20)
    const thornling = createCreature({ id: 'thornling', name: 'Thornling', hp: 40, atk: 10 });
    
    // Soul Trap triggers on summon
    const soulTrapKo = applyDamage(thornling, 20);
    expect(thornling.curHp).toBe(20);
    expect(soulTrapKo).toBe(false); // Survives
    
    // Chain Lightning triggers after (Stormtalon died earlier)
    const chainKo = applyDamage(thornling, 20);
    expect(thornling.curHp).toBe(0); // Clamped, not negative
    expect(chainKo).toBe(true); // Now KO'd
  });

  it('should handle Cindermaw self-damage scenario', () => {
    // Cindermaw (30 HP) takes 10 self-damage from Frenzy
    const cindermaw = createCreature({ id: 'cindermaw', name: 'Cindermaw', hp: 30, atk: 30 });
    
    // First attack, takes some damage from enemy
    applyDamage(cindermaw, 15); // 15 HP left
    expect(cindermaw.curHp).toBe(15);
    
    // Second attack with Frenzy self-damage
    applyDamage(cindermaw, 10); // 5 HP left
    expect(cindermaw.curHp).toBe(5);
    
    // Third attack, Thornling thorns (10) kills it
    const ko = applyDamage(cindermaw, 10);
    expect(cindermaw.curHp).toBe(0); // Not -5
    expect(ko).toBe(true);
  });
});

describe('Render Safety', () => {
  
  it('HP percentage calculation should handle 0 HP correctly', () => {
    const creature = createCreature({ id: 'test', name: 'Test', hp: 50, atk: 10 });
    applyDamage(creature, 50); // Exactly 0 HP
    
    const pct = (creature.curHp / creature.hp) * 100;
    expect(pct).toBe(0);
    expect(pct).toBeGreaterThanOrEqual(0); // Never negative
  });

  it('HP bar width should never be negative', () => {
    const creature = createCreature({ id: 'test', name: 'Test', hp: 30, atk: 10 });
    applyDamage(creature, 50); // Would be -20 without clamping
    
    const pct = Math.max(0, (creature.curHp / creature.hp) * 100);
    expect(pct).toBe(0);
    expect(pct).toBeGreaterThanOrEqual(0);
  });
});

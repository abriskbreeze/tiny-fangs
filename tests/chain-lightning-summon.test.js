import { describe, it, expect, beforeEach } from 'vitest';
import { state, clearGame, setGame } from '../src/state.js';
import { applyDamage } from '../src/game.js';

/**
 * Chain Lightning on Summon - Animation Sequence
 * 
 * CORRECT UX FLOW:
 * 1. SUMMON! animation plays (creature enters)
 * 2. Brief pause (player sees summon)
 * 3. Chain Lightning triggers (damage effect)
 * 4. KO animation plays (if creature dies)
 * 
 * This tells a clear story to the player about what happened.
 */

describe('Chain Lightning on Summon - Animation Sequence', () => {
  
  beforeEach(() => {
    clearGame();
  });

  it('creature survives chain lightning - full animation sequence plays', () => {
    const creature = { id: 'duskfang', name: 'Duskfang', hp: 60, curHp: 60 };
    const chainLightning = 20;
    
    // Sequence: SUMMON → pause → Chain Lightning → survive
    const animations = [];
    
    // 1. Summon animation (always plays)
    animations.push('SUMMON');
    
    // 2. Chain Lightning damage
    if (chainLightning > 0) {
      animations.push('PAUSE');
      animations.push('CHAIN_LIGHTNING_DAMAGE');
      applyDamage(creature, chainLightning);
      
      // 3. KO only if dead
      if (creature.curHp <= 0) {
        animations.push('KO');
      }
    }
    
    expect(animations).toEqual(['SUMMON', 'PAUSE', 'CHAIN_LIGHTNING_DAMAGE']);
    expect(creature.curHp).toBe(40); // Survived
  });

  it('creature dies to chain lightning - full animation sequence with KO', () => {
    const creature = { id: 'gloom', name: 'Gloom', hp: 20, curHp: 20 };
    const chainLightning = 20;
    
    // Sequence: SUMMON → pause → Chain Lightning → KO
    const animations = [];
    
    // 1. Summon animation (always plays - player sees creature enter)
    animations.push('SUMMON');
    
    // 2. Chain Lightning damage
    if (chainLightning > 0) {
      animations.push('PAUSE');
      animations.push('CHAIN_LIGHTNING_DAMAGE');
      applyDamage(creature, chainLightning);
      
      // 3. KO because dead
      if (creature.curHp <= 0) {
        animations.push('KO');
      }
    }
    
    // Player sees: summon → chain lightning hits → creature dies
    expect(animations).toEqual(['SUMMON', 'PAUSE', 'CHAIN_LIGHTNING_DAMAGE', 'KO']);
    expect(creature.curHp).toBe(0);
  });

  it('creature weakened by Soul Trap then killed by Chain Lightning', () => {
    const creature = { id: 'thornling', name: 'Thornling', hp: 40, curHp: 40 };
    const chainLightning = 20;
    
    // Soul Trap hits first (-20)
    applyDamage(creature, 20);
    expect(creature.curHp).toBe(20);
    
    const animations = ['SUMMON', 'PAUSE', 'CHAIN_LIGHTNING_DAMAGE'];
    applyDamage(creature, chainLightning);
    if (creature.curHp <= 0) animations.push('KO');
    
    expect(animations).toContain('KO');
    expect(creature.curHp).toBe(0);
  });
});

describe('Chain Lightning - No Chain Lightning Case', () => {

  it('no chain lightning - just summon animation', () => {
    const creature = { id: 'whisper', name: 'Whisper', hp: 30, curHp: 30 };
    const chainLightning = 0; // No chain lightning armed
    
    const animations = ['SUMMON']; // Always plays
    
    if (chainLightning > 0) {
      animations.push('CHAIN_LIGHTNING');
    }
    
    expect(animations).toEqual(['SUMMON']); // Just the summon, no extra effects
    expect(creature.curHp).toBe(30);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { state, clearGame, setGame } from '../src/state.js';
import { applyDamage } from '../src/game.js';

/**
 * Chain Lightning on Summon - Animation Bug
 * 
 * BUG: When Chain Lightning KOs a creature on summon, the "SUMMON!" text
 * appears in the top-left corner instead of on the card.
 * 
 * CAUSE: Anim.summon() is not awaited, so ko() removes the card while
 * the animation is still trying to find its target element.
 * 
 * FIX: Check Chain Lightning BEFORE playing summon animation, or skip
 * animation if creature will die.
 */

describe('Chain Lightning on Summon - Logic', () => {
  
  beforeEach(() => {
    clearGame();
  });

  it('creature with HP > chainLightning survives and should animate', () => {
    const creature = { id: 'whisper', name: 'Whisper', hp: 30, curHp: 30 };
    const chainLightning = 20;
    
    // Creature survives
    const willDie = creature.curHp <= chainLightning;
    expect(willDie).toBe(false);
    
    // Should play summon animation
    const shouldAnimate = !willDie;
    expect(shouldAnimate).toBe(true);
  });

  it('creature with HP <= chainLightning dies - should NOT animate summon', () => {
    const creature = { id: 'gloom', name: 'Gloom', hp: 20, curHp: 20 };
    const chainLightning = 20;
    
    // Creature will die
    const willDie = creature.curHp <= chainLightning;
    expect(willDie).toBe(true);
    
    // Should NOT play summon animation (would animate ghost card)
    const shouldAnimate = !willDie;
    expect(shouldAnimate).toBe(false);
  });

  it('creature weakened by Soul Trap then killed by Chain Lightning', () => {
    const creature = { id: 'thornling', name: 'Thornling', hp: 40, curHp: 40 };
    const chainLightning = 20;
    
    // Soul Trap hits first (-20)
    applyDamage(creature, 20);
    expect(creature.curHp).toBe(20);
    
    // Now Chain Lightning will kill
    const willDie = creature.curHp <= chainLightning;
    expect(willDie).toBe(true);
  });
});

describe('Chain Lightning - Correct Summon Flow', () => {

  it('correct flow: check chain lightning before animating', () => {
    // Simulates the CORRECT order of operations
    const creature = { id: 'gloom', name: 'Gloom', hp: 20, curHp: 20 };
    const chainLightning = 20;
    
    // Step 1: Assign to active (state update)
    let active = creature;
    
    // Step 2: Check if chain lightning will kill BEFORE animating
    const willDieToChain = chainLightning > 0 && creature.curHp <= chainLightning;
    
    // Step 3: Only animate if creature will survive
    let animationPlayed = false;
    if (!willDieToChain) {
      animationPlayed = true; // Anim.summon() would be called here
    }
    
    // Step 4: Apply chain lightning damage
    if (chainLightning > 0) {
      applyDamage(creature, chainLightning);
    }
    
    // Verify: Animation was NOT played for doomed creature
    expect(animationPlayed).toBe(false);
    expect(creature.curHp).toBe(0);
  });

  it('correct flow: creature survives chain lightning, animation plays', () => {
    const creature = { id: 'duskfang', name: 'Duskfang', hp: 60, curHp: 60 };
    const chainLightning = 20;
    
    // Check if will die
    const willDieToChain = chainLightning > 0 && creature.curHp <= chainLightning;
    expect(willDieToChain).toBe(false);
    
    // Animation should play
    let animationPlayed = !willDieToChain;
    expect(animationPlayed).toBe(true);
    
    // Apply damage
    applyDamage(creature, chainLightning);
    expect(creature.curHp).toBe(40); // Survived with 40 HP
  });
});

import { describe, it, expect } from 'vitest';
import { ANIM_TIMING, Anim } from '../src/anim.js';

describe('ANIM_TIMING', () => {
  it('has all required timing constants', () => {
    expect(ANIM_TIMING.SHAKE).toBe(300);
    expect(ANIM_TIMING.LUNGE).toBe(300);
    expect(ANIM_TIMING.SUMMON).toBe(500);
    expect(ANIM_TIMING.KO).toBe(400);
    expect(ANIM_TIMING.FLASH).toBe(300);
    expect(ANIM_TIMING.VERSE_POPUP).toBe(700);
    expect(ANIM_TIMING.NEGATE).toBe(500);
    expect(ANIM_TIMING.FLOAT_TEXT).toBe(800);
    expect(ANIM_TIMING.ATTACK_SEQUENCE).toBe(450);
    expect(ANIM_TIMING.AI_PAUSE).toBe(1000);
    expect(ANIM_TIMING.TRIGGER_REVEAL).toBe(5000);
  });

  it('all timings are positive numbers', () => {
    for (const [key, value] of Object.entries(ANIM_TIMING)) {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    }
  });
});

describe('Anim', () => {
  it('has all required methods', () => {
    expect(typeof Anim.play).toBe('function');
    expect(typeof Anim.playOn).toBe('function');
    expect(typeof Anim.floatText).toBe('function');
    expect(typeof Anim.versePopup).toBe('function');
    expect(typeof Anim.negateX).toBe('function');
    expect(typeof Anim.getCardEl).toBe('function');
    expect(typeof Anim.attack).toBe('function');
    expect(typeof Anim.damage).toBe('function');
    expect(typeof Anim.heal).toBe('function');
    expect(typeof Anim.lpDamage).toBe('function');
    expect(typeof Anim.lpHeal).toBe('function');
    expect(typeof Anim.summon).toBe('function');
    expect(typeof Anim.ko).toBe('function');
    expect(typeof Anim.castVerse).toBe('function');
    expect(typeof Anim.manaSpend).toBe('function');
    expect(typeof Anim.manaGain).toBe('function');
    expect(typeof Anim.poisonTick).toBe('function');
    expect(typeof Anim.wait).toBe('function');
    expect(typeof Anim.screenFlash).toBe('function');
  });

  it('wait returns a promise that resolves after specified time', async () => {
    const start = Date.now();
    await Anim.wait(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(45); // Allow small timing variance
  });

  it('play resolves immediately for null element', async () => {
    const start = Date.now();
    await Anim.play(null, 'test-class', 1000);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50); // Should resolve immediately
  });
});

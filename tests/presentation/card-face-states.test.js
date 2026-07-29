import { describe, expect, it } from 'vitest';
import { normalizeFaceModel } from '../../src/presentation/cards/card-face.js';
import { CREATURES, VERSES } from '../../shared/cards.js';

// Phase 5 audit contracts: current-HP display, damaged/boosted states,
// zero-ATK boundary, and worst-case real-card content normalizing cleanly.

describe('card face states (Phase 5)', () => {
  const base = { id: 'x', name: 'Test', cost: 1, atk: 20, hp: 60, cardType: 'creature' };

  it('shows curHp when present and flags the damaged state', () => {
    const model = normalizeFaceModel({ ...base, curHp: 35 }, 'creature');
    expect(model.hp).toBe(35);
    expect(model.maxHp).toBe(60);
    expect(model.damaged).toBe(true);
  });

  it('undamaged creatures show base hp with no damaged flag', () => {
    const model = normalizeFaceModel(base, 'creature');
    expect(model.hp).toBe(60);
    expect(model.damaged).toBe(false);
  });

  it('renders effective attack with boosted/reduced flags', () => {
    expect(normalizeFaceModel({ ...base, displayAtk: 40 }, 'creature')).toMatchObject({
      atk: 40, atkBoosted: true, atkReduced: false,
    });
    expect(normalizeFaceModel({ ...base, displayAtk: 10 }, 'creature')).toMatchObject({
      atk: 10, atkBoosted: false, atkReduced: true,
    });
  });

  it('zero ATK is a legal value, not a missing one', () => {
    const model = normalizeFaceModel({ ...base, atk: 0 }, 'creature');
    expect(model.atk).toBe(0);
    // And the real zero-ATK creature normalizes.
    const echomask = Object.values(CREATURES).find((c) => c.atk === 0);
    expect(echomask).toBeTruthy();
    expect(normalizeFaceModel(echomask, 'creature').atk).toBe(0);
  });

  it('curHp of zero displays as 0, never falls back to base hp', () => {
    const model = normalizeFaceModel({ ...base, curHp: 0 }, 'creature');
    expect(model.hp).toBe(0);
    expect(model.damaged).toBe(true);
  });

  it('every real card normalizes, including the longest name and rules text', () => {
    for (const creature of Object.values(CREATURES)) {
      expect(() => normalizeFaceModel(creature, 'creature')).not.toThrow();
    }
    for (const verse of Object.values(VERSES)) {
      expect(() => normalizeFaceModel(verse, verse.type === 'set' ? 'set' : 'cast')).not.toThrow();
    }
    const longestName = [...Object.values(CREATURES), ...Object.values(VERSES)]
      .sort((a, b) => b.name.length - a.name.length)[0];
    expect(normalizeFaceModel(
      longestName,
      longestName.cardType === 'creature' ? 'creature' : (longestName.type === 'set' ? 'set' : 'cast'),
    ).name).toBe(longestName.name);
  });
});

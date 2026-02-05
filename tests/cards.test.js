import { describe, it, expect } from 'vitest';
import { CREATURES, VERSES, DECKS, getCreature, getVerse, getDeck } from '../src/cards.js';

describe('CREATURES', () => {
  it('has 29 creatures', () => {
    expect(Object.keys(CREATURES)).toHaveLength(29);
  });

  it('all creatures have required fields', () => {
    for (const [id, creature] of Object.entries(CREATURES)) {
      expect(creature.id).toBe(id);
      expect(creature.name).toBeTruthy();
      expect(creature.subtitle).toBeTruthy();
      expect(typeof creature.cost).toBe('number');
      expect(typeof creature.hp).toBe('number');
      expect(typeof creature.atk).toBe('number');
      expect(creature.ability).toBeTruthy();
      expect(creature.abilityText).toBeTruthy();
    }
  });

  it('all creatures have valid costs (0-5)', () => {
    for (const creature of Object.values(CREATURES)) {
      expect(creature.cost).toBeGreaterThanOrEqual(0);
      expect(creature.cost).toBeLessThanOrEqual(5);
    }
  });

  it('all creatures have positive HP', () => {
    for (const creature of Object.values(CREATURES)) {
      expect(creature.hp).toBeGreaterThan(0);
    }
  });
});

describe('VERSES', () => {
  it('has 26 verses', () => {
    expect(Object.keys(VERSES)).toHaveLength(26);
  });

  it('all verses have required fields', () => {
    for (const [id, verse] of Object.entries(VERSES)) {
      expect(verse.id).toBe(id);
      expect(verse.name).toBeTruthy();
      expect(verse.type).toMatch(/^(cast|set)$/);
      expect(typeof verse.cost).toBe('number');
      expect(verse.text).toBeTruthy();
    }
  });

  it('set verses have triggers', () => {
    for (const verse of Object.values(VERSES)) {
      if (verse.type === 'set') {
        expect(verse.trigger).toBeTruthy();
      }
    }
  });

  it('has 8 cast and 6 set verses', () => {
    const cast = Object.values(VERSES).filter(v => v.type === 'cast');
    const set = Object.values(VERSES).filter(v => v.type === 'set');
    expect(cast).toHaveLength(16);
    expect(set).toHaveLength(10);
  });
});

describe('DECKS', () => {
  it('has 5 decks', () => {
    expect(Object.keys(DECKS)).toHaveLength(5);
  });

  it('all decks have valid creature references', () => {
    for (const deck of Object.values(DECKS)) {
      for (const creatureId of deck.creatures) {
        expect(CREATURES[creatureId]).toBeDefined();
      }
    }
  });

  it('all decks have valid verse references', () => {
    for (const deck of Object.values(DECKS)) {
      for (const verseId of deck.verses) {
        expect(VERSES[verseId]).toBeDefined();
      }
    }
  });

  it('each deck has 8 creatures and 12 verses (20 cards total)', () => {
    for (const deck of Object.values(DECKS)) {
      expect(deck.creatures).toHaveLength(8);
      expect(deck.verses).toHaveLength(12);
    }
  });
});

describe('helper functions', () => {
  it('getCreature returns correct creature', () => {
    expect(getCreature('whisper').name).toBe('Whisper');
    expect(getCreature('nonexistent')).toBeUndefined();
  });

  it('getVerse returns correct verse', () => {
    expect(getVerse('darkPact').name).toBe('Dark Pact');
    expect(getVerse('nonexistent')).toBeUndefined();
  });

  it('getDeck returns correct deck', () => {
    expect(getDeck('shadow').creatures).toContain('whisper');
    expect(getDeck('nonexistent')).toBeUndefined();
  });
});

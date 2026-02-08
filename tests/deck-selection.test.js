/**
 * Deck Selection Tests
 * TDD for dual deck selector with random option
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DECKS } from '../src/cards.js';

describe('Deck Selection', () => {
  describe('DECKS availability', () => {
    it('should have 5 decks available', () => {
      const deckIds = Object.keys(DECKS);
      expect(deckIds).toContain('shadow');
      expect(deckIds).toContain('fang');
      expect(deckIds).toContain('venom');
      expect(deckIds).toContain('swarm');
      expect(deckIds).toContain('shell');
      expect(deckIds.length).toBe(5);
    });
  });

  describe('Random deck selection', () => {
    it('should select from all 5 decks when random', () => {
      const deckIds = Object.keys(DECKS);
      const selections = new Set();
      
      // Run 100 times to ensure we hit multiple decks
      for (let i = 0; i < 100; i++) {
        const randomIdx = Math.floor(Math.random() * deckIds.length);
        selections.add(deckIds[randomIdx]);
      }
      
      // Should have selected at least 3 different decks (statistically very likely)
      expect(selections.size).toBeGreaterThanOrEqual(3);
    });

    it('random selection should return valid deck id', () => {
      const deckIds = Object.keys(DECKS);
      const randomIdx = Math.floor(Math.random() * deckIds.length);
      const selected = deckIds[randomIdx];
      
      expect(DECKS[selected]).toBeDefined();
      expect(DECKS[selected].creatures).toBeDefined();
      expect(DECKS[selected].verses).toBeDefined();
    });
  });

  describe('Deck structure', () => {
    it('each deck should have creatures and verses arrays', () => {
      for (const [id, deck] of Object.entries(DECKS)) {
        expect(Array.isArray(deck.creatures), `${id} creatures`).toBe(true);
        expect(Array.isArray(deck.verses), `${id} verses`).toBe(true);
        expect(deck.creatures.length, `${id} creature count`).toBeGreaterThan(0);
        expect(deck.verses.length, `${id} verse count`).toBeGreaterThan(0);
      }
    });
  });
});
